float makeNoise(float u, float v, float timer) {
  float x = u * v * mod(timer * 1000.0, 100.0);
  x = mod(x, 13.0) * mod(x, 127.0);
  float dx = mod(x, 0.01);
  return clamp(0.1 + dx * 100.0, 0.0, 1.0);
}
