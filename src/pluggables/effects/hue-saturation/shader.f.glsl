precision mediump float;

varying vec2 vTexCoord;

varying vec3 weights;

uniform sampler2D source;
uniform float hue;
uniform float saturation;

void main(void) {
	vec4 color = texture2D(source, vTexCoord);

  //adjust hue
	float len = length(color.rgb);
	color.rgb = vec3(
    dot(color.rgb, weights.xyz),
    dot(color.rgb, weights.zxy),
    dot(color.rgb, weights.yzx)
  );

  //adjust saturation
	vec3 adjustment = (color.r + color.g + color.b) / 3.0 - color.rgb;
	if (saturation > 0.0) {
		adjustment *= (1.0 - 1.0 / (1.0 - saturation));
	} else {
		adjustment *= (-saturation);
	}
	color.rgb += adjustment;

	gl_FragColor = color;
}
