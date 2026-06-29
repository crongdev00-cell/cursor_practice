const GEMINI_MODEL = 'gemini-2.5-flash-lite';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

const { getGeminiSetupHint } = require('./env');

function buildAnalysisPrompt(query, globalNews, domesticNews) {
  const formatItems = (items, label) => {
    if (!items?.length) return `${label}: (검색 결과 없음)\n`;
    return `${label}:\n${items
      .slice(0, 8)
      .map((item, i) => {
        const title = item.title || '제목 없음';
        const snippet = (item.snippet || item.description || '').slice(0, 200);
        const source = item.source || item.url || '';
        return `${i + 1}. [${title}] ${snippet} (출처: ${source})`;
      })
      .join('\n')}\n`;
  };

  return `당신은 방위산업(방산) 전문 애널리스트입니다.
아래 국외(Tavily) 및 국내(네이버) 뉴스 검색 결과를 분석하여 한국어로 보고서를 작성하세요.

검색 키워드: "${query}"

${formatItems(globalNews, '국외 뉴스')}
${formatItems(domesticNews, '국내 뉴스')}

다음 형식의 마크다운으로 작성하세요:

## 종합 요약
(3~4문장으로 핵심 동향 요약)

## 국외 동향
(글로벌 방산 시장·정책·계약 관련 인사이트, bullet 3~5개)

## 국내 동향
(한국 방산·수출·국방 정책 관련 인사이트, bullet 3~5개)

## 핵심 키워드
(쉼표로 구분된 5~8개 키워드)

## 시사점 및 전망
(전략적 시사점 2~3문장)

주의: 검색 결과에 없는 내용은 추측하지 말고, 제공된 기사 기반으로만 분석하세요.`;
}

function validateAnalyzeBody(body) {
  if (!body || typeof body !== 'object') {
    return { error: '잘못된 JSON 요청입니다.', status: 400 };
  }

  const query = typeof body.query === 'string' ? body.query.trim() : '';
  const globalNews = Array.isArray(body.globalNews) ? body.globalNews.slice(0, 10) : [];
  const domesticNews = Array.isArray(body.domesticNews) ? body.domesticNews.slice(0, 10) : [];

  if (!query && !globalNews.length && !domesticNews.length) {
    return { error: '분석할 뉴스 데이터가 없습니다.', status: 400 };
  }

  return { query: query || '방산', globalNews, domesticNews };
}

async function analyzeNews(apiKey, body) {
  if (!apiKey) {
    return {
      ok: false,
      status: 503,
      data: { error: `GEMINI_API_KEY가 설정되지 않았습니다. ${getGeminiSetupHint()}` },
    };
  }

  const validation = validateAnalyzeBody(body);
  if (validation.error) {
    return { ok: false, status: validation.status, data: { error: validation.error } };
  }

  const prompt = buildAnalysisPrompt(
    validation.query,
    validation.globalNews,
    validation.domesticNews,
  );

  const url = `${GEMINI_API_BASE}/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 2048,
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const message =
        data?.error?.message || data?.error?.status || 'Gemini API 요청 실패';
      return { ok: false, status: response.status, data: { error: message } };
    }

    const text =
      data?.candidates?.[0]?.content?.parts
        ?.map((p) => p.text)
        .join('') || '';

    if (!text.trim()) {
      return {
        ok: false,
        status: 502,
        data: { error: 'Gemini가 분석 결과를 생성하지 못했습니다.' },
      };
    }

    return {
      ok: true,
      status: 200,
      data: {
        analysis: text.trim(),
        model: GEMINI_MODEL,
        query: validation.query,
        articleCount: {
          global: validation.globalNews.length,
          domestic: validation.domesticNews.length,
        },
      },
    };
  } catch {
    return {
      ok: false,
      status: 502,
      data: { error: 'Gemini API에 연결할 수 없습니다.' },
    };
  }
}

module.exports = { analyzeNews, validateAnalyzeBody, GEMINI_MODEL };
