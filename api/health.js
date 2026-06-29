const { getTavilyApiKey } = require('../../lib/env');

module.exports = (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const key = getTavilyApiKey();

  return res.status(200).json({
    status: 'ok',
    tavilyConfigured: Boolean(key),
    keyLength: key ? key.length : 0,
    runtime: 'vercel',
    vercelEnv: process.env.VERCEL_ENV || null,
  });
};
