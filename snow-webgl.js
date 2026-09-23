// Visual approach adapted for this 2D page from React Cinematic Snow (MIT)
// and Inkwell WebGPU Sand / Cryos (MIT). Particle physics and snow heights
// remain in snow.js so accumulation and clearing share the same data.
(() => {
  const vertex = `
    attribute vec2 a_position;
    attribute float a_size;
    attribute float a_alpha;
    attribute float a_seed;
    attribute float a_angle;
    attribute float a_layer;
    uniform vec2 u_resolution;
    uniform float u_dpr;
    varying float v_alpha;
    varying float v_seed;
    varying float v_angle;
    varying float v_layer;
    void main() {
      vec2 clip = a_position / u_resolution * 2.0 - 1.0;
      gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
      gl_PointSize = a_size * u_dpr;
      v_alpha = a_alpha;
      v_seed = a_seed;
      v_angle = a_angle;
      v_layer = a_layer;
    }
  `;

  const particles = `
    precision mediump float;
    varying float v_alpha;
    varying float v_seed;
    varying float v_angle;
    varying float v_layer;
    float hash(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
    void main() {
      vec2 p = gl_PointCoord - 0.5;
      float c = cos(v_angle), s = sin(v_angle);
      p = mat2(c, -s, s, c) * p;
      float r = length(p);
      float angle = atan(p.y, p.x);
      float lobes = 5.0 + floor(hash(v_seed * 3.7) * 4.0);
      float facet = cos((fract(angle / 6.2831853 * lobes + 0.5) - 0.5) * 6.2831853 / lobes);
      float uneven = 0.94 + 0.08 * sin(angle * lobes + v_seed * 2.1)
                           + 0.045 * sin(angle * (lobes + 3.0) - v_seed);
      float radius = v_layer < 0.5 ? 0.30 : (v_layer < 1.5 ? 0.36 : 0.39 * facet * uneven);
      float softness = v_layer < 0.5 ? 0.22 : (v_layer < 1.5 ? 0.12 : 0.055);
      float shape = 1.0 - smoothstep(radius - softness, radius + softness, r);
      if (shape < 0.01) discard;
      float core = 1.0 - smoothstep(0.0, radius, r);
      vec3 blue = vec3(0.54, 0.72, 0.84);
      vec3 white = vec3(0.98, 0.995, 1.0);
      vec3 color = mix(blue, white, 0.32 + core * 0.54 + v_layer * 0.045);
      gl_FragColor = vec4(color, shape * v_alpha);
    }
  `;

  const quadVertex = `
    attribute vec2 a_corner;
    void main() { gl_Position = vec4(a_corner, 0.0, 1.0); }
  `;

  const material = `
    precision highp float;
    uniform sampler2D u_heights;
    uniform vec2 u_resolution;
    uniform float u_dpr;
    uniform float u_max_height;
    uniform float u_time;
    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                 mix(hash(i + vec2(0.0, 1.0)), hash(i + 1.0), f.x), f.y);
    }
    float surface(float x) {
      return texture2D(u_heights, vec2(clamp(x / u_resolution.x, 0.0, 1.0), 0.5)).r * u_max_height;
    }
    void main() {
      vec2 p = vec2(gl_FragCoord.x / u_dpr, gl_FragCoord.y / u_dpr);
      float h = surface(p.x);
      float inside = h - p.y;
      if (h < 0.4 || inside < -32.0) discard;
      if (inside < 0.0) {
        float shadow = exp(inside / 11.0) * 0.16;
        gl_FragColor = vec4(0.25, 0.43, 0.55, shadow);
        return;
      }
      float depth = clamp(inside / max(h, 1.0), 0.0, 1.0);
      float slope = (surface(p.x + 3.0) - surface(p.x - 3.0)) / 6.0;
      float broad = noise(p * vec2(0.009, 0.021));
      float powder = noise(p * 0.10);
      float grain = hash(floor(p * 1.45));
      float ripple = sin(p.x * 0.077 + p.y * 0.035 + broad * 2.3);
      float crest = exp(-inside / 17.0);
      vec3 shade = vec3(0.875, 0.940, 0.974);
      shade += vec3(0.065, 0.052, 0.028) * (1.0 - depth);
      shade += vec3(0.036, 0.040, 0.031) * broad;
      shade += vec3(0.015, 0.020, 0.025) * powder;
      shade += vec3(0.012) * ripple * (1.0 - depth * 0.65);
      shade += vec3(0.045, 0.043, 0.029) * crest;
      shade -= vec3(0.035, 0.029, 0.021) * max(-slope, 0.0);
      shade += vec3(0.012, 0.019, 0.027) * (grain - 0.5);
      float sweep = mod(u_time * 29.0, u_resolution.x + 450.0) - 225.0;
      shade += vec3(0.020, 0.025, 0.028) * exp(-pow((p.x - sweep) / 135.0, 2.0)) * (1.0 - depth);
      vec2 cell = floor(p / 7.0);
      vec2 sparkleCenter = vec2(hash(cell + 19.3), hash(cell + 48.1)) * 7.0;
      float sparkle = 1.0 - smoothstep(0.1, 1.25, length(mod(p, 7.0) - sparkleCenter));
      float chance = step(0.979, hash(cell + 71.5));
      float twinkle = 0.55 + 0.45 * sin(u_time * 2.0 + hash(cell) * 20.0);
      shade += vec3(0.065, 0.085, 0.098) * sparkle * chance * twinkle * (1.0 - depth * 0.72);
      float edge = smoothstep(0.0, 2.4, inside);
      gl_FragColor = vec4(clamp(shade, 0.0, 1.0), edge);
    }
  `;

  function compile(gl, type, source) {
    const shader = gl.createShader(type);
    if (!shader) throw new Error('WebGL shader unavailable');
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const error = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(error || 'WebGL shader compilation failed');
    }
    return shader;
  }

  function program(gl, vert, frag) {
    const result = gl.createProgram();
    if (!result) throw new Error('WebGL program unavailable');
    const vs = compile(gl, gl.VERTEX_SHADER, vert);
    const fs = compile(gl, gl.FRAGMENT_SHADER, frag);
    gl.attachShader(result, vs);
    gl.attachShader(result, fs);
    gl.linkProgram(result);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(result, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(result) || 'WebGL program link failed');
    }
    return result;
  }

  window.createSnowWebglRenderer = canvas => {
    let gl;
    try {
      gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false, antialias: true });
      if (!gl) return null;
      const snowProgram = program(gl, quadVertex, material);
      const flakeProgram = program(gl, vertex, particles);
      const quad = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
      const flakeBuffer = gl.createBuffer();
      const heightTexture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, heightTexture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const maxHeight = 320;
      let dpr = 1;
      let working = true;
      canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); working = false; });

      function resize(width, height) {
        dpr = Math.min(devicePixelRatio || 1, 1.5);
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        gl.viewport(0, 0, canvas.width, canvas.height);
      }

      function render(flakes, heights, width, height, now) {
        if (!working) return false;
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        const pixels = new Uint8Array(heights.length * 4);
        for (let i = 0; i < heights.length; i++) {
          pixels[i * 4] = Math.round(Math.min(1, heights[i] / maxHeight) * 255);
          pixels[i * 4 + 3] = 255;
        }
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, heightTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, heights.length, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        gl.useProgram(snowProgram);
        gl.uniform1i(gl.getUniformLocation(snowProgram, 'u_heights'), 0);
        gl.uniform2f(gl.getUniformLocation(snowProgram, 'u_resolution'), width, height);
        gl.uniform1f(gl.getUniformLocation(snowProgram, 'u_dpr'), dpr);
        gl.uniform1f(gl.getUniformLocation(snowProgram, 'u_max_height'), maxHeight);
        gl.uniform1f(gl.getUniformLocation(snowProgram, 'u_time'), now / 1000);
        gl.bindBuffer(gl.ARRAY_BUFFER, quad);
        const corner = gl.getAttribLocation(snowProgram, 'a_corner');
        gl.enableVertexAttribArray(corner);
        gl.vertexAttribPointer(corner, 2, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        gl.disableVertexAttribArray(corner);

        if (flakes.length) {
          const data = new Float32Array(flakes.length * 7);
          flakes.forEach((flake, i) => {
            data.set([flake.x, flake.y, flake.size, flake.displayAlpha, flake.seed, flake.angle, flake.layer], i * 7);
          });
          gl.useProgram(flakeProgram);
          gl.uniform2f(gl.getUniformLocation(flakeProgram, 'u_resolution'), width, height);
          gl.uniform1f(gl.getUniformLocation(flakeProgram, 'u_dpr'), dpr);
          gl.bindBuffer(gl.ARRAY_BUFFER, flakeBuffer);
          gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
          for (const [name, offset] of [['a_position', 0], ['a_size', 8], ['a_alpha', 12], ['a_seed', 16], ['a_angle', 20], ['a_layer', 24]]) {
            const location = gl.getAttribLocation(flakeProgram, name);
            gl.enableVertexAttribArray(location);
            gl.vertexAttribPointer(location, name === 'a_position' ? 2 : 1, gl.FLOAT, false, 28, offset);
          }
          gl.drawArrays(gl.POINTS, 0, flakes.length);
        }
        return true;
      }
      return { resize, render, get available() { return working; } };
    } catch (error) {
      console.warn('Snow WebGL unavailable; using Canvas fallback.', error);
      canvas.hidden = true;
      return null;
    }
  };
})();
