const express = require('express');
const path = require('path');
const { getQuestion, resetPool, stats, CATEGORIES, DIFFICULTIES, seedCount } = require('./db');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

app.get('/api/question', (req, res) => {
  const category = req.query.category;
  const difficulty = req.query.difficulty || 'medel';
  if (!category) return res.status(400).json({ error: 'Parametern category krävs' });
  const row = getQuestion(category, difficulty);
  if (!row) return res.status(404).json({ error: 'Inga frågor finns för kombinationen' });
  const options = shuffle([row.correct, row.wrong1, row.wrong2]);
  res.json({
    id: row.id,
    category: row.category,
    difficulty: row.difficulty,
    question: row.question,
    correct: row.correct,
    options
  });
});

app.post('/api/reset-used', (_req, res) => {
  resetPool();
  res.json({ ok: true });
});

app.get('/api/meta', (_req, res) => {
  res.json({
    categories: CATEGORIES,
    difficulties: DIFFICULTIES,
    questionCount: seedCount,
    stats: stats()
  });
});

const server = app.listen(PORT, () => {
  console.log(`Kunskapskampen startad på http://localhost:${PORT} (${seedCount} frågor seedade)`);
});

function shutdown() {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
