/**
 * Tavily API 클라이언트
 * - Vercel / Python / Node 서버의 /api/* 엔드포인트 호출
 * - API 키는 서버 환경변수에만 존재
 */
window.TavilyAPI = {
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
        ? 'HTML 파일을 직접 열지 말고, python server/app.py 실행 후 http://127.0.0.1:3000 으로 접속하세요.'
        : base
          ? 'Python 서버(python server/app.py)가 3000번 포트에서 실행 중인지 확인하세요.'
          : 'Vercel 배포 URL로 접속했는지, 환경 변수(TAVILY_API_KEY) 설정 후 Redeploy 했는지 확인하세요.';
      throw new Error(`API 서버에 연결할 수 없습니다. ${hint}`);
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error(
        `API 오류 (${res.status}). js/api.js 가 로드되지 않았거나 서버 경로를 확인하세요.`
      );
    }

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || `API 요청 실패 (${res.status})`);
    }

    return data;
  },

  async search(query, options = {}) {
    return this.request('/api/tavily/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, ...options }),
    });
  },

  async health() {
    return this.request('/api/health');
  },
};
