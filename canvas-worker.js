"use strict";

/* TODO: fill the gaps (value isNaN) by linearly interpolating 
between nearest numeral values. Start and end isNaN values is filled with 
nearest numeral value */


const background = "black";
const foreground = "white";
const lineHeight = 3;
const lineWidth = 2;

const channels = [Array(256).fill(0), Array(256).fill(0), Array(256).fill(0), Array(256).fill(0)];
const numberOfChannels = channels.length;

const minMaxSumReducer = ({min, max, sum}, value) => ({min: Math.min(min, value), max: Math.max(max, value), sum: sum + value});
const getMinMaxSum = (array) => array.reduce(minMaxSumReducer, {min: Number.MAX_SAFE_INTEGER, max: Number.MIN_SAFE_INTEGER, sum: 0});


let waveform = {};
let vertical = {};
let meta = {};

let width = 0;
let height = 0;
let values = null;

let min;
let max;
let sum;
let mean;

const previousPointerPosition = {
  x: null,
  y: null
};


function setHeight (h) {
  height = h;
  waveform.canvas.height = h;
  vertical.canvas.height = h;
  meta.canvas.height = h;
}

function setWidth (w) {
  width = w;
  waveform.canvas.width = w;
  vertical.canvas.width = w;
  meta.canvas.width = w;
}

function canvasToValues () {
  const arr = [];
  const data = waveform.ctx.getImageData(0, 0, width, height).data;
  for (let i = 0; i < width; i+= 1) {
    for (let j = 0; j < height; j += 1) {
        const pixelStart = (j * width + i) * numberOfChannels;

        if (data[pixelStart] === 255) {
            arr[i] = j;
            break;
        }
    }

  }

  return arr.filter(n => !isNaN(n));
}

function getMeta (arr) {
  const {min, max, sum} = getMinMaxSum(arr);
  const mean = sum / arr.length;
  return {min, max, sum, mean};
}

function updateWaveformRange (start, data) {
  waveform.ctx.clearRect(start, 0, data.length, height);
  waveform.ctx.fillStyle = background;
  waveform.ctx.fillRect(start, 0, data.length, height);
  waveform.ctx.fillStyle = foreground;

  data.forEach((value, i) => {
    waveform.ctx.fillRect(start + i, value, 1, lineHeight);
  });
}

function updateWaveform () {
  if (values.length !== width) {
    width = values.length;
    updateWaveformRange(0, values);
  }
}

function updateVerticalLinesRange (start, end) {
  vertical.ctx.clearRect(Math.max(start - lineWidth, 0), 0, end - start + lineWidth + 1, height);

  let previousValue = values[Math.max(0, start - 1)];
  let value;
    vertical.ctx.strokeStyle = foreground;
    vertical.ctx.lineWidth = lineWidth;

    const maxX = Math.min(end + lineWidth, values.length - 1);

    for (let i = Math.min(start - 1, 0); i <= maxX ; i += 1, previousValue = value) {
      value = values[i];

      if (i > 0 && Math.abs(value - previousValue) >= lineHeight) {
        vertical.ctx.beginPath();
        vertical.ctx.moveTo(i - 1, previousValue);
        vertical.ctx.lineTo(i, value);
        vertical.ctx.stroke();
      }
      previousValue = value;

    }

}

function updateVerticalLines () {
    updateVerticalLinesRange(0, width);
}

function updateMeta (min, max, mean) {
  const integerMin = Math.floor(min);
  const integerMax = Math.floor(max);
  const integerMean = Math.floor(mean);

  meta.ctx.clearRect(0, 0, width, height);
  meta.ctx.strokeStyle = "rgba(255, 255, 0, 0.5)";

  meta.ctx.beginPath();
  meta.ctx.moveTo(0, integerMin);
  meta.ctx.lineTo(width, integerMin);
  meta.ctx.moveTo(0, integerMean);
  meta.ctx.lineTo(width, integerMean);
  meta.ctx.moveTo(0, integerMax);
  meta.ctx.lineTo(width, integerMax);
  meta.ctx.stroke();
}


function setValueRange (start, data) {
  if (start < values.length) {

    const {min: mi, max: ma, sum: s} = getMeta(data);
    const oldValues = values.splice(start, data.length, ...data);
    const oldSum = oldValues.reduce((sum, value) => sum + value);
    let updateNeeded = false;

    if (mi < min) {
      min = mi;
      updateNeeded = true;
    }
    if (ma > max) {
      max = ma;
      updateNeeded = true;
    }
    if (sum !== oldSum) {
      sum = sum - oldSum + s;
      mean = sum / values.length;
      updateNeeded = true;
    }

    updateWaveformRange(start, data);
    updateVerticalLinesRange(start, start + data.length);

    if (updateNeeded) {
      updateMeta(min, max, mean);
    }

    self.postMessage({
      type: "value_range",
      values: data.slice(),
      start
    });
  }
}


function drawInterpolatedLine (x, y) {
  const {
    x: prevX,
    y: prevY
  } = previousPointerPosition;

  const values = [];

  if (prevX !== x) {
    let xDiff = prevX - x;
    let yDiff = prevY - y;

    values[x] = y;

    for (let i = xDiff; i !== 0; i -= Math.sign(xDiff)) {
      const value = y + i/xDiff * yDiff;
      values[x + i] = value;
    }
    const slicedValues = values.slice(Math.min(x, prevX), Math.max(x, prevX));
    setValueRange(Math.min(x, prevX), slicedValues);

  } else {
    drawPoint(x, y);
  }

  previousPointerPosition.x = x;
  previousPointerPosition.y = y;
}


function drawPoint (x, y) {

  setValueRange(x, [y]);

  previousPointerPosition.x = x;
  previousPointerPosition.y = y;
}


function updateFromValues (values) {
  const {min, max, mean} = this.getMeta(values);
  updateMeta(min, max, mean);
  bufferSourceNode.buffer = arrayToBuffer(values, 0, height);
}


self.onmessage = (message) => {
  const {
    data = {}
  } = message;
  const {
    type
  } = data;

  switch (type) {
    case "canvas":
      waveform.canvas = data.waveformOffscreen;
      waveform.ctx = waveform.canvas.getContext("2d", {alpha: false});
      waveform.ctx.imageSmoothingEnabled = false;
      vertical.canvas = data.verticalOffscreen;
      vertical.ctx = vertical.canvas.getContext("2d");
      meta.canvas = data.metaOffscreen;
      meta.ctx = meta.canvas.getContext("2d");
      break;

    case "image":
      setHeight(data.image.height);
      setWidth(data.image.width);
      waveform.ctx.clearRect(0, 0, width, height);
      waveform.ctx.drawImage(data.image, 0, 0, width, height);
      values = canvasToValues();
      self.postMessage({
        type: "image_loaded",
        values: values.slice(),
        height,
        width
      });
      const {min: newMin, max: newMax, sum: newSum, mean: newMean} = getMeta(values);
      min = newMin;
      max = newMax;
      sum = newSum;
      mean = newMean;
      updateWaveform();
      updateVerticalLines();
      updateMeta(min, max, mean);
      break;

    case "point":
      drawPoint(data.x, data.y);
      break;

    case "line":
      drawInterpolatedLine(data.x, data.y);
      break;
  }
};
