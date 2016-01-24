import { noop } from './utilities.js';

export default class Pluggable {
  get id() {
    return this.node.id;
  }

  get width() {
    return this.node.width;
  }

  get height() {
    return this.node.height;
  }

  constructor(node) {
    this.node = node;
  }

  readPixels(...args) {
    return this.node.readPixels(...args);
  }

  on(...args) {
    this.node.on(...args);
  }

  off(...args) {
    this.node.off(...args);
  }

  destroy() {
    this.node.destroy();

    for (const i in this) {
      if (!this.hasOwnProperty(i)) {
        continue;
      }

      if (i === 'isDestroyed' && i === 'id') {
        continue;
      }

      const descriptor = Object.getOwnPropertyDescriptor(this, i);
      if (descriptor.get || descriptor.set ||
          typeof this[i] !== 'function') {
        delete this[i];
      } else {
        this[i] = noop;
      }
    }
  }

  isDestroyed() {
    return this.node.isDestroyed;
  }

  isReady() {
    return this.node.ready;
  }
}
