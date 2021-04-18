// ---- ---- ---- ---- ----

const crypto = require('crypto')
const fs = require('fs')

// ---- ---- ---- ---- ----

class DecryptStream {
    constructor(cm_props) {
      this.decipher = crypto.createDecipheriv(cm_props._algorithm, cm_props._key, cm_props._iv);  
    }
  
    decrypt_chunk(data) {
      const decrpyted = Buffer.concat([this.decipher.update(data)]);   //, decipher.final()
      return decrpyted
    }
  
    decrypt_chunk_last() {
        try {
            const decrpyted = Buffer.concat([this.decipher.final()]); 
            return decrpyted      
        } catch (e) {
            return false
        }
    }
}



// ---- ---- ---- ---- ----  

class CryptoManager {

    // ---- ---- ---- ---- ----
    constructor(crypto_conf_name) {
        this.conf_file_name = crypto_conf_name
        let conf = fs.readFileSync(crypto_conf_name).toString()
        try {
            let _crypto_conf = JSON.parse(conf)
            this._c_props = {}
            //
            this.check_crypto_config(_crypto_conf)
        } catch (e) {
            console.log("COULD NOT READ CONFIG FILE " + crypto_conf_name)
            process.exit(0)
        }
    }

    // ---- ---- ---- ---- ----
    crypto_props() {
        return this._c_props
    }

    // ---- ---- ---- ---- ----
    get_stream_decryptor() {
        return new DecryptStream(this._c_props)
    }
    
    encryption_ready(cid)  {
        return (this._c_props !== undefined) && (this._c_props._algorithm !== undefined)
    }

    // ---- ---- ---- ---- ----
    check_crypto_config(conf) {
        if ( conf.crypto ) {
            if ( conf.crypto.key && (conf.crypto.key !== "nothing") ) {
                this._c_props._key = conf.crypto.key
            } else {
                throw new Error("configuration does not include crypto components")
            }
            if ( conf.crypto.algorithm  && (conf.crypto.algorithm !== "nothing")  ) {
                this._c_props._algorithm = conf.crypto.algorithm
            } else {
                throw new Error("configuration does not include crypto components")
            }
            if ( conf.crypto.iv && (conf.crypto.iv !== "nothing") ) {
                this._c_props._iv = Buffer.from(conf.crypto.iv, 'base64');
            } else {
                this._c_props._iv = crypto.randomBytes(16);
                conf.crypto.iv = this._c_props._iv.toString('base64')
                fs.writeFileSync(this.conf_file_name,JSON.stringify(conf,null,2))
            }
        } else {
            throw new Error("configuration does not include crypto")
        }
    }

}



module.exports.CryptoManager = CryptoManager
module.exports.DecryptStream = DecryptStream