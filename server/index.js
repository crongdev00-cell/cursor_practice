const path = require('path');
const express = require('express');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = path.join(__dirname, '..');
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const TAVILY_SEARCH_URL = 'https://api.tavily.com/search';

app.use(express.json({ limit: '32kb' }));

app.use((req, res, next) => {
  const blocked = ['.env', '/server/', '/node_modules/'];
  if (blocked.some((p) => req.path.includes(p))) {
    return res.status(404).end();
  }
  next();
});

app.post('/api/tavily/search', async (req, res) => {
  if (!TAVILY_API_KEY) {
    return res.status(503).json({
      error: 'TAVILY_API_KEY가 설정되지 않았습니다. .env 파일을 확인하세요.',
    });
  }

  const { query, max_results, search_depth, topic, include_domains, exclude_domains } = req.body || {};

  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return res.status(400).json({ error: 'query는 필수입니다.' });
  }

  if (query.length > 500) {
    return res.status(400).json({ error: 'query는 500자 이하여야 합니다.' });
  }

  const payload = {
    query: query.trim(),
    max_results: Math.min(Math.max(Number(max_results) || 5, 1), 20),
  };

  if (search_depth) payload.search_depth = search_depth;
  if (topic) payload.topic = topic;
  if (Array.isArray(include_domains)) payload.include_domains = include_domains.slice(0, 10);
  if (Array.isArray(exclude_domains)) payload.exclude_domains = exclude_domains.slice(0, 10);

  try {
    const response = await fetch(TAVILY_SEARCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${TAVILY_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.detail?.error || data?.error || 'Tavily API 요청 실패',
      });
    }

    res.json(data);
  } catch {
    res.status(502).json({ error: 'Tavily API에 연결할 수 없습니다.' });
  }
});

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    tavilyConfigured: Boolean(TAVILY_API_KEY),
  });
});

app.use(express.static(ROOT, { dotfiles: 'deny' }));

app.use((_req, res) => {
  res.status(404).sendFile(path.join(ROOT, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  if (!TAVILY_API_KEY) {
    console.warn('⚠  TAVILY_API_KEY 미설정 — .env.example 을 참고하여 .env 파일을 만드세요.');
  }
});
