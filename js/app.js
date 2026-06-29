/* =====================================================================
 * app.js — Oberfläche & Ablaufsteuerung
 * ===================================================================== */
(function () {
  'use strict';

  const TYPES = [
    { key: 'quadratisch', label: 'Quadratisch' },
    { key: 'biquadratisch', label: 'Biquadratisch' },
    { key: 'kubisch', label: 'Hoch drei (Polynomdiv.)' },
    { key: 'exponential', label: 'Exponential' },
    { key: 'logarithmus', label: 'nat. Logarithmus' },
    { key: 'wurzel', label: 'Wurzel' },
    { key: 'gebrochenrational', label: 'Gebrochenrational' }
  ];

  const $ = (id) => document.getElementById(id);
  const STATE = {
    gen: null, analysis: null, plotter: null,
    toggles: { f: true, fp: false, fpp: false, points: true, tangente: true, area: true, asymptote: true },
    t: 1
  };

  /* ---------- Initialisierung ---------- */
  function init() {
    // Funktionstyp-Chips
    const grid = $('function-types');
    TYPES.forEach((tp, i) => {
      const chip = document.createElement('div');
      chip.className = 'chip' + (i === 0 ? ' active' : '');
      chip.textContent = tp.label;
      chip.dataset.key = tp.key;
      chip.addEventListener('click', () => chip.classList.toggle('active'));
      grid.appendChild(chip);
    });

    STATE.plotter = new Plotter($('plot'));

    $('generate-btn').addEventListener('click', onGenerate);
    $('own-btn').addEventListener('click', () => $('own-input').classList.toggle('hidden'));
    $('own-go').addEventListener('click', onOwnFunction);
    $('own-fx').addEventListener('keydown', (e) => { if (e.key === 'Enter') onOwnFunction(); });
    $('toggle-solution').addEventListener('click', toggleSolution);
    $('t-range').addEventListener('input', onScharChange);

    // Aufgabentyp ändert verfügbare Fokus-Optionen
    document.querySelectorAll('input[name=task]').forEach(r =>
      r.addEventListener('change', updateFocusAvailability));
    updateFocusAvailability();

    waitForMath();
  }

  function waitForMath() {
    const pill = $('status-pill');
    if (typeof window.math !== 'undefined') {
      pill.textContent = 'bereit'; pill.className = 'status-pill ready';
      return;
    }
    let tries = 0;
    const iv = setInterval(() => {
      if (typeof window.math !== 'undefined') {
        clearInterval(iv);
        pill.textContent = 'bereit'; pill.className = 'status-pill ready';
      } else if (++tries > 60) {
        clearInterval(iv);
        pill.textContent = 'math.js nicht geladen (Internet?)'; pill.className = 'status-pill error';
      }
    }, 200);
  }

  function updateFocusAvailability() {
    const task = getTask();
    const ort = document.querySelector('input[name=focus][value=ortskurve]');
    ort.disabled = (task !== 'kurvenschar');
    ort.closest('label').style.opacity = ort.disabled ? 0.45 : 1;
    if (task === 'kurvenschar') ort.checked = true;
  }

  /* ---------- Eingaben lesen ---------- */
  function getSelectedTypes() {
    const sel = [...document.querySelectorAll('#function-types .chip.active')].map(c => c.dataset.key);
    return sel.length ? sel : ['quadratisch'];
  }
  function getTask() { return document.querySelector('input[name=task]:checked').value; }
  function getLevel() { return document.querySelector('input[name=level]:checked').value; }
  function getFocus() {
    return [...document.querySelectorAll('input[name=focus]:checked')].map(c => c.value);
  }

  /* ---------- Aufgabe erzeugen ---------- */
  function onGenerate() {
    if (typeof window.math === 'undefined') { alert('math.js ist noch nicht geladen.'); return; }
    const opts = { types: getSelectedTypes(), task: getTask(), level: getLevel() };
    try {
      const gen = Generators.generate(opts);
      loadGen(gen, getFocus());
    } catch (e) {
      console.error(e);
      alert('Fehler beim Erzeugen der Aufgabe: ' + e.message);
    }
  }

  function onOwnFunction() {
    const raw = $('own-fx').value.trim();
    if (!raw) return;
    try {
      math.parse(raw); // Syntaxprüfung
      const isSchar = /\bt\b/.test(raw);
      const gen = {
        expr: raw,
        typeLabel: isSchar ? 'Eigene Funktionenschar' : 'Eigene Funktion',
        isSchar,
        task: isSchar ? 'kurvenschar' : 'kurvendiskussion',
        range: [-12, 12],
        note: 'selbst eingegeben'
      };
      const focus = getFocus();
      if (isSchar && !focus.includes('ortskurve')) focus.push('ortskurve');
      loadGen(gen, focus);
    } catch (e) {
      alert('Ungültige Funktion: ' + e.message);
    }
  }

  function loadGen(gen, focus) {
    STATE.gen = gen;
    STATE.focus = focus;
    STATE.t = 1;
    $('t-range').value = 1; $('t-val').textContent = '1';

    if (gen.task === 'extremalproblem') {
      renderExtremalTask(gen);
      STATE.analysis = Solver.solveExtremal(gen);
      setupExtremalPlot(gen);
    } else {
      renderTask(gen, focus);
      STATE.analysis = Solver.analyze(gen, { focus, tValue: gen.isSchar ? STATE.t : undefined });
      setupPlotControls();
      redraw();
    }

    $('plot-wrap').classList.remove('hidden');
    $('schar-slider').classList.toggle('hidden', !gen.isSchar || gen.task === 'extremalproblem');
    $('solution-bar').classList.remove('hidden');
    $('solution-card').classList.add('hidden');
    $('toggle-solution').textContent = 'Lösungen anzeigen';
  }

  /* ---------- Formeln als lesbares HTML rendern (ohne externe Bibliothek) ---------- */
  // Polynome/rationale Funktionen ausmultiplizieren, damit die faktorisierte
  // Form (die die Nullstellen verrät) nicht angezeigt wird.
  function displayExpr(expr) {
    try {
      if (/exp\(|log\(|sqrt\(/.test(expr)) return math.simplify(expr).toString({ implicit: 'hide' });
      return math.rationalize(expr).toString({ implicit: 'hide' });
    } catch (e) {
      try { return math.simplify(expr).toString({ implicit: 'hide' }); } catch (_) { return expr; }
    }
  }
  function prettyExpr(expr) {
    let s;
    try { s = math.parse(expr).toString({ implicit: 'hide', parenthesis: 'auto' }); }
    catch (e) { s = String(expr); }
    s = s
      .replace(/\s*\*\s*/g, '·')
      .replace(/\s*\^\s*/g, '^')      // Leerzeichen um Potenzzeichen entfernen
      .replace(/\bexp\(/g, 'e^(')
      .replace(/\blog\(/g, 'ln(')
      .replace(/\bsqrt\(/g, '√(')
      .replace(/\bpi\b/g, 'π');
    // führende Koeffizienten ±1 vereinfachen (1·x -> x, -1·x -> -x)
    s = s.replace(/(^|[\s(+])-1·/g, '$1-').replace(/(^|[\s(+])1·/g, '$1');
    // Exponenten hochstellen: ^(...) und ^zahl
    s = s.replace(/\^\(([^()]*)\)/g, (m, g) => '<sup>' + g + '</sup>');
    s = s.replace(/\^(-?\d+(?:\.\d+)?)/g, (m, g) => '<sup>' + g + '</sup>');
    // doppelte Vorzeichen und Minus vereinheitlichen
    s = s.replace(/-/g, '−')
         .replace(/−\s*−/g, '+ ')
         .replace(/\+\s*−/g, '− ')
         .replace(/\s+/g, ' ').trim();
    return '<span class="formula">' + s + '</span>';
  }
  function tex(expr, name) {
    return '<span class="formula">' + htmlName(name) + ' = </span>' + prettyExpr(displayExpr(expr));
  }
  function htmlName(name) {
    return name.replace(/_t/g, '<sub>t</sub>').replace(/'/g, '′');
  }

  function renderTask(gen, focus) {
    const fname = gen.isSchar ? 'f_t(x)' : 'f(x)';
    const taskLabel = { kurvendiskussion: 'Kurvendiskussion', kurvenschar: 'Kurvenschar' }[gen.task];
    const subtasks = [];
    if (focus.includes('kurvenuntersuchung'))
      subtasks.push('Untersuche den Graphen vollständig: Definitionsbereich, Symmetrie, Nullstellen, Achsenabschnitt, Extrem- und Wendepunkte sowie das Verhalten im Unendlichen (Asymptoten).');
    if (focus.includes('wendetangente'))
      subtasks.push('Bestimme die Gleichung der <strong>Wendetangente</strong> und der zugehörigen <strong>Normalen</strong> im Wendepunkt.');
    if (focus.includes('flaeche'))
      subtasks.push('Berechne den <strong>Flächeninhalt</strong>, den der Graph mit der x-Achse einschließt.');
    if (gen.isSchar && focus.includes('ortskurve'))
      subtasks.push('Bestimme die <strong>Ortskurve</strong> der Extrempunkte der Schar.');
    if (focus.includes('graph'))
      subtasks.push('Zeichne den Graphen von ' + fname + '.');

    $('task-card').className = 'task-card';
    $('task-card').innerHTML = `
      <div class="task-meta">
        <span class="tag">${taskLabel}</span>
        <span class="tag alt">${gen.typeLabel}</span>
        <span class="tag lvl">${gen.note || ''}</span>
      </div>
      <h3>Aufgabe</h3>
      <p>Gegeben ist die Funktion ${gen.isSchar ? 'die Funktionenschar' : ''}</p>
      <div class="func-display">${tex(gen.expr, fname)}</div>
      ${gen.isSchar ? '<p class="hint">mit dem Scharparameter t ∈ ℝ \\ {0}.</p>' : ''}
      <ol class="task-list">${subtasks.map(s => `<li>${s}</li>`).join('')}</ol>
    `;
  }

  function renderExtremalTask(gen) {
    $('task-card').className = 'task-card';
    $('task-card').innerHTML = `
      <div class="task-meta">
        <span class="tag">Extremalproblem</span>
        <span class="tag alt">${gen.title}</span>
      </div>
      <h3>Aufgabe</h3>
      <p>${gen.text}</p>
      <p class="hint">Zielfunktion (bereits aufgestellt): ${tex(gen.expr, gen.solveFor === 'max' ? 'Z(x)' : 'Z(x)')} &nbsp;mit&nbsp; <code>${gen.varHint}</code>, &nbsp;Definitionsbereich ${MU.pretty(gen.range[0])} ≤ x ≤ ${MU.pretty(gen.range[1])}.</p>
      <ol class="task-list">
        <li>Bestimme den Wert von x, für den die Zielgröße ${gen.solveFor === 'max' ? 'maximal' : 'minimal'} wird.</li>
        <li>Gib die gesuchten Größen an.</li>
      </ol>`;
    typeset($('task-card'));
  }

  /* ---------- Plot ---------- */
  function setupPlotControls() {
    const c = $('plot-controls');
    const opts = [
      ['f', 'f(x)'], ['fp', "f '(x)"], ['fpp', "f ''(x)"],
      ['points', 'markante Punkte'], ['tangente', 'Wendetangente/Normale'],
      ['area', 'Fläche'], ['asymptote', 'Asymptoten']
    ];
    c.innerHTML = opts.map(([k, lbl]) =>
      `<label><input type="checkbox" data-tg="${k}" ${STATE.toggles[k] ? 'checked' : ''}/> ${lbl}</label>`
    ).join('');
    c.querySelectorAll('input').forEach(inp =>
      inp.addEventListener('change', () => { STATE.toggles[inp.dataset.tg] = inp.checked; redraw(); }));
  }

  function redraw() {
    const a = STATE.analysis, pl = STATE.plotter, tg = STATE.toggles;
    if (!a) return;
    const t = STATE.gen.isSchar ? STATE.t : undefined;

    // Sicht: aus markanten Punkten
    const pts = [].concat(a.zeros.map(x => ({ x, y: 0 })), a.extrema, a.inflections);
    if (a.yIntercept) pts.push(a.yIntercept);
    pl.autoView(a.f, t, pts);

    pl.clear();
    pl.drawGrid();

    // Fläche
    if (tg.area && a.flaeche) {
      a.flaeche.pieces.forEach(p => pl.shadeArea(a.f, p.a, p.b, t));
    }
    // Asymptoten
    if (tg.asymptote && a.asymptotes) {
      a.asymptotes.vertical.forEach(x => pl.drawVAsymptote(x));
      a.asymptotes.horizontal.forEach(y => pl.drawLine(0, y, 'rgba(247,185,85,0.6)', [6, 5]));
      if (a.asymptotes.oblique) pl.drawLine(a.asymptotes.oblique.m, a.asymptotes.oblique.n, 'rgba(247,185,85,0.6)', [6, 5]);
    }
    // Wendetangente / Normale
    if (tg.tangente && a.wendetangente) {
      pl.drawLine(a.wendetangente.tangente.m, a.wendetangente.tangente.n, '#f06d6d', [2, 0]);
      if (a.wendetangente.normale) pl.drawLine(a.wendetangente.normale.m, a.wendetangente.normale.n, '#b18cff', [4, 4]);
    }
    // Schar (Nachbarkurven)
    if (STATE.gen.isSchar) {
      const ts = [-3, -2, -1, 1, 2, 3].filter(v => Math.abs(v - t) > 1e-9);
      ts.forEach(tv => { pl.ctx.globalAlpha = 0.22; pl.drawFunction(a.f, tv, '#6f86a0'); pl.ctx.globalAlpha = 1; });
    }
    // f, f', f''
    if (tg.f) pl.drawFunction(a.f, t, '#4ea1ff');
    if (tg.fp) pl.drawFunction(a.fp, t, '#36d399');
    if (tg.fpp) pl.drawFunction(a.fpp, t, '#f7b955');

    // Punkte
    if (tg.points) {
      a.zeros.forEach(x => pl.drawPoint(x, 0, '#4ea1ff', 'N'));
      a.extrema.forEach(e => pl.drawPoint(e.x, e.y, e.kind === 'Hochpunkt' ? '#36d399' : '#f06d6d',
        e.kind === 'Hochpunkt' ? 'HP' : (e.kind === 'Tiefpunkt' ? 'TP' : 'SP')));
      a.inflections.forEach(w => pl.drawPoint(w.x, w.y, '#b18cff', 'WP'));
      if (a.yIntercept) pl.drawPoint(0, a.yIntercept.y, '#9fb0c0', null);
    }
  }

  function setupExtremalPlot(gen) {
    const a = STATE.analysis, pl = STATE.plotter;
    $('plot-controls').innerHTML = '<label>Zielfunktion Z(x) auf dem Definitionsbereich</label>';
    const [lo, hi] = gen.range;
    // Sichtbereich auf Definitionsbereich begrenzen
    const ys = [];
    for (let i = 0; i <= 200; i++) { const x = lo + (hi - lo) * i / 200; const y = a.f(x); if (isFinite(y)) ys.push(y); }
    let ymin = Math.min(...ys), ymax = Math.max(...ys);
    const pad = (ymax - ymin) * 0.15 + 1;
    pl.setView({ xmin: lo - (hi - lo) * 0.08 - 0.5, xmax: hi + (hi - lo) * 0.08 + 0.5, ymin: ymin - pad, ymax: ymax + pad });
    pl.clear(); pl.drawGrid();
    pl.drawFunction(a.f, undefined, '#4ea1ff');
    if (a.x !== null) pl.drawPoint(a.x, a.y, gen.solveFor === 'max' ? '#36d399' : '#f06d6d', gen.solveFor === 'max' ? 'Max' : 'Min');
  }

  function onScharChange(e) {
    STATE.t = parseFloat(e.target.value);
    $('t-val').textContent = STATE.t;
    if (!STATE.gen) return;
    STATE.analysis = Solver.analyze(STATE.gen, { focus: STATE.focus, tValue: STATE.t });
    redraw();
    if (!$('solution-card').classList.contains('hidden')) renderSolution();
  }

  /* ---------- Lösungen ---------- */
  function toggleSolution() {
    const card = $('solution-card');
    if (card.classList.contains('hidden')) {
      renderSolution();
      card.classList.remove('hidden');
      $('toggle-solution').textContent = 'Lösungen ausblenden';
    } else {
      card.classList.add('hidden');
      $('toggle-solution').textContent = 'Lösungen anzeigen';
    }
  }

  function item(label, val) {
    return `<div class="sol-item"><span class="label">${label}</span><span class="val">${val}</span></div>`;
  }
  function section(title, inner) {
    return `<div class="sol-section"><h4>${title}</h4>${inner}</div>`;
  }
  function grid(items) { return `<div class="sol-grid">${items.join('')}</div>`; }
  function none(txt) { return `<p class="none-note">${txt}</p>`; }

  function renderSolution() {
    const card = $('solution-card');
    if (STATE.gen.task === 'extremalproblem') { renderExtremalSolution(); return; }
    const a = STATE.analysis, gen = STATE.gen, focus = STATE.focus;
    let html = '<h3>Lösungen' + (gen.isSchar ? ` (für t = ${STATE.t})` : '') + ' — nur Ergebnisse</h3>';

    if (focus.includes('kurvenuntersuchung')) {
      // Ableitungen
      let der = '';
      if (a.fpExpr) der += item("f ′(x)", prettyExpr(a.fpExpr));
      if (a.fppExpr) der += item("f ″(x)", prettyExpr(a.fppExpr));
      html += section('Ableitungen', grid([der]));

      // Symmetrie / Definitionsbereich
      let basics = item('Symmetrie', a.symmetry);
      if (a.yIntercept) basics += item('y-Achsenabschnitt', MU.point(0, a.yIntercept.y));
      html += section('Grundlegendes', grid([basics]));

      // Nullstellen
      const zItems = a.zeros.length
        ? grid(a.zeros.map((x, i) => item('Nullstelle N' + (i + 1), 'x = ' + MU.pretty(x))))
        : none('keine reellen Nullstellen im Untersuchungsbereich');
      html += section('Nullstellen', zItems);

      // Extrema
      const eItems = a.extrema.length
        ? grid(a.extrema.map(e => item(e.kind, MU.point(e.x, e.y))))
        : none('keine Extrempunkte');
      html += section('Extrempunkte', eItems);

      // Wendepunkte
      const wItems = a.inflections.length
        ? grid(a.inflections.map((w, i) => item('Wendepunkt W' + (i + 1), MU.point(w.x, w.y))))
        : none('keine Wendepunkte');
      html += section('Wendepunkte', wItems);

      // Asymptoten / Verhalten (senkrechte Pole + richtungsbehaftetes Grenzverhalten)
      const as = a.asymptotes;
      const asItems = [];
      as.vertical.forEach(x => asItems.push(item('senkrechte Asymptote (Polstelle)', 'x = ' + MU.pretty(x))));
      as.behavior.forEach(b => asItems.push(item('Grenzverhalten', b)));
      html += section('Verhalten im Unendlichen / Asymptoten', asItems.length ? grid(asItems) : none('keine Asymptoten; ganzrationales Verhalten (f(x) → ±∞)'));
    }

    if (focus.includes('wendetangente')) {
      if (a.wendetangente) {
        const w = a.wendetangente;
        const it = [
          item('Wendepunkt', MU.point(w.point.x, w.point.y)),
          item('Wendetangente', `y = ${MU.pretty(w.tangente.m)}·x ${w.tangente.n >= 0 ? '+' : '−'} ${MU.pretty(Math.abs(w.tangente.n))}`),
          item('Normale', w.normale ? `y = ${MU.pretty(w.normale.m)}·x ${w.normale.n >= 0 ? '+' : '−'} ${MU.pretty(Math.abs(w.normale.n))}` : 'senkrecht (Tangente waagerecht)')
        ];
        html += section('Wendetangente & Normale', grid(it));
      } else {
        html += section('Wendetangente & Normale', none('kein Wendepunkt vorhanden'));
      }
    }

    if (focus.includes('flaeche') && a.flaeche) {
      const fl = a.flaeche;
      const it = [];
      if (fl.mode === 'zeros') {
        it.push(item('Integrationsgrenzen', `[${MU.pretty(fl.a)} ; ${MU.pretty(fl.b)}] (zwischen Nullstellen)`));
        fl.pieces.forEach((p, i) => it.push(item('Teilfläche ' + (i + 1), `${MU.pretty(p.area)} FE  (∫ = ${MU.pretty(p.signed)})`)));
        it.push(item('Gesamtfläche', `${MU.pretty(fl.total)} FE`));
      } else {
        it.push(item('Intervall', `[${MU.pretty(fl.a)} ; ${MU.pretty(fl.b)}]`));
        it.push(item('orientierter Inhalt ∫', `${MU.pretty(fl.signed)}`));
        it.push(item('Flächeninhalt', `${MU.pretty(fl.area)} FE`));
      }
      html += section('Flächenberechnung', grid(it));
    }

    if (gen.isSchar && focus.includes('ortskurve')) {
      const ok = Solver.ortskurve(gen, 'extrema');
      if (ok.ok) {
        html += section('Ortskurve der Extrempunkte', grid([
          item('Gleichung', ok.equation),
          item('Anpassungsgüte', 'RMS ≈ ' + MU.pretty(ok.rms, 4))
        ]));
      } else {
        html += section('Ortskurve der Extrempunkte', none('keine durchgehende Ortskurve bestimmbar (zu wenige Extrempunkte über t)'));
      }
    }

    card.innerHTML = html;
    typeset(card);
  }

  function renderExtremalSolution() {
    const a = STATE.analysis, gen = STATE.gen;
    let html = '<h3>Lösung — nur Ergebnisse</h3>';
    if (a.x === null) { html += none('keine Lösung gefunden'); $('solution-card').innerHTML = html; return; }
    const it = [
      item('optimales x', MU.pretty(a.x)),
      item('Zielwert Z(x)', MU.pretty(a.y))
    ];
    if (a.report && a.report.extra) a.report.extra.forEach(([l, v]) => it.push(item(l, v)));
    html += section(gen.title, grid(it));
    $('solution-card').innerHTML = html;
    typeset($('solution-card'));
  }

  function typeset(_el) { /* kein externer Renderer nötig – Formeln sind bereits HTML */ }

  document.addEventListener('DOMContentLoaded', init);
})();
