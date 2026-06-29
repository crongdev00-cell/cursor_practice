const NAVER_NEWS_URL = 'https://openapi.naver.com/v1/search/news.json';
const { getNaverSetupHint } = require('./env');

function stripHtml(text) {
  return String(text || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function validateNaverBody(body) {
  if (!body || typeof body !== 'object') {
    return { error: '잘못된 JSON 요청입니다.', status: 400 };
  }

  const query = body.query;
  if (!query || typeof query !== 'string' || !query.trim()) {
    return { error: 'query는 필수입니다.', status: 400 };
  }

  if (query.trim().length > 100) {
    return { error: 'query는 100자 이하여야 합니다.', status: 400 };
  }

  const display = Math.min(Math.max(Number(body.display) || 8, 1), 20);
  const sort = body.sort === 'sim' ? 'sim' : 'date';

  return { query: query.trim(), display, sort };
}

async function searchNaverNews(credentials, body) {
  if (!credentials?.clientId || !credentials?.clientSecret) {
    return {
      ok: false,
      status: 503,
      data: { error: `네이버 API 키가 설정되지 않았습니다. ${getNaverSetupHint()}` },
    };
  }

  const validation = validateNaverBody(body);
  if (validation.error) {
    return { ok: false, status: validation.status, data: { error: validation.error } };
  }

  const url = new URL(NAVER_NEWS_URL);
  url.searchParams.set('query', validation.query);
  url.searchParams.set('display', String(validation.display));
  url.searchParams.set('sort', validation.sort);

  try {
    const response = await fetch(url, {
      headers: {
        'X-Naver-Client-Id': credentials.clientId,
        'X-Naver-Client-Secret': credentials.clientSecret,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        data: {
          error: data.errorMessage || data.error || '네이버 검색 API 요청 실패',
        },
      };
    }

    const items = (data.items || []).map((item) => ({
      title: stripHtml(item.title),
      description: stripHtml(item.description),
      link: item.link,
      originallink: item.originallink,
      pubDate: item.pubDate,
    }));

    return {
      ok: true,
      status: 200,
      data: {
        total: data.total,
        display: data.display,
        items,
      },
    };
  } catch {
    return {
      ok: false,
      status: 502,
      data: { error: '네이버 검색 API에 연결할 수 없습니다.' },
    };
  }
}

module.exports = { searchNaverNews, validateNaverBody, stripHtml };
