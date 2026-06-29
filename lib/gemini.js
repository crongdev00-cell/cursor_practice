const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

const { getGeminiSetupHint, getGeminiModel } = require('./env');
const { buildAnalysisPrompt } = require('./prompt');
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

  let prompt;
  try {
    prompt = buildAnalysisPrompt(
      validation.query,
      validation.globalNews,
      validation.domesticNews,
    );
  } catch (err) {
    return {
      ok: false,
      status: 500,
      data: { error: err.message || '프롬프트 파일을 읽을 수 없습니다.' },
    };
  }

  const model = getGeminiModel();
  const url = `${GEMINI_API_BASE}/models/${model}:generateContent?key=${apiKey}`;
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
        model,        query: validation.query,
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

module.exports = { analyzeNews, validateAnalyzeBody };