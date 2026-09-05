/* Kunskapskampen – spelmotor */
const CATEGORIES = ['Natur', 'Teknik', 'Ljud', 'Musik', 'Bilar', 'Geografi',
  'Musik från förr', 'Barnprogram', 'Dans', 'Brädspel', 'Elit'];

const DIFF_LABELS = {
  latt: 'Lätt (6–10 år)',
  medel: 'Medel (10–16 år)',
  svar: 'Svår (16–50 år)',
  elit: 'Elit (genier)'
};

const TARGET_SCORE = 20;
const BANNER_MS = 2600;
const RESULT_MS = 1900;

let S = null; // speltilstånd

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
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
  const startBtn = document.getElementById('startBtn');
  let count = 0;
  let diff = 'medel';

  for (let n = 2; n <= 5; n++) {
    const b = document.createElement('button');
    b.className = 'count-btn';
    b.textContent = n;
    b.onclick = () => { count = n; render(); };
    countWrap.appendChild(b);
  }

  for (const [key, label] of Object.entries(DIFF_LABELS)) {
    const b = document.createElement('button');
    b.className = 'diff-btn';
    b.innerHTML = label.replace(/(.*?) \((.*?)\)/, '$1<small>$2</small>');
    b.dataset.diff = key;
    b.onclick = () => { diff = key; render(); };
    diffWrap.appendChild(b);
  }

  function render() {
    [...countWrap.children].forEach((el, i) => el.classList.toggle('sel', i + 2 === count));
    [...diffWrap.children].forEach(el => el.classList.toggle('sel', el.dataset.diff === diff));
    nameWrap.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const input = document.createElement('input');
      input.type = 'text';
      input.maxLength = 14;
      input.placeholder = 'Spelare ' + (i + 1);
      input.value = (S && S.players && S.players[i] && S.players[i]._name) || '';
      input.oninput = () => { input.dataset.dirty = '1'; validate(); };
      nameWrap.appendChild(input);
    }
    validate();
  }

  function validate() {
    const inputs = [...nameWrap.querySelectorAll('input')];
    const allNamed = count > 0 && inputs.every(i => i.value.trim().length > 0);
    startBtn.disabled = !allNamed;
  }

  startBtn.onclick = () => {
    KKAudio.unlock();
    const names = [...nameWrap.querySelectorAll('input')].map(i => i.value.trim());
    startGame(names, diff);
  };

  render();
})();

/* ================= SPELSTART ================= */
async function startGame(names, difficulty) {
  document.getElementById('setup').classList.add('hidden');
  document.getElementById('game').classList.remove('hidden');
  await fetch('/api/reset-used', { method: 'POST' }).catch(() => {});

  S = {
    players: names.map(n => ({ name: n, score: 0 })),
    difficulty,
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

  KKUI.buildPanels(S.players);
  KKUI.updateScores(S.players);
  KKUI.hideOverlay();
  nextTurn();
}

/* ================= TURLOGIK ================= */
async function nextTurn() {
  if (!S || S.mode === 'over') return;
  KKUI.hideQuestion();
  KKUI.setRoundInfo(S.round, DIFF_LABELS[S.difficulty]);
  KKUI.setActivePanel(S.current);
  KKUI.updateScores(S.players);
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
    KKUI.hideBanner();
    KKUI.showQuestion(S.q, player.name, true);
  } else {
    const cat = rand(CATEGORIES);
    KKUI.showBanner(cat, false, player.name);
    KKAudio.tick();
    await sleep(BANNER_MS);
    KKUI.hideBanner();
    try {
      S.q = await fetchQuestion(cat, S.difficulty);
    } catch (e) {
      await sleep(400);
      return nextTurn();
    }
    S.steal = false;
    KKUI.showQuestion(S.q, player.name, false);
  }
  S.phase = 'question';
}

/* ================= SVARSHANTERING ================= */
async function answer(optionIndex) {
  if (!S || S.phase !== 'question' || !S.q) return;
  S.phase = 'result';

  if (S.mode === 'tiebreak') return tbAnswer(optionIndex);

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
    KKUI.updateScores(S.players);
    KKUI.bumpScore(panelIdx);
  } else {
    KKAudio.wrong();
    KKUI.pointsPop(panelIdx, 0, false);
    q.failedBy = [...(q.failedBy || []), panelIdx];
    S.handedQuestion = q; // frågan går vidare till nästa spelare
  }

  await sleep(RESULT_MS);
  KKUI.hideQuestion();
  advance();
}

/* Gå vidare till nästa spelare / avsluta varv */
function advance() {
  if (S.players.some(p => p.score >= TARGET_SCORE)) S.finishRound = true;

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
  const leaders = S.players.filter(p => p.score >= TARGET_SCORE);
  if (leaders.length === 0) { S.finishRound = false; return nextTurn(); }
  if (leaders.length === 1) return declareWinner(leaders[0]);
  startTiebreak(leaders);
}

function declareWinner(player) {
  S.mode = 'over';
  S.phase = 'over';
  KKUI.hideQuestion();
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
  tb.current = 0;
  tb.asked += 1;
  KKUI.hideQuestion();

  const cat = rand(CATEGORIES);
  KKUI.showBanner(cat, false, 'Utslagsfråga ' + tb.asked, 'Utslagsfråga på Elit-nivå', 'avgör vinnaren mellan de bäst placerade!');
  KKAudio.tick();
  await sleep(BANNER_MS);
  KKUI.hideBanner();

  try {
    S.q = await fetchQuestion(cat, 'elit');
  } catch (e) {
    return nextTbQuestion();
  }
  tbAsk();
}

function tbAsk() {
  const tb = S.tb;
  if (tb.current >= tb.remaining.length) return tbEvaluate();
  const idx = tb.remaining[tb.current];
  KKUI.setActivePanel(idx);
  KKUI.showQuestion(S.q, S.players[idx].name + ' – de andra: titta bort!', false);
  S.phase = 'question';
}

async function tbAnswer(optionIndex) {
  const tb = S.tb;
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

/* ================= TANGENTBORD ================= */
document.addEventListener('keydown', (e) => {
  if (!S) return;
  if (['1', '2', '3'].includes(e.key)) {
    answer(parseInt(e.key, 10) - 1);
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
