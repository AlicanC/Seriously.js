precision mediump float;

attribute vec4 position;
attribute vec2 texCoord;

uniform vec2 resolution;
uniform mat4 transform;

uniform vec2 direction;
uniform float amount;
uniform float inputScale;

const vec2 zero = vec2(0.0);

varying vec2 vTexCoord;
varying vec4 vTexCoords[4];

void main(void) {
  // first convert to screen space
	vec4 screenPosition = vec4(position.xy * resolution / 2.0, position.z, position.w);
	screenPosition = transform * screenPosition;

  // convert back to OpenGL coords
	gl_Position = screenPosition;
	gl_Position.xy = screenPosition.xy * 2.0 / resolution;
	gl_Position.z = screenPosition.z * 2.0 / (resolution.x / resolution.y);
	vTexCoord = texCoord;

	vec2 one = vec2(1.0) * inputScale;
	if (inputScale < 1.0) {
		one -= 1.0 / resolution;
	}

	vTexCoord = max(zero, min(one, texCoord.st * inputScale));
	vec2 amount = direction * (inputScale * amount * 5.0 / resolution);

	for (int i = 0; i < 4; i++) {
		float s = pow(3.0, float(i));
		vTexCoords[i].xy = max(zero, min(one, vTexCoord + amount * s));
		vTexCoords[i].zw = max(zero, min(one, vTexCoord - amount * s));
	}
}
