/* ==========================================================================
   frame3d.js — decorative 3D "space frame" (double-layer octet truss)
   Rendered with a hand-rolled perspective projection on a 2D canvas: no WebGL,
   ~500 line segments, batched by depth into a handful of strokes per frame.
   Purely illustrative — it is not a model of any real project.
   ========================================================================== */
(function () {
  'use strict';

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  function SpaceFrame(canvas, options) {
    var o = options || {};
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.reduced = !!o.reduced;
    this.light = o.tone === 'light';   // drawn on a pale "paper" ground
    this.centerX = o.centerX || 0.6;   // horizontal centre on wide screens (0..1)
    this.progress = 0;         // scroll progress (0..1), set from outside
    this.build = this.reduced ? 1 : 0; // assembly progress (0..1)
    this.buildTarget = this.reduced ? 1 : 0;
    this.mx = 0; this.my = 0;  // pointer target (-1..1)
    this.cmx = 0; this.cmy = 0; // eased pointer
    this.time = 0;
    this.running = false;
    this.visible = true;
    this._raf = 0;
    this._last = 0;
    this._tick = this._tick.bind(this);
    this._onResize = this.resize.bind(this);
    this._onPointer = this._pointer.bind(this);
    this._onVisibility = this._visibility.bind(this);

    this.resize();
    this._geometry();

    if ('ResizeObserver' in window) {
      this._ro = new ResizeObserver(this._onResize);
      this._ro.observe(canvas);
    } else {
      window.addEventListener('resize', this._onResize);
    }
    if ('IntersectionObserver' in window) {
      var self = this;
      this._io = new IntersectionObserver(function (entries) {
        self.visible = entries[0].isIntersecting;
        self._sync();
      }, { threshold: 0 });
      this._io.observe(canvas);
    }
    if (!this.reduced && window.matchMedia('(pointer: fine)').matches) {
      window.addEventListener('pointermove', this._onPointer, { passive: true });
    }
    document.addEventListener('visibilitychange', this._onVisibility);
    this.render();
  }

  SpaceFrame.prototype._geometry = function () {
    var small = this.w < 768;
    var N = small ? 6 : 9;          // top-layer cells per side
    var s = 1, h = 0.72;
    var half = (N * s) / 2;
    var nodes = [], edges = [];
    var top = [], bot = [];
    var i, j;

    for (i = 0; i <= N; i++) {
      top[i] = [];
      for (j = 0; j <= N; j++) { top[i][j] = nodes.length; nodes.push([i * s - half, 0, j * s - half, 0]); }
    }
    for (i = 0; i < N; i++) {
      bot[i] = [];
      for (j = 0; j < N; j++) { bot[i][j] = nodes.length; nodes.push([(i + 0.5) * s - half, -h, (j + 0.5) * s - half, 1]); }
    }
    // chords: type 0 (top), type 1 (bottom), type 2 (diagonal web members)
    for (i = 0; i <= N; i++) for (j = 0; j <= N; j++) {
      if (i < N) edges.push([top[i][j], top[i + 1][j], 0]);
      if (j < N) edges.push([top[i][j], top[i][j + 1], 0]);
    }
    for (i = 0; i < N; i++) for (j = 0; j < N; j++) {
      if (i < N - 1) edges.push([bot[i][j], bot[i + 1][j], 1]);
      if (j < N - 1) edges.push([bot[i][j], bot[i][j + 1], 1]);
      edges.push([bot[i][j], top[i][j], 2], [bot[i][j], top[i + 1][j], 2], [bot[i][j], top[i][j + 1], 2], [bot[i][j], top[i + 1][j + 1], 2]);
    }
    // Assembly order: sweep from one corner so the frame "erects" diagonally.
    var corner = [-half, 0, -half];
    edges.forEach(function (e) {
      var a = nodes[e[0]], b = nodes[e[1]];
      var mx = (a[0] + b[0]) / 2 - corner[0], mz = (a[2] + b[2]) / 2 - corner[2];
      e[3] = Math.sqrt(mx * mx + mz * mz) / (half * 2 * Math.SQRT2) + (e[2] === 2 ? 0.06 : 0);
    });
    edges.sort(function (a, b) { return a[3] - b[3]; });

    this.N = N; this.nodes = nodes; this.edges = edges;
    this.proj = new Float32Array(nodes.length * 3);
  };

  SpaceFrame.prototype.resize = function () {
    var r = this.canvas.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    var prevSmall = this.w < 768;
    this.w = Math.max(1, r.width); this.h = Math.max(1, r.height);
    this.dpr = dpr;
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (this.nodes && prevSmall !== (this.w < 768)) this._geometry();
    if (!this.running) this.render();
  };

  SpaceFrame.prototype._pointer = function (e) {
    this.mx = (e.clientX / window.innerWidth) * 2 - 1;
    this.my = (e.clientY / window.innerHeight) * 2 - 1;
  };

  SpaceFrame.prototype._visibility = function () { this._sync(); };

  SpaceFrame.prototype._sync = function () {
    var should = !this.reduced && this.visible && !document.hidden && this.started;
    if (should && !this.running) { this.running = true; this._last = performance.now(); this._raf = requestAnimationFrame(this._tick); }
    else if (!should && this.running) { this.running = false; cancelAnimationFrame(this._raf); }
  };

  SpaceFrame.prototype.start = function () {
    this.started = true;
    this.buildTarget = 1;
    if (this.reduced) { this.build = 1; this.render(); return; }
    this._sync();
  };

  SpaceFrame.prototype.setProgress = function (p) {
    this.progress = clamp(p, 0, 1);
    if (!this.running) this.render();
  };

  SpaceFrame.prototype._tick = function (now) {
    if (!this.running) return;
    var dt = Math.min(0.05, (now - this._last) / 1000);
    this._last = now;
    this.time += dt;
    this.build = lerp(this.build, this.buildTarget, 1 - Math.pow(0.0009, dt)); // ~2s ease
    this.cmx = lerp(this.cmx, this.mx, 1 - Math.pow(0.02, dt));
    this.cmy = lerp(this.cmy, this.my, 1 - Math.pow(0.02, dt));
    this.render();
    this._raf = requestAnimationFrame(this._tick);
  };

  SpaceFrame.prototype.render = function () {
    var ctx = this.ctx, w = this.w, h = this.h;
    if (!this.nodes) return;
    ctx.clearRect(0, 0, w, h);

    var p = this.progress;
    var small = w < 768;
    var yaw = -0.62 + this.time * 0.035 + this.cmx * 0.16 + p * 0.5;
    var pitch = 0.5 + p * 0.55 + this.cmy * 0.06;
    var dist = this.N * (small ? 1.5 : 1.55) * (1 - p * 0.28);
    var f = Math.min(w, h) * (small ? 1.15 : 1.05);
    var cx = small ? w * 0.5 : w * this.centerX - p * w * 0.1;
    var cy = small ? h * 0.3 : h * 0.5 + p * h * 0.05;

    var cy1 = Math.cos(yaw), sy1 = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    var nodes = this.nodes, proj = this.proj, i, n, x, y, z, x1, z1, y2, z2;
    for (i = 0; i < nodes.length; i++) {
      n = nodes[i];
      x = n[0]; y = n[1] + 0.36; z = n[2];
      x1 = x * cy1 - z * sy1;
      z1 = x * sy1 + z * cy1;
      y2 = y * cp - z1 * sp;
      z2 = y * sp + z1 * cp + dist;
      if (z2 < 0.1) z2 = 0.1;
      proj[i * 3] = cx + (x1 * f) / z2;
      proj[i * 3 + 1] = cy - (y2 * f) / z2;
      proj[i * 3 + 2] = z2;
    }

    // Depth buckets → few strokes per frame.
    var B = 5, zNear = dist - this.N * 0.75, zFar = dist + this.N * 0.75;
    var gold = [], web = [], k;
    for (k = 0; k < B; k++) { gold.push([]); web.push([]); }
    var edges = this.edges, count = Math.floor(edges.length * this.build), e, a, b, depth, bucket;
    for (i = 0; i < count; i++) {
      e = edges[i]; a = e[0] * 3; b = e[1] * 3;
      depth = (proj[a + 2] + proj[b + 2]) * 0.5;
      bucket = clamp(Math.floor(((depth - zNear) / (zFar - zNear)) * B), 0, B - 1);
      (e[2] === 2 ? web : gold)[bucket].push(proj[a], proj[a + 1], proj[b], proj[b + 1]);
    }

    var fade = 1 - p * 0.55;
    ctx.lineCap = 'round';
    var goldRGB = this.light ? '166,138,31' : '201,169,58';
    var webRGB = this.light ? '43,47,54' : '243,239,230';
    var gA = this.light ? 0.4 : 0.55, wA = this.light ? 0.14 : 0.2;
    for (k = 0; k < B; k++) {
      var t = 1 - k / (B - 1); // near → 1, far → 0
      this._stroke(gold[k], 'rgba(' + goldRGB + ',' + (0.08 + t * gA) * fade + ')', small ? 0.9 : 1.1);
      this._stroke(web[k], 'rgba(' + webRGB + ',' + (0.03 + t * wA) * fade + ')', 0.7);
    }

    // Node "bolts" on the top layer.
    ctx.fillStyle = 'rgba(' + goldRGB + ',' + (this.light ? 0.6 : 0.8) * fade + ')';
    var shown = Math.floor(nodes.length * this.build);
    for (i = 0; i < shown; i++) {
      if (nodes[i][3] !== 0) continue;
      var sz = clamp(4.2 - (proj[i * 3 + 2] - zNear) / (zFar - zNear) * 3, 1, 4);
      ctx.fillRect(proj[i * 3] - sz / 2, proj[i * 3 + 1] - sz / 2, sz, sz);
    }
  };

  SpaceFrame.prototype._stroke = function (segs, color, width) {
    if (!segs.length) return;
    var ctx = this.ctx;
    ctx.beginPath();
    for (var i = 0; i < segs.length; i += 4) { ctx.moveTo(segs[i], segs[i + 1]); ctx.lineTo(segs[i + 2], segs[i + 3]); }
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
  };

  SpaceFrame.prototype.destroy = function () {
    this.running = false; cancelAnimationFrame(this._raf);
    if (this._ro) this._ro.disconnect(); else window.removeEventListener('resize', this._onResize);
    if (this._io) this._io.disconnect();
    window.removeEventListener('pointermove', this._onPointer);
    document.removeEventListener('visibilitychange', this._onVisibility);
  };

  window.SpaceFrame = SpaceFrame;
})();
