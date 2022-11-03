"use strict";


let pointerPressed = false;
let continousMode = true;

class CanvasWaveVisualization extends EventTarget {

    constructor (document) {
        super();
        this.container = document.createElement("div");
        this.container.classList.add("visualization");

        const waveform = document.createElement("canvas");
        waveform.id = "waveform";
        this.container.appendChild(waveform);
        const waveformOffscreen = waveform.transferControlToOffscreen();

        const vertical = document.createElement("canvas");
        vertical.id = "vertical_lines";
        this.container.appendChild(vertical);
        const verticalOffscreen = vertical.transferControlToOffscreen();

        const meta = document.createElement("canvas");
        meta.id = "meta";
        this.container.appendChild(meta);
        const metaOffscreen = meta.transferControlToOffscreen();

        this.pointerTarget = document.createElement("canvas");
        this.pointerTarget.id = "pointer_target";
        this.container.appendChild(this.pointerTarget);

        this.worker = new Worker("canvas.worker.js");

        this.worker.postMessage({
            type: "canvas",
            waveformOffscreen,
            verticalOffscreen,
            metaOffscreen
        }, [
            waveformOffscreen,
            verticalOffscreen,
            metaOffscreen
        ]);


        this.drawImage = this.drawImage.bind(this);
        this.pointerUpHandler = this.pointerUpHandler.bind(this);
        this.pointerDownHandler = this.pointerDownHandler.bind(this);
        this.pointerMoveHandler = this.pointerMoveHandler.bind(this);
        this.pointerOutHandler = this.pointerOutHandler.bind(this);
        this.workerMessageHandler = this.workerMessageHandler.bind(this);

        this.worker.addEventListener("message", this.workerMessageHandler);
        this.pointerTarget.addEventListener("pointerdown", this.pointerDownHandler);
        this.pointerTarget.addEventListener("pointerup", this.pointerUpHandler);
        this.pointerTarget.addEventListener("pointerout", this.pointerOutHandler);


        this._height = 0;
        this._width = 0;
    }

    workerMessageHandler (msg) {
        const {data = {}} = msg;
        const {type} = data;

        switch (type) {
            case "image_loaded":
                this.height = data.height;
                this.width = data.width;
                this.values = data.values;

                break;

            case "value_range":
                const event = new CustomEvent("valuerange", {detail: {
                    start: data.start,
                    data: data.values.slice()
                }});
                this.dispatchEvent(event);
                break;
        }

    }

    set height (height) {
        this._height = height;
        this.pointerTarget.height = height;
    }

    set width (width) {
        this._width = width;
        this.pointerTarget.width = width;
    }


    get domElement () {
        return this.container;
    }

    set values (arr) {
        const event = new CustomEvent("values", { detail: {
            values: arr,
            height: this._height
        }});
        this.dispatchEvent(event);
    }

    async drawImage (image) {
        const bitmap = await createImageBitmap(image);
        this.worker.postMessage({type: "image", image: bitmap}, [bitmap]);
    }

    drawPoint (x, y) {
        this.worker.postMessage({type: "point", x, y});
    }

    drawLine (x, y) {
        this.worker.postMessage({type: "line", x, y});
    }

    pointerDownHandler (event) {
        const {
            offsetX: x,
            offsetY: y
        } = event;
        pointerPressed = true;
        this.drawPoint(x, y);

        this.pointerTarget.addEventListener("pointermove", this.pointerMoveHandler);
    }

    pointerUpHandler () {
        pointerPressed = false;
        this.pointerTarget.removeEventListener("pointermove", this.pointerMoveHandler);
    }

    pointerMoveHandler (event) {
        if (pointerPressed) {
            const {
                offsetX: x,
                offsetY: y
            } = event;
            if (continousMode) {
                this.drawLine(x, y);
            } else {
                this.drawPoint(x, y);
            }
        }
    }

    pointerOutHandler () {
        this.pointerPressed = false;
        this.pointerTarget.removeEventListener("pointermove", this.pointerMoveHandler);
    }

}

export {
    CanvasWaveVisualization
};
