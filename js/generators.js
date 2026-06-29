/* =====================================================================
 * generators.js — Erzeugt zufällige Funktionen je Typ.
 * Liefert { expr, typeLabel, isSchar, scharInfo, range, note }.
 * expr ist in math.js-Syntax (Variable x, Scharparameter t).
 * ===================================================================== */
(function (global) {
  'use strict';

  function ri(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function nz(a, b) { let v; do { v = ri(a, b); } while (v === 0); return v; }

  // Skalierung der Koeffizienten je Schwierigkeit
  const SPAN = { leicht: 3, mittel: 5, schwer: 7 };

  /* ---------- Einzeltypen (Kurvendiskussion) ---------- */

  function quadratisch(level) {
    const s = SPAN[level];
    const r1 = nz(-s, s), r2 = ri(-s, s);
    const a = pick(level === 'leicht' ? [1, 1, -1] : [1, -1, 2, -2]);
    // a(x-r1)(x-r2)
    return {
      expr: `${a}*(x-(${r1}))*(x-(${r2}))`,
      typeLabel: 'Quadratische Funktion',
      range: [-12, 12],
      note: 'Parabel'
    };
  }

  function biquadratisch(level) {
    const s = level === 'leicht' ? 2 : 4;
    const p = ri(1, s), q = ri(0, s);
    const a = pick([1, -1, 1]);
    // a(x^2 - p)(x^2 - q)  -> biquadratisch, achsensymmetrisch
    return {
      expr: `${a}*(x^2-(${p}))*(x^2-(${q}))`,
      typeLabel: 'Biquadratische Funktion',
      range: [-8, 8],
      note: 'achsensymmetrisch zur y-Achse'
    };
  }

  function kubisch(level) {
    const s = SPAN[level];
    const r1 = ri(-s, s), r2 = ri(-s, s), r3 = ri(-s, s);
    const a = pick(level === 'schwer' ? [1, -1, 2] : [1, -1]);
    // a(x-r1)(x-r2)(x-r3): ganzzahlige Nullstellen -> Polynomdivision sinnvoll
    return {
      expr: `${a}*(x-(${r1}))*(x-(${r2}))*(x-(${r3}))`,
      typeLabel: 'Ganzrationale Funktion 3. Grades (Polynomdivision)',
      range: [-12, 12],
      note: 'eine Nullstelle raten, dann Polynomdivision'
    };
  }

  function exponential(level) {
    const a = nz(-3, 3), b = nz(-4, 4), c = pick(level === 'leicht' ? [-1, 1] : [-1, 1, -0.5, 0.5]);
    const form = pick([0, 1]);
    if (form === 0) {
      // (a x + b) e^(c x)
      return {
        expr: `(${a}*x+(${b}))*exp(${c}*x)`,
        typeLabel: 'Exponentialfunktion',
        range: [-10, 12],
        note: 'Produkt aus linearem Term und e-Funktion'
      };
    }
    // a e^(c x) + b
    return {
      expr: `${a}*exp(${c}*x)+(${b})`,
      typeLabel: 'Exponentialfunktion',
      range: [-10, 12],
      note: 'verschobene e-Funktion (waagerechte Asymptote)'
    };
  }

  function logarithmus(level) {
    const form = pick([0, 1, 2]);
    if (form === 0) {
      const a = nz(-3, 3), b = nz(-3, 3);
      // a ln(x) + b x
      return { expr: `${a}*log(x)+(${b})*x`, typeLabel: 'nat. Logarithmusfunktion', range: [0.01, 14], note: 'Definitionsbereich x > 0' };
    }
    if (form === 1) {
      // x ln(x)
      const a = pick([1, 2, -1]);
      return { expr: `${a}*x*log(x)`, typeLabel: 'nat. Logarithmusfunktion', range: [0.01, 10], note: 'x·ln(x), x > 0' };
    }
    // ln(x)/x
    return { expr: `log(x)/x`, typeLabel: 'nat. Logarithmusfunktion', range: [0.05, 16], note: 'ln(x)/x, x > 0' };
  }

  function wurzel(level) {
    const form = pick([0, 1, 2]);
    if (form === 0) {
      const a = nz(-3, 3), b = nz(-3, 3);
      // a sqrt(x) + b x
      return { expr: `${a}*sqrt(x)+(${b})*x`, typeLabel: 'Wurzelfunktion', range: [0, 16], note: 'Definitionsbereich x ≥ 0' };
    }
    if (form === 1) {
      // x*sqrt(x) - c x  = x^{3/2} - c x
      const c = ri(1, 4);
      return { expr: `x*sqrt(x)-(${c})*x`, typeLabel: 'Wurzelfunktion', range: [0, 16], note: 'x·√x − c·x, x ≥ 0' };
    }
    // sqrt(x^2 + c)
    const c = ri(1, 9);
    return { expr: `sqrt(x^2+(${c}))`, typeLabel: 'Wurzelfunktion', range: [-10, 10], note: '√(x²+c), überall definiert' };
  }

  function gebrochenrational(level) {
    const form = pick([0, 1, 2]);
    if (form === 0) {
      // (x^2 - a)/(x - b)  -> schiefe Asymptote, Polstelle bei b
      const a = ri(1, 9), b = nz(-4, 4);
      return { expr: `(x^2-(${a}))/(x-(${b}))`, typeLabel: 'Gebrochenrationale Funktion', range: [-14, 14], note: 'Polstelle + schiefe Asymptote' };
    }
    if (form === 1) {
      // 1/(x^2 - a)  -> zwei Polstellen
      const a = ri(1, 9);
      return { expr: `1/(x^2-(${a}))`, typeLabel: 'Gebrochenrationale Funktion', range: [-12, 12], note: 'zwei Polstellen, x-Achse als Asymptote' };
    }
    // (a x + b)/(x^2 + c)
    const a = nz(-3, 3), b = nz(-3, 3), c = ri(1, 6);
    return { expr: `(${a}*x+(${b}))/(x^2+(${c}))`, typeLabel: 'Gebrochenrationale Funktion', range: [-14, 14], note: 'überall definiert, x-Achse als Asymptote' };
  }

  const SINGLE = {
    quadratisch, biquadratisch, kubisch, exponential, logarithmus, wurzel, gebrochenrational
  };

  /* ---------- Verknüpfungen ---------- */
  function combine(types, level) {
    const a = SINGLE[types[0]](level);
    const b = SINGLE[types[1]](level);
    const op = pick(['+', '*']);
    const expr = op === '+' ? `(${a.expr})+(${b.expr})` : `(${a.expr})*(${b.expr})`;
    return {
      expr,
      typeLabel: `Verknüpfung: ${a.typeLabel} ${op === '+' ? '+' : '·'} ${b.typeLabel}`,
      range: [-10, 12],
      note: 'verknüpfte Funktion'
    };
  }

  /* ---------- Scharen (mit Parameter t) ---------- */
  function scharFor(types, level) {
    // Wähle eine zum ersten Typ passende Schar
    const t0 = types[0];
    const families = {
      quadratisch: [
        { expr: `x^2-2*t*x`, note: 'x² − 2t·x', typeLabel: 'Parabelschar' },
        { expr: `t*x^2-(${nz(-3,3)})*x`, note: 't·x² − k·x', typeLabel: 'Parabelschar' }
      ],
      kubisch: [
        { expr: `x^3-3*t^2*x`, note: 'x³ − 3t²·x (Extrema bei ±t)', typeLabel: 'Schar 3. Grades' },
        { expr: `x^3-t*x^2`, note: 'x³ − t·x²', typeLabel: 'Schar 3. Grades' }
      ],
      biquadratisch: [
        { expr: `x^4-2*t*x^2`, note: 'x⁴ − 2t·x²', typeLabel: 'biquadratische Schar' }
      ],
      exponential: [
        { expr: `t*x*exp(-x)`, note: 't·x·e^(−x)', typeLabel: 'Exponentialschar' },
        { expr: `(x-t)*exp(-x)`, note: '(x − t)·e^(−x)', typeLabel: 'Exponentialschar' }
      ],
      logarithmus: [
        { expr: `log(x)-t*x`, note: 'ln(x) − t·x, x > 0', typeLabel: 'Logarithmusschar', range: [0.05, 14] }
      ],
      wurzel: [
        { expr: `sqrt(x)-t*x`, note: '√x − t·x, x ≥ 0', typeLabel: 'Wurzelschar', range: [0, 16] }
      ],
      gebrochenrational: [
        { expr: `(x^2+t)/x`, note: '(x² + t)/x', typeLabel: 'gebrochenrationale Schar' }
      ]
    };
    const fam = pick(families[t0] || families.kubisch);
    return {
      expr: fam.expr,
      typeLabel: 'Funktionenschar — ' + fam.typeLabel,
      isSchar: true,
      range: fam.range || [-10, 12],
      note: fam.note + ' · Parameter t'
    };
  }

  /* ---------- Extremalprobleme (kuratiert) ---------- */
  const EXTREMAL = [
    function () {
      const c = ri(8, 20) * 2; // Umfang
      return {
        title: 'Rechteck mit festem Umfang',
        text: `Ein Rechteck hat den Umfang ${c} cm. Bestimme die Seitenlängen, für die der Flächeninhalt maximal wird, und gib diesen maximalen Flächeninhalt an.`,
        // A(x) = x*( c/2 - x )
        expr: `x*((${c}/2)-x)`,
        varHint: 'x = eine Seitenlänge (cm)',
        range: [0, c / 2],
        solveFor: 'max',
        report: (x, y) => ({
          extra: [
            ['Seitenlängen', `${MU.pretty(x)} cm × ${MU.pretty(c / 2 - x)} cm`],
            ['max. Flächeninhalt', `${MU.pretty(y)} cm²`]
          ]
        })
      };
    },
    function () {
      const s = ri(10, 24) * 2; // Blechkantenlänge
      return {
        title: 'Schachtel aus Blech (offene Box)',
        text: `Aus einem quadratischen Blech der Kantenlänge ${s} cm wird an den Ecken je ein Quadrat der Seitenlänge x herausgeschnitten; die Ränder werden hochgeklappt. Für welches x wird das Volumen der offenen Schachtel maximal? Gib das maximale Volumen an.`,
        // V(x) = x*(s-2x)^2
        expr: `x*((${s})-2*x)^2`,
        varHint: 'x = Höhe / Schnittkante (cm)',
        range: [0, s / 2],
        solveFor: 'max',
        report: (x, y) => ({
          extra: [
            ['Schnittlänge x', `${MU.pretty(x)} cm`],
            ['Grundkante', `${MU.pretty(s - 2 * x)} cm`],
            ['max. Volumen', `${MU.pretty(y)} cm³`]
          ]
        })
      };
    },
    function () {
      const a = ri(2, 5), b = ri(3, 8);
      return {
        title: 'Größtes Rechteck unter einer Parabel',
        text: `Gegeben ist die Parabel f(x) = ${b} − ${a}·x². Im ersten Quadranten wird ein achsenparalleles Rechteck einbeschrieben, dessen eine Seite auf der x-Achse liegt und dessen obere Ecken auf dem Graphen liegen. Bestimme die Maße des flächengrößten Rechtecks und seinen Flächeninhalt.`,
        // A(x) = 2x * (b - a x^2)  (Breite 2x, Höhe f(x))
        expr: `2*x*((${b})-(${a})*x^2)`,
        varHint: 'x = halbe Breite',
        range: [0, Math.sqrt(b / a)],
        solveFor: 'max',
        report: (x, y) => ({
          extra: [
            ['Breite', `${MU.pretty(2 * x)}`],
            ['Höhe', `${MU.pretty(b - a * x * x)}`],
            ['max. Flächeninhalt', `${MU.pretty(y)}`]
          ]
        })
      };
    },
    function () {
      const V = ri(200, 1000);
      return {
        title: 'Zylinderdose mit minimalem Materialverbrauch',
        text: `Eine oben und unten geschlossene zylindrische Dose soll das Volumen ${V} cm³ fassen. Für welchen Radius r wird die Oberfläche (Materialverbrauch) minimal? Gib Radius und minimale Oberfläche an.`,
        // O(r) = 2 pi r^2 + 2 V / r
        expr: `2*pi*x^2+2*(${V})/x`,
        varHint: 'x = Radius r (cm)',
        range: [0.1, 30],
        solveFor: 'min',
        report: (x, y) => ({
          extra: [
            ['Radius r', `${MU.pretty(x)} cm`],
            ['Höhe h', `${MU.pretty(V / (Math.PI * x * x))} cm`],
            ['min. Oberfläche', `${MU.pretty(y)} cm²`]
          ]
        })
      };
    }
  ];

  function extremalproblem() {
    return pick(EXTREMAL)();
  }

  /* ---------- Dispatcher ---------- */
  function generate(opts) {
    const { types, task, level } = opts;
    if (task === 'extremalproblem') {
      const e = extremalproblem();
      e.task = 'extremalproblem';
      return e;
    }
    if (task === 'kurvenschar') {
      const g = scharFor(types, level);
      g.task = 'kurvenschar';
      return g;
    }
    // Kurvendiskussion
    let g;
    if (types.length >= 2) g = combine(types.slice(0, 2), level);
    else g = SINGLE[types[0]](level);
    g.task = 'kurvendiskussion';
    g.isSchar = false;
    return g;
  }

  global.Generators = { generate, SINGLE_KEYS: Object.keys(SINGLE) };
})(window);
