# copious-streamers



A simple drop-in streaming collection for prototyping. (still is)


This module is basically a reference implementation for streamers that carry on conversations with counters about data stored in repositories, accessible by repository bridges.


## Streamers in the copious.world context

A streamer will stream to a web browser (or similar client). The type of media it streams is configured. The streamer will send clear data over TLS. (*In a future version it may be decrypted in the client, requiring that the streamer decipher and encipher with a one time key derived from the consumer's keys. In future setups, some devices may perform the encryption either within client sandboxed code or in hardware.*)

A streamer will not make direct access with a client. The client first contacts a counting service. The service will then negotiate with streamers in order to get a streaming link to send to the client. Once the client has the streaming link, the client will take in chunks of data and write them (append) to a media element invoked by the client.

The streamer and the counting service negotiate a stream delivery. The counting service publishes a request for a stream to streamers and waits for a response from those with bandwidth. The counting service picks the streamer it prefers to work with (usually first response) and then exchanges keys with the streamer. 

The counting service retains public and private key information necessary to derive the AES key originally used by a creator (creative) to encipher the media to be streamed. The counting service wraps the AES key using the streamer public wrapping key and sends the wrapped key package to the streamer. The counting service also sends the UCWID identifier package to the streamer. The streamer uses the UCWID in order to pull the streamable data from the repository bridge.

The streamer then sends a link to the counting service. The link is a path to the streamer web services to which the stream will write chunks of the stream and the client will let media elements process the chunks.

## Installation

```
npm install -g copious-streamers
```

Check on installation:

```
which copious-streamer
```

The alias should be in your node.js global execution path.

## Running

Besides a configuration file, the working directory should include a file , **`desk_app.config`**.  The `desk_app.config` file includes directories and cipher configurations. 

```
copious-streamer configuration-file.conf
```

## Client Usage

The **copious-streamer** process is an http web server. It has the following paths:

* /stream/:cwid - finds data in the default repo (local) identified by cwid
* /stream/:repo/:cwid - finds data in the repo (type `repo`) identified by cwid and attempts to get files mime type from its file.
* /stream/:repo/:cwid/:mime - finds data in the repo (type `repo`) identified by cwid and should know the file's mime type
* /key-media - gets the cwid of encrypted media given a ucwid.
* /add-key-requester/:counter_address
* /:file - html files only stored in a directory `./app-html/`
* / - returns the media of the day stored in a local file


## Configuring

**Example:**

```
{
    "port" : 4011,
    "app_moniker" : "[Sound Stream]",
    "supported_repo_types" : [ "local" ],
    "media_extension" : [".mp3",".ogg",".txt"],
    "ext_to_type" : {
        ".mp3" : "audio/mpeg",
        ".ogg" : "audio/ogg",
        ".txt" : "text/ascii"
    },
    "repos" : {
        "local" : {
            "base_dir" : "./tests/dat_local"
        },
        "LAN" : {
            "base_dir" : "./dat_LAN_local",
            "local_only" : false,
            "node_relay" : {
                "address" : "76.229.181.242",
                "port" : 7007
            },
            "ssh" : {
                "address" : "76.229.181.242",
                "user" : "richard",
                "pass" : "test4test"
            }
        }
    },
    "counter_service" : "../lib/connected_counter.js",
    "counting_service" : {
        "media_topic" : "stream_media_sound",
        "url_prefix" : "https://localhost:4011/LAN/",
        "public_wrapper_key" : "{\"key_ops\":[\"wrapKey\"],\"ext\":true,\"kty\":\"RSA\",\"n\":\"uSVb2K8R_wUQl4cYKc6gjGshYllXkBkqXeZ-Eglsen_cy6RSTT034pQc4Cchof4m9LOQ7m1fnZVyNqyR-oaDsUCfRQbm9hvFHXStyfBQ_nn07KSua6dcdMdvnPbCvBr4AfjqattokEksHPu33077TDuh_fSvOyFyKV4VpYF-G0sEDGK5FqPdIejW6ssXc6I8V9Cca8yGoMlVexRj1bjEQgESU3100VvK-1NS8FNHIDJX1MYxt3LLBWsO7ZYvpcNGHHmNFGvReRsHsqPMGt77EopoBNYyVaeMu_SWoGj20VskhLhDw8eHdTyVZ2iJRV1BbM5qv7mgcqjFEB--LjxLoAENMVtGYImZ_9VM6DKJnP7tFUh6m5DHuJlKxlNX17KlxHSlMatrU0_NVSpZ5e0nYkNpvdellbPTolBPJobCv50kM_4bUQgowmR4CVfgT_pZP5TBMdrRGVV1dg6fhg5JxKVXjwYWXxwQqPL-w62VYC30-LCwGRaTvZU2pOG_rxvobwY4VcTBD65yU6VeVX93D-KaqABx0YIhvNGWPgM_1lC3cc7GmybLCxyQYlfvyVTVTkCC22MBSLERZ0bgXoBoZRkiUpkIEmsz_h0DO695pNCTHtm4fIaDiPViT8b1A54XHF3XvxY-wTv0m7-PMTElfWd3ZK9ds3XhynQGbGsvd98\",\"e\":\"AQAB\",\"alg\":\"RSA-OAEP-256\"}",
        "service_id" : "e3eaderac3e26erecae2",
        "paths" : []
    },
    "link_manager" : {
        "address" : "localhost",
        "port" : 7796,

        "use_tls" : false,
        "default_tls" : false,
        "extended_tls_options" : false,

        "app_handles_subscriptions" : false,
        "app_can_block_and_respond" : false,

        "link_manager_paths" : false
    },
    "daily_play_json" : "./songs/song_of_day.json",
    "play_dir" : "./songs/",
    "update_interval" : 36000000,
    "safe_host" : "popsongnow.com",
    "safe_redirect" : "http://www.popsongnow.com/",
    "api" : {
        "daily" : "/songoftheday",
        "streamer" : "/play/:key"
    }
}

```
  