
const {MultiPathRelayClient} = require('message-relay-services')

const PlayCounter = require('../play_counter.js')

//
class ConnectedCounter extends PlayCounter {

    constructor(net_conf,crypto_conf,info_path,update_interval) {
        super(crypto_conf,info_path,update_interval)
        this.relayer = new MultiPathRelayClient(net_conf)
        this._asset_delivery = false
        this.media_topic = net_conf.media_topic
        this.pending = {}
        this.url_prefix = net_conf.url_prefix
        this.service_id = net_conf.service_id
        this.wrapper_key = net_conf.public_wrapper_key
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
            let tracking = msg._tracking
            // start tracking a particular asset with universal ID
            if ( this.pending[tracking] === undefined ) {
                this.pending[tracking] = {}
            }
            // associate the client requesting the tracking... (some counting service)
            if ( (this.pending[tracking][msg.client_name] !== undefined) && this.pending[tracking][msg.client_name] ) {
                return
            }
            //
            this.pending[tracking][msg.client_name] = msg
            let status = await this.send_link(msg,path)
            if ( status ) {
                this.pending[tracking][msg.client_name].providing = true
                this.asset_to_counting_service[link] = path
                this.asset_to_counting_tracking[asset] = tracking
            } else {
                delete this.pending[tracking][msg.client_name]
            }
        }
        await this.relayer.subscribe(this.media_topic,path,{},link_request_handler)
        //
        let receipt_handler = (msg) => {
            let tracking = msg._tracking
            let req = this.pending[tracking][msg.client_name]
            delete this.pending[tracking][msg.client_name]
            req.resolver()
        }
        await this.relayer.subscribe(`${this.media_topic}-received`,path,{},receipt_handler) 
    }


    // ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
    async send_link(mobj,path) {
        let ucwid_info = mobj.ucwid_info;
        if ( ucwid_info === undefined ) return false
        let cid = mobj.cid
        if ( cid === undefined ) return false
        let mtopic = this.media_topic
        //
        let clear_cwid = ucwid_info.clear_cwid
        if ( clear_cwid === undefined ) return false
        //
        let link = `${this.url_prefix}/${clear_cwid}`
        mobj.resolver = () => {}
        let res_obj = {
            "_id" : this.service_id,
            "streamer_link" : link,
            "component" : mtopic,
            "_tracking" : mobj._tracking,
            "wrapper_key" : this.wrapper_key
        }
        let response = await this.relayer.set_on_path(res_obj,path)
        if ( response.status === 'NONE' ) {
            return false
        } else {
             // the key has been unwrapped by the counting service and wrapped with this streamer's public key
            ucwid_info.wrapped_key = response.rewrapped_key     // ....
            let status = await this._asset_delivery.ucwid_url_op(ucwid_info,cid)
            return status
        }
    }

    // ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
    async play_count(asset) {
        super.play_count(asset)
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



module.exports = ConnectedCounter