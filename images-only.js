//
const express     = require('express');
const app         = express();
const fs          = require('fs');
const path        = require('path')

const PlayCounter = require('./play_counter.js')
const { CryptoManager } = require('./crypto_manager.js')
const { IpfsWriter } = require('./ipfs_deliver.js')

const IPFS = require('ipfs');            // using the IPFS protocol to store data via the local gateway

// -------- -------- -------- -------- -------- -------- -------- -------- -------- -------- -------- -------- -------- --------

const conf_file = process.argv[2]  ?  process.argv[2] :  "image-service.conf"
const crypto_conf = 'desk_app.config'

const config = fs.readFileSync(conf_file).toString()
const conf = JSON.parse(config)
// would crash if the config is bad... required.
//
// CONFIG PARAMETERS
g_streamer_port = conf.port
//
const gc_image_of_day_info = conf.daily_play_json // ${__dirname}/sites/popimage/image_of_day.json`
const gc_image_directory =   conf.play_dir   // process.argv[3] !== undefined ?  `${__dirname}` : '/home/sounds'


const IMAGE_OF_DAY_UPDATE_INTERVAL =  conf.update_interval

// PLAY COUNTER
var g_play_counter = new PlayCounter(gc_image_of_day_info,IMAGE_OF_DAY_UPDATE_INTERVAL)

// -------- -------- -------- -------- -------- -------- -------- -------- -------- -------- -------- -------- -------- --------

function play_count(asset) {
  if ( asset ) g_play_counter.incr(asset)
  else g_play_counter.incr()
}

function get_media_of_the_day() {
    return g_play_counter.media_of_the_day()
}

g_play_counter.init()

// -------- -------- -------- -------- -------- -------- -------- -------- -------- -------- -------- -------- -------- --------

let g_ctypo_M = new CryptoManager(crypto_conf)

// -------- -------- -------- -------- -------- -------- -------- -------- -------- -------- -------- -------- -------- --------

var g_service_ipfs = false
let g_ipfs_sender = false

async function init_ipfs(cnfg) {
  //
  let container_dir = cnfg.ipfs.repo_location
  if ( container_dir == undefined ) {
    container_dir =  __dirname + "/repos"
  }

  let subdir = cnfg.ipfs.dir
  if ( subdir[0] != '/' ) subdir = ('/' + subdir)
  let repo_dir = container_dir + subdir
  console.log(repo_dir)
  let node = await IPFS.create({
      repo: repo_dir,
      config: {
        Addresses: {
          Swarm: [
            `/ip4/0.0.0.0/tcp/${cnfg.ipfs.swarm_tcp}`,
            `/ip4/127.0.0.1/tcp/${cnfg.ipfs.swarm_ws}/ws`
          ],
          API: `/ip4/127.0.0.1/tcp/${cnfg.ipfs.api_port}`,
          Gateway: `/ip4/127.0.0.1/tcp/${cnfg.ipfs.tcp_gateway}`
        }
      }
    })

    const version = await node.version()
    console.log('Version:', version.version)

    g_service_ipfs = node
}

// ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
// -------- -------- -------- -------- -------- -------- -------- -------- -------- -------- -------- -------- -------- --------


var g_media_extension = ['.gif','.jpg','.png']

var g_ext_to_type = {
  '.gif': 'image/gif',
  '.jpg': 'image/jpeg',
  '.png': 'image/png'
};


app.get('/', (req, res) => {
  console.log(req.headers.host)
  res.end('system check')
})

app.get('/imageoftheday', (req, res) => {
  //
  if ( (req.headers.host === 'localhost') || ( req.headers.host.indexOf('popsongnow.com') >= 0 ) ) {
    //
    let media_extensions = [].concat(g_media_extension)
    while ( media_extensions.length > 0 ) {
      let media_extension = media_extensions.shift()
      let filename = get_media_of_the_day()
      try {
        //
        let fname = filename + media_extension
        let stat = fs.statSync(gc_image_directory + fname)  // throws exception
        //
        play_count()
        let mtype = g_ext_to_type[media_extension]
        res.writeHead(200, {
          'Content-Type': mtype,
          'Content-Length': stat.size
        });
        // We replaced all the event handlers with a simple call to util.pump()
        fs.createReadStream(gc_image_directory + fname,{start:0}).pipe(res);
        //
        return(true)
      } catch (e) {
        if ( !(media_extensions.length) ) {
          console.log(e)
        }
      }
      //
    }
    //
  }
  //
  res.writeHead(301, {Location: 'http://www.popsongnow.com/'} );
  res.end();
  return(false)
  //
})


app.get('/view/:key', (req, res) => {
  // Ensure there is a range given for the image

  try {
    let key = req.params.key
    let media_extension = path.extname(key)
  console.log(media_extension)
    let mtype = g_ext_to_type[media_extension]
  console.log(mtype)

    // get image stats (about 61MB)
    const imagePath = gc_image_directory + key;    // configured
    const imageSize = fs.statSync(imagePath).size;

    // Create headers
    const contentLength = imageSize;
    const headers = {
      "Content-Length": contentLength,
      "Content-Type": mtype,  // image mime/type...
    };

    // HTTP Status 206 for Partial Content
    res.writeHead(200, headers);
    fs.createReadStream(imagePath).pipe(res);

  } catch(e) {
    console.log(e)
    return res.sendStatus(500);
  }
});


app.get('/ipfs/:key', async (req, res) => {
  //
  let cid = req.params.key;
  //
  range = req.headers.range;
  play_count("ipfs:/" + cid)

  if ( (g_service_ipfs !== false)  && (g_ipfs_sender !== false) ) {
    //
    let stat_size = false;
    for await (const file of g_service_ipfs.ls(cid)) {
      //console.dir(file)
      stat_size = file.size
    }
    //
    let default_mime = false
    //
    let crypto_algorithm = g_ctypo_M.encryption_ready(cid)  // cid is passed for future reference
    if ( crypto_algorithm !== false ) {
      await g_ipfs_sender.ifps_deliver_encrypted(cid,stat_size,default_mime,res,range)
    } else {
      await g_ipfs_sender.ifps_deliver_plain(cid,stat_size,default_mime,res,range)
    }
  }

});


app.get('/ipfs/:key/:mime', async (req, res) => {
  //
  let cid = req.params.key;
  let mime_type = req.params.mime;
  //
  range = req.headers.range;
  play_count("ipfs:/" + cid)

  if ( (g_service_ipfs !== false)  && (g_ipfs_sender !== false) ) {
    //
    let stat_size = false;
    for await (const file of g_service_ipfs.ls(cid)) {
      stat_size = file.size
    }
    //
    let default_mime = mime_type
    //
    let crypto_algorithm = g_ctypo_M.encryption_ready(cid)  // cid is passed for future reference
    if ( crypto_algorithm !== false ) {
      await g_ipfs_sender.ifps_deliver_encrypted(cid,stat_size,default_mime,res,range)
    } else {
      await g_ipfs_sender.ifps_deliver_plain(cid,stat_size,default_mime,res,range)
    }
  }

});

(async () => {
  await init_ipfs(conf)
  g_ipfs_sender = new IpfsWriter(g_service_ipfs,g_ctypo_M)
})()



app.listen(g_streamer_port, function() {
  console.log(`[NodeJS] Application Listening on Port ${g_streamer_port}`);
});



