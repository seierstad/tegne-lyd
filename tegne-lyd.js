"use strict";
import { render } from "preact";

import { MutableBufferSourceNode }  from "./mutable-buffer-source.js";
import { CanvasWaveVisualization } from "./canvas-visualization.js";

const rateInput = document.getElementById("rate");

let values = [];
const mean = 0;
let playing = false;
let height = 0;
let width = 0;

let buffer;


let audioCtx = null;
const playButton = document.createElement("button");
playButton.textContent = "play";
document.body.appendChild(playButton);
document.body.addEventListener("pointerdown", () => {
  console.log("pointerdownhandler");
  if (audioCtx === null) {
    initAudio();
  }
}, {capture: true, once: true});

let bufferSourceNode = null;

const initAudio = () => {
  audioCtx = new AudioContext();
  bufferSourceNode = new MutableBufferSourceNode(audioCtx);
  bufferSourceNode.loop = true;
  bufferSourceNode.connect(audioCtx.destination);

}

const changeRate = (event) => {
  bufferSourceNode.playbackRate = parseFloat(event.target.value);
};

rateInput.addEventListener("input", changeRate);

const play = () => {
  if (bufferSourceNode.buffer === null) {
    bufferSourceNode.buffer = arrayToBuffer(values, 0, height);
  }

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


const canvas = new CanvasWaveVisualization(document);
canvas.addEventListener("values", (event) => {
  values = event.detail.values;
  height = event.detail.height;
});

canvas.addEventListener("valuerange", (event) => {
  const {
    data,
    start 
  } = event.detail;

  values.splice(start, data.length, ...data);

  if (bufferSourceNode !== null) {
    bufferSourceNode.buffer = arrayToBuffer(values, 0, height);
  }
});

document.body.appendChild(canvas.domElement);

const image = new Image();
image.onload = () => {
  canvas.drawImage(image);
};



image.src = "./G-fjell_01_00086.png";

