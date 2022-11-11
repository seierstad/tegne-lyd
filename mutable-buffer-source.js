"use strict";

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

    start (timestamp = 0) {
        if (this.playing) {
            throw new Error("already playing!!!");
        }
        this.node.start(timestamp);
        this.playing = true;
    }

    stop (timestamp = 0) {
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
    get playbackRate () {
        return this._playbackRate;
    }

    set detune (detune) {
        this._detune = detune;
        this.node.detune.value = this._detune;
    }

    get detune () {
        return this._detune;
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

    bufferEnded () {
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
        if (destination === null) {
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

export {
    MutableBufferSourceNode
};
