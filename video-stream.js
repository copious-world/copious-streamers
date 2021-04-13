//
const express     = require('express');
const app         = express();
const fs          = require('fs');
const path        = require('path')
const os          = require('os')

const crypto = require('crypto')
const FileType = require('file-type');

const PlayCounter = require('./play_counter.js')

const IPFS = require('ipfs');            // using the IPFS protocol to store data via the local gateway


let g_algorithm = false;
let g_key = '7x!A%D*G-JaNdRgUkXp2s5v8y/B?E(H+';
let g_iv = crypto.randomBytes(16);


class DecryptStream {
  constructor() {
    this.decipher = crypto.createDecipheriv(g_algorithm, g_key, g_iv);
  }

  decrypt_chunk(data) {
    const decrpyted = Buffer.concat([this.decipher.update(data)]);   //, decipher.final()
    return decrpyted
  }

  decrypt_chunk_last() {
    const decrpyted = Buffer.concat([this.decipher.final()]); 
    return decrpyted
  }
}




function check_crypto_config(conf) {
  if ( conf.crypto ) {
    if ( conf.crypto.key && (conf.crypto.key !== "nothing") ) {
      g_key = conf.crypto.key
    } else {
      throw new Error("configuration does not include crypto components")
    }
    if ( conf.crypto.algorithm  && (conf.crypto.algorithm !== "nothing")  ) {
      g_algorithm = conf.crypto.algorithm
    } else {
      throw new Error("configuration does not include crypto components")
    }
    if ( conf.crypto.iv && (conf.crypto.iv !== "nothing") ) {
      g_iv = Buffer.from(conf.crypto.iv, 'base64');
    } else {
      g_iv = crypto.randomBytes(16);
      conf.crypto.iv = g_iv.toString('base64')
      fs.writeFileSync('desk_app.config',JSON.stringify(conf,null,2))
    }
  } else {
    throw new Error("configuration does not include crypto")
  }
}

/*
nginx 
//
location /mp3/ {
    root data;
    mp4;
    mp4_buffer_size      1m;
    mp4_max_buffer_size  5m;
 }
*/

// -------- -------- -------- -------- -------- -------- -------- -------- -------- -------- -------- -------- -------- --------

const conf_file = process.argv[2]  ?  process.argv[2] :  "video-service.conf"
const crypto_conf = 'desk_app.config'

const config = fs.readFileSync(conf_file).toString()
const conf = JSON.parse(config)
// would crash if the config is bad... required.
//
// CONFIG PARAMETERS
g_streamer_port = conf.port
//
const gc_movie_of_day_info = conf.daily_play_json // ${__dirname}/sites/popmovie/movie_of_day.json`
let pdir = conf.play_dir
if ( pdir[pdir.length - 1] !== '/' ) pdir += '/'
const gc_movie_directory =   pdir   // process.argv[3] !== undefined ?  `${__dirname}` : '/home/sounds'


const MOVIE_OF_DAY_UPDATE_INTERVAL =  conf.update_interval

// PLAY COUNTER
var g_play_counter = new PlayCounter(gc_movie_of_day_info,MOVIE_OF_DAY_UPDATE_INTERVAL)


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


let g_conf = fs.readFileSync(crypto_conf).toString()

try {
  g_crypto_conf = JSON.parse(g_conf)
} catch (e) {
  console.log("COULD NOT READ CONFIG FILE " + crypto_conf)
}

check_crypto_config(g_crypto_conf)

// -------- -------- -------- -------- -------- -------- -------- -------- -------- -------- -------- -------- -------- --------

var g_service_ipfs = false

async function init_ipfs() {
  let node = await IPFS.create({
      repo: __dirname + conf.ipfs.repo_dir,
      config: {
        Addresses: {
          Swarm: [
            `/ip4/0.0.0.0/tcp/${conf.ipfs.swarm_tcp}`,
            `/ip4/127.0.0.1/tcp/${conf.ipfs.swarm_ws}/ws`
          ],
          API: `/ip4/127.0.0.1/tcp/${conf.ipfs.api_port}`,
          Gateway: `/ip4/127.0.0.1/tcp/${conf.ipfs.tcp_gateway}`
        }
      }
    })

    const version = await node.version()
    console.log('Version:', version.version)

    g_service_ipfs = node
}


// -------- -------- -------- -------- -------- -------- -------- -------- -------- -------- -------- -------- -------- --------


var g_media_extension = ['.mpeg','.mp4','.txt']
var g_ext_to_type = {
  '.mpeg' : "video/mp4",
  '.mp4' : "video/mp4",
  '.txt' : "text/ascii"
}


app.get('/', (req, res) => {
  console.log(req.headers.host)
  let filename = get_media_of_the_day()
  console.log(filename)

  res.end('system check')
})

app.get('/movieoftheday', (req, res) => {
  //
  if ( (req.headers.host === 'localhost') || ( req.headers.host.indexOf('popsongnow.com') >= 0 ) ) {
    //
    let media_extensions = [].concat(g_media_extension)
    console.dir(media_extensions)
    let filename = get_media_of_the_day()
    //
    while ( media_extensions.length > 0 ) {
      let media_extension = media_extensions.shift()
      try {
        //
        let fname = filename + media_extension
        console.log(gc_song_directory + fname)
        let stat = fs.statSync(gc_movie_directory + fname)  // throws exception
        //
        play_count()
        let mtype = g_ext_to_type[media_extension]
        res.writeHead(200, {
          'Content-Type': mtype,
          'Content-Length': stat.size
        });
        // We replaced all the event handlers with a simple call to util.pump()
        fs.createReadStream(gc_movie_directory + fname,{start:0}).pipe(res);
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


app.get('/play/:key', (req, res) => {
  let key = req.params.key;

  let movie = gc_movie_directory + key

  let ext = '.' + path.extname(key)
  let mtype = g_ext_to_type[ext]

  let stat
  try {
    stat = fs.statSync(movie);
  } catch(e) {
    res.end()
    return
  }

  range = req.headers.range;
  let readStream;

  if ( range !== undefined ) {

    console.log(movie)


    let parts = range.replace(/bytes=/, "").split("-");

    let partial_start = parts[0];
    let partial_end = parts[1];

    if ((isNaN(partial_start) && partial_start.length > 1) || (isNaN(partial_end) && partial_end.length > 1)) {
        return res.sendStatus(500); //ERR_INCOMPLETE_CHUNKED_ENCODING
    }

    let start = parseInt(partial_start, 10);
    let end = partial_end ? parseInt(partial_end, 10) : stat.size - 1;
    let content_length = (end - start) + 1;

    res.status(206).header({
        'Content-Type': mtype,
        "Accept-Ranges": "bytes",
        'Content-Length': content_length,
        'Content-Range': "bytes " + start + "-" + end + "/" + stat.size
    });

    readStream = fs.createReadStream(movie, {start: start, end: end});
  } else {
    res.header({
        'Content-Type': mtype,
        'Content-Length': stat.size
    });
    console.log(movie)
    readStream = fs.createReadStream(movie);
  }
  //
  play_count(key)
  // readStream
  readStream.pipe(res);

});


app.get('/ipfs/:key', async (req, res) => {
  //
  let cid = req.params.key;
  //
  range = req.headers.range;

  play_count("ipfs:/" + cid)

  let stat_size = false;
  for await (const file of g_service_ipfs.ls(cid)) {
    console.dir(file)
    stat_size = file.size
  }

  let crypto_algorithm = g_algorithm

  if ( range !== undefined ) {
    //
    let parts = range.replace(/bytes=/, "").split("-");

    let partial_start = parts[0];
    let partial_end = parts[1];

    if ((isNaN(partial_start) && partial_start.length > 1) || (isNaN(partial_end) && partial_end.length > 1)) {
        return res.sendStatus(500); //ERR_INCOMPLETE_CHUNKED_ENCODING
    }

    let start = parseInt(partial_start, 10);
    let end = partial_end ? parseInt(partial_end, 10) : (stat_size ? stat_size : 1) - 1;
    let content_length = (end - start) + 1;

    res.status(206).header({
        'Content-Type': 'video/mp4',
        "Accept-Ranges": "bytes",
        'Content-Length': content_length,
        'Content-Range': "bytes " + start + "-" + end + "/" + (stat_size ? stat_size : 1)
    });

    console.dir({start: start, end: end})
    
    if ( g_service_ipfs !== false ) {
      let section_opt = {
        "offset" : start,
        "length" : content_length
      }
      //
      if ( crypto_algorithm !== false ) {
        //
        let decrypt_eng = new DecryptStream()

        for await ( const chunk of g_service_ipfs.cat(cid,section_opt) ) {
          let dec_chunk = decrypt_eng.decrypt_chunk(chunk)
          res.write(chunk)
        }
        //let dec_chunk = decrypt_eng.decrypt_chunk_last()
        //res.write(dec_chunk)
        //
        res.end()
      }
    }

  } else {

    let hdr = {
      'Content-Type': 'video/mp4'
    }
    if (stat_size) {
      hdr['Content-Length'] = stat_size
    }
    res.header(hdr);

  console.dir(hdr)

    if ( g_service_ipfs !== false ) {

      if ( crypto_algorithm !== false ) {
        //
        console.log(crypto_algorithm)

        let decrypt_eng = new DecryptStream()
        for await ( const chunk of g_service_ipfs.cat(cid) ) {
          //
          //let dec_chunk = decrypt_eng.decrypt_chunk(chunk)
          res.write(chunk)
        }

        //let dec_chunk = decrypt_eng.decrypt_chunk_last()
        //res.write(dec_chunk)  
        res.end()
      }

    }
    return
  }
  //
  // readStream
  //readStream.pipe(res);
});


init_ipfs()

app.listen(g_streamer_port, function() {
  console.log(`[NodeJS] Application Listening on Port ${g_streamer_port}`);
});



