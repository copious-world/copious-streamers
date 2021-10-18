
const {MultiPathRelayClient} = require('message-relay-services')

const PlayCounter = require('../play_counter.js')



function rtrim_char(char,str) {
    if ( str === undefined ) return (str)
    if ( typeof str !== 'string' ) return(str)
    if ( str[str.length-1] === char ) return(str.substr(0,(str.length-1)))
    return str
}

//
class ConnectedCounter extends PlayCounter {

    constructor(net_conf,crypto_conf,info_path,update_interval) {
        super(crypto_conf,info_path,update_interval)
        this.relayer = new MultiPathRelayClient(net_conf)
        this._asset_delivery = false
        this.media_topic = net_conf.media_topic
        this.pending = {}
        this.url_prefix = rtrim_char('/',net_conf.url_prefix)
        this.service_id = net_conf.service_id
        this.public_wrapper_key = net_conf.public_wrapper_key
        this.asset_to_counting_service = {}
        this.asset_to_counting_tracking = {}
    }

    // ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
    set_asset_delivery(asset_delivery) {
        this._asset_delivery = asset_delivery
    }


    // ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
    async add_relay_path(persistence_link) {
        //
        let [address,port] = persistence_link.split(':')
        let conf = {
            "path" : persistence_link,
            "port" : port,
            "address" : address
        }
        //
        let path = conf.path
        //
        this.relayer.add_relay_path(conf,conf)
        await this.relayer.await_ready(path)
        //
        let link_request_handler = async (msg) => {         // link_request_handler
            //
            let tracking = msg._tracking /// this is the cwid trans repository (intergalactic) tracking...
            let asset = `ipfs/${tracking}`   // actually the clear cwid
            // start tracking a particular asset with universal ID
            if ( this.pending[tracking] === undefined ) {
                this.pending[tracking] = {}
            }
            // associate the client requesting the tracking... (some counting service)
            if ( (this.pending[tracking][msg.client_name] !== undefined) && this.pending[tracking][msg.client_name] ) {
                return      // be careful to timeout on pending services...
            }
            //
            this.pending[tracking][msg.client_name] = msg
            let status = await this.send_link(msg,path)
            if ( status ) {
                this.asset_to_counting_service[asset] = path
                this.asset_to_counting_tracking[asset] = tracking
            } else {
                delete this.pending[tracking][msg.client_name]
            }
        }
        //
        await this.relayer.subscribe(this.media_topic,path,{},link_request_handler)
        //
        let receipt_handler = (msg) => {
            let tracking = msg._tracking
            if ( this.pending[tracking] ) {
                let req = this.pending[tracking][msg.client_name]
                if ( req !== undefined ) {
                    delete this.pending[tracking][msg.client_name]
                    if ( req ) req.resolver()    
                }
            }
        }
        //
        await this.relayer.subscribe(`${this.media_topic}-received`,path,{},receipt_handler) 
    }


    // ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
    async send_link(mobj,path) {
        let ucwid_info = mobj.ucwid_info;
        if ( ucwid_info === undefined ) return false
        let cid = mobj[mobj.protocol]                   // this is where the cid (for repository type) is... this is not tracking
        if ( cid === undefined ) return false
        let mtopic = this.media_topic
        //
        let clear_cwid = ucwid_info.ucwid_packet.clear_cwid
        if ( clear_cwid === undefined ) return false
        //
        let link = `${this.url_prefix}/${clear_cwid}`
        mobj.resolver = () => {}
        let res_obj = {
            "_id" : this.service_id,
            "streamer_link" : link,
            "component" : mtopic,
            "_tracking" : mobj._tracking,
            "wrapper_key" :  encodeURIComponent(this.public_wrapper_key) 
        }
        // key swap in counting service
        let response = await this.relayer.set_on_path(res_obj,path)
        if ( response.status === 'NONE' ) {
            return false
        } else {
             // the key has been unwrapped by the counting service and wrapped with this streamer's public key
            ucwid_info.wrapped_key = response.rewrapped_key     // ....   rewrapped_key
            let status = await this._asset_delivery.ucwid_url_op(ucwid_info,cid)
            return status
        }
    }

    // ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
    async incr(asset) {
        super.incr(asset)
        if ( asset !== undefined ) {
            let path = this.asset_to_counting_service[asset]
            let tracking = this.asset_to_counting_tracking[asset]
            let msg = {
                "_id" : this.service_id,
                "link" : asset,
                "_tracking" : tracking
            }
            await this.relayer.send_op_on_path(msg,path,"+")    
        }
    }

}



module.exports = ConnectedCounter