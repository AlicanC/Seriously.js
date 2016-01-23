/*
 * simplex noise shaders
 * https://github.com/ashima/webgl-noise
 * Copyright (C) 2011 by Ashima Arts (Simplex noise)
 * Copyright (C) 2011 by Stefan Gustavson (Classic noise)
 */

#ifndef NOISE_HELPERS
#define NOISE_HELPERS
vec2 mod289(vec2 x) {
	return x - floor(x * (1.0 / 289.0)) * 289.0;
}
vec3 mod289(vec3 x) {
	return x - floor(x * (1.0 / 289.0)) * 289.0;
}
vec4 mod289(vec4 x) {
	return x - floor(x * (1.0 / 289.0)) * 289.0;
}
vec3 permute(vec3 x) {
	return mod289(((x*34.0)+1.0)*x);
}
vec4 permute(vec4 x) {
	return mod289(((x*34.0)+1.0)*x);
}
vec4 taylorInvSqrt(vec4 r) {
	return 1.79284291400159 - 0.85373472095314 * r;
}
float taylorInvSqrt(float r) {
	return 1.79284291400159 - 0.85373472095314 * r;
}
#endif
