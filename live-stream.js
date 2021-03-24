//
const express     = require('express');
const app         = express();
const fs          = require('fs');


///https://github.com/illuspas/Node-Media-Server
//
// https://quantizd.com/building-live-streaming-app-with-node-js-and-react/


g_streamer_port = process.argv[2]  ?  process.argv[2] :  2011

var g_play_counter = {
  'count' : 0,
  'song' : '',
  'title' : '',
  'date' : Date.now()
}



var g_waiting_for_midnight = false
function pastMidNight() {
  let d = new Date()
  let h = d.getHours()
  if ( h == 23 ) {
    g_waiting_for_midnight = true
  } else {
    if ( ( h == 0 ) && g_waiting_for_midnight ) {
      g_waiting_for_midnight = false
      return true
    }
  }
  return(false)
}



