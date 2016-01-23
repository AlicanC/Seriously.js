const util = require('./util.js');
const isInstance = util.isInstance;
const cancelAnimFrame = util.cancelAnimFrame;
const validateInputSpecs = util.validateInputSpecs;
const registry = require('./registry.js');

/*global Float32Array, Uint8Array, Uint16Array, WebGLTexture, HTMLInputElement, HTMLSelectElement, HTMLElement, WebGLFramebuffer, HTMLCanvasElement, WebGLRenderingContext, define, module, exports */

const document = window.document;
const console = window.console;

/*
  Global-ish look-up variables
*/

/*
  Global reference variables
*/

let colorRegex = /^(rgb|hsl)a?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(,\s*(\d+(\.\d*)?)\s*)?\)/i;
let hexColorRegex = /^#(([0-9a-fA-F]{3,8}))/;

let vectorFields = ['x', 'y', 'z', 'w'];
let colorFields = ['r', 'g', 'b', 'a'];

let outputRenderOptions = {
  srcRGB: 0x0302, // SRC_ALPHA
  dstRGB: 0x0303, // ONE_MINUS_SRC_ALPHA
  srcAlpha: 0x01, // ONE
  dstAlpha: 0x0303, // ONE_MINUS_SRC_ALPHA
};

let shaderDebugConstants = [
  'MAX_COMBINED_TEXTURE_IMAGE_UNITS',
  'MAX_FRAGMENT_UNIFORM_VECTORS',
  'MAX_TEXTURE_IMAGE_UNITS',
  'MAX_VARYING_VECTORS',
  'MAX_VERTEX_ATTRIBS',
  'MAX_VERTEX_TEXTURE_IMAGE_UNITS',
  'MAX_VERTEX_UNIFORM_VECTORS',
];

let shaderNameRegex = /^[\t ]*#define[\t ]+SHADER_NAME\s+([^$\n\r]+)/i;

let baseVertexShader;
let baseFragmentShader;

/*
  utility functions
*/

let reservedEffectProperties = [
  'alias',
  'destroy',
  'effect',
  'id',
  'initialize',
  'inputs',
  'isDestroyed',
  'isReady',
  'matte',
  'off',
  'on',
  'readPixels',
  'render',
  'title',
  'update',
];

let reservedTransformProperties = [
  'alias',
  'destroy',
  'id',
  'inputs',
  'isDestroyed',
  'isReady',
  'off',
  'on',
  'source',
  'title',
  'update',
];

let reservedNames = [
  'aliases',
  'defaults',
  'destroy',
  'effect',
  'go',
  'id',
  'incompatible',
  'isDestroyed',
  'isEffect',
  'isNode',
  'isSource',
  'isTarget',
  'isTransform',
  'removeAlias',
  'render',
  'source',
  'stop',
  'target',
  'transform',
];




/*
window.addEventListener('message', function (event) {
  if (event.source === window && event.data === 'seriously-timeout-message') {
    event.stopPropagation();
    if (timeouts.length > 0) {
      var fn = timeouts.shift();
      fn();
    }
  }
}, true);
*/


/*
  helper Classes
*/

const FrameBuffer = require('./FrameBuffer.js');

/* ShaderProgram - utility class for building and accessing WebGL shaders */


const ShaderProgram = require('./ShaderProgram.js');


/*
  main class: Seriously
*/

function Seriously(options) {

  // if called without 'new', make a new object and return that
  if (window === this || !(this instanceof Seriously) || this.id !== undefined) {
    return new Seriously(options);
  }

  //initialize object, private properties
  var id = ++registry.maxSeriouslyId,
    seriously = this,
    nodes = [],
    nodesById = {},
    nodeId = 0,
    sources = [],
    targets = [],
    transforms = [],
    effects = [],
    aliases = {},
    preCallbacks = [],
    postCallbacks = [],
    defaultInputs = {},
    glCanvas,
    gl,
    primaryTarget,
    rectangleModel,
    commonShaders = {},
    baseShader,
    Node, SourceNode, EffectNode, TransformNode, TargetNode,
    Effect, Source, Transform, Target,
    auto = false,
    isDestroyed = false,
    rafId;

  function makeGlModel(shape, gl) {
    var vertex, index, texCoord;

    if (!gl) {
      return false;
    }

    vertex = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertex);
    gl.bufferData(gl.ARRAY_BUFFER, shape.vertices, gl.STATIC_DRAW);
    vertex.size = 3;

    index = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, shape.indices, gl.STATIC_DRAW);

    texCoord = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoord);
    gl.bufferData(gl.ARRAY_BUFFER, shape.coords, gl.STATIC_DRAW);
    texCoord.size = 2;

    return {
      vertex: vertex,
      index: index,
      texCoord: texCoord,
      length: shape.indices.length,
      mode: shape.mode || gl.TRIANGLES
    };
  }

  function buildRectangleModel(gl) {
    var shape = {};

    shape.vertices = new Float32Array([
      -1, -1, 0,
      1, -1, 0,
      1, 1, 0,
      -1, 1, 0
    ]);

    shape.indices = new Uint16Array([
      0, 1, 2,
      0, 2, 3  // Front face
    ]);

    shape.coords = new Float32Array([
      0, 0,
      1, 0,
      1, 1,
      0, 1
    ]);

    return makeGlModel(shape, gl);
  }

  function attachContext(context) {
    var i, node;

    if (gl) {
      return;
    }

    context.canvas.addEventListener('webglcontextlost', destroyContext, false);
    context.canvas.addEventListener('webglcontextrestored', restoreContext, false);

    if (context.isContextLost()) {
      Seriously.logger.warn('Unable to attach lost WebGL context. Will try again when context is restored.');
      return;
    }

    gl = context;
    glCanvas = context.canvas;

    rectangleModel = buildRectangleModel(gl);

    baseShader = new ShaderProgram(
      gl,
      '#define SHADER_NAME seriously.base\n' + baseVertexShader, '#define SHADER_NAME seriously.base\n' + baseFragmentShader
    );

    for (i = 0; i < effects.length; i++) {
      node = effects[i];
      node.gl = gl;
      node.initialize();
      node.buildShader();
    }

    for (i = 0; i < sources.length; i++) {
      node = sources[i];
      node.initialize();
    }

    for (i = 0; i < targets.length; i++) {
      node = targets[i];

      if (!node.model) {
        node.model = rectangleModel;
        node.shader = baseShader;
      }

      //todo: initialize frame buffer if not main canvas
    }
  }

  function restoreContext() {
    var context,
      target,
      i,
      node;

    if (primaryTarget && !gl) {
      target = primaryTarget.target;

      //todo: if too many webglcontextlost events fired in too short a time, abort
      //todo: consider allowing "manual" control of restoring context

      if (isInstance(target, 'WebGLFramebuffer')) {
        Seriously.logger.error('Unable to restore target built on WebGLFramebuffer');
        return;
      }

      context = getWebGlContext(target, {
        alpha: true,
        premultipliedAlpha: true,
        preserveDrawingBuffer: true,
        stencil: true,
        debugContext: primaryTarget.debugContext
      });

      if (context) {
        if (context.isContextLost()) {
          Seriously.logger.error('Unable to restore WebGL Context');
          return;
        }

        attachContext(context);

        if (primaryTarget.renderToTexture) {
          primaryTarget.frameBuffer = new FrameBuffer(gl, primaryTarget.width, primaryTarget.height, false);
        } else {
          primaryTarget.frameBuffer = {
            frameBuffer: null
          };
        }

        /*
        Set all nodes dirty. In most cases, it should only be necessary
        to set sources dirty, but we want to make sure unattached nodes are covered

        This should get renderDaemon running again if necessary.
        */
        for (i = 0; i < nodes.length; i++) {
          node = nodes[i];
          node.setDirty();
          node.emit('webglcontextrestored');
        }

        Seriously.logger.log('WebGL context restored');
      }
    }
  }

  function destroyContext(event) {
    // either webglcontextlost or primary target node has been destroyed
    var i, node;

    /*
    todo: once multiple shared webgl resources are supported,
    see if we can switch context to another existing one and
    rebuild immediately
    */

    if (event) {
      Seriously.logger.warn('WebGL context lost');
      /*
      todo: if too many webglcontextlost events fired in too short a time,
      don't preventDefault
      */
      event.preventDefault();
    }

    //don't draw anymore until context is restored
    if (rafId) {
      cancelAnimFrame(rafId);
      rafId = 0;
    }

    if (glCanvas) {
      glCanvas.removeEventListener('webglcontextlost', destroyContext, false);
    }

    for (i = 0; i < effects.length; i++) {
      node = effects[i];
      node.gl = null;
      node.initialized = false;
      node.baseShader = null;
      node.model = null;
      node.frameBuffer = null;
      node.texture = null;
      if (node.shader && node.shader.destroy) {
        node.shader.destroy();
        if (node.effect.commonShader) {
          delete commonShaders[node.hook];
        }
      }
      node.shaderDirty = true;
      node.shader = null;
      if (node.effect.lostContext) {
        node.effect.lostContext.call(node);
      }

      /*
      todo: do we need to set nodes to uready?
      if so, make sure nodes never get set to ready unless gl exists
      and make sure to set ready again when context is restored
      */

      if (event) {
        node.emit('webglcontextlost');
      }
    }

    for (i = 0; i < sources.length; i++) {
      node = sources[i];
      //node.setUnready();
      node.texture = null;
      node.initialized = false;
      node.allowRefresh = false;
      if (event) {
        node.emit('webglcontextlost');
      }
    }

    for (i = 0; i < transforms.length; i++) {
      node = transforms[i];
      node.frameBuffer = null;
      node.texture = null;
      if (event) {
        node.emit('webglcontextlost');
      }
    }

    for (i = 0; i < targets.length; i++) {
      node = targets[i];
      node.model = false;
      node.frameBuffer = null;
      //texture?
      if (event) {
        node.emit('webglcontextlost');
      }
    }

    if (baseShader && baseShader.destroy) {
      baseShader.destroy();
    }

    //clean up rectangleModel
    if (gl) {
      gl.deleteBuffer(rectangleModel.vertex);
      gl.deleteBuffer(rectangleModel.texCoord);
      gl.deleteBuffer(rectangleModel.index);
    }

    if (rectangleModel) {
      delete rectangleModel.vertex;
      delete rectangleModel.texCoord;
      delete rectangleModel.index;
    }

    rectangleModel = null;
    baseShader = null;
    gl = null;
    glCanvas = null;
  }

  /*
  runs on every frame, as long as there are media sources (img, video, canvas, etc.) to check,
  dirty target nodes or pre/post callbacks to run. any sources that are updated are set to dirty,
  forcing all dependent nodes to render
  */
  function renderDaemon(now) {
    var i, node,
      keepRunning = false;

    rafId = 0;

    if (preCallbacks.length) {
      keepRunning = true;
      for (i = 0; i < preCallbacks.length; i++) {
        preCallbacks[i].call(seriously, now);
      }
    }

    if (sources && sources.length) {
      keepRunning = true;
      for (i = 0; i < sources.length; i++) {
        node = sources[i];

        if (node.dirty ||
            node.checkDirty && node.checkDirty()) {
          node.dirty = false;
          node.setDirty();
        }
      }
    }

    for (i = 0; i < targets.length; i++) {
      node = targets[i];
      if (node.auto && node.dirty) {
        node.render();
      }
    }

    if (postCallbacks.length) {
      keepRunning = true;
      for (i = 0; i < postCallbacks.length; i++) {
        postCallbacks[i].call(seriously);
      }
    }

    //rafId may have been set again by a callback or in target.setDirty()
    if (keepRunning && !rafId) {
      rafId = requestAnimationFrame(renderDaemon);
    }
  }

  function draw(shader, model, uniforms, frameBuffer, node, options) {
    var numTextures = 0,
      name, value, shaderUniform,
      width, height,
      nodeGl = (node && node.gl) || gl,
      srcRGB, srcAlpha,
      dstRGB, dstAlpha;

    if (!nodeGl) {
      return;
    }

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

    /* todo: do this all only once at the beginning, since we only have one model? */
    nodeGl.enableVertexAttribArray(shader.location.position);
    nodeGl.enableVertexAttribArray(shader.location.texCoord);

    if (model.texCoord) {
      nodeGl.bindBuffer(nodeGl.ARRAY_BUFFER, model.texCoord);
      nodeGl.vertexAttribPointer(shader.location.texCoord, model.texCoord.size, nodeGl.FLOAT, false, 0, 0);
    }

    nodeGl.bindBuffer(nodeGl.ARRAY_BUFFER, model.vertex);
    nodeGl.vertexAttribPointer(shader.location.position, model.vertex.size, nodeGl.FLOAT, false, 0, 0);

    nodeGl.bindBuffer(nodeGl.ELEMENT_ARRAY_BUFFER, model.index);

    //default for depth is disable
    if (options && options.depth) {
      gl.enable(gl.DEPTH_TEST);
    } else {
      gl.disable(gl.DEPTH_TEST);
    }

    //default for blend is enabled
    if (!options) {
      gl.enable(gl.BLEND);
      gl.blendFunc(
        gl.ONE,
        gl.ZERO
      );
      gl.blendEquation(gl.FUNC_ADD);
    } else if (options.blend === undefined || options.blend) {
      gl.enable(gl.BLEND);

      srcRGB = options.srcRGB === undefined ? gl.ONE : options.srcRGB;
      dstRGB = options.dstRGB || gl.ZERO;
      srcAlpha = options.srcAlpha === undefined ? srcRGB : options.srcAlpha;
      dstAlpha = options.dstAlpha === undefined ? dstRGB : options.dstAlpha;

      gl.blendFuncSeparate(srcRGB, dstRGB, srcAlpha, dstAlpha);
      gl.blendEquation(options.blendEquation || gl.FUNC_ADD);
    } else {
      gl.disable(gl.BLEND);
    }

    /* set uniforms to current values */
    for (name in uniforms) {
      if (uniforms.hasOwnProperty(name)) {
        value = uniforms[name];
        shaderUniform = shader.uniforms[name];
        if (shaderUniform) {
          if (isInstance(value, 'WebGLTexture')) {
            nodeGl.activeTexture(nodeGl.TEXTURE0 + numTextures);
            nodeGl.bindTexture(nodeGl.TEXTURE_2D, value);
            shaderUniform.set(numTextures);
            numTextures++;
          } else if (value instanceof SourceNode ||
              value instanceof EffectNode ||
              value instanceof TransformNode) {
            if (value.texture) {
              nodeGl.activeTexture(nodeGl.TEXTURE0 + numTextures);
              nodeGl.bindTexture(nodeGl.TEXTURE_2D, value.texture);
              shaderUniform.set(numTextures);
              numTextures++;
            }
          } else if(value !== undefined && value !== null) {
            shaderUniform.set(value);
          }
        }
      }
    }

    //default for clear is true
    if (!options || options.clear === undefined || options.clear) {
      nodeGl.clearColor(0.0, 0.0, 0.0, 0.0);
      nodeGl.clear(nodeGl.COLOR_BUFFER_BIT | nodeGl.DEPTH_BUFFER_BIT);
    }

    // draw!
    nodeGl.drawElements(model.mode, model.length, nodeGl.UNSIGNED_SHORT, 0);

    //to protect other 3D libraries that may not remember to turn their depth tests on
    gl.enable(gl.DEPTH_TEST);
  }

  function findInputNode(hook, source, options) {
    console.log('fin', hook, source, options);
    var node, i;

    if (typeof hook !== 'string' || !source && source !== 0) {
      if (!options || typeof options !== 'object') {
        options = source;
      }
      source = hook;
      console.log('got source');
    }

    if (typeof hook !== 'string' || !registry.seriousSources[hook]) {
      hook = null;
    }

    if (source instanceof SourceNode ||
        source instanceof EffectNode ||
        source instanceof TransformNode) {
      node = source;
    } else if (source instanceof Effect ||
        source instanceof Source ||
        source instanceof Transform) {
      node = nodesById[source.id];

      if (!node) {
        throw new Error('Cannot connect a foreign node');
      }
    } else {
      if (typeof source === 'string' && isNaN(source)) {
        source = getElement(source, ['canvas', 'img', 'video']);
      }

      for (i = 0; i < sources.length; i++) {
        node = sources[i];
        if ((!hook || hook === node.hook) && node.compare && node.compare(source, options)) {
          return node;
        }
      }

      node = new SourceNode(randomVars, hook, source, options);
    }

    return node;
  }

  //trace back all sources to make sure we're not making a cyclical connection
  function traceSources(node, original) {
    var i,
      source,
      nodeSources;

    if (!(node instanceof EffectNode) && !(node instanceof TransformNode)) {
      return false;
    }

    if (node === original) {
      return true;
    }

    nodeSources = node.sources;

    for (i in nodeSources) {
      if (nodeSources.hasOwnProperty(i)) {
        source = nodeSources[i];

        if (source === original || traceSources(source, original)) {
          return true;
        }
      }
    }

    return false;
  }

  Node = require('./Node.js');

  Effect = require('./Effect.js');

  EffectNode = require('./EffectNode.js');

  Source = require('./Source.js');

  /*
    possible sources: img, video, canvas (2d or 3d), texture, ImageData, array, typed array
  */
  SourceNode = require('./SourceNode.js');

  //todo: implement render for array and typed array

  Target = require('./Target.js');

  /*
    possible targets: canvas (2d or 3d), gl render buffer (must be same canvas)
  */
  TargetNode = require('./TargetNode.js');

  Transform = require('./Transform.js');

  TransformNode = require('./TransformNode.js');

  /*
  Initialize Seriously object based on options
  */

  if (isInstance(options, 'HTMLCanvasElement')) {
    options = {
      canvas: options
    };
  } else {
    options = options || {};
  }

  if (options.canvas) {
  }

  const randomVars = {
    funcs: {
      makeGlModel,
      buildRectangleModel,
      attachContext,
      restoreContext,
      destroyContext,
      renderDaemon,
      draw,
      findInputNode,
      traceSources,
    },

    colorRegex,
    hexColorRegex,
    vectorFields,
    colorFields,
    outputRenderOptions,
    shaderDebugConstants,
    shaderNameRegex,

    baseVertexShader,
    baseFragmentShader,

    seriously,
    nodes,
    nodesById,
    nodeId,
    sources,
    targets,
    transforms,
    effects,
    aliases,
    preCallbacks,
    postCallbacks,
    defaultInputs,
    glCanvas,
    gl,
    primaryTarget,
    rectangleModel,
    commonShaders,
    baseShader,
    Node,
    SourceNode,
    EffectNode,
    TransformNode,
    TargetNode,
    Effect,
    Source,
    Transform,
    Target,
    auto,
    isDestroyed,
    rafId,
  };

  /*
  priveleged methods
  */
  this.effect = function (hook, options) {
    if (!registry.seriousEffects[hook]) {
      throw new Error('Unknown effect: ' + hook);
    }

    var effectNode = new EffectNode(randomVars, hook, options);
    return effectNode.pub;
  };

  this.source = function (hook, source, options) {
    var sourceNode = findInputNode(hook, source, options);
    return sourceNode.pub;
  };

  this.transform = function (hook, opts) {
    var transformNode;

    if (typeof hook !== 'string') {
      opts = hook;
      hook = false;
    }

    if (hook) {
      if (!registry.seriousTransforms[hook]) {
        throw new Error('Unknown transform: ' + hook);
      }
    } else {
      hook = options && options.defaultTransform || '2d';
      if (!registry.seriousTransforms[hook]) {
        throw new Error('No transform specified');
      }
    }

    transformNode = new TransformNode(randomVars, hook, opts);
    return transformNode.pub;
  };

  this.target = function (hook, target, options) {
    var targetNode,
      element,
      i;

    if (hook && typeof hook === 'string' && !seriousTargets[hook]) {
      element = document.querySelector(hook);
    }

    if (typeof hook !== 'string' || !target && target !== 0 || element) {
      if (!options || typeof options !== 'object') {
        options = target;
      }
      target = element || hook;
      hook = null;
    }

    if (typeof target === 'string' && isNaN(target)) {
      target = document.querySelector(target);
    }

    for (i = 0; i < targets.length; i++) {
      targetNode = targets[i];
      if ((!hook || hook === targetNode.hook) &&
          (targetNode.target === target || targetNode.compare && targetNode.compare(target, options))) {

        return targetNode.pub;
      }
    }

    targetNode = new TargetNode(randomVars, hook, target, options);

    return targetNode.pub;
  };

  this.aliases = function () {
    return Object.keys(aliases);
  };

  this.removeAlias = function (name) {
    if (aliases[name]) {
      delete this[name];
      delete aliases[name];
    }
  };

  this.defaults = function (hook, options) {
    var key;

    if (!hook) {
      if (hook === null) {
        for (key in defaultInputs) {
          if (defaultInputs.hasOwnProperty(key)) {
            delete defaultInputs[key];
          }
        }
      }
      return;
    }

    if (typeof hook === 'object') {
      for (key in hook) {
        if (hook.hasOwnProperty(key)) {
          this.defaults(key, hook[key]);
        }
      }

      return;
    }

    if (options === null) {
      delete defaultInputs[hook];
    } else if (typeof options === 'object') {
      defaultInputs[hook] = Object.assign({}, options);
    }
  };

  this.go = function (pre, post) {
    var i;

    if (typeof pre === 'function' && preCallbacks.indexOf(pre) < 0) {
      preCallbacks.push(pre);
    }

    if (typeof post === 'function' && postCallbacks.indexOf(post) < 0) {
      postCallbacks.push(post);
    }

    auto = true;
    for (i = 0; i < targets.length; i++) {
      targets[i].go();
    }

    if (!rafId && (preCallbacks.length || postCallbacks.length)) {
      renderDaemon();
    }
  };

  this.stop = function () {
    preCallbacks.length = 0;
    postCallbacks.length = 0;
    cancelAnimFrame(rafId);
    rafId = 0;
  };

  this.render = function () {
    var i;
    for (i = 0; i < targets.length; i++) {
      targets[i].render(options);
    }
  };

  this.destroy = function () {
    var i,
      node,
      descriptor;

    while (nodes.length) {
      node = nodes[0];
      node.pub.destroy();
    }

    for (i in this) {
      if (this.hasOwnProperty(i) && i !== 'isDestroyed' && i !== 'id') {
        descriptor = Object.getOwnPropertyDescriptor(this, i);
        if (descriptor.get || descriptor.set ||
            typeof this[i] !== 'function') {
          delete this[i];
        } else {
          this[i] = nop;
        }
      }
    }

    seriously = null;

    //todo: do we really need to allocate new arrays here?
    sources = [];
    targets = [];
    effects = [];
    nodes = [];

    preCallbacks.length = 0;
    postCallbacks.length = 0;
    cancelAnimFrame(rafId);
    rafId = 0;

    isDestroyed = true;
  };

  this.isDestroyed = function () {
    return isDestroyed;
  };

  this.incompatible = function (hook) {
    var key,
      plugin,
      failure = false;

    failure = Seriously.incompatible(hook);

    if (failure) {
      return failure;
    }

    if (!hook) {
      for (key in registry.allEffectsByHook) {
        if (registry.allEffectsByHook.hasOwnProperty(key) && registry.allEffectsByHook[key].length) {
          plugin = registry.seriousEffects[key];
          if (plugin && typeof plugin.compatible === 'function' &&
              !plugin.compatible.call(this)) {
            return 'plugin-' + key;
          }
        }
      }

      for (key in registry.allSourcesByHook) {
        if (registry.allSourcesByHook.hasOwnProperty(key) && registry.allSourcesByHook[key].length) {
          plugin = registry.seriousSources[key];
          if (plugin && typeof plugin.compatible === 'function' &&
              !plugin.compatible.call(this)) {
            return 'source-' + key;
          }
        }
      }
    }

    return false;
  };

  /*
  Informational utility methods
  */

  this.isNode = function (candidate) {
    var node;
    if (candidate) {
      node = nodesById[candidate.id];
      if (node && !node.isDestroyed) {
        return true;
      }
    }
    return false;
  };

  this.isSource = function (candidate) {
    return this.isNode(candidate) && candidate instanceof Source;
  };

  this.isEffect = function (candidate) {
    return this.isNode(candidate) && candidate instanceof Effect;
  };

  this.isTransform = function (candidate) {
    return this.isNode(candidate) && candidate instanceof Transform;
  };

  this.isTarget = function (candidate) {
    return this.isNode(candidate) && candidate instanceof Target;
  };

  Object.defineProperties(this, {
    id: {
      enumerable: true,
      configurable: true,
      get: function () {
        return id;
      }
    }
  });

  //todo: load, save, find

  this.defaults(options.defaults);
}

Seriously.incompatible = function (hook) {
  var canvas, gl, plugin;

  if (incompatibility === undefined) {
    canvas = document.createElement('canvas');
    if (!canvas || !canvas.getContext) {
      incompatibility = 'canvas';
    } else if (!window.WebGLRenderingContext) {
      incompatibility = 'webgl';
    } else {
      gl = getTestContext();
      if (!gl) {
        incompatibility = 'context';
      }
    }
  }

  if (incompatibility) {
    return incompatibility;
  }

  if (hook) {
    plugin = registry.seriousEffects[hook];
    if (plugin && typeof plugin.compatible === 'function' &&
      !plugin.compatible(gl)) {

      return 'plugin-' + hook;
    }

    plugin = registry.seriousSources[hook];
    if (plugin && typeof plugin.compatible === 'function' &&
      !plugin.compatible(gl)) {

      return 'source-' + hook;
    }
  }

  return false;
};

Seriously.plugin = function (hook, definition, meta) {
  var effect;

  if (registry.seriousEffects[hook]) {
    Seriously.logger.warn('Effect [' + hook + '] already loaded');
    return;
  }

  if (meta === undefined && typeof definition === 'object') {
    meta = definition;
  }

  if (!meta) {
    return;
  }

  effect = Object.assign({}, meta);

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

  registry.seriousEffects[hook] = effect;
  registry.allEffectsByHook[hook] = [];

  return effect;
};

Seriously.removePlugin = function (hook) {
  var all, effect, plugin;

  if (!hook) {
    return this;
  }

  plugin = registry.seriousEffects[hook];

  if (!plugin) {
    return this;
  }

  all = registry.allEffectsByHook[hook];
  if (all) {
    while (all.length) {
      effect = all.shift();
      effect.destroy();
    }
    delete registry.allEffectsByHook[hook];
  }

  delete registry.seriousEffects[hook];

  return this;
};

Seriously.source = function (hook, definition, meta) {
  var source;

  if (registry.seriousSources[hook]) {
    Seriously.logger.warn('Source [' + hook + '] already loaded');
    return;
  }

  if (meta === undefined && typeof definition === 'object') {
    meta = definition;
  }

  if (!meta && !definition) {
    return;
  }

  source = Object.assign({}, meta);

  if (typeof definition === 'function') {
    source.definition = definition;
  }

  if (!source.title) {
    source.title = hook;
  }


  registry.seriousSources[hook] = source;
  registry.allSourcesByHook[hook] = [];

  return source;
};

Seriously.removeSource = function (hook) {
  var all, source, plugin;

  if (!hook) {
    return this;
  }

  plugin = registry.seriousSources[hook];

  if (!plugin) {
    return this;
  }

  all = registry.allSourcesByHook[hook];
  if (all) {
    while (all.length) {
      source = all.shift();
      source.destroy();
    }
    delete registry.allSourcesByHook[hook];
  }

  delete registry.seriousSources[hook];

  return this;
};

Seriously.transform = function (hook, definition, meta) {
  var transform;

  if (registry.seriousTransforms[hook]) {
    Seriously.logger.warn('Transform [' + hook + '] already loaded');
    return;
  }

  if (meta === undefined && typeof definition === 'object') {
    meta = definition;
  }

  if (!meta && !definition) {
    return;
  }

  transform = Object.assign({}, meta);

  if (typeof definition === 'function') {
    transform.definition = definition;
  }

  transform.reserved = reservedTransformProperties;

  //todo: validate method definitions
  if (transform.inputs) {
    validateInputSpecs(transform);
  }

  if (!transform.title) {
    transform.title = hook;
  }

  registry.seriousTransforms[hook] = transform;
  registry.allTransformsByHook[hook] = [];

  return transform;
};

Seriously.removeTransform = function (hook) {
  var all, transform, plugin;

  if (!hook) {
    return this;
  }

  plugin = registry.seriousTransforms[hook];

  if (!plugin) {
    return this;
  }

  all = registry.allTransformsByHook[hook];
  if (all) {
    while (all.length) {
      transform = all.shift();
      transform.destroy();
    }
    delete registry.allTransformsByHook[hook];
  }

  delete registry.seriousTransforms[hook];

  return this;
};

Seriously.target = function (hook, definition, meta) {
  var target;

  if (seriousTargets[hook]) {
    Seriously.logger.warn('Target [' + hook + '] already loaded');
    return;
  }

  if (meta === undefined && typeof definition === 'object') {
    meta = definition;
  }

  if (!meta && !definition) {
    return;
  }

  target = Object.assign({}, meta);

  if (typeof definition === 'function') {
    target.definition = definition;
  }

  if (!target.title) {
    target.title = hook;
  }


  seriousTargets[hook] = target;
  allTargetsByHook[hook] = [];

  return target;
};

Seriously.removeTarget = function (hook) {
  var all, target, plugin;

  if (!hook) {
    return this;
  }

  plugin = seriousTargets[hook];

  if (!plugin) {
    return this;
  }

  all = allTargetsByHook[hook];
  if (all) {
    while (all.length) {
      target = all.shift();
      target.destroy();
    }
    delete allTargetsByHook[hook];
  }

  delete seriousTargets[hook];

  return this;
};

//todo: validators should not allocate new objects/arrays if input is valid
Seriously.inputValidators = require('./inputValidators.js');

Seriously.prototype.effects = Seriously.effects = function () {
  var name,
    effect,
    manifest,
    effects = {},
    input,
    i;

  for (name in registry.seriousEffects) {
    if (registry.seriousEffects.hasOwnProperty(name)) {
      effect = registry.seriousEffects[name];
      manifest = {
        title: effect.title || name,
        description: effect.description || '',
        inputs: {}
      };

      for (i in effect.inputs) {
        if (effect.inputs.hasOwnProperty(i)) {
          input = effect.inputs[i];
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
            options: input.options || []
          };
        }
      }

      effects[name] = manifest;
    }
  }

  return effects;
};

//check for plugins loaded out of order
if (window.Seriously) {
  if (typeof window.Seriously === 'object') {
    (function () {
      var i;
      for (i in window.Seriously) {
        if (window.Seriously.hasOwnProperty(i) &&
          i !== 'plugin' &&
          typeof window.Seriously[i] === 'object') {

          Seriously.plugin(i, window.Seriously[i]);
        }
      }
    }());
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

baseVertexShader = require('./shaders/baseVertex.glsl');

baseFragmentShader = require('./shaders/baseFragment.glsl');

module.exports = Seriously;

// UGLY!
const effects = ['polar', 'tvglitch', 'temperature', 'ripple', 'brightness-contrast', 'channels', 'hue-saturation', 'noise', 'sepia', 'vibrance', 'vignette', 'filmgrain', 'exposure'];

const blur = require(`./effects/blur/blur.js`);
if (blur.definition) {
  Seriously.plugin(blur.hook, blur.definition, blur.meta);
} else {
  Seriously.plugin(blur.hook, blur.meta);
}


for (const effectName of effects) {
  const effect = require(`./effects/${effectName}.js`);
  if (effect.definition) {
    Seriously.plugin(effect.hook, effect.definition, effect.meta);
  } else {
    Seriously.plugin(effect.hook, effect.meta);
  }
}
