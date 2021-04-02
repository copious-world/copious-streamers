//
const express     = require('express');
const app         = express();
const fs          = require('fs');
const path        = require('path')
const os          = require('os')

const PlayCounter = require('./play_counter.js')

const IPFS = require('ipfs');            // using the IPFS protocol to store data via the local gateway

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

const conf_file = process.argv[2]  ?  process.argv[2] :  "sound-service.conf"

const config = fs.readFileSync(conf_file).toString()
const conf = JSON.parse(config)
// would crash if the config is bad... required.
//
// CONFIG PARAMETERS
g_streamer_port = conf.port
//
const gc_song_of_day_info = conf.daily_play_json // ${__dirname}/sites/popsong/song_of_day.json`
let pdir = conf.play_dir
if ( pdir[pdir.length - 1] !== '/' ) pdir += '/'
const gc_song_directory =   pdir   // process.argv[3] !== undefined ?  `${__dirname}` : '/home/sounds'


const SONG_OF_DAY_UPDATE_INTERVAL =  conf.update_interval

// PLAY COUNTER
var g_play_counter = new PlayCounter(gc_song_of_day_info,SONG_OF_DAY_UPDATE_INTERVAL)


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


var g_media_extension = ['.mp3','.ogg','.txt']
var g_ext_to_type = {
  '.mp3' : "audio/mpeg",
  '.ogg' : "audio/ogg",
  '.txt' : "text/ascii"
}


app.get('/', (req, res) => {
  console.log(req.headers.host)
  let filename = get_media_of_the_day()
  console.log(filename)

  res.end('system check')
})

app.get('/songoftheday', (req, res) => {
//
  if ( (req.headers.host === 'localhost') || ( req.headers.host.indexOf('popsongnow.com') >= 0 ) ) {
    //
    let media_extensions = [].concat(g_media_extension)
    console.dir(media_extensions)
    //
    while ( media_extensions.length > 0 ) {
      let media_extension = media_extensions.shift()
      try {
        //
        let fname = filename + media_extension
        console.log(gc_song_directory + fname)
        let stat = fs.statSync(gc_song_directory + fname)  // throws exception
        //
        play_count()
        let mtype = g_ext_to_type[media_extension]
        res.writeHead(200, {
          'Content-Type': mtype,
          'Content-Length': stat.size
        });
        // We replaced all the event handlers with a simple call to util.pump()
        fs.createReadStream(gc_song_directory + fname,{start:0}).pipe(res);
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

  let music = gc_song_directory + key

  let ext = '.' + path.extname(key)
  let mtype = g_ext_to_type[ext]

  let stat
  try {
    stat = fs.statSync(music);
  } catch(e) {
    res.end()
    return
  }


  range = req.headers.range;
  let readStream;

  if ( range !== undefined ) {
    //
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

    readStream = fs.createReadStream(music, {start: start, end: end});
  } else {
    res.header({
        'Content-Type': mtype,
        'Content-Length': stat.size
    });
    readStream = fs.createReadStream(music);
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
  let readStream;

  play_count("ipfs:/" + cid)


  let stat_size = 10;
  for await (const file of g_service_ipfs.ls(cid)) {
    console.dir(file)
    stat_size = file.size
  }

  if ( range !== undefined ) {
    //
    let parts = range.replace(/bytes=/, "").split("-");

    let partial_start = parts[0];
    let partial_end = parts[1];

    if ((isNaN(partial_start) && partial_start.length > 1) || (isNaN(partial_end) && partial_end.length > 1)) {
        return res.sendStatus(500); //ERR_INCOMPLETE_CHUNKED_ENCODING
    }

    let start = parseInt(partial_start, 10);
    let end = partial_end ? parseInt(partial_end, 10) : stat_size - 1;
    let content_length = (end - start) + 1;

    res.status(206).header({
        'Content-Type': 'audio/mpeg',
        "Accept-Ranges": "bytes",
        'Content-Length': content_length,
        'Content-Range': "bytes " + start + "-" + end + "/" + stat_size
    });

    console.dir({start: start, end: end})
    
    if ( g_service_ipfs !== false ) {
      let section_opt = {
        "offset" : start,
        "length" : content_length
      }
      for await ( const chunk of g_service_ipfs.cat(cid,section_opt) ) {
        //chunks.push(chunk)
        res.write(chunk)
      }
      //readStream = fs.createReadStream(music);
      res.end()
    }



//    readStream = fs.createReadStream(music, {start: start, end: end});
  } else {
    res.header({
        'Content-Type': 'audio/mpeg'
    });
    /*
    ,
    'Content-Length': stat.size
    */

    if ( g_service_ipfs !== false ) {
      for await ( const chunk of g_service_ipfs.cat(cid) ) {
        //chunks.push(chunk)
        res.write(chunk)
      }
      //readStream = fs.createReadStream(music);
      res.end()
    }

    return
  }
  //
  // readStream
  //readStream.pipe(res);
});




/*

    let cid = 'QmdBKa2m1PxZRcnSGizQdwRyp21pKhXTkHjVgdAb6YhmRh'
    const chunks = []
    for await ( const chunk of node.cat(cid) ) {
        chunks.push(chunk)
    }
  
    console.log(chunks.length)
    let output = Buffer.concat(chunks)
*/

init_ipfs()

app.listen(g_streamer_port, function() {
  console.log(`[NodeJS] Application Listening on Port ${g_streamer_port}`);
});


