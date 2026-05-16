/**
 * motion-video-maker / shader backgrounds
 * ----------------------------------------------------------------
 * A lightweight WebGL2 fragment-shader engine that mounts a fullscreen
 * quad onto any [data-background="..."] element, ticks a deterministic
 * `time` uniform, and lets the timeline drive each frame.
 *
 * Patterns inspired by react-bits' shader backgrounds (Liquid Ether,
 * Iridescence, Prismatic Burst, Lightning, Plasma) but written from
 * scratch as plain GLSL — no OGL/three.js dependency.
 */
(function () {
  'use strict';

  // ---------- Standard vertex shader (fullscreen triangle) ------
  const VERT = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

  // ---------- Shared GLSL helpers -------------------------------
  const COMMON = `
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform vec2  u_resolution;
uniform float u_time;
uniform vec3  u_color0;
uniform vec3  u_color1;
uniform vec3  u_color2;
uniform vec3  u_color3;
uniform float u_intensity;
uniform float u_scale;
uniform float u_seed;

#define PI 3.14159265
#define TAU 6.28318531

vec3 hsl2rgb(vec3 c) {
  vec3 rgb = clamp(abs(mod(c.x*6.0+vec3(0,4,2),6.0)-3.0)-1.0, 0.0, 1.0);
  return c.z + c.y * (rgb-0.5) * (1.0-abs(2.0*c.z-1.0));
}

// 2D random / hash
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

// Smooth value noise
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1, 0));
  float c = hash21(i + vec2(0, 1));
  float d = hash21(i + vec2(1, 1));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// Fractal Brownian motion (5 octaves)
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * vnoise(p);
    p *= 2.0;
    a *= 0.5;
  }
  return v;
}

// Rotation matrix
mat2 rot(float a) { return mat2(cos(a), -sin(a), sin(a), cos(a)); }
`;

  // ---------- Shader programs -----------------------------------
  // Each fragment shader is responsible for the post-COMMON code only.

  const SHADERS = {
    // -----------------------------------------------------------
    // Liquid Ether: flowing organic blobs with iridescent tint
    'liquid-ether': `
${COMMON}
void main() {
  vec2 p = v_uv;
  vec2 uv = (p - 0.5) * vec2(u_resolution.x / u_resolution.y, 1.0) * u_scale;
  float t = u_time * 0.25;

  // Domain warp for fluid feel
  vec2 q = vec2(fbm(uv + vec2(0.0, t)), fbm(uv + vec2(5.2, 1.3) + t));
  vec2 r = vec2(fbm(uv + 4.0*q + vec2(1.7, 9.2) + 0.15*t),
                fbm(uv + 4.0*q + vec2(8.3, 2.8) + 0.13*t));
  float n = fbm(uv + 4.0*r);

  // Color blend driven by warped field
  vec3 col = mix(u_color0, u_color1, smoothstep(0.0, 0.6, n));
  col = mix(col, u_color2, smoothstep(0.4, 0.85, length(r) * 0.7));
  col = mix(col, u_color3, smoothstep(0.7, 1.0, n));

  // Iridescent rim
  float rim = pow(1.0 - smoothstep(0.0, 0.6, abs(n - 0.5)), 4.0) * u_intensity;
  col += rim * mix(u_color2, u_color3, 0.5);

  // Subtle vignette
  float vig = 1.0 - 0.4 * length(p - 0.5);
  col *= vig;

  fragColor = vec4(col, 1.0);
}`,

    // -----------------------------------------------------------
    // Iridescence: thin-film interference with shifting bands
    'iridescence': `
${COMMON}
void main() {
  vec2 p = v_uv;
  vec2 uv = (p - 0.5) * vec2(u_resolution.x / u_resolution.y, 1.0);
  float t = u_time * 0.3;

  // Sweep field (curved bands)
  float a = atan(uv.y, uv.x);
  float r = length(uv);
  float field = sin(r * 8.0 * u_scale - t * 2.0) * 0.5 + 0.5;
  field += 0.6 * sin(a * 3.0 + t + r * 6.0);
  field += 0.3 * fbm(uv * 3.0 + t * 0.5);
  field *= 0.4;

  // Map field to rainbow with shifting phase
  float hue = mod(field + t * 0.1 + u_seed, 1.0);
  vec3 col = hsl2rgb(vec3(hue, 0.7, 0.55));

  // Mix toward palette tint
  col = mix(col, u_color0, 0.25);
  col = mix(col, u_color1, smoothstep(0.6, 1.0, field) * 0.4);

  // Soft glow at center
  col += u_color2 * pow(1.0 - r, 3.0) * 0.4 * u_intensity;

  // Background tint
  col = mix(u_color3, col, 0.95);

  fragColor = vec4(col, 1.0);
}`,

    // -----------------------------------------------------------
    // Prismatic Burst: radial light rays + chromatic dispersion
    'prismatic-burst': `
${COMMON}
void main() {
  vec2 p = v_uv;
  vec2 uv = (p - 0.5) * vec2(u_resolution.x / u_resolution.y, 1.0);
  float r = length(uv);
  float a = atan(uv.y, uv.x);
  float t = u_time;

  // Many overlapping ray families that rotate at different speeds
  float rays = 0.0;
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    float ang = a + t * (0.05 + 0.04 * fi) + fi * 1.7;
    float n = 7.0 + 5.0 * fi;
    rays += pow(0.5 + 0.5 * cos(ang * n), 6.0) * (1.0 / (1.0 + fi));
  }
  rays *= smoothstep(0.0, 0.6, 1.0 - r);
  rays *= u_intensity;

  // Chromatic split — sample 3 hues offset by angle
  vec3 col = vec3(0.0);
  col += u_color0 * smoothstep(0.0, 0.8, rays * (0.9 + 0.1*sin(a*3.0 + t)));
  col += u_color1 * smoothstep(0.2, 1.0, rays * (0.9 + 0.1*sin(a*3.0 + t + 2.094)));
  col += u_color2 * smoothstep(0.4, 1.2, rays * (0.9 + 0.1*sin(a*3.0 + t + 4.188)));

  // Hot core
  float core = exp(-r * 8.0) * 1.5;
  col += core * mix(u_color2, vec3(1.0), 0.4);

  // Outer fade to background tint
  col = mix(u_color3, col, smoothstep(1.0, 0.2, r));

  fragColor = vec4(col, 1.0);
}`,

    // -----------------------------------------------------------
    // Lightning: procedural lightning bolts with branching glow
    'lightning': `
${COMMON}
// SDF: distance to a vertical "zig-zag" lightning bolt centered at x=cx
float bolt(vec2 uv, float seed, float t) {
  // Sample a chain of jitter points down the screen
  float y = uv.y;
  float x = uv.x;
  // Discretize y into segments
  float seg = 8.0;
  float yi = floor(y * seg);
  float yf = fract(y * seg);
  // Each segment has a random offset that drifts with time
  float a = hash21(vec2(seed, yi)) - 0.5;
  float b = hash21(vec2(seed, yi + 1.0)) - 0.5;
  float jitterA = (a + 0.2 * sin(t * 3.0 + yi * 1.7)) * 0.18;
  float jitterB = (b + 0.2 * sin(t * 3.0 + yi * 1.7 + 1.0)) * 0.18;
  float cx = mix(jitterA, jitterB, yf);
  float d = abs(x - cx);
  return d;
}

void main() {
  vec2 p = v_uv;
  vec2 uv = p - 0.5;
  uv.x *= u_resolution.x / u_resolution.y;
  float t = u_time;

  // 3 bolts at different x positions, flickering on/off
  vec3 col = vec3(0.0);
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float xOff = (fi - 1.0) * 0.35;
    vec2 buv = uv - vec2(xOff, 0.0);
    float seed = u_seed + fi * 17.0;
    // Flicker intensity
    float flick = step(0.55, hash21(vec2(seed, floor(t * 2.5)))) * (0.7 + 0.3 * sin(t * 30.0 + fi));
    float d = bolt(buv, seed, t);
    float core = exp(-d * 240.0) * flick;
    float glow = exp(-d * 14.0) * flick * 0.35;
    vec3 tint = i == 0 ? u_color0 : (i == 1 ? u_color1 : u_color2);
    col += core * vec3(1.0) + glow * tint;
  }

  // Background tint
  col = mix(u_color3, col + u_color3, 0.95);

  // Slight grain
  col += (hash21(p * u_resolution + t) - 0.5) * 0.03;

  fragColor = vec4(col, 1.0);
}`,

    // -----------------------------------------------------------
    // Plasma: classic organic warping plasma
    'plasma': `
${COMMON}
void main() {
  vec2 p = v_uv;
  vec2 uv = (p - 0.5) * vec2(u_resolution.x / u_resolution.y, 1.0) * u_scale;
  float t = u_time * 0.6;
  float v = 0.0;
  v += sin(uv.x * 6.0 + t);
  v += sin(uv.y * 7.0 + t * 1.3);
  v += sin((uv.x + uv.y) * 5.0 + t * 0.7);
  v += sin(length(uv) * 9.0 - t * 1.6);
  v *= 0.25;
  float n = v * 0.5 + 0.5;

  vec3 col = mix(u_color0, u_color1, n);
  col = mix(col, u_color2, smoothstep(0.4, 0.7, n));
  col += u_color3 * pow(1.0 - length(uv) * 0.4, 4.0) * 0.3 * u_intensity;
  fragColor = vec4(col, 1.0);
}`,

    // -----------------------------------------------------------
    // Meta Balls: classic isosurface threshold of N moving circles
    // with smooth gradient coloring + chromatic edge.
    'meta-balls': `
${COMMON}

// Hash to seed orbits deterministically
vec2 ballPos(int i, float t) {
  float fi = float(i);
  float ph = fi * 1.7 + u_seed;
  float r  = 0.22 + 0.12 * sin(t * 0.7 + ph);
  float a  = ph + t * (0.35 + 0.07 * fi);
  return vec2(0.5 + r * cos(a), 0.5 + r * sin(a));
}

void main() {
  vec2 p = v_uv;
  vec2 uv = p;
  uv.x *= u_resolution.x / u_resolution.y;
  float aspect = u_resolution.x / u_resolution.y;
  float t = u_time;
  const int N = 7;
  float field = 0.0;
  vec2 closestPos = vec2(0.0);
  float closestD = 1e6;
  for (int i = 0; i < N; i++) {
    vec2 c = ballPos(i, t);
    c.x *= aspect;
    float r = 0.10 + 0.03 * sin(t * 0.8 + float(i)) + u_scale * 0.03;
    float d = length(uv - c);
    field += (r * r) / max(d * d, 0.0001);
    if (d < closestD) { closestD = d; closestPos = c; }
  }
  float threshold = 1.4 / u_intensity;
  float k = smoothstep(threshold - 0.25, threshold + 0.25, field);

  // Color gradient inside the iso-surface based on distance to closest ball
  vec3 inner = mix(u_color1, u_color0, smoothstep(0.0, 0.2, closestD));
  inner = mix(inner, u_color2, smoothstep(0.15, 0.4, closestD));
  // chromatic edge highlight
  float edge = smoothstep(threshold + 0.1, threshold - 0.1, field) * smoothstep(threshold - 0.3, threshold, field);
  vec3 edgeCol = mix(u_color2, u_color3, 0.5);

  vec3 col = mix(u_color3, inner, k);
  col += edgeCol * edge * 1.2;

  // Soft vignette
  col *= 1.0 - 0.35 * length(p - 0.5);
  fragColor = vec4(col, 1.0);
}`,

    // -----------------------------------------------------------
    // Beams: crossing animated light beams
    'beams': `
${COMMON}
void main() {
  vec2 p = v_uv;
  vec2 uv = (p - 0.5);
  uv.x *= u_resolution.x / u_resolution.y;
  float t = u_time * 0.3;

  vec3 col = u_color3 * 0.5;
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    float ang = t * (0.15 + 0.08 * fi) + fi * 1.31;
    vec2 d = uv * rot(ang);
    float beam = exp(-abs(d.y) * 30.0) * (0.5 + 0.5 * sin(t * 2.0 + fi));
    vec3 tint = fi < 1.5 ? u_color0 : (fi < 3.5 ? u_color1 : u_color2);
    col += tint * beam * u_intensity;
  }

  // Soft center hot spot
  col += vec3(1.0) * exp(-length(uv) * 6.0) * 0.6;
  fragColor = vec4(col, 1.0);
}`,
  };

  // ---------- Compile helpers ----------------------------------
  function compile(gl, src, type) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error('[mvm:shader] compile error:\n', gl.getShaderInfoLog(s), '\n---SRC---\n', src);
      return null;
    }
    return s;
  }

  function buildProgram(gl, vsrc, fsrc) {
    const vs = compile(gl, vsrc, gl.VERTEX_SHADER);
    const fs = compile(gl, fsrc, gl.FRAGMENT_SHADER);
    if (!vs || !fs) return null;
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      console.error('[mvm:shader] link error:', gl.getProgramInfoLog(p));
      return null;
    }
    return p;
  }

  function hexToRgb(hex) {
    const h = hex.replace('#', '');
    const n = h.length === 3
      ? [h[0]+h[0], h[1]+h[1], h[2]+h[2]]
      : [h.slice(0,2), h.slice(2,4), h.slice(4,6)];
    return [parseInt(n[0],16)/255, parseInt(n[1],16)/255, parseInt(n[2],16)/255];
  }

  // ---------- Per-element setup --------------------------------
  function mount(el, shaderName) {
    let canvas = el.querySelector('canvas.mvm-shader-canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.className = 'mvm-shader-canvas';
      canvas.style.position = 'absolute';
      canvas.style.inset = '0';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.display = 'block';
      el.style.position = el.style.position || 'relative';
      el.appendChild(canvas);
    }
    const w = el.clientWidth  || 1920;
    const h = el.clientHeight || 1080;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    if (el.__mvmShaderName === shaderName && el.__mvmGL) return el.__mvmGL;

    const gl = canvas.getContext('webgl2', { alpha: true, antialias: false, premultipliedAlpha: false });
    if (!gl) {
      console.warn('[mvm:shader] webgl2 not available; skipping');
      return null;
    }

    const fsrc = '#version 300 es\n' + SHADERS[shaderName];
    const program = buildProgram(gl, VERT, fsrc);
    if (!program) return null;

    // Full-screen triangle covering NDC [-1,1]
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,  3, -1,  -1, 3,
    ]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(program, 'a_pos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    el.__mvmShaderName = shaderName;
    el.__mvmGL = {
      gl, program, canvas,
      uniforms: {
        u_resolution: gl.getUniformLocation(program, 'u_resolution'),
        u_time:       gl.getUniformLocation(program, 'u_time'),
        u_color0:     gl.getUniformLocation(program, 'u_color0'),
        u_color1:     gl.getUniformLocation(program, 'u_color1'),
        u_color2:     gl.getUniformLocation(program, 'u_color2'),
        u_color3:     gl.getUniformLocation(program, 'u_color3'),
        u_intensity:  gl.getUniformLocation(program, 'u_intensity'),
        u_scale:      gl.getUniformLocation(program, 'u_scale'),
        u_seed:       gl.getUniformLocation(program, 'u_seed'),
      },
    };
    return el.__mvmGL;
  }

  function applyShader(el, t) {
    const name = el.dataset.background;
    if (!SHADERS[name]) return;
    const ctx = mount(el, name);
    if (!ctx) return;
    const { gl, program, canvas, uniforms } = ctx;

    const w = canvas.width, h = canvas.height;
    gl.viewport(0, 0, w, h);
    gl.useProgram(program);

    // Parse author-defined palette (4 stops), fallback to a sensible default
    const colors = (el.dataset.colors || '#1a1a2a,#5b86e5,#86A8E7,#0a0a16').split(',');
    const getCol = i => hexToRgb((colors[i] || colors[colors.length - 1]).trim());

    gl.uniform2f(uniforms.u_resolution, w, h);
    gl.uniform1f(uniforms.u_time, t);
    gl.uniform3fv(uniforms.u_color0, getCol(0));
    gl.uniform3fv(uniforms.u_color1, getCol(1));
    gl.uniform3fv(uniforms.u_color2, getCol(2));
    gl.uniform3fv(uniforms.u_color3, getCol(3));
    gl.uniform1f(uniforms.u_intensity, parseFloat(el.dataset.intensity) || 1.0);
    gl.uniform1f(uniforms.u_scale,     parseFloat(el.dataset.scale)     || 1.0);
    gl.uniform1f(uniforms.u_seed,      parseFloat(el.dataset.seed)      || 0.0);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // ---------- Register backgrounds with the components system --
  function registerShaders() {
    if (!window.__mvm || !window.__mvm.components) return;
    Object.keys(SHADERS).forEach(name => {
      window.__mvm.components.BG[name] = applyShader;
    });
    window.__mvm.components.refresh();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', registerShaders);
  } else {
    registerShaders();
  }

  // Expose for advanced authors
  window.__mvmShaders = { SHADERS, mount, apply: applyShader };
})();
