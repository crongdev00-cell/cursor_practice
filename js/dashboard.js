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

const newsItems = [
  { category: 'export', catLabel: '수출', title: '폴란드, K2 전차 추가 180대 도입 계약 체결 — 한화에어로스페이스', date: '2026.06.25', source: 'Defense News', url: '#' },
  { category: 'tech', catLabel: '기술', title: 'NATO, AI 기반 다국적 연합 작전 시스템(NATO AI C2) 파일럿 가동', date: '2026.06.22', source: 'NATO Press', url: '#' },
  { category: 'contract', catLabel: '계약', title: '미 해군, 차세대 무인 수중정(UUV) 개발 42억 달러 계약 — General Dynamics', date: '2026.06.18', source: 'USNI News', url: '#' },
  { category: 'policy', catLabel: '정책', title: 'EU, 2027년까지 방위 R&D 예산 30% 증액 결의 — REARM Europe Initiative', date: '2026.06.15', source: 'European Commission', url: '#' },
  { category: 'export', catLabel: '수출', title: 'LIG넥스원, 중동국 K-SAM Block-II 추가 수출 MOU 체결', date: '2026.06.12', source: 'KOTRA', url: '#' },
  { category: 'tech', catLabel: '기술', title: '하이퍼소닉 방어체계(HMDS) 글로벌 시장, 2030년 150억 달러 전망', date: '2026.06.08', source: 'SIPRI Report', url: '#' },
];

const DEFAULT_NEWS_QUERY = 'defense industry news latest';
let currentNewsQuery = DEFAULT_NEWS_QUERY;
let tavilyAvailable = false;

function getTavilyAPI() {
  if (!window.TavilyAPI) {
    throw new Error('js/api.js 를 불러오지 못했습니다. 페이지를 새로고침(Ctrl+F5)하세요.');
  }
  return window.TavilyAPI;
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
      score: r.score,
    };
  });
}

function renderNewsItems(items) {
  const list = document.getElementById('newsList');
  if (!items.length) {
    list.innerHTML = '<li class="news-state">검색 결과가 없습니다.</li>';
    return;
  }

  list.innerHTML = items.map((n) => `
    <li class="news-item">
      <a href="${sanitizeUrl(n.url)}" target="_blank" rel="noopener noreferrer">
        <div class="news-meta">
          <span class="news-category cat-${n.category}">${escapeHtml(n.catLabel)}</span>
          <span class="news-date">${escapeHtml(n.source)}</span>
        </div>
        <div class="news-title">${escapeHtml(n.title)}</div>
        ${n.snippet ? `<div class="news-snippet">${escapeHtml(n.snippet)}</div>` : ''}
      </a>
    </li>
  `).join('');
}

function renderFallbackNews() {
  renderNewsItems(newsItems.map((n) => ({ ...n, snippet: '' })));
}

function setNewsLoading(loading) {
  document.getElementById('newsLoading').classList.toggle('hidden', !loading);
  document.getElementById('newsSearchBtn').disabled = loading;
}

function showNewsError(message, clearList = true) {
  document.getElementById('newsError').classList.remove('hidden');
  document.getElementById('newsErrorMsg').textContent = message;
  if (clearList) document.getElementById('newsList').innerHTML = '';
}

function hideNewsError() {
  document.getElementById('newsError').classList.add('hidden');
}

function setActiveChip(query) {
  document.querySelectorAll('.news-chip').forEach((chip) => {
    chip.classList.toggle('active', chip.dataset.query === query);
  });
}

function updateNewsStatusTag(configured, live) {
  const tag = document.getElementById('newsStatusTag');
  if (!configured) {
    tag.textContent = 'OFFLINE';
    tag.classList.remove('live');
    return;
  }
  tag.textContent = live ? 'LIVE' : 'TAVILY';
  tag.classList.add('live');
}

async function searchNews(query) {
  currentNewsQuery = query;
  hideNewsError();
  setNewsLoading(true);

  const input = document.getElementById('newsSearchInput');
  if (input.value.trim() !== query) {
    input.value = query;
  }

  try {
    const data = await getTavilyAPI().search(query, {
      max_results: 8,
      topic: 'news',
      search_depth: 'basic',
    });

    const items = mapTavilyResults(data.results || []);
    renderNewsItems(items);
    updateNewsStatusTag(true, true);
  } catch (err) {
    showNewsError(err.message || '뉴스 검색에 실패했습니다.');
    updateNewsStatusTag(tavilyAvailable, false);
  } finally {
    setNewsLoading(false);
  }
}

function setupNewsSearch() {
  const form = document.getElementById('newsSearchForm');
  const input = document.getElementById('newsSearchInput');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const query = input.value.trim();
    if (!query) return;
    setActiveChip('');
    searchNews(query);
  });

  document.querySelectorAll('.news-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const query = chip.dataset.query;
      setActiveChip(query);
      searchNews(query);
    });
  });

  document.getElementById('newsRetryBtn').addEventListener('click', () => {
    searchNews(currentNewsQuery);
  });
}

async function initNews() {
  setupNewsSearch();

  try {
    const health = await getTavilyAPI().health();
    tavilyAvailable = health.tavilyConfigured;
    updateNewsStatusTag(tavilyAvailable, false);

    if (tavilyAvailable) {
      setActiveChip(DEFAULT_NEWS_QUERY);
      await searchNews(DEFAULT_NEWS_QUERY);
    } else {
      renderFallbackNews();
      showNewsError('TAVILY_API_KEY 미설정 — .env 파일을 확인하세요. (샘플 데이터 표시 중)', false);
    }
  } catch (err) {
    tavilyAvailable = false;
    renderFallbackNews();
    showNewsError(err.message || 'API 서버에 연결할 수 없습니다.', false);
    updateNewsStatusTag(false, false);
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
        news: '.bottom-grid',
      };
      const el = document.querySelector(targets[section]);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

function setupRefresh() {
  document.getElementById('refreshBtn').addEventListener('click', async () => {
    const btn = document.getElementById('refreshBtn');
    btn.classList.add('spinning');
    setCurrentDate();
    if (tavilyAvailable) {
      await searchNews(currentNewsQuery);
    }
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
  initNews();
});
