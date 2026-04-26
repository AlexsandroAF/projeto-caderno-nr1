/* caderno · pesquisa de campo
   tudo é anônimo. não enviamos nome, email, ip ou conteúdo de texto livre —
   só interações (passo, opção, duração, hora, fuso). */

(() => {
  'use strict';

  const ENDPOINT_SUBMIT = '/api/submit';
  const ENDPOINT_TRACK  = '/api/track';

  const leaves = Array.from(document.querySelectorAll('.leaf'));
  const dots   = Array.from(document.querySelectorAll('.chapter'));
  const total  = leaves.length;

  let current = 0;

  const session = {
    started: Date.now(),
    stepStarted: Date.now(),
    events: [],
    answers: {},
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

  function captureAnswers() {
    document.querySelectorAll('input[type="radio"]:checked').forEach((el) => {
      session.answers[el.name] = el.value;
    });

    const themes = Array.from(
      document.querySelectorAll('input[name="q_themes"]:checked')
    ).map((el) => el.value);
    if (themes.length) session.answers.q_themes = themes;

    const word = document.querySelector('input[name="q_word"]');
    if (word && word.value.trim()) {
      // we never store the literal word — only its length, as a soft signal
      session.answers.q_word_len = word.value.trim().length;
    }
  }

  // ---------------------------------------------------------------- routing

  const ROUTES = {
    ansiedade: {
      title: 'atendimento em ansiedade',
      body: 'um grupo dedicado a quem tem vivido inquietação, medo ou pensamento acelerado. escuta especializada, acolhimento individual.',
      meta: 'agendamento por mensagem · gratuito · campus',
      cta: 'agendar acolhimento',
    },
    sofrimento: {
      title: 'escuta de sofrimento persistente',
      body: 'para sentimentos de tristeza, vazio ou perda de interesse que vêm te acompanhando. profissionais que entendem o tempo desse processo.',
      meta: 'agendamento por mensagem · gratuito · campus',
      cta: 'agendar acolhimento',
    },
    grupo: {
      title: 'conversas em grupo',
      body: 'encontros pequenos, com mediação, sobre vínculos, solidão e estar com outros. quartas-feiras, 19h, no campus.',
      meta: 'sem inscrição · entrada e saída livres',
      cta: 'ver próximos encontros',
    },
    sono: {
      title: 'oficina de sono e cansaço',
      body: 'um encontro curto sobre rotinas, descanso e o que tem te tirado as forças. prático, sem patologizar.',
      meta: 'oficinas mensais · gratuito · campus',
      cta: 'ver próxima oficina',
    },
    plantao: {
      title: 'plantão psicológico',
      body: 'um espaço de escuta, gratuito, sem agendamento. atende em horário comercial no campus — basta chegar.',
      meta: 'sem agendamento · seg a sex · 9h às 17h',
      cta: 'ver localização',
    },
  };

  function determineRoute() {
    const a = session.answers;
    const themes = a.q_themes || [];
    const mood = a.q_mood;

    const has = (...keys) => keys.some((k) => themes.includes(k));

    let key = 'plantao';

    if (has('ansiedade', 'medo') || mood === 'inquieto') {
      key = 'ansiedade';
    } else if (has('tristeza', 'vazio', 'interesse', 'sentido') || mood === 'apagado') {
      key = 'sofrimento';
    } else if (has('relacoes', 'solidao')) {
      key = 'grupo';
    } else if (has('cansaco', 'insonia')) {
      key = 'sono';
    }

    const route = ROUTES[key];
    document.getElementById('route-title').textContent = route.title;
    document.getElementById('route-body').textContent  = route.body;
    document.getElementById('route-meta').textContent  = route.meta;
    const cta = document.getElementById('route-cta');
    cta.querySelector('span').textContent = route.cta;
    cta.dataset.route = key;

    track('route_shown', { route: key });
    return key;
  }

  // ---------------------------------------------------------------- submit

  function buildPayload() {
    const now = new Date();
    return {
      v: 1,
      duration_ms: Date.now() - session.started,
      events: session.events,
      answers: session.answers,
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      hour: now.getHours(),
      weekday: now.getDay(),
      lang: navigator.language || 'pt-BR',
      viewport: { w: window.innerWidth, h: window.innerHeight },
      // intentionally no UA, no IP, no fingerprint
    };
  }

  function submitSession() {
    // mark this device as having completed once — used to reveal the
    // coletivo link on subsequent visits to the welcome screen.
    try { localStorage.setItem('caderno_completed_at', String(Date.now())); } catch (_) {}

    const payload = buildPayload();
    const body = JSON.stringify(payload);

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
    }).catch(() => { /* best-effort, anonymous */ });
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
      // gentle scroll to top, no focus theft
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    if (index === total - 1) {
      determineRoute();
      submitSession();
    }
  }

  function validateStep(idx) {
    const leaf = leaves[idx];
    if (idx === 0 || idx === total - 1) return true; // welcome / final
    if (idx === 2 || idx === 4) return true;          // multi-select / text are optional

    const radios = leaf.querySelectorAll('input[type="radio"]');
    if (radios.length) {
      const checked = leaf.querySelector('input[type="radio"]:checked');
      if (!checked) {
        const list = leaf.querySelector('.ink-list');
        if (list) {
          list.classList.remove('shake');
          // force reflow to restart animation
          void list.offsetWidth;
          list.classList.add('shake');
        }
        track('validate_fail', { reason: 'no_radio' });
        return false;
      }
    }
    return true;
  }

  function resetAnswers() {
    document.querySelectorAll('input').forEach((el) => {
      if (el.type === 'radio' || el.type === 'checkbox') el.checked = false;
      else if (el.type === 'text') el.value = '';
    });
    session.answers = {};
    session.events = [];
    session.started = Date.now();
    session.stepStarted = Date.now();
  }

  // ---------------------------------------------------------------- events

  document.addEventListener('click', (ev) => {
    const trigger = ev.target.closest('[data-action]');
    if (trigger) {
      const action = trigger.dataset.action;
      if (action === 'next' || action === 'prev' || action === 'restart') {
        ev.preventDefault();
      }

      if (action === 'next') {
        if (!validateStep(current)) return;
        captureAnswers();
        showStep(current + 1);
      } else if (action === 'prev') {
        showStep(current - 1);
      } else if (action === 'restart') {
        track('restart');
        resetAnswers();
        showStep(0, true);
      }
    }

    // generic CTA tracking
    const cta = ev.target.closest('[data-track]');
    if (cta) {
      track('cta_click', {
        kind: cta.dataset.track,
        route: cta.dataset.route,
      });
    }
  });

  document.addEventListener('change', (ev) => {
    const el = ev.target;
    if (el.matches('input[type="radio"], input[type="checkbox"]')) {
      track('option_pick', {
        field: el.name,
        value: el.value,
        checked: el.checked,
      });
    }
  });

  document.addEventListener('focusin', (ev) => {
    if (ev.target.matches('input[type="text"]')) {
      track('text_focus', { field: ev.target.name });
    }
  });

  document.addEventListener('focusout', (ev) => {
    if (ev.target.matches('input[type="text"]')) {
      track('text_blur', {
        field: ev.target.name,
        len: ev.target.value.trim().length,
      });
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      track('hidden');
      // best-effort flush of partial session if the user wanders off mid-flow
      if (current > 0 && current < total - 1) submitSession();
    } else {
      track('visible');
    }
  });

  window.addEventListener('pagehide', () => {
    track('pagehide');
    if (current < total - 1) submitSession();
  });

  // -- soft keyboard nav: Enter advances on radio/checkbox steps --
  document.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter') return;
    const tag = ev.target.tagName;
    if (tag === 'INPUT' && ev.target.type === 'text') return; // free typing
    if (tag === 'BUTTON' || tag === 'A') return;
    const nextBtn = leaves[current].querySelector('[data-action="next"]');
    if (nextBtn) {
      ev.preventDefault();
      nextBtn.click();
    }
  });

  // ---------------------------------------------------------------- init

  showStep(0, true);
  track('arrived');

  // returning visitor? surface the coletivo link on the welcome screen.
  try {
    if (localStorage.getItem('caderno_completed_at')) {
      const ret = document.querySelector('.welcome__return');
      if (ret) ret.hidden = false;
    }
  } catch (_) { /* storage may be disabled — silent fallback */ }
})();
