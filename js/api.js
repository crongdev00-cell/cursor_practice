/**
 * 대시보드 API 클라이언트 (Tavily + Naver)
 */
window.DashboardAPI = {
  getBaseUrl() {
    const { protocol, hostname, port } = window.location;

    if (protocol === 'file:') {
      return 'http://127.0.0.1:3000';
    }

    const needsLocalApi =
      (hostname === 'localhost' || hostname === '127.0.0.1') && port && port !== '3000';

    if (needsLocalApi) {
      return 'http://127.0.0.1:3000';
    }

    return '';
  },

  async request(path, options = {}) {
    const base = this.getBaseUrl();
    const url = `${base}${path}`;

    let res;
    try {
      res = await fetch(url, options);
    } catch {
      const isFile = window.location.protocol === 'file:';
      const hint = isFile
        ? 'python server/app.py 실행 후 http://127.0.0.1:3000 으로 접속하세요.'
        : base
          ? 'Python 서버가 3000번 포트에서 실행 중인지 확인하세요.'
          : 'Vercel 환경 변수 설정 후 Redeploy 했는지 확인하세요.';
      throw new Error(`API 서버에 연결할 수 없습니다. ${hint}`);
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error(`API 오류 (${res.status}). 서버 경로를 확인하세요.`);
    }

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || `API 요청 실패 (${res.status})`);
    }

    return data;
  },

  searchTavily(query, options = {}) {
    return this.request('/api/tavily/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, ...options }),
    });
  },

  searchNaver(query, options = {}) {
    return this.request('/api/naver/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, ...options }),
    });
  },

  analyzeNews(payload) {
    return this.request('/api/gemini/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  health() {
    return this.request('/api/health');
  },
};

window.TavilyAPI = window.DashboardAPI;
