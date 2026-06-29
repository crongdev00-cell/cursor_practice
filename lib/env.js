const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_MODEL_PATTERN = /^gemini-[a-z0-9.-]+$/i;

function getGeminiApiKey() {
  const key = String(process.env.GEMINI_API_KEY || '').trim();
  if (!key) return null;
  const lowered = key.toLowerCase();
  if (lowered === 'your-gemini-api-key' || lowered.startsWith('your-')) return null;
  return key;
}

function getGeminiSetupHint() {
  const raw = String(process.env.GEMINI_API_KEY || '').trim();
  if (!raw) {
    if (isVercelRuntime()) {
      return (
        'Vercel Dashboard → Environment Variables에서 ' +
        'GEMINI_API_KEY를 Production 포함해 등록 후 Redeploy 하세요.'
      );
    }
    return '.env 파일에 GEMINI_API_KEY=발급받은키 를 추가하세요.';
  }
  const lowered = raw.toLowerCase();
  if (lowered === 'your-gemini-api-key' || lowered.startsWith('your-')) {
    return 'GEMINI_API_KEY가 예시 값입니다. Google AI Studio에서 발급한 실제 키로 교체하세요.';
  }
  if (isVercelRuntime()) {
    return 'Vercel에서 Redeploy 후 다시 시도하세요.';
  }
  return '서버를 재시작하고 페이지를 Ctrl+F5로 새로고침하세요.';
}

function getGeminiModel() {
  const raw = String(process.env.GEMINI_MODEL || '').trim();
  if (!raw || !GEMINI_MODEL_PATTERN.test(raw)) {
    return DEFAULT_GEMINI_MODEL;
  }
  return raw;
}

function getDapaServiceKey() {
  const key = String(process.env.DAPA_SERVICE_KEY || '').trim();
  if (!key) return null;
  const lowered = key.toLowerCase();
  if (lowered === 'your-dapa-service-key' || lowered.startsWith('your-')) return null;
  return key;
}

function getDapaSetupHint() {
  const raw = String(process.env.DAPA_SERVICE_KEY || '').trim();
  if (!raw) {
    if (isVercelRuntime()) {
      return (
        'Vercel Dashboard → Environment Variables에서 ' +
        'DAPA_SERVICE_KEY를 Production 포함해 등록 후 Redeploy 하세요.'
      );
    }
    return '.env 파일에 DAPA_SERVICE_KEY=공공데이터포털_서비스키 를 추가하세요.';
  }
  const lowered = raw.toLowerCase();
  if (lowered === 'your-dapa-service-key' || lowered.startsWith('your-')) {
    return 'DAPA_SERVICE_KEY가 예시 값입니다. 공공데이터포털에서 발급한 실제 키로 교체하세요.';
  }
  if (isVercelRuntime()) {
    return 'Vercel에서 Redeploy 후 다시 시도하세요.';
  }
  return '서버를 재시작하고 페이지를 Ctrl+F5로 새로고침하세요.';
}

function getNaverCredentials() {
  const clientId = String(process.env.NAVER_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.NAVER_CLIENT_SECRET || '').trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

function getNaverSetupHint() {
  if (isVercelRuntime()) {
    return (
      'Vercel Dashboard → Environment Variables에서 ' +
      'NAVER_CLIENT_ID, NAVER_CLIENT_SECRET을 Production 포함해 등록 후 Redeploy 하세요.'
    );
  }
  return '.env 파일에 NAVER_CLIENT_ID, NAVER_CLIENT_SECRET을 설정하세요.';
}

function getTavilyApiKey() {
  const key = String(process.env.TAVILY_API_KEY || '').trim();
  return key.length > 0 ? key : null;
}

function isVercelRuntime() {
  return Boolean(process.env.VERCEL);
}

function getKeySetupHint() {
  if (isVercelRuntime()) {
    return (
      'Vercel Dashboard → Project → Settings → Environment Variables에서 ' +
      'TAVILY_API_KEY를 Production·Preview·Development 모두 체크한 뒤 Redeploy 하세요.'
    );
  }
  return '.env 파일에 TAVILY_API_KEY를 설정하세요.';
}

module.exports = {
  getTavilyApiKey,
  getGeminiApiKey,
  getGeminiModel,
  getGeminiSetupHint,
  getDapaServiceKey,
  getDapaSetupHint,
  DEFAULT_GEMINI_MODEL,
  getNaverCredentials,
  getNaverSetupHint,
  isVercelRuntime,
  getKeySetupHint,
};
