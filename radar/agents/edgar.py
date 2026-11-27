"""Агент руководителей: свежие 8-K с Item 5.02 из SEC EDGAR."""
from ..core import clean, fetch, sec_user_agent
from .feeds import parse_feed


def current_filings(form, owner="include", count=100):
    url = ("https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent"
           f"&type={form}&owner={owner}&count={count}&output=atom")
    return parse_feed(fetch(url, sec_user_agent()))


def executive_events(limit=20):
    """Item 5.02 объединяет уходы, назначения и вознаграждения.
    Тип события и роль здесь не определяются: это работа ИИ-агента по тексту подачи."""
    events, seen = [], set()
    for entry in current_filings("8-K"):
        if "Item 5.02" not in entry["summary"] or entry["id"] in seen:
            continue
        seen.add(entry["id"])
        events.append({"company": clean(entry["title"]), "updated": entry["updated"], "link": entry["link"]})
    return events[:limit]
