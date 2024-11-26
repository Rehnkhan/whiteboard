let canvas = document.getElementById("canvas");
let test = document.getElementById("test");

canvas.width = 0.98 * window.innerWidth;
canvas.height = window.innerHeight;

var io = io.connect("localhost:8080/");

let ctx = canvas.getContext("2d");

let x;
let y;
let mouseDown = false;
let dataChannel;
const servers = {
  iceServers: [
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
    },
  ],
  iceCandidatePoolSize: 10,
};
let pc = new RTCPeerConnection(servers);

console.log("created data channels");
let remoteStream;

function applyEvents() {
  dataChannel.onmessage = (e) => {
    let data = JSON.parse(e.data);

    if (data.draw) {
      ctx.lineTo(data.draw.x, data.draw.y);
      ctx.stroke();
    }
    if (data.down) {
      ctx.moveTo(data.down.x, data.down.y);
    }
  };
}

window.onload = async () => {
  pc.addEventListener("connectionstatechange", () => {
    if (pc.connectionState === "connected") {
      //console.log("connected");
    }
  });

  pc.ondatachannel = (e) => {
    console.log("re data channels");
    dataChannel = e.channel;
    applyEvents();
  };

  dataChannel = pc.createDataChannel("test");

  let stream = await navigator.mediaDevices.getUserMedia({ video: true });

  stream.getTracks().forEach((track) => {
    pc.addTrack(track, stream);
  });

  remoteStream = new MediaStream();

  pc.ontrack = (event) => {
    event.streams[0].getTracks().forEach((track) => {
      remoteStream.addTrack(track);
    });
  };

  test.srcObject = remoteStream;

  //sending the ice candidates
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      //console.log("send ice");
      io.emit("propogate", { ice: event.candidate });
    }
  };

  //sending the offer
  let offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  //console.log("send offer");
  io.emit("propogate", {
    offer: { type: offer.type, sdp: offer.sdp },
  });
};

io.on("onpropogate", async (data) => {
  //console.log("happen");
  if (data.offer) {
    //console.log("offer");
    await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
    let answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    io.emit("propogate", { answer });
  }
  if (data.answer) {
    //console.log("answer");
    await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
  }
  if (data.ice) {
    //console.log("ice");
    await pc.addIceCandidate(data.ice);
  }
});

window.onmousedown = () => {
  ctx.moveTo(x, y);
  if (dataChannel !== undefined) {
    dataChannel.send(JSON.stringify({ down: { x, y } }));
  } else {
    //console.log("not defined");
  }
  mouseDown = true;
};

window.onmouseup = () => {
  mouseDown = false;
};

window.onmousemove = (e) => {
  x = e.clientX;
  y = e.clientY;

  if (mouseDown) {
    dataChannel.send(JSON.stringify({ draw: { x, y } }));
    ctx.lineTo(x, y);
    ctx.stroke();
  }
};
let penButton = document.getElementById("pen");
let eraserButton = document.getElementById("eraser");
let colorPicker = document.getElementById("colorPicker");

penButton.addEventListener("click", () => {
  ctx.globalCompositeOperation = "source-over";
});

eraserButton.addEventListener("click", () => {
  saveState();
  ctx.globalCompositeOperation = "destination-out";
  ctx.lineWidth = 10; // Adjust eraser size as needed
});

colorPicker.addEventListener("input", (e) => {
  ctx.strokeStyle = e.target.value;
  ctx.globalCompositeOperation = "source-over";
});
let undoButton = document.getElementById("undo");
let redoButton = document.getElementById("redo");

let undoStack = [];
let redoStack = [];

function saveState() {
  undoStack.push(canvas.toDataURL());
  redoStack = []; // Clear redo stack on new action
}

function restoreState(stack, pop) {
  if (stack.length) {
    let state = stack.pop();
    let img = new Image();
    img.src = state;
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };
    if (pop) redoStack.push(state);
  }
}

undoButton.addEventListener("click", () => {
  restoreState(undoStack, true);
});

redoButton.addEventListener("click", () => {
  restoreState(redoStack, false);
});

canvas.addEventListener("mousedown", saveState);