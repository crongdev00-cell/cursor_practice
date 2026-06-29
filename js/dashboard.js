/* Defense Trends Dashboard */

const CHART_COLORS = {
  primary: '#3d8bfd',
  secondary: '#4a6741',
  tertiary: '#6ba3ff',
  quaternary: '#f39c12',
  quinary: '#bb86fc',
  senary: '#2ecc71',
  palette: ['#3d8bfd', '#4a6741', '#f39c12', '#bb86fc', '#2ecc71', '#e74c3c', '#1abc9c', '#e67e22'],
};

const chartDefaults = {
  color: '#8b9cb3',
  borderColor: '#1e2a3a',
  font: { family: "'Noto Sans KR', sans-serif", size: 11 },
};

Chart.defaults.color = chartDefaults.color;
Chart.defaults.borderColor = chartDefaults.borderColor;
Chart.defaults.font = chartDefaults.font;

let charts = {};

const companies = [
  { rank: 1, name: 'Lockheed Martin', country: '🇺🇸 미국', revenue: '$71.0B', change: '+8.2%', field: '항공·미사일', up: true },
  { rank: 2, name: 'RTX (Raytheon)', country: '🇺🇸 미국', revenue: '$68.9B', change: '+6.5%', field: '미사일·전자', up: true },
  { rank: 3, name: 'Northrop Grumman', country: '🇺🇸 미국', revenue: '$39.3B', change: '+5.1%', field: '항공·우주', up: true },
  { rank: 4, name: 'Boeing Defense', country: '🇺🇸 미국', revenue: '$24.9B', change: '-2.3%', field: '항공·헬기', up: false },
  { rank: 5, name: 'General Dynamics', country: '🇺🇸 미국', revenue: '$42.3B', change: '+7.8%', field: '함정·지상', up: true },
  { rank: 6, name: 'BAE Systems', country: '🇬🇧 영국', revenue: '$28.7B', change: '+9.4%', field: '종합', up: true },
  { rank: 7, name: 'Hanwha Aerospace', country: '🇰🇷 한국', revenue: '$12.1B', change: '+31.2%', field: '화력·항공', up: true },
  { rank: 8, name: 'LIG Nex1', country: '🇰🇷 한국', revenue: '$2.8B', change: '+18.6%', field: '미사일·전자', up: true },
  { rank: 9, name: 'Airbus Defence', country: '🇪🇺 유럽', revenue: '$12.9B', change: '+4.7%', field: '항공·위성', up: true },
  { rank: 10, name: 'Leonardo', country: '🇮🇹 이탈리아', revenue: '$15.2B', change: '+11.3%', field: '헬기·전자', up: true },
];

const DEFAULT_TAVILY_QUERY = 'defense industry news latest';
const DEFAULT_NAVER_QUERY = '방산';

const newsState = {
  tavilyAvailable: false,
  naverAvailable: false,
  geminiAvailable: false,
  geminiHint: '',
  geminiLegacyServer: false,
  tavilyQuery: DEFAULT_TAVILY_QUERY,
  naverQuery: DEFAULT_NAVER_QUERY,
  tavilyResults: [],
  naverResults: [],
};

function getDashboardAPI() {
  if (!window.DashboardAPI) {
    throw new Error('js/api.js 를 불러오지 못했습니다. Ctrl+F5 로 새로고침하세요.');
  }
  return window.DashboardAPI;
}

const techTrends = [
  { icon: '🛸', name: '무인체계', growth: '+18.7%', desc: '드론·UUV·UGV' },
  { icon: '🤖', name: 'AI·자율화', growth: '+24.3%', desc: 'C2·타겟팅·군사 AI' },
  { icon: '🚀', name: '하이퍼소닉', growth: '+31.5%', desc: '극초음속 미사일·방어' },
  { icon: '🛰️', name: '우주·위성', growth: '+15.2%', desc: 'ISR·통신·GPS' },
  { icon: '🔒', name: '사이버방어', growth: '+12.8%', desc: 'OT·IT 통합 보안' },
  { icon: '⚡', name: '전자전', growth: '+10.4%', desc: 'EW·SIGINT·ECM' },
];

function setCurrentDate() {
  const el = document.getElementById('currentDate');
  const now = new Date();
  el.textContent = now.toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

function renderCompanyTable() {
  const tbody = document.getElementById('companyTable');
  tbody.innerHTML = companies.map(c => `
    <tr>
      <td><span class="rank">${c.rank}</span></td>
      <td><span class="company-name">${c.name}</span></td>
      <td>${c.country}</td>
      <td style="font-family:var(--mono)">${c.revenue}</td>
      <td><span class="${c.up ? 'change-up' : 'change-down'}">${c.change}</span></td>
      <td><span class="tag-field">${c.field}</span></td>
    </tr>
  `).join('');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function sanitizeUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.href;
    }
  } catch { /* ignore */ }
  return '#';
}
function extractSource(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'Web';
  }
}

function inferCategory(title, content) {
  const text = `${title} ${content}`.toLowerCase();
  if (/수출|export|deal|sale/.test(text)) return { category: 'export', catLabel: '수출' };
  if (/계약|contract|award|order|procurement/.test(text)) return { category: 'contract', catLabel: '계약' };
  if (/nato|eu |policy|budget|국방|정책|spending/.test(text)) return { category: 'policy', catLabel: '정책' };
  if (/ai|drone|uav|무인|tech|hypersonic|미사일|기술/.test(text)) return { category: 'tech', catLabel: '기술' };
  return { category: 'search', catLabel: '뉴스' };
}

function mapTavilyResults(results) {
  return results.map((r) => {
    const { category, catLabel } = inferCategory(r.title || '', r.content || '');
    return {
      category,
      catLabel,
      title: r.title || '제목 없음',
      snippet: r.content || '',
      source: extractSource(r.url),
      url: r.url,
    };
  });
}

function mapNaverResults(items) {
  return items.map((item) => {
    const { category, catLabel } = inferCategory(item.title || '', item.description || '');
    const url = item.originallink || item.link || '#';
    let source = 'Naver';
    try {
      source = new URL(url).hostname.replace(/^www\./, '');
    } catch { /* ignore */ }

    return {
      category,
      catLabel,
      title: item.title || '제목 없음',
      snippet: item.description || '',
      source,
      date: item.pubDate ? formatPubDate(item.pubDate) : '',
      url,
    };
  });
}

function formatPubDate(dateStr) {
  try {
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function renderNewsList(listId, items, emptyMsg = '검색 결과가 없습니다.') {
  const list = document.getElementById(listId);
  if (!items.length) {
    list.innerHTML = `<li class="news-state">${emptyMsg}</li>`;
    return;
  }

  list.innerHTML = items.map((n) => `
    <li class="news-item">
      <a href="${sanitizeUrl(n.url)}" target="_blank" rel="noopener noreferrer">
        <div class="news-meta">
          <span class="news-category cat-${n.category}">${escapeHtml(n.catLabel)}</span>
          <span class="news-date">${escapeHtml(n.date || n.source)}</span>
        </div>
        <div class="news-title">${escapeHtml(n.title)}</div>
        ${n.snippet ? `<div class="news-snippet">${escapeHtml(n.snippet)}</div>` : ''}
      </a>
    </li>
  `).join('');
}

function setPanelLoading(panel, loading) {
  document.getElementById(`${panel}Loading`).classList.toggle('hidden', !loading);
}

function showPanelError(panel, message) {
  document.getElementById(`${panel}Error`).classList.remove('hidden');
  document.getElementById(`${panel}ErrorMsg`).textContent = message;
}

function hidePanelError(panel) {
  document.getElementById(`${panel}Error`).classList.add('hidden');
}

function updatePanelStatus(panel, configured, live) {
  const tag = document.getElementById(`${panel}StatusTag`);
  if (!configured) {
    tag.textContent = 'OFFLINE';
    tag.classList.remove('live');
    return;
  }
  tag.textContent = live ? 'LIVE' : 'READY';
  tag.classList.add('live');
}

function setActiveChip(panel, query) {
  document.querySelectorAll(`.news-chip[data-target="${panel}"]`).forEach((chip) => {
    chip.classList.toggle('active', chip.dataset.query === query);
  });
}

async function searchTavilyNews(query) {
  newsState.tavilyQuery = query;
  hidePanelError('tavily');
  setPanelLoading('tavily', true);

  try {
    const data = await getDashboardAPI().searchTavily(query, {
      max_results: 8,
      topic: 'news',
      search_depth: 'basic',
    });
    const mapped = mapTavilyResults(data.results || []);
    newsState.tavilyResults = mapped;
    renderNewsList('tavilyList', mapped);
    updatePanelStatus('tavily', true, true);
    setActiveChip('tavily', query);
    updateAnalysisMeta();
  } catch (err) {
    newsState.tavilyResults = [];
    renderNewsList('tavilyList', []);
    showPanelError('tavily', err.message || '국외 뉴스 검색 실패');
    updatePanelStatus('tavily', newsState.tavilyAvailable, false);
    updateAnalysisMeta();
  } finally {
    setPanelLoading('tavily', false);
  }
}

async function searchNaverNews(query) {
  newsState.naverQuery = query;
  hidePanelError('naver');
  setPanelLoading('naver', true);

  try {
    const data = await getDashboardAPI().searchNaver(query, {
      display: 8,
      sort: 'date',
    });
    const mapped = mapNaverResults(data.items || []);
    newsState.naverResults = mapped;
    renderNewsList('naverList', mapped);
    updatePanelStatus('naver', true, true);
    setActiveChip('naver', query);
    updateAnalysisMeta();
  } catch (err) {
    newsState.naverResults = [];
    renderNewsList('naverList', []);
    showPanelError('naver', err.message || '국내 뉴스 검색 실패');
    updatePanelStatus('naver', newsState.naverAvailable, false);
    updateAnalysisMeta();
  } finally {
    setPanelLoading('naver', false);
  }
}

async function searchAllNews(query) {
  const input = document.getElementById('newsGlobalInput');
  if (input.value.trim() !== query) input.value = query;
  await Promise.all([searchTavilyNews(query), searchNaverNews(query)]);
}

function setupNewsSearch() {
  document.getElementById('newsGlobalForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const query = document.getElementById('newsGlobalInput').value.trim();
    if (!query) return;
    searchAllNews(query);
  });

  document.querySelectorAll('.news-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const target = chip.dataset.target;
      const query = chip.dataset.query;
      if (target === 'tavily') searchTavilyNews(query);
      if (target === 'naver') searchNaverNews(query);
    });
  });

  document.querySelectorAll('[data-retry]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const panel = btn.dataset.retry;
      if (panel === 'tavily') searchTavilyNews(newsState.tavilyQuery);
      if (panel === 'naver') searchNaverNews(newsState.naverQuery);
    });
  });
}

async function refreshApiHealth() {
  try {
    const health = await getDashboardAPI().health();
    newsState.tavilyAvailable = Boolean(health.tavilyConfigured);
    newsState.naverAvailable = Boolean(health.naverConfigured);
    newsState.geminiLegacyServer = health.serverVersion !== 2 && health.geminiConfigured === undefined;
    newsState.geminiAvailable = Boolean(health.geminiConfigured);
    newsState.geminiHint = health.geminiHint || '';
    updatePanelStatus('tavily', newsState.tavilyAvailable, false);
    updatePanelStatus('naver', newsState.naverAvailable, false);
    updateAnalysisStatus(newsState.geminiAvailable, false);
    updateAnalysisMeta();
    return health;
  } catch (err) {
    newsState.geminiHint = err.message || '';
    updateAnalysisMeta();
    return null;
  }
}

async function initNews() {
  setupNewsSearch();

  try {
    await refreshApiHealth();

    const tasks = [];

    if (newsState.tavilyAvailable) {
      tasks.push(searchTavilyNews(DEFAULT_TAVILY_QUERY));
    } else {
      showPanelError('tavily', 'TAVILY_API_KEY 미설정 — .env 또는 Vercel 환경 변수를 확인하세요.');
    }

    if (newsState.naverAvailable) {
      tasks.push(searchNaverNews(DEFAULT_NAVER_QUERY));
    } else {
      showPanelError('naver', 'NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 미설정 — .env 또는 Vercel 환경 변수를 확인하세요.');
    }

    if (tasks.length) await Promise.all(tasks);
    updateAnalysisMeta();
  } catch (err) {
    showPanelError('tavily', err.message || 'API 서버 연결 실패');
    showPanelError('naver', err.message || 'API 서버 연결 실패');
  }
}

function renderTrendCards() {
  const container = document.getElementById('trendCards');
  container.innerHTML = techTrends.map(t => `
    <div class="trend-card">
      <span class="trend-icon">${t.icon}</span>
      <div class="trend-name">${t.name}</div>
      <div class="trend-growth">${t.growth}</div>
      <div class="trend-desc">${t.desc}</div>
    </div>
  `).join('');
}

function createSpendingChart() {
  const ctx = document.getElementById('spendingChart').getContext('2d');
  charts.spending = new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['2019', '2020', '2021', '2022', '2023', '2024', '2025'],
      datasets: [
        {
          label: '미국',
          data: [0.732, 0.778, 0.801, 0.877, 0.916, 0.997, 1.06],
          borderColor: CHART_COLORS.primary,
          backgroundColor: 'rgba(61, 139, 253, 0.08)',
          fill: true,
          tension: 0.35,
          pointRadius: 3,
        },
        {
          label: '중국',
          data: [0.261, 0.252, 0.293, 0.292, 0.296, 0.314, 0.332],
          borderColor: CHART_COLORS.quaternary,
          backgroundColor: 'transparent',
          tension: 0.35,
          pointRadius: 3,
        },
        {
          label: '러시아',
          data: [0.065, 0.062, 0.066, 0.087, 0.109, 0.122, 0.128],
          borderColor: CHART_COLORS.quinary,
          backgroundColor: 'transparent',
          tension: 0.35,
          pointRadius: 3,
        },
        {
          label: '한국',
          data: [0.043, 0.045, 0.048, 0.046, 0.047, 0.050, 0.054],
          borderColor: CHART_COLORS.secondary,
          backgroundColor: 'transparent',
          tension: 0.35,
          pointRadius: 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top', labels: { boxWidth: 12, padding: 16 } },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.dataset.label}: $${ctx.parsed.y.toFixed(3)}조`,
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: '#1e2a3a' },
          ticks: { callback: v => '$' + v + '조' },
        },
        x: { grid: { display: false } },
      },
    },
  });
}

function createRegionChart() {
  const labels = ['북미', '유럽', '아시아·태평양', '중동', '기타'];
  const data = [42, 24, 22, 8, 4];
  const colors = CHART_COLORS.palette.slice(0, 5);

  const ctx = document.getElementById('regionChart').getContext('2d');
  charts.region = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data, backgroundColor: colors, borderWidth: 0, hoverOffset: 6 }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: ctx => `${ctx.label}: ${ctx.parsed}%` },
        },
      },
    },
  });

  const legend = document.getElementById('regionLegend');
  legend.innerHTML = labels.map((l, i) => `
    <div class="legend-item">
      <span class="legend-dot" style="background:${colors[i]}"></span>
      ${l} ${data[i]}%
    </div>
  `).join('');
}

function createTechChart() {
  const ctx = document.getElementById('techChart').getContext('2d');
  charts.tech = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['무인체계', 'AI·자율', '사이버', '우주', '하이퍼소닉', '전자전'],
      datasets: [{
        label: 'R&D 투자 비중 (%)',
        data: [22, 18, 15, 14, 12, 10],
        backgroundColor: CHART_COLORS.palette.map(c => c + 'cc'),
        borderRadius: 4,
        borderSkipped: false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: {
        x: {
          grid: { color: '#1e2a3a' },
          ticks: { callback: v => v + '%' },
        },
        y: { grid: { display: false } },
      },
    },
  });
}

function createExportChart() {
  const ctx = document.getElementById('exportChart').getContext('2d');
  charts.export = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['K9 자주포', 'K2 전차', 'FA-50', 'K-SAM', '잠수함', '기타'],
      datasets: [{
        label: '수출액 (억 USD)',
        data: [52, 48, 31, 18, 12, 14],
        backgroundColor: [
          'rgba(74, 103, 65, 0.85)',
          'rgba(74, 103, 65, 0.7)',
          'rgba(61, 139, 253, 0.7)',
          'rgba(61, 139, 253, 0.55)',
          'rgba(243, 156, 18, 0.6)',
          'rgba(139, 156, 179, 0.4)',
        ],
        borderRadius: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: '#1e2a3a' },
          ticks: { callback: v => '$' + v + '억' },
        },
        x: { grid: { display: false } },
      },
    },
  });
}

function createContractChart() {
  const ctx = document.getElementById('contractChart').getContext('2d');
  charts.contract = new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['Q1\'24', 'Q2\'24', 'Q3\'24', 'Q4\'24', 'Q1\'25', 'Q2\'25'],
      datasets: [
        {
          label: '계약 건수',
          data: [142, 168, 155, 189, 201, 224],
          borderColor: CHART_COLORS.primary,
          backgroundColor: 'rgba(61, 139, 253, 0.1)',
          fill: true,
          tension: 0.4,
          yAxisID: 'y',
        },
        {
          label: '계약 금액 (B USD)',
          data: [38, 45, 41, 52, 58, 64],
          borderColor: CHART_COLORS.senary,
          backgroundColor: 'transparent',
          tension: 0.4,
          yAxisID: 'y1',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'top', labels: { boxWidth: 12 } } },
      scales: {
        y: {
          position: 'left',
          grid: { color: '#1e2a3a' },
          title: { display: true, text: '건수', color: '#5a6d85' },
        },
        y1: {
          position: 'right',
          grid: { drawOnChartArea: false },
          title: { display: true, text: 'B USD', color: '#5a6d85' },
        },
        x: { grid: { display: false } },
      },
    },
  });
}

function getAnalysisQuery() {
  const tavily = newsState.tavilyQuery?.trim();
  const naver = newsState.naverQuery?.trim();
  if (tavily && naver) {
    return tavily === naver ? tavily : `${tavily} / ${naver}`;
  }
  return tavily || naver || '';
}

function buildAnalysisPayload() {
  return {
    query: getAnalysisQuery() || newsState.tavilyQuery || newsState.naverQuery || '방산',
    globalNews: newsState.tavilyResults.map((item) => ({
      title: item.title,
      snippet: item.snippet,
      source: item.source,
      url: item.url,
    })),
    domesticNews: newsState.naverResults.map((item) => ({
      title: item.title,
      snippet: item.snippet,
      source: item.source,
      url: item.url,
    })),
  };
}

function hasAnalysisData() {
  return newsState.tavilyResults.length > 0 || newsState.naverResults.length > 0;
}

function renderAnalysisMarkdown(text) {
  const lines = text.split('\n');
  const html = [];
  let inList = false;

  const closeList = () => {
    if (inList) {
      html.push('</ul>');
      inList = false;
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('## ')) {
      closeList();
      html.push(`<h3 class="ai-h3">${escapeHtml(trimmed.slice(3))}</h3>`);
    } else if (trimmed.startsWith('### ')) {
      closeList();
      html.push(`<h4 class="ai-h4">${escapeHtml(trimmed.slice(4))}</h4>`);
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      if (!inList) {
        html.push('<ul class="ai-list">');
        inList = true;
      }
      html.push(`<li>${escapeHtml(trimmed.slice(2))}</li>`);
    } else if (trimmed === '') {
      closeList();
    } else {
      closeList();
      html.push(`<p>${escapeHtml(trimmed)}</p>`);
    }
  }
  closeList();
  return html.join('');
}

function updateAnalysisMeta() {
  const queryEl = document.getElementById('analysisQueryDisplay');
  const globalEl = document.getElementById('analysisGlobalCount');
  const domesticEl = document.getElementById('analysisDomesticCount');
  const emptyEl = document.getElementById('analysisEmpty');
  const runBtn = document.getElementById('analysisRunBtn');
  const hintEl = document.getElementById('analysisHint');

  if (!queryEl) return;

  const query = getAnalysisQuery() || '—';
  queryEl.textContent = query;
  globalEl.textContent = String(newsState.tavilyResults.length);
  domesticEl.textContent = String(newsState.naverResults.length);

  const hasData = hasAnalysisData();
  emptyEl.classList.toggle('hidden', hasData);
  if (runBtn) runBtn.disabled = !hasData || !newsState.geminiAvailable;

  if (!newsState.geminiAvailable) {
    if (newsState.geminiLegacyServer) {
      hintEl.textContent =
        '구버전 서버가 실행 중입니다. 서버 터미널에서 Ctrl+C로 종료 후 python server/app.py 를 다시 실행하고 Ctrl+F5로 새로고침하세요.';
    } else if (newsState.geminiHint) {
      hintEl.textContent = newsState.geminiHint;
    } else if (hintEl) {
      hintEl.textContent = 'GEMINI_API_KEY가 설정되지 않았습니다. .env 확인 후 서버 재시작 및 Ctrl+F5 새로고침하세요.';
    }
  } else if (!hasData) {
    hintEl.textContent = '뉴스 검색 탭에서 검색을 실행한 후 분석할 수 있습니다.';
  } else if (hintEl) {
    hintEl.textContent = `${newsState.tavilyResults.length + newsState.naverResults.length}건의 기사를 분석합니다.`;
  }
}

function updateAnalysisStatus(available, live) {
  const tag = document.getElementById('analysisStatusTag');
  if (!tag) return;

  if (!available) {
    tag.textContent = 'OFFLINE';
    tag.classList.remove('live');
    return;
  }
  tag.textContent = live ? 'LIVE' : 'READY';
  tag.classList.add('live');
}

function setAnalysisLoading(loading) {
  document.getElementById('analysisLoading')?.classList.toggle('hidden', !loading);
  document.getElementById('analysisRunBtn')?.toggleAttribute('disabled', loading);
}

function showAnalysisError(message) {
  const errEl = document.getElementById('analysisError');
  const msgEl = document.getElementById('analysisErrorMsg');
  if (msgEl) msgEl.textContent = message;
  errEl?.classList.remove('hidden');
}

function hideAnalysisError() {
  document.getElementById('analysisError')?.classList.add('hidden');
}

async function runAnalysis() {
  if (!hasAnalysisData()) {
    showAnalysisError('분석할 뉴스가 없습니다. 먼저 뉴스 검색을 실행하세요.');
    return;
  }

  await refreshApiHealth();
  if (!newsState.geminiAvailable) {
    showAnalysisError(newsState.geminiHint || 'GEMINI_API_KEY가 설정되지 않았습니다.');
    return;
  }

  hideAnalysisError();
  setAnalysisLoading(true);
  document.getElementById('analysisResult')?.classList.add('hidden');

  try {
    const payload = buildAnalysisPayload();
    const data = await getDashboardAPI().analyzeNews(payload);

    const resultEl = document.getElementById('analysisResult');
    if (resultEl) {
      resultEl.innerHTML = renderAnalysisMarkdown(data.analysis || '');
      resultEl.classList.remove('hidden');
    }
    document.getElementById('analysisEmpty')?.classList.add('hidden');
    updateAnalysisStatus(newsState.geminiAvailable, true);
  } catch (err) {
    showAnalysisError(err.message || 'AI 분석 실패');
    updateAnalysisStatus(newsState.geminiAvailable, false);
  } finally {
    setAnalysisLoading(false);
  }
}

function setupAnalysis() {
  document.getElementById('analysisRunBtn')?.addEventListener('click', runAnalysis);
  document.getElementById('analysisRetryBtn')?.addEventListener('click', runAnalysis);
  updateAnalysisMeta();
}

function initCharts() {
  createSpendingChart();
  createRegionChart();
  createTechChart();
  createExportChart();
  createContractChart();
}

function setupNav() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      item.classList.add('active');

      const section = item.dataset.section;
      const targets = {
        overview: '.kpi-grid',
        market: '.chart-grid',
        tech: '.tech-trends',
        news: '#newsSection',
        analysis: '#analysisSection',
      };
      const el = document.querySelector(targets[section]);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (section === 'analysis') refreshApiHealth();
    });
  });
}

function setupRefresh() {
  document.getElementById('refreshBtn').addEventListener('click', async () => {
    const btn = document.getElementById('refreshBtn');
    btn.classList.add('spinning');
    setCurrentDate();
    await Promise.all([
      newsState.tavilyAvailable ? searchTavilyNews(newsState.tavilyQuery) : Promise.resolve(),
      newsState.naverAvailable ? searchNaverNews(newsState.naverQuery) : Promise.resolve(),
    ]);
    setTimeout(() => btn.classList.remove('spinning'), 800);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  setCurrentDate();
  renderCompanyTable();
  renderTrendCards();
  initCharts();
  setupNav();
  setupRefresh();
  setupAnalysis();
  initNews();
});
