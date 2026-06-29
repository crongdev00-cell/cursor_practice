const path = require('path');
const express = require('express');
const dotenv = require('dotenv');
const { searchTavily } = require('../lib/tavily');
const { searchNaverNews } = require('../lib/naver');
const { analyzeNews } = require('../lib/gemini');
const { getTavilyApiKey, getNaverCredentials, getGeminiApiKey, getGeminiSetupHint } = require('../lib/env');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = path.join(__dirname, '..');

app.use(express.json({ limit: '32kb' }));

app.use('/api', (_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

app.options('/api/*', (_req, res) => {
  res.sendStatus(204);
});

app.use((req, res, next) => {
  const blocked = ['.env', '/server/', '/node_modules/', '/lib/'];
  if (blocked.some((p) => req.path.includes(p))) {
    return res.status(404).end();
  }
  next();
});

app.post('/api/tavily/search', async (req, res) => {
  const result = await searchTavily(getTavilyApiKey(), req.body);
  res.status(result.status).json(result.data);
});

app.post('/api/naver/search', async (req, res) => {
  const result = await searchNaverNews(getNaverCredentials(), req.body);
  res.status(result.status).json(result.data);
});

app.post('/api/gemini/analyze', async (req, res) => {
  const result = await analyzeNews(getGeminiApiKey(), req.body);
  res.status(result.status).json(result.data);
});

app.get('/api/health', (_req, res) => {
  const geminiKey = getGeminiApiKey();
  res.json({
    status: 'ok',
    tavilyConfigured: Boolean(getTavilyApiKey()),
    naverConfigured: Boolean(getNaverCredentials()),
    geminiConfigured: Boolean(geminiKey),
    geminiHint: geminiKey ? null : getGeminiSetupHint(),
    runtime: 'node',
  });
});

app.use(express.static(ROOT, { dotfiles: 'deny' }));

app.use((_req, res) => {
  res.status(404).sendFile(path.join(ROOT, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Node server running at http://localhost:${PORT}`);
});
