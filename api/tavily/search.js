const { searchTavily } = require('../../lib/tavily');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.TAVILY_API_KEY;

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }

  const result = await searchTavily(apiKey, body);

  return res.status(result.status).json(result.data);
};
