import Plugin from '../../aaPlugin.js';
const utillll = require('../../util.js');

var passes = [0.2, 0.3, 0.5, 0.8, 1],
	finalPass = passes.length - 1,
	horizontal = [1, 0],
	vertical = [0, 1],
	identity = new Float32Array([
		1, 0, 0, 0,
		0, 1, 0, 0,
		0, 0, 1, 0,
		0, 0, 0, 1
	]);

module.exports = new Plugin('blur', function (options) {
	var fbHorizontal,
		fbVertical,
		baseShader,
		loopUniforms = {
			amount: 0,
			blendGamma: 2,
			inputScale: 1,
			resolution: [this.width, this.height],
			transform: identity,
			direction: null
		};

	return {
		initialize: function (parent) {
			var gl;

			parent();

			gl = this.gl;

			if (!gl) {
				return;
			}

			baseShader = this.baseShader;

			fbHorizontal = new utillll.FrameBuffer(gl, this.width, this.height);
			fbVertical = new utillll.FrameBuffer(gl, this.width, this.height);
		},
		commonShader: true,
		shader: function (inputs, shaderSource) {
			var gl = this.gl;

			shaderSource.vertex = require('./vertex.glsl');
			shaderSource.fragment = require('./fragment.glsl');

			return shaderSource;
		},
		draw: function (shader, model, uniforms, frameBuffer, parent) {
			var i,
				pass,
				amount,
				width,
				height,
				opts = {
					width: 0,
					height: 0,
					blend: false
				},
				previousPass = 1;

			amount = this.inputs.amount;
			if (!amount) {
				uniforms.source = this.inputs.source.texture;
				parent(baseShader, model, uniforms, frameBuffer);
				return;
			}

			if (amount <= 0.01) {
				//horizontal pass
				uniforms.inputScale = 1;
				uniforms.direction = horizontal;
				uniforms.source = this.inputs.source.texture;
				parent(shader, model, uniforms, fbHorizontal.frameBuffer);

				//vertical pass
				uniforms.direction = vertical;
				uniforms.source = fbHorizontal.texture;
				parent(shader, model, uniforms, frameBuffer);
				return;
			}

			loopUniforms.amount = amount;
			loopUniforms.blendGamma = uniforms.blendGamma;
			loopUniforms.source = this.inputs.source.texture;

			for (i = 0; i < passes.length; i++) {
				pass = Math.min(1, passes[i] / amount);
				width = Math.floor(pass * this.width);
				height = Math.floor(pass * this.height);

				loopUniforms.resolution[0] = width;
				loopUniforms.resolution[1] = height;
				loopUniforms.inputScale = previousPass;
				previousPass = pass;

				opts.width = width;
				opts.height = height;

				//horizontal pass
				loopUniforms.direction = horizontal;
				parent(shader, model, loopUniforms, fbHorizontal.frameBuffer, null, opts);

				//vertical pass
				loopUniforms.inputScale = pass;
				loopUniforms.source = fbHorizontal.texture;
				loopUniforms.direction = vertical;
				parent(shader, model, loopUniforms, i === finalPass ? frameBuffer : fbVertical.frameBuffer, null, opts);

				loopUniforms.source = fbVertical.texture;
			}
		},
		resize: function () {
			loopUniforms.resolution[0] = this.width;
			loopUniforms.resolution[1] = this.height;
			if (fbHorizontal) {
				fbHorizontal.resize(this.width, this.height);
				fbVertical.resize(this.width, this.height);
			}
		},
		destroy: function () {
			if (fbHorizontal) {
				fbHorizontal.destroy();
				fbVertical.destroy();
				fbHorizontal = null;
				fbVertical = null;
			}

			loopUniforms = null;
		}
	};
},
{
	inputs: {
		source: {
			type: 'image',
			shaderDirty: false
		},
		amount: {
			type: 'number',
			uniform: 'amount',
			defaultValue: 0.2,
			min: 0,
			max: 1
		},
		blendGamma: {
			type: 'number',
			uniform: 'blendGamma',
			defaultValue: 2.2,
			min: 0,
			max: 4
		}
	},
	title: 'Gaussian Blur'
});
