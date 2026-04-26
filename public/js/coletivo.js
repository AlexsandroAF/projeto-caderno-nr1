/* caderno · coletivo
   página pública. busca /api/stats; se indisponível, exibe dados de
   demonstração para visualizar o tratamento. */

(() => {
  'use strict';

  const ENDPOINT_STATS = '/api/stats';

  const DEMO = {
    total: 247,
    updated: new Date().toISOString(),
    mood: [
      { key: 'leve',     label: 'leve',     pct: 18 },
      { key: 'estavel',  label: 'estável',  pct: 31 },
      { key: 'inquieto', label: 'inquieto', pct: 24 },
      { key: 'pesado',   label: 'pesado',   pct: 14 },
      { key: 'apagado',  label: 'apagado',  pct: 13 },
    ],
    themes: [
      { label: 'ansiedade',         pct: 44 },
      { label: 'cansaço',           pct: 38 },
      { label: 'tristeza',          pct: 27 },
      { label: 'insônia',           pct: 22 },
      { label: 'falta de foco',     pct: 19 },
      { label: 'medo',              pct: 18 },
      { label: 'sensação de vazio', pct: 16 },
      { label: 'irritação',         pct: 14 },
    ],
    // 24 valores — chegada por hora, com pico no fim da noite
    hours: [3, 1, 1, 0, 0, 1, 2, 4, 6, 7, 8, 9, 8, 7, 6, 7, 8, 10, 12, 14, 17, 20, 16, 9],
    routes: [
      { key: 'plantao',    label: 'plantão psicológico',      pct: 32 },
      { key: 'ansiedade',  label: 'atendimento em ansiedade', pct: 24 },
      { key: 'sofrimento', label: 'sofrimento persistente',   pct: 18 },
      { key: 'grupo',      label: 'conversas em grupo',       pct: 14 },
      { key: 'sono',       label: 'oficina de sono',          pct: 12 },
    ],
  };

  // ----------------------------------------------------------------- helpers

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

  function fmtDate(iso) {
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    } catch (_) {
      return '—';
    }
  }

  // ----------------------------------------------------------------- render

  function render(data) {
    const total = Number(data.total) || 0;
    document.getElementById('total-count').textContent =
      total.toLocaleString('pt-BR');

    const updated = document.getElementById('updated');
    updated.textContent = 'atualizado ' + fmtDate(data.updated);
    if (data.updated) updated.dateTime = data.updated;

    const moodWrap = document.getElementById('bars-mood');
    (data.mood || []).forEach((m, i) =>
      moodWrap.appendChild(makeBar(m, 'var(--moss-deep)', 80 * i))
    );

    const themesWrap = document.getElementById('top-themes');
    (data.themes || []).forEach((t, i) =>
      themesWrap.appendChild(makeTop(t, i + 1))
    );

    const ribbon = document.getElementById('ribbon-hours');
    const hours = Array.isArray(data.hours) ? data.hours : [];
    const max = hours.length ? Math.max(...hours) : 0;
    hours.forEach((h, i) =>
      ribbon.appendChild(makeTick(h, max, i, 25 * i))
    );

    const routesWrap = document.getElementById('bars-routes');
    (data.routes || []).forEach((r, i) =>
      routesWrap.appendChild(makeBar(r, 'var(--terra)', 80 * i))
    );
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
