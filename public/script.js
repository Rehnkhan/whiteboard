let canvas = document.getElementById("canvas");
let test = document.getElementById("test");

canvas.width = 0.98 * window.innerWidth;
canvas.height = window.innerHeight;

var io = io.connect("localhost:8080/");

let ctx = canvas.getContext("2d");
let selectedElement = null;
let offsetX, offsetY;

canvas.addEventListener("mousedown", (e) => {
  let mouseX = e.clientX;
  let mouseY = e.clientY;
  selectedElement = getElementAtPosition(mouseX, mouseY);
  if (selectedElement) {
    offsetX = mouseX - selectedElement.x;
    offsetY = mouseY - selectedElement.y;
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mouseup", onMouseUp);
  }
});

function onMouseMove(e) {
  if (selectedElement) {
    selectedElement.x = e.clientX - offsetX;
    selectedElement.y = e.clientY - offsetY;
    redrawCanvas();
  }
}

function onMouseUp() {
  canvas.removeEventListener("mousemove", onMouseMove);
  canvas.removeEventListener("mouseup", onMouseUp);
  selectedElement = null;
}


function getElementAtPosition(x, y) {
  // Example logic to find and return the element at the given position
  // This could be a shape or text element
  // Assuming elements is an array of objects with x, y, width, and height properties
  for (let element of elements) {
    if (
      x >= element.x &&
      x <= element.x + element.width &&
      y >= element.y &&
      y <= element.y + element.height
    ) {
      return element;
    }
  }
  return null;
}

function redrawCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // Redraw all elements on the canvas
  for (let element of elements) {
    if (element.type === "rectangle") {
      ctx.strokeRect(element.x, element.y, element.width, element.height);
    } else if (element.type === "circle") {
      ctx.beginPath();
      ctx.arc(element.x, element.y, element.radius, 0, 2 * Math.PI);
      ctx.stroke();
    } else if (element.type === "text") {
      ctx.fillText(element.text, element.x, element.y);
    }
  }
}
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
    if (data.shape) {
      drawShape(data.shape);
    }
    if (data.text) {
      drawText(data.text);
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

// //
// eraserButton.addEventListener("click", () => {
//   saveState();
//   ctx.globalCompositeOperation = "destination-out";
//   ctx.lineWidth = 10; // Adjust eraser size as needed
//   canvas.addEventListener("mousemove", onErase);
//   canvas.addEventListener("mouseup", stopErase);
// });

// function onErase(e) {
//   if (mouseDown) {
//     ctx.lineTo(e.clientX, e.clientY);
//     ctx.stroke();
//     dataChannel.send(JSON.stringify({ erase: { x: e.clientX, y: e.clientY } }));
//   }
// }

// function stopErase() {
//   canvas.removeEventListener("mousemove", onErase);
//   canvas.removeEventListener("mouseup", stopErase);
//   ctx.globalCompositeOperation = "source-over";
// }

// dataChannel.onmessage = (e) => {
//   let data = JSON.parse(e.data);

//   if (data.draw) {
//     ctx.lineTo(data.draw.x, data.draw.y);
//     ctx.stroke();
//   }
//   if (data.down) {
//     ctx.moveTo(data.down.x, data.down.y);
//   }
//   if (data.shape) {
//     drawShape(data.shape);
//   }
//   if (data.text) {
//     drawText(data.text);
//   }
//   if (data.erase) {
//     ctx.globalCompositeOperation = "destination-out";
//     ctx.lineTo(data.erase.x, data.erase.y);
//     ctx.stroke();
//     ctx.globalCompositeOperation = "source-over";
//   }
// };
//

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
let shapeButton = document.getElementById("shape");
let textButton = document.getElementById("text");
let saveButton = document.getElementById("save");
let loadButton = document.getElementById("load");

let currentShape = null;
let drawingText = false;

shapeButton.addEventListener("click", () => {
  currentShape = prompt("Enter shape (rectangle, circle):");
});

textButton.addEventListener("click", () => {
  drawingText = true;
});

canvas.addEventListener("click", (e) => {
  if (drawingText) {
    let text = prompt("Enter text:");
    if (text) {
      drawText({ text, x: e.clientX, y: e.clientY });
      dataChannel.send(JSON.stringify({ text: { text, x: e.clientX, y: e.clientY } }));
      saveState();
    }
    drawingText = false;
  } else if (currentShape) {
    let startX = e.clientX;
    let startY = e.clientY;
    canvas.addEventListener("mouseup", (e) => {
      let endX = e.clientX;
      let endY = e.clientY;
      let shapeData = { shape: currentShape, startX, startY, endX, endY };
      drawShape(shapeData);
      dataChannel.send(JSON.stringify({ shape: shapeData }));
      saveState();
      currentShape = null;
    }, { once: true });
  }
});

function drawShape(data) {
  let { shape, startX, startY, endX, endY } = data;
  if (shape === "rectangle") {
    ctx.strokeRect(startX, startY, endX - startX, endY - startY);
  } else if (shape === "circle") {
    let radius = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
    ctx.beginPath();
    ctx.arc(startX, startY, radius, 0, 2 * Math.PI);
    ctx.stroke();
  }
}

function drawText(data) {
  let { text, x, y } = data;
  ctx.fillText(text, x, y);
}

// saveButton.addEventListener("click", () => {
//   let dataURL = canvas.toDataURL();
//   localStorage.setItem("whiteboard", dataURL);
// });

// saveButton.addEventListener("click", () => {
//   html2canvas(document.body).then((canvas) => {
//     let dataURL = canvas.toDataURL();
//     let link = document.createElement("a");
//     link.href = dataURL;
//     link.download = "snapshot.png";
//     link.click();
//   });
// });

saveButton.addEventListener("click", () => {
  let tempCanvas = document.createElement("canvas");
  tempCanvas.width = canvas.width;
  tempCanvas.height = canvas.height;
  let tempCtx = tempCanvas.getContext("2d");

  // Fill the background with white color
  tempCtx.fillStyle = "#FFFFFF";
  tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

  // Draw the current canvas content onto the temporary canvas
  tempCtx.drawImage(canvas, 0, 0);

  // Save the temporary canvas content
  let dataURL = tempCanvas.toDataURL();
  let link = document.createElement("a");
  link.href = dataURL;
  link.download = "snapshot.png";
  link.click();
});

loadButton.addEventListener("click", () => {
  let dataURL = localStorage.getItem("whiteboard");
  if (dataURL) {
    let img = new Image();
    img.src = dataURL;
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };
  }
});