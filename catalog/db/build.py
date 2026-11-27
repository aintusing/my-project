"""Импорт catalog/out/all_sources.csv в SQLite с полнотекстовым поиском (FTS5).

Запуск: python -m catalog.db.build [--csv PATH] [--db PATH]
База собирается во временный файл и атомарно заменяет старую: пересборка безопасна.
Пустая ячейка CSV = неизвестное значение (NULL), мы ничего не додумываем.
"""
import argparse
import csv
import os
import pathlib
import sqlite3
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
DEFAULT_CSV = ROOT / "catalog" / "out" / "all_sources.csv"
DEFAULT_DB = ROOT / "data" / "catalog.sqlite"
TEXT = ["kind", "name", "symbol", "category", "sphere", "tier", "classes", "danger_flags",
        "url", "x_handle", "feed_url", "extra", "origin"]
NUMBERS = ["significance", "interest"]
COLUMNS = TEXT + NUMBERS

SCHEMA = (
    "CREATE TABLE assets(id INTEGER PRIMARY KEY, "
    + ", ".join(c + " TEXT" for c in TEXT) + ", "
    + ", ".join(c + " INTEGER" for c in NUMBERS) + ");\n"
    "CREATE VIRTUAL TABLE assets_fts USING fts5(name, symbol, content='assets', content_rowid='id',"
    " tokenize='unicode61 remove_diacritics 2', prefix='2 3');\n"
    "CREATE INDEX assets_kind ON assets(kind);\n"
    "CREATE INDEX assets_sphere ON assets(sphere);\n"
)


class MissingInput(Exception):
    pass


def number(value):
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def build(csv_path=DEFAULT_CSV, db_path=DEFAULT_DB):
    """Возвращает число импортированных записей."""
    csv_path, db_path = pathlib.Path(csv_path), pathlib.Path(db_path)
    if not csv_path.is_file():
        raise MissingInput(f"нет файла {csv_path}; сначала: python catalog/build_catalog.py")
    db_path.parent.mkdir(parents=True, exist_ok=True)
    temp = db_path.with_name(db_path.name + ".tmp")
    temp.unlink(missing_ok=True)
    db = sqlite3.connect(temp)
    insert = f"INSERT INTO assets({','.join(COLUMNS)}) VALUES({','.join('?' * len(COLUMNS))})"
    try:
        db.executescript(SCHEMA)
        with open(csv_path, encoding="utf-8-sig", newline="") as handle, db:
            for row in csv.DictReader(handle):
                values = [(row.get(c) or "").strip() or None for c in TEXT]
                values += [number(row.get(c)) for c in NUMBERS]
                db.execute(insert, values)
            db.execute("INSERT INTO assets_fts(rowid, name, symbol) SELECT id, name, symbol FROM assets")
        count = db.execute("SELECT COUNT(*) FROM assets").fetchone()[0]
    except BaseException:
        db.close()
        temp.unlink(missing_ok=True)
        raise
    db.close()
    os.replace(temp, db_path)
    return count


def main(argv=None):
    parser = argparse.ArgumentParser(prog="catalog.db.build")
    parser.add_argument("--csv", default=str(DEFAULT_CSV))
    parser.add_argument("--db", default=str(DEFAULT_DB))
    args = parser.parse_args(argv)
    try:
        print(f"Импортировано записей: {build(args.csv, args.db)} -> {args.db}")
    except MissingInput as error:
        print(error, file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
