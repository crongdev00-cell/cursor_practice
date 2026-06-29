module.exports = (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  return res.status(200).json({
    status: 'ok',
    tavilyConfigured: Boolean(process.env.TAVILY_API_KEY),
    runtime: 'vercel',
  });
};
