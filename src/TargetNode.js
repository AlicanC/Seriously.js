import PluggableNode from './PluggableNode.js';
import Target from './Target.js';
import FrameBuffer from './FrameBuffer.js';
import ShaderProgram from './ShaderProgram.js';
import { isInstance, getWebGlContext, noop, identity, outputRenderOptions } from './utilities.js';
const mat4 = require('./mat4.js');

export default class TargetNode extends PluggableNode {
  constructor(seriously, hook, target, options) {
    super(seriously);

    let matchedType;
    let key;
    const targetPlugin = (hook, target, options, force) => { // eslint-disable-line no-shadow
      let plugin = seriously.Seriously.registry.targets[hook];
      if (plugin.definition) {
        plugin = plugin.definition.call(this, target, options, force);
        if (!plugin) {
          return null;
        }
        plugin = Object.assign({}, seriously.Seriously.registry.targets[hook], plugin);
        this.hook = key;
        matchedType = true;
        this.plugin = plugin;
        this.compare = plugin.compare;
        if (plugin.target) {
          target = plugin.target; // eslint-disable-line no-param-reassign
        }
        if (plugin.gl && !this.gl) {
          this.gl = plugin.gl;
          if (!seriously.gl) {
            seriously.attachContext(plugin.gl);
          }
        }

        if (this.gl === seriously.gl) {
          this.model = seriously.rectangleModel;
          this.shader = seriously.baseShader;
        }
      }

      return plugin;
    };

    /*
    const compareTarget = (target) => {
      return this.target === target;
    }
    */

    if (hook && typeof hook !== 'string' || !target && target !== 0) {
      if (!options || typeof options !== 'object') {
        options = target; // eslint-disable-line no-param-reassign
      }
      target = hook; // eslint-disable-line no-param-reassign
    }

    const opts = options || {};
    const flip = opts.flip === undefined ? true : opts.flip;
    let width = parseInt(opts.width, 10);
    let height = parseInt(opts.height, 10);
    const debugContext = opts.debugContext;

    // forced target type?
    if (typeof hook === 'string' && seriously.Seriously.registry.targets[hook]) {
      targetPlugin(hook, target, opts, true);
    }

    this.renderToTexture = opts.renderToTexture;

    let frameBuffer;
    if (isInstance(target, 'WebGLFramebuffer')) {
      frameBuffer = target;

      if (isInstance(opts, 'HTMLCanvasElement')) {
        target = opts; // eslint-disable-line no-param-reassign
      } else if (isInstance(opts, 'WebGLRenderingContext')) {
        target = opts.canvas; // eslint-disable-line no-param-reassign
      } else if (isInstance(opts.canvas, 'HTMLCanvasElement')) {
        target = opts.canvas; // eslint-disable-line no-param-reassign
      } else if (isInstance(opts.context, 'WebGLRenderingContext')) {
        target = opts.context.canvas; // eslint-disable-line no-param-reassign
      } else {
        // TODO: search all canvases for matching contexts?
        throw new Error('Must provide a canvas with WebGLFramebuffer target');
      }
    }

    let context;
    if (isInstance(target, 'HTMLCanvasElement')) {
      width = target.width;
      height = target.height;

      // try to get a webgl context.
      if (!seriously.gl || seriously.gl.canvas !== target && opts.allowSecondaryWebGL) {
        context = getWebGlContext(target, {
          alpha: true,
          premultipliedAlpha: true,
          preserveDrawingBuffer: true,
          stencil: true,
          debugContext,
        });
      }

      if (!context) {
        if (!opts.allowSecondaryWebGL && seriously.gl && seriously.gl.canvas !== target) {
          throw new Error('Only one WebGL target canvas allowed. Set allowSecondaryWebGL option to create secondary context.'); // eslint-disable-line max-len
        }

        this.render = noop;
        console.log('Unable to create WebGL context.');
        // throw new Error('Unable to create WebGL context.');
      } else if (!seriously.gl || seriously.gl === context) {
        // this is our main WebGL canvas
        if (!seriously.primaryTarget) {
          seriously.primaryTarget = this; // eslint-disable-line no-param-reassign
        }
        if (!seriously.gl) {
          seriously.attachContext(context);
        }
        this.render = this.renderWebGL;

        /*
        Don't remember what this is for. Maybe we should remove it
        */
        if (opts.renderToTexture) {
          if (seriously.gl) {
            this.frameBuffer = new FrameBuffer(seriously.gl, width, height, false);
          }
        } else {
          this.frameBuffer = {
            frameBuffer: frameBuffer || null,
          };
        }
      } else {
        // set up alternative drawing method using ArrayBufferView
        this.gl = context;

        // this.pixels = new Uint8Array(width * height * 4);
        // TODO: probably need another framebuffer for renderToTexture?
        // TODO: handle lost context on secondary webgl
        this.frameBuffer = {
          frameBuffer: frameBuffer || null,
        };
        this.shader = new ShaderProgram(
          this.gl, seriously.baseVertexShader, seriously.baseFragmentShader);
        this.model = seriously.buildRectangleModel.call(this, this.gl);
        this.pixels = null;

        this.texture = this.gl.createTexture();
        this.gl.bindTexture(seriously.gl.TEXTURE_2D, this.texture);
        this.gl.texParameteri(
          seriously.gl.TEXTURE_2D, seriously.gl.TEXTURE_MAG_FILTER, seriously.gl.LINEAR);
        this.gl.texParameteri(
          seriously.gl.TEXTURE_2D, seriously.gl.TEXTURE_MIN_FILTER, seriously.gl.LINEAR);
        this.gl.texParameteri(
          seriously.gl.TEXTURE_2D, seriously.gl.TEXTURE_WRAP_S, seriously.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(
          seriously.gl.TEXTURE_2D, seriously.gl.TEXTURE_WRAP_T, seriously.gl.CLAMP_TO_EDGE);

        this.render = this.renderSecondaryWebGL;
      }

      matchedType = true;
    }

    if (!matchedType) {
      for (key in seriously.Seriously.registry.targets) {
        if (!seriously.Seriously.registry.targets.hasOwnProperty(key)) {
          continue;
        }

        if (seriously.Seriously.registry.targets[key]) {
          if (targetPlugin(key, target, opts, false)) {
            break;
          }
        }
      }
    }

    if (!matchedType) {
      throw new Error('Unknown target type');
    }

    if (seriously.Seriously.registry.allTargets) {
      let targetList = seriously.Seriously.registry.allTargets.get(target);
      if (targetList) {
        console.warn(
          'Target already in use by another instance',
          target,
          Object.keys(targetList).map((key) => targetList[key]) // eslint-disable-line no-shadow
        );
      } else {
        targetList = {};
        seriously.Seriously.registry.allTargets.set(target, targetList);
      }

      targetList[seriously.id] = seriously;
    }

    this.target = target;
    this.transform = null;
    this.transformDirty = true;
    this.flip = flip;
    if (width) {
      this.width = width;
    }
    if (height) {
      this.height = height;
    }

    this.uniforms.resolution[0] = this.width;
    this.uniforms.resolution[1] = this.height;

    if (opts.auto !== undefined) {
      this.auto = opts.auto;
    } else {
      this.auto = seriously.auto;
    }
    this.frames = 0;

    this.pub = new Target(this);

    seriously.nodes.push(this);
    seriously.nodesById[this.id] = this; // eslint-disable-line no-param-reassign
    seriously.targets.push(this);
  }

  setSource(source) {
    // TODO: what if source is null/undefined/false

    const newSource = this.seriously.findInputNode(source);

    // TODO: check for cycles

    if (newSource !== this.source) {
      if (this.source) {
        this.source.removeTarget(this);
      }
      this.source = newSource;
      newSource.addTarget(this);

      if (newSource) {
        this.resize();
        if (newSource.ready) {
          this.setReady();
        } else {
          this.setUnready();
        }
      }

      this.setDirty();
    }
  }

  setDirty() {
    this.dirty = true;

    if (this.auto && !this.seriously.rafId) {
      this.seriously.rafId = requestAnimationFrame(this.seriously.renderDaemon.bind(this.seriously)); // eslint-disable-line max-len
    }
  }

  resize() {
    // if target is a canvas, reset size to canvas size
    if (isInstance(this.target, 'HTMLCanvasElement')) {
      if (this.width !== this.target.width || this.height !== this.target.height) {
        this.target.width = this.width;
        this.target.height = this.height;
        this.uniforms.resolution[0] = this.width;
        this.uniforms.resolution[1] = this.height;
        this.emit('resize');
        this.setTransformDirty();
      }
    } else if (this.plugin && this.plugin.resize) {
      this.plugin.resize.call(this);
    }

    if (this.source &&
      (this.source.width !== this.width || this.source.height !== this.height)) {
      if (!this.transform) {
        this.transform = new Float32Array(16);
      }
    }
  }

  setTransformDirty() {
    this.transformDirty = true;
    this.setDirty();
  }

  go() {
    this.auto = true;
    this.setDirty();
  }

  stop() {
    this.auto = false;
  }

  render() {
    if (this.seriously.gl && this.plugin && this.plugin.render) {
      this.plugin.render.call(this, this.seriously.draw.bind(this.seriously),
        this.seriously.baseShader, this.seriously.rectangleModel);
    }
  }

  renderWebGL() {
    this.resize();

    if (this.seriously.gl && this.dirty && this.ready) {
      if (!this.source) {
        return;
      }

      this.source.render();

      this.uniforms.source = this.source.texture;

      if (this.source.width === this.width && this.source.height === this.height) {
        this.uniforms.transform = this.source.cumulativeMatrix || identity;
      } else if (this.transformDirty) {
        const matrix = this.transform;
        mat4.copy(matrix, this.source.cumulativeMatrix || identity);
        const x = this.source.width / this.width;
        const y = this.source.height / this.height;
        matrix[0] *= x;
        matrix[1] *= x;
        matrix[2] *= x;
        matrix[3] *= x;
        matrix[4] *= y;
        matrix[5] *= y;
        matrix[6] *= y;
        matrix[7] *= y;
        this.uniforms.transform = matrix;
        this.transformDirty = false;
      }

      this.seriously.draw(this.seriously.baseShader, this.seriously.rectangleModel,
        this.uniforms, this.frameBuffer.frameBuffer, this, outputRenderOptions);

      this.emit('render');
      this.dirty = false;
    }
  }

  renderSecondaryWebGL() {
    if (this.dirty && this.ready && this.source) {
      this.emit('render');
      this.source.render(true);

      const sourceWidth = this.source.width;
      const sourceHeight = this.source.height;

      if (!this.pixels || this.pixels.length !== sourceWidth * sourceHeight * 4) {
        this.pixels = new Uint8Array(sourceWidth * sourceHeight * 4);
      }

      this.source.readPixels(0, 0, sourceWidth, sourceHeight, this.pixels);

      this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA,
        sourceWidth, sourceHeight, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, this.pixels);

      if (sourceWidth === this.width && sourceHeight === this.height) {
        this.uniforms.transform = identity;
      } else if (this.transformDirty) {
        const matrix = this.transform;
        mat4.copy(matrix, identity);
        const x = this.source.width / this.width;
        const y = this.source.height / this.height;
        matrix[0] *= x;
        matrix[1] *= x;
        matrix[2] *= x;
        matrix[3] *= x;
        matrix[4] *= y;
        matrix[5] *= y;
        matrix[6] *= y;
        matrix[7] *= y;
        this.uniforms.transform = matrix;
        this.transformDirty = false;
      }

      this.uniforms.source = this.texture;
      this.seriously.draw(this.shader, this.model, this.uniforms, null, this, outputRenderOptions);

      this.dirty = false;
    }
  }

  removeSource(source) {
    if (this.source === source || this.source === source.pub) {
      this.source = null;
    }
  }

  destroy() {
    // source
    if (this.source && this.source.removeTarget) {
      this.source.removeTarget(this);
    }

    if (this.seriously.Seriously.registry.allTargets) {
      const targetList = this.seriously.Seriously.registry.allTargets.get(this.target);
      delete targetList[this.seriously.id];
      if (!Object.keys(targetList).length) {
        this.seriously.Seriously.registry.allTargets.delete(this.target);
      }
    }

    if (this.plugin && this.plugin.destroy) {
      this.plugin.destroy.call(this);
    }

    delete this.source;
    delete this.target;
    delete this.pub;
    delete this.uniforms;
    delete this.pixels;
    delete this.auto;

    // remove self from master list of targets
    const i = this.seriously.Seriously.registry.targets.indexOf(this);
    if (i >= 0) {
      this.seriously.targets.splice(i, 1);
    }

    super.destroy();

    // clear out context so we can start over
    if (this === this.seriously.primaryTarget) {
      this.seriously.glCanvas.removeEventListener('webglcontextrestored',
        this.seriously.eventListeners.webglcontextrestored, false);
      this.seriously.destroyContext();
      this.seriously.primaryTarget = null;
    }
  }

}
