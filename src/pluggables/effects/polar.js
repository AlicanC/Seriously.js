import Plugin from '../aaPlugin.js';

module.exports = new Plugin('polar', {
  commonShader: true,
  shader: function shader(inputs, shaderSource) {
    shaderSource.fragment = require('./polar.f.glsl'); // eslint-disable-line no-param-reassign
    return shaderSource;
  },
  inPlace: false,
  inputs: {
    source: {
      type: 'image',
      uniform: 'source',
      shaderDirty: false,
    },
    angle: {
      type: 'number',
      uniform: 'angle',
      defaultValue: 0,
    },
  },
  title: 'Polar Coordinates',
  description: 'Convert cartesian to polar coordinates',
});
