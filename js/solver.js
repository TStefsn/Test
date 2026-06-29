/* =====================================================================
 * solver.js — Berechnet die Lösungen (nur Ergebnisse) zu einer Funktion.
 * Kombiniert symbolische Ableitungen (math.js) mit numerischen Verfahren
 * aus math-utils.js.
 * ===================================================================== */
(function (global) {
  'use strict';

  const P = MU.pretty;

  /** Definitionsbereich numerisch: zusammenhängende Bereiche, in denen f endlich ist. */
  function domainAnalysis(f, t) {
    const lo = -60, hi = 60, N = 6000;
    const dx = (hi - lo) / N;
    const gaps = [];        // ausgeschlossene Stellen (Pole / Randpunkte)
    let prevDef = isFin(f(lo, t));
    let leftFiniteAt = prevDef ? lo : null;
    let firstDef = prevDef ? lo : null;
    let lastDef = prevDef ? lo : null;
    for (let i = 1; i <= N; i++) {
      const x = lo + i * dx;
      const def = isFin(f(x, t));
      if (def) { if (firstDef === null) firstDef = x; lastDef = x; }
      if (prevDef !== def) gaps.push({ x: x, entering: def });
      prevDef = def;
    }
    return { firstDef, lastDef, gaps };
  }

  function isFin(v) { return typeof v === 'number' && isFinite(v) && Math.abs(v) < 1e9; }

  /** Polstellen (senkrechte Asymptoten). Unterscheidet Pole von schnellem Wachstum. */
  function findPoles(f, t, lo, hi) {
    const N = 8000, dx = (hi - lo) / N;
    const poles = [];
    const fin = (v) => typeof v === 'number' && isFinite(v);
    // g = 1/f: an Polstellen ist g = 0 (mit Vorzeichenwechsel bei ungeraden,
    // als lokales Minimum von |g| bei geraden Polen). Schnelles Wachstum
    // (exp, Polynome) lässt g monoton gegen 0 laufen -> kein lokales Minimum.
    let lastFin = null; // letzter endlicher Punkt {x, v, g}
    let gapNulls = 0;   // Anzahl undefinierter Stellen seit lastFin
    for (let i = 0; i <= N; i++) {
      const x = lo + i * dx;
      const v = f(x, t);
      if (fin(v)) {
        const cur = { x, v, g: 1 / v };
        if (lastFin && (cur.x - lastFin.x) < 0.3 &&
            Math.abs(v) > 15 && Math.abs(lastFin.v) > 15) {
          let xp = null;
          if (Math.sign(v) !== Math.sign(lastFin.v)) {
            // ungerader Pol (Vorzeichenwechsel, evtl. mit Inf-Lücke dazwischen)
            xp = lastFin.x + (cur.x - lastFin.x) * (-lastFin.g) / (cur.g - lastFin.g);
          } else if (gapNulls > 0) {
            // gerader Pol (gleiches Vorzeichen, Blow-up beidseitig der Lücke)
            xp = 0.5 * (lastFin.x + cur.x);
          }
          // nur echte Blow-ups akzeptieren (schließt steile, aber endliche Stellen aus)
          if (xp !== null) {
            const p = refinePole(f, t, xp, dx);
            const mag = Math.max(Math.abs(f(p - 1e-4, t)) || 0, Math.abs(f(p + 1e-4, t)) || 0);
            if (mag > 1e3) addP(poles, p);
          }
        }
        lastFin = cur; gapNulls = 0;
      } else {
        gapNulls++;
      }
    }
    return poles.map(x => Math.round(x * 1000) / 1000);
  }
  function refinePole(f, t, x0, dx) {
    let bx = x0, bv = Math.abs(f(x0, t));
    for (let j = -30; j <= 30; j++) {
      const xx = x0 + j * dx / 30, vv = Math.abs(f(xx, t));
      if (isFinite(vv) && vv > bv) { bv = vv; bx = xx; }
    }
    return bx;
  }
  function addP(arr, x) { if (!arr.some(e => Math.abs(e - x) < 8e-2)) arr.push(x); }

  /** Symmetrie: gerade / ungerade durch Test an mehreren Stellen. */
  function symmetry(f, t) {
    const xs = [0.7, 1.3, 2.1, 3.4];
    let even = true, odd = true;
    for (const x of xs) {
      const a = f(x, t), b = f(-x, t);
      if (!isFin(a) || !isFin(b)) { even = odd = false; break; }
      if (Math.abs(a - b) > 1e-4 * (1 + Math.abs(a))) even = false;
      if (Math.abs(a + b) > 1e-4 * (1 + Math.abs(a))) odd = false;
    }
    if (even) return 'achsensymmetrisch zur y-Achse (f(−x) = f(x))';
    if (odd) return 'punktsymmetrisch zum Ursprung (f(−x) = −f(x))';
    return 'keine einfache Symmetrie';
  }

  /** Verhalten im Unendlichen / Asymptoten. */
  function asymptotes(f, t, domain) {
    const res = { vertical: [], horizontal: [], oblique: null, behavior: [] };
    // senkrechte Asymptoten (Polstellen)
    res.vertical = findPoles(f, t, Math.max(-40, domain.firstDef - 1), Math.min(40, domain.lastDef + 1));
    // Randverhalten rechts (+∞) sofern Definitionsbereich unbeschränkt
    if (domain.lastDef > 40) {
      const cls = endBehavior(f, t, +1);
      if (cls) res.behavior.push(cls.label);
      if (cls && cls.type === 'h') addUnique(res.horizontal, cls.n);
      if (cls && cls.type === 'o') res.oblique = cls;
    }
    if (domain.firstDef < -40) {
      const cls = endBehavior(f, t, -1);
      if (cls) res.behavior.push(cls.label);
      if (cls && cls.type === 'h') addUnique(res.horizontal, cls.n);
      if (cls && cls.type === 'o' && !res.oblique) res.oblique = cls;
    }
    return res;
  }

  function addUnique(arr, v) { if (!arr.some(e => Math.abs(e - v) < 1e-3)) arr.push(v); }

  function endBehavior(f, t, dir) {
    const side = dir > 0 ? '+∞' : '−∞';
    const X1 = 1e3 * dir, X2 = 1e4 * dir, X3 = 1e5 * dir;
    const y1 = f(X1, t), y2 = f(X2, t), y3 = f(X3, t);
    // uneigentliches Verhalten (→ ±∞), z. B. exp, Polynome, x·ln(x)
    if (!isFin(y1) || !isFin(y2) || !isFin(y3)) {
      const a = f(20 * dir, t), b = f(40 * dir, t);
      if (isFin(a) && isFin(b)) {
        return { type: 'inf', label: `f(x) → ${b > a ? '+∞' : '−∞'} für x → ${side}` };
      }
      return null;
    }
    // waagerechte Asymptote: Werte konvergieren
    if (Math.abs(y2 - y3) < 1e-3 * (1 + Math.abs(y3))) {
      return { type: 'h', n: y3, label: `waagerechte Asymptote y = ${P(y3)} für x → ${side}` };
    }
    // schiefe Asymptote: aus (X2,X3) bestimmen und mit X1 validieren
    const m = (y3 - y2) / (X3 - X2);
    const n = y3 - m * X3;
    const resid = Math.abs(y1 - (m * X1 + n));
    const scale = 1 + Math.abs(m * X1);
    if (isFin(m) && Math.abs(m) < 1e6 && resid < 1e-2 * scale) {
      if (Math.abs(m) < 1e-4) return { type: 'h', n, label: `waagerechte Asymptote y = ${P(n)} für x → ${side}` };
      return { type: 'o', m, n, label: `schiefe Asymptote y = ${P(m)}·x ${n >= 0 ? '+' : '−'} ${P(Math.abs(n))} für x → ${side}` };
    }
    // kein lineares Grenzverhalten -> uneigentlich
    return { type: 'inf', label: `f(x) → ${y3 > y2 ? '+∞' : '−∞'} für x → ${side}` };
  }

  /** Vollständige Kurvenuntersuchung. */
  function analyze(gen, opts) {
    const t = gen.isSchar ? (opts.tValue !== undefined ? opts.tValue : 1) : undefined;
    const f = MU.compile(gen.expr);
    const fpExpr = MU.derivative(gen.expr, 'x');
    const fppExpr = fpExpr ? MU.derivative(fpExpr, 'x') : null;
    const fp = fpExpr ? MU.compile(fpExpr) : (x, tt) => MU.numDeriv(f, x, tt);
    const fpp = fppExpr ? MU.compile(fppExpr) : (x, tt) => MU.numDeriv(fp, x, tt);

    const [lo, hi] = gen.range || [-12, 12];
    const domain = domainAnalysis(f, t);

    const result = {
      f, fp, fpp, t,
      fpExpr, fppExpr,
      domain,
      range: [lo, hi]
    };

    // y-Achsenabschnitt
    const y0 = f(0, t);
    result.yIntercept = isFin(y0) ? { x: 0, y: y0 } : null;

    // Symmetrie & Asymptoten (Polstellen zuerst, um Scheinpunkte zu filtern)
    result.symmetry = symmetry(f, t);
    result.asymptotes = asymptotes(f, t, domain);
    const poles = result.asymptotes.vertical;
    const nearPole = (x) => poles.some(p => Math.abs(x - p) < 0.08);

    // Nullstellen (Scheinnullstellen an Polen entfernen)
    result.zeros = MU.findRoots(f, lo, hi, t, { steps: 3000 }).filter(x => !nearPole(x));

    // Extrema & Wendepunkte (Scheinpunkte an Polen / mit Riesenwerten entfernen)
    const clean = (p) => !nearPole(p.x) && Math.abs(p.y) < 1e6;
    result.extrema = MU.findExtrema(f, fp, fpp, lo, hi, t).filter(clean);
    result.inflections = MU.findInflections(f, fpp, lo, hi, t).filter(clean);

    // Wendetangente & Normale
    if (opts.focus.includes('wendetangente') && result.inflections.length) {
      const w = result.inflections[0];
      const m = fp(w.x, t);
      const tang = { m, n: w.y - m * w.x };
      let norm = null;
      if (Math.abs(m) > 1e-9) {
        const mn = -1 / m;
        norm = { m: mn, n: w.y - mn * w.x };
      }
      result.wendetangente = { point: w, tangente: tang, normale: norm };
    }

    // Flächenberechnung
    if (opts.focus.includes('flaeche')) {
      result.flaeche = areaAnalysis(f, t, result.zeros, lo, hi, poles);
    }

    return result;
  }

  /** Fläche zwischen Graph und x-Achse. */
  function areaAnalysis(f, t, zeros, lo, hi, poles) {
    poles = poles || [];
    const hasPole = (a, b) => poles.some(p => p > a + 1e-3 && p < b - 1e-3);
    const zs = zeros.slice().sort((a, b) => a - b);
    if (zs.length >= 2) {
      const pieces = [];
      let total = 0;
      for (let i = 0; i < zs.length - 1; i++) {
        const a = zs[i], b = zs[i + 1];
        if (hasPole(a, b)) continue; // nicht über Polstelle integrieren
        const val = MU.integrate(f, a, b, t);
        if (!isFin(val)) continue;
        pieces.push({ a, b, signed: val, area: Math.abs(val) });
        total += Math.abs(val);
      }
      if (pieces.length) return { mode: 'zeros', pieces, total, a: pieces[0].a, b: pieces[pieces.length - 1].b };
    }
    // sonst: festes Intervall
    let a = Math.max(lo, -5), b = Math.min(hi, 5);
    if (zs.length === 1) { a = zs[0]; b = zs[0] + 3; }
    const val = MU.integrate(f, a, b, t);
    return { mode: 'interval', a, b, signed: val, area: Math.abs(val), total: Math.abs(val), pieces: [{ a, b, signed: val, area: Math.abs(val) }] };
  }

  /** Ortskurve der Extrem-/Wendepunkte einer Schar (numerische Elimination). */
  function ortskurve(gen, kind) {
    kind = kind || 'extrema';
    const f = MU.compile(gen.expr);
    const fpExpr = MU.derivative(gen.expr, 'x');
    const fppExpr = fpExpr ? MU.derivative(fpExpr, 'x') : null;
    const fp = fpExpr ? MU.compile(fpExpr) : (x, t) => MU.numDeriv(f, x, t);
    const fpp = fppExpr ? MU.compile(fppExpr) : (x, t) => MU.numDeriv(fp, x, t);
    const [lo, hi] = gen.range || [-12, 12];

    const xs = [], ys = [];
    for (let tv = -3; tv <= 3.0001; tv += 0.25) {
      if (Math.abs(tv) < 0.05) continue;
      let pts;
      if (kind === 'wende') pts = MU.findInflections(f, fpp, lo, hi, tv);
      else pts = MU.findExtrema(f, fp, fpp, lo, hi, tv);
      for (const p of pts) {
        if (isFin(p.x) && isFin(p.y)) { xs.push(p.x); ys.push(p.y); }
      }
    }
    if (xs.length < 4) return { ok: false };
    // beste Polynomanpassung y = poly(x), Grad 1..3
    let best = null;
    for (let deg = 1; deg <= 3; deg++) {
      if (xs.length <= deg + 1) break;
      const c = MU.polyfit(xs, ys, deg);
      let err = 0;
      for (let i = 0; i < xs.length; i++) {
        let yp = 0, xp = 1;
        for (let k = 0; k <= deg; k++) { yp += c[k] * xp; xp *= xs[i]; }
        err += (yp - ys[i]) ** 2;
      }
      err = Math.sqrt(err / xs.length);
      if (!best || err < best.err - 1e-6) best = { deg, c, err };
      if (err < 1e-4) break;
    }
    return {
      ok: true,
      kind,
      equation: 'y = ' + MU.polyToString(best.c, 'x'),
      rms: best.err,
      samplePoints: xs.map((x, i) => ({ x, y: ys[i] }))
    };
  }

  /** Extremalproblem lösen. */
  function solveExtremal(gen) {
    const f = MU.compile(gen.expr);
    const fpExpr = MU.derivative(gen.expr, 'x');
    const fp = fpExpr ? MU.compile(fpExpr) : (x) => MU.numDeriv(f, x);
    const fppExpr = fpExpr ? MU.derivative(fpExpr, 'x') : null;
    const fpp = fppExpr ? MU.compile(fppExpr) : (x) => MU.numDeriv(fp, x);
    const [a, b] = gen.range;
    const crit = MU.findRoots(fp, a + 1e-4, b - 1e-4, undefined, { steps: 3000 });
    let bestX = null, bestY = null;
    for (const x of crit) {
      const y = f(x);
      if (!isFin(y)) continue;
      const s = fpp(x);
      const isMax = s < 0, isMin = s > 0;
      if (gen.solveFor === 'max' && isMax) { if (bestY === null || y > bestY) { bestX = x; bestY = y; } }
      if (gen.solveFor === 'min' && isMin) { if (bestY === null || y < bestY) { bestX = x; bestY = y; } }
    }
    // Fallback: Randwerte prüfen falls kein innerer Extrempunkt
    if (bestX === null) {
      const cand = [a + 1e-3, b - 1e-3].map(x => ({ x, y: f(x) })).filter(p => isFin(p.y));
      if (cand.length) {
        cand.sort((p, q) => gen.solveFor === 'max' ? q.y - p.y : p.y - q.y);
        bestX = cand[0].x; bestY = cand[0].y;
      }
    }
    return { x: bestX, y: bestY, fpExpr, report: bestX !== null ? gen.report(bestX, bestY) : null, f };
  }

  global.Solver = { analyze, ortskurve, solveExtremal, domainAnalysis };
})(window);
