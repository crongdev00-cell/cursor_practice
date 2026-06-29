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
import xml.etree.ElementTree as ET
from datetime import date, timedelta
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TAVILY_SEARCH_URL = "https://api.tavily.com/search"
NAVER_NEWS_URL = "https://openapi.naver.com/v1/search/news.json"
BLOCKED_PREFIXES = ("/.env", "/server/", "/node_modules/", "/.git/", "/lib/", "/api/", "/prompt/")
MAX_BODY_BYTES = 32 * 1024


def load_env(env_path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    if not env_path.is_file():
        return env

    for line in env_path.read_text(encoding="utf-8-sig").splitlines():
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
DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"
GEMINI_MODEL_PATTERN = re.compile(r"^gemini-[a-z0-9.-]+$", re.IGNORECASE)
GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta"
PORT = int(ENV.get("PORT") or os.environ.get("PORT") or 3000)
MAX_ANALYZE_BODY_BYTES = 128 * 1024
PROMPT_DIR = ROOT / "prompt"
DEFAULT_PROMPT_FILE = "news-analysis.md"
_prompt_cache: dict[str, tuple[float, str]] = {}


def load_prompt_template(name: str = DEFAULT_PROMPT_FILE) -> str:
    path = PROMPT_DIR / name
    if not path.is_file():
        raise FileNotFoundError(f"프롬프트 파일을 찾을 수 없습니다: {path}")

    mtime = path.stat().st_mtime
    cached = _prompt_cache.get(name)
    if cached and cached[0] == mtime:
        return cached[1]

    text = path.read_text(encoding="utf-8")
    _prompt_cache[name] = (mtime, text)
    return text


def format_news_items(items: list, label: str) -> str:
    if not items:
        return f"{label}: (검색 결과 없음)"
    lines = []
    for i, item in enumerate(items[:8], 1):
        title = item.get("title") or "제목 없음"
        snippet = str(item.get("snippet") or item.get("description") or "")[:200]
        source = item.get("source") or item.get("url") or ""
        lines.append(f"{i}. [{title}] {snippet} (출처: {source})")
    return f"{label}:\n" + "\n".join(lines)


def build_analysis_prompt(query: str, global_news: list, domestic_news: list) -> str:
    template = load_prompt_template()
    return (
        template.replace("{{QUERY}}", query)
        .replace("{{GLOBAL_NEWS}}", format_news_items(global_news, "국외 뉴스"))
        .replace("{{DOMESTIC_NEWS}}", format_news_items(domestic_news, "국내 뉴스"))
    )


GEMINI_PLACEHOLDER_VALUES = {
    "your-gemini-api-key",
    "your-api-key-here",
    "your_api_key_here",
}


def resolve_gemini_api_key() -> str:
    """요청마다 .env를 다시 읽어 GEMINI 키를 확인합니다."""
    env = load_env(ROOT / ".env")
    key = (env.get("GEMINI_API_KEY") or os.environ.get("GEMINI_API_KEY") or "").strip().strip('"').strip("'")
    if not key:
        return ""
    lowered = key.lower()
    if lowered in GEMINI_PLACEHOLDER_VALUES or lowered.startswith("your-"):
        return ""
    return key


def gemini_setup_hint() -> str:
    env = load_env(ROOT / ".env")
    raw = (env.get("GEMINI_API_KEY") or os.environ.get("GEMINI_API_KEY") or "").strip()
    if not raw:
        return ".env 파일에 GEMINI_API_KEY=발급받은키 를 추가하세요."
    lowered = raw.lower().strip('"').strip("'")
    if lowered in GEMINI_PLACEHOLDER_VALUES or lowered.startswith("your-"):
        return "GEMINI_API_KEY가 예시 값입니다. Google AI Studio에서 발급한 실제 키로 교체하세요."
    return "서버를 재시작(Ctrl+C 후 python server/app.py)하고 페이지를 Ctrl+F5로 새로고침하세요."


def resolve_gemini_model() -> str:
    env = load_env(ROOT / ".env")
    raw = (env.get("GEMINI_MODEL") or os.environ.get("GEMINI_MODEL") or "").strip().strip('"').strip("'")
    if not raw or not GEMINI_MODEL_PATTERN.match(raw):
        return DEFAULT_GEMINI_MODEL
    return raw


DAPA_BID_API_URL = "https://apis.data.go.kr/1690000/BidPblancInfoService/getDmstcCmpetBidPblancList"
DAPA_ITEM_FIELDS = (
    "pblancSeCode", "pblancSe", "demandYear", "pblancDate", "pblancNo", "pblancOdr",
    "g2bPblancNo", "g2bPblancOdr", "dcsNo", "bidNm", "orntCode", "ornt",
    "prdctnAbltyPresentnClosDt", "bidPartcptRegistClosDt", "biddocPresentnClosDt",
    "opengDt", "excutTyCode", "excutTy", "cntrctMth", "bidStle",
    "bsisPrdprcApplcAt", "bsicExpt", "bsisPrdprcOthbcAt", "busiDivs",
)
DAPA_PLACEHOLDER_VALUES = {"your-dapa-service-key", "your-api-key-here", "your_api_key_here"}


def resolve_dapa_service_key() -> str:
    env = load_env(ROOT / ".env")
    key = (env.get("DAPA_SERVICE_KEY") or os.environ.get("DAPA_SERVICE_KEY") or "").strip().strip('"').strip("'")
    if not key:
        return ""
    lowered = key.lower()
    if lowered in DAPA_PLACEHOLDER_VALUES or lowered.startswith("your-"):
        return ""
    return key


def dapa_setup_hint() -> str:
    env = load_env(ROOT / ".env")
    raw = (env.get("DAPA_SERVICE_KEY") or os.environ.get("DAPA_SERVICE_KEY") or "").strip()
    if not raw:
        return ".env 파일에 DAPA_SERVICE_KEY=공공데이터포털_서비스키 를 추가하세요."
    lowered = raw.lower().strip('"').strip("'")
    if lowered in DAPA_PLACEHOLDER_VALUES or lowered.startswith("your-"):
        return "DAPA_SERVICE_KEY가 예시 값입니다. 공공데이터포털에서 발급한 실제 키로 교체하세요."
    return "서버를 재시작(Ctrl+C 후 python server/app.py)하고 페이지를 Ctrl+F5로 새로고침하세요."


def parse_dapa_xml(xml_text: str) -> dict:
    root = ET.fromstring(xml_text)
    header = root.find("header")
    result_code = (header.findtext("resultCode") or "").strip() if header is not None else ""
    result_msg = (header.findtext("resultMsg") or "").strip() if header is not None else ""

    if result_code and result_code != "00":
        return {"error": result_msg or f"공공데이터 API 오류 (코드: {result_code})"}

    body = root.find("body")
    items: list[dict[str, str]] = []
    if body is not None:
        for item_el in body.findall(".//item"):
            item = {field: (item_el.findtext(field) or "").strip() for field in DAPA_ITEM_FIELDS}
            items.append(item)

    return {
        "totalCount": (body.findtext("totalCount") if body is not None else "") or str(len(items)),
        "pageNo": (body.findtext("pageNo") if body is not None else "") or "1",
        "numOfRows": (body.findtext("numOfRows") if body is not None else "") or str(len(items)),
        "items": items,
    }


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

    def read_json_body(self, max_bytes: int = MAX_BODY_BYTES) -> dict | None:
        length = int(self.headers.get("Content-Length", 0))
        if length <= 0 or length > max_bytes:
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
            gemini_key = resolve_gemini_api_key()
            self.end_json(
                HTTPStatus.OK,
                {
                    "status": "ok",
                    "serverVersion": 3,
                    "tavilyConfigured": bool(TAVILY_API_KEY),
                    "naverConfigured": bool(NAVER_CLIENT_ID and NAVER_CLIENT_SECRET),
                    "geminiConfigured": bool(gemini_key),
                    "geminiHint": gemini_setup_hint() if not gemini_key else None,
                    "geminiModel": resolve_gemini_model(),
                    "dapaConfigured": bool(resolve_dapa_service_key()),
                    "dapaHint": dapa_setup_hint() if not resolve_dapa_service_key() else None,
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

    def handle_dapa_bids(self, body: dict) -> None:
        service_key = resolve_dapa_service_key()
        if not service_key:
            self.end_json(
                HTTPStatus.SERVICE_UNAVAILABLE,
                {"error": f"DAPA_SERVICE_KEY가 설정되지 않았습니다. {dapa_setup_hint()}"},
            )
            return

        try:
            page_no = max(1, min(int(body.get("pageNo", 1)), 100))
        except (TypeError, ValueError):
            page_no = 1

        try:
            num_of_rows = max(1, min(int(body.get("numOfRows", 10)), 50))
        except (TypeError, ValueError):
            num_of_rows = 10

        try:
            days = max(1, min(int(body.get("days", 30)), 90))
        except (TypeError, ValueError):
            days = 30

        end_dt = date.today()
        start_dt = end_dt - timedelta(days=days)
        params: dict[str, str] = {
            "serviceKey": service_key,
            "pageNo": str(page_no),
            "numOfRows": str(num_of_rows),
            "anmtDateBegin": start_dt.strftime("%Y%m%d"),
            "anmtDateEnd": end_dt.strftime("%Y%m%d"),
        }

        bid_nm = body.get("bidNm")
        if isinstance(bid_nm, str) and bid_nm.strip():
            params["bidNm"] = bid_nm.strip()[:100]

        ornt_code = body.get("orntCode")
        if isinstance(ornt_code, str) and ornt_code.strip():
            params["orntCode"] = ornt_code.strip()[:20]

        url = f"{DAPA_BID_API_URL}?{urllib.parse.urlencode(params)}"

        try:
            request = urllib.request.Request(url, method="GET")
            with urllib.request.urlopen(request, timeout=30) as response:
                xml_text = response.read().decode("utf-8")

            parsed = parse_dapa_xml(xml_text)
            if parsed.get("error"):
                self.end_json(HTTPStatus.BAD_GATEWAY, {"error": parsed["error"]})
                return

            self.end_json(
                HTTPStatus.OK,
                {
                    "totalCount": parsed["totalCount"],
                    "pageNo": parsed["pageNo"],
                    "numOfRows": parsed["numOfRows"],
                    "searchPeriod": {
                        "begin": params["anmtDateBegin"],
                        "end": params["anmtDateEnd"],
                    },
                    "items": parsed["items"],
                },
            )
        except ET.ParseError:
            self.end_json(HTTPStatus.BAD_GATEWAY, {"error": "입찰공고 API 응답 파싱 실패"})
        except urllib.error.HTTPError as exc:
            try:
                error_body = exc.read().decode("utf-8")
                message = error_body[:200] or "방위사업청 입찰공고 API 요청 실패"
            except UnicodeDecodeError:
                message = "방위사업청 입찰공고 API 요청 실패"
            self.end_json(exc.code, {"error": message})
        except (urllib.error.URLError, TimeoutError):
            self.end_json(HTTPStatus.BAD_GATEWAY, {"error": "방위사업청 입찰공고 API에 연결할 수 없습니다."})

    def handle_gemini_analyze(self, body: dict) -> None:
        gemini_key = resolve_gemini_api_key()
        if not gemini_key:
            self.end_json(
                HTTPStatus.SERVICE_UNAVAILABLE,
                {"error": f"GEMINI_API_KEY가 설정되지 않았습니다. {gemini_setup_hint()}"},
            )
            return

        query = body.get("query")
        if not isinstance(query, str):
            query = ""
        query = query.strip() or "방산"

        global_news = body.get("globalNews")
        domestic_news = body.get("domesticNews")
        if not isinstance(global_news, list):
            global_news = []
        if not isinstance(domestic_news, list):
            domestic_news = []

        global_news = global_news[:10]
        domestic_news = domestic_news[:10]

        if not query and not global_news and not domestic_news:
            self.end_json(HTTPStatus.BAD_REQUEST, {"error": "분석할 뉴스 데이터가 없습니다."})
            return

        try:
            prompt = build_analysis_prompt(query, global_news, domestic_news)
        except FileNotFoundError as exc:
            self.end_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": str(exc)})
            return

        model = resolve_gemini_model()
        url = f"{GEMINI_API_BASE}/models/{model}:generateContent?key={gemini_key}"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.4, "maxOutputTokens": 2048},
        }

        try:
            request = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(request, timeout=60) as response:
                data = json.loads(response.read().decode("utf-8"))

            parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
            text = "".join(p.get("text", "") for p in parts if isinstance(p, dict)).strip()

            if not text:
                self.end_json(
                    HTTPStatus.BAD_GATEWAY,
                    {"error": "Gemini가 분석 결과를 생성하지 못했습니다."},
                )
                return

            self.end_json(
                HTTPStatus.OK,
                {
                    "analysis": text,
                    "model": model,
                    "query": query,
                    "articleCount": {
                        "global": len(global_news),
                        "domestic": len(domestic_news),
                    },
                },
            )
        except urllib.error.HTTPError as exc:
            try:
                error_body = json.loads(exc.read().decode("utf-8"))
                message = (
                    error_body.get("error", {}).get("message")
                    or error_body.get("error")
                    or "Gemini API 요청 실패"
                )
            except (json.JSONDecodeError, UnicodeDecodeError):
                message = "Gemini API 요청 실패"
            self.end_json(exc.code, {"error": message})
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
            self.end_json(HTTPStatus.BAD_GATEWAY, {"error": "Gemini API에 연결할 수 없습니다."})

    def do_POST(self) -> None:
        path = self.path.split("?", 1)[0]

        max_bytes = MAX_ANALYZE_BODY_BYTES if path.startswith("/api/gemini/analyze") else MAX_BODY_BYTES
        body = self.read_json_body(max_bytes=max_bytes)
        if body is None:
            self.end_json(HTTPStatus.BAD_REQUEST, {"error": "잘못된 JSON 요청입니다."})
            return

        if path.startswith("/api/tavily/search"):
            self.handle_tavily_search(body)
            return

        if path.startswith("/api/naver/search"):
            self.handle_naver_search(body)
            return

        if path.startswith("/api/gemini/analyze"):
            self.handle_gemini_analyze(body)
            return

        if path.startswith("/api/dapa/bids"):
            self.handle_dapa_bids(body)
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
        print("[WARN] TAVILY_API_KEY 미설정 - .env.example 을 참고하여 .env 파일을 만드세요.")
    if not NAVER_CLIENT_ID or not NAVER_CLIENT_SECRET:
        print("[WARN] NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 미설정 - .env 파일을 확인하세요.")
    else:
        print("  Naver API : /api/naver/search 준비됨")

    if not resolve_gemini_api_key():
        print(f"[WARN] GEMINI_API_KEY 미설정 - {gemini_setup_hint()}")
    else:
        print("  Gemini API: /api/gemini/analyze 준비됨")

    if not resolve_dapa_service_key():
        print(f"[WARN] DAPA_SERVICE_KEY 미설정 - {dapa_setup_hint()}")
    else:
        print("  DAPA API  : /api/dapa/bids 준비됨")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
        server.server_close()


if __name__ == "__main__":
    main()
