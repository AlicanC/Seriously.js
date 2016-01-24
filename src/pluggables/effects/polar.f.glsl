precision mediump float;

varying vec2 vTexCoord;

uniform sampler2D source;
uniform float angle;

const float PI = 3.141592653589793;

void main(void) {
	vec2 norm = (1.0 - vTexCoord) * 2.0 - 1.0;
	float theta = mod(PI + atan(norm.x, norm.y) - angle * (PI / 180.0), PI * 2.0);
	vec2 polar = vec2(theta / (2.0 * PI), length(norm));
	gl_FragColor = texture2D(source, polar);
}
