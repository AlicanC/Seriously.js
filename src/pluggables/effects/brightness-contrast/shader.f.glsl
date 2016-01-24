precision mediump float;

varying vec2 vTexCoord;

uniform sampler2D source;
uniform float brightness;
uniform float saturation;
uniform float contrast;

const vec3 half3 = vec3(0.5);

void main(void) {
	vec4 pixel = texture2D(source, vTexCoord);

  //adjust brightness
	vec3 color = pixel.rgb * brightness;

  //adjust contrast
	color = (color - half3) * contrast + half3;

  //keep alpha the same
	gl_FragColor = vec4(color, pixel.a);
}
