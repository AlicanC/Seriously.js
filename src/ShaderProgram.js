import { shaderNameRegex, shaderDebugConstants } from './utilities.js';

function buildShaderCompilationError(source, fragment) {
  const errorLines = [
    `Error compiling ${fragment ? 'fragment' : 'vertex'} shader:`,
  ];

  const sourceLines = source.split(/[\n\r]/);
  for (let j = 0; j < sourceLines.length; j++) {
    errorLines.push(`${j + 1}:  ${sourceLines[j]}`);
  }

  return errorLines.join('\n');
}

function compileShader(gl, source, fragment) {
  let shader;
  if (fragment) {
    shader = gl.createShader(gl.FRAGMENT_SHADER);
  } else {
    shader = gl.createShader(gl.VERTEX_SHADER);
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(buildShaderCompilationError(source, fragment));
    throw new Error(`Shader error: ${gl.getShaderInfoLog(shader)}`);
  }

  return shader;
}

function makeShaderSetter(gl, info, loc) {
  if (info.type === gl.SAMPLER_2D) {
    return (value) => {
      info.glTexture = gl[`TEXTURE${value}`]; // eslint-disable-line no-param-reassign
      gl.uniform1i(loc, value);
    };
  }

  if (info.type === gl.BOOL || info.type === gl.INT) {
    if (info.size > 1) {
      return (value) => {
        gl.uniform1iv(loc, value);
      };
    }

    return (value) => {
      gl.uniform1i(loc, value);
    };
  }

  if (info.type === gl.FLOAT) {
    if (info.size > 1) {
      return (value) => {
        gl.uniform1fv(loc, value);
      };
    }

    return (value) => {
      gl.uniform1f(loc, value);
    };
  }

  if (info.type === gl.FLOAT_VEC2) {
    return (obj) => {
      gl.uniform2f(loc, obj[0], obj[1]);
    };
  }

  if (info.type === gl.FLOAT_VEC3) {
    return (obj) => {
      gl.uniform3f(loc, obj[0], obj[1], obj[2]);
    };
  }

  if (info.type === gl.FLOAT_VEC4) {
    return (obj) => {
      gl.uniform4f(loc, obj[0], obj[1], obj[2], obj[3]);
    };
  }

  if (info.type === gl.FLOAT_MAT3) {
    return (mat3) => {
      gl.uniformMatrix3fv(loc, false, mat3);
    };
  }

  if (info.type === gl.FLOAT_MAT4) {
    return (mat4) => {
      gl.uniformMatrix4fv(loc, false, mat4);
    };
  }

  throw new Error(`Unknown shader uniform type: ${info.type}`);
}

function makeShaderGetter(gl, program, loc) {
  return () => gl.getUniform(program, loc);
}

export default class ShaderProgram {
  constructor(gl, vertexShaderSource, fragmentShaderSource) {
    let programError = '';

    this.gl = gl;

    const vertexShader = this.vertexShader = compileShader(gl, vertexShaderSource);
    const fragmentShader = this.fragmentShader = compileShader(gl, fragmentShaderSource, true);

    const program = this.program = gl.createProgram();

    gl.attachShader(program, vertexShader);
    let shaderError = gl.getShaderInfoLog(vertexShader);
    if (shaderError) {
      programError += `Vertex shader error: ${shaderError}\n`;
    }

    gl.attachShader(program, fragmentShader);
    shaderError = gl.getShaderInfoLog(fragmentShader);
    if (shaderError) {
      programError += `Fragment shader error: ${shaderError}\n`;
    }

    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      programError += gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);

      const shaderNameRegexMatch = shaderNameRegex.exec(vertexShaderSource) ||
        shaderNameRegex.exec(fragmentShaderSource);

      if (shaderNameRegexMatch) {
        programError = `Shader = ${shaderNameRegexMatch[1]}\n${programError}`;
      }

      shaderDebugConstants.forEach((c) => {
        programError += `\n${c}: ${gl.getParameter(gl[c])}`;
      });

      throw new Error(`Could not initialize shader:\n${programError}`);
    }

    gl.useProgram(program);

    this.uniforms = {};

    let l = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < l; ++i) {
      const obj = {
        info: gl.getActiveUniform(program, i),
      };

      obj.name = obj.info.name.replace(/\[0\]$/, '');
      obj.loc = gl.getUniformLocation(program, obj.name);
      obj.set = makeShaderSetter(gl, obj.info, obj.loc);
      obj.get = makeShaderGetter(gl, program, obj.loc);
      this.uniforms[obj.name] = obj;

      if (!this[obj.name]) {
        // for convenience
        this[obj.name] = obj;
      }
    }

    this.attributes = {};
    this.location = {};
    l = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
    for (let i = 0; i < l; ++i) {
      const obj = {
        info: gl.getActiveAttrib(program, i),
      };

      obj.name = obj.info.name;
      obj.location = gl.getAttribLocation(program, obj.name);
      this.attributes[obj.name] = obj;
      this.location[obj.name] = obj.location;
    }
  }

  use() {
    this.gl.useProgram(this.program);
  }

  destroy() {
    const gl = this.gl;

    if (gl) {
      gl.deleteProgram(this.program);
      gl.deleteShader(this.vertexShader);
      gl.deleteShader(this.fragmentShader);
    }

    for (const key in this) {
      if (this.hasOwnProperty(key)) {
        delete this[key];
      }
    }

    this.program = null;
    this.vertexShader = null;
    this.fragmentShader = null;
  }
}
