"use strict";

const background = "black";
const foreground = "white";
const lineHeight = 3;
const lineWidth = 2;

const channels = [Array(256).fill(0), Array(256).fill(0), Array(256).fill(0), Array(256).fill(0)];
const numberOfChannels = channels.length;
let pointerPressed = false;
let continousMode = true;
const previousPointerPosition = {x: 0, y: 0};


const minMaxSumReducer = ({min, max, sum}, value) => ({min: Math.min(min, value), max: Math.max(max, value), sum: sum + value});
const getMinMaxSum = (array) => array.reduce(minMaxSumReducer, {min: Number.MAX_SAFE_INTEGER, max: Number.MIN_SAFE_INTEGER, sum: 0});


class CanvasWaveVisualization extends EventTarget {

	constructor (document) {
		super();
		this.container = document.createElement("div");
		this.container.classList.add("visualization");
		this.waveform = document.createElement("canvas");
		this.waveformCtx = this.waveform.getContext("2d", {alpha: false});
		this.container.appendChild(this.waveform);
		this.vertical = document.createElement("canvas");
		this.vertical.id = "vertical_lines";
		this.verticalCtx = this.vertical.getContext("2d");

		this.container.appendChild(this.vertical);
		this.meta = document.createElement("canvas");
		this.meta.id = "meta";
		this.metaCtx = this.meta.getContext("2d");
		this.container.appendChild(this.meta);
		this.waveformCtx.imageSmoothingEnabled = false;

		this.drawImage = this.drawImage.bind(this);
		this.pointerUpHandler = this.pointerUpHandler.bind(this);
		this.pointerDownHandler = this.pointerDownHandler.bind(this);
		this.pointerMoveHandler = this.pointerMoveHandler.bind(this);
		this.pointerOutHandler = this.pointerOutHandler.bind(this);

		this._height = 0;
		this._width = 0;
		this._min = 0;
		this._max = 0;
		this._sum = 0;
		this._mean = 0;

		this._values = [];
	}

	get domElement () {
		return this.container;
	}

	set height (height) {
		this._height = this.vertical.height = this.meta.height = this.waveform.height = height;
	}

	get height () {
		return this._height;
	}

	set width (width) {
		this._width = this.vertical.width = this.meta.width = this.waveform.width = width;
	}

	get width () {
		return this._width;
	}

	get values () {
		return this._values;
	}

	set values (arr) {
		this._values = arr.filter(n => !isNaN(n));
		const {min, max, sum, mean} = this.getMeta(this._values);
		this._min = min;
		this._max = max;
		this._sum = sum;
		this._mean = mean;
		const event = new CustomEvent("values", { detail: {
			values: this._values.slice(),
			height: this._height,
			min: this._min,
			max: this._max,
			mean: this._mean
		}});
		this.dispatchEvent(event);
	}

	setValueRange (start, data) {
		if (start < this._values.length) {

			const {min, max, sum} = this.getMeta(data);
			const oldValues = this._values.splice(start, data.length, ...data);
			const oldSum = oldValues.reduce((sum, value) => sum + value);
			let updateNeeded = false;

			if (min < this._min) {
				this._min = min;
				updateNeeded = true;
			}
			if (max > this._max) {
				this._max = max;
				updateNeeded = true;
			}
			if (sum !== oldSum) {
				this._sum = this._sum - oldSum + sum;
				this._mean = this._sum / this._values.length;
				updateNeeded = true;
			}

			this.updateWaveformRange(start, data);
			this.updateVerticalLinesRange(start, start + data.length);

			if (updateNeeded) {
				this.updateMeta();
			}
			const event = new CustomEvent("valuerange", {detail: {
				start,
				data: data.slice()
			}});

			this.dispatchEvent(event);
		}
	}

	drawImage (image) {
		this.height = image.height;
		this.width = image.width;
		this.waveformCtx.clearRect(0, 0, this.width, this.height);
		this.waveformCtx.drawImage(image, 0, 0, this.width, this.height);

		this.canvasToValues();
		this.updateWaveform();
		this.updateVerticalLines();
		this.updateMeta();

		this.waveform.addEventListener("pointerdown", this.pointerDownHandler);
		this.waveform.addEventListener("pointerup", this.pointerUpHandler);
		this.waveform.addEventListener("pointerout", this.pointerOutHandler);
	}

	drawInterpolatedLine (event) {
	  const {
	    offsetX: x,
	    offsetY: y
	  } = event;

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
	    this.setValueRange(Math.min(x, prevX), slicedValues);

	  } else {
	    this.drawPoint(event);
	  }

	  previousPointerPosition.x = x;
	  previousPointerPosition.y = y;
	}

	drawPoint (event) {
	  const {
	    offsetX: x,
	    offsetY: y
	  } = event;

	  this.setValueRange(x, [y]);

	  previousPointerPosition.x = x;
	  previousPointerPosition.y = y;
	}

	updateFromValues (values) {
	  const {min, max, mean} = this.getMeta(values);
	  updateMeta(min, max, mean);
	  bufferSourceNode.buffer = arrayToBuffer(values, 0, height);
	}

	pointerUpHandler (event) {
	  pointerPressed = false;
	  this.waveform.removeEventListener("pointermove", this.pointerMoveHandler);
	}

	pointerDownHandler (event) {
	  pointerPressed = true;
	  this.drawPoint(event);
	  
	  this.waveform.addEventListener("pointermove", this.pointerMoveHandler);
	}


	pointerMoveHandler (event) {
	  if (pointerPressed) {
	    if (continousMode) {
	      this.drawInterpolatedLine(event);
	    } else {
	      this.drawPoint(event);
	    }
	  }
	}

	pointerOutHandler (event) {
	  this.pointerPressed = false;
	  this.waveform.removeEventListener("pointermove", this.pointerMoveHandler);
	}

	canvasToValues () {
	  const arr = [];
	  const data = this.waveformCtx.getImageData(0, 0, this.width, this.height).data;
	  for (let i = 0; i < this.width; i+= 1) {
	    for (let j = 0; j < this.height; j += 1) {
	        const pixelStart = (j * this.width + i) * numberOfChannels;

	        if (data[pixelStart] === 255) {
	            arr[i] = j;
	            break;
	        }
	    }

	  }
	  this.values = arr;
	}

	getMeta (arr) {
	  const {min, max, sum} = getMinMaxSum(arr);
	  const mean = sum / arr.length;
	  return {min, max, sum, mean};
	}

	updateMeta () {
	  const integerMean = Math.floor(this._mean);
	  const integerMin = Math.floor(this._min);
	  const integerMax = Math.floor(this._max);

	  this.metaCtx.clearRect(0, 0, this.width, this.height);
	  this.metaCtx.strokeStyle = "rgba(255, 255, 0, 0.5)";

	  this.metaCtx.beginPath();
	  this.metaCtx.moveTo(0, integerMin);
	  this.metaCtx.lineTo(this.width, integerMin);
	  this.metaCtx.moveTo(0, integerMean);
	  this.metaCtx.lineTo(this.width, integerMean);
	  this.metaCtx.moveTo(0, integerMax);
	  this.metaCtx.lineTo(this.width, integerMax);
	  this.metaCtx.stroke();
	}

	updateWaveformRange (start, data) {
	    this.waveformCtx.clearRect(start, 0, data.length, this.height);
	    this.waveformCtx.fillStyle = background;
	    this.waveformCtx.fillRect(start, 0, data.length, this.height);
	    this.waveformCtx.fillStyle = foreground;

	    data.forEach((value, i) => {
	      this.waveformCtx.fillRect(start + i, value, 1, lineHeight);
	    });
	}

	updateWaveform () {
	  if (this._values.length !== this.width) {
	    this.width = this._values.length;
	    this.updateWaveformRange(0, this._values);
	  }
	}

	updateVerticalLinesRange (start, end) {
		this.verticalCtx.clearRect(Math.max(start - lineWidth, 0), 0, end - start + lineWidth + 1, this.height);

		let previousValue = this._values[Math.max(0, start - 1)];
		let value;
	    this.verticalCtx.strokeStyle = foreground;
	    this.verticalCtx.lineWidth = lineWidth;

	    const maxX = Math.min(end + lineWidth, this._values.length - 1);

	    for (let i = Math.min(start - 1, 0); i <= maxX ; i += 1, previousValue = value) {
	      value = this._values[i];

	      if (i > 0 && Math.abs(value - previousValue) >= lineHeight) {
	        this.verticalCtx.beginPath();
	        this.verticalCtx.moveTo(i - 1, previousValue);
	        this.verticalCtx.lineTo(i, value);
	        this.verticalCtx.stroke();
	      }
	      previousValue = value;

	    }

	}

	updateVerticalLines () {
	    this.updateVerticalLinesRange(0, this.width);
	}
}

export {
	CanvasWaveVisualization
};
