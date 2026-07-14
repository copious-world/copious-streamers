// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.


// In the Renderer process
const { ipcRenderer } = require('electron')


function get_file(file_el) {
    //
    if ( file_el.files.length ) {
        return new Promise((resolve,reject) => {
            let file = file_el.files[0]
            let fname =  file.name
            let mtype = file.type
            let reader = new FileReader();
            let file_copy = Object.assign({},file)
            for ( let ky in file ) { 
                if ( ky === 'arrayBuffer' ) continue
                if ( ky === 'slice' ) continue
                if ( ky == 'stream' ) continue
                if ( ky == 'text' ) continue
                if ( ky == 'webkitRelativePath' ) continue
                file_copy[ky] = file[ky]
            }
            reader.onload = (e) => {
                //
                let loaded = {
                    "blob_url" : e.target.result,
                    "name" : fname,
                    "mtype" : mtype,
                    "file" : file_copy
                }
                //
                resolve(loaded)
            };
            reader.readAsDataURL(file)
        })
    }
    //
    return false
}

async function gather_fields() {
    //
    let upload_record = {}
    try {
        let opt_fld = document.getElementById('rec-file-mtype')
        let title_fld = document.getElementById('rec-title')
        let keys_fld = document.getElementById('rec-keys')
        let abstract_fld = document.getElementById('rec-abstract')
        let full_text_fld = document.getElementById('rec-full-text')
        let file_name_fld = document.getElementById('rec-file-name')
        let poster_name_fld = document.getElementById('rec-poster-name')

        if ( !(opt_fld && title_fld && keys_fld && abstract_fld && full_text_fld && file_name_fld  && poster_name_fld) ) return {}

        let poster = await get_file(poster_name_fld)
        let media_data = await get_file(file_name_fld)

        if ( media_data === false ) {
            return upload_record
        }
    
        upload_record = {
          "_tracking" : "",
          "title" : title_fld.value,
          "keys" : keys_fld.value,
          "asset_class" : opt_fld.value,
          "abstract" : abstract_fld.value,
          "media" : {
            "poster" : poster,
            "source" : media_data
          },
          "full_text" : full_text_fld.value,
          "dates" : {
            "creation_date" : Date.now(),
            "update_date" : media_data.file.lastModified
          }
        }
        //    
    } catch (e) {
    }

    return(upload_record)
  }

async function when_i_say() {
    let good_data = await gather_fields() 
    let x = 10
    let y = 6
    ipcRenderer.invoke('pyth',x,y)
    ipcRenderer.invoke('new-entry',good_data)
}

let p_button = document.getElementById("pythagorus")
if ( p_button ) {
    p_button.addEventListener('click',() => { when_i_say() })
}
