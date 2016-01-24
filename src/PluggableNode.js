import FrameBuffer from './FrameBuffer.js';
import { isInstance, setTimeoutZero } from './utilities.js';

export default class PluggableNode {
  constructor(seriously) {
    this.seriously = seriously;

    this.ready = false;
    this.width = 1;
    this.height = 1;

    this.gl = seriously.gl;

    this.uniforms = {
      resolution: [this.width, this.height],
      transform: null,
    };

    this.dirty = true;
    this.isDestroyed = false;

    this.listeners = {};

    this.id = seriously.nodeId;
    seriously.nodeId++; // eslint-disable-line no-param-reassign
  }

  setReady() {
    if (this.ready) {
      return;
    }

    this.ready = true;
    this.emit('ready');

    if (this.targets) {
      for (const target of this.targets) {
        target.setReady();
      }
    }
  }

  setUnready() {
    if (!this.ready) {
      return;
    }

    this.ready = false;
    this.emit('unready');

    if (this.targets) {
      for (const target of this.targets) {
        target.setUnready();
      }
    }
  }

  setDirty() {
    // loop through all targets calling setDirty (depth-first)
    if (this.dirty) {
      return;
    }

    this.emit('dirty');
    this.dirty = true;

    if (this.targets) {
      for (const target of this.targets) {
        target.setDirty();
      }
    }
  }

  initFrameBuffer(useFloat) {
    if (this.gl) {
      this.frameBuffer = new FrameBuffer(this.gl, this.width, this.height, useFloat);
    }
  }

  readPixels(x, y, width, height, dest) {
    const gl = this.seriously.gl;
    const nodeGl = this.gl || gl;

    if (!gl) {
      // TODO: is this the best approach?
      throw new Error('Cannot read pixels until a canvas is connected');
    }

    // TODO: check on x, y, width, height

    if (!this.frameBuffer) {
      this.initFrameBuffer();
      this.setDirty();
    }

    // TODO: should we render here?
    this.render();

    // TODO: figure out formats and types
    if (dest === undefined) {
      dest = new Uint8Array(width * height * 4); // eslint-disable-line no-param-reassign
    } else if (!isInstance(dest, 'Uint8Array')) {
      throw new Error('Incompatible array type');
    }

    nodeGl.bindFramebuffer(gl.FRAMEBUFFER, this.frameBuffer.frameBuffer);
    nodeGl.readPixels(x, y, width, height, gl.RGBA, gl.UNSIGNED_BYTE, dest);

    return dest;
  }

  resize() {
    let width;
    let height;

    if (this.source) {
      width = this.source.width;
      height = this.source.height;
    } else if (this.sources && this.sources.source) {
      width = this.sources.source.width;
      height = this.sources.source.height;
    } else if (this.inputs && this.inputs.width) {
      width = this.inputs.width;
      height = this.inputs.height || width;
    } else if (this.inputs && this.inputs.height) {
      width = height = this.inputs.height;
    } else {
      // this node will be responsible for calculating its own size
      width = 1;
      height = 1;
    }

    width = Math.floor(width);
    height = Math.floor(height);

    if (this.width !== width || this.height !== height) {
      this.width = width;
      this.height = height;

      this.emit('resize');
      this.setDirty();
    }

    if (this.uniforms && this.uniforms.resolution) {
      this.uniforms.resolution[0] = width;
      this.uniforms.resolution[1] = height;
    }

    if (this.frameBuffer && this.frameBuffer.resize) {
      this.frameBuffer.resize(width, height);
    }
  }

  on(eventName, callback) {
    if (!eventName || typeof callback !== 'function') {
      return;
    }

    let listeners = this.listeners[eventName];
    let index = -1;
    if (listeners) {
      index = listeners.indexOf(callback);
    } else {
      listeners = this.listeners[eventName] = [];
    }

    if (index < 0) {
      listeners.push(callback);
    }
  }

  off(eventName, callback) {
    if (!eventName || typeof callback !== 'function') {
      return;
    }

    const listeners = this.listeners[eventName];
    let index = -1;
    if (listeners) {
      index = listeners.indexOf(callback);
      if (index >= 0) {
        listeners.splice(index, 1);
      }
    }
  }

  emit(eventName) {
    const listeners = this.listeners[eventName];

    if (listeners) {
      listeners.map(setTimeoutZero);
    }
  }

  destroy() {
    const seriously = this.seriously;

    delete this.gl;
    delete this.seriously;

    // remove all listeners
    for (const key in this.listeners) {
      if (this.listeners.hasOwnProperty(key)) {
        delete this.listeners[key];
      }
    }

    // clear out uniforms
    for (const i in this.uniforms) {
      if (this.uniforms.hasOwnProperty(i)) {
        delete this.uniforms[i];
      }
    }

    // clear out list of targets and disconnect each
    if (this.targets) {
      delete this.targets;
    }

    // clear out frameBuffer
    if (this.frameBuffer && this.frameBuffer.destroy) {
      this.frameBuffer.destroy();
      delete this.frameBuffer;
    }

    // remove from main nodes index
    const i = seriously.nodes.indexOf(this);
    if (i >= 0) {
      seriously.nodes.splice(i, 1);
    }
    delete seriously.nodesById[this.id];

    this.isDestroyed = true;
  }
}
