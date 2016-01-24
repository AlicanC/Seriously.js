precision mediump float;

uniform sampler2D source;
uniform float blendGamma;

varying vec2 vTexCoord;
varying vec4 vTexCoords[4];

vec3 exp;

vec4 sample(sampler2D sampler, vec2 coord) {
	vec4 pixel = texture2D(sampler, coord);
	pixel.rgb = pow(pixel.rgb, exp);
	return pixel;
}

void main(void) {

	exp = vec3(blendGamma);

	gl_FragColor = sample(source, vTexCoord) / 9.0;

	for (int i = 0; i < 4; i++) {
		gl_FragColor += sample(source, vTexCoords[i].xy) / 9.0;
		gl_FragColor += sample(source, vTexCoords[i].zw) / 9.0;
	}

	gl_FragColor.rgb = pow(gl_FragColor.rgb, 1.0 / exp);

}
