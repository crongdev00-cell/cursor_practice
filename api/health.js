const { getTavilyApiKey, getNaverCredentials, getGeminiApiKey, getGeminiSetupHint, getGeminiModel, getDapaServiceKey, getDapaSetupHint } = require('../lib/env');

module.exports = (req, res) => {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const geminiKey = getGeminiApiKey();

    return res.status(200).json({
      status: 'ok',
      serverVersion: 3,
      tavilyConfigured: Boolean(getTavilyApiKey()),
      naverConfigured: Boolean(getNaverCredentials()),
      geminiConfigured: Boolean(geminiKey),
      geminiHint: geminiKey ? null : getGeminiSetupHint(),
      geminiModel: getGeminiModel(),
      dapaConfigured: Boolean(getDapaServiceKey()),
      dapaHint: getDapaServiceKey() ? null : getDapaSetupHint(),
      runtime: 'vercel',
      vercelEnv: process.env.VERCEL_ENV || null,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Health check failed' });
  }
};
