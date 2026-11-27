"""Read-only HTTP API на 127.0.0.1. GET /health, /search, /facets. Другие методы -> 405."""
import argparse
import json
import sqlite3
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qsl, urlsplit

from catalog.db.build import DEFAULT_DB
from .search import BadRequest, facets, search

ALLOWED = {"q", "kind", "sphere", "tier", "origin", "min_significance", "flagged", "limit", "offset"}


def make_handler(db_path):
    class Handler(BaseHTTPRequestHandler):
        def reply(self, status, body):
            data = json.dumps(body, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self):
            url = urlsplit(self.path)
            pairs = parse_qsl(url.query, keep_blank_values=True)
            params = dict(pairs)
            try:
                if url.path == "/health":
                    return self.reply(200, {"status": "ok"})
                if url.path not in ("/search", "/facets"):
                    return self.reply(404, {"error": "not_found"})
                unknown = sorted(set(params) - ALLOWED)
                if unknown or len(params) != len(pairs):
                    raise BadRequest("неизвестный или повторный параметр: " + (", ".join(unknown) or "дубликат"))
                db = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
                try:
                    body = facets(db) if url.path == "/facets" else search(db, params)
                finally:
                    db.close()
                self.reply(200, body)
            except BadRequest as error:
                self.reply(400, {"error": "bad_request", "detail": str(error)})
            except sqlite3.Error:
                self.reply(503, {"error": "database_unavailable",
                                 "detail": "соберите базу: python -m catalog.db.build"})

        def deny(self):
            self.reply(405, {"error": "method_not_allowed"})

        do_POST = do_PUT = do_DELETE = do_PATCH = deny

        def log_message(self, *args):
            pass

    return Handler


def serve(db_path=DEFAULT_DB, host="127.0.0.1", port=8765):
    return ThreadingHTTPServer((host, port), make_handler(str(db_path)))


def main(argv=None):
    parser = argparse.ArgumentParser(prog="radar.api")
    parser.add_argument("--db", default=str(DEFAULT_DB))
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args(argv)
    server = serve(args.db, args.host, args.port)
    print(f"http://{args.host}:{args.port}  (Ctrl+C - остановить)", file=sys.stderr)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    return 0
