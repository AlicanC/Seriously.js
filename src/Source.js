import Pluggable from './Pluggable.js';

export default class Source extends Pluggable {
  get original() {
    return this.node.original;
  }

  constructor(sourceNode) {
    super(sourceNode);
  }

  render() {
    this.node.render();
  }

  update() {
    this.node.setDirty();
  }

  readPixels(...args) {
    return this.node.readPixels(...args);
  }
}
