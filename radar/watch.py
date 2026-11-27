"""Цикл обновления: собрать, сохранить, проверить токены, перерисовать панель."""
import functools
import http.server
import os
import pathlib
import threading
import time

from . import dashboard, registry
from .agents import discovery, edgar, feeds, insiders, social
from .core import clean
from .scan import scan
from .store import Store, now

MIN_INTERVAL = 120


def read_watchlist(path):
    if not path.exists():
        return []
    lines = (line.split("#", 1)[0].strip() for line in path.read_text(encoding="utf-8-sig").splitlines())
    return [line for line in lines if line]


def _flag(rows):
    for row in rows:
        row["risk"] = bool(feeds.RISK_WORDS.search(row["title"]))
    return rows


def _gather(cycle):
    """Возвращает {вид: записи} и состояние источников."""
    data, status = {}, {}
    news, news_status = feeds.collect(limit=None)
    data["news"] = _flag(news)
    status.update(news_status)

    telegram, telegram_status = social.telegram()
    x_items, x_status = social.x_posts(offset=cycle * 3)
    data["social"] = _flag(telegram + x_items)
    status.update(telegram_status)
    status.update(x_status)

    def safe(name, job):
        try:
            rows = job()
            status[name] = f"ok ({len(rows)})"
            return rows
        except Exception as error:
            status[name] = clean(f"{type(error).__name__}: {error}", 120)
            return []

    data["hack"] = [
        {"source": "DefiLlama", "link": f"https://defillama.com/hacks#{h['date']}-{h['name'].replace(' ', '_')}",
         "title": f"{h['name']}: " + (f"${h['amount_usd']:,.0f}" if h["amount_usd"] else "сумма неизвестна")
                  + f" ({h['technique']})",
         "updated": h["date"], "risk": True}
        for h in safe("DefiLlama hacks", discovery.recent_hacks)]
    executives = [{"source": "SEC 8-K 5.02", "link": e["link"], "title": e["company"], "updated": e["updated"]}
                  for e in safe("SEC 8-K", edgar.executive_events)]
    form4 = [{"source": "SEC форма 4", "link": f["link"], "title": " | ".join(clean(p) for p in f["parties"]),
              "updated": f["updated"]} for f in safe("SEC форма 4", insiders.sec_form4)]
    data["sec"] = executives + form4

    trending = safe("GeckoTerminal trending", discovery.trending_pools)
    boosted = safe("DexScreener boosts", discovery.boosted)
    new = safe("GeckoTerminal new", discovery.new_pools)
    return data, status, [trending, new, boosted]


def pick_tokens(watchlist, lists, limit):
    """Сначала список пользователя, затем по очереди из каждого списка разведки."""
    chosen = list(dict.fromkeys(watchlist))
    queues = [[row["address"] for row in rows] for rows in lists]
    extra = []
    while any(queues) and len(extra) < limit:
        for queue in queues:
            while queue:
                address = queue.pop(0)
                if address not in chosen and address not in extra:
                    extra.append(address)
                    break
    return chosen + extra[:limit]


def cycle_once(store, folder, cycle, scan_limit, report=print):
    first = store.count() == 0
    data, status, lists = _gather(cycle)
    fresh_alerts = []
    for kind, rows in data.items():
        fresh_alerts += [r for r in store.add(kind, rows) if r.get("risk")]

    scanned = 0
    for address in pick_tokens(read_watchlist(folder / "watchlist.txt"), lists, scan_limit):
        try:
            result = scan(address)
        except Exception as error:
            status[f"scan {clean(address, 50)}"] = clean(f"{type(error).__name__}: {error}", 120)
            continue
        old = store.save_token(result)
        scanned += 1
        if old and old != result["level"]:
            report(f"ИЗМЕНЕНИЕ РИСКА {result['market'].get('symbol', '?')} {address}: {old} -> {result['level']}")
        time.sleep(1)  # бережём бесплатные квоты
    status["Проверка токенов"] = f"ok ({scanned})"
    store.prune()

    page = dashboard.render(store, registry.load(), status, now().isoformat(timespec="seconds")[:19].replace("T", " "))
    temporary = folder / "index.tmp"
    temporary.write_text(page, encoding="utf-8")
    os.replace(temporary, folder / "index.html")  # читатель не увидит половину файла

    if not first:
        for row in fresh_alerts[:15]:
            report(f"ТРЕВОГА [{row['source']}] {row['title']}\n    {row['link']}")
    ok = sum(v.startswith("ok") for v in status.values())
    report(f"[{time.strftime('%H:%M:%S')}] записей {store.count()}, токенов {scanned}, "
           f"новых тревог {len(fresh_alerts)}, источников ok {ok}/{len(status)}")
    return status


class _Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def serve(folder, port):
    """Только локально и только из папки панели."""
    handler = functools.partial(_Quiet, directory=str(folder))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", port), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server


def run(folder="data", every=300, scan_limit=12, once=False, port=None):
    folder = pathlib.Path(folder)
    folder.mkdir(parents=True, exist_ok=True)
    every = max(every, MIN_INTERVAL)
    store = Store(folder / "radar.db")
    if port:
        serve(folder, port)
        print(f"Панель: http://127.0.0.1:{port}/", flush=True)
    cycle = 0
    try:
        while True:
            started = time.monotonic()
            try:
                cycle_once(store, folder, cycle, scan_limit, lambda text: print(text, flush=True))
            except Exception as error:
                if once:
                    raise
                print(f"Цикл не удался: {type(error).__name__}: {error}", flush=True)
            if once:
                return
            cycle += 1
            time.sleep(max(10, every - (time.monotonic() - started)))
    except KeyboardInterrupt:
        print("Остановлено.")
    finally:
        store.close()
