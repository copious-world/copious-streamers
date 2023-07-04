const wrtc = require('wrtc');
const io = require('socket.io')(server);

io.on('connection', function(socket) {
  const pc = new wrtc.RTCPeerConnection();

  socket.on('offer', function(offer) {
    pc.setRemoteDescription(new wrtc.RTCSessionDescription(offer));
    pc.createAnswer(function(answer) {
      pc.setLocalDescription(new wrtc.RTCSessionDescription(answer));
      socket.emit('answer', answer);
    });
  });

  pc.onaddstream = function(event) {
    socket.emit('stream', event.stream);
  };

  navigator.mediaDevices.getUserMedia({audio: true}).then(function(stream) {
    pc.addStream(stream);

    const offer = pc.createOffer(function(offer) {
      pc.setLocalDescription(new wrtc.RTCSessionDescription(offer));
      socket.emit('offer', offer);
    });
  });
});
