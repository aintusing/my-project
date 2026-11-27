"""Хранилище SQLite: накапливает записи и помнит, когда увидел их впервые."""
import json
import sqlite3
from datetime import datetime, timedelta, timezone

KEEP_DAYS = 30


def now():
    return datetime.now(timezone.utc)


def to_utc(text):
    try:
        value = datetime.fromisoformat(str(text).replace("Z", "+00:00"))
    except ValueError:
        return ""
    if not value.tzinfo:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat(timespec="seconds")


class Store:
    def __init__(self, path):
        self.db = sqlite3.connect(path)
        self.db.executescript("""
            CREATE TABLE IF NOT EXISTS items(
              kind TEXT, link TEXT, source TEXT, title TEXT, published TEXT,
              first_seen TEXT, risk INTEGER, PRIMARY KEY(kind, link));
            CREATE TABLE IF NOT EXISTS tokens(
              address TEXT PRIMARY KEY, checked TEXT, level TEXT, report TEXT);
        """)

    def add(self, kind, rows):
        """rows: dict с ключами link, source, title, updated, risk. Возвращает только новые."""
        fresh, stamp = [], now()
        cutoff = (stamp - timedelta(days=KEEP_DAYS)).isoformat(timespec="seconds")
        with self.db:
            for row in rows:
                published = to_utc(row.get("updated")) or stamp.isoformat(timespec="seconds")
                if published < cutoff or not row.get("link"):
                    continue
                cursor = self.db.execute(
                    "INSERT OR IGNORE INTO items VALUES(?,?,?,?,?,?,?)",
                    (kind, row["link"], row["source"], row["title"], published,
                     stamp.isoformat(timespec="seconds"), int(bool(row.get("risk")))))
                if cursor.rowcount:
                    fresh.append(row)
        return fresh

    def items(self, kind=None, risk=False, limit=150):
        clauses, values = [], []
        if kind:
            clauses.append("kind=?")
            values.append(kind)
        if risk:
            clauses.append("risk=1")
        where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
        cursor = self.db.execute(
            f"SELECT kind, link, source, title, published FROM items {where} "
            "ORDER BY published DESC LIMIT ?", (*values, limit))
        keys = ("kind", "link", "source", "title", "published")
        return [dict(zip(keys, row)) for row in cursor]

    def count(self):
        return self.db.execute("SELECT COUNT(*) FROM items").fetchone()[0]

    def save_token(self, report):
        """Возвращает прежний уровень риска (None, если токен новый)."""
        old = self.db.execute("SELECT level FROM tokens WHERE address=?", (report["address"],)).fetchone()
        with self.db:
            self.db.execute("INSERT OR REPLACE INTO tokens VALUES(?,?,?,?)",
                            (report["address"], now().isoformat(timespec="seconds"), report["level"],
                             json.dumps(report, ensure_ascii=False)))
        return old[0] if old else None

    def tokens(self, limit=60):
        cursor = self.db.execute("SELECT checked, report FROM tokens ORDER BY checked DESC LIMIT ?", (limit,))
        return [{**json.loads(report), "checked": checked} for checked, report in cursor]

    def prune(self):
        cutoff = (now() - timedelta(days=KEEP_DAYS)).isoformat(timespec="seconds")
        with self.db:
            self.db.execute("DELETE FROM items WHERE published < ?", (cutoff,))
            self.db.execute("DELETE FROM tokens WHERE checked < ?", (cutoff,))

    def close(self):
        self.db.close()
