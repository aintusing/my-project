"""Агент новостей: RSS и Atom изданий, регуляторов и разборов взломов."""
import concurrent.futures as cf
import html
import re
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime
from datetime import datetime, timezone

from .. import registry
from ..core import clean, fetch, sec_user_agent

FEEDS = {feed["name"]: feed["url"] for feed in registry.load()["feeds"]}

RISK_WORDS = re.compile(
    r"\b(rug ?pulls?|rugged|exploit\w*|hack\w*|drain\w*|scam\w*|fraud\w*|honeypot|phishing|"
    r"stolen|theft|laundering|insider trading|charges|indict\w*|lawsuit)\b"
    r"|взлом\w*|скам\w*|мошенни\w*|похит\w*|украл\w*|эксплойт\w*|рагпул\w*", re.IGNORECASE)


def _name(tag):
    return tag.rsplit("}", 1)[-1]


def _parse_date(text):
    if not text:
        return None
    try:
        value = datetime.fromisoformat(text.strip().replace("Z", "+00:00"))
    except ValueError:
        try:
            value = parsedate_to_datetime(text.strip())
        except (TypeError, ValueError):
            return None
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def parse_feed(body):
    # Внешний XML с объявлениями сущностей не разбираем.
    if b"<!ENTITY" in body:
        raise ValueError("XML с ENTITY отклонён")
    entries = []
    for node in ET.fromstring(body.strip()).iter():
        if _name(node.tag) not in ("item", "entry"):
            continue
        fields = {}
        for child in node:
            key = _name(child.tag)
            if key == "link":
                fields.setdefault("link", child.get("href") or (child.text or ""))
            elif key == "category":
                fields.setdefault("form", child.get("term") or "")
            else:
                fields.setdefault(key, child.text or "")
        summary = fields.get("summary") or fields.get("description") or ""
        raw_date = fields.get("pubDate") or fields.get("updated") or fields.get("published") or fields.get("date")
        date = _parse_date(raw_date)
        entries.append({
            "title": clean(html.unescape(fields.get("title", "")), 220),
            "link": clean(fields.get("link"), 300),
            "summary": clean(re.sub(r"<[^>]+>", " ", html.unescape(summary)), 600),
            "updated": date.astimezone(timezone.utc).isoformat() if date else "",
            "id": fields.get("id") or fields.get("guid") or fields.get("link", ""),
            "form": fields.get("form", ""),
        })
    return entries


def _load(item):
    name, url = item
    try:
        agent = sec_user_agent() if "sec.gov" in url else None
        return name, parse_feed(fetch(url, agent)), None
    except Exception as error:  # один сломанный источник не должен ронять остальные
        return name, [], clean(f"{type(error).__name__}: {error}", 120)


def collect(query=None, risk_only=False, limit=30):
    items, status = [], {}
    with cf.ThreadPoolExecutor(8) as pool:
        for name, entries, error in pool.map(_load, FEEDS.items()):
            status[name] = error or f"ok ({len(entries)})"
            items.extend({**entry, "source": name} for entry in entries)
    if query:
        pattern = re.compile(rf"(?<!\w){re.escape(query)}(?!\w)", re.IGNORECASE)
        items = [i for i in items if pattern.search(f"{i['title']} {i['summary']}")]
    if risk_only:
        items = [i for i in items if RISK_WORDS.search(i["title"])]
    items.sort(key=lambda i: i["updated"], reverse=True)
    return items[:limit], status
