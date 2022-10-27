"use strict";
const bilde = document.getElementById("bilde");
const canvas = document.getElementById("tegning");
const ctx = canvas.getContext("2d");
const meta = document.getElementById("meta");
const metaCtx = meta.getContext("2d");
const vertical = document.getElementById("vertical_lines");
const verticalContext = vertical.getContext("2d");
const rateInput = document.getElementById("rate");

let values = [];
const mean = 0;
let playing = false;
let height = 0;
let width = 0;

let buffer;
const channels = [Array(256).fill(0), Array(256).fill(0), Array(256).fill(0), Array(256).fill(0)];
const numberOfChannels = channels.length;
let pointerPressed = false;
let continousMode = true;
const previousPointerPosition = {x: 0, y: 0};

const audioCtx = new AudioContext();
const playButton = document.createElement("button");
playButton.textContent = "play";
document.body.appendChild(playButton);


class MutableBufferSourceNode {
  constructor (audioContext) {
    this.audioContext = audioContext;
    this._buffer = null;
    this.destinations = [];
    this._loop = false;
    this._detune = 0;
    this._playbackRate = 1;
    this.node = audioContext.createBufferSource();
    this.nextNode = null;
    this.bufferEndedHandler = this.bufferEnded.bind(this);
  }

  start (timestamp) {
    if (this.playing) {
      console.error("already playing!!!");
    }
    this.node.start(timestamp);
    this.playing = true;
  }

  stop (timestamp) {
    this.node.stop(timestamp);
    this.playing = false;
    if (this.nextNode !== null) {
      this.switchNodes();
    } else {
      this.node.disconnect();
      this.node = null;
      this.node = this.audioContext.createBufferSource();
      this.node.loop = this._loop;
      this.node.playbackRate.value = this._playbackRate;
      this.node.detune.value = this._detune;
      this.node.buffer = this._buffer;
      this.reconnect(this.node);
    }
  }

  set loop (loop) {
    this._loop = !!loop;
    this.node.loop = this._loop;
  }
  get loop () {
    return this._loop;
  }

  set playbackRate (rate) {
    if (!isNaN(rate)) {
      this._playbackRate = rate;
      this.node.playbackRate.value = this._playbackRate;
    }
  }

  switchNodes () {
    if (this.nextNode !== null) {
      this.nextNode.detune.value = this.node.detune.value;
      this.nextNode.playbackRate.value = this.node.playbackRate.value;
      this.nextNode.loop = true;

      if (this.playing) {
        this.nextNode.start();
        this.node.disconnect();
      }

      this.node = this.nextNode;
      this.nextNode = null;
    }
  }

  bufferEnded (event) {
    this.switchNodes();
  }

  set buffer (buffer) {
    if (this._buffer === null) {
      this.node.buffer = buffer;
    } else {
      this.nextNode = this.audioContext.createBufferSource();
      this.nextNode.buffer = buffer;
      this.nextNode.loop = this._loop;
      this.nextNode.playbackRate.value = this.node.playbackRate.value;
      this.nextNode.detune.value = this.node.detune.value;
      this.reconnect(this.nextNode);
      if (this.playing) {
        this.node.addEventListener("ended", this.bufferEndedHandler);
        this.node.loop = false;
      } else {
        this.switchNodes();
      }
    }
    this._buffer = buffer;
  }

  get buffer () {
    return this._buffer;
  }
 
  connect (destination) {
    this.destinations.push(destination);
    this.node.connect(destination);
  }

  disconnect (destination = null) {
    if (destination == null) {
      this.destinations.forEach(d => this.node.disconnect(d));
      this.destinations = [];
    } else {
      this.node.disconnect(destination);
      for (let destinationIndex = this.destinations.indexOf(destination); destinationIndex !== -1; destinationIndex = this.destinations.indexOf(destination)) {
        this.destinations.splice(destinationIndex, 1);
      }
    }
  }

  reconnect (node) {
    this.destinations.forEach(d => node.connect(d));
    return node;
  }

}

const updateVerticalLines = () => {
    verticalContext.clearRect(0, 0, width, height);
    verticalContext.strokeStyle = foreground;
    verticalContext.lineWidth = 2;

    values.forEach((value, i) => {
      ctx.fillRect(i, value, 1, lineHeight);
      if (i > 0 && Math.abs(value - values[i-1]) >= lineHeight) {
        verticalContext.beginPath();
        verticalContext.moveTo(i - 1, values[i-1]);
        verticalContext.lineTo(i, value);
        verticalContext.stroke();
      }
    });
};

const updateCanvas = () => {
  if (values.length !== canvas.width) {
    width = vertical.width = meta.width = canvas.width = values.length;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = foreground;

    values.forEach((value, i) => {
      ctx.fillRect(i, value, 1, lineHeight);
    });

  }
};


const bufferSourceNode = new MutableBufferSourceNode(audioCtx);
bufferSourceNode.loop = true;
bufferSourceNode.connect(audioCtx.destination);


const background = "black";
const foreground = "white";
const lineHeight = 3;

const updateMeta = (newMin, newMax, newMean) => {
  const integerMean = Math.floor(newMean);
  const integerMin = Math.floor(newMin);
  const integerMax = Math.floor(newMax);

  metaCtx.clearRect(0, 0, metaCtx.canvas.width, metaCtx.canvas.height);
  metaCtx.strokeStyle = "rgba(255, 255, 0, 0.5)";

  metaCtx.beginPath();
  metaCtx.moveTo(0, integerMin);
  metaCtx.lineTo(metaCtx.canvas.width, integerMin);
  metaCtx.stroke();


  metaCtx.beginPath();
  metaCtx.moveTo(0, integerMean);
  metaCtx.lineTo(metaCtx.canvas.width, integerMean);
  metaCtx.stroke();


  metaCtx.beginPath();
  metaCtx.moveTo(0, integerMax);
  metaCtx.lineTo(metaCtx.canvas.width, integerMax);
  metaCtx.stroke();
};

const drawInterpolatedLine = event => {
  const {
    offsetX: x,
    offsetY: y
  } = event;

  const {
    x: prevX,
    y: prevY
  } = previousPointerPosition;

  if (prevX !== x) {
    let xDiff = prevX - x;
    let yDiff = prevY - y;
    ctx.fillStyle = background;
    ctx.fillRect(x, 0, xDiff, ctx.canvas.height);
    ctx.fillStyle = foreground;

    values[x] = y;

    for (let i = xDiff; i !== 0; i -= Math.sign(xDiff)) {
      const value = y + i/xDiff * yDiff;
      ctx.fillRect(x + i, value, 1, lineHeight);
      values[x + i] = value;
    }

    updateFromValues(values);
    updateVerticalLines();
  } else {
    drawPoint(event);
  }

  previousPointerPosition.x = x;
  previousPointerPosition.y = y;
};

const drawPoint = (event) => {
  const {
    offsetX: x,
    offsetY: y
  } = event;

  ctx.fillStyle = background;
  ctx.fillRect(x, 0, 1, ctx.canvas.height);
  ctx.fillStyle = foreground;
  ctx.fillRect(x, y, 1, lineHeight);

  values[x] = y;

  updateFromValues(values);
  updateVerticalLines();

  previousPointerPosition.x = x;
  previousPointerPosition.y = y;
};

const pointerMoveHandler = (event) => {
  if (pointerPressed) {
    if (continousMode) {
      drawInterpolatedLine(event);
    } else {
      drawPoint(event);
    }
  }
};

const updateFromValues = (values) => {
  const {min, max, mean} = getMeta(values);
  updateMeta(min, max, mean);
  bufferSourceNode.buffer = arrayToBuffer(values, 0, height);
};

const pointerUpHandler = (event) => {
  pointerPressed = false;
  canvas.removeEventListener("pointermove", pointerMoveHandler);

  values = canvasToArray(ctx);

  updateFromValues(values);
};

const pointerDownHandler = (event) => {
  pointerPressed = true;
  drawPoint(event);
  canvas.addEventListener("pointermove", pointerMoveHandler);
};


const changeRate = (event) => {
  bufferSourceNode.playbackRate = parseFloat(event.target.value);
};
rateInput.addEventListener("input", changeRate);

const play = () => {
  bufferSourceNode.playbackRate = parseFloat(rateInput.value);
  bufferSourceNode.start();
  playButton.textContent = "stop";
  playButton.removeEventListener("click", play);
  playButton.addEventListener("click", stop);
};

const stop = () => {
  bufferSourceNode.stop();
  playButton.textContent = "play";
  playButton.removeEventListener("click", stop);
  playButton.addEventListener("click", play);
};


playButton.addEventListener("click", play);


const rangeToRangeMapper = ([inMin, inMax], [outMin, outMax]) => {
  const inDiff = inMax - inMin;
  const outDiff = outMax - outMin;

  return (value) => value < inMin ? outMax : value > inMax ? outMax : outMin + ((value - inMin) / inDiff) * outDiff;
};

const minMaxSumReducer = ({min, max, sum}, value) => ({min: Math.min(min, value), max: Math.max(max, value), sum: sum + value});
const getMinMaxSum = (array) => array.reduce(minMaxSumReducer, {min: Number.MAX_SAFE_INTEGER, max: Number.MIN_SAFE_INTEGER, sum: 0});


const canvasToArray = (canvas2DContext) => {
  const {width, height} = canvas2DContext.canvas;
  const values = [];
  const data = canvas2DContext.getImageData(0, 0, canvas2DContext.canvas.width, canvas2DContext.canvas.height).data;
  for (let i = 0; i < width; i+= 1) {
    for (let j = 0; j < height; j += 1) {
        const pixelStart = (j * width + i) * numberOfChannels;

        if (data[pixelStart] === 255) {
            values[i] = j;
            break;
        }
    }

  }
  const filtered = values.filter(e => !isNaN(e));
  return filtered;
};

const getMeta = (arr) => {
  const {min, max, sum} = getMinMaxSum(arr);
  const mean = sum / arr.length;
  return {min, max, mean};
};

const normalize = (values, height, roundToIntegerValues = false) => {
  const {min, max, mean} = getMeta(values);
  const rangeMapFn = rangeToRangeMapper([min, max], [0, height]);
  const result = values.map(rangeMapFn);
  if (roundToIntegerValues) {
    return result.map(v => Math.round(v));
  }
  return result;
};

const arrayToBuffer = (array, min, max) => {
  const rangeMapFn = rangeToRangeMapper([0, height], [-1, 1]);

  const mappedToAudioRange = array.map(rangeMapFn);

  const buffer = audioCtx.createBuffer(1, mappedToAudioRange.length, 44100);

  const channelData = buffer.getChannelData(0);
  mappedToAudioRange.forEach((v, i) => channelData[i] = v);

  return buffer;
};


const image = new Image();
image.onload = () => {
  ctx.imageSmoothingEnabled = false;
  height = vertical.height = meta.height = canvas.height = image.height;
  width = vertical.width = meta.width = canvas.width = image.width;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, image.width, image.height);

  values = canvasToArray(ctx);

  const {min, max, mean} = getMeta(values);
  updateMeta(min, max, mean);
  bufferSourceNode.buffer = arrayToBuffer(values, 0, height);

  updateCanvas(values);
  updateVerticalLines();

  canvas.addEventListener("pointerdown", pointerDownHandler);
  canvas.addEventListener("pointerup", pointerUpHandler);
};



image.src = "./G-fjell_01_00086.png";

