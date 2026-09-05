/* Kunskapskampen – spelmotor */
const CATEGORIES = ['Natur', 'Teknik', 'Ljud', 'Musik', 'Bilar', 'Geografi',
  'Musik från förr', 'Barnprogram', 'Dans', 'Brädspel', 'Elit'];

const DIFF_LABELS = {
  latt: 'Lätt',
  medel: 'Medel',
  svar: 'Svår',
  elit: 'Elit',
  geni: 'Geni'
};

const TARGET_SCORES = [10, 15, 20, 25, 30];
const BANNER_MS = 2600;
const RESULT_MS = 1900;
const TIMER_FIRST = 30;   // sekunder för den som först får frågan
const TIMER_STEAL = 15;   // sekunder för vidarebefordrad fråga

let S = null; // speltilstånd
let SESSION = 0; // ökas vid avbryt – dödar pågående async-kedjor
let PAUSED = false;

const alive = (sid) => S && S.session === sid;

/* Pausbar sleep: räknar ned bara när spelet inte är pausat */
const sleep = (ms) => new Promise(resolve => {
  let remaining = ms;
  let last = performance.now();
  const iv = setInterval(() => {
    const now = performance.now();
    if (!PAUSED) remaining -= now - last;
    last = now;
    if (remaining <= 0) { clearInterval(iv); resolve(); }
  }, 50);
});
const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];

async function fetchQuestion(category, difficulty) {
  const res = await fetch(`/api/question?category=${encodeURIComponent(category)}&difficulty=${difficulty}`);
  if (!res.ok) throw new Error('Kunde inte hämta fråga');
  return res.json();
}

/* ================= SETUP-SKÄRM ================= */
(function initSetup() {
  KKUI.fitStage();
  const countWrap = document.getElementById('playerCountBtns');
  const nameWrap = document.getElementById('nameInputs');
  const diffWrap = document.getElementById('diffBtns');
  const targetWrap = document.getElementById('targetBtns');
  const startBtn = document.getElementById('startBtn');
  let count = 0;
  let diff = null;
  let target = 0;

  for (let n = 2; n <= 4; n++) {
    const b = document.createElement('button');
    b.className = 'count-btn';
    b.textContent = n;
    b.onclick = () => {
      count = n;
      render();
      const first = nameWrap.querySelector('input');
      if (first) first.focus();
    };
    countWrap.appendChild(b);
  }

  for (const t of TARGET_SCORES) {
    const b = document.createElement('button');
    b.className = 'count-btn';
    b.textContent = t;
    b.dataset.target = t;
    b.onclick = () => { target = t; render(); };
    targetWrap.appendChild(b);
  }

  for (const [key, label] of Object.entries(DIFF_LABELS)) {
    const b = document.createElement('button');
    b.className = 'diff-btn';
    if (key === 'geni') {
      b.innerHTML = `${label}<small>6 alternativ · 140+ IQ</small>`;
    } else {
      b.textContent = label;
    }
    b.dataset.diff = key;
    b.onclick = () => { diff = key; render(); };
    diffWrap.appendChild(b);
  }

  function render() {
    [...countWrap.children].forEach((el, i) => el.classList.toggle('sel', i + 2 === count));
    [...diffWrap.children].forEach(el => el.classList.toggle('sel', el.dataset.diff === diff));
    [...targetWrap.children].forEach(el => el.classList.toggle('sel', +el.dataset.target === target));
    document.getElementById('tagline').textContent = target
      ? `Frågesport för 2–4 spelare – först till ${target} poäng vinner!`
      : 'Frågesport för 2–4 spelare – först till målet vinner!';

    // Bevara redan inmatade namn när fälten byggs om
    const prev = [...nameWrap.querySelectorAll('input')].map(i => i.value);
    nameWrap.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const input = document.createElement('input');
      input.type = 'text';
      input.maxLength = 14;
      input.placeholder = 'Spelare ' + (i + 1);
      input.value = prev[i] || (S && S.players && S.players[i] && S.players[i]._name) || '';
      input.oninput = () => validate();
      nameWrap.appendChild(input);
    }
    validate();
  }

  /* Låser upp stegen i tur och ordning: antal → namn → svårighet → målpoäng → start */
  function updateLocks() {
    const inputs = [...nameWrap.querySelectorAll('input')];
    const namesFilled = count > 0 && inputs.length === count && inputs.every(i => i.value.trim().length > 0);
    document.getElementById('nameBlock').classList.toggle('locked', count === 0);
    document.getElementById('diffBlock').classList.toggle('locked', !namesFilled);
    document.getElementById('targetBlock').classList.toggle('locked', !namesFilled || !diff);
    startBtn.disabled = !(namesFilled && diff && target);
  }

  function validate() {
    updateLocks();
  }

  startBtn.onclick = () => {
    KKAudio.unlock();
    const names = [...nameWrap.querySelectorAll('input')].map(i => i.value.trim());
    startGame(names, diff, target);
  };

  render();
})();

/* ================= SPELSTART ================= */
async function startGame(names, difficulty, target) {
  document.getElementById('setup').classList.add('hidden');
  document.getElementById('game').classList.remove('hidden');
  await fetch('/api/reset-used', { method: 'POST' }).catch(() => {});

  S = {
    session: ++SESSION,
    players: names.map(n => ({ name: n, _name: n, score: 0 })),
    difficulty,
    target: target || 20,
    current: 0,
    round: 1,
    handedQuestion: null,   // fråga som går vidare efter felaktigt svar
    finishRound: false,     // någon har nått 20 – spela varvet klart
    mode: 'normal',         // 'normal' | 'tiebreak'
    tb: null,               // tiebreak-tillstånd
    q: null,
    steal: false,
    phase: 'idle',
    locked: true
  };
  PAUSED = false;
  KKUI.setPaused(false);
  document.getElementById('pauseBtn').classList.remove('hidden');

  KKUI.buildPanels(S.players);
  KKUI.updateScores(S.players, S.target);
  KKUI.hideOverlay();
  nextTurn();
}

/* ================= TURLOGIK ================= */
async function nextTurn() {
  if (!S || S.mode === 'over') return;
  const sid = S.session;
  KKUI.hideQuestion();
  KKUI.setRoundInfo(S.round, DIFF_LABELS[S.difficulty]);
  KKUI.setActivePanel(S.current);
  KKUI.updateScores(S.players, S.target);
  const player = S.players[S.current];

  if (S.handedQuestion) {
    if ((S.handedQuestion.failedBy || []).length >= S.players.length) {
      S.handedQuestion = null; // alla har svarat fel – släng frågan
      return nextTurn();
    }
    S.q = S.handedQuestion;
    S.steal = true;
    KKUI.showBanner(S.q.category, true, player.name);
    KKAudio.tick();
    await sleep(BANNER_MS);
    if (!alive(sid)) return;
    KKUI.hideBanner();
    KKUI.showQuestion(S.q, player.name, true);
    KKUI.startTimer(TIMER_STEAL, timeout);
  } else {
    const cat = rand(CATEGORIES);
    // Hämta frågan medan hjulet snurrar
    const qPromise = fetchQuestion(cat, S.difficulty).catch(() => null);
    await KKUI.spinWheel(CATEGORIES, cat, 'Kategori för ' + player.name, 'Hjulet avgör nästa kategori...');
    if (!alive(sid)) return;
    const q = await qPromise;
    if (!alive(sid)) return;
    if (!q) {
      await sleep(400);
      if (!alive(sid)) return;
      return nextTurn();
    }
    S.q = q;
    S.steal = false;
    KKUI.showQuestion(S.q, player.name, false);
    KKUI.startTimer(TIMER_FIRST, timeout);
  }
  S.phase = 'question';
}

/* ================= SVARSHANTERING ================= */
async function answer(optionIndex) {
  if (!S || S.phase !== 'question' || !S.q || PAUSED) return;
  if (optionIndex < 0 || optionIndex >= S.q.options.length) return;
  KKUI.stopTimer();
  S.phase = 'result';

  if (S.mode === 'tiebreak') return tbAnswer(optionIndex);

  const sid = S.session;
  const q = S.q;
  const picked = q.options[optionIndex];
  const correctIdx = q.options.indexOf(q.correct);
  const isCorrect = picked === q.correct;
  const player = S.players[S.current];
  const panelIdx = S.current;

  KKUI.showResult(correctIdx, optionIndex, isCorrect);

  if (isCorrect) {
    const pts = S.steal ? 0.5 : 1;
    player.score += pts;
    S.handedQuestion = null;
    KKAudio.correct();
    KKUI.pointsPop(panelIdx, pts, true);
    KKUI.updateScores(S.players, S.target);
    KKUI.bumpScore(panelIdx);
  } else {
    KKAudio.wrong();
    KKUI.pointsPop(panelIdx, 0, false);
    q.failedBy = [...(q.failedBy || []), panelIdx];
    S.handedQuestion = q; // frågan går vidare till nästa spelare
  }

  await sleep(RESULT_MS);
  if (!alive(sid)) return;
  KKUI.hideQuestion();
  advance();
}

/* Timeout – räknas som fel svar: frågan går vidare till nästa spelare */
async function timeout() {
  if (!S || S.phase !== 'question' || !S.q || PAUSED) return;
  S.phase = 'result';

  if (S.mode === 'tiebreak') return tbTimeout();

  const sid = S.session;
  const q = S.q;
  const panelIdx = S.current;

  KKUI.showTimeout();
  KKAudio.wrong();
  KKUI.pointsPop(panelIdx, 0, false);
  q.failedBy = [...(q.failedBy || []), panelIdx];
  S.handedQuestion = q;

  await sleep(RESULT_MS);
  if (!alive(sid)) return;
  KKUI.hideQuestion();
  advance();
}

/* Gå vidare till nästa spelare / avsluta varv */
function advance() {
  if (S.players.some(p => p.score >= S.target)) S.finishRound = true;

  S.current += 1;
  if (S.current >= S.players.length) {
    S.current = 0;
    S.round += 1;
    if (S.finishRound) return endOfRound();
  }
  nextTurn();
}

/* ================= SPELAVSLUT ================= */
function endOfRound() {
  const leaders = S.players.filter(p => p.score >= S.target);
  if (leaders.length === 0) { S.finishRound = false; return nextTurn(); }
  if (leaders.length === 1) return declareWinner(leaders[0]);
  startTiebreak(leaders);
}

function declareWinner(player) {
  S.mode = 'over';
  S.phase = 'over';
  KKUI.hideQuestion();
  document.getElementById('pauseBtn').classList.add('hidden');
  KKAudio.fanfare();
  KKUI.showWinner(player.name, 'Vinnaren av Kunskapskampen', S.players);
}

/* ================= UTSLAGSFRÅGOR ================= */
async function startTiebreak(leaders) {
  S.mode = 'tiebreak';
  S.finishRound = false;
  S.handedQuestion = null;
  S.tb = {
    remaining: S.players.map((p, i) => leaders.includes(p) ? i : -1).filter(i => i >= 0),
    current: 0,
    asked: 0
  };
  await nextTbQuestion();
}

async function nextTbQuestion() {
  const tb = S.tb;
  const sid = S.session;
  tb.current = 0;
  tb.asked += 1;
  KKUI.hideQuestion();

  const cat = rand(CATEGORIES);
  const qPromise = fetchQuestion(cat, 'elit').catch(() => null);
  await KKUI.spinWheel(CATEGORIES, cat, 'Utslagsfråga ' + tb.asked, 'Utslagsfråga på Elit-nivå – avgör vinnaren!');
  if (!alive(sid)) return;
  const q = await qPromise;
  if (!alive(sid)) return;
  if (!q) {
    return nextTbQuestion();
  }
  S.q = q;
  tbAsk();
}

function tbAsk() {
  const tb = S.tb;
  if (tb.current >= tb.remaining.length) return tbEvaluate();
  const idx = tb.remaining[tb.current];
  KKUI.setActivePanel(idx);
  KKUI.showQuestion(S.q, S.players[idx].name + ' – de andra: titta bort!', false);
  KKUI.startTimer(tb.current === 0 ? TIMER_FIRST : TIMER_STEAL, timeout);
  S.phase = 'question';
}

async function tbAnswer(optionIndex) {
  const tb = S.tb;
  const sid = S.session;
  KKUI.stopTimer();
  const idx = tb.remaining[tb.current];
  const q = S.q;
  const picked = q.options[optionIndex];
  const correctIdx = q.options.indexOf(q.correct);
  const isCorrect = picked === q.correct;

  KKUI.showResult(correctIdx, optionIndex, isCorrect);
  if (isCorrect) KKAudio.correct(); else KKAudio.wrong();

  if (!isCorrect) {
    tb.eliminatedNow = (tb.eliminatedNow || []).concat(idx);
    KKUI.pointsPop(idx, 0, false);
  }

  await sleep(RESULT_MS);
  if (!alive(sid)) return;
  tb.current += 1;
  tbAsk();
}

/* Timeout i utslagsfråga – räknas som fel svar: spelaren slås ut */
async function tbTimeout() {
  const tb = S.tb;
  const sid = S.session;
  const idx = tb.remaining[tb.current];

  KKUI.showTimeout();
  KKAudio.wrong();
  tb.eliminatedNow = (tb.eliminatedNow || []).concat(idx);
  KKUI.pointsPop(idx, 0, false);

  await sleep(RESULT_MS);
  if (!alive(sid)) return;
  tb.current += 1;
  tbAsk();
}

function tbEvaluate() {
  const tb = S.tb;
  const eliminated = tb.eliminatedNow || [];
  tb.eliminatedNow = [];

  if (eliminated.length > 0 && eliminated.length < tb.remaining.length) {
    tb.remaining = tb.remaining.filter(i => !eliminated.includes(i));
  }
  // Alla fel eller alla rätt -> ingen åtgärd, ny fråga

  if (tb.remaining.length === 1) {
    return declareWinner(S.players[tb.remaining[0]]);
  }
  nextTbQuestion();
}

/* ================= PAUS & AVBRYT ================= */
function togglePause(force) {
  if (!S || S.mode === 'over') return;
  const want = (typeof force === 'boolean') ? force : !PAUSED;
  if (want === PAUSED) return;

  PAUSED = want;
  KKUI.setPaused(want);
  const ov = document.getElementById('pauseOverlay');
  ov.classList.toggle('hidden', !want);

  if (want) {
    document.getElementById('quitConfirm').classList.add('hidden');
    document.getElementById('pauseBtns').classList.remove('hidden');
  }
}

function quitToMenu() {
  if (!S) return;
  SESSION++;
  S.session = -1;      // döda alla pågående async-kedjor
  S.mode = 'over';     // behåll S för namn-prefyll i menyn
  S.phase = 'over';
  S.q = null;
  PAUSED = false;

  KKUI.setPaused(false);
  KKUI.stopTimer();
  KKUI.cancelWheel();
  KKUI.hideBanner();
  KKUI.hideQuestion();
  KKUI.hideOverlay();
  document.getElementById('pauseOverlay').classList.add('hidden');
  document.getElementById('quitConfirm').classList.add('hidden');
  document.getElementById('pauseBtns').classList.remove('hidden');
  document.getElementById('pauseBtn').classList.add('hidden');

  document.getElementById('game').classList.add('hidden');
  document.getElementById('setup').classList.remove('hidden');
}

/* ================= TANGENTBORD ================= */
document.addEventListener('keydown', (e) => {
  if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
    togglePause();
    return;
  }
  if (!S || !S.q || PAUSED) return;
  const n = parseInt(e.key, 10);
  if (n >= 1 && n <= 6 && n <= S.q.options.length) {
    answer(n - 1);
  }
});

document.getElementById('options').addEventListener('click', (e) => {
  const btn = e.target.closest('.opt');
  if (!btn) return;
  const i = parseInt(btn.id.replace('opt-', ''), 10);
  if (!isNaN(i)) answer(i);
});

document.getElementById('againBtn').addEventListener('click', () => {
  location.reload();
});

document.getElementById('pauseBtn').addEventListener('click', () => togglePause());
document.getElementById('resumeBtn').addEventListener('click', () => togglePause(false));
document.getElementById('quitBtn').addEventListener('click', () => {
  document.getElementById('pauseBtns').classList.add('hidden');
  document.getElementById('quitConfirm').classList.remove('hidden');
});
document.getElementById('quitNoBtn').addEventListener('click', () => {
  document.getElementById('quitConfirm').classList.add('hidden');
  document.getElementById('pauseBtns').classList.remove('hidden');
});
document.getElementById('quitYesBtn').addEventListener('click', quitToMenu);
document.getElementById('menuBtn').addEventListener('click', quitToMenu);
