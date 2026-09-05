/* Kunskapskampen – ljud via Web Audio API (inga ljudfiler behövs) */
const KKAudio = (() => {
  let ctx = null;

  function ac() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone({ freq, type = 'sine', start = 0, dur = 0.25, vol = 0.22, slide = null }) {
    const c = ac();
    if (!c) return;
    const t = c.currentTime + start;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + dur + 0.05);
  }

  /* Treklangers arpeggio – korrekt svar */
  function correct() {
    tone({ freq: 523.25, type: 'triangle', dur: 0.18 });
    tone({ freq: 659.25, type: 'triangle', start: 0.11, dur: 0.18 });
    tone({ freq: 783.99, type: 'triangle', start: 0.22, dur: 0.34 });
  }

  /* Hård buzzer – felaktigt svar */
  function wrong() {
    tone({ freq: 160, type: 'sawtooth', dur: 0.65, vol: 0.3, slide: 95 });
    tone({ freq: 82, type: 'square', dur: 0.65, vol: 0.18, slide: 60 });
  }

  /* Valfanfar – vinnare */
  function fanfare() {
    const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5];
    notes.forEach((f, i) => tone({ freq: f, type: 'triangle', start: i * 0.16, dur: 0.3, vol: 0.24 }));
    tone({ freq: 1318.5, type: 'triangle', start: notes.length * 0.16, dur: 0.7, vol: 0.26 });
  }

  /* Kort tick vid kategoriurval */
  function tick() {
    tone({ freq: 880, type: 'sine', dur: 0.08, vol: 0.12 });
  }

  /* Pendelklocks-tick/tock – omväxlande träaktiga klick */
  function pendulumTick(hi) {
    tone({ freq: hi ? 1150 : 830, type: 'square', dur: 0.028, vol: 0.085 });
    tone({ freq: hi ? 1750 : 1270, type: 'sine', dur: 0.045, vol: 0.05 });
  }

  /* Oroligt tick för de sista sekunderna */
  function urgentTick(hi) {
    tone({ freq: hi ? 1560 : 1180, type: 'square', dur: 0.04, vol: 0.13 });
  }

  return { correct, wrong, fanfare, tick, pendulumTick, urgentTick, unlock: ac };
})();
