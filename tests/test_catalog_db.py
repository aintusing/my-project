import csv
import pathlib
import sqlite3
import tempfile
import unittest

from catalog.db.build import COLUMNS, MissingInput, build
from radar.api.search import BadRequest, facets, search

ROWS = [
    {"kind": "coin", "name": "Bitcoin", "symbol": "BTC", "sphere": "Монеты", "tier": "S", "significance": "99",
     "interest": "5", "danger_flags": "", "origin": "coingecko"},
    {"kind": "coin", "name": "Bitcoin Cash", "symbol": "BCH", "sphere": "Монеты", "tier": "A", "significance": "70",
     "interest": "", "danger_flags": "no-audit|anon-team", "origin": "coingecko"},
    {"kind": "stock", "name": "Apple Inc.", "symbol": "AAPL", "sphere": "Акции: Технологии и ИИ", "tier": "S",
     "significance": "95", "origin": "sec"},
    {"kind": "project", "name": "Evil'; DROP TABLE assets;--", "symbol": "EVIL", "sphere": "Мемы", "tier": "C",
     "significance": "1", "origin": "defillama"},
]


def make_csv(folder, rows=ROWS, name="all_sources.csv"):
    path = pathlib.Path(folder) / name
    with open(path, "w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=COLUMNS)
        writer.writeheader()
        writer.writerows(rows)
    return path


class CatalogDbTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.csv = make_csv(self.tmp.name)
        self.path = pathlib.Path(self.tmp.name) / "catalog.sqlite"
        self.assertEqual(build(self.csv, self.path), len(ROWS))
        self.db = sqlite3.connect(self.path)
        self.addCleanup(self.db.close)

    def names(self, **params):
        return [r["name"] for r in search(self.db, params)["results"]]

    def test_search_by_name_and_symbol(self):
        self.assertEqual(self.names(q="bitcoin"), ["Bitcoin", "Bitcoin Cash"])
        self.assertEqual(self.names(q="AAPL"), ["Apple Inc."])
        self.assertEqual(self.names(q="bit")[0], "Bitcoin")  # префикс

    def test_unknown_stays_unknown(self):
        item = search(self.db, {"q": "bitcoin cash"})["results"][0]
        self.assertIsNone(item["interest"])
        self.assertEqual(item["danger_flags"], ["no-audit", "anon-team"])
        self.assertEqual(search(self.db, {"q": "apple"})["results"][0]["danger_flags"], [])
        self.assertIsNone(search(self.db, {"q": "apple"})["results"][0]["url"])

    def test_filters_and_pagination(self):
        self.assertEqual(self.names(kind="stock"), ["Apple Inc."])
        self.assertEqual(self.names(flagged="1"), ["Bitcoin Cash"])
        self.assertEqual(self.names(min_significance="90"), ["Bitcoin", "Apple Inc."])
        page = search(self.db, {"limit": "1", "offset": "1"})
        self.assertEqual((page["total"], len(page["results"])), (4, 1))
        self.assertEqual(facets(self.db)["kind"], ["coin", "project", "stock"])

    def test_empty_and_invalid_input(self):
        self.assertEqual(search(self.db, {"q": "zzzzz"})["results"], [])
        for bad in ({"q": "!!!"}, {"limit": "0"}, {"limit": "x"}, {"limit": "101"}, {"offset": "-1"},
                    {"flagged": "2"}, {"min_significance": "abc"}, {"q": "a" * 101}):
            with self.assertRaises(BadRequest, msg=bad):
                search(self.db, bad)

    def test_sql_injection_is_inert(self):
        for text in ("x' OR '1'='1", '"; DROP TABLE assets; --', "name:* OR NEAR(", "a\" OR \"b"):
            try:
                search(self.db, {"q": text})
            except BadRequest:
                pass
            self.assertEqual(self.db.execute("SELECT COUNT(*) FROM assets").fetchone()[0], len(ROWS))
        self.assertEqual(self.names(kind="coin' OR '1'='1"), [])
        self.assertEqual(self.names(q="evil"), ["Evil'; DROP TABLE assets;--"])

    def test_rebuild_replaces_and_missing_input(self):
        self.db.close()  # Windows не даёт заменить файл, открытый другим соединением
        make_csv(self.tmp.name, ROWS[:1])
        self.assertEqual(build(self.csv, self.path), 1)
        with self.assertRaises(MissingInput):
            build(pathlib.Path(self.tmp.name) / "nope.csv", self.path)
        db = sqlite3.connect(self.path)
        self.addCleanup(db.close)
        self.assertEqual(db.execute("SELECT COUNT(*) FROM assets").fetchone()[0], 1)
        self.assertFalse(self.path.with_name("catalog.sqlite.tmp").exists())


if __name__ == "__main__":
    unittest.main()
