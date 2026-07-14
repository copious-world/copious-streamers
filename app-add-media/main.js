//'use strict'

const { app, BrowserWindow } = require('electron')
const IPFS = require('ipfs')
const fs = require('fs')
const uuid = require('uuid/v4')
const crypto = require('crypto')


let g_algorithm = 'aes-256-cbc';
let g_key = '7x!A%D*G-JaNdRgUkXp2s5v8y/B?E(H+';
let g_iv = crypto.randomBytes(16);

let g_conf = fs.readFileSync('desk_app.config').toString()

try {
  g_conf = JSON.parse(g_conf)
} catch (e) {
  console.log("COULD NOT READ CONFIG FILE " + 'desk_app.config')
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



function encryptMedia(data) {
  const cipher = crypto.createCipheriv(g_algorithm, g_key, g_iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  return encrypted
}


function decryptMedia(data) {
  try {
      const decipher = crypto.createDecipheriv(g_algorithm, g_key, g_iv);
      const decrpyted = Buffer.concat([decipher.update(data), decipher.final()]);
      return decrpyted
  } catch (e) {
      throw e;
  }
}
//

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


check_crypto_config(g_conf)

async function test_decrypt() {
  let media_name = 'cloudsdrift_cdb.mp3'
  let in_file = g_conf.asset_dir + media_name

  try {
    let enc_blob = fs.readFileSync(in_file)

    let clear_blob = decryptMedia(enc_blob)

    let out_file = g_conf.asset_dir + "clear_" + media_name
    fs.writeFileSync(out_file,clear_blob)

    let cid = "Qme18G3xXNW9qDgkTGsrvFieEbfnjDhHzHs7f7CA5yRwbk"

    let out_file_2 = g_conf.asset_dir + "ipfs_clear_" + media_name
    let decrypt_eng = new DecryptStream()
    let writeStream = fs.createWriteStream(out_file_2)

    for await ( const chunk of g_ipfs_node.cat(cid) ) {
      //chunks.push(chunk)
      let dec_chunk = decrypt_eng.decrypt_chunk(chunk)
      writeStream.write(dec_chunk)
    }
    let dec_chunk = decrypt_eng.decrypt_chunk_last()
    writeStream.write(dec_chunk)
    writeStream.close()
    

  } catch (e) {
    console.error("did not write media")
  }

}

// ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----

let mainWindow

function createWindow () {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true
    }
  })

  // and load the index.html of the app.
  mainWindow.loadFile('index.html')

  // Open the DevTools.
  mainWindow.webContents.openDevTools()

  // Emitted when the window is closed.
  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

var g_ipfs_node = false

app.on('ready', async () => {
  createWindow()
  try {
    g_ipfs_node = await IPFS.create()
    const id = await g_ipfs_node.id()
    console.log(id)


    test_decrypt()

  } catch (err) {
    console.error(err)
  }
})

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') { app.quit() }
})

app.on('activate', () => {
  if (mainWindow === null) { createWindow() }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
// In the Main process
const { ipcMain } = require('electron')

ipcMain.handle('pyth', (event,x,y) => {
  // ... do actions on behalf of the Renderer
  console.log(Math.sqrt(x*x + y*y))
})

ipcMain.handle('new-entry', async (event,data) => {
  //
  // ... do actions on behalf of the Renderer
  //
  let _tracking =  uuid()
  //
  let blob_data = false
  //
  if ( data.media.source ) {
    console.log(data.media.source.file)
    //
    blob_data = data.media.source.blob_url
    delete data.media.source.blob_url
    //
    const blob = Buffer.from(blob_data, 'base64');
    //
    let media_name = data.media.source.file.name
    let out_file = g_conf.asset_dir + media_name
    try {
      //
      let enc_blob = encryptMedia(blob)
      fs.writeFileSync(out_file,enc_blob)
      //
      const file = await g_ipfs_node.add({
          "path": media_name,
          "content": enc_blob
      })
      //
      let cid = file.cid.toString()
      data.media.protocol = 'ipfs'
      data.media.ipfs = cid

    } catch (e) {
      console.error("did not write media")
    }
    //

    //
  }

  if ( data.media.poster ) {
    //
    let image_name = data.media.poster.file.name
    let image_blob_url = data.media.poster.blob_url

    let image_out_file = g_conf.asset_dir + image_name
    try {
      fs.writeFileSync(image_out_file,image_blob_url)
    } catch (e) {
      console.error("did not write image")
    } 
    //     
  }

  data._tracking = _tracking
  //
  try {
    let out_file = g_conf.entries_dir + _tracking + ".json"
    fs.writeFileSync(out_file,JSON.stringify(data,false,2))
  } catch (e) {
    console.error("did not write image")
  }

})

