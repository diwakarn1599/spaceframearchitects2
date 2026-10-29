/* ==========================================================================
   house3d.js — interactive 3D massing model (canvas wireframe, no WebGL)
   A simplified massing of the contemporary house shown in the hero: tall side
   wall, porch, cantilevered balcony box, sloped brick wing and fin.
   Drag (touch or mouse) or use the arrow keys to rotate. Illustrative only.
   ========================================================================== */
(function () {
  'use strict';

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function House3D(canvas, options) {
    var o = options || {};
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.reduced = !!o.reduced;
    this.yaw = -0.62; this.pitch = 0.3;
    this.vyaw = 0;                       // spin velocity (drag inertia)
    this.auto = this.reduced ? 0 : 0.18; // idle rotation, rad/s
    this.build = this.reduced ? 1 : 0;
    this.lights = this.reduced ? 1 : 0;
    this.running = false; this.visible = false; this.started = false;
    this._geometry();
    this._bind();
    this.resize();
  }

  House3D.prototype._geometry = function () {
    var V = [], E = [], F = [];
    function v(x, y, z) { V.push([x, y, z]); return V.length - 1; }
    function box(x0, x1, y0, y1, z0, z1, kind) {
      var a = v(x0, y0, z0), b = v(x1, y0, z0), c = v(x1, y0, z1), d = v(x0, y0, z1),
          e = v(x0, y1, z0), f = v(x1, y1, z0), g = v(x1, y1, z1), h = v(x0, y1, z1);
      [[a, b], [b, c], [c, d], [d, a], [e, f], [f, g], [g, h], [h, e], [a, e], [b, f], [c, g], [d, h]]
        .forEach(function (p) { E.push([p[0], p[1], kind || 0]); });
    }
    function quad(pts, kind) { F.push({ p: pts.map(function (q) { return v(q[0], q[1], q[2]); }), kind: kind }); }

    // Massing (metres-ish). y is up; +z faces the street.
    box(-6.2, -3.2, 0, 8.6, -2.6, 2.6, 0);          // tall plain side wall
    box(-3.2, 3.2, 0, 3.0, -2.6, 2.4, 0);           // ground floor / porch
    box(-3.4, 1.5, 3.2, 6.4, -2.6, 2.9, 0);         // cantilevered balcony box
    box(-3.2, 1.3, 3.0, 3.2, -2.4, 2.4, 1);         // slab
    box(1.5, 3.2, 0, 6.4, -2.6, 1.6, 2);            // brick wing body
    box(3.2, 3.5, 0, 9.8, -2.7, 2.7, 0);            // fin
    // sloped brick wedge (triangle in elevation, extruded in depth)
    var w1 = v(-0.6, 6.4, -2.6), w2 = v(3.2, 9.6, -2.6), w3 = v(3.2, 6.4, -2.6),
        w4 = v(-0.6, 6.4, 1.6), w5 = v(3.2, 9.6, 1.6), w6 = v(3.2, 6.4, 1.6);
    [[w1, w2], [w2, w3], [w3, w1], [w4, w5], [w5, w6], [w6, w4], [w1, w4], [w2, w5], [w3, w6]]
      .forEach(function (p) { E.push([p[0], p[1], 2]); });
    box(-8.5, 8.5, 0, 1.1, 3.4, 3.65, 1);           // boundary wall
    // gate louvres
    for (var gy = 0.2; gy < 1.1; gy += 0.22) { var g1 = v(0.2, gy, 3.66), g2 = v(3.0, gy, 3.66); E.push([g1, g2, 3]); }

    // windows (filled when lights come on) — on the street face
    quad([[-0.8, 3.8, 2.91], [1.3, 3.8, 2.91], [1.3, 5.9, 2.91], [-0.8, 5.9, 2.91]], 'win');
    quad([[-3.1, 3.6, 2.91], [-1.0, 3.6, 2.91], [-1.0, 4.8, 2.91], [-3.1, 4.8, 2.91]], 'warm');
    quad([[-2.4, 0.2, 2.41], [-1.2, 0.2, 2.41], [-1.2, 2.4, 2.41], [-2.4, 2.4, 2.41]], 'win');
    quad([[-0.9, 1.2, 2.41], [0.2, 1.2, 2.41], [0.2, 2.4, 2.41], [-0.9, 2.4, 2.41]], 'win');
    quad([[1.9, 4.2, 1.61], [2.6, 4.2, 1.61], [2.6, 5.6, 1.61], [1.9, 5.6, 1.61]], 'win');

    // window frames as edges
    F.forEach(function (f) { for (var k = 0; k < 4; k++) E.push([f.p[k], f.p[(k + 1) % 4], 3]); });

    // ground grid
    var grid = [];
    for (var gx = -10; gx <= 10; gx += 2) grid.push([v(gx, 0, -6), v(gx, 0, 6)]);
    for (var gz = -6; gz <= 6; gz += 2) grid.push([v(-10, 0, gz), v(10, 0, gz)]);

    // build order: from the ground up
    E.forEach(function (e) { e[3] = Math.min(V[e[0]][1], V[e[1]][1]) / 10; });
    E.sort(function (a, b) { return a[3] - b[3]; });

    this.V = V; this.E = E; this.F = F; this.G = grid;
    this.P = new Float32Array(V.length * 3);
  };

  House3D.prototype._bind = function () {
    var self = this, c = this.canvas, drag = null;
    c.style.touchAction = 'pan-y';
    c.addEventListener('pointerdown', function (e) {
      drag = { x: e.clientX, y: e.clientY, t: performance.now(), lastX: e.clientX, decided: false };
      self.auto = 0; self.vyaw = 0;
    });
    c.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.decided) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        drag.decided = true;
        if (Math.abs(dy) > Math.abs(dx)) { drag = null; return; }   // vertical: let the page scroll
        try { c.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
      }
      var now = performance.now(), mx = e.clientX - drag.lastX;
      self.yaw += mx * 0.012;
      self.pitch = clamp(self.pitch + (e.movementY || 0) * 0.004, 0.08, 0.75);
      self.vyaw = (mx * 0.012) / Math.max(0.008, (now - drag.t) / 1000);
      drag.lastX = e.clientX; drag.t = now;
      if (!self.running) self.render();
    });
    function end() { if (!drag) return; drag = null; setTimeout(function () { if (!self.reduced) self.auto = 0.18; }, 2500); }
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    c.addEventListener('keydown', function (e) {
      var k = e.key;
      if (k === 'ArrowLeft' || k === 'ArrowRight') { self.yaw += (k === 'ArrowLeft' ? -0.25 : 0.25); e.preventDefault(); }
      else if (k === 'ArrowUp' || k === 'ArrowDown') { self.pitch = clamp(self.pitch + (k === 'ArrowUp' ? 0.08 : -0.08), 0.08, 0.75); e.preventDefault(); }
      else return;
      self.auto = 0; if (!self.running) self.render();
    });
    if ('ResizeObserver' in window) new ResizeObserver(function () { self.resize(); }).observe(c);
    else window.addEventListener('resize', function () { self.resize(); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { self.visible = en[0].isIntersecting; if (self.visible) self.started = true; self._sync(); }, { threshold: 0.15 }).observe(c);
    } else { this.visible = true; this.started = true; }
    document.addEventListener('visibilitychange', function () { self._sync(); });
  };

  House3D.prototype.resize = function () {
    var r = this.canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = Math.max(1, r.width); this.h = Math.max(1, r.height);
    this.canvas.width = Math.round(this.w * dpr); this.canvas.height = Math.round(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.render();
  };

  House3D.prototype._sync = function () {
    var should = this.visible && !document.hidden && this.started;
    if (this.reduced) { if (should) this.render(); return; }   // static; drags still re-render
    var self = this;
    if (should && !this.running) {
      this.running = true; this._last = performance.now();
      var tick = function (now) {
        if (!self.running) return;
        var dt = Math.min(0.05, (now - self._last) / 1000); self._last = now;
        if (!self.reduced) {
          self.build = Math.min(1, self.build + dt / 2.2);
          if (self.build >= 1) self.lights = Math.min(1, self.lights + dt / 1.2);
        } else { self.build = 1; self.lights = 1; }
        self.yaw += (self.auto + self.vyaw) * dt;
        self.vyaw *= Math.pow(0.04, dt);              // inertia decay
        if (Math.abs(self.vyaw) < 0.002) self.vyaw = 0;
        self.render();
        self._raf = requestAnimationFrame(tick);
      };
      this._raf = requestAnimationFrame(tick);
    } else if (!should && this.running) { this.running = false; cancelAnimationFrame(this._raf); }
  };

  House3D.prototype.render = function () {
    var ctx = this.ctx, w = this.w, h = this.h, V = this.V, P = this.P;
    ctx.clearRect(0, 0, w, h);
    var cy = Math.cos(this.yaw), sy = Math.sin(this.yaw), cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    var dist = 30, f = Math.min(w, h * 1.25) * 1.45, ox = w * 0.5, oy = h * 0.62;
    for (var i = 0; i < V.length; i++) {
      var x = V[i][0], y = V[i][1] - 4.2, z = V[i][2];
      var x1 = x * cy - z * sy, z1 = x * sy + z * cy;
      var y2 = y * cp - z1 * sp, z2 = y * sp + z1 * cp + dist;
      P[i * 3] = ox + (x1 * f) / z2; P[i * 3 + 1] = oy - (y2 * f) / z2; P[i * 3 + 2] = z2;
    }
    var zn = dist - 9, zf = dist + 9;
    function alpha(z) { return clamp(1 - (z - zn) / (zf - zn), 0.12, 1); }

    // ground grid
    ctx.lineWidth = 1;
    this.G.forEach(function (g) {
      var a = g[0] * 3, b = g[1] * 3;
      ctx.strokeStyle = 'rgba(201,169,58,' + (0.1 * alpha((P[a + 2] + P[b + 2]) / 2)) + ')';
      ctx.beginPath(); ctx.moveTo(P[a], P[a + 1]); ctx.lineTo(P[b], P[b + 1]); ctx.stroke();
    });

    // lit windows (after the build)
    var L = this.lights;
    if (L > 0) {
      this.F.forEach(function (fc) {
        var p = fc.p;
        ctx.beginPath();
        ctx.moveTo(P[p[0] * 3], P[p[0] * 3 + 1]);
        for (var k = 1; k < 4; k++) ctx.lineTo(P[p[k] * 3], P[p[k] * 3 + 1]);
        ctx.closePath();
        ctx.fillStyle = fc.kind === 'warm' ? 'rgba(217,138,43,' + 0.55 * L + ')' : 'rgba(255,205,120,' + 0.8 * L + ')';
        ctx.shadowColor = 'rgba(255,190,90,' + 0.8 * L + ')'; ctx.shadowBlur = 14 * L;
        ctx.fill();
      });
      ctx.shadowBlur = 0;
    }

    // edges, ground-up build
    var colors = ['243,239,230', '201,169,58', '216,140,96', '243,239,230'];
    var widths = [1.4, 1.1, 1.2, 0.8];
    var count = Math.floor(this.E.length * this.build);
    for (var e = 0; e < count; e++) {
      var E = this.E[e], a = E[0] * 3, b = E[1] * 3, k = E[2];
      var al = alpha((P[a + 2] + P[b + 2]) / 2) * (k === 3 ? 0.55 : 0.95);
      ctx.strokeStyle = 'rgba(' + colors[k] + ',' + al + ')';
      ctx.lineWidth = widths[k];
      ctx.beginPath(); ctx.moveTo(P[a], P[a + 1]); ctx.lineTo(P[b], P[b + 1]); ctx.stroke();
    }
  };

  window.House3D = House3D;
})();
