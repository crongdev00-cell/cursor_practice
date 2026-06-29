const DAPA_BID_API_URL =
  'https://apis.data.go.kr/1690000/BidPblancInfoService/getDmstcCmpetBidPblancList';

const ITEM_FIELDS = [
  'pblancSeCode',
  'pblancSe',
  'demandYear',
  'pblancDate',
  'pblancNo',
  'pblancOdr',
  'g2bPblancNo',
  'g2bPblancOdr',
  'dcsNo',
  'bidNm',
  'orntCode',
  'ornt',
  'prdctnAbltyPresentnClosDt',
  'bidPartcptRegistClosDt',
  'biddocPresentnClosDt',
  'opengDt',
  'excutTyCode',
  'excutTy',
  'cntrctMth',
  'bidStle',
  'bsisPrdprcApplcAt',
  'bsicExpt',
  'bsisPrdprcOthbcAt',
  'busiDivs',
];

const { getDapaSetupHint } = require('./env');

function decodeXmlEntities(text) {
  return String(text || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

function extractTag(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = xml.match(re);
  return match ? decodeXmlEntities(match[1].trim()) : '';
}

function parseItemBlock(block) {
  const item = {};
  for (const field of ITEM_FIELDS) {
    item[field] = extractTag(block, field);
  }
  return item;
}

function parseXmlResponse(xml) {
  const resultCode = extractTag(xml, 'resultCode');
  const resultMsg = extractTag(xml, 'resultMsg');

  if (resultCode && resultCode !== '00') {
    return {
      error: resultMsg || `공공데이터 API 오류 (코드: ${resultCode})`,
      status: 502,
    };
  }

  const items = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRe.exec(xml)) !== null) {
    items.push(parseItemBlock(match[1]));
  }

  return {
    totalCount: extractTag(xml, 'totalCount') || String(items.length),
    pageNo: extractTag(xml, 'pageNo') || '1',
    numOfRows: extractTag(xml, 'numOfRows') || String(items.length),
    items,
  };
}

function formatYmd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function validateBidSearchBody(body) {
  if (!body || typeof body !== 'object') {
    return { error: '잘못된 JSON 요청입니다.', status: 400 };
  }

  const pageNo = Math.min(Math.max(Number(body.pageNo) || 1, 1), 100);
  const numOfRows = Math.min(Math.max(Number(body.numOfRows) || 10, 1), 50);
  const days = Math.min(Math.max(Number(body.days) || 30, 1), 90);
  const bidNm = typeof body.bidNm === 'string' ? body.bidNm.trim().slice(0, 100) : '';

  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);

  const params = {
    pageNo: String(pageNo),
    numOfRows: String(numOfRows),
    anmtDateBegin: formatYmd(start),
    anmtDateEnd: formatYmd(end),
  };

  if (bidNm) params.bidNm = bidNm;

  if (typeof body.orntCode === 'string' && body.orntCode.trim()) {
    params.orntCode = body.orntCode.trim().slice(0, 20);
  }

  return { params, pageNo, numOfRows, days, bidNm };
}

function buildApiUrl(serviceKey, params) {
  const url = new URL(DAPA_BID_API_URL);
  url.searchParams.set('serviceKey', serviceKey);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

async function searchBidAnnouncements(serviceKey, body) {
  const key = typeof serviceKey === 'string' ? serviceKey.trim() : serviceKey;

  if (!key) {
    return {
      ok: false,
      status: 503,
      data: { error: `DAPA_SERVICE_KEY가 설정되지 않았습니다. ${getDapaSetupHint()}` },
    };
  }

  const validation = validateBidSearchBody(body);
  if (validation.error) {
    return { ok: false, status: validation.status, data: { error: validation.error } };
  }

  const url = buildApiUrl(key, validation.params);

  try {
    const response = await fetch(url, { method: 'GET' });
    const text = await response.text();

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        data: { error: '방위사업청 입찰공고 API 요청 실패' },
      };
    }

    const parsed = parseXmlResponse(text);
    if (parsed.error) {
      return { ok: false, status: parsed.status, data: { error: parsed.error } };
    }

    return {
      ok: true,
      status: 200,
      data: {
        totalCount: parsed.totalCount,
        pageNo: parsed.pageNo,
        numOfRows: parsed.numOfRows,
        searchPeriod: {
          begin: validation.params.anmtDateBegin,
          end: validation.params.anmtDateEnd,
        },
        items: parsed.items,
      },
    };
  } catch {
    return {
      ok: false,
      status: 502,
      data: { error: '방위사업청 입찰공고 API에 연결할 수 없습니다.' },
    };
  }
}

module.exports = {
  searchBidAnnouncements,
  validateBidSearchBody,
  parseXmlResponse,
  DAPA_BID_API_URL,
};
