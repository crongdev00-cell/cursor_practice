/**
 * 서버 프록시를 통한 Tavily 검색 클라이언트
 * API 키는 서버(.env)에만 존재하며, 브라우저에는 노출되지 않습니다.
 */
const TavilyAPI = {
  async search(query, options = {}) {
    const res = await fetch('/api/tavily/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, ...options }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || `검색 실패 (${res.status})`);
    }

    return data;
  },

  async health() {
    const res = await fetch('/api/health');
    return res.json();
  },
};

if (typeof window !== 'undefined') {
  window.TavilyAPI = TavilyAPI;
}
