/* =====================================================================
 * plot.js — Canvas-Graphenplotter
 * Zeichnet Funktionsgraph, Achsen/Gitter, markante Punkte, Tangente,
 * Normale, Asymptoten und schraffierte Flächen.
 * ===================================================================== */
(function (global) {
  'use strict';

  function Plotter(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.view = { xmin: -8, xmax: 8, ymin: -6, ymax: 6 };
    this.layers = {};        // optionale Overlays
  }

  Plotter.prototype.setView = function (v) {
    this.view = Object.assign({}, this.view, v);
  };

  /** Datenraum -> Pixel. */
  Plotter.prototype.px = function (x) {
    const { xmin, xmax } = this.view;
    return (x - xmin) / (xmax - xmin) * this.canvas.width;
  };
  Plotter.prototype.py = function (y) {
    const { ymin, ymax } = this.view;
    return this.canvas.height - (y - ymin) / (ymax - ymin) * this.canvas.height;
  };

  /** Automatischer Ausschnitt auf Basis interessanter Punkte. */
  Plotter.prototype.autoView = function (f, t, points) {
    let xs = [], ys = [];
    (points || []).forEach(p => { if (isFinite(p.x)) xs.push(p.x); if (isFinite(p.y)) ys.push(p.y); });
    let xmin = xs.length ? Math.min(...xs) : -5;
    let xmax = xs.length ? Math.max(...xs) : 5;
    if (xmax - xmin < 4) { const c = (xmax + xmin) / 2; xmin = c - 4; xmax = c + 4; }
    const padX = (xmax - xmin) * 0.35 + 1;
    xmin -= padX; xmax += padX;
    // y aus Abtastung
    const N = 400;
    for (let i = 0; i <= N; i++) {
      const x = xmin + (xmax - xmin) * i / N;
      const y = f(x, t);
      if (isFinite(y) && Math.abs(y) < 1e6) ys.push(y);
    }
    let ymin = ys.length ? Math.min(...ys) : -5;
    let ymax = ys.length ? Math.max(...ys) : 5;
    if (ymax - ymin < 3) { const c = (ymax + ymin) / 2; ymin = c - 3; ymax = c + 3; }
    const padY = (ymax - ymin) * 0.18 + 0.5;
    ymin -= padY; ymax += padY;
    // y-Bereich begrenzen (Pole)
    const span = ymax - ymin;
    if (span > 40) {
      const med = ys.sort((a, b) => a - b)[Math.floor(ys.length / 2)] || 0;
      ymin = med - 12; ymax = med + 12;
    }
    this.setView({ xmin, xmax, ymin, ymax });
  };

  function niceStep(range) {
    const raw = range / 10;
    const pow = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw / pow;
    let step;
    if (n < 1.5) step = 1; else if (n < 3) step = 2; else if (n < 7) step = 5; else step = 10;
    return step * pow;
  }

  Plotter.prototype.clear = function () {
    const { ctx, canvas } = this;
    ctx.fillStyle = '#0c1116';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  Plotter.prototype.drawGrid = function () {
    const { ctx } = this;
    const { xmin, xmax, ymin, ymax } = this.view;
    const sx = niceStep(xmax - xmin), sy = niceStep(ymax - ymin);
    ctx.lineWidth = 1;
    ctx.font = '11px Consolas, monospace';
    // Gitter
    ctx.strokeStyle = 'rgba(120,140,160,0.12)';
    for (let x = Math.ceil(xmin / sx) * sx; x <= xmax; x += sx) {
      ctx.beginPath(); ctx.moveTo(this.px(x), 0); ctx.lineTo(this.px(x), this.canvas.height); ctx.stroke();
    }
    for (let y = Math.ceil(ymin / sy) * sy; y <= ymax; y += sy) {
      ctx.beginPath(); ctx.moveTo(0, this.py(y)); ctx.lineTo(this.canvas.width, this.py(y)); ctx.stroke();
    }
    // Achsen
    ctx.strokeStyle = 'rgba(200,215,230,0.55)';
    ctx.lineWidth = 1.5;
    const y0 = this.py(0), x0 = this.px(0);
    ctx.beginPath(); ctx.moveTo(0, y0); ctx.lineTo(this.canvas.width, y0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0, this.canvas.height); ctx.stroke();
    // Achsenbeschriftung
    ctx.fillStyle = 'rgba(180,200,215,0.7)';
    for (let x = Math.ceil(xmin / sx) * sx; x <= xmax; x += sx) {
      if (Math.abs(x) < 1e-9) continue;
      ctx.fillText(round(x), this.px(x) + 2, y0 - 4);
    }
    for (let y = Math.ceil(ymin / sy) * sy; y <= ymax; y += sy) {
      if (Math.abs(y) < 1e-9) continue;
      ctx.fillText(round(y), x0 + 4, this.py(y) - 3);
    }
  };

  function round(v) { return Math.abs(v - Math.round(v)) < 1e-9 ? String(Math.round(v)) : v.toFixed(1); }

  /** Funktionsgraph mit Pol-Erkennung (Sprünge nicht verbinden). */
  Plotter.prototype.drawFunction = function (f, t, color) {
    const { ctx, canvas } = this;
    const { ymin, ymax } = this.view;
    ctx.strokeStyle = color || '#4ea1ff';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    let started = false, prevY = null;
    const N = canvas.width;
    const yspan = ymax - ymin;
    for (let i = 0; i <= N; i++) {
      const x = this.view.xmin + (this.view.xmax - this.view.xmin) * i / N;
      const y = f(x, t);
      if (!isFinite(y)) { started = false; prevY = null; continue; }
      // große Sprünge (Polstelle) nicht durchziehen
      if (prevY !== null && Math.abs(y - prevY) > yspan * 1.5) { started = false; }
      const X = this.px(x), Y = this.py(Math.max(ymin - yspan, Math.min(ymax + yspan, y)));
      if (!started) { ctx.moveTo(X, Y); started = true; } else { ctx.lineTo(X, Y); }
      prevY = y;
    }
    ctx.stroke();
  };

  /** Schar: mehrere t-Werte blass + aktuelles t kräftig. */
  Plotter.prototype.drawSchar = function (f, tValues, activeT) {
    tValues.forEach(t => {
      if (Math.abs(t - activeT) < 1e-9) return;
      this.ctx.globalAlpha = 0.28;
      this.drawFunction(f, t, '#6f86a0');
      this.ctx.globalAlpha = 1;
    });
    this.drawFunction(f, activeT, '#4ea1ff');
  };

  /** Schraffierte Fläche zwischen Kurve und x-Achse über [a,b]. */
  Plotter.prototype.shadeArea = function (f, a, b, t) {
    const { ctx } = this;
    ctx.save();
    ctx.fillStyle = 'rgba(54,211,153,0.22)';
    ctx.beginPath();
    ctx.moveTo(this.px(a), this.py(0));
    const N = 200;
    for (let i = 0; i <= N; i++) {
      const x = a + (b - a) * i / N;
      const y = f(x, t);
      ctx.lineTo(this.px(x), this.py(isFinite(y) ? y : 0));
    }
    ctx.lineTo(this.px(b), this.py(0));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  /** Gerade y = m·x + n über gesamten Ausschnitt. */
  Plotter.prototype.drawLine = function (m, n, color, dash) {
    const { ctx } = this;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.6;
    if (dash) ctx.setLineDash(dash);
    const { xmin, xmax } = this.view;
    ctx.beginPath();
    ctx.moveTo(this.px(xmin), this.py(m * xmin + n));
    ctx.lineTo(this.px(xmax), this.py(m * xmax + n));
    ctx.stroke();
    ctx.restore();
  };

  /** Vertikale Asymptote. */
  Plotter.prototype.drawVAsymptote = function (x) {
    const { ctx } = this;
    ctx.save();
    ctx.strokeStyle = 'rgba(247,185,85,0.6)';
    ctx.lineWidth = 1.4; ctx.setLineDash([5, 5]);
    ctx.beginPath(); ctx.moveTo(this.px(x), 0); ctx.lineTo(this.px(x), this.canvas.height); ctx.stroke();
    ctx.restore();
  };

  /** Markierter Punkt mit Label. */
  Plotter.prototype.drawPoint = function (x, y, color, label) {
    const { ctx } = this;
    const X = this.px(x), Y = this.py(y);
    ctx.save();
    ctx.fillStyle = color;
    ctx.strokeStyle = '#0c1116'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(X, Y, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (label) {
      ctx.fillStyle = '#e7edf3';
      ctx.font = '12px Consolas, monospace';
      ctx.fillText(label, X + 8, Y - 8);
    }
    ctx.restore();
  };

  global.Plotter = Plotter;
})(window);
