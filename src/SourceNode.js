const util = require('./util.js');
const Node = require('./Node.js');
const Source = require('./Source.js');

let randomVars;
const SourceNode = module.exports = function SourceNode(arandomVars, hook, source, options) {
  randomVars = arandomVars;
  var opts = options || {},
    flip = opts.flip === undefined ? true : opts.flip,
    width = opts.width,
    height = opts.height,
    deferTexture = false,
    that = this,
    matchedType = false,
    key,
    plugin;

  function sourcePlugin(hook, source, options, force) {
    var p = seriousSources[hook];
    if (p.definition) {
      p = p.definition.call(that, source, options, force);
      if (p) {
        p = Object.assign(Object.assign({}, seriousSources[hook]), p);
      } else {
        return null;
      }
    }
    return p;
  }

  function compareSource(source) {
    return that.source === source;
  }

  Node.call(this, randomVars);

  if (hook && typeof hook !== 'string' || !source && source !== 0) {
    if (!options || typeof options !== 'object') {
      options = source;
    }
    source = hook;
  }

  if (typeof source === 'string' && isNaN(source)) {
    source = getElement(source, ['canvas', 'img', 'video']);
  }

  // forced source type?
  if (typeof hook === 'string' && seriousSources[hook]) {
    plugin = sourcePlugin(hook, source, options, true);
    if (plugin) {
      this.hook = hook;
      matchedType = true;
      deferTexture = plugin.deferTexture;
      this.plugin = plugin;
      this.compare = plugin.compare;
      this.checkDirty = plugin.checkDirty;
      if (plugin.source) {
        source = plugin.source;
      }
    }
  }

  //todo: could probably stand to re-work and re-indent this whole block now that we have plugins
  if (!plugin && util.isInstance(source)) {
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

      source.addEventListener('load', function () {
        if (!that.isDestroyed) {
          if (that.width !== source.naturalWidth || that.height !== source.naturalHeight) {
            that.width = source.naturalWidth;
            that.height = source.naturalHeight;
            that.resize();
          }

          that.setDirty();
          that.setReady();
        }
      }, true);

      this.render = this.renderImageCanvas;
      matchedType = true;
      this.hook = 'image';
      this.compare = compareSource;
    }
  } else if (!plugin && util.isInstance(source, 'WebGLTexture')) {
    if (gl && !gl.isTexture(source)) {
      throw new Error('Not a valid WebGL texture.');
    }

    //different defaults
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

    //todo: if WebGLTexture source is from a different context render it and copy it over
    this.render = function () {};
  }

  if (!matchedType && !plugin) {
    for (key in seriousSources) {
      if (seriousSources.hasOwnProperty(key) && seriousSources[key]) {
        plugin = sourcePlugin(key, source, options, false);
        if (plugin) {
          this.hook = key;
          matchedType = true;
          deferTexture = plugin.deferTexture;
          this.plugin = plugin;
          this.compare = plugin.compare;
          this.checkDirty = plugin.checkDirty;
          if (plugin.source) {
            source = plugin.source;
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
    that.setReady();
  }

  this.pub = new Source(this);

  nodes.push(this);
  nodesById[this.id] = this;
  sources.push(this);
  allSourcesByHook[this.hook].push(this);

  if (sources.length && !rafId) {
    renderDaemon();
  }
};

SourceNode.prototype = Object.create(Node.prototype);
SourceNode.prototype.constructor = SourceNode;

SourceNode.prototype.initialize = function () {
  var texture;

  if (!gl || this.texture || !this.ready) {
    return;
  }

  texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindTexture(gl.TEXTURE_2D, null);

  this.texture = texture;
  this.initialized = true;
  this.allowRefresh = true;
  this.setDirty();
};

SourceNode.prototype.initFrameBuffer = function (useFloat) {
  if (gl) {
    this.frameBuffer = new FrameBuffer(gl, this.width, this.height, {
      texture: this.texture,
      useFloat: useFloat
    });
  }
};

SourceNode.prototype.addTarget = function (target) {
  var i;
  for (i = 0; i < this.targets.length; i++) {
    if (this.targets[i] === target) {
      return;
    }
  }

  this.targets.push(target);
};

SourceNode.prototype.removeTarget = function (target) {
  var i = this.targets && this.targets.indexOf(target);
  if (i >= 0) {
    this.targets.splice(i, 1);
  }
};

SourceNode.prototype.resize = function () {
  var i,
    target;

  this.uniforms.resolution[0] = this.width;
  this.uniforms.resolution[1] = this.height;

  if (this.framebuffer) {
    this.framebuffer.resize(this.width, this.height);
  }

  this.emit('resize');
  this.setDirty();

  if (this.targets) {
    for (i = 0; i < this.targets.length; i++) {
      target = this.targets[i];
      target.resize();
      if (target.setTransformDirty) {
        target.setTransformDirty();
      }
    }
  }
};

SourceNode.prototype.setReady = function () {
  var i;
  if (!this.ready) {
    this.ready = true;
    this.resize();
    this.initialize();

    this.emit('ready');
    if (this.targets) {
      for (i = 0; i < this.targets.length; i++) {
        this.targets[i].setReady();
      }
    }

  }
};

SourceNode.prototype.render = function () {
  var media = this.source;

  if (!gl || !media && media !== 0 || !this.ready) {
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
      this.plugin.render.call(this, gl, draw, rectangleModel, baseShader)) {

    this.dirty = false;
    this.emit('render');
  }
};

SourceNode.prototype.renderImageCanvas = function () {
  var media = this.source;

  if (!gl || !media || !this.ready) {
    return;
  }

  if (!this.initialized) {
    this.initialize();
  }

  if (!this.allowRefresh) {
    return;
  }

  if (this.dirty) {
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, this.flip);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, media);

      this.dirty = false;
      this.emit('render');
      return true;
    } catch (securityError) {
      if (securityError.code === window.DOMException.SECURITY_ERR) {
        this.allowRefresh = false;
        Seriously.logger.error('Unable to access cross-domain image');
      }
    }

    return false;
  }
};

SourceNode.prototype.destroy = function () {
  var i, key, item;

  if (this.plugin && this.plugin.destroy) {
    this.plugin.destroy.call(this);
  }

  if (gl && this.texture) {
    gl.deleteTexture(this.texture);
  }

  //targets
  while (this.targets.length) {
    item = this.targets.pop();
    if (item && item.removeSource) {
      item.removeSource(this);
    }
  }

  //remove self from master list of sources
  i = sources.indexOf(this);
  if (i >= 0) {
    sources.splice(i, 1);
  }

  i = allSourcesByHook[this.hook].indexOf(this);
  if (i >= 0) {
    allSourcesByHook[this.hook].splice(i, 1);
  }

  for (key in this) {
    if (this.hasOwnProperty(key) && key !== 'id') {
      delete this[key];
    }
  }

  Node.prototype.destroy.call(this);
};
