const send        = require('@polka/send-type');
const path        = require('path')

class AssetDelivery {
    //
    constructor(conf,no_range) {
      this.use_range = !no_range
      //
      this.media_extension = conf.med_ext
      this.ext_to_type = conf.ext
      this.asset_directory = conf.dir
      this.ipfs_sender = conf.ipfs_sender
      this.crypto_M = conf.crypto_M
      //
      this.play_count = conf.play_count
      this.media_of_the_day = conf.media_of_the_day
      this.safe_host = conf.safe_host
      this.safe_redirect = conf.safe_redirect
    }
  
    // --- --- --- --- --- --- ---
    asset_of_the_day(req, res) {
      //
      if ( (req.headers.host === 'localhost') || ( req.headers.host.indexOf(this.safe_host) >= 0 ) ) {
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
      }
      //
      res.writeHead(301, {Location: this.safe_redirect} );
      res.end();
      return(false)
      //
    }
  
    // --- --- --- --- --- --- ---
    asset_streamer(req, res) {
      let key = req.params.key;
    
      let asset = this.asset_directory + key
    
      let ext = '.' + path.extname(key)
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
    
        res.status(206).header({
            'Content-Type': mtype,
            "Accept-Ranges": "bytes",
            'Content-Length': content_length,
            'Content-Range': "bytes " + start + "-" + end + "/" + stat.size
        });
        //
        readStream = fs.createReadStream(asset, {start: start, end: end});
      } else {
        res.header({
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
    async ipfs_key(req, res) {
      //
      let clear_cwid = req.params.key;
      //
      let range = req.headers.range;
      this.play_count("ipfs:/" + clear_cwid)
      //
      if ( this.ipfs_sender !== false ) {
        //
        let default_mime = false
        let cid = this.crypto_M.encryption_ready(clear_cwid)  // cid is passed for future reference
        if ( cid == false ) {   // means it was not encrypted and this caller has requested unencrypted stream out of repo...
          cid = clear_cwid
          clear_cwid = false
        }
        //
        if ( clear_cwid !== false ) {
          await this.ipfs_sender.ifps_deliver_encrypted(clear_cwid,default_mime,res,range)
        } else {
          await this.ipfs_sender.ifps_deliver_plain(cid,default_mime,res,range)
        }
      }
    }
  

    //
    async ipfs_key_mime(req, res) {
      //
      let clear_cwid = req.params.key;
      let mime_type = req.params.mime;
      //
      let range = req.headers.range;
      this.play_count(`ipfs/${clear_cwid}`)
    
      if ( this.ipfs_sender !== false ) {
        //
        let cid = this.crypto_M.encryption_ready(clear_cwid)  // cid is passed for future reference
        if ( cid == false ) {
          cid = clear_cwid
          clear_cwid = false
        }
        //
        let default_mime = mime_type
        //
        if ( clear_cwid !== false ) {
          await this.ipfs_sender.ifps_deliver_encrypted(clear_cwid,default_mime,res,range)
        } else {
          await this.ipfs_sender.ifps_deliver_plain(cid,default_mime,res,range)
        }
      }
    }



    
    // calls upon crypto to unwrap the key that has been provided
    async ucwid_url_op(ucwid_info,cid) {
      try {
        let clear_cwid = ucwid_info.ucwid_packet.clear_cwid
        //
        // add the cid to the data map...
        await this.crypto_M.add_crypto_cid(cid,ucwid_info)
        return clear_cwid          
      } catch (e) {
        return false
      }
    }
   

    async ucwid_url(req, res) {
      try {
        let ucwid_info = req.body.ucwid;
        let cid = req.body.cid
        //
        let clear_cwid = await this.ucwid_url_op(ucwid_info,cid)
        if ( clear_cwid ) {
          send(res, 200, { "status": "OK", "api_key" : clear_cwid });  
        }
        //
      } catch (e) {
      }
      send(res, 200, { "status": "ERROR", "reason_key" : "parameters result in exception" });
    }
  
}




module.exports = AssetDelivery
