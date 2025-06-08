
// ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
// ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
//
//  range_data(range,stat_size,mime_type)
//
const FileType = require('file-type');


class RepoWriter {

    constructor(_repos,_crypto_M) {
        this._repos = _repos
        this._crypto_M = _crypto_M    
    }

    //
    range_data(range,stat_size,mime_type) {
        console.log(range)
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
    
        let hdr = {
            'Content-Type': mime_type,
            "Accept-Ranges": "bytes",
            'Content-Length': content_length,
            'Content-Range': "bytes " + start + "-" + end + "/" + (stat_size ? stat_size : 1)
        }
    
        console.dir({start: start, end: end})
    
        return [hdr,start,content_length]
    }
    
    async deliver_plain_range(cid,repo,stat_size,mime_type,res,range) {
        //
        let [hdr,start,content_length] = this.range_data(range,stat_size,mime_type)
        let section_opt = {
            "offset" : start,
            "length" : content_length
        }
        //
        let detected = false
        if ( mime_type == false ) {
            for await ( const chunk of this._repos.cat(repo,cid) ) {
                //
                if ( !detected ) {
                    mime_type = await FileType.fromBuffer(chunk)
                    if ( mime_type !== undefined ) {
                        //
                        hdr['Content-Type'] = mime_type.mime
                        //
                        break;
                    }
                }
            }  
        } else {
            hdr['Content-Type'] = mime_type
        }
        //
        res.writeHead(206, hdr);
        for await ( const chunk of this._repos.cat(repo,cid,section_opt) ) {
            res.write(chunk)
        }
        //
        res.end()
    }
    
    async deliver_plain_all(cid,repo,stat_size,mime_type,res) {
        //
        let hdr = {
            'Content-Type': mime_type
        }
        if (stat_size) {
            hdr['Content-Length'] = stat_size
        }
        //
        if ( mime_type == false ) {
            let detected = false
            let chunk_wait = []
            for await ( const chunk of this._repos.cat(repo,cid) ) {
                if ( !detected ) {
                    mime_type = await FileType.fromBuffer(chunk)
                    if ( mime_type === undefined ) {
                        chunk_wait.push(chunk)
                    } else {
                        detected = true
                        //
                        hdr['Content-Type'] = mime_type.mime
                        res.writeHead(206, hdr);
                        //
                        for ( let chunk of chunk_wait ) {
                            res.write(chunk)
                        }
                        res.write(chunk)
                        console.log(mime_type)
                    }
                } else {
                        res.write(chunk)
                }
            }
            res.end()
        } else {
            res.writeHead(206, hdr);
            for await ( const chunk of this._repos.cat(repo,cid) ) {
                res.write(chunk)
            }
        }
    }

    async deliver_encrypted_range(clear_cwid,repo,mime_type,res,range) {
        //
        let decrypt_eng = this._crypto_M.get_stream_decryptor(clear_cwid)
        let cid = this._crypto_M.clear_cwid_to_cid(clear_cwid)
        //
        let stat_size = false;
        try {
            for await (const file of this._repos.ls(repo,cid)) {
                stat_size = file.size
            }      
        } catch (e) {
            console.log(e)
        }
        //
        let [hdr,start,content_length] = this.range_data(range,stat_size,mime_type)
        let section_opt = {
            "offset" : start,
            "length" : content_length
        }
        //
        if ( mime_type == false ) {
            //
            for await ( const chunk of this._repos.cat(repo,cid) ) {
                //
                let dec_chunk = decrypt_eng.decrypt_chunk(chunk)
                mime_type = await FileType.fromBuffer(dec_chunk)
                if ( mime_type !== undefined ) {
                    //
                    hdr['Content-Type'] = mime_type.mime
                    //
                    break;
                }
            }
        }
        //
        res.writeHead(206, hdr);
        for await ( const chunk of this._repos.cat(repo,cid,section_opt) ) {
            let dec_chunk = decrypt_eng.decrypt_chunk(chunk)
            res.write(dec_chunk)
        }
        let dec_chunk = decrypt_eng.decrypt_chunk_last()
        if ( dec_chunk ) {
            res.write(dec_chunk)
        }
        //
        res.end()
    }
    
    async deliver_encrypted_all(clear_cwid,repo,mime_type,res) {
        //
        let decrypt_eng = this._crypto_M.get_stream_decryptor(clear_cwid)
        let cid = this._crypto_M.clear_cwid_to_cid(clear_cwid)
        //
        let stat_size = false;
        try {
            for await (const file of this._repos.ls(repo,cid)) {
                stat_size = file.size
            }      
        } catch (e) {
            console.log(e)
        }
        //
        let hdr = {
            'Content-Type': mime_type
        }
        if (stat_size) {
            hdr['Content-Length'] = stat_size
        }
        // // // // // // // // // // // // // // // // // // // // // //
        if ( mime_type == false ) {
            let detected = false
            let chunk_wait = []
            for await ( const chunk of this._repos.cat(repo,cid) ) {
                //
                let dec_chunk = decrypt_eng.decrypt_chunk(chunk)
                if ( !detected ) {
                    mime_type = await FileType.fromBuffer(dec_chunk)
                    if ( mime_type === undefined ) {
                        chunk_wait.push(dec_chunk)
                    } else {
                        detected = true
                        //
                        hdr['Content-Type'] = mime_type.mime
                        res.writeHead(206, hdr);
                        //
                        for ( let chunk of chunk_wait ) {
                            res.write(chunk)
                        }
                        res.write(dec_chunk)
                        console.log(mime_type)
                    }
                } else {
                    res.write(dec_chunk)
                }
            }
        } else {
            res.writeHead(206, hdr);
            for await ( const chunk of this._repos.cat(repo,cid) ) {
                let dec_chunk = decrypt_eng.decrypt_chunk(chunk)
                res.write(dec_chunk)
            }
        }
        //
        let dec_chunk = decrypt_eng.decrypt_chunk_last()
        if ( dec_chunk ) {
            res.write(dec_chunk)
        }
        //
        res.end()
    }

    //
    async deliver_plain(cid,repo,mime_type,res,range) {
        //
        let stat_size = false;
        for await (const file of this._repos.ls(repo,cid)) {
          //console.dir(file)
          stat_size = file.size
        }
        //    
        if ( range !== undefined ) {
            return await this.deliver_plain_range(cid,repo,stat_size,mime_type,res,range)
        } else {
            return await this.deliver_plain_all(cid,repo,stat_size,mime_type,res)
        }
    }
    
    //
    async deliver_encrypted(clear_cwid,repo,default_mime,res,range) {
        if ( range !== undefined ) {
            return await this.deliver_encrypted_range(clear_cwid,repo,default_mime,res,range)
        } else {
            return await this.deliver_encrypted_all(clear_cwid,repo,default_mime,res)
        }
    }

}



module.exports.RepoWriter = RepoWriter