"use strict";

import { MutableBufferSourceNode } from "./mutable-buffer-source.js";
import { CanvasWaveVisualization } from "./canvas-visualization.js";

const detuneInput = document.getElementById("detune");
detuneInput.value = 0;

const sampleFreq = 44100;

let values = [];
let height = 0;
let rate = 1;
let detune = 0;

let audioCtx = null;

const detuneResetButton = document.createElement("button");
detuneResetButton.textContent = "reset detune";
document.body.appendChild(detuneResetButton);




const playButton = document.createElement("button");
playButton.textContent = "play";
document.body.appendChild(playButton);

let bufferSourceNode = null;

detuneResetButton.addEventListener("click", () => {
    detune = 0;
    detuneInput.value = 0;
    if (bufferSourceNode !== null) {
        bufferSourceNode.detune = 0;
    }
});


const initAudio = () => {
    audioCtx = new AudioContext();
    bufferSourceNode = new MutableBufferSourceNode(audioCtx);
    bufferSourceNode.loop = true;
    bufferSourceNode.connect(audioCtx.destination);

};

document.body.addEventListener("pointerdown", () => {
    if (audioCtx === null) {
        initAudio();
    }
}, {capture: true, once: true});

const changeDetune = (event) => {
    bufferSourceNode.detune = parseFloat(event.target.value);
};

const setDuration = (duration) => {
    rate = values.length / (duration * sampleFreq);

    bufferSourceNode.playbackRate = rate;
};

detuneInput.addEventListener("input", changeDetune);


const rangeToRangeMapper = ([inMin, inMax], [outMin, outMax]) => {
    const inDiff = inMax - inMin;
    const outDiff = outMax - outMin;

    return (value) => value < inMin ? outMax : value > inMax ? outMax : outMin + ((value - inMin) / inDiff) * outDiff;
};


const arrayToBuffer = (array, min, max) => {
    const rangeMapFn = rangeToRangeMapper([min, max], [1, -1]);
    const mappedToAudioRange = array.map(rangeMapFn);
    const buffer = audioCtx.createBuffer(2, mappedToAudioRange.length, 44100);
    const channelData = buffer.getChannelData(0);
    mappedToAudioRange.forEach((v, i) => channelData[i] = v);

    //**
    const triggerData = buffer.getChannelData(1);
    const halfLength = triggerData.length / 2;
    triggerData.forEach((d, i) => triggerData[i] = (i / halfLength) - 1);
    //*/

    return buffer;
};

let stop;

const play = () => {
    if (bufferSourceNode.buffer === null) {
        bufferSourceNode.buffer = arrayToBuffer(values, 0, height);
    }

    bufferSourceNode.playbackRate = rate;
    bufferSourceNode.detune = parseFloat(detuneInput.value);
    bufferSourceNode.start();
    playButton.textContent = "stop";
    playButton.removeEventListener("click", play);
    playButton.addEventListener("click", stop);
};

stop = () => {
    bufferSourceNode.stop();
    playButton.textContent = "play";
    playButton.removeEventListener("click", stop);
    playButton.addEventListener("click", play);
};


playButton.addEventListener("click", play);


/*
const normalize = (values, height, roundToIntegerValues = false) => {
    const {min, max} = getMeta(values);
    const rangeMapFn = rangeToRangeMapper([min, max], [0, height]);
    const result = values.map(rangeMapFn);
    if (roundToIntegerValues) {
        return result.map(v => Math.round(v));
    }
    return result;
};
*/


const durations = [
    0.001,
    0.002,
    0.005,
    0.01,
    0.02,
    0.05,
    0.1,
    0.2,
    0.5,
    1,
    2,
    5
];




const canvas = new CanvasWaveVisualization(document);

canvas.addEventListener("values", (event) => {
    values = event.detail.values;
    height = event.detail.height;
    console.log("lengde: " + values.length);
    const time = values.length / sampleFreq;
    durations.map(d => {
        const b = document.createElement("button");
        b.innerText = d;
        document.body.appendChild(b);
        b.value = d;
        b.addEventListener("click", (event) => setDuration(parseFloat(event.target.value)));
    });

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

