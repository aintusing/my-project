import json
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from pathlib import Path

from catalog.db.build import build
from radar.api.server import serve
from tests.test_catalog_db import make_csv


class ApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        db = Path(cls.tmp.name) / "c.sqlite"
        build(make_csv(cls.tmp.name), db)
        cls.server = serve(db, "127.0.0.1", 0)
        cls.base = f"http://127.0.0.1:{cls.server.server_address[1]}"
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        try:
            cls.tmp.cleanup()
        except OSError:
            pass

    def get(self, path, method="GET"):
        request = urllib.request.Request(self.base + path, method=method)
        try:
            with urllib.request.urlopen(request) as response:
                return response.status, response.headers, json.load(response)
        except urllib.error.HTTPError as error:
            return error.code, error.headers, json.load(error)

    def test_search_contract(self):
        status, headers, body = self.get("/search?q=bitcoin&limit=1")
        self.assertEqual(status, 200)
        self.assertIn("application/json", headers["Content-Type"])
        self.assertEqual((body["total"], body["limit"], body["offset"]), (2, 1, 0))
        item = body["results"][0]
        for field in ("id", "kind", "name", "symbol", "sphere", "tier", "significance", "interest", "danger_flags", "origin"):
            self.assertIn(field, item)
        self.assertEqual(item["name"], "Bitcoin")

    def test_empty_result_and_facets(self):
        self.assertEqual(self.get("/search?q=zzzz")[2], {"total": 0, "limit": 20, "offset": 0, "results": []})
        self.assertIn("coin", self.get("/facets")[2]["kind"])
        self.assertEqual(self.get("/health")[2], {"status": "ok"})

    def test_errors(self):
        self.assertEqual(self.get("/search?limit=abc")[0], 400)
        self.assertEqual(self.get("/search?q=%21%21")[0], 400)
        self.assertEqual(self.get("/search?evil=1")[0], 400)
        self.assertEqual(self.get("/search?q=a&q=b")[0], 400)
        self.assertEqual(self.get("/nothing")[0], 404)
        status, headers, body = self.get("/search", method="POST")
        self.assertEqual((status, body["error"]), (405, "method_not_allowed"))

    def test_injection_over_http(self):
        status, _, body = self.get("/search?q=%22%3B+DROP+TABLE+assets%3B--")
        self.assertIn(status, (200, 400))
        self.assertEqual(self.get("/search")[2]["total"], 4)

    def test_default_bind_is_loopback(self):
        self.assertEqual(self.server.server_address[0], "127.0.0.1")
        from radar.api import server
        import inspect
        self.assertEqual(inspect.signature(server.serve).parameters["host"].default, "127.0.0.1")

    def test_missing_database_gives_503(self):
        missing = serve(Path(self.tmp.name) / "none.sqlite", "127.0.0.1", 0)
        threading.Thread(target=missing.serve_forever, daemon=True).start()
        self.addCleanup(missing.server_close)
        self.addCleanup(missing.shutdown)
        try:
            urllib.request.urlopen(f"http://127.0.0.1:{missing.server_address[1]}/search")
        except urllib.error.HTTPError as error:
            self.assertEqual(error.code, 503)
        else:
            self.fail("ожидался 503")


if __name__ == "__main__":
    unittest.main()
