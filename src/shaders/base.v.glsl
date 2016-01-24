precision mediump float;

attribute vec4 position;
attribute vec2 texCoord;

uniform vec2 resolution;
uniform mat4 transform;

varying vec2 vTexCoord;

void main(void) {
  // first convert to screen space
	vec4 screenPosition = vec4(position.xy * resolution / 2.0, position.z, position.w);
	screenPosition = transform * screenPosition;

  // convert back to OpenGL coords
	gl_Position.xy = screenPosition.xy * 2.0 / resolution;
	gl_Position.z = screenPosition.z * 2.0 / (resolution.x / resolution.y);
	gl_Position.w = screenPosition.w;
	vTexCoord = texCoord;
}
