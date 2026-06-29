const path = require('path');
const express = require('express');
const dotenv = require('dotenv');
const { searchTavily } = require('../lib/tavily');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = path.join(__dirname, '..');
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

app.use(express.json({ limit: '32kb' }));

app.use((req, res, next) => {
  const blocked = ['.env', '/server/', '/node_modules/', '/lib/'];
  if (blocked.some((p) => req.path.includes(p))) {
    return res.status(404).end();
  }
  next();
});

app.post('/api/tavily/search', async (req, res) => {
  const result = await searchTavily(TAVILY_API_KEY, req.body);
  res.status(result.status).json(result.data);
});

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    tavilyConfigured: Boolean(TAVILY_API_KEY),
    runtime: 'node',
  });
});

app.use(express.static(ROOT, { dotfiles: 'deny' }));

app.use((_req, res) => {
  res.status(404).sendFile(path.join(ROOT, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Node server running at http://localhost:${PORT}`);
  if (!TAVILY_API_KEY) {
    console.warn('⚠  TAVILY_API_KEY 미설정 — .env.example 을 참고하여 .env 파일을 만드세요.');
  }
});
