// ---- ---- ---- ---- ----

const crypto = require('crypto')
const crypto_wrp = require('crypto-wraps')
const fs = require('fs')

// ---- ---- ---- ---- ----

/**
 * DecryptStream
 * 
 * class
 */
class DecryptStream {

    constructor(cm_props) {
      this.decipher = crypto.createDecipheriv(cm_props._algorithm, cm_props._key, cm_props._iv);  
    }

    /**
     * decrypt_chunk
     * 
     * @param {*} data 
     * @returns buffer
     */
    decrypt_chunk(data) {
      const decrpyted = Buffer.concat([this.decipher.update(data)]);   //, decipher.final()
      return decrpyted
    }

    /**
     * decrypt_chunk_last
     * 
     * @returns buffer | boolean
     */
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
            this._c_props = _crypto_conf.crypto
        } catch (e) {
            console.log("COULD NOT READ CONFIG FILE " + crypto_conf_name)
            process.exit(0)
        }
    }

    // ---- ---- ---- ---- ----
    /**
     * add_crypto_cid
     * 
     * uses the clear cwid as a key into the crypto properties map, _c_props
     * caller wraps try-catch
     * 
     * @param {*} cid 
     * @param {*} ucwid_info 
     * @param {*} encrypted 
     */
    async add_crypto_cid(cid,ucwid_info,encrypted) {
        let clear_cwid = ucwid_info.ucwid_packet.clear_cwid
        let wrapped_key = ucwid_info.wrapped_key
        let key = await crypto_wrp.key_unwrapper(wrapped_key,this._c_props.priv_key)
        let conf = {
            "key" : key,
            "iv" : ucwid_info.nonce,
            "algorithm" : "aes-256-cbc"
        }
        let c_props = {}
        this.check_crypto_config(conf,c_props)      // will throw if items are not set...
        this._c_props[clear_cwid] = c_props
        this._c_props[clear_cwid].encrypted = encrypted
        this._c_props[clear_cwid].decryptor = this.make_stream_decryptor(c_props)           // node.js crypto module
        this._c_props[clear_cwid].cid = cid         // ipfs cid... 
    }


    // ---- ---- ---- ---- ----
    /**
     * crypto_props
     * 
     * @param {*} clear_cwid 
     * @returns 
     */
    crypto_props(clear_cwid) {
        return this._c_props[clear_cwid]
    }

    // ---- ---- ---- ---- ----
    /**
     * clear_cwid_to_cid
     * 
     * @param {*} clear_cwid 
     * @returns string | boolean
     */
    clear_cwid_to_cid(clear_cwid) {
        if ( this._c_props[clear_cwid] !== undefined ) {
            return this._c_props[clear_cwid].cid
        }
        return false
    }

    // ---- ---- ---- ---- ----
    /**
     * make_stream_decryptor
     * 
     * @param {object} c_props 
     * @returns object
     */

    make_stream_decryptor(c_props) {
        return new DecryptStream(c_props)
    }

    // ---- ---- ---- ---- ----
    /**
     * get_stream_decryptor
     * 
     * @param {*} clear_cwid 
     * @returns 
     */
    get_stream_decryptor(clear_cwid) {
        let decryptor = this._c_props[clear_cwid].decryptor
        setImmediate(() => { this._c_props[clear_cwid].decryptor = this.make_stream_decryptor(this._c_props[clear_cwid]) } )
        return decryptor
    }

    // ---- ---- ---- ---- ----
    /**
     * encryption_ready
     * 
     * @param {string} clear_cwid 
     * @returns string | boolean
     */
    encryption_ready(clear_cwid) {
        if ( this._c_props[clear_cwid] !== undefined ) {
            return this._c_props[clear_cwid].encrypted
        }
        return false
    }

    // ---- ---- ---- ---- ----
    /**
     * check_crypto_config
     * 
     * @param {*} conf 
     * @param {*} _c_props 
     */
    check_crypto_config(conf,_c_props) {
        if ( conf ) {
            if ( conf.key && (conf.key !== "nothing") ) {
                _c_props._key = conf.key
            } else {
                throw new Error("configuration does not include crypto components")
            }
            if ( conf.algorithm  && (conf.algorithm !== "nothing")  ) {
                _c_props._algorithm = conf.algorithm
            } else {
                throw new Error("configuration does not include crypto components")
            }
            if ( conf.iv && (conf.iv !== "nothing") ) {
                _c_props._iv = Buffer.from(conf.iv, 'base64url');
            }
        } else {
            throw new Error("configuration does not include crypto")
        }
    }

}



module.exports.CryptoManager = CryptoManager
module.exports.DecryptStream = DecryptStream