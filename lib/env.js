/**
 * Tavily API 키 로드 (Vercel 환경 변수 / 로컬 .env)
 */
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

module.exports = { getTavilyApiKey, isVercelRuntime, getKeySetupHint };
