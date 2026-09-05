const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const CATEGORIES = [
  'Natur', 'Teknik', 'Ljud', 'Musik', 'Bilar', 'Geografi',
  'Musik från förr', 'Barnprogram', 'Dans', 'Brädspel', 'Elit'
];

const DIFFICULTIES = ['latt', 'medel', 'svar', 'elit'];

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'kunskapskampen.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    question TEXT NOT NULL,
    correct TEXT NOT NULL,
    wrong1 TEXT NOT NULL,
    wrong2 TEXT NOT NULL,
    used INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_cat_diff_used ON questions(category, difficulty, used);
`);

function loadSeedFiles() {
  const dir = path.join(__dirname, 'seed', 'fragor');
  const rows = [];
  for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort()) {
    const [slug, diff] = file.replace('.json', '').split('.');
    if (!DIFFICULTIES.includes(diff)) continue;
    const category = CATEGORIES.find(c => slugify(c) === slug);
    if (!category) continue;
    const items = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    for (const it of items) {
      if (!it.q || !it.a || !it.w1 || !it.w2) continue;
      rows.push({ category, difficulty: diff, q: it.q, a: it.a, w1: it.w1, w2: it.w2 });
    }
  }
  return rows;
}

function slugify(s) {
  return s.toLowerCase()
    .replace(/å/g, 'a').replace(/ä/g, 'a').replace(/ö/g, 'o')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function seedIfNeeded() {
  const rows = loadSeedFiles();
  const count = db.prepare('SELECT COUNT(*) AS c FROM questions').get().c;
  if (count === rows.length) return rows.length;
  db.exec('DELETE FROM questions');
  const ins = db.prepare(`INSERT INTO questions (category, difficulty, question, correct, wrong1, wrong2)
    VALUES (@category, @difficulty, @q, @a, @w1, @w2)`);
  db.transaction(() => {
    for (const r of rows) ins.run(r);
  })();
  return rows.length;
}

function getQuestion(category, difficulty) {
  if (!CATEGORIES.includes(category)) return null;
  if (!DIFFICULTIES.includes(difficulty)) return null;
  // Elit-kategorin innehåller alltid elitfrågor, oberoende av global svårighetsgrad
  if (category === 'Elit') difficulty = 'elit';

  let row = pick(category, difficulty);
  if (!row) {
    resetPool(category, difficulty);
    row = pick(category, difficulty);
  }
  if (row) db.prepare('UPDATE questions SET used = 1 WHERE id = ?').run(row.id);
  return row;
}

function pick(category, difficulty) {
  return db.prepare(`
    SELECT * FROM questions
    WHERE category = ? AND difficulty = ? AND used = 0
    ORDER BY RANDOM() LIMIT 1
  `).get(category, difficulty);
}

function resetPool(category, difficulty) {
  if (category && difficulty) {
    db.prepare('UPDATE questions SET used = 0 WHERE category = ? AND difficulty = ?').run(category, difficulty);
  } else {
    db.prepare('UPDATE questions SET used = 0').run();
  }
}

function stats() {
  return db.prepare(`
    SELECT category, difficulty, COUNT(*) AS total, SUM(used = 0) AS remaining
    FROM questions GROUP BY category, difficulty ORDER BY category, difficulty
  `).all();
}

const seedCount = seedIfNeeded();

module.exports = { db, getQuestion, resetPool, stats, seedIfNeeded, CATEGORIES, DIFFICULTIES, seedCount };
