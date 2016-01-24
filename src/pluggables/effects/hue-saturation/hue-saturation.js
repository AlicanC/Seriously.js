import Plugin from '../../aaPlugin.js';

export default new Plugin('hue-saturation', {
  commonShader: true,
  shader: function shader(inputs, shaderSource) {
    shaderSource.vertex = require('./shader.v.glsl'); // eslint-disable-line no-param-reassign
    shaderSource.fragment = require('./shader.f.glsl'); // eslint-disable-line no-param-reassign

    return shaderSource;
  },
  inPlace: true,
  inputs: {
    source: {
      type: 'image',
      uniform: 'source',
    },
    hue: {
      type: 'number',
      uniform: 'hue',
      defaultValue: 0.4,
      min: -1,
      max: 1,
    },
    saturation: {
      type: 'number',
      uniform: 'saturation',
      defaultValue: 0,
      min: -1,
      max: 1,
    },
  },
  title: 'Hue/Saturation',
  description: 'Rotate hue and multiply saturation.',
});
