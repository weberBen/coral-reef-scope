export const waterVertexShader = /* glsl */ `
uniform float uTime;
uniform float uWaveHeight;
uniform float uWavePeriod;
uniform float uWaveDir;

varying vec3 vWorldPos;
varying vec3 vNormal;
varying float vWaveY;

void main() {
  vec3 pos = position;

  float omega = 6.2832 / max(uWavePeriod, 0.5);
  float k = omega * omega / 9.81;
  float dx = cos(uWaveDir);
  float dz = sin(uWaveDir);
  float phase = k * (pos.x * dx + pos.z * dz) - omega * uTime;

  // Main wave + harmonics
  pos.y  = uWaveHeight * 0.5 * sin(phase);
  pos.y += uWaveHeight * 0.12 * sin(phase * 2.3 + 1.7);
  pos.y += uWaveHeight * 0.06 * sin(phase * 3.1 + 0.3);

  // Cross-swell
  float phase2 = k * 0.6 * (pos.x * dz - pos.z * dx) - omega * 0.7 * uTime + 2.0;
  pos.y += uWaveHeight * 0.07 * sin(phase2);

  vWaveY = pos.y;

  // Analytical normal
  float dydx = uWaveHeight * 0.5 * k * dx * cos(phase)
             + uWaveHeight * 0.12 * 2.3 * k * dx * cos(phase * 2.3 + 1.7)
             + uWaveHeight * 0.07 * 0.6 * k * dz * cos(phase2);
  float dydz = uWaveHeight * 0.5 * k * dz * cos(phase)
             + uWaveHeight * 0.12 * 2.3 * k * dz * cos(phase * 2.3 + 1.7)
             - uWaveHeight * 0.07 * 0.6 * k * dx * cos(phase2);

  vNormal = normalize(vec3(-dydx, 1.0, -dydz));
  vWorldPos = (modelMatrix * vec4(pos, 1.0)).xyz;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

export const waterFragmentShader = /* glsl */ `
uniform vec3 uDeepColor;
uniform vec3 uSurfColor;
uniform vec3 uHorizColor;

varying vec3 vWorldPos;
varying vec3 vNormal;
varying float vWaveY;

void main() {
  vec3 viewDir = normalize(cameraPosition - vWorldPos);
  float fresnel = pow(1.0 - max(dot(viewDir, vNormal), 0.0), 3.5);

  // Ocean colors from uniforms
  vec3 color = mix(uDeepColor, mix(uSurfColor, uHorizColor, fresnel * 0.5), fresnel);

  // Sun specular highlight
  vec3 sunDir = normalize(vec3(0.4, 0.8, 0.25));
  vec3 halfVec = normalize(viewDir + sunDir);
  float spec = pow(max(dot(vNormal, halfVec), 0.0), 256.0);
  color += vec3(1.0, 0.95, 0.82) * spec * 0.8;

  // Soft secondary specular (sky reflection)
  vec3 skyDir = normalize(vec3(-0.2, 0.9, -0.3));
  float skySpec = pow(max(dot(vNormal, normalize(viewDir + skyDir)), 0.0), 32.0);
  color += vec3(0.4, 0.6, 0.8) * skySpec * 0.15;

  // Foam on wave crests
  float foam = smoothstep(0.15, 0.4, vWaveY) * 0.25;
  color = mix(color, vec3(0.85, 0.92, 0.98), foam);

  float alpha = mix(0.4, 0.88, fresnel);
  gl_FragColor = vec4(color, alpha);
}
`;
