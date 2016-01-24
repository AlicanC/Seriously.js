import PluggableNode from './PluggableNode.js';
import Transform from './Transform.js';
import FrameBuffer from './FrameBuffer.js';
import { isInstance, validateInputSpecs, reservedNames, identity } from './utilities.js';
const mat4 = require('./mat4.js');

export default class TransformNode extends PluggableNode {
  constructor(seriously, hook, options) {
    super(seriously);

    this.matrix = new Float32Array(16);
    this.cumulativeMatrix = new Float32Array(16);

    this.ready = false;
    this.width = 1;
    this.height = 1;

    this.transformRef = seriously.Seriously.registry.transforms[hook];
    this.hook = hook;

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
    for (const key in this.plugin.inputs) {
      if (!this.plugin.inputs.hasOwnProperty(key)) {
        continue;
      }
      const input = this.plugin.inputs[key];

      if (input.method && typeof input.method === 'function') {
        this.methods[key] = input.method;
      } else if (typeof input.set === 'function' && typeof input.get === 'function') {
        this.inputs[key] = input;
      }
    }

    validateInputSpecs(this.plugin);

    // set default value for all inputs (no defaults for methods)
    const defaults = seriously.defaultInputs[hook];
    for (const key in this.plugin.inputs) {
      if (!this.plugin.inputs.hasOwnProperty(key)) {
        continue;
      }

      const input = this.plugin.inputs[key];

      if (typeof input.set === 'function' && typeof input.get === 'function' &&
          typeof input.method !== 'function') {
        const initialValue = input.get.call(this);
        let defaultValue = input.defaultValue === undefined ? initialValue : input.defaultValue;
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

    seriously.nodes.push(this);
    seriously.nodesById[this.id] = this; // eslint-disable-line no-param-reassign

    this.pub = new Transform(this);

    seriously.transforms.push(this);

    seriously.Seriously.registry.allTransformsByHook[hook].push(this);
  }

  setDirty() {
    this.renderDirty = true;
    super.setDirty();
  }

  setTransformDirty() {
    this.transformDirty = true;
    this.dirty = true;
    this.renderDirty = true;
    for (const target of this.targets) {
      if (target.setTransformDirty) {
        target.setTransformDirty();
      } else {
        target.setDirty();
      }
    }
  }

  resize() {
    super.resize();

    if (this.plugin.resize) {
      this.plugin.resize.call(this);
    }

    for (const target of this.targets) {
      target.resize();
    }

    this.setTransformDirty();
  }

  setSource(source) {
    // TODO: what if source is null/undefined/false

    const newSource = this.seriously.findInputNode(source);

    if (newSource === this.source) {
      return;
    }

    if (this.seriously.traceSources(newSource, this)) {
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

    if (this.targets && this.targets.length) {
      this.resize();
    }
  }

  setInput(name, value) {
    if (!this.plugin.inputs.hasOwnProperty(name)) {
      return undefined;
    }

    const input = this.plugin.inputs[name];

    let defaultValue;
    if (this.seriously.defaultInputs[this.hook]
      && this.seriously.defaultInputs[this.hook][name] !== undefined) {
      defaultValue = this.seriously.defaultInputs[this.hook][name];
    } else {
      defaultValue = input.defaultValue;
    }

    const previous = input.get.call(this);
    if (defaultValue === undefined) {
      defaultValue = previous;
    }
    value = input.validate.call(this, value, input, defaultValue, previous); // eslint-disable-line no-param-reassign, max-len

    if (input.set.call(this, value)) {
      this.setTransformDirty();
    }

    return input.get.call(this);
  }

  alias(inputName, aliasName) {
    if (reservedNames.indexOf(aliasName) >= 0) {
      throw new Error(`'${aliasName}' is a reserved name and cannot be used as an alias.`);
    }

    if (this.plugin.inputs.hasOwnProperty(inputName)) {
      if (!aliasName) {
        aliasName = inputName; // eslint-disable-line no-param-reassign
      }

      this.seriously.removeAlias(aliasName);

      let input = this.inputs[inputName];
      if (input) {
        const def = this.inputs[inputName];
        Object.defineProperty(this.seriously, aliasName, {
          configurable: true,
          enumerable: true,
          get: () => def.get.call(this),
          set: (val) => {
            if (def.set.call(this, val)) {
              this.setTransformDirty();
            }
          },
        });
      } else {
        input = this.methods[inputName];
        if (input) {
          const def = input;
          this.seriously[aliasName] = () => {
            if (def.apply(this, arguments)) {
              this.setTransformDirty();
            }
          };
        }
      }

      if (input) {
        this.seriously.aliases[aliasName] = {
          node: this,
          input: inputName,
        };
      }
    }

    return this;
  }

  render(renderTransform) {
    if (!this.source) {
      if (this.transformDirty) {
        mat4.copy(this.cumulativeMatrix, this.matrix);
        this.transformDirty = false;
      }
      this.texture = null;
      this.dirty = false;

      return undefined;
    }

    this.source.render();

    if (this.transformDirty) {
      if (this.transformed) {
        // use this.matrix
        if (this.source.cumulativeMatrix) {
          mat4.multiply(this.cumulativeMatrix, this.matrix, this.source.cumulativeMatrix);
        } else {
          mat4.copy(this.cumulativeMatrix, this.matrix);
        }
      } else {
        // copy source.cumulativeMatrix
        mat4.copy(this.cumulativeMatrix, this.source.cumulativeMatrix || identity);
      }

      this.transformDirty = false;
    }

    if (renderTransform && this.seriously.gl) {
      if (this.renderDirty) {
        if (!this.frameBuffer) {
          this.uniforms = {
            resolution: [this.width, this.height],
          };
          this.frameBuffer = new FrameBuffer(this.seriously.gl, this.width, this.height);
        }

        this.uniforms.source = this.source.texture;
        this.uniforms.transform = this.cumulativeMatrix || identity;
        this.seriously.draw(this.seriously.baseShader, this.seriously.rectangleModel,
          this.uniforms, this.frameBuffer.frameBuffer, this);

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
  }

  readPixels(x, y, width, height, dest) {
    const nodeGl = this.gl || this.seriously.gl;

    if (!this.seriously.gl) {
      // TODO: is this the best approach?
      throw new Error('Cannot read pixels until a canvas is connected');
    }

    // TODO: check on x, y, width, height
    this.render(true);

    if (dest === undefined) {
      dest = new Uint8Array(width * height * 4);
    } else if (!(isInstance(dest, 'Uint8Array'))) {
      throw new Error('Incompatible array type');
    }

    nodeGl.bindFramebuffer(this.seriously.gl.FRAMEBUFFER, this.frameBuffer.frameBuffer);
    nodeGl.readPixels(x, y, width, height,
      this.seriously.gl.RGBA, this.seriously.gl.UNSIGNED_BYTE, dest);

    return dest;
  }

  destroy() {
    const hook = this.hook;

    // let effect destroy itself
    if (this.plugin.destroy && typeof this.plugin.destroy === 'function') {
      this.plugin.destroy.call(this);
    }
    delete this.effect;

    if (this.frameBuffer) {
      this.frameBuffer.destroy();
      delete this.frameBuffer;
      delete this.texture;
    }

    // stop watching any input elements
    for (const i in this.inputElements) {
      if (this.inputElements.hasOwnProperty(i)) {
        const item = this.inputElements[i];
        item.element.removeEventListener('change', item.listener, true);
        item.element.removeEventListener('input', item.listener, true);
      }
    }

    // sources
    if (this.source) {
      this.source.removeTarget(this);
    }

    // targets
    while (this.targets.length) {
      const item = this.targets.pop();
      if (item && item.removeSource) {
        item.removeSource(this);
      }
    }

    for (const key in this) {
      if (this.hasOwnProperty(key) && key !== 'id') {
        delete this[key];
      }
    }

    // remove any aliases
    for (const key in this.seriously.aliases) {
      if (this.seriously.aliases.hasOwnProperty(key)) {
        continue;
      }

      const item = this.seriously.aliases[key];
      if (item.node === this) {
        this.seriously.removeAlias(key);
      }
    }

    // remove self from master list of effects
    let i = this.seriously.transforms.indexOf(this);
    if (i >= 0) {
      this.seriously.transforms.splice(i, 1);
    }

    i = this.seriously.Seriously.registry.allTransformsByHook[hook].indexOf(this);
    if (i >= 0) {
      this.seriously.Seriously.registry.allTransformsByHook[hook].splice(i, 1);
    }

    super.destroy();
  }
}
