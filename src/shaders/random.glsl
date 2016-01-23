#ifndef RANDOM
#define RANDOM
float random(vec2 n) {
  return 0.5 + 0.5 * fract(sin(dot(n.xy, vec2(12.9898, 78.233)))* 43758.5453);
}
#endif
