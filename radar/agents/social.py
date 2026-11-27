"""Агент соцсетей: публичные каналы Telegram и, при наличии токена, X API."""
import concurrent.futures as cf
import html
import json
import os
import re
import urllib.parse
import urllib.request

from .. import registry
from ..core import TIMEOUT, clean, fetch

TEXT = re.compile(r'<div class="tgme_widget_message_text[^"]*"[^>]*>(.*?)</div>', re.DOTALL)
TIME = re.compile(r'<time datetime="([^"]+)"')
POST = re.compile(r'data-post="([A-Za-z0-9_]+/\d+)"')


def parse_telegram(page, name):
    posts = []
    marks = list(POST.finditer(page))
    for index, mark in enumerate(marks):
        end = marks[index + 1].start() if index + 1 < len(marks) else len(page)
        block = page[mark.start():end]
        texts = TEXT.findall(block)
        times = TIME.findall(block)
        if not texts or not times:
            continue
        # Последний блок текста — сам пост, предыдущие бывают цитатой ответа.
        body = re.sub(r"<br\s*/?>", " ", texts[-1])
        body = clean(html.unescape(re.sub(r"<[^>]+>", "", body)), 400)
        posts.append({"source": name, "title": body, "summary": "", "updated": times[-1],
                      "link": f"https://t.me/{mark.group(1)}"})
    return posts


def _channel(item):
    try:
        page = fetch(f"https://t.me/s/{item['channel']}").decode("utf-8", "replace")
        posts = parse_telegram(page, item["name"])
        return item["name"], posts, f"ok ({len(posts)})" if posts else "нет сообщений"
    except Exception as error:
        return item["name"], [], clean(f"{type(error).__name__}: {error}", 120)


def telegram():
    items, status = [], {}
    with cf.ThreadPoolExecutor(4) as pool:
        for name, posts, state in pool.map(_channel, registry.load()["telegram"]):
            items.extend(posts)
            status[f"TG {name}"] = state
    return items, status


def _queries(handles, limit=480):
    """X ограничивает длину запроса, поэтому аккаунты делятся на пачки."""
    batch = []
    for handle in handles:
        candidate = batch + [f"from:{handle}"]
        if batch and len(" OR ".join(candidate)) > limit:
            yield " OR ".join(batch)
            candidate = [f"from:{handle}"]
        batch = candidate
    if batch:
        yield " OR ".join(batch)


def x_posts(max_queries=3, offset=0):
    """Официальный API X (платный). Без X_BEARER_TOKEN ничего не запрашивает.
    За цикл берёт max_queries пачек по кругу, чтобы не сжечь квоту."""
    token = os.environ.get("X_BEARER_TOKEN")
    if not token:
        return [], {"X": "не подключён: нет X_BEARER_TOKEN"}
    queries = list(_queries([a["handle"] for a in registry.load()["x_accounts"]]))
    picked = [queries[(offset + i) % len(queries)] for i in range(min(max_queries, len(queries)))]
    items = []
    try:
        for query in picked:
            params = urllib.parse.urlencode({
                "query": query, "max_results": 50, "tweet.fields": "created_at",
                "expansions": "author_id", "user.fields": "username"})
            request = urllib.request.Request(
                f"https://api.x.com/2/tweets/search/recent?{params}",
                headers={"Authorization": f"Bearer {token}", "User-Agent": "radar-prototype/0.1"})
            with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
                data = json.load(response)
            users = {u["id"]: u["username"] for u in (data.get("includes") or {}).get("users", [])}
            for tweet in data.get("data") or []:
                user = users.get(tweet.get("author_id"), "unknown")
                items.append({"source": f"X @{clean(user, 30)}", "title": clean(tweet.get("text"), 400),
                              "summary": "", "updated": tweet.get("created_at", ""),
                              "link": f"https://x.com/{clean(user, 30)}/status/{clean(tweet.get('id'), 30)}"})
    except Exception as error:
        return items, {"X": clean(f"{type(error).__name__}: {error}", 120)}
    return items, {"X": f"ok ({len(items)})"}
