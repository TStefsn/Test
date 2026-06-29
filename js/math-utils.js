/* =====================================================================
 * math-utils.js
 * Numerische Verfahren für die Kurvenanalyse: Nullstellen, Extrema,
 * Wendepunkte, Integration, Ableitungen. Baut auf math.js auf
 * (window.math) für Parsen / symbolisches Ableiten / Vereinfachen.
 * ===================================================================== */
(function (global) {
  'use strict';

  const EPS = 1e-7;

  /** Kompiliert einen Ausdruck zu f(x[, t]). Liefert NaN bei Fehler. */
  function compile(expr) {
    const node = math.parse(expr);
    const code = node.compile();
    return function (x, t) {
      try {
        const v = code.evaluate(t === undefined ? { x } : { x, t });
        return typeof v === 'number' ? v : (v && v.re !== undefined ? NaN : Number(v));
      } catch (e) {
        return NaN;
      }
    };
  }

  /** Symbolische Ableitung als vereinfachter String. */
  function derivative(expr, varName) {
    try {
      const d = math.derivative(expr, varName || 'x');
      return math.simplify(d).toString();
    } catch (e) {
      return null;
    }
  }

  /** Numerische Ableitung (zentrale Differenz) – Fallback. */
  function numDeriv(f, x, t, h) {
    h = h || 1e-5;
    return (f(x + h, t) - f(x - h, t)) / (2 * h);
  }

  function isFiniteNum(v) { return typeof v === 'number' && isFinite(v); }

  /** Bisektion in [a,b] mit Vorzeichenwechsel. */
  function bisect(f, a, b, t) {
    let fa = f(a, t);
    for (let i = 0; i < 80; i++) {
      const m = 0.5 * (a + b);
      const fm = f(m, t);
      if (!isFiniteNum(fm)) return null;
      if (Math.abs(fm) < 1e-12 || (b - a) < 1e-12) return m;
      if (Math.sign(fm) === Math.sign(fa)) { a = m; fa = fm; }
      else { b = m; }
    }
    return 0.5 * (a + b);
  }

  /**
   * Findet Nullstellen von f im Intervall [lo,hi] durch Abtasten +
   * Bisektion. Entfernt Duplikate (Toleranz tol).
   */
  function findRoots(f, lo, hi, t, opts) {
    opts = opts || {};
    const steps = opts.steps || 2000;
    const tol = opts.tol || 1e-4;
    const dx = (hi - lo) / steps;
    const roots = [];
    let prevX = lo, prevY = f(lo, t);
    for (let i = 1; i <= steps; i++) {
      const x = lo + i * dx;
      const y = f(x, t);
      if (isFiniteNum(prevY) && isFiniteNum(y)) {
        if (prevY === 0) pushRoot(roots, prevX, tol);
        if (Math.sign(prevY) !== Math.sign(y) && prevY !== 0) {
          const r = bisect(f, prevX, x, t);
          if (r !== null) pushRoot(roots, r, tol);
        }
      }
      prevX = x; prevY = y;
    }
    return roots;
  }

  function pushRoot(arr, r, tol) {
    for (const e of arr) if (Math.abs(e - r) < tol) return;
    arr.push(r);
  }

  /** Findet Extrema über Nullstellen von f'. Klassifiziert via f''. */
  function findExtrema(f, fp, fpp, lo, hi, t) {
    const crit = findRoots(fp, lo, hi, t, { steps: 2500 });
    const out = [];
    for (const x of crit) {
      const y = f(x, t);
      let s = fpp ? fpp(x, t) : numDeriv(fp, x, t);
      let kind;
      if (s > EPS) kind = 'Tiefpunkt';
      else if (s < -EPS) kind = 'Hochpunkt';
      else kind = 'Sattel/unbestimmt';
      if (isFiniteNum(y)) out.push({ x, y, kind });
    }
    return out.sort((a, b) => a.x - b.x);
  }

  /** Findet Wendepunkte über Nullstellen von f'' (mit Vorzeichenwechsel). */
  function findInflections(f, fpp, lo, hi, t) {
    const cand = findRoots(fpp, lo, hi, t, { steps: 2500 });
    const out = [];
    for (const x of cand) {
      const left = fpp(x - 1e-3, t), right = fpp(x + 1e-3, t);
      if (isFiniteNum(left) && isFiniteNum(right) && Math.sign(left) !== Math.sign(right)) {
        const y = f(x, t);
        if (isFiniteNum(y)) out.push({ x, y });
      }
    }
    return out.sort((a, b) => a.x - b.x);
  }

  /** Adaptive Simpson-Integration. */
  function integrate(f, a, b, t) {
    if (a === b) return 0;
    if (a > b) return -integrate(f, b, a, t);
    function simpson(fa, fm, fb, a, b) {
      return (b - a) / 6 * (fa + 4 * fm + fb);
    }
    function rec(a, b, fa, fm, fb, whole, depth) {
      const m = 0.5 * (a + b);
      const lm = 0.5 * (a + m), rm = 0.5 * (m + b);
      const flm = f(lm, t), frm = f(rm, t);
      const left = simpson(fa, flm, fm, a, m);
      const right = simpson(fm, frm, fb, m, b);
      if (depth <= 0 || Math.abs(left + right - whole) < 1e-9) return left + right;
      return rec(a, m, fa, flm, fm, left, depth - 1) +
             rec(m, b, fm, frm, fb, right, depth - 1);
    }
    const m = 0.5 * (a + b);
    const fa = f(a, t), fm = f(m, t), fb = f(b, t);
    return rec(a, b, fa, fm, fb, simpson(fa, fm, fb, a, b), 50);
  }

  /** Rundet hübsch: nahe ganzzahlig / einfache Brüche werden erkannt. */
  function pretty(v, dec) {
    if (!isFiniteNum(v)) return '—';
    dec = dec === undefined ? 3 : dec;
    if (Math.abs(v) < 1e-9) return '0';
    if (Math.abs(v - Math.round(v)) < 1e-6) return String(Math.round(v));
    // einfache Brüche mit kleinem Nenner erkennen (gekürzt)
    for (let den = 2; den <= 12; den++) {
      const num = v * den;
      if (Math.abs(num - Math.round(num)) < 1e-6) {
        let n = Math.round(num), d = den;
        const g = gcd(Math.abs(n), d);
        n /= g; d /= g;
        if (d === 1) return String(n);
        return n + '/' + d;
      }
    }
    return Number(v.toFixed(dec)).toString();
  }

  function gcd(a, b) { a = Math.round(a); b = Math.round(b); while (b) { [a, b] = [b, a % b]; } return a || 1; }

  /** Punkt als (x | y) formatiert. */
  function point(x, y, dec) {
    return '(' + pretty(x, dec) + ' | ' + pretty(y, dec) + ')';
  }

  /** Polynomielle Regression (least squares) bis Grad deg. Liefert Koeffizienten [a0..adeg]. */
  function polyfit(xs, ys, deg) {
    const n = xs.length;
    const A = [], b = [];
    for (let i = 0; i <= deg; i++) {
      A.push(new Array(deg + 1).fill(0));
      b.push(0);
    }
    for (let k = 0; k < n; k++) {
      const pows = [1];
      for (let p = 1; p <= 2 * deg; p++) pows.push(pows[p - 1] * xs[k]);
      for (let i = 0; i <= deg; i++) {
        for (let j = 0; j <= deg; j++) A[i][j] += pows[i + j];
        b[i] += pows[i] * ys[k];
      }
    }
    return gauss(A, b);
  }

  /** Gauß-Elimination für kleines lineares System. */
  function gauss(A, b) {
    const n = b.length;
    const M = A.map((row, i) => row.concat(b[i]));
    for (let col = 0; col < n; col++) {
      let piv = col;
      for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
      if (Math.abs(M[piv][col]) < 1e-12) continue;
      [M[col], M[piv]] = [M[piv], M[col]];
      for (let r = 0; r < n; r++) {
        if (r === col) continue;
        const f = M[r][col] / M[col][col];
        for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
      }
    }
    return M.map((row, i) => Math.abs(M[i][i]) < 1e-12 ? 0 : row[n] / row[i]);
  }

  /** Polynom-Koeffizienten -> lesbarer String in Variable v. */
  function polyToString(coeffs, v) {
    v = v || 'x';
    const terms = [];
    for (let i = coeffs.length - 1; i >= 0; i--) {
      const c = coeffs[i];
      if (Math.abs(c) < 1e-6) continue;
      const cs = pretty(c, 3);
      let term;
      if (i === 0) term = cs;
      else if (i === 1) term = (Math.abs(c - 1) < 1e-9 ? '' : (Math.abs(c + 1) < 1e-9 ? '-' : cs + '·')) + v;
      else term = (Math.abs(c - 1) < 1e-9 ? '' : (Math.abs(c + 1) < 1e-9 ? '-' : cs + '·')) + v + '^' + i;
      terms.push({ term, c });
    }
    if (!terms.length) return '0';
    return terms.map((t, idx) => {
      if (idx === 0) return t.term;
      return (t.c >= 0 ? ' + ' : ' − ') + t.term.replace(/^-/, '');
    }).join('');
  }

  global.MU = {
    compile, derivative, numDeriv, findRoots, findExtrema, findInflections,
    integrate, pretty, point, polyfit, polyToString, isFiniteNum, EPS
  };
})(window);
