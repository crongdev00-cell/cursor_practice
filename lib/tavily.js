const TAVILY_SEARCH_URL = 'https://api.tavily.com/search';

function validateSearchBody(body) {
  if (!body || typeof body !== 'object') {
    return { error: '잘못된 JSON 요청입니다.', status: 400 };
  }

  const { query, max_results, search_depth, topic, include_domains, exclude_domains } = body;

  if (!query || typeof query !== 'string' || !query.trim()) {
    return { error: 'query는 필수입니다.', status: 400 };
  }

  if (query.length > 500) {
    return { error: 'query는 500자 이하여야 합니다.', status: 400 };
  }

  const payload = {
    query: query.trim(),
    max_results: Math.min(Math.max(Number(max_results) || 5, 1), 20),
  };

  if (search_depth) payload.search_depth = search_depth;
  if (topic) payload.topic = topic;
  if (Array.isArray(include_domains)) payload.include_domains = include_domains.slice(0, 10);
  if (Array.isArray(exclude_domains)) payload.exclude_domains = exclude_domains.slice(0, 10);

  return { payload };
}

async function searchTavily(apiKey, body) {
  if (!apiKey) {
    return {
      ok: false,
      status: 503,
      data: { error: 'TAVILY_API_KEY가 설정되지 않았습니다. .env 파일을 확인하세요.' },
    };
  }

  const validation = validateSearchBody(body);
  if (validation.error) {
    return { ok: false, status: validation.status, data: { error: validation.error } };
  }

  try {
    const response = await fetch(TAVILY_SEARCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(validation.payload),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        data: {
          error: data?.detail?.error || data?.error || 'Tavily API 요청 실패',
        },
      };
    }

    return { ok: true, status: 200, data };
  } catch {
    return {
      ok: false,
      status: 502,
      data: { error: 'Tavily API에 연결할 수 없습니다.' },
    };
  }
}

module.exports = { searchTavily, validateSearchBody, TAVILY_SEARCH_URL };
