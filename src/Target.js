import Pluggable from './Pluggable.js';

export default class Target extends Pluggable {
  get source() {
    if (!this.node.source) {
      return undefined;
    }

    return this.node.source.pub;
  }
  set source(value) {
    this.node.setSource(value);
  }

  get original() {
    return this.node.target;
  }

  set width(value) {
    if (!isNaN(value) && value > 0 && this.node.width !== value) {
      this.node.width = value;
      this.node.resize();
      this.node.setTransformDirty();
    }
  }

  set height(value) {
    if (!isNaN(value) && value > 0 && this.node.height !== value) {
      this.node.height = value;
      this.node.resize();
      this.node.setTransformDirty();
    }
  }

  constructor(targetNode) {
    super(targetNode);
  }

  render() {
    this.node.render();
  }

  readPixels(...args) {
    return this.node.readPixels(...args);
  }

  go(...args) {
    this.node.go(...args);
  }

  stop(...args) {
    this.node.stop(...args);
  }

  getTexture() {
    return this.node.frameBuffer.texture;
  }

  inputs(name) { // eslint-disable-line no-unused-vars
    return {
      source: {
        type: 'image',
      },
    };
  }
}
