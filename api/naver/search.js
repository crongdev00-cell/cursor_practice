const { searchNaverNews } = require('../../lib/naver');
const { getNaverCredentials } = require('../../lib/env');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }

  const result = await searchNaverNews(getNaverCredentials(), body);
  return res.status(result.status).json(result.data);
};
