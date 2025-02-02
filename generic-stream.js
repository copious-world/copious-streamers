//
const polka       = require('polka');
const send = require('@polka/send-type');
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
const { RepoWriter } = require('./repo_deliver.js')
const AssetDelivery = require('./asset_delivery')
//
// -------- -------- -------- -------- -------- -------- -------- -------- -------- -------- -------- -------- -------- --------
//
const conf_file = process.argv[2]  ?  process.argv[2] :  "generic-service.conf"
const crypto_conf = 'desk_app_new.config'

const config = fs.readFileSync(conf_file).toString()
const conf = JSON.parse(config)
// would crash if the config is bad... required.
//
if ( conf.api === undefined ) {
  console.log("generic streamer:: the configuration field 'api' has not been defined, no streamer available")
}
// CONFIG PARAMETERS
g_streamer_port = conf.port
if ( g_streamer_port === undefined ) {
  throw new Error("generic streamer:: no port has beend defined.")
}
//
const gc_asset_of_day_info = conf.daily_play_json // ${__dirname}/sites/popsong/song_of_day.json`
let pdir = conf.play_dir
if ( pdir[pdir.length - 1] !== '/' ) pdir += '/'
const gc_asset_directory =   pdir   // process.argv[3] !== undefined ?  `${__dirname}` : '/home/sounds'

const ASSET_OF_DAY_UPDATE_INTERVAL =  conf.update_interval


let default_repo = 'local'
if ( conf.default_repo !== undefined ) {
  default_repo = conf.default_repo
}


// PLAY COUNTER
const PlayCounter = conf.counter_service ? require(conf.counter_service) :  require('./play_counter.js')
//
console.log("daily_play_json " + gc_asset_of_day_info)
const g_play_counter = new PlayCounter(conf.counting_service,crypto_conf,gc_asset_of_day_info,ASSET_OF_DAY_UPDATE_INTERVAL)
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

let g_repo_services = false
const g_repository = new Repository(conf,conf.supported_repo_types) // ['ipfs','local'])
//
async function repo_starter() { 
  await g_repository.init_repos()
  g_repo_services = g_repository.repos
}

// -------- -------- -------- -------- -------- -------- -------- -------- -------- -------- -------- -------- -------- --------

let g_crypto_M = new CryptoManager(crypto_conf)

// -------- -------- -------- -------- -------- -------- -------- -------- -------- -------- -------- -------- -------- --------

let g_repo_sender = false
async function init_sender() {
  await repo_starter() 
  g_repo_sender = new RepoWriter(g_repo_services,g_crypto_M)    // the writer receives the crypto class...
}

init_sender().then(() => {
  // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
  // -------- -------- -------- -------- -------- -------- -------- -------- -------- -------- -------- -------- -------- --------

  var g_media_extension = conf.media_extension
  var g_ext_to_type = conf.ext_to_type


  app.get('/', (req, res) => {
    console.log(req.headers.host)
    let filename = get_media_of_the_day()
    res.end(`sound-stream [THIS IS A] system check :: ${filename}`)
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



  // -------- -------- -------- -------- -------- -------- -------- -------- -------- -------- -------- -------- -------- --------


  let conf_delivery = {
    "med_ext" : g_media_extension,
    "ext" : g_ext_to_type,
    "dir" : gc_asset_directory,
    "repo_sender" : g_repo_sender,
    "default_repo" : default_repo,
    "crypto_M" : g_crypto_M,
    "play_count" : play_count,
    "media_of_the_day" : get_media_of_the_day,
    "safe_host"  : conf.safe_host,
    "safe_redirect" : conf.safe_redirect
  }
  
  let g_asset_delivery = new AssetDelivery(conf_delivery)

  if ( typeof g_play_counter.set_asset_delivery === 'function' ) { g_play_counter.set_asset_delivery(g_asset_delivery) }
  //
  if ( typeof conf.api === 'object') {
    //
    if ( typeof conf.api.daily === 'string' ) {
      app.get(conf.api.daily,(req,res) => { g_asset_delivery.asset_of_the_day(req,res) })
    }
    //
    if ( typeof conf.api.streamer === 'string' ) {
      app.get(conf.api.streamer, (req,res) => { g_asset_delivery.asset_streamer(req,res) });
    }
  }
  //
  app.get('/stream/:key', (req,res) => { g_asset_delivery.repo_key(req,res) });
  //
  app.get('/stream/:key/:mime', (req,res) => { g_asset_delivery.repo_key_mime(req,res) });
  //
  app.get('/stream/:repo/:key', (req,res) => { g_asset_delivery.repo_key(req,res) });
  //
  app.get('/stream/:repo/:key/:mime', (req,res) => { g_asset_delivery.repo_key_mime(req,res) });
  //
  app.post('/key-media', (req,res) => { g_asset_delivery.ucwid_url(req,res) })

  //
  app.get('/add-key-requester/:counter_address', async (req,res) => {
    let persistence_link = req.params.counter_address
    persistence_link = decodeURIComponent(persistence_link)
    await g_play_counter.add_relay_path(persistence_link)
    send(res,200,{ "status" : "OK" })
  })


  app.listen(g_streamer_port, () => {
    console.log(`${conf.app_moniker} Application Listening on Port ${g_streamer_port}`);
  });

})
