/* Kunskapskampen – UI-hjälpfunktioner */
const KKUI = (() => {
  const $ = (sel) => document.querySelector(sel);

  /* Skalar 1920x1080-scenen så att den passar fönstret */
  function fitStage() {
    const stage = $('#stage');
    const s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    stage.style.transform = `translate(-50%, -50%) scale(${s})`;
  }

  function positionsFor(n) {
    if (n === 2) return ['tl', 'tr'];
    if (n === 3) return ['tl', 'tr', 'bl'];
    return ['tl', 'tr', 'bl', 'br'];
  }

  function buildPanels(players) {
    const wrap = $('#panels');
    wrap.innerHTML = '';
    const pos = positionsFor(players.length);
    players.forEach((p, i) => {
      const el = document.createElement('div');
      el.className = `ppanel ${pos[i]}`;
      el.id = `pp-${i}`;
      el.innerHTML = `
        <div class="p-name">${esc(p.name)}</div>
        <div class="p-score" id="ps-${i}">0</div>
        <div class="p-bar"><div id="pb-${i}"></div></div>
        <div class="p-turn">DIN TUR</div>`;
      wrap.appendChild(el);
    });
  }

  function setActivePanel(idx) {
    document.querySelectorAll('.ppanel').forEach(el => el.classList.remove('active'));
    const el = document.getElementById(`pp-${idx}`);
    if (el) el.classList.add('active');
  }

  function fmtScore(n) {
    return Number.isInteger(n) ? String(n) : String(n).replace('.', ',');
  }

  function updateScores(players, target = 20) {
    players.forEach((p, i) => {
      const s = document.getElementById(`ps-${i}`);
      const b = document.getElementById(`pb-${i}`);
      if (s) s.textContent = fmtScore(p.score);
      if (b) b.style.width = Math.min(100, (p.score / target) * 100) + '%';
    });
  }

  function bumpScore(idx) {
    const s = document.getElementById(`ps-${idx}`);
    if (!s) return;
    s.classList.remove('bump');
    void s.offsetWidth;
    s.classList.add('bump');
  }

  function showBanner(cat, isSteal, playerName, kickerOverride, subOverride) {
    const b = $('#banner');
    $('#bannerKicker').textContent = kickerOverride || (isSteal ? 'Vidarebefordrad fråga' : 'Kategori för ' + playerName);
    $('#bannerCat').textContent = cat;
    $('#bannerSub').textContent = subOverride || (isSteal
      ? `${playerName} får chansen på frågan som missats!`
      : 'Nästa fråga kommer strax...');
    b.classList.remove('hidden');
  }

  function hideBanner() { $('#banner').classList.add('hidden'); }

  /* ---------- KATEGORIHJUL ---------- */
  const WHEEL_COLORS = ['#26305f', '#1a2144', '#2c2465', '#1f1b3d', '#31386e', '#171c38'];

  function drawWheel(cats, highlightIdx = -1) {
    const cv = $('#wheelCanvas');
    const ctx = cv.getContext('2d');
    const n = cats.length;
    const R = cv.width / 2;
    const seg = (2 * Math.PI) / n;
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.save();
    ctx.translate(R, R);
    for (let i = 0; i < n; i++) {
      const a0 = -Math.PI / 2 - seg / 2 + i * seg;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, R - 6, a0, a0 + seg);
      ctx.closePath();
      ctx.fillStyle = i === highlightIdx ? '#ffd166' : WHEEL_COLORS[i % WHEEL_COLORS.length];
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 209, 102, 0.55)';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.save();
      ctx.rotate(a0 + seg / 2);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = i === highlightIdx ? '#241a02' : '#eef1ff';
      ctx.font = '700 26px system-ui, -apple-system, Roboto, "Helvetica Neue", Arial, sans-serif';
      const label = cats[i].length > 15 ? cats[i].slice(0, 14) + '…' : cats[i];
      ctx.fillText(label, R - 42, 0);
      ctx.restore();
    }
    // Nav i mitten
    ctx.beginPath();
    ctx.arc(0, 0, 52, 0, 2 * Math.PI);
    ctx.fillStyle = '#0d1021';
    ctx.fill();
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.restore();
  }

  /* Snurrar hjulet och landar på target. Pausbar; returnerar en promise. */
  let wheelState = null;

  function spinWheel(categories, target, kicker, sub) {
    return new Promise((resolve) => {
      const ov = $('#wheelOverlay');
      const land = $('#wheelLand');
      $('#wheelKicker').textContent = kicker || 'Kategorihjulet snurrar...';
      $('#wheelSub').textContent = sub || '';
      land.classList.add('hidden');
      ov.classList.remove('hidden');

      const n = categories.length;
      const segDeg = 360 / n;
      const idx = Math.max(0, categories.indexOf(target));
      const jitter = (Math.random() - 0.5) * segDeg * 0.7;
      const turns = 5 + Math.floor(Math.random() * 3);
      const finalRot = 360 * turns - idx * segDeg + jitter;
      const duration = 4300;

      drawWheel(categories);
      $('#wheelCanvas').style.transform = 'rotate(0deg)';

      const st = {
        cancelled: false, paused: false, phase: 'spin',
        elapsed: 0, landElapsed: 0, lastTs: performance.now(),
        lastSeg: -1, raf: 0, resolve
      };
      wheelState = st;

      function frame(now) {
        if (st.cancelled) return;
        const dt = now - st.lastTs;
        st.lastTs = now;

        if (!st.paused) {
          if (st.phase === 'spin') st.elapsed += dt;
          else st.landElapsed += dt;
        }

        if (st.phase === 'spin') {
          const p = Math.min(1, st.elapsed / duration);
          const ease = 1 - Math.pow(1 - p, 3);
          const rot = finalRot * ease;
          $('#wheelCanvas').style.transform = `rotate(${rot}deg)`;

          const cur = Math.floor(((((-rot / segDeg) % n) + n) % n));
          if (cur !== st.lastSeg) {
            st.lastSeg = cur;
            if (p < 1) KKAudio.tick();
          }

          if (p >= 1) {
            st.phase = 'land';
            drawWheel(categories, idx);
            land.textContent = target;
            land.classList.remove('hidden');
            KKAudio.tick();
          }
        } else if (st.landElapsed >= 900) {
          ov.classList.add('hidden');
          wheelState = null;
          resolve();
          return;
        }
        st.raf = requestAnimationFrame(frame);
      }
      st.raf = requestAnimationFrame(frame);
    });
  }

  /* Avbryter pågående hjulsnurr och löser dess promise (kedjan dör vid session-check) */
  function cancelWheel() {
    const st = wheelState;
    if (!st) return;
    st.cancelled = true;
    cancelAnimationFrame(st.raf);
    $('#wheelOverlay').classList.add('hidden');
    wheelState = null;
    st.resolve();
  }

  function showQuestion(q, playerName, steal) {
    $('#qTurn').innerHTML = `Nu svarar <b>${esc(playerName)}</b>` +
      (steal ? ' <span class="steal-tag">0,5 poäng om du svarar rätt!</span>' : '');
    $('#qCat').textContent = q.category;
    $('#qText').textContent = q.question;

    const opts = $('#options');
    opts.innerHTML = '';
    opts.classList.toggle('many', q.options.length > 3);
    q.options.forEach((text, i) => {
      const btn = document.createElement('button');
      btn.className = 'opt';
      btn.id = `opt-${i}`;
      btn.innerHTML = `<span class="key">${i + 1}</span><span>${esc(text)}</span>`;
      opts.appendChild(btn);
    });
    const keys = q.options.map((_, i) => i + 1).join(' / ');
    $('#hint').textContent = `Välj svar med mus eller tangent ${keys} – pausa eller avbryt med P`;
    $('#qarea').classList.remove('hidden');
  }

  function hideQuestion() {
    stopTimer();
    $('#qarea').classList.add('hidden');
  }

  /* ---------- NEDRÄKNINGSTIMER ---------- */
  const RING_C = 2 * Math.PI * 52;
  let timerState = null;

  function startTimer(seconds, onTimeout) {
    stopTimer();
    const el = $('#timer');
    const ring = $('#tRing');
    const secs = $('#timerSecs');
    ring.style.strokeDasharray = RING_C;
    ring.style.strokeDashoffset = 0;
    secs.textContent = seconds;
    el.classList.remove('hidden', 'warning', 'danger');

    timerState = {
      cancelled: false, paused: false, hi: false, raf: 0,
      totalMs: seconds * 1000,
      remainingMs: seconds * 1000,
      nextTick: performance.now() + 1000,
      lastTs: performance.now(),
      onTimeout
    };

    function frame(now) {
      const t = timerState;
      if (!t || t.cancelled) return;

      const dt = now - t.lastTs;
      t.lastTs = now;
      if (!t.paused) t.remainingMs -= dt;

      const remainMs = Math.max(0, t.remainingMs);
      const remain = Math.ceil(remainMs / 1000);

      ring.style.strokeDashoffset = RING_C * (1 - remainMs / t.totalMs);
      secs.textContent = remain;
      el.classList.toggle('warning', remain <= 10 && remain > 5);
      el.classList.toggle('danger', remain <= 5);

      if (!t.paused && now >= t.nextTick && t.remainingMs > 0) {
        t.nextTick += 1000;
        t.hi = !t.hi;
        if (remain <= 5) KKAudio.urgentTick(t.hi);
        else KKAudio.pendulumTick(t.hi);
      }

      if (t.remainingMs <= 0) {
        const cb = t.onTimeout;
        stopTimer();
        if (cb) cb();
        return;
      }
      t.raf = requestAnimationFrame(frame);
    }
    timerState.raf = requestAnimationFrame(frame);
  }

  function stopTimer() {
    if (timerState) {
      timerState.cancelled = true;
      cancelAnimationFrame(timerState.raf);
      timerState = null;
    }
    const el = $('#timer');
    if (el) el.classList.add('hidden');
  }

  /* Fryser/tinar timern, hjulet och pendeln utan att tappa återstående tid */
  function setPaused(flag) {
    $('#game').classList.toggle('paused', flag);
    if (timerState) {
      timerState.paused = flag;
      if (!flag) timerState.lastTs = performance.now();
    }
    if (wheelState) {
      wheelState.paused = flag;
      if (!flag) wheelState.lastTs = performance.now();
    }
  }

  /* Visar att tiden tog slut – frågan går vidare */
  function showTimeout() {
    document.querySelectorAll('.opt').forEach(el => { el.disabled = true; el.classList.add('dim'); });
    $('#qTurn').innerHTML = '<b>Tiden är ute!</b> <span class="steal-tag">Frågan går vidare...</span>';
  }

  /* Visar resultatet: vid fel svar avslöjas INTE rätt alternativ */
  function showResult(correctIdx, pickedIdx, isCorrect) {
    document.querySelectorAll('.opt').forEach((el, i) => {
      el.disabled = true;
      if (isCorrect) {
        if (i === correctIdx) el.classList.add('correct');
        else el.classList.add('dim');
      } else if (i === pickedIdx) {
        el.classList.add('wrong', 'shake');
      }
    });
  }

  function pointsPop(idx, pts, isCorrect) {
    const panel = document.getElementById(`pp-${idx}`);
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    const stage = $('#stage').getBoundingClientRect();
    const pop = document.createElement('div');
    pop.id = 'pointsPop';
    pop.textContent = (pts > 0 ? '+' : '') + fmtScore(pts);
    pop.style.color = isCorrect ? 'var(--good)' : 'var(--bad)';
    pop.style.left = (rect.left - stage.left + rect.width / 2 - 90) + 'px';
    pop.style.top = (rect.top - stage.top - 30) + 'px';
    $('#game').appendChild(pop);
    setTimeout(() => pop.remove(), 1400);
  }

  function setRoundInfo(round, difficultyLabel) {
    $('#roundInfo').textContent = 'Omgång ' + round;
    $('#gameDiff').textContent = difficultyLabel;
  }

  function showWinner(title, kicker, players) {
    $('#overlayKicker').textContent = kicker;
    $('#overlayTitle').textContent = title;
    const fs = $('#finalScores');
    fs.innerHTML = '';
    [...players].sort((a, b) => b.score - a.score).forEach((p, i) => {
      const row = document.createElement('div');
      row.className = 'fs-row' + (i === 0 ? ' winner' : '');
      row.innerHTML = `<span>${i + 1}. ${esc(p.name)}</span><span class="fs-pts">${fmtScore(p.score)} p</span>`;
      fs.appendChild(row);
    });
    $('#overlay').classList.remove('hidden');
  }

  function hideOverlay() { $('#overlay').classList.add('hidden'); }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  window.addEventListener('resize', fitStage);

  return {
    fitStage, buildPanels, setActivePanel, updateScores, bumpScore,
    showBanner, hideBanner, showQuestion, hideQuestion, showResult,
    pointsPop, setRoundInfo, showWinner, hideOverlay, esc, fmtScore, spinWheel,
    startTimer, stopTimer, showTimeout, setPaused, cancelWheel
  };
})();
