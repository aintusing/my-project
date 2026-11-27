"""Local demo server on 127.0.0.1 that never lets the browser cache stale modules.

Usage: python graph/tools/serve.py [port]
"""
import functools
import http.server
import pathlib
import sys


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8767
    root = str(pathlib.Path(__file__).resolve().parent.parent)
    server = http.server.ThreadingHTTPServer(("127.0.0.1", port), functools.partial(Handler, directory=root))
    print(f"http://127.0.0.1:{port}/", flush=True)
    server.serve_forever()
