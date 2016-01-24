import FrameBuffer from './FrameBuffer.js';
import ShaderProgram from './ShaderProgram.js';

import SourceNode from './SourceNode.js';
import EffectNode from './EffectNode.js';
import TransformNode from './TransformNode.js';
import TargetNode from './TargetNode.js';

import Effect from './Effect.js';
import Source from './Source.js';
import Transform from './Transform.js';
import Target from './Target.js';

import {
  buildRectangleModel,
  baseVertexShader,
  baseFragmentShader,
  isInstance,
  getWebGlContext,
  getElement,
  noop,
  reservedEffectProperties,
  reservedTransformProperties,
  validateInputSpecs,
  getTestContext,
  checkSource,
  hslToRgb,
  colorNames,
  setTimeoutZero,
} from './utilities.js';

let maxSeriouslyId = 0;
export default class Seriously {
  static registry = {
    sources: {},
    effects: {},
    transforms: {},
    targets: {},
    allEffectsByHook: {},
    allSourcesByHook: {
      canvas: [],
      image: [],
      video: [],
    },
    allTransformsByHook: {},
    allTargetsByHook: {},
    allTargets: new WeakMap(),
  };

  static util = {
    mat4: require('./mat4.js'),
    checkSource,
    hslToRgb,
    colors: colorNames,
    setTimeoutZero,
    ShaderProgram,
    FrameBuffer,
    requestAnimationFrame,
    shader: {
      makeNoise: require('./shaders/makeNoise.glsl'),
      random: require('./shaders/makeNoise.glsl'),
    },
  };

  static incompatibility;
  static incompatible(hook) {
    // var canvas, gl, plugin;

    if (Seriously.incompatibility) {
      return Seriously.incompatibility;
    }

    const canvas = document.createElement('canvas');
    if (!canvas || !canvas.getContext) {
      Seriously.incompatibility = 'canvas';
      return Seriously.incompatibility;
    }

    if (!window.WebGLRenderingContext) {
      Seriously.incompatibility = 'webgl';
      return Seriously.incompatibility;
    }

    const gl = getTestContext();
    if (!gl) {
      Seriously.incompatibility = 'context';
      return Seriously.incompatibility;
    }

    if (hook) {
      let plugin = Seriously.registry.effects[hook];
      if (plugin && typeof plugin.compatible === 'function' &&
        !plugin.compatible(gl)) {
        return `plugin-${hook}`;
      }

      plugin = Seriously.registry.sources[hook];
      if (plugin && typeof plugin.compatible === 'function' &&
        !plugin.compatible(gl)) {
        return `source-${hook}`;
      }
    }

    return false;
  }

  static plugin(hook, definition, meta) {
    // var effect;

    if (Seriously.registry.effects[hook]) {
      console.warn(`Effect [${hook}] already loaded`);
      return undefined;
    }

    if (meta === undefined && typeof definition === 'object') {
      meta = definition; // eslint-disable-line no-param-reassign
    }

    if (!meta) {
      return undefined;
    }

    const effect = Object.assign({}, meta);

    if (typeof definition === 'function') {
      effect.definition = definition;
    }

    effect.reserved = reservedEffectProperties;

    if (effect.inputs) {
      validateInputSpecs(effect);
    }

    if (!effect.title) {
      effect.title = hook;
    }

    /*
    if (typeof effect.requires !== 'function') {
      effect.requires = false;
    }
    */

    Seriously.registry.effects[hook] = effect;
    Seriously.registry.allEffectsByHook[hook] = [];

    return effect;
  }

  static removePlugin(hook) {
    if (!hook) {
      return this;
    }

    const plugin = Seriously.registry.effects[hook];

    if (!plugin) {
      return this;
    }

    const all = Seriously.registry.allEffectsByHook[hook];
    if (all) {
      while (all.length) {
        const effect = all.shift();
        effect.destroy();
      }
      delete Seriously.registry.allEffectsByHook[hook];
    }

    delete Seriously.registry.effects[hook];

    return this;
  }

  static source(hook, definition, meta) {
    if (Seriously.registry.sources[hook]) {
      console.warn(`Source [${hook}] already loaded`);
      return undefined;
    }

    if (meta === undefined && typeof definition === 'object') {
      meta = definition; // eslint-disable-line no-param-reassign
    }

    if (!meta && !definition) {
      return undefined;
    }

    const source = Object.assign({}, meta);

    if (typeof definition === 'function') {
      source.definition = definition;
    }

    if (!source.title) {
      source.title = hook;
    }

    Seriously.registry.sources[hook] = source;
    Seriously.registry.allSourcesByHook[hook] = [];

    return source;
  }

  static removeSource(hook) {
    if (!hook) {
      return this;
    }

    const plugin = Seriously.registry.sources[hook];

    if (!plugin) {
      return this;
    }

    const all = Seriously.registry.allSourcesByHook[hook];
    if (all) {
      while (all.length) {
        const source = all.shift();
        source.destroy();
      }
      delete Seriously.registry.allSourcesByHook[hook];
    }

    delete Seriously.registry.sources[hook];

    return this;
  }

  static transform(hook, definition, meta) {
    if (Seriously.registry.transforms[hook]) {
      console.warn(`Transform [${hook}] already loaded`);
      return undefined;
    }

    if (meta === undefined && typeof definition === 'object') {
      meta = definition; // eslint-disable-line no-param-reassign
    }

    if (!meta && !definition) {
      return undefined;
    }

    const transform = Object.assign({}, meta);

    if (typeof definition === 'function') {
      transform.definition = definition;
    }

    transform.reserved = reservedTransformProperties;

    // TODO: validate method definitions
    if (transform.inputs) {
      validateInputSpecs(transform);
    }

    if (!transform.title) {
      transform.title = hook;
    }

    Seriously.registry.transforms[hook] = transform;
    Seriously.registry.allTransformsByHook[hook] = [];

    return transform;
  }

  static removeTransform(hook) {
    if (!hook) {
      return this;
    }

    const plugin = Seriously.registry.transforms[hook];

    if (!plugin) {
      return this;
    }

    const all = Seriously.registry.allTransformsByHook[hook];
    if (all) {
      while (all.length) {
        const transform = all.shift();
        transform.destroy();
      }
      delete Seriously.registry.allTransformsByHook[hook];
    }

    delete Seriously.registry.transforms[hook];

    return this;
  }

  static target(hook, definition, meta) {
    if (Seriously.registry.targets[hook]) {
      console.warn(`Target [${hook}] already loaded`);
      return undefined;
    }

    if (meta === undefined && typeof definition === 'object') {
      meta = definition; // eslint-disable-line no-param-reassign
    }

    if (!meta && !definition) {
      return undefined;
    }

    const target = Object.assign({}, meta);

    if (typeof definition === 'function') {
      target.definition = definition;
    }

    if (!target.title) {
      target.title = hook;
    }

    Seriously.registry.targets[hook] = target;
    Seriously.registry.allTargetsByHook[hook] = [];

    return target;
  }

  static removeTarget(hook) {
    if (!hook) {
      return this;
    }

    const plugin = Seriously.registry.targets[hook];

    if (!plugin) {
      return this;
    }

    const all = Seriously.registry.allTargetsByHook[hook];
    if (all) {
      while (all.length) {
        const target = all.shift();
        target.destroy();
      }
      delete Seriously.registry.allTargetsByHook[hook];
    }

    delete Seriously.registry.targets[hook];

    return this;
  }

  effects = Seriously.effects; // Instance method alias
  static effects() {
    const effects = {};
    for (const name in Seriously.registry.effects) {
      if (!Seriously.registry.effects.hasOwnProperty(name)) {
        continue;
      }

      const effect = Seriously.registry.effects[name];
      const manifest = {
        title: effect.title || name,
        description: effect.description || '',
        inputs: {},
      };

      for (const i in effect.inputs) {
        if (!effect.inputs.hasOwnProperty(i)) {
          continue;
        }

        const input = effect.inputs[i];
        manifest.inputs[i] = {
          type: input.type,
          defaultValue: input.defaultValue,
          step: input.step,
          min: input.min,
          max: input.max,
          mod: input.mod,
          minCount: input.minCount,
          maxCount: input.maxCount,
          dimensions: input.dimensions,
          title: input.title || i,
          description: input.description || '',
          options: input.options || [],
        };
      }

      effects[name] = manifest;
    }

    return effects;
  }

  constructor(options) {
    this.Seriously = Seriously;

    const id = ++maxSeriouslyId;

    Object.defineProperties(this, {
      id: {
        enumerable: true,
        configurable: true,
        get: () => id,
      },
    });

    // Check options
    if (isInstance(options, 'HTMLCanvasElement')) {
      this.options = {
        canvas: options,
      };
    } else {
      this.options = options || {};
    }

    if (this.options.canvas) {
      // TODO: ???
    }

    // Nodes
    this.nodes = [];
    this.nodesById = {};
    this.nodeId = 0;

    // Pluggables
    this.sources = [];
    this.targets = [];
    this.transforms = [];
    this.effects = [];

    this.commonShaders = {};

    this.aliases = {};
    this.preCallbacks = [];
    this.postCallbacks = [];
    this.defaultInputs = {};
    this.glCanvas = undefined;
    this.gl = undefined;
    this.primaryTarget = undefined;
    this.rectangleModel = undefined;
    this.baseShader = undefined;
    this.auto = false;
    this._isDestroyed = false;
    this.rafId = undefined;

    this.defaults(this.options.defaults);

    // ADDITION
    this.eventListeners = {};
  }

  /*
    Node getters
  */
  effect(hook, options) {
    if (!Seriously.registry.effects[hook]) {
      throw new Error(`Unknown effect: ${hook}`);
    }

    const effectNode = new EffectNode(this, hook, options);
    return effectNode.pub;
  }

  source(hook, source, options) {
    const sourceNode = this.findInputNode(hook, source, options);
    return sourceNode.pub;
  }

  transform(hook, opts) {
    if (typeof hook !== 'string') {
      opts = hook; // eslint-disable-line no-param-reassign
      hook = false; // eslint-disable-line no-param-reassign
    }

    if (hook) {
      if (!Seriously.registry.transforms[hook]) {
        throw new Error(`Unknown transform: ${hook}`);
      }
    } else {
      hook = this.options && this.options.defaultTransform || '2d'; // eslint-disable-line no-param-reassign, max-len
      if (!Seriously.registry.transforms[hook]) {
        throw new Error('No transform specified');
      }
    }

    const transformNode = new TransformNode(this, hook, opts);
    return transformNode.pub;
  }

  target(hook, target, options) {
    let element;
    if (hook && typeof hook === 'string' && !Seriously.registry.targets[hook]) {
      element = document.querySelector(hook);
    }

    if (typeof hook !== 'string' || !target && target !== 0 || element) {
      if (!options || typeof options !== 'object') {
        options = target; // eslint-disable-line no-param-reassign
      }
      target = element || hook; // eslint-disable-line no-param-reassign
      hook = null; // eslint-disable-line no-param-reassign
    }

    if (typeof target === 'string' && isNaN(target)) {
      target = document.querySelector(target); // eslint-disable-line no-param-reassign
    }

    for (const targetNode of this.targets) {
      if ((!hook || hook === targetNode.hook) &&
          (targetNode.target === target || targetNode.compare
            && targetNode.compare(target, options))) {
        return targetNode.pub;
      }
    }

    const targetNode = new TargetNode(this, hook, target, options);

    return targetNode.pub;
  }

  /*
    Stuff
  */

  aliases() {
    return Object.keys(this.aliases);
  }

  removeAlias(name) {
    if (this.aliases[name]) {
      delete this[name];
      delete this.aliases[name];
    }
  }

  defaults(hook, options) {
    if (!hook) {
      if (hook === null) {
        for (const key in this.defaultInputs) {
          if (this.defaultInputs.hasOwnProperty(key)) {
            delete this.defaultInputs[key];
          }
        }
      }
      return;
    }

    if (typeof hook === 'object') {
      for (const key in hook) {
        if (hook.hasOwnProperty(key)) {
          this.defaults(key, hook[key]);
        }
      }

      return;
    }

    if (options === null) {
      delete this.defaultInputs[hook];
    } else if (typeof options === 'object') {
      this.defaultInputs[hook] = Object.assign({}, options);
    }
  }

  go(pre, post) {
    if (typeof pre === 'function' && this.preCallbacks.indexOf(pre) < 0) {
      this.preCallbacks.push(pre);
    }

    if (typeof post === 'function' && this.postCallbacks.indexOf(post) < 0) {
      this.postCallbacks.push(post);
    }

    this.auto = true;
    for (const target of this.targets) {
      target.go();
    }

    if (!this.rafId && (this.preCallbacks.length || this.postCallbacks.length)) {
      this.renderDaemon();
    }
  }

  stop() {
    this.preCallbacks.length = 0;
    this.postCallbacks.length = 0;
    cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }

  render() {
    for (const target of this.targets) {
      target.render(this.options);
    }
  }

  destroy() {
    while (this.nodes.length) {
      const node = this.nodes[0];
      node.pub.destroy();
    }

    for (const i in this) {
      if (!this.hasOwnProperty(i)) {
        continue;
      }

      if (i === 'isDestroyed' || i === '_isDestroyed' || i === 'id') {
        continue;
      }

      const descriptor = Object.getOwnPropertyDescriptor(this, i);
      if (descriptor.get || descriptor.set || typeof this[i] !== 'function') {
        delete this[i];
      } else {
        this[i] = noop;
      }
    }

    // TODO: do we really need to allocate new arrays here?
    this.sources = [];
    this.targets = [];
    this.effects = [];
    this.nodes = [];

    this.preCallbacks.length = 0;
    this.postCallbacks.length = 0;
    cancelAnimationFrame(this.rafId);
    this.rafId = 0;

    this._isDestroyed = true;
  }

  isDestroyed() {
    return this._isDestroyed;
  }

  incompatible(hook) {
    const failure = Seriously.incompatible(hook);

    if (failure) {
      return failure;
    }

    if (!hook) {
      for (const key in Seriously.registry.allEffectsByHook) {
        if (!Seriously.registry.allEffectsByHook.hasOwnProperty(key)) {
          continue;
        }

        if (!Seriously.registry.allEffectsByHook[key].length) {
          continue;
        }

        const plugin = Seriously.registry.effects[key];
        if (plugin && typeof plugin.compatible === 'function' &&
            !plugin.compatible.call(this)) {
          return `plugin-${key}`;
        }
      }

      for (const key in Seriously.registry.allSourcesByHook) {
        if (!Seriously.registry.allSourcesByHook.hasOwnProperty(key)) {
          continue;
        }

        if (!Seriously.registry.allSourcesByHook[key].length) {
          continue;
        }

        const plugin = Seriously.registry.sources[key];
        if (plugin && typeof plugin.compatible === 'function' &&
            !plugin.compatible.call(this)) {
          return `source-${key}`;
        }
      }
    }

    return false;
  }

  /*
    Informational utility methods
  */

  isNode(candidate) {
    if (!candidate) {
      return false;
    }

    const node = this.nodesById[candidate.id];
    return (node && !node.isDestroyed);
  }

  isSource(candidate) {
    return this.isNode(candidate) && candidate instanceof Source;
  }

  isEffect(candidate) {
    return this.isNode(candidate) && candidate instanceof Effect;
  }

  isTransform(candidate) {
    return this.isNode(candidate) && candidate instanceof Transform;
  }

  isTarget(candidate) {
    return this.isNode(candidate) && candidate instanceof Target;
  }

  /*
    Helpers
  */
  attachContext(context) {
    if (this.gl) {
      return;
    }

    this.eventListeners.webglcontextlost = this.destroyContext.bind(this);
    context.canvas.addEventListener(
      'webglcontextlost',
      this.eventListeners.webglcontextlost,
      false
    );

    this.eventListeners.webglcontextrestored = this.restoreContext.bind(this);
    context.canvas.addEventListener(
      'webglcontextrestored',
      this.eventListeners.webglcontextrestored,
      false
    );

    if (context.isContextLost()) {
      console.warn('Unable to attach lost WebGL context. Will try again when context is restored.');
      return;
    }

    this.gl = context;
    this.glCanvas = context.canvas;

    this.rectangleModel = buildRectangleModel(this.gl);

    const vertexShaderSource = `#define SHADER_NAME seriously.base\n${baseVertexShader}`;
    const fragmentShaderSource = `#define SHADER_NAME seriously.base\n${baseFragmentShader}`;

    this.baseShader = new ShaderProgram(
      this.gl,
      vertexShaderSource,
      fragmentShaderSource
    );

    // Initialize effects
    for (const effect of this.effects) {
      effect.gl = this.gl;
      effect.initialize();
      effect.buildShader();
    }

    // Initialize sources
    for (const source of this.sources) {
      source.initialize();
    }

    // Initialize targets
    for (const target of this.targets) {
      if (!target.model) {
        continue;
      }

      target.model = this.rectangleModel;
      target.shader = this.baseShader;

      // TODO: initialize frame buffer if not main canvas
    }
  }

  restoreContext() {
    if (!this.primaryTarget || this.gl) {
      return;
    }

    const target = this.primaryTarget.target;

    // TODO: if too many webglcontextlost events fired in too short a time, abort
    // TODO: consider allowing "manual" control of restoring context

    if (isInstance(target, 'WebGLFramebuffer')) {
      console.error('Unable to restore target built on WebGLFramebuffer');
      return;
    }

    const context = getWebGlContext(target, {
      alpha: true,
      premultipliedAlpha: true,
      preserveDrawingBuffer: true,
      stencil: true,
      debugContext: this.primaryTarget.debugContext,
    });

    if (!context) {
      return;
    }

    if (context.isContextLost()) {
      console.error('Unable to restore WebGL Context');
      return;
    }

    this.attachContext(context);

    if (this.primaryTarget.renderToTexture) {
      this.primaryTarget.frameBuffer = new FrameBuffer(
        this.gl,
        this.primaryTarget.width,
        this.primaryTarget.height,
        false
      );
    } else {
      this.primaryTarget.frameBuffer = {
        frameBuffer: null,
      };
    }

    /*
    Set all nodes dirty. In most cases, it should only be necessary
    to set sources dirty, but we want to make sure unattached nodes are covered

    This should get renderDaemon running again if necessary.
    */
    for (const node of this.nodes) {
      node.setDirty();
      node.emit('webglcontextrestored');
    }

    console.log('WebGL context restored');
  }

  destroyContext(event) {
    // either webglcontextlost or primary target node has been destroyed

    /*
    TODO: once multiple shared webgl resources are supported,
    see if we can switch context to another existing one and
    rebuild immediately
    */

    if (event) {
      console.warn('WebGL context lost');
      /*
      TODO: if too many webglcontextlost events fired in too short a time,
      don't preventDefault
      */
      event.preventDefault();
    }

    // don't draw anymore until context is restored
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }

    if (this.glCanvas) {
      this.glCanvas.removeEventListener(
        'webglcontextlost',
        this.eventListeners.webglcontextlost,
        false
      );
    }

    for (const effect of this.effects) {
      effect.gl = null;
      effect.initialized = false;
      effect.baseShader = null;
      effect.model = null;
      effect.frameBuffer = null;
      effect.texture = null;

      if (effect.shader && effect.shader.destroy) {
        effect.shader.destroy();
        if (effect.effect.commonShader) {
          delete this.commonShaders[effect.hook];
        }
      }

      effect.shaderDirty = true;
      effect.shader = null;
      if (effect.effect.lostContext) {
        effect.effect.lostContext.call(effect);
      }

      /*
      TODO: do we need to set nodes to uready?
      if so, make sure nodes never get set to ready unless gl exists
      and make sure to set ready again when context is restored
      */

      if (event) {
        effect.emit('webglcontextlost');
      }
    }

    for (const source of this.sources) {
      // source.setUnready();
      source.texture = null;
      source.initialized = false;
      source.allowRefresh = false;

      if (event) {
        source.emit('webglcontextlost');
      }
    }

    for (const transform of this.transforms) {
      transform.frameBuffer = null;
      transform.texture = null;

      if (event) {
        transform.emit('webglcontextlost');
      }
    }

    for (const target of this.targets) {
      target.model = false;
      target.frameBuffer = null;

      // texture?
      if (event) {
        target.emit('webglcontextlost');
      }
    }

    if (this.baseShader && this.baseShader.destroy) {
      this.baseShader.destroy();
    }

    // clean up rectangleModel
    if (this.gl) {
      this.gl.deleteBuffer(this.rectangleModel.vertex);
      this.gl.deleteBuffer(this.rectangleModel.texCoord);
      this.gl.deleteBuffer(this.rectangleModel.index);
    }

    if (this.rectangleModel) {
      delete this.rectangleModel.vertex;
      delete this.rectangleModel.texCoord;
      delete this.rectangleModel.index;
    }

    this.rectangleModel = null;
    this.baseShader = null;
    this.gl = null;
    this.glCanvas = null;
  }

  renderDaemon(now) {
    let keepRunning = false;

    this.rafId = 0;

    if (this.preCallbacks.length) {
      keepRunning = true;
      for (const preCallback of this.preCallbacks) {
        preCallback.call(this, now);
      }
    }

    if (this.sources && this.sources.length) {
      keepRunning = true;
      for (const source in this.sources) {
        if (source.dirty || source.checkDirty && source.checkDirty()) {
          source.dirty = false;
          source.setDirty();
        }
      }
    }

    for (const target of this.targets) {
      if (target.auto && target.dirty) {
        target.render();
      }
    }

    if (this.postCallbacks.length) {
      keepRunning = true;
      for (const postCallback of this.postCallbacks) {
        postCallback.call(this);
      }
    }

    // rafId may have been set again by a callback or in target.setDirty()
    if (keepRunning && !this.rafId) {
      this.rafId = requestAnimationFrame(this.renderDaemon.bind(this));
    }
  }

  draw(shader, model, uniforms, frameBuffer, node, options) {
    let numTextures = 0;

    const nodeGl = (node && node.gl) || this.gl;
    if (!nodeGl) {
      return;
    }

    let width;
    let height;
    if (node) {
      width = options && options.width || node.width || nodeGl.canvas.width;
      height = options && options.height || node.height || nodeGl.canvas.height;
    } else {
      width = options && options.width || nodeGl.canvas.width;
      height = options && options.height || nodeGl.canvas.height;
    }

    shader.use();

    nodeGl.viewport(0, 0, width, height);

    nodeGl.bindFramebuffer(nodeGl.FRAMEBUFFER, frameBuffer);

    // TODO: do this all only once at the beginning, since we only have one model?
    nodeGl.enableVertexAttribArray(shader.location.position);
    nodeGl.enableVertexAttribArray(shader.location.texCoord);

    if (model.texCoord) {
      nodeGl.bindBuffer(nodeGl.ARRAY_BUFFER, model.texCoord);
      nodeGl.vertexAttribPointer(
        shader.location.texCoord, model.texCoord.size, nodeGl.FLOAT, false, 0, 0
      );
    }

    nodeGl.bindBuffer(nodeGl.ARRAY_BUFFER, model.vertex);
    nodeGl.vertexAttribPointer(
      shader.location.position, model.vertex.size, nodeGl.FLOAT, false, 0, 0
    );

    nodeGl.bindBuffer(nodeGl.ELEMENT_ARRAY_BUFFER, model.index);

    // default for depth is disable
    if (options && options.depth) {
      this.gl.enable(this.gl.DEPTH_TEST);
    } else {
      this.gl.disable(this.gl.DEPTH_TEST);
    }

    // default for blend is enabled
    if (!options) {
      this.gl.enable(this.gl.BLEND);
      this.gl.blendFunc(
        this.gl.ONE,
        this.gl.ZERO
      );
      this.gl.blendEquation(this.gl.FUNC_ADD);
    } else if (options.blend === undefined || options.blend) {
      this.gl.enable(this.gl.BLEND);

      const srcRGB = options.srcRGB === undefined ? this.gl.ONE : options.srcRGB;
      const dstRGB = options.dstRGB || this.gl.ZERO;
      const srcAlpha = options.srcAlpha === undefined ? srcRGB : options.srcAlpha;
      const dstAlpha = options.dstAlpha === undefined ? dstRGB : options.dstAlpha;

      this.gl.blendFuncSeparate(srcRGB, dstRGB, srcAlpha, dstAlpha);
      this.gl.blendEquation(options.blendEquation || this.gl.FUNC_ADD);
    } else {
      this.gl.disable(this.gl.BLEND);
    }

    // set uniforms to current values
    for (const uniformName in uniforms) {
      if (!uniforms.hasOwnProperty(uniformName)) {
        continue;
      }

      const shaderUniform = shader.uniforms[uniformName];
      if (!shaderUniform) {
        continue;
      }

      const uniform = uniforms[uniformName];

      if (isInstance(uniform, 'WebGLTexture')) {
        nodeGl.activeTexture(nodeGl.TEXTURE0 + numTextures);
        nodeGl.bindTexture(nodeGl.TEXTURE_2D, uniform);
        shaderUniform.set(numTextures);
        numTextures++;
      } else if (uniform instanceof SourceNode ||
          uniform instanceof EffectNode ||
          uniform instanceof TransformNode) {
        if (uniform.texture) {
          nodeGl.activeTexture(nodeGl.TEXTURE0 + numTextures);
          nodeGl.bindTexture(nodeGl.TEXTURE_2D, uniform.texture);
          shaderUniform.set(numTextures);
          numTextures++;
        }
      } else if (uniform !== undefined && uniform !== null) {
        shaderUniform.set(uniform);
      }
    }

    // default for clear is true
    if (!options || options.clear === undefined || options.clear) {
      nodeGl.clearColor(0.0, 0.0, 0.0, 0.0);
      nodeGl.clear(nodeGl.COLOR_BUFFER_BIT | nodeGl.DEPTH_BUFFER_BIT);
    }

    // draw!
    nodeGl.drawElements(model.mode, model.length, nodeGl.UNSIGNED_SHORT, 0);

    // to protect other 3D libraries that may not remember to turn their depth tests on
    this.gl.enable(this.gl.DEPTH_TEST);
  }

  findInputNode(hook, source, options) {
    if (typeof hook !== 'string' || !source && source !== 0) {
      if (!options || typeof options !== 'object') {
        options = source; // eslint-disable-line no-param-reassign
      }
      source = hook; // eslint-disable-line no-param-reassign
    }

    if (typeof hook !== 'string' || !Seriously.registry.sources[hook]) {
      hook = null; // eslint-disable-line no-param-reassign
    }

    let node;
    if (source instanceof SourceNode ||
        source instanceof EffectNode ||
        source instanceof TransformNode) {
      node = source;
    } else if (source instanceof Effect ||
        source instanceof Source ||
        source instanceof Transform) {
      node = this.nodesById[source.id];

      if (!node) {
        throw new Error('Cannot connect a foreign node');
      }
    } else {
      if (typeof source === 'string' && isNaN(source)) {
        source = getElement(source, ['canvas', 'img', 'video']); // eslint-disable-line no-param-reassign, max-len
      }

      for (const anotherSource of this.sources) {
        if ((!hook || hook === anotherSource.hook)
          && anotherSource.compare && anotherSource.compare(source, options)) {
          return anotherSource;
        }
      }

      node = new SourceNode(this, hook, source, options);
    }

    return node;
  }

  // trace back all sources to make sure we're not making a cyclical connection
  traceSources(node, original) {
    if (!(node instanceof EffectNode) && !(node instanceof TransformNode)) {
      return false;
    }

    if (node === original) {
      return true;
    }

    const nodeSources = node.sources;

    for (const i in nodeSources) {
      if (!nodeSources.hasOwnProperty(i)) {
        continue;
      }

      const source = nodeSources[i];

      if (source === original || this.traceSources(source, original)) {
        return true;
      }
    }

    return false;
  }
}

/*

*/

import Video from './plugables/sources/video.js';
Video.plug(Seriously);

/*
Default transform - 2D
Affine transforms
- translate
- rotate (degrees)
- scale
- skew

todo: move this to a different file when we have a build tool
*/
import TwoD from './plugables/transforms/2d.js';
TwoD.plug(Seriously);

/*
todo: move this to a different file when we have a build tool
*/
import Flip from './plugables/transforms/flip.js';
Flip.plug(Seriously);

/*
Reformat
todo: move this to a different file when we have a build tool
*/
import Reformat from './plugables/transforms/reformat.js';
Reformat.plug(Seriously);

/*
todo: additional transform node types
- perspective
- matrix
*/

module.exports = Seriously;

// UGLY!
const effects = ['polar', 'temperature', 'ripple',
  'brightness-contrast', 'channels', 'hue-saturation', 'noise',
  'sepia', 'vibrance', 'vignette', 'filmgrain', 'exposure'];

const blur = require('./plugables/effects/blur/blur.js');
if (blur.definition) {
  Seriously.plugin(blur.hook, blur.definition, blur.meta);
} else {
  Seriously.plugin(blur.hook, blur.meta);
}


for (const effectName of effects) {
  const effect = require(`./plugables/effects/${effectName}.js`);
  if (effect.definition) {
    Seriously.plugin(effect.hook, effect.definition, effect.meta);
  } else {
    Seriously.plugin(effect.hook, effect.meta);
  }
}
