const send        = require('@polka/send-type');
const path        = require('path')

/**
 * AssetDelivery
 * 
 */
class AssetDelivery {
    //
    constructor(conf,no_range) {
      this.use_range = !no_range
      //
      this.media_extension = conf.med_ext
      this.ext_to_type = conf.ext
      this.asset_directory = conf.dir
      this.repo_sender = conf.repo_sender
      this.crypto_M = conf.crypto_M
      this.default_repo = conf.default_repo
      //
      this.play_count = conf.play_count
      if ( ( this.play_count === false ) || ( this.play_count === undefined )  ) {
        this.play_count = () => {}
      }
      this.media_of_the_day = conf.media_of_the_day
      this.safe_host = conf.safe_host ? conf.safe_host : false
      this.safe_redirect = conf.safe_redirect
      this.stored_in_the_clear = {}
    }

    // --- --- --- --- --- --- ---
    /**
     * asset_of_the_day
     * 
     * @param {*} req 
     * @param {*} res 
     * @returns boolean
     */
    asset_of_the_day(req, res) {
      //
      //if ( (req.headers.host === 'localhost') || ( req.headers.host.indexOf(this.safe_host) >= 0 ) ) {
        //
        let media_extensions = [].concat(this.media_extension)
        let filename = this.media_of_the_day()
        //
        while ( media_extensions.length > 0 ) {
          let media_extension = media_extensions.shift()
          try {
            //
            let fname = filename + media_extension
            console.log(this.asset_directory + fname)
            let stat = fs.statSync(this.asset_directory + fname)  // throws exception
            //
            this.play_count()
            let mtype = this.ext_to_type[media_extension]
            res.writeHead(200, {
              'Content-Type': mtype,
              'Content-Length': stat.size
            });
            // We replaced all the event handlers with a simple call to util.pump()
            fs.createReadStream(this.asset_directory + fname,{start:0}).pipe(res);
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
      //}
      //
      res.writeHead(301, {Location: this.safe_redirect} );
      res.end();
      return(false)
      //
    }
  
    // --- --- --- --- --- --- ---
    /**
     * asset_streamer
     * 
     * @param {*} req 
     * @param {*} res 
     * @returns void
     */
    asset_streamer(req, res) {
      let key = req.params.key;
    
      let asset = this.asset_directory + key
  
      let ext = path.extname(key)
      let mtype = this.ext_to_type[ext]
      //
      let stat
      try {
          stat = fs.statSync(asset);
      } catch(e) {
          console.log("no music")
          res.end()
          return
      }
  
      let range = req.headers.range;
      let readStream;
  
      if ( this.use_range && (range !== undefined) ) {
          //
          let parts = range.replace(/bytes=/, "").split("-");
          //
          let partial_start = parts[0];
          let partial_end = parts[1];
      
          if ((isNaN(partial_start) && partial_start.length > 1) || (isNaN(partial_end) && partial_end.length > 1)) {
              return res.sendStatus(500); //ERR_INCOMPLETE_CHUNKED_ENCODING
          }
      
          let start = parseInt(partial_start, 10);
          let end = partial_end ? parseInt(partial_end, 10) : stat.size - 1;
          let content_length = (end - start) + 1;
          //
          res.writeHead(206,{
              'Content-Type': mtype,
              "Accept-Ranges": "bytes",
              'Content-Length': content_length,
              'Content-Range': "bytes " + start + "-" + end + "/" + stat.size
          });
          readStream = fs.createReadStream(asset, {start: start, end: end});
      } else {
          res.writeHead(206, {
              'Content-Type': mtype,
              'Content-Length': stat.size
          });
          readStream = fs.createReadStream(asset);
      }
      //
      this.play_count(key)
      // readStream
      readStream.pipe(res);
    }
  
  
    //
    /**
     * repo_key
     * 
     * @param {*} req 
     * @param {*} res 
     */
    async repo_key(req, res) {
      //
      let clear_cwid = req.params.key;
      let repo = this.default_repo
      if ( req.params.repo !== undefined ) {
        repo = req.params.repo
      }
      //
      let range = req.headers.range;
      this.play_count(`repo/${clear_cwid}`)
      //
      if ( this.repo_sender !== false ) {
        //
        let cid = false
        let needs_decrypt = true
        if ( this.stored_in_the_clear[clear_cwid] !== undefined ) {
          cid = clear_cwid // cid is passed for future reference
          needs_decrypt = false
        } else {
          cid = this.crypto_M.clear_cwid_to_cid(clear_cwid)  // cid is passed for future reference
        }
        if ( cid == false ) {   // means it was not encrypted and this caller has requested unencrypted stream out of repo...
          send(res,200,{ "status" : "ERR" })
        } else {
          let default_mime = false
          //
          try {
            if ( needs_decrypt ) {
              let encrypted = this.crypto_M.encryption_ready(clear_cwid)  // cid is passed for future reference
              if ( encrypted ) {
                await this.repo_sender.deliver_encrypted(clear_cwid,repo,default_mime,res,range)
              } else {
                await this.repo_sender.deliver_plain(cid,repo,default_mime,res,range)
              }
            } else {
              await this.repo_sender.deliver_plain(cid,repo,default_mime,res,range)
            }
          } catch (e) {
            send(res,200,{ "status" : "ERR" })
          }  
        }
        //
      }
    }
  

    //
    /**
     * repo_key_mime
     * 
     * @param {*} req 
     * @param {*} res 
     */
    async repo_key_mime(req, res) {
      //
      let clear_cwid = req.params.key;
      let mime_type = req.params.mime;
      let repo = this.default_repo
      if ( req.params.repo !== undefined ) {
        repo = req.params.repo
      }
      //
      let range = req.headers.range;
      this.play_count(`repo/${clear_cwid}`)
    
      if ( this.repo_sender !== false ) {
        //
        let cid = this.crypto_M.clear_cwid_to_cid(clear_cwid)  // cid is passed for future reference
        if ( cid == false ) {
          send(res,200,{ "status" : "ERR" })
        } else {
          let default_mime = mime_type
          //
          try {
            let encrypted = this.crypto_M.encryption_ready(clear_cwid)  // cid is passed for future reference
            if ( encrypted ) {
              await this.repo_sender.deliver_encrypted(clear_cwid,repo,default_mime,res,range)
            } else {
              await this.repo_sender.deliver_plain(cid,repo,default_mime,res,range)
            }  
          } catch(e) {
            send(res,200,{ "status" : "ERR" })
          }
        }
        //
      }
    }



    
    // calls upon crypto to unwrap the key that has been provided
    /**
     * ucwid_url_op
     * 
     * @param {*} ucwid_info 
     * @param {*} cid 
     * @param {*} encrypted 
     * @returns boolean
     */
    async ucwid_url_op(ucwid_info,cid,encrypted) {
      try {
        // add the cid to the data map...
        await this.crypto_M.add_crypto_cid(cid,ucwid_info,encrypted)
        return true          
      } catch (e) {
        return false
      }
    }
   

    /**
     * 
     * ucwid_url
     * 
     *    Service for the path `key-media`.
     *    Most likely called by the couting service
     * 
     * @param {object} req - standard html request object
     * @param {objet} res - standard html response object
     * @returns object - includes status and the cwid of the decrypted media (used to make a URL)
     */
    async ucwid_url(req, res) {
      try {
        let ucwid_info = req.body.ucwid;
        let cid = req.body.cid
        let encrypted = req.body.encrypted
        //
        if ( encrypted ) {
          let clear_cwid = await this.ucwid_url_op(ucwid_info,cid)
          if ( clear_cwid ) {
            send(res, 200, { "status": "OK", "api_key" : clear_cwid });  
            return
          }
        } else {
          this.stored_in_the_clear[cid] = cid
          send(res, 200, { "status": "OK", "api_key" : cid }); // in some sense just a handshake
          return
        }
        //
      } catch (e) {
      }
      send(res, 200, { "status": "ERROR", "reason_key" : "parameters result in exception" });
    }
  
}




module.exports = AssetDelivery
