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
  getNaverCredentials,
  getNaverSetupHint,
  isVercelRuntime,
  getKeySetupHint,
};
