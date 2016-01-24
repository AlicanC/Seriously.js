import PluggableNode from './PluggableNode.js';
import Source from './Source.js';
import FrameBuffer from './FrameBuffer.js';
import { isInstance, getElement, noop } from './utilities.js';

export default class SourceNode extends PluggableNode {
  constructor(seriously, hook, source, options) {
    super(seriously);

    const opts = options || {};
    let flip = opts.flip === undefined ? true : opts.flip;
    let width = opts.width;
    let height = opts.height;

    const sourcePlugin = (hook, source, options, force) => { // eslint-disable-line no-shadow
      let p = this.seriously.Seriously.registry.sources[hook];
      if (p.definition) {
        p = p.definition.call(this, source, options, force);
        if (p) {
          p = Object.assign(Object.assign({}, this.seriously.Seriously.registry.sources[hook]), p); // eslint-disable-line max-len
        } else {
          return null;
        }
      }
      return p;
    };

    const compareSource = (source) => { // eslint-disable-line no-shadow, arrow-body-style
      return this.source === source;
    };

    if (hook && typeof hook !== 'string' || !source && source !== 0) {
      if (!options || typeof options !== 'object') {
        options = source; // eslint-disable-line no-param-reassign
      }
      source = hook; // eslint-disable-line no-param-reassign
    }

    if (typeof source === 'string' && isNaN(source)) {
      source = getElement(source, ['canvas', 'img', 'video']); // eslint-disable-line no-param-reassign, max-len
    }

    // forced source type?
    let matchedType = false;
    let deferTexture = false;
    let plugin;
    if (typeof hook === 'string' && this.seriously.Seriously.registry.sources[hook]) {
      plugin = sourcePlugin(hook, source, options, true);
      if (plugin) {
        this.hook = hook;
        matchedType = true;
        deferTexture = plugin.deferTexture;
        this.plugin = plugin;
        this.compare = plugin.compare;
        this.checkDirty = plugin.checkDirty;
        if (plugin.source) {
          source = plugin.source; // eslint-disable-line no-param-reassign
        }
      }
    }

    // TODO: could probably stand to re-work and re-indent this whole block now that we have plugins
    if (!plugin && isInstance(source)) {
      if (source.tagName === 'CANVAS') {
        this.width = source.width;
        this.height = source.height;

        this.render = this.renderImageCanvas;
        matchedType = true;
        this.hook = 'canvas';
        this.compare = compareSource;
      } else if (source.tagName === 'IMG') {
        this.width = source.naturalWidth || 1;
        this.height = source.naturalHeight || 1;

        if (!source.complete || !source.naturalWidth) {
          deferTexture = true;
        }

        source.addEventListener('load', () => {
          if (!this.isDestroyed) {
            if (this.width !== source.naturalWidth || this.height !== source.naturalHeight) {
              this.width = source.naturalWidth;
              this.height = source.naturalHeight;
              this.resize();
            }

            this.setDirty();
            this.setReady();
          }
        }, true);

        this.render = this.renderImageCanvas;
        matchedType = true;
        this.hook = 'image';
        this.compare = compareSource;
      }
    } else if (!plugin && isInstance(source, 'WebGLTexture')) {
      if (this.serious.gl && !this.serious.gl.isTexture(source)) {
        throw new Error('Not a valid WebGL texture.');
      }

      // different defaults
      if (!isNaN(width)) {
        if (isNaN(height)) {
          height = width;
        }
      } else if (!isNaN(height)) {
        width = height;
      }/* else {
        //todo: guess based on dimensions of target canvas
        //throw new Error('Must specify width and height when using a WebGL texture as a source');
      }*/

      this.width = width;
      this.height = height;

      if (opts.flip === undefined) {
        flip = false;
      }
      matchedType = true;

      this.texture = source;
      this.initialized = true;
      this.hook = 'texture';
      this.compare = compareSource;

      // TODO: if WebGLTexture source is from a different context render it and copy it over
      this.render = noop;
    }

    if (!matchedType && !plugin) {
      for (const key in seriously.Seriously.registry.sources) {
        if (seriously.Seriously.registry.sources.hasOwnProperty(key)
          && seriously.Seriously.registry.sources[key]) {
          plugin = sourcePlugin(key, source, options, false);
          if (plugin) {
            this.hook = key;
            matchedType = true;
            deferTexture = plugin.deferTexture;
            this.plugin = plugin;
            this.compare = plugin.compare;
            this.checkDirty = plugin.checkDirty;
            if (plugin.source) {
              source = plugin.source; // eslint-disable-line no-param-reassign
            }

            break;
          }
        }
      }
    }

    if (!matchedType) {
      throw new Error('Unknown source type');
    }

    this.source = source;
    if (this.flip === undefined) {
      this.flip = flip;
    }

    this.targets = [];

    if (!deferTexture) {
      this.setReady();
    }

    this.pub = new Source(this);

    seriously.nodes.push(this);
    seriously.nodesById[this.id] = this; // eslint-disable-line no-param-reassign
    seriously.sources.push(this);
    seriously.Seriously.registry.allSourcesByHook[this.hook].push(this);

    if (seriously.sources.length && !seriously.rafId) {
      seriously.renderDaemon();
    }
  }

  initialize() {
    if (!this.seriously.gl || this.texture || !this.ready) {
      return;
    }

    const texture = this.seriously.gl.createTexture();
    this.seriously.gl.bindTexture(this.seriously.gl.TEXTURE_2D, texture);
    this.seriously.gl.pixelStorei(this.seriously.gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    this.seriously.gl.texParameteri(this.seriously.gl.TEXTURE_2D,
      this.seriously.gl.TEXTURE_MAG_FILTER, this.seriously.gl.LINEAR);
    this.seriously.gl.texParameteri(this.seriously.gl.TEXTURE_2D,
      this.seriously.gl.TEXTURE_MIN_FILTER, this.seriously.gl.LINEAR);
    this.seriously.gl.texParameteri(this.seriously.gl.TEXTURE_2D,
      this.seriously.gl.TEXTURE_WRAP_S, this.seriously.gl.CLAMP_TO_EDGE);
    this.seriously.gl.texParameteri(this.seriously.gl.TEXTURE_2D,
      this.seriously.gl.TEXTURE_WRAP_T, this.seriously.gl.CLAMP_TO_EDGE);
    this.seriously.gl.bindTexture(this.seriously.gl.TEXTURE_2D, null);

    this.texture = texture;
    this.initialized = true;
    this.allowRefresh = true;
    this.setDirty();
  }

  initFrameBuffer(useFloat) {
    if (this.seriously.gl) {
      this.frameBuffer = new FrameBuffer(this.seriously.gl, this.width, this.height, {
        texture: this.texture,
        useFloat,
      });
    }
  }

  addTarget(target) {
    for (const aTarget of this.targets) {
      if (aTarget === target) {
        return;
      }
    }

    this.targets.push(target);
  }

  removeTarget(target) {
    const i = this.targets && this.targets.indexOf(target);
    if (i >= 0) {
      this.targets.splice(i, 1);
    }
  }

  resize() {
    this.uniforms.resolution[0] = this.width;
    this.uniforms.resolution[1] = this.height;

    if (this.framebuffer) {
      this.framebuffer.resize(this.width, this.height);
    }

    this.emit('resize');
    this.setDirty();

    if (this.targets) {
      for (const target of this.targets) {
        target.resize();
        if (target.setTransformDirty) {
          target.setTransformDirty();
        }
      }
    }
  }

  setReady() {
    if (this.ready) {
      return;
    }
    this.ready = true;
    this.resize();
    this.initialize();

    this.emit('ready');
    if (this.targets) {
      for (const target of this.targets) {
        target.setReady();
      }
    }
  }

  render() {
    const media = this.source;

    if (!this.seriously.gl || !media && media !== 0 || !this.ready) {
      return;
    }

    if (!this.initialized) {
      this.initialize();
    }

    if (!this.allowRefresh) {
      return;
    }

    if (this.plugin && this.plugin.render &&
        (this.dirty || this.checkDirty && this.checkDirty()) &&
        this.plugin.render.call(this, this.seriously.gl,
          this.seriously.draw.bind(this.seriously),
          this.seriously.rectangleModel, this.seriously.baseShader)) {
      this.dirty = false;
      this.emit('render');
    }
  }

  renderImageCanvas() {
    const media = this.source;

    if (!this.seriously.gl || !media || !this.ready) {
      return undefined;
    }

    if (!this.initialized) {
      this.initialize();
    }

    if (!this.allowRefresh) {
      return undefined;
    }

    if (this.dirty) {
      this.seriously.gl.bindTexture(this.seriously.gl.TEXTURE_2D, this.texture);
      this.seriously.gl.pixelStorei(this.seriously.gl.UNPACK_FLIP_Y_WEBGL, this.flip);
      this.seriously.gl.pixelStorei(this.seriously.gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      try {
        this.seriously.gl.texImage2D(this.seriously.gl.TEXTURE_2D, 0,
          this.seriously.gl.RGBA, this.seriously.gl.RGBA, this.seriously.gl.UNSIGNED_BYTE, media);

        this.dirty = false;
        this.emit('render');
        return true;
      } catch (securityError) {
        if (securityError.code === window.DOMException.SECURITY_ERR) {
          this.allowRefresh = false;
          console.error('Unable to access cross-domain image');
        }
      }

      return false;
    }

    return undefined;
  }

  destroy() {
    if (this.plugin && this.plugin.destroy) {
      this.plugin.destroy.call(this);
    }

    if (this.seriously.gl && this.texture) {
      this.seriously.gl.deleteTexture(this.texture);
    }

    // targets
    while (this.targets.length) {
      const item = this.targets.pop();
      if (item && item.removeSource) {
        item.removeSource(this);
      }
    }

    // remove self from master list of sources
    let i = this.seriously.sources.indexOf(this);
    if (i >= 0) {
      this.seriously.sources.splice(i, 1);
    }

    i = this.seriously.Seriously.registry.allSourcesByHook[this.hook].indexOf(this);
    if (i >= 0) {
      this.seriously.Seriously.registry.allSourcesByHook[this.hook].splice(i, 1);
    }

    for (const key in this) {
      if (this.hasOwnProperty(key) && key !== 'id') {
        delete this[key];
      }
    }

    super.destroy();
  }
}
