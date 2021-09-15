
const path = require('path')

const fs = require('fs')
const fsPromises = require('fs/promises')

class AssetCounter {

    constructor(previous) {
        this._count = 0
        this.media_name = ''
        this.title = ''
        this.date = Date.now()
        this.check_points = []
        if ( previous !== undefined ) {
            let el = this
            for ( let ky in previous ) {
                el[ky] = previous[ky]
            }
        }
    }

    roll_over() {
        let cc = Object.assign({},this)
        delete cc.check_points
        this.check_points.push(cc)
        this.data = Date.now()
        this._count = 0     // reset the counter
    }

    incr() {
        this._count++
    }
    
    //
}



const CONST_FALLBACK_FILE = "default_player.mp3"
//
  
class PlayCounter {

    constructor(crypto_conf,info_path,update_interval) {
        //
        this._info_path = info_path
        let base = path.basename(info_path)
        let ext = path.extname(info_path)
        base = base.replace(ext,'')
        this._all_info_paths = info_path.replace(base,"all_plays")
        //
        this._daily_play_file = ""
        this.wrapper_key = crypto_conf.crypto ? crypto_conf.crypto.pk_str : false
        //
console.log( this._info_path )
console.log( this._all_info_paths )
        //
        this._player_map = {}
        this._u_interval = (typeof update_interval !== 'string') ? update_interval : parseInt(update_interval)
        //
    }
    //

    init() {
        this.init_play_count()
        setInterval(() => { this.update_play_count() },this._u_interval)
    }

    // reload_media_of_day -- load the media of the day file.
    //                     -- set the _daily_play_file  from field 'file'
    reload_media_of_day() {
        try {
            let play_info = fs.readFileSync(this._info_path)  // just a string path
            play_info = JSON.parse(play_info.toString())
console.dir(play_info)
            this._daily_play_file = play_info.file
            return(play_info)
        } catch (e) {
            console.log(e)
            this._daily_play_file = CONST_FALLBACK_FILE
        }
        return(false)
    }

    //
    init_play_count() {
        //
        let media_descr = this.reload_media_of_day()
        let file = this._all_info_paths
        console.log(`Play counter: ${file}`)
        //
        try {
            let j_obj = fs.readFileSync(file,'ascii')
            let counter_data = JSON.parse(j_obj)
            this._player_map = {}
            for ( let ky in counter_data ) {
                if ( ky.length ) {
                    let m_descr = counter_data[ky]
                    this._player_map[m_descr.media_name] = new AssetCounter(m_descr)
                }
            }
            if ( ( media_descr !== false ) && this._daily_play_file.length ) {
                this._player_map[this._daily_play_file] = new AssetCounter(media_descr)
            }
            return
        } catch (e) {
            console.log(e)
        }
        //
        if ( ( media_descr !== false ) && this._daily_play_file.length ) {
            this._player_map = {}
            this._player_map[this._daily_play_file] = new AssetCounter(media_descr)
            fsPromises.writeFile(file,JSON.stringify(this._player_map))  // create the file
        }
    }

    roll_over_all() {
        for ( let ky in this._player_map ) {
            let m_descr =  this._player_map[ky]
            m_descr.roll_over()
        }
    }

    async write_play_count_data() {
        try {
            let file = this._all_info_paths
            let output = JSON.stringify(this._player_map)
            await fsPromises.writeFile(file,output)
        } catch (e) {
        }
    }

    //
    play_count(asset) {
        if ( asset === undefined ) {
            this.incr(this._daily_play_file)
        } else {
            this.incr(asset)
        }
    }

    async update_play_count() {
        let media_descr = this.reload_media_of_day()
        if ( this._player_map[this._daily_play_file] === undefined ) {
            this._player_map[this._daily_play_file] = new AssetCounter(media_descr)
        }
        await this.write_play_count_data()
        this.roll_over_all()
    }

    // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----

    incr(asset) {
        let counter = this._player_map[asset]
        if ( counter ) {
            counter.incr()
        }
    }

    media_of_the_day() {
        return(this._daily_play_file)
    }
}





module.exports = PlayCounter