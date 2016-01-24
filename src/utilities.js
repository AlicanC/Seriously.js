import inputValidators from './inputValidators.js';

export function makeGlModel(shape, gl) {
  if (!gl) {
    return false;
  }

  const vertex = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertex);
  gl.bufferData(gl.ARRAY_BUFFER, shape.vertices, gl.STATIC_DRAW);
  vertex.size = 3;

  const index = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, shape.indices, gl.STATIC_DRAW);

  const texCoord = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, texCoord);
  gl.bufferData(gl.ARRAY_BUFFER, shape.coords, gl.STATIC_DRAW);
  texCoord.size = 2;

  return {
    vertex,
    index,
    texCoord,
    length: shape.indices.length,
    mode: shape.mode || gl.TRIANGLES,
  };
}

export function buildRectangleModel(gl) {
  const shape = {};

  shape.vertices = new Float32Array([
    -1, -1, 0,
    1, -1, 0,
    1, 1, 0,
    -1, 1, 0,
  ]);

  shape.indices = new Uint16Array([
    0, 1, 2,
    0, 2, 3,  // Front face
  ]);

  shape.coords = new Float32Array([
    0, 0,
    1, 0,
    1, 1,
    0, 1,
  ]);

  return makeGlModel(shape, gl);
}

export const baseVertexShader = require('./shaders/base.v.glsl');
export const baseFragmentShader = require('./shaders/base.f.glsl');

export function isInstance(obj, proto) {
  if (!proto) {
    proto = 'HTMLElement'; // eslint-disable-line no-param-reassign
  }

  if (obj instanceof window[proto]) {
    return true;
  }

  if (!obj || typeof obj !== 'object') {
    return false;
  }

  while (obj) {
    obj = Object.getPrototypeOf(obj); // eslint-disable-line no-param-reassign
    if (obj && obj.constructor.name === proto) {
      return true;
    }
  }

  return false;
}

export function getWebGlContext(canvas, options) {
  let context;
  try {
    if (window.WebGLDebugUtils && options && options.debugContext) {
      context = window.WebGLDebugUtils.makeDebugContext(canvas.getContext('webgl', options));
    } else {
      context = canvas.getContext('webgl', options);
    }
  } catch (expError) {
    // We don't care
  }

  if (!context) {
    try {
      context = canvas.getContext('experimental-webgl', options);
    } catch (error) {
      // We don't care
    }
  }

  return context;
}

export function getElement(input, tags) {
  let element;
  if (typeof input === 'string') {
    // element = document.getElementById(input) || document.getElementsByTagName(input)[0];
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

  const tag = element.tagName.toLowerCase();
  if (tags && tags.indexOf(tag) < 0) {
    return input;
  }

  return element;
}

export function noop() {}

export const colorRegex = /^(rgb|hsl)a?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(,\s*(\d+(\.\d*)?)\s*)?\)/i; // eslint-disable-line max-len
export const hexColorRegex = /^#(([0-9a-fA-F]{3,8}))/;

export const vectorFields = ['x', 'y', 'z', 'w'];
export const colorFields = ['r', 'g', 'b', 'a'];

export const outputRenderOptions = {
  srcRGB: 0x0302, // SRC_ALPHA
  dstRGB: 0x0303, // ONE_MINUS_SRC_ALPHA
  srcAlpha: 0x01, // ONE
  dstAlpha: 0x0303, // ONE_MINUS_SRC_ALPHA
};

export const shaderDebugConstants = [
  'MAX_COMBINED_TEXTURE_IMAGE_UNITS',
  'MAX_FRAGMENT_UNIFORM_VECTORS',
  'MAX_TEXTURE_IMAGE_UNITS',
  'MAX_VARYING_VECTORS',
  'MAX_VERTEX_ATTRIBS',
  'MAX_VERTEX_TEXTURE_IMAGE_UNITS',
  'MAX_VERTEX_UNIFORM_VECTORS',
];

export const shaderNameRegex = /^[\t ]*#define[\t ]+SHADER_NAME\s+([^$\n\r]+)/i;

export const reservedEffectProperties = [
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

export const reservedTransformProperties = [
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

export const reservedNames = [
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

export function isArrayLike(obj) {
  return Array.isArray(obj) ||
    (obj && obj.BYTES_PER_ELEMENT && 'length' in obj);
}

export function validateInputSpecs(plugin) {
  let input;
  let options;

  function normalizeEnumOption(option, i) {
    let key;
    let name; // eslint-disable-line no-shadow
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

  for (const name in plugin.inputs) {
    if (plugin.inputs.hasOwnProperty(name)) {
      if (plugin.reserved.indexOf(name) >= 0 || Object.prototype[name]) {
        throw new Error(`Reserved input name: ${name}`);
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
        plugin.defaultImageInput = name; // eslint-disable-line no-param-reassign
      }
    }
  }
}

let testContext;
export function getTestContext(incompatibility) {
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

  const canvas = document.createElement('canvas');
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
    console.warn('Unable to access WebGL.');
  }

  return testContext;
}

const timeouts = [];
export function setTimeoutZero(fn) {
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

window.addEventListener('message', (event) => {
  if (event.source === window && event.data === 'seriously-timeout-message') {
    event.stopPropagation();
    if (timeouts.length > 0) {
      const fn = timeouts.shift();
      fn();
    }
  }
}, true);

export const identity = new Float32Array([
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1,
]);

export function colorArrayToHex(color) {
  let s = '#';
  const len = color[3] < 1 ? 4 : 3;

  for (let i = 0; i < len; i++) {
    const val = Math.min(255, Math.round(color[i] * 255 || 0));
    let hex = val.toString(16);
    if (val < 16) {
      hex = `0${hex}`;
    }
    s += hex;
  }
  return s;
}

export function checkSource(source) {
  // TODO: don't need to create a new array every time we do this
  const element = getElement(source, ['img', 'canvas', 'video']);
  if (!element) {
    return false;
  }

  const canvas = document.createElement('canvas');
  if (!canvas) {
    console.warn('Browser does not support canvas or Seriously.js');
    return false;
  }

  if (element.naturalWidth === 0 && element.tagName === 'IMG') {
    console.warn('Image not loaded');
    return false;
  }

  if (element.readyState === 0 && element.videoWidth === 0 && element.tagName === 'VIDEO') {
    console.warn('Video not loaded');
    return false;
  }

  let ctx = getTestContext();
  if (ctx) {
    const texture = ctx.createTexture();
    if (!texture) {
      console.error('Test WebGL context has been lost');
    }

    ctx.bindTexture(ctx.TEXTURE_2D, texture);

    try {
      ctx.texImage2D(ctx.TEXTURE_2D, 0, ctx.RGBA, ctx.RGBA, ctx.UNSIGNED_BYTE, element);
    } catch (textureError) {
      if (textureError.code === window.DOMException.SECURITY_ERR) {
        console.log('Unable to access cross-domain image');
      } else {
        console.error(`Error storing image to texture: ${textureError.message}`);
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
        console.log('Unable to access cross-domain image');
      } else {
        console.error(`Error drawing image to canvas: ${drawImageError.message}`);
      }
      return false;
    }
  }

  // This method will return a false positive for resources that aren't
  // actually images or haven't loaded yet

  return true;
}

export function hslToRgb(h, s, l, a, out) {
  function hueToRgb(m1, m2, h) {  // eslint-disable-line no-shadow
    h = h % 1;  // eslint-disable-line no-param-reassign
    if (h < 0) {
      h += 1;  // eslint-disable-line no-param-reassign
    }
    if (h < 1 / 6) {
      return m1 + (m2 - m1) * h * 6;
    }
    if (h < 1 / 2) {
      return m2;
    }
    if (h < 2 / 3) {
      return m1 + (m2 - m1) * (2 / 3 - h) * 6;
    }
    return m1;
  }

  let m2;
  if (l < 0.5) {
    m2 = l * (s + 1);
  } else {
    m2 = l + s - l * s;
  }
  const m1 = l * 2 - m2;

  if (!out) {
    out = []; // eslint-disable-line no-param-reassign
  }

  out[0] = hueToRgb(m1, m2, h + 1 / 3);  // eslint-disable-line no-param-reassign
  out[1] = hueToRgb(m1, m2, h);  // eslint-disable-line no-param-reassign
  out[2] = hueToRgb(m1, m2, h - 1 / 3);  // eslint-disable-line no-param-reassign
  out[3] = a;  // eslint-disable-line no-param-reassign

  return out;
}

// http://www.w3.org/TR/css3-color/#svg-color
export const colorNames = {
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
