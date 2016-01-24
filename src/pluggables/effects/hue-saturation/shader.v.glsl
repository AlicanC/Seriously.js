precision mediump float;

attribute vec4 position;
attribute vec2 texCoord;

uniform vec2 resolution;
uniform mat4 projection;
uniform mat4 transform;

uniform float hue;
uniform float saturation;

varying vec2 vTexCoord;

varying vec3 weights;

void main(void) {
	float angle = hue * 3.14159265358979323846264;
	float s = sin(angle);
	float c = cos(angle);
	weights = (vec3(2.0 * c, -sqrt(3.0) * s - c, sqrt(3.0) * s - c) + 1.0) / 3.0;

  // first convert to screen space
	vec4 screenPosition = vec4(position.xy * resolution / 2.0, position.z, position.w);
	screenPosition = transform * screenPosition;

  // convert back to OpenGL coords
	gl_Position = screenPosition;
	gl_Position.xy = screenPosition.xy * 2.0 / resolution;
	gl_Position.z = screenPosition.z * 2.0 / (resolution.x / resolution.y);
	vTexCoord = texCoord;
}
