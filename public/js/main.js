/* caderno · o espelho
   peça educativa: três sintomas, vários caminhos por trás de cada um.
   tudo é anônimo. não enviamos nome, email, ip ou conteúdo — só interações
   (passo, tópico aberto, duração, hora, fuso). nada disso é diagnóstico. */

(() => {
  'use strict';

  const ENDPOINT_SUBMIT = '/api/submit';

  const leaves = Array.from(document.querySelectorAll('.leaf'));
  const dots   = Array.from(document.querySelectorAll('.chapter'));
  const total  = leaves.length;

  let current = 0;

  const session = {
    started: Date.now(),
    stepStarted: Date.now(),
    events: [],
  };

  // ---------------------------------------------------------------- tracking

  function track(name, data) {
    session.events.push({
      e: name,
      t: Date.now() - session.started,
      step: current,
      ...(data || {}),
    });
  }

  // ---------------------------------------------------------------- submit
  // backend inalterado: aceita sessões anônimas. aqui não há respostas de
  // questionário nem rota — apenas o registro de engajamento (quais espelhos
  // foram lidos, quais tópicos abertos), sempre sem identificar a pessoa.

  function buildPayload() {
    const now = new Date();
    return {
      v: 1,
      duration_ms: Date.now() - session.started,
      events: session.events,
      answers: {},
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      hour: now.getHours(),
      weekday: now.getDay(),
      lang: navigator.language || 'pt-BR',
      viewport: { w: window.innerWidth, h: window.innerHeight },
      // intencionalmente sem UA, sem IP, sem fingerprint
    };
  }

  let submitted = false;
  function submitSession() {
    if (submitted) return;
    submitted = true;

    try { localStorage.setItem('caderno_completed_at', String(Date.now())); } catch (_) {}

    const body = JSON.stringify(buildPayload());

    if (navigator.sendBeacon) {
      try {
        const blob = new Blob([body], { type: 'application/json' });
        navigator.sendBeacon(ENDPOINT_SUBMIT, blob);
        return;
      } catch (_) { /* fall through */ }
    }

    fetch(ENDPOINT_SUBMIT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => { /* best-effort, anônimo */ });
  }

  // ---------------------------------------------------------------- nav

  function showStep(index, isInitial) {
    if (index < 0 || index >= total) return;

    if (!isInitial) {
      track('step_leave', { duration_ms: Date.now() - session.stepStarted });
    }

    leaves.forEach((leaf, i) => {
      const active = i === index;
      leaf.hidden = !active;
      leaf.classList.toggle('leaf--active', active);
    });

    dots.forEach((dot, i) => {
      dot.classList.remove('chapter--active', 'chapter--past');
      if (i === index) dot.classList.add('chapter--active');
      else if (i < index) dot.classList.add('chapter--past');
    });

    current = index;
    session.stepStarted = Date.now();

    if (!isInitial) {
      track('step_enter');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // chegou na mensagem final — registra a leitura (anônima)
    if (index === total - 1) submitSession();
  }

  function resetMirror() {
    // fecha todos os tópicos abertos
    document.querySelectorAll('.facet--open').forEach((li) => {
      li.classList.remove('facet--open');
      const btn = li.querySelector('.facet__head');
      if (btn) btn.setAttribute('aria-expanded', 'false');
    });
    submitted = false;
    session.events = [];
    session.started = Date.now();
    session.stepStarted = Date.now();
  }

  // ---------------------------------------------------------------- events

  document.addEventListener('click', (ev) => {
    // tópico clicável (abre/fecha a explicação)
    const head = ev.target.closest('.facet__head');
    if (head) {
      const li   = head.closest('.facet');
      const open = li.classList.toggle('facet--open');
      head.setAttribute('aria-expanded', open ? 'true' : 'false');
      track(open ? 'facet_open' : 'facet_close', {
        facet: (head.querySelector('.facet__name') || {}).textContent || '',
      });
      return;
    }

    // navegação
    const trigger = ev.target.closest('[data-action]');
    if (trigger) {
      const action = trigger.dataset.action;
      if (action === 'next' || action === 'prev' || action === 'restart') {
        ev.preventDefault();
      }

      if (action === 'next') {
        showStep(current + 1);
      } else if (action === 'prev') {
        showStep(current - 1);
      } else if (action === 'restart') {
        track('restart');
        resetMirror();
        showStep(0, true);
      }
    }

    // rastreio genérico de CTA (links marcados)
    const cta = ev.target.closest('[data-track]');
    if (cta) {
      track('cta_click', { kind: cta.dataset.track });
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      track('hidden');
      if (current > 0) submitSession();
    } else {
      track('visible');
    }
  });

  window.addEventListener('pagehide', () => {
    track('pagehide');
    if (current > 0) submitSession();
  });

  // -- teclado: Enter avança; espaço/Enter no tópico já é nativo do <button> --
  document.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter') return;
    const tag = ev.target.tagName;
    if (tag === 'BUTTON' || tag === 'A') return; // deixa o clique nativo agir
    const nextBtn = leaves[current].querySelector('[data-action="next"]');
    if (nextBtn) {
      ev.preventDefault();
      nextBtn.click();
    }
  });

  // ---------------------------------------------------------------- init

  showStep(0, true);
  track('arrived');

  // já passou por aqui antes? revela o link do coletivo na acolhida.
  try {
    if (localStorage.getItem('caderno_completed_at')) {
      const ret = document.querySelector('.welcome__return');
      if (ret) ret.hidden = false;
    }
  } catch (_) { /* storage pode estar desativado — fallback silencioso */ }
})();
