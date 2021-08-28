//
// https://github.com/AndrewJBateman/svelte-rollup-crypto
// https://dev.to/shriji/crypto-widget-with-svelte-28h0


//
const polka       = require('polka');
const app         = polka();
const fs          = require('fs');
const Repository  = require('repository-bridge')
//
//
// -------- -------- -------- -------- -------- -------- -------- -------- -------- -------- -------- -------- -------- --------
//
//const { json } = require('body-parser');
//app.use(json)
//app.use()
//
//
const PlayCounter = require('./play_counter.js')
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
const gc_asset_directory =   pdir   // process.argv[3] !== undefined ?  `${__dirname}` : '/home/sounds'

const IMAGE_OF_DAY_UPDATE_INTERVAL =  conf.update_interval

// PLAY COUNTER
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

  app.get('/key', g_asset_delivery.asset_of_the_day)
  //
  app.get('/view/:key',g_asset_delivery.asset_streamer);
  //
  app.get('/ipfs/:key', g_asset_delivery.ipfs_key);
  //
  app.get('/ipfs/:key/:mime', g_asset_delivery.ipfs_key_mime);
  //
  app.post('/key-media', g_asset_delivery.ucwid_url)
  //

  app.listen(g_streamer_port, function() {
    console.log(`[IMAGES] Application Listening on Port ${g_streamer_port}`);
  });

})