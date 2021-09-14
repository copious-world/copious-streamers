//
const polka       = require('polka');
const app         = polka();
const fs          = require('fs');
const Repository  = require('repository-bridge')
//
//
// -------- -------- -------- -------- -------- -------- -------- -------- -------- -------- -------- -------- -------- --------
//
const { json } = require('body-parser');
app.use(json())
//app.use()
//
//
const { CryptoManager } = require('./crypto_manager.js')
const { IpfsWriter } = require('./ipfs_deliver.js')
const AssetDelivery = require('./asset_delivery')
//
// -------- -------- -------- -------- -------- -------- -------- -------- -------- -------- -------- -------- -------- --------
//
const conf_file = process.argv[2]  ?  process.argv[2] :  "image-service.conf"
const crypto_conf = 'desk_app.config'

const config = fs.readFileSync(conf_file).toString()
const conf = JSON.parse(config)
// would crash if the config is bad... required.
//
// CONFIG PARAMETERS
g_streamer_port = conf.port
//
const gc_asset_of_day_info = conf.daily_play_json // ${__dirname}/sites/popimage/image_of_day.json`
let pdir = conf.play_dir
if ( pdir[pdir.length - 1] !== '/' ) pdir += '/'
const gc_asset_directory =   pdir   // process.argv[3] !== undefined ?  `${__dirname}` : '/home/images'

const IMAGE_OF_DAY_UPDATE_INTERVAL =  conf.update_interval

// PLAY COUNTER
const PlayCounter = conf_file.counter_service ? require(conf_file.counting_service) :  require('./play_counter.js')
//
console.log(gc_asset_of_day_info)
var g_play_counter = new PlayCounter(gc_asset_of_day_info,IMAGE_OF_DAY_UPDATE_INTERVAL)
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

let g_service_ipfs = false
const g_repository = new Repository(conf,['ipfs'])
async function repo_starter() { 
  await g_repository.init_repos()
  g_service_ipfs = g_repository.repos['ipfs']
}

// -------- -------- -------- -------- -------- -------- -------- -------- -------- -------- -------- -------- -------- --------

let g_ctypo_M = new CryptoManager(crypto_conf)

// -------- -------- -------- -------- -------- -------- -------- -------- -------- -------- -------- -------- -------- --------

let g_ipfs_sender = false
async function init_sender() {
  await repo_starter() 
  g_ipfs_sender = new IpfsWriter(g_service_ipfs,g_ctypo_M)    // the writer receives the crypto class...
}

init_sender().then(() => {
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
    let filename = get_media_of_the_day()
    res.end(`image-repo [THIS IS A] system check :: ${filename}`)
  })

  app.get('/tests', (req, res) => {
    let html = fs.readFileSync('./tests/index.html')
    res.end(html)
  })

  app.get('/:file', (req, res) => {
    let file_name = req.params.file
    console.log(file_name)
    try {
      let html = fs.readFileSync(`./tests/${file_name}`)
      res.end(html)
    } catch (e) {
      res.end("")
    }
  })


  let conf_delivery = {
    "med_ext" : g_media_extension,
    "ext" : g_ext_to_type,
    "dir" : gc_asset_directory,
    "ipfs_sender" : g_ipfs_sender,
    "ctypo_M" : g_ctypo_M,
    "play_count" : play_count,
    "media_of_the_day" : get_media_of_the_day,
    "safe_host"  : 'popsongnow.com',
    "safe_redirect" : 'http://www.popsongnow.com/'
  }

  let g_asset_delivery = new AssetDelivery(conf_delivery,true)
  
  //
  app.get('/view/:key', (req,res) => { g_asset_delivery.asset_streamer(req,res) });
  //
  app.get('/ipfs/:key', (req,res) => { g_asset_delivery.ipfs_key(req,res) });
  //
  app.get('/ipfs/:key/:mime', (req,res) => { g_asset_delivery.ipfs_key_mime(req,res) });
  //
  app.post('/key-media', (req,res) => { g_asset_delivery.ucwid_url(req,res) })
  //

  //
  app.get('/add-key-requester/:counter_address', (req,res) => { 
    let persistence_link = req.params.counter_address
    persistence_link = decodeURIComponent(persistence_link)
    g_play_counter.add_relay_path(persistence_link)
    res.send({ "status" : "OK" })
  })
  

  app.listen(g_streamer_port, function() {
    console.log(`[IMAGES] Application Listening on Port ${g_streamer_port}`);
  });

})