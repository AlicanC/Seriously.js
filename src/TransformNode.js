const registry = require('./registry.js');
const util = require('./util.js');
const Node = require('./Node.js');
const Transform = require('./Transform.js');

let randomVars;
const TransformNode = module.exports = function TransformNode(arandomVars, hook, options) {
  randomVars = arandomVars;
  var key,
    input,
    initialValue,
    defaultValue,
    defaults;

  this.matrix = new Float32Array(16);
  this.cumulativeMatrix = new Float32Array(16);

  this.ready = false;
  this.width = 1;
  this.height = 1;

  this.seriously = randomVars.seriously;

  this.transformRef = registry.seriousTransforms[hook];
  this.hook = hook;
  this.id = util.nodeId;
  util.nodeId++;

  this.options = options;
  this.sources = null;
  this.targets = [];
  this.inputElements = {};
  this.inputs = {};
  this.methods = {};
  this.listeners = {};

  this.texture = null;
  this.frameBuffer = null;
  this.uniforms = null;

  this.dirty = true;
  this.transformDirty = true;
  this.renderDirty = false;
  this.isDestroyed = false;
  this.transformed = false;

  this.plugin = Object.assign({}, this.transformRef);
  if (this.transformRef.definition) {
    Object.assign(this.plugin, this.transformRef.definition.call(this, options));
  }

  // set up inputs and methods
  for (key in this.plugin.inputs) {
    if (this.plugin.inputs.hasOwnProperty(key)) {
      input = this.plugin.inputs[key];

      if (input.method && typeof input.method === 'function') {
        this.methods[key] = input.method;
      } else if (typeof input.set === 'function' && typeof input.get === 'function') {
        this.inputs[key] = input;
      }
    }
  }
  util.validateInputSpecs(this.plugin);

  // set default value for all inputs (no defaults for methods)
  defaults = randomVars.defaultInputs[hook];
  for (key in this.plugin.inputs) {
    if (this.plugin.inputs.hasOwnProperty(key)) {
      input = this.plugin.inputs[key];

      if (typeof input.set === 'function' && typeof input.get === 'function' &&
          typeof input.method !== 'function') {
        initialValue = input.get.call(this);
        defaultValue = input.defaultValue === undefined ? initialValue : input.defaultValue;
        defaultValue = input.validate.call(this, defaultValue, input, initialValue);
        if (defaults && defaults[key] !== undefined) {
          defaultValue = input.validate
          .call(this, defaults[key], input, input.defaultValue, defaultValue);
          defaults[key] = defaultValue;
        }
        if (defaultValue !== initialValue) {
          input.set.call(this, defaultValue);
        }
      }
    }
  }

  randomVars.nodes.push(this);
  randomVars.nodesById[this.id] = this;

  this.pub = new Transform(this);

  randomVars.transforms.push(this);

  registry.allTransformsByHook[hook].push(this);
};

TransformNode.prototype = Object.create(Node.prototype);
TransformNode.prototype.constructor = TransformNode;

TransformNode.prototype.setDirty = function () {
  this.renderDirty = true;
  Node.prototype.setDirty.call(this);
};

TransformNode.prototype.setTransformDirty = function () {
  var i,
    target;
  this.transformDirty = true;
  this.dirty = true;
  this.renderDirty = true;
  for (i = 0; i < this.targets.length; i++) {
    target = this.targets[i];
    if (target.setTransformDirty) {
      target.setTransformDirty();
    } else {
      target.setDirty();
    }
  }
};

TransformNode.prototype.resize = function () {
  var i;

  Node.prototype.resize.call(this);

  if (this.plugin.resize) {
    this.plugin.resize.call(this);
  }

  for (i = 0; i < this.targets.length; i++) {
    this.targets[i].resize();
  }

  this.setTransformDirty();
};

TransformNode.prototype.setSource = function (source) {
  var newSource;

  //todo: what if source is null/undefined/false

  newSource = findInputNode(source);

  if (newSource === this.source) {
    return;
  }

  if (traceSources(newSource, this)) {
    throw new Error('Attempt to make cyclical connection.');
  }

  if (this.source) {
    this.source.removeTarget(this);
  }
  this.source = newSource;
  newSource.addTarget(this);

  if (newSource && newSource.ready) {
    this.setReady();
  } else {
    this.setUnready();
  }
  this.resize();
};

TransformNode.prototype.addTarget = function (target) {
  var i;
  for (i = 0; i < this.targets.length; i++) {
    if (this.targets[i] === target) {
      return;
    }
  }

  this.targets.push(target);
};

TransformNode.prototype.removeTarget = function (target) {
  var i = this.targets && this.targets.indexOf(target);
  if (i >= 0) {
    this.targets.splice(i, 1);
  }

  if (this.targets && this.targets.length) {
    this.resize();
  }
};

TransformNode.prototype.setInput = function (name, value) {
  var input,
    defaultValue,
    previous;

  if (this.plugin.inputs.hasOwnProperty(name)) {
    input = this.plugin.inputs[name];

    if (randomVars.defaultInputs[this.hook] && randomVars.defaultInputs[this.hook][name] !== undefined) {
      defaultValue = randomVars.defaultInputs[this.hook][name];
    } else {
      defaultValue = input.defaultValue;
    }

    previous = input.get.call(this);
    if (defaultValue === undefined) {
      defaultValue = previous;
    }
    value = input.validate.call(this, value, input, defaultValue, previous);

    if (input.set.call(this, value)) {
      this.setTransformDirty();
    }

    return input.get.call(this);
  }
};

TransformNode.prototype.alias = function (inputName, aliasName) {
  var me = this,
    input,
    def;

  if (reservedNames.indexOf(aliasName) >= 0) {
    throw new Error('\'' + aliasName + '\' is a reserved name and cannot be used as an alias.');
  }

  if (this.plugin.inputs.hasOwnProperty(inputName)) {
    if (!aliasName) {
      aliasName = inputName;
    }

    seriously.removeAlias(aliasName);

    input = this.inputs[inputName];
    if (input) {
      def = me.inputs[inputName];
      Object.defineProperty(seriously, aliasName, {
        configurable: true,
        enumerable: true,
        get: function () {
          return def.get.call(me);
        },
        set: function (val) {
          if (def.set.call(me, val)) {
            me.setTransformDirty();
          }
        }
      });
    } else {
      input = this.methods[inputName];
      if (input) {
        def = input;
        seriously[aliasName] = function () {
          if (def.apply(me, arguments)) {
            me.setTransformDirty();
          }
        };
      }
    }

    if (input) {
      aliases[aliasName] = {
        node: this,
        input: inputName
      };
    }
  }

  return this;
};

TransformNode.prototype.render = function (renderTransform) {
  if (!this.source) {
    if (this.transformDirty) {
      mat4.copy(this.cumulativeMatrix, this.matrix);
      this.transformDirty = false;
    }
    this.texture = null;
    this.dirty = false;

    return;
  }

  this.source.render();

  if (this.transformDirty) {
    if (this.transformed) {
      //use this.matrix
      if (this.source.cumulativeMatrix) {
        mat4.multiply(this.cumulativeMatrix, this.matrix, this.source.cumulativeMatrix);
      } else {
        mat4.copy(this.cumulativeMatrix, this.matrix);
      }
    } else {
      //copy source.cumulativeMatrix
      mat4.copy(this.cumulativeMatrix, this.source.cumulativeMatrix || identity);
    }

    this.transformDirty = false;
  }

  if (renderTransform && gl) {
    if (this.renderDirty) {
      if (!this.frameBuffer) {
        this.uniforms = {
          resolution: [this.width, this.height]
        };
        this.frameBuffer = new FrameBuffer(gl, this.width, this.height);
      }

      this.uniforms.source = this.source.texture;
      this.uniforms.transform = this.cumulativeMatrix || identity;
      draw(baseShader, rectangleModel, this.uniforms, this.frameBuffer.frameBuffer, this);

      this.renderDirty = false;
    }
    this.texture = this.frameBuffer.texture;
  } else if (this.source) {
    this.texture = this.source.texture;
  } else {
    this.texture = null;
  }

  this.dirty = false;

  return this.texture;
};

TransformNode.prototype.readPixels = function (x, y, width, height, dest) {
  var nodeGl = this.gl || gl;

  if (!gl) {
    //todo: is this the best approach?
    throw new Error('Cannot read pixels until a canvas is connected');
  }

  //todo: check on x, y, width, height
  this.render(true);

  if (dest === undefined) {
    dest = new Uint8Array(width * height * 4);
  } else if (!(util.isInstance(dest, 'Uint8Array'))) {
    throw new Error('Incompatible array type');
  }

  nodeGl.bindFramebuffer(gl.FRAMEBUFFER, this.frameBuffer.frameBuffer);
  nodeGl.readPixels(x, y, width, height, gl.RGBA, gl.UNSIGNED_BYTE, dest);

  return dest;
};

TransformNode.prototype.destroy = function () {
  var i, key, item, hook = this.hook;

  //let effect destroy itself
  if (this.plugin.destroy && typeof this.plugin.destroy === 'function') {
    this.plugin.destroy.call(this);
  }
  delete this.effect;

  if (this.frameBuffer) {
    this.frameBuffer.destroy();
    delete this.frameBuffer;
    delete this.texture;
  }

  //stop watching any input elements
  for (i in this.inputElements) {
    if (this.inputElements.hasOwnProperty(i)) {
      item = this.inputElements[i];
      item.element.removeEventListener('change', item.listener, true);
      item.element.removeEventListener('input', item.listener, true);
    }
  }

  //sources
  if (this.source) {
    this.source.removeTarget(this);
  }

  //targets
  while (this.targets.length) {
    item = this.targets.pop();
    if (item && item.removeSource) {
      item.removeSource(this);
    }
  }

  for (key in this) {
    if (this.hasOwnProperty(key) && key !== 'id') {
      delete this[key];
    }
  }

  //remove any aliases
  for (key in aliases) {
    if (aliases.hasOwnProperty(key)) {
      item = aliases[key];
      if (item.node === this) {
        seriously.removeAlias(key);
      }
    }
  }

  //remove self from master list of effects
  i = transforms.indexOf(this);
  if (i >= 0) {
    transforms.splice(i, 1);
  }

  i = allTransformsByHook[hook].indexOf(this);
  if (i >= 0) {
    allTransformsByHook[hook].splice(i, 1);
  }

  Node.prototype.destroy.call(this);
};

TransformNode.prototype.setReady = Node.prototype.setReady;
TransformNode.prototype.setUnready = Node.prototype.setUnready;
TransformNode.prototype.on = Node.prototype.on;
TransformNode.prototype.off = Node.prototype.off;
TransformNode.prototype.emit = Node.prototype.emit;
