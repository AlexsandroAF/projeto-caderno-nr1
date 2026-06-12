/* caderno · coletivo
   página pública. busca /api/stats; se indisponível, exibe dados de
   demonstração para visualizar o tratamento. */

(() => {
  'use strict';

  const ENDPOINT_STATS = '/api/stats';

  const DEMO = {
    total: 247,
    updated: new Date().toISOString(),
    // funil dos três espelhos (+ recorte): % das pessoas que alcançam cada um
    mirrors: [
      { key: 'sozinho', label: 'prefiro ficar sozinho(a)',              pct: 100 },
      { key: 'emocoes', label: 'não sinto as emoções como os outros',   pct: 86 },
      { key: 'confiar', label: 'dificuldade em confiar ou se abrir',    pct: 71 },
      { key: 'recorte', label: 'chegaram ao recorte',                   pct: 58 },
    ],
    // leituras (transtornos) mais abertas — % de pessoas que abriram cada uma
    facets: [
      { label: 'Esquizóide',                pct: 54 },
      { label: 'Borderline',                pct: 41 },
      { label: 'Evitativo (ansioso)',       pct: 33 },
      { label: 'Antissocial (psicopatia)',  pct: 29 },
      { label: 'Narcisista',                pct: 24 },
      { label: 'Depressivo',                pct: 21 },
      { label: 'Paranóide',                 pct: 18 },
      { label: 'Esquizotípico',             pct: 12 },
    ],
    // 24 valores — chegada por hora, com pico no fim da noite
    hours: [3, 1, 1, 0, 0, 1, 2, 4, 6, 7, 8, 9, 8, 7, 6, 7, 8, 10, 12, 14, 17, 20, 16, 9],
  };

  // ----------------------------------------------------------------- helpers

  const reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function span(cls, text) {
    const s = document.createElement('span');
    s.className = cls;
    if (text != null) s.textContent = String(text);
    return s;
  }

  function pctSpan(cls, value) {
    // builds: <span class="cls">42<i>%</i></span> — XSS-safe via textContent
    const s = span(cls);
    s.append(String(value));
    const i = document.createElement('i');
    i.textContent = '%';
    s.appendChild(i);
    return s;
  }

  function clampPct(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return 0;
    return Math.max(0, Math.min(100, Math.round(v)));
  }

  function fmtNumber(n) {
    return Number(n).toLocaleString('pt-BR');
  }

  function fmtDate(iso) {
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    } catch (_) {
      return '—';
    }
  }

  // count from 0 → to with ease-out cubic; duration scales with magnitude
  function animateCount(el, to) {
    if (typeof to !== 'number' || !Number.isFinite(to) || to <= 0) {
      el.textContent = '0';
      return;
    }
    if (reduceMotion) {
      el.textContent = fmtNumber(to);
      return;
    }
    const duration = Math.min(1800, Math.max(700, to * 60));
    const start = performance.now();
    function tick(now) {
      const e = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - e, 3);
      el.textContent = fmtNumber(Math.floor(eased * to));
      if (e < 1) requestAnimationFrame(tick);
      else el.textContent = fmtNumber(to);
    }
    el.textContent = '0';
    requestAnimationFrame(tick);
  }

  // ----------------------------------------------------------------- builders

  function makeBar(item, accent, delay) {
    const row = document.createElement('div');
    row.className = 'bar';
    row.style.setProperty('--accent', accent);

    row.appendChild(span('bar__label', item.label));

    const track = document.createElement('span');
    track.className = 'bar__track';
    track.setAttribute('aria-hidden', 'true');
    const fill = document.createElement('span');
    fill.className = 'bar__fill';
    const pct = clampPct(item.pct);
    fill.style.setProperty('--pct', pct + '%');
    fill.style.animationDelay = delay + 'ms';
    track.appendChild(fill);
    row.appendChild(track);

    row.appendChild(pctSpan('bar__pct', pct));
    return row;
  }

  function makeTop(item, n) {
    const li = document.createElement('li');
    li.appendChild(span('top__num', String(n).padStart(2, '0')));
    li.appendChild(span('top__label', item.label));
    li.appendChild(pctSpan('top__pct', clampPct(item.pct)));
    return li;
  }

  function makeTick(value, max, hour, delay) {
    const tick = document.createElement('span');
    tick.className = 'tick';
    const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 2;
    tick.style.setProperty('--h', pct + '%');
    tick.style.animationDelay = delay + 'ms';
    tick.title = String(hour).padStart(2, '0') + 'h · ' + value;
    return tick;
  }

  // ----------------------------------------------------------------- render

  function renderEmpty(data) {
    document.querySelector('.bulletin-lede').hidden = true;
    const empty = document.querySelector('.bulletin-lede--empty');
    if (empty) empty.hidden = false;
    document.body.classList.add('is-empty');
  }

  function renderFull(data, total) {
    animateCount(document.getElementById('total-count'), total);

    const updated = document.getElementById('updated');
    updated.textContent = 'atualizado ' + fmtDate(data.updated);
    if (data.updated) updated.dateTime = data.updated;

    const mirrorsWrap = document.getElementById('bars-mirrors');
    (data.mirrors || []).forEach((m, i) =>
      mirrorsWrap.appendChild(makeBar(m, 'var(--moss-deep)', 80 * i))
    );

    const facetsWrap = document.getElementById('top-facets');
    (data.facets || []).forEach((f, i) =>
      facetsWrap.appendChild(makeTop(f, i + 1))
    );

    const ribbon = document.getElementById('ribbon-hours');
    const hours = Array.isArray(data.hours) ? data.hours : [];
    const max = hours.length ? Math.max(...hours) : 0;
    hours.forEach((h, i) =>
      ribbon.appendChild(makeTick(h, max, i, 25 * i))
    );
  }

  function render(data) {
    const total = Number(data && data.total) || 0;
    if (total === 0) {
      renderEmpty(data);
      return;
    }
    renderFull(data, total);
  }

  function load() {
    if (!('fetch' in window)) {
      render(DEMO);
      return;
    }
    fetch(ENDPOINT_STATS, { headers: { Accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => render(data))
      .catch(() => render(DEMO));
  }

  // ----------------------------------------------------------------- init

  // mark this device as having seen the coletivo so the welcome screen can
  // surface a return link next time, even if they came in via shared URL
  try { localStorage.setItem('caderno_completed_at', String(Date.now())); } catch (_) {}

  load();
})();
