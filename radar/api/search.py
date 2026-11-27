"""Поиск по SQLite-индексу каталога. Все значения передаются параметрами, не в текст SQL."""
import re
import sqlite3

MAX_LIMIT = 100
MAX_QUERY = 100
FIELDS = ["id", "kind", "name", "symbol", "category", "sphere", "tier", "significance", "interest",
          "classes", "danger_flags", "url", "x_handle", "feed_url", "extra", "origin"]
LISTS = ("classes", "danger_flags")
EXACT = ("kind", "sphere", "tier", "origin")


class BadRequest(ValueError):
    pass


def fts_query(text):
    """Безопасный FTS5-запрос: каждое слово в кавычках, у последнего префиксный поиск."""
    words = re.findall(r"\w+", text)
    if not words:
        raise BadRequest("q: нужен хотя бы один буквенно-цифровой символ")
    return " ".join(f'"{w}"' for w in words[:-1]) + (" " if words[:-1] else "") + f'"{words[-1]}"*'


def integer(value, name, low, high, default):
    if value in (None, ""):
        return default
    try:
        number = int(value)
    except ValueError:
        raise BadRequest(f"{name}: нужно целое число") from None
    if not low <= number <= high:
        raise BadRequest(f"{name}: допустимо {low}..{high}")
    return number


def search(db, params):
    """params: dict строк. Возвращает {'total', 'limit', 'offset', 'results'}."""
    query = (params.get("q") or "").strip()
    if len(query) > MAX_QUERY:
        raise BadRequest(f"q: не длиннее {MAX_QUERY} символов")
    limit = integer(params.get("limit"), "limit", 1, MAX_LIMIT, 20)
    offset = integer(params.get("offset"), "offset", 0, 1_000_000, 0)
    where, args, join = [], [], ""
    if query:
        join = "JOIN assets_fts ON assets_fts.rowid = a.id"
        where.append("assets_fts MATCH ?")
        args.append(fts_query(query))
    for name in EXACT:
        if params.get(name):
            where.append(f"a.{name} = ?")
            args.append(params[name])
    if params.get("min_significance") not in (None, ""):
        where.append("a.significance >= ?")
        args.append(integer(params["min_significance"], "min_significance", 0, 100, 0))
    if params.get("flagged") not in (None, ""):
        if params["flagged"] not in ("0", "1"):
            raise BadRequest("flagged: 0 или 1")
        where.append("a.danger_flags IS NOT NULL" if params["flagged"] == "1" else "a.danger_flags IS NULL")
    clause = ("WHERE " + " AND ".join(where)) if where else ""
    order = "ORDER BY bm25(assets_fts), a.significance DESC, a.id" if query else "ORDER BY a.significance DESC, a.id"
    try:
        total = db.execute(f"SELECT COUNT(*) FROM assets a {join} {clause}", args).fetchone()[0]
        rows = db.execute(f"SELECT {', '.join('a.' + f for f in FIELDS)} FROM assets a {join} {clause} "
                          f"{order} LIMIT ? OFFSET ?", args + [limit, offset]).fetchall()
    except sqlite3.OperationalError as error:
        raise BadRequest(f"q: запрос не принят ({error})") from None
    results = []
    for row in rows:
        item = dict(zip(FIELDS, row))
        for name in LISTS:
            item[name] = item[name].split("|") if item[name] else []
        results.append(item)
    return {"total": total, "limit": limit, "offset": offset, "results": results}


def facets(db):
    return {name: [r[0] for r in db.execute(f"SELECT DISTINCT {name} FROM assets WHERE {name} IS NOT NULL ORDER BY 1")]
            for name in EXACT}
