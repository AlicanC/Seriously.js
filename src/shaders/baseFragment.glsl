precision mediump float;

varying vec2 vTexCoord;

uniform sampler2D source;

void main(void) {
  /*
	if (any(lessThan(vTexCoord, vec2(0.0))) || any(greaterThanEqual(vTexCoord, vec2(1.0)))) {
		gl_FragColor = vec4(0.0);
	} else {
    gl_FragColor = texture2D(source, vTexCoord);
  }
  */

  gl_FragColor = texture2D(source, vTexCoord);
}
