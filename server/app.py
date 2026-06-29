"""
로컬 테스트용 Python 서버
- 정적 파일 제공 (index.html, weather.html 등)
- Tavily API 프록시 (/api/tavily/search)
- API 키는 .env 에서만 로드 (브라우저 노출 없음)

실행: python server/app.py
"""

from __future__ import annotations

import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TAVILY_SEARCH_URL = "https://api.tavily.com/search"
NAVER_NEWS_URL = "https://openapi.naver.com/v1/search/news.json"
BLOCKED_PREFIXES = ("/.env", "/server/", "/node_modules/", "/.git/", "/lib/", "/api/")
MAX_BODY_BYTES = 32 * 1024


def load_env(env_path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    if not env_path.is_file():
        return env

    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        env[key.strip()] = value.strip().strip('"').strip("'")
    return env


ENV = load_env(ROOT / ".env")
TAVILY_API_KEY = ENV.get("TAVILY_API_KEY") or os.environ.get("TAVILY_API_KEY", "")
NAVER_CLIENT_ID = ENV.get("NAVER_CLIENT_ID") or os.environ.get("NAVER_CLIENT_ID", "")
NAVER_CLIENT_SECRET = ENV.get("NAVER_CLIENT_SECRET") or os.environ.get("NAVER_CLIENT_SECRET", "")
PORT = int(ENV.get("PORT") or os.environ.get("PORT") or 3000)


def strip_html(text: str) -> str:
    cleaned = re.sub(r"<[^>]+>", "", text or "")
    return (
        cleaned.replace("&quot;", '"')
        .replace("&#39;", "'")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
    )


class DashboardHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, format: str, *args) -> None:
        sys.stdout.write(f"[{self.log_date_time_string()}] {format % args}\n")

    def end_json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:
        if self.path.startswith("/api/"):
            self.send_response(HTTPStatus.NO_CONTENT)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.end_headers()
            return
        self.send_error(HTTPStatus.NOT_FOUND)

    def read_json_body(self) -> dict | None:
        length = int(self.headers.get("Content-Length", 0))
        if length <= 0 or length > MAX_BODY_BYTES:
            return None
        raw = self.rfile.read(length)
        try:
            data = json.loads(raw.decode("utf-8"))
            return data if isinstance(data, dict) else None
        except (json.JSONDecodeError, UnicodeDecodeError):
            return None

    def is_blocked(self) -> bool:
        path = self.path.split("?", 1)[0]
        return any(path.startswith(prefix) for prefix in BLOCKED_PREFIXES)

    def do_GET(self) -> None:
        if self.path.startswith("/api/health"):
            self.end_json(
                HTTPStatus.OK,
                {
                    "status": "ok",
                    "tavilyConfigured": bool(TAVILY_API_KEY),
                    "naverConfigured": bool(NAVER_CLIENT_ID and NAVER_CLIENT_SECRET),
                    "runtime": "python",
                },
            )
            return

        if self.is_blocked():
            self.send_error(HTTPStatus.NOT_FOUND)
            return

        return super().do_GET()

    def handle_tavily_search(self, body: dict) -> None:
        if not TAVILY_API_KEY:
            self.end_json(
                HTTPStatus.SERVICE_UNAVAILABLE,
                {"error": "TAVILY_API_KEY가 설정되지 않았습니다. .env 파일을 확인하세요."},
            )
            return

        query = body.get("query")
        if not isinstance(query, str) or not query.strip():
            self.end_json(HTTPStatus.BAD_REQUEST, {"error": "query는 필수입니다."})
            return

        query = query.strip()
        if len(query) > 500:
            self.end_json(HTTPStatus.BAD_REQUEST, {"error": "query는 500자 이하여야 합니다."})
            return

        max_results = body.get("max_results", 5)
        try:
            max_results = max(1, min(int(max_results), 20))
        except (TypeError, ValueError):
            max_results = 5

        payload: dict = {"query": query, "max_results": max_results}

        search_depth = body.get("search_depth")
        if isinstance(search_depth, str) and search_depth:
            payload["search_depth"] = search_depth

        topic = body.get("topic")
        if isinstance(topic, str) and topic:
            payload["topic"] = topic

        for field in ("include_domains", "exclude_domains"):
            value = body.get(field)
            if isinstance(value, list):
                payload[field] = [str(v) for v in value[:10]]

        try:
            request = urllib.request.Request(
                TAVILY_SEARCH_URL,
                data=json.dumps(payload).encode("utf-8"),
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {TAVILY_API_KEY}",
                },
                method="POST",
            )
            with urllib.request.urlopen(request, timeout=30) as response:
                data = json.loads(response.read().decode("utf-8"))
            self.end_json(HTTPStatus.OK, data)
        except urllib.error.HTTPError as exc:
            try:
                error_body = json.loads(exc.read().decode("utf-8"))
                message = (
                    error_body.get("detail", {}).get("error")
                    or error_body.get("error")
                    or "Tavily API 요청 실패"
                )
            except (json.JSONDecodeError, UnicodeDecodeError):
                message = "Tavily API 요청 실패"
            self.end_json(exc.code, {"error": message})
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
            self.end_json(HTTPStatus.BAD_GATEWAY, {"error": "Tavily API에 연결할 수 없습니다."})

    def handle_naver_search(self, body: dict) -> None:
        if not NAVER_CLIENT_ID or not NAVER_CLIENT_SECRET:
            self.end_json(
                HTTPStatus.SERVICE_UNAVAILABLE,
                {"error": "NAVER_CLIENT_ID / NAVER_CLIENT_SECRET이 설정되지 않았습니다."},
            )
            return

        query = body.get("query")
        if not isinstance(query, str) or not query.strip():
            self.end_json(HTTPStatus.BAD_REQUEST, {"error": "query는 필수입니다."})
            return

        query = query.strip()
        if len(query) > 100:
            self.end_json(HTTPStatus.BAD_REQUEST, {"error": "query는 100자 이하여야 합니다."})
            return

        display = body.get("display", 8)
        try:
            display = max(1, min(int(display), 20))
        except (TypeError, ValueError):
            display = 8

        sort = "sim" if body.get("sort") == "sim" else "date"
        params = urllib.parse.urlencode({"query": query, "display": display, "sort": sort})
        url = f"{NAVER_NEWS_URL}?{params}"

        try:
            request = urllib.request.Request(
                url,
                headers={
                    "X-Naver-Client-Id": NAVER_CLIENT_ID,
                    "X-Naver-Client-Secret": NAVER_CLIENT_SECRET,
                },
                method="GET",
            )
            with urllib.request.urlopen(request, timeout=30) as response:
                data = json.loads(response.read().decode("utf-8"))

            items = [
                {
                    "title": strip_html(item.get("title", "")),
                    "description": strip_html(item.get("description", "")),
                    "link": item.get("link"),
                    "originallink": item.get("originallink"),
                    "pubDate": item.get("pubDate"),
                }
                for item in data.get("items", [])
            ]

            self.end_json(
                HTTPStatus.OK,
                {"total": data.get("total"), "display": data.get("display"), "items": items},
            )
        except urllib.error.HTTPError as exc:
            try:
                error_body = json.loads(exc.read().decode("utf-8"))
                message = error_body.get("errorMessage") or error_body.get("error") or "네이버 검색 API 요청 실패"
            except (json.JSONDecodeError, UnicodeDecodeError):
                message = "네이버 검색 API 요청 실패"
            self.end_json(exc.code, {"error": message})
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
            self.end_json(HTTPStatus.BAD_GATEWAY, {"error": "네이버 검색 API에 연결할 수 없습니다."})

    def do_POST(self) -> None:
        path = self.path.split("?", 1)[0]

        body = self.read_json_body()
        if body is None:
            self.end_json(HTTPStatus.BAD_REQUEST, {"error": "잘못된 JSON 요청입니다."})
            return

        if path.startswith("/api/tavily/search"):
            self.handle_tavily_search(body)
            return

        if path.startswith("/api/naver/search"):
            self.handle_naver_search(body)
            return

        self.end_json(
            HTTPStatus.NOT_FOUND,
            {"error": f"API 경로를 찾을 수 없습니다: {path}. python server/app.py 로 서버를 재시작하세요."},
        )


def main() -> None:
    server = ThreadingHTTPServer(("127.0.0.1", PORT), DashboardHandler)
    print(f"Python server running at http://127.0.0.1:{PORT}")
    print(f"  Dashboard : http://127.0.0.1:{PORT}/index.html")
    print(f"  Weather   : http://127.0.0.1:{PORT}/weather.html")

    if not TAVILY_API_KEY:
        print("⚠  TAVILY_API_KEY 미설정 — .env.example 을 참고하여 .env 파일을 만드세요.")
    if not NAVER_CLIENT_ID or not NAVER_CLIENT_SECRET:
        print("⚠  NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 미설정 — .env 파일을 확인하세요.")
    else:
        print("  Naver API : /api/naver/search 준비됨")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
        server.server_close()


if __name__ == "__main__":
    main()
