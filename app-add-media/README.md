# app-add-media

> This app is based on js-ifs in Elextron, which in turn is heavily inspired by [electron-quick-start](https://github.com/electron/electron-quick-start).


## About

> This app extends previous examples from the Internet by providing an interface (Svelte fairly soon) that allows for media files to be uploaded to the Electron main.js. The Electron main.js has been programmed to read the file, encrypt it based on config file parameters, and then to put the resulting Blob into IPFS. A JSON file is emitted that provides file information, e.g. the IPFS **cid** as well as a filed name, mime type, etc. The media streaming servers can use the **cid** to retieve the file, decrypt and then write to the HTML stream for play.

## Before you start

First clone this repo, install dependencies in the project root and build the project.

```console
$ git clone https://github.com/ipfs/js-ipfs.git
$ cd js-ipfs
$ npm install
$ npm run build
```

## Running the example

To try it by yourself, do:

```
> npm start
```
