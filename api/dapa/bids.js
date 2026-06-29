const { searchBidAnnouncements } = require('../../lib/dapa');
const { getDapaServiceKey } = require('../../lib/env');

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

  try {
    const result = await searchBidAnnouncements(getDapaServiceKey(), body);
    return res.status(result.status).json(result.data);
  } catch (err) {
    return res.status(500).json({ error: err.message || '입찰공고 조회 실패' });
  }
};
