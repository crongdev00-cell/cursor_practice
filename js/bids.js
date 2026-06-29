/**
 * 방위사업청 국내 경쟁입찰공고
 */
const bidState = {
  available: false,
  query: '',
  pageNo: 1,
  days: 30,
};

function formatDapaDate(value) {
  if (!value) return '—';
  const s = String(value).replace(/\D/g, '');
  if (s.length >= 8) {
    return `${s.slice(0, 4)}.${s.slice(4, 6)}.${s.slice(6, 8)}`;
  }
  return value;
}

function formatDapaDateTime(value) {
  if (!value) return '—';
  const s = String(value).replace(/\D/g, '');
  if (s.length >= 12) {
    return `${s.slice(0, 4)}.${s.slice(4, 6)}.${s.slice(6, 8)} ${s.slice(8, 10)}:${s.slice(10, 12)}`;
  }
  if (s.length >= 8) return formatDapaDate(value);
  return value;
}

function parseDapaDateTime(value) {
  const s = String(value || '').replace(/\D/g, '');
  if (s.length < 8) return null;
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(4, 6)) - 1;
  const d = Number(s.slice(6, 8));
  const h = s.length >= 10 ? Number(s.slice(8, 10)) : 0;
  const min = s.length >= 12 ? Number(s.slice(10, 12)) : 0;
  const dt = new Date(y, m, d, h, min);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function isUrgentDeadline(value) {
  const dt = parseDapaDateTime(value);
  if (!dt) return false;
  const diff = dt.getTime() - Date.now();
  return diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000;
}

function setBidLoading(loading) {
  document.getElementById('bidLoading')?.classList.toggle('hidden', !loading);
}

function showBidError(message) {
  const el = document.getElementById('bidError');
  const msg = document.getElementById('bidErrorMsg');
  if (msg) msg.textContent = message;
  el?.classList.remove('hidden');
}

function hideBidError() {
  document.getElementById('bidError')?.classList.add('hidden');
}

function updateBidStatus(configured, live) {
  const tag = document.getElementById('bidStatusTag');
  if (!tag) return;
  if (!configured) {
    tag.textContent = 'OFFLINE';
    tag.classList.remove('live');
    return;
  }
  tag.textContent = live ? 'LIVE' : 'READY';
  tag.classList.add('live');
}

function updateBidMeta(data) {
  const countEl = document.getElementById('bidTotalCount');
  const periodEl = document.getElementById('bidSearchPeriod');
  if (countEl) countEl.textContent = data?.totalCount ?? '0';
  if (periodEl && data?.searchPeriod) {
    const { begin, end } = data.searchPeriod;
    periodEl.textContent = `${formatDapaDate(begin)} ~ ${formatDapaDate(end)}`;
  }
}

function renderBidTable(items) {
  const tbody = document.getElementById('bidTableBody');
  if (!tbody) return;

  if (!items?.length) {
    tbody.innerHTML = `
      <tr><td colspan="8" class="bid-empty">조회된 입찰공고가 없습니다.</td></tr>
    `;
    return;
  }

  tbody.innerHTML = items.map((item) => {
    const urgent = isUrgentDeadline(item.bidPartcptRegistClosDt || item.biddocPresentnClosDt);
    const bidNm = item.bidNm || '제목 없음';
    return `
      <tr class="${urgent ? 'bid-row--urgent' : ''}">
        <td class="bid-title-cell">
          <span class="bid-title">${escapeHtml(bidNm)}</span>
          ${urgent ? '<span class="bid-urgent-badge">마감임박</span>' : ''}
          <span class="bid-no">${escapeHtml(item.g2bPblancNo || item.pblancNo || '')}</span>
        </td>
        <td>${escapeHtml(item.ornt || '—')}</td>
        <td>${formatDapaDate(item.pblancDate)}</td>
        <td>${formatDapaDateTime(item.bidPartcptRegistClosDt)}</td>
        <td>${formatDapaDateTime(item.opengDt)}</td>
        <td>${escapeHtml(item.cntrctMth || '—')}</td>
        <td>${escapeHtml(item.bidStle || '—')}</td>
        <td><span class="tag-field">${escapeHtml(item.busiDivs || '—')}</span></td>
      </tr>
    `;
  }).join('');
}

async function loadBidAnnouncements(options = {}) {
  if (!bidState.available) {
    showBidError('DAPA_SERVICE_KEY 미설정 — .env 또는 Vercel 환경 변수를 확인하세요.');
    return;
  }

  hideBidError();
  setBidLoading(true);

  const pageNo = options.pageNo ?? bidState.pageNo;
  const bidNm = options.bidNm ?? bidState.query;
  const days = options.days ?? bidState.days;

  try {
    const data = await window.DashboardAPI.searchDapaBids({
      pageNo,
      numOfRows: 15,
      days,
      bidNm: bidNm || undefined,
    });

    bidState.pageNo = pageNo;
    bidState.query = bidNm;
    bidState.days = days;

    renderBidTable(data.items || []);
    updateBidMeta(data);
    updateBidStatus(true, true);
  } catch (err) {
    renderBidTable([]);
    showBidError(err.message || '입찰공고 조회 실패');
    updateBidStatus(bidState.available, false);
  } finally {
    setBidLoading(false);
  }
}

function setupBidSearch() {
  document.getElementById('bidSearchForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const query = document.getElementById('bidSearchInput')?.value.trim() || '';
    loadBidAnnouncements({ pageNo: 1, bidNm: query });
  });

  document.getElementById('bidRetryBtn')?.addEventListener('click', () => {
    loadBidAnnouncements();
  });

  document.getElementById('bidRefreshBtn')?.addEventListener('click', () => {
    loadBidAnnouncements();
  });

  document.getElementById('bidDaysSelect')?.addEventListener('change', (e) => {
    bidState.days = Number(e.target.value) || 30;
    loadBidAnnouncements({ pageNo: 1, days: bidState.days });
  });
}

async function initBids() {
  setupBidSearch();

  try {
    const health = await window.DashboardAPI.health();
    const legacyServer = health.dapaConfigured === undefined;

    bidState.available = Boolean(health.dapaConfigured);
    updateBidStatus(bidState.available, false);

    if (legacyServer) {
      showBidError('구버전 서버가 실행 중입니다. 터미널에서 Ctrl+C 후 python server/app.py 를 다시 실행하고 Ctrl+F5로 새로고침하세요.');
      renderBidTable([]);
      return;
    }

    if (bidState.available) {
      await loadBidAnnouncements({ pageNo: 1, days: 30 });
    } else {
      showBidError(health.dapaHint || 'DAPA_SERVICE_KEY 미설정 — 공공데이터포털 서비스키를 .env에 추가하세요.');
      renderBidTable([]);
    }
  } catch (err) {
    showBidError(err.message || 'API 서버 연결 실패');
    updateBidStatus(false, false);
  }
}

window.initBids = initBids;
