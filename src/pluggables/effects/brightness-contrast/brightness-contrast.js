import Plugin from '../../aaPlugin.js';

export default new Plugin('brightness-contrast', {
  commonShader: true,
  shader: function shader(inputs, shaderSource) {
    shaderSource.fragment = require('./shader.f.glsl'); // eslint-disable-line no-param-reassign
    return shaderSource;
  },
  inPlace: true,
  inputs: {
    source: {
      type: 'image',
      uniform: 'source',
    },
    brightness: {
      type: 'number',
      uniform: 'brightness',
      defaultValue: 1,
      min: 0,
    },
    contrast: {
      type: 'number',
      uniform: 'contrast',
      defaultValue: 1,
      min: 0,
    },
  },
  title: 'Brightness/Contrast',
  description: 'Multiply brightness and contrast values. Works the same as CSS filters.',
});
