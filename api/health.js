const { getTavilyApiKey, getNaverCredentials } = require('../../lib/env');

module.exports = (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const tavilyKey = getTavilyApiKey();
  const naver = getNaverCredentials();

  return res.status(200).json({
    status: 'ok',
    tavilyConfigured: Boolean(tavilyKey),
    naverConfigured: Boolean(naver),
    runtime: 'vercel',
    vercelEnv: process.env.VERCEL_ENV || null,
  });
};
