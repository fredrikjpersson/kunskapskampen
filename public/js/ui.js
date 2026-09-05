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
    if (n === 4) return ['tl', 'tr', 'bl', 'br'];
    return ['tl', 'tr', 'tc', 'bl', 'br'];
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

  function updateScores(players) {
    players.forEach((p, i) => {
      const s = document.getElementById(`ps-${i}`);
      const b = document.getElementById(`pb-${i}`);
      if (s) s.textContent = fmtScore(p.score);
      if (b) b.style.width = Math.min(100, (p.score / 20) * 100) + '%';
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

  function showQuestion(q, playerName, steal) {
    $('#qTurn').innerHTML = `Nu svarar <b>${esc(playerName)}</b>` +
      (steal ? ' <span class="steal-tag">0,5 poäng om du svarar rätt!</span>' : '');
    $('#qCat').textContent = q.category;
    $('#qText').textContent = q.question;

    const opts = $('#options');
    opts.innerHTML = '';
    q.options.forEach((text, i) => {
      const btn = document.createElement('button');
      btn.className = 'opt';
      btn.id = `opt-${i}`;
      btn.innerHTML = `<span class="key">${i + 1}</span><span>${esc(text)}</span>`;
      opts.appendChild(btn);
    });
    $('#qarea').classList.remove('hidden');
  }

  function hideQuestion() { $('#qarea').classList.add('hidden'); }

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
    pointsPop, setRoundInfo, showWinner, hideOverlay, esc, fmtScore
  };
})();
