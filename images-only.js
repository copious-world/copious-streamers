//
const express     = require('express');
const app         = express();
const fs          = require('fs');
const path        = require('path')

const PlayCounter = require('../play_counter.js')

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
config = JSON.parse(config)
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


var g_media_extension = ['.gif','.jpg','.png']
var g_ext_to_type = {
  '.ogg' : "audio/ogg",
  '.mp3' : "audio/mpeg",
  '.txt' : "text/ascii"
}

var g_ext_to_type = {
  'gif': 'image/gif',
  'jpg': 'image/jpeg',
  'png': 'image/png'
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
    // get image stats (about 61MB)
    const imagePath = gc_image_directory + key;    // configured
    const imageSize = fs.statSync(key).size;

    // Create headers
    const contentLength = imageSize;
    const headers = {
      "Content-Length": contentLength,
      "Content-Type": "image/jpeg",  // image mime/type...
    };

    // HTTP Status 206 for Partial Content
    res.writeHead(200, headers);
    fs.createReadStream(imagePath).pipe(res);

  } catch(e) {
    return res.sendStatus(500);
  }
});




// "nodemon index.js"


/*


app.get('*', function (req, res) {
    var file = path.join(dir, req.path.replace(/\/$/, '/index.html'));
    if (file.indexOf(dir + path.sep) !== 0) {
        return res.status(403).end('Forbidden');
    }
    var type = mime[path.extname(file).slice(1)] || 'text/plain';
    var s = fs.createReadStream(file);
    s.on('open', function () {
        res.set('Content-Type', type);
        s.pipe(res);
    });
    s.on('error', function () {
        res.set('Content-Type', 'text/plain');
        res.status(404).end('Not found');
    });
});


http.createServer(function(req, res) {
  res.writeHead(200,{'content-type':'image/jpg'});
  fs.createReadStream('./image/demo.jpg').pipe(res);
}).listen(3000);




*/



app.listen(g_imageer_port, function() {
  console.log(`[NodeJS] Application Listening on Port ${g_imageer_port}`);
});



