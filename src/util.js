const inputValidators = require('./inputValidators.js');

/*
mat4 matrix functions borrowed from gl-matrix by toji
https://github.com/toji/gl-matrix
License: https://github.com/toji/gl-matrix/blob/master/LICENSE.md
*/

const mat4 = {
  /*
   * mat4.frustum
   * Generates a frustum matrix with the given bounds
   *
   * Params:
   * left, right - scalar, left and right bounds of the frustum
   * bottom, top - scalar, bottom and top bounds of the frustum
   * near, far - scalar, near and far bounds of the frustum
   * dest - Optional, mat4 frustum matrix will be written into
   *
   * Returns:
   * dest if specified, a new mat4 otherwise
   */
  frustum: function frustum(left, right, bottom, top, near, far, dest) {
    if(!dest) { dest = mat4.create(); }
    var rl = (right - left),
      tb = (top - bottom),
      fn = (far - near);
    dest[0] = (near*2) / rl;
    dest[1] = 0;
    dest[2] = 0;
    dest[3] = 0;
    dest[4] = 0;
    dest[5] = (near*2) / tb;
    dest[6] = 0;
    dest[7] = 0;
    dest[8] = (right + left) / rl;
    dest[9] = (top + bottom) / tb;
    dest[10] = -(far + near) / fn;
    dest[11] = -1;
    dest[12] = 0;
    dest[13] = 0;
    dest[14] = -(far*near*2) / fn;
    dest[15] = 0;
    return dest;
  },

  perspective: function (fovy, aspect, near, far, dest) {
    var top = near*Math.tan(fovy*Math.PI / 360.0),
      right = top*aspect;
    return mat4.frustum(-right, right, -top, top, near, far, dest);
  },
  multiply: function (dest, mat, mat2) {
    // Cache the matrix values (makes for huge speed increases!)
    var a00 = mat[0], a01 = mat[1], a02 = mat[2], a03 = mat[3],
      a10 = mat[4], a11 = mat[5], a12 = mat[6], a13 = mat[7],
      a20 = mat[8], a21 = mat[9], a22 = mat[10], a23 = mat[11],
      a30 = mat[12], a31 = mat[13], a32 = mat[14], a33 = mat[15],

    // Cache only the current line of the second matrix
    b0 = mat2[0], b1 = mat2[1], b2 = mat2[2], b3 = mat2[3];
    dest[0] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
    dest[1] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
    dest[2] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
    dest[3] = b0*a03 + b1*a13 + b2*a23 + b3*a33;

    b0 = mat2[4];
    b1 = mat2[5];
    b2 = mat2[6];
    b3 = mat2[7];
    dest[4] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
    dest[5] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
    dest[6] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
    dest[7] = b0*a03 + b1*a13 + b2*a23 + b3*a33;

    b0 = mat2[8];
    b1 = mat2[9];
    b2 = mat2[10];
    b3 = mat2[11];
    dest[8] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
    dest[9] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
    dest[10] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
    dest[11] = b0*a03 + b1*a13 + b2*a23 + b3*a33;

    b0 = mat2[12];
    b1 = mat2[13];
    b2 = mat2[14];
    b3 = mat2[15];
    dest[12] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
    dest[13] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
    dest[14] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
    dest[15] = b0*a03 + b1*a13 + b2*a23 + b3*a33;

    return dest;
  },
  identity: function (dest) {
    dest[0] = 1;
    dest[1] = 0;
    dest[2] = 0;
    dest[3] = 0;
    dest[4] = 0;
    dest[5] = 1;
    dest[6] = 0;
    dest[7] = 0;
    dest[8] = 0;
    dest[9] = 0;
    dest[10] = 1;
    dest[11] = 0;
    dest[12] = 0;
    dest[13] = 0;
    dest[14] = 0;
    dest[15] = 1;
    return dest;
  },
  copy: function (out, a) {
    out[0] = a[0];
    out[1] = a[1];
    out[2] = a[2];
    out[3] = a[3];
    out[4] = a[4];
    out[5] = a[5];
    out[6] = a[6];
    out[7] = a[7];
    out[8] = a[8];
    out[9] = a[9];
    out[10] = a[10];
    out[11] = a[11];
    out[12] = a[12];
    out[13] = a[13];
    out[14] = a[14];
    out[15] = a[15];
    return out;
  }
};

function checkSource(source) {
  var element, canvas, ctx, texture;

  //todo: don't need to create a new array every time we do this
  element = getElement(source, ['img', 'canvas', 'video']);
  if (!element) {
    return false;
  }

  canvas = document.createElement('canvas');
  if (!canvas) {
    logger.warn('Browser does not support canvas or Seriously.js');
    return false;
  }

  if (element.naturalWidth === 0 && element.tagName === 'IMG') {
    logger.warn('Image not loaded');
    return false;
  }

  if (element.readyState === 0 && element.videoWidth === 0 && element.tagName === 'VIDEO') {
    logger.warn('Video not loaded');
    return false;
  }

  ctx = getTestContext();
  if (ctx) {
    texture = ctx.createTexture();
    if (!texture) {
      logger.error('Test WebGL context has been lost');
    }

    ctx.bindTexture(ctx.TEXTURE_2D, texture);

    try {
      ctx.texImage2D(ctx.TEXTURE_2D, 0, ctx.RGBA, ctx.RGBA, ctx.UNSIGNED_BYTE, element);
    } catch (textureError) {
      if (textureError.code === window.DOMException.SECURITY_ERR) {
        logger.log('Unable to access cross-domain image');
      } else {
        logger.error('Error storing image to texture: ' + textureError.message);
      }
      ctx.deleteTexture(texture);
      return false;
    }
    ctx.deleteTexture(texture);
  } else {
    ctx = canvas.getContext('2d');
    try {
      ctx.drawImage(element, 0, 0);
      ctx.getImageData(0, 0, 1, 1);
    } catch (drawImageError) {
      if (drawImageError.code === window.DOMException.SECURITY_ERR) {
        logger.log('Unable to access cross-domain image');
      } else {
        logger.error('Error drawing image to canvas: ' + drawImageError.message);
      }
      return false;
    }
  }

  // This method will return a false positive for resources that aren't
  // actually images or haven't loaded yet

  return true;
}

//http://www.w3.org/TR/css3-color/#hsl-color
function hslToRgb(h, s, l, a, out) {
  function hueToRgb(m1, m2, h) {
    h = h % 1;
    if (h < 0) {
      h += 1;
    }
    if (h < 1 / 6) {
      return m1 + (m2 - m1) * h * 6;
    }
    if (h < 1 / 2) {
      return m2;
    }
    if (h < 2 / 3) {
      return m1 + (m2 - m1) * (2/3 - h) * 6;
    }
    return m1;
  }

  var m1, m2;
  if (l < 0.5) {
    m2 = l * (s + 1);
  } else {
    m2 = l + s - l * s;
  }
  m1 = l * 2 - m2;

  if (!out) {
    out = [];
  }

  out[0] = hueToRgb(m1, m2, h + 1/3);
  out[1] = hueToRgb(m1, m2, h);
  out[2] = hueToRgb(m1, m2, h - 1/3);
  out[3] = a;

  return out;
}

const // http://www.w3.org/TR/css3-color/#svg-color
colorNames = {
  transparent: [0, 0, 0, 0],
  black: [0, 0, 0, 1],
  red: [1, 0, 0, 1],
  green: [0, 128 / 255, 0, 1],
  blue: [0, 0, 1, 1],
  white: [1, 1, 1, 1],
  silver: [192 / 255, 192 / 255, 192 / 255, 1],
  gray: [128 / 255, 128 / 255, 128 / 255, 1],
  maroon: [128 / 255, 0, 0, 1],
  purple: [128 / 255, 0, 128 / 255, 1],
  fuchsia: [1, 0, 1, 1],
  lime: [0, 1, 0, 1],
  olive: [128 / 255, 128 / 255, 0, 1],
  yellow: [1, 1, 0, 1],
  navy: [0, 0, 128 / 255, 1],
  teal: [0, 128 / 255, 128 / 255, 1],
  aqua: [0, 1, 1, 1],
  orange: [1, 165 / 255, 0, 1],
};

/*
faster than setTimeout(fn, 0);
http://dbaron.org/log/20100309-faster-timeouts
*/
let timeouts = [];
function setTimeoutZero(fn) {
  /*
  Workaround for postMessage bug in Firefox if the page is loaded from the file system
  https://bugzilla.mozilla.org/show_bug.cgi?id=740576
  Should run fine, but maybe a few milliseconds slower per frame.
  */
  function timeoutFunction() {
    if (timeouts.length) {
      (timeouts.shift())();
    }
  }

  if (typeof fn !== 'function') {
    throw new Error('setTimeoutZero argument is not a function');
  }

  timeouts.push(fn);
  if (window.location.protocol === 'file:') {
    setTimeout(timeoutFunction, 0);
    return;
  }

  window.postMessage('seriously-timeout-message', window.location);
}

const requestAnimationFrame = (function (){
  var lastTime = 0;
  return  window.requestAnimationFrame ||
      window.webkitRequestAnimationFrame ||
      window.mozRequestAnimationFrame ||
      window.oRequestAnimationFrame ||
      window.msRequestAnimationFrame ||
      function (callback) {
        var currTime, timeToCall, id;

        function timeoutCallback() {
          callback(currTime + timeToCall);
        }

        currTime = new Date().getTime();
        timeToCall = Math.max(0, 16 - (currTime - lastTime));
        id = window.setTimeout(timeoutCallback, timeToCall);
        lastTime = currTime + timeToCall;
        return id;
      };
}());

const cancelAnimFrame = (function () {
  return  window.cancelAnimationFrame ||
      window.webkitCancelAnimationFrame ||
      window.mozCancelAnimationFrame ||
      window.oCancelAnimationFrame ||
      window.msCancelAnimationFrame ||
      function (id) {
        window.cancelTimeout(id);
      };
}());

function getElement(input, tags) {
  var element,
    tag;

  if (typeof input === 'string') {
    //element = document.getElementById(input) || document.getElementsByTagName(input)[0];
    element = document.querySelector(input);
  } else if (!input) {
    return false;
  }

  if (input.tagName) {
    element = input;
  }

  if (!element) {
    return input;
  }

  tag = element.tagName.toLowerCase();
  if (tags && tags.indexOf(tag) < 0) {
    return input;
  }

  return element;
}

/*
function extend(dest, src) {
  var property,
    descriptor;

  //todo: are we sure this is safe?
  if (dest.prototype && src.prototype && dest.prototype !== src.prototype) {
    extend(dest.prototype, src.prototype);
  }

  for (property in src) {
    if (src.hasOwnProperty(property)) {
      descriptor = Object.getOwnPropertyDescriptor(src, property);

      if (descriptor.get || descriptor.set) {
        Object.defineProperty(dest, property, {
          configurable: true,
          enumerable: true,
          get: descriptor.get,
          set: descriptor.set
        });
      } else {
        dest[property] = src[property];
      }
    }
  }

  return dest;
}
*/

function consoleMethod(name) {
  var method;
  if (!console) {
    return nop;
  }

  if (typeof console[name] === 'function') {
    method = console[name];
  } else if (typeof console.log === 'function') {
    method = console.log;
  } else {
    return nop;
  }

  if (method.bind) {
    return method.bind(console);
  }

  return function () {
    method.apply(console, arguments);
  };
}

/*
Like instanceof, but it will work on elements that come from different windows (e.g. iframes)

We do not use this for constructors defined in this script.
*/
function isInstance(obj, proto) {
  if (!proto) {
    proto = 'HTMLElement';
  }

  if (obj instanceof window[proto]) {
    return true;
  }

  if (!obj || typeof obj !== 'object') {
    return false;
  }

  while (obj) {
    obj = Object.getPrototypeOf(obj);
    if (obj && obj.constructor.name === proto) {
      return true;
    }
  }

  return false;
}

function colorArrayToHex(color) {
  var i,
    val,
    hex,
    s = '#',
    len = color[3] < 1 ? 4 : 3;

  for (i = 0; i < len; i++) {
    val = Math.min(255, Math.round(color[i] * 255 || 0));
    hex = val.toString(16);
    if (val < 16) {
      hex = '0' + hex;
    }
    s += hex;
  }
  return s;
}

function isArrayLike(obj) {
  return Array.isArray(obj) ||
    (obj && obj.BYTES_PER_ELEMENT && 'length' in obj);
}


function getWebGlContext(canvas, options) {
  var context;
  try {
    if (window.WebGLDebugUtils && options && options.debugContext) {
      context = window.WebGLDebugUtils.makeDebugContext(canvas.getContext('webgl', options));
    } else {
      context = canvas.getContext('webgl', options);
    }
  } catch (expError) {
  }

  if (!context) {
    try {
      context = canvas.getContext('experimental-webgl', options);
    } catch (error) {
    }
  }
  return context;
}

function getTestContext() {
  var canvas;

  if (testContext && testContext.getError() === testContext.CONTEXT_LOST_WEBGL) {
    /*
    Test context was lost already, and the webglcontextlost event maybe hasn't fired yet
    so try making a new context
    */
    testContext = undefined;
  }

  if (testContext || !window.WebGLRenderingContext || incompatibility) {
    return testContext;
  }

  canvas = document.createElement('canvas');
  testContext = getWebGlContext(canvas);

  if (testContext) {
    canvas.addEventListener('webglcontextlost', function contextLost(event) {
      /*
      If/When context is lost, just clear testContext and create
      a new one the next time it's needed
      */
      event.preventDefault();
      if (testContext && testContext.canvas === this) {
        testContext = undefined;
        canvas.removeEventListener('webglcontextlost', contextLost, false);
      }
    }, false);
  } else {
    logger.warn('Unable to access WebGL.');
  }

  return testContext;
}



function validateInputSpecs(plugin) {
  var input,
    options,
    name;

  function normalizeEnumOption(option, i) {
    var key,
      name;

    if (isArrayLike(option)) {
      key = option[0];
      name = option[1] || key;
    } else {
      key = option;
    }

    if (typeof key === 'string') {
      key = key.toLowerCase();
    } else if (typeof key === 'number') {
      key = String(key);
    } else if (!key) {
      key = '';
    }

    options[key] = name;

    if (!i) {
      input.firstValue = key;
    }
  }

  function passThrough(value) {
    return value;
  }

  for (name in plugin.inputs) {
    if (plugin.inputs.hasOwnProperty(name)) {
      if (plugin.reserved.indexOf(name) >= 0 || Object.prototype[name]) {
        throw new Error('Reserved input name: ' + name);
      }

      input = plugin.inputs[name];
      input.name = name;

      if (isNaN(input.min)) {
        input.min = -Infinity;
      }

      if (isNaN(input.max)) {
        input.max = Infinity;
      }

      if (isNaN(input.minCount)) {
        input.minCount = -Infinity;
      }

      if (isNaN(input.maxCount)) {
        input.maxCount = Infinity;
      }

      if (isNaN(input.step)) {
        input.step = 0;
      }

      if (isNaN(input.mod)) {
        input.mod = 0;
      }

      if (input.type === 'enum') {
        /*
        Normalize options to make validation easy
        - all items will have both a key and a name
        - all keys will be lowercase strings
        */
        if (input.options && isArrayLike(input.options) && input.options.length) {
          options = {};
          input.options.forEach(normalizeEnumOption);
          input.options = options;
        }
      }

      if (input.type === 'vector') {
        if (input.dimensions < 2) {
          input.dimensions = 2;
        } else if (input.dimensions > 4) {
          input.dimensions = 4;
        } else if (!input.dimensions || isNaN(input.dimensions)) {
          input.dimensions = 4;
        } else {
          input.dimensions = Math.round(input.dimensions);
        }
      } else {
        input.dimensions = 1;
      }

      input.shaderDirty = !!input.shaderDirty;

      if (typeof input.validate !== 'function') {
        input.validate = inputValidators[input.type] || passThrough;
      }

      if (!plugin.defaultImageInput && input.type === 'image') {
        plugin.defaultImageInput = name;
      }
    }
  }
}

const logger = {
  log: consoleMethod('log'),
  info: consoleMethod('info'),
  warn: consoleMethod('warn'),
  error: consoleMethod('error'),
};

module.exports = {
  nodeId: 0,
  cancelAnimFrame,
  getElement,
  consoleMethod,
  isInstance,
  colorArrayToHex,
  isArrayLike,
  getWebGlContext,
  getTestContext,
  validateInputSpecs,

  shader: {
    noiseHelpers: require('./shaders/noiseHelpers.glsl'),
    snoise2d: require('./shaders/snoise2d.glsl'),
    snoise3d: require('./shaders/snoise3d.glsl'),
    snoise4d: require('./shaders/snoise4d.glsl'),
  },

  logger,

  mat4,
  checkSource,
  hslToRgb,
  colors: colorNames,
  setTimeoutZero,
  ShaderProgram: require('./ShaderProgram.js'),
  FrameBuffer: require('./FrameBuffer.js'),
  requestAnimationFrame,
  shader: {
    makeNoise: require('./shaders/makeNoise.glsl'),
    random: require('./shaders/random.glsl'),
  },
};
