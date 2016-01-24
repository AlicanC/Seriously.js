import Plugin from '../../aaPlugin.js';
import FrameBuffer from '../../../FrameBuffer.js';
import { identity } from '../../../utilities.js';

const passes = [0.2, 0.3, 0.5, 0.8, 1];
const finalPass = passes.length - 1;
const horizontal = [1, 0];
const vertical = [0, 1];

export default new Plugin('blur', function Blur(options) {
  let fbHorizontal;
  let fbVertical;
  let baseShader;
  let loopUniforms = {
    amount: 0,
    blendGamma: 2,
    inputScale: 1,
    resolution: [this.width, this.height],
    transform: identity,
    direction: null,
  };

  return {
    initialize: function initialize(parent) {
      parent();

      const gl = this.gl;

      if (!gl) {
        return;
      }

      baseShader = this.baseShader;

      fbHorizontal = new FrameBuffer(gl, this.width, this.height);
      fbVertical = new FrameBuffer(gl, this.width, this.height);
    },
    commonShader: true,
    shader: function shader(inputs, shaderSource) {
      shaderSource.vertex = require('./shader.v.glsl'); // eslint-disable-line no-param-reassign
      shaderSource.fragment = require('./shader.f.glsl'); // eslint-disable-line no-param-reassign

      return shaderSource;
    },
    draw: function draw(shader, model, uniforms, frameBuffer, parent) {
      /* eslint-disable no-param-reassign */
      const opts = {
        width: 0,
        height: 0,
        blend: false,
      };

      const amount = this.inputs.amount;
      if (!amount) {
        uniforms.source = this.inputs.source.texture;
        parent(baseShader, model, uniforms, frameBuffer);
        return;
      }

      if (amount <= 0.01) {
        // horizontal pass
        uniforms.inputScale = 1;
        uniforms.direction = horizontal;
        uniforms.source = this.inputs.source.texture;
        parent(shader, model, uniforms, fbHorizontal.frameBuffer);

        // vertical pass
        uniforms.direction = vertical;
        uniforms.source = fbHorizontal.texture;
        parent(shader, model, uniforms, frameBuffer);
        return;
      }

      loopUniforms.amount = amount;
      loopUniforms.blendGamma = uniforms.blendGamma;
      loopUniforms.source = this.inputs.source.texture;

      let previousPass = 1;
      for (let i = 0; i < passes.length; i++) {
        const pass = Math.min(1, passes[i] / amount);
        const width = Math.floor(pass * this.width);
        const height = Math.floor(pass * this.height);

        loopUniforms.resolution[0] = width;
        loopUniforms.resolution[1] = height;
        loopUniforms.inputScale = previousPass;
        previousPass = pass;

        opts.width = width;
        opts.height = height;

        // horizontal pass
        loopUniforms.direction = horizontal;
        parent(shader, model, loopUniforms, fbHorizontal.frameBuffer, null, opts);

        // vertical pass
        loopUniforms.inputScale = pass;
        loopUniforms.source = fbHorizontal.texture;
        loopUniforms.direction = vertical;
        parent(shader, model, loopUniforms,
          i === finalPass ? frameBuffer : fbVertical.frameBuffer, null, opts);

        loopUniforms.source = fbVertical.texture;
      }
      /* eslint-enable no-param-reassign */
    },
    resize: function resize() {
      loopUniforms.resolution[0] = this.width;
      loopUniforms.resolution[1] = this.height;
      if (fbHorizontal) {
        fbHorizontal.resize(this.width, this.height);
        fbVertical.resize(this.width, this.height);
      }
    },
    destroy: function destroy() {
      if (fbHorizontal) {
        fbHorizontal.destroy();
        fbVertical.destroy();
        fbHorizontal = null;
        fbVertical = null;
      }

      loopUniforms = null;
    },
  };
},
  {
    inputs: {
      source: {
        type: 'image',
        shaderDirty: false,
      },
      amount: {
        type: 'number',
        uniform: 'amount',
        defaultValue: 0.2,
        min: 0,
        max: 1,
      },
      blendGamma: {
        type: 'number',
        uniform: 'blendGamma',
        defaultValue: 2.2,
        min: 0,
        max: 4,
      },
    },
    title: 'Gaussian Blur',
  });
