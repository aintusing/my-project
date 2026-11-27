"""Каталог источников из открытых реестров с оценками. Запуск: python catalog/build_catalog.py

Оценки — эвристики для сортировки, на исходах не проверялись.
significance: размер и заметность. interest: насколько сейчас движется.
danger_flags: конкретные признаки, а не приговор.
"""
import csv
import http.client
import json
import math
import pathlib
import time
import urllib.error
import urllib.request

from spheres import sphere_of

OUT = pathlib.Path(__file__).parent / "out"
UA = {"User-Agent": "radar-catalog/0.1"}
FIELDS = ["kind", "name", "symbol", "category", "sphere", "tier", "significance", "interest", "classes",
          "danger_flags", "url", "x_handle", "feed_url", "extra", "origin"]
STATUS = {}


def get(url, tries=5):
    for attempt in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90) as response:
                return response.read()
        except urllib.error.HTTPError as error:
            if error.code != 429 or attempt == tries - 1:
                raise
            time.sleep(30 * (attempt + 1))
        except (urllib.error.URLError, http.client.IncompleteRead, TimeoutError):
            if attempt == tries - 1:
                raise
            time.sleep(5)


def get_json(url):
    return json.loads(get(url))


def attempt(name, job):
    try:
        result = job()
        STATUS[name] = f"ok ({len(result)})"
        return result
    except Exception as error:
        STATUS[name] = f"ОШИБКА {type(error).__name__}: {error}"
        return []


def clamp(value):
    return max(0, min(100, round(value)))


def by_rank(position, total):
    return clamp(100 * (1 - math.log(position) / math.log(total + 1)))


def row(kind, name, significance, interest=0, flags=(), **extra):
    classes = []
    if interest >= 60:
        classes.append("интересные")
    if flags:
        classes.append("опасные")
    result = dict.fromkeys(FIELDS, "")
    result.update(kind=kind, name=name, significance=significance, interest=interest,
                  classes="|".join(classes or ["прочие"]), danger_flags="|".join(flags), **extra)
    return result


def assign_tiers(rows):
    """Уровень внутри своего набора: S — верхний 1%, A — до 10%, B — до 30%, C — остальные."""
    ordered = sorted(rows, key=lambda r: (r["significance"], r["interest"]), reverse=True)
    for position, item in enumerate(ordered):
        share = position / len(ordered)
        item["tier"] = "S" if share < 0.01 else "A" if share < 0.10 else "B" if share < 0.30 else "C"
        if item["tier"] in ("S", "A"):
            classes = [c for c in item["classes"].split("|") if c != "прочие"]
            item["classes"] = "|".join(["значимые"] + classes)
    return ordered


def safe_cell(value):
    # Внешняя строка не должна стать формулой в Excel.
    text = " ".join(str(value if value is not None else "").split())
    return "'" + text if text[:1] in ("=", "+", "-", "@") else text


def write(name, rows, fields=FIELDS):
    with open(OUT / name, "w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for item in rows:
            writer.writerow({k: safe_cell(item.get(k)) for k in fields})


def coins():
    base = ("https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc"
            "&per_page=250&price_change_percentage=7d")

    def pages(extra, count, label):
        found = []
        for page in range(1, count + 1):
            part = attempt(f"CoinGecko {label} стр. {page}", lambda: get_json(f"{base}{extra}&page={page}"))
            found += part
            time.sleep(15)  # бесплатный лимит маленький
        return found

    memes = pages("&category=meme-token", 4, "мемкоины")
    market = pages("", 8, "рынок")
    meme_ids = {c["id"] for c in memes}
    unique = {c["id"]: c for c in market + memes}
    ordered = sorted(unique.values(), key=lambda c: c.get("market_cap") or 0, reverse=True)
    rows = []
    for position, coin in enumerate(ordered, 1):
        cap = coin.get("market_cap") or 0
        volume = coin.get("total_volume") or 0
        diluted = coin.get("fully_diluted_valuation") or 0
        week = coin.get("price_change_percentage_7d_in_currency")
        turnover = volume / cap if cap else None
        flags = []
        if turnover is not None and turnover < 0.001:
            flags.append("почти нет объёма")
        if turnover is not None and turnover > 1:
            flags.append("объём выше капитализации")
        if cap and diluted / cap > 5:
            flags.append("большое будущее размытие")
        if week is not None and week <= -40:
            flags.append("обвал за 7д")
        if week is not None and week >= 100:
            flags.append("рост более 100% за 7д")
        significance = clamp(0.6 * by_rank(position, len(ordered))
                             + 0.4 * max(0, math.log10(volume + 1) - 3) / 7 * 100)
        interest = clamp(abs(week or 0) * 1.5 + min(turnover or 0, 1) * 60)
        rows.append(row("coin", coin.get("name"), significance, interest, flags,
                        symbol=(coin.get("symbol") or "").upper(),
                        category="мемкоин" if coin["id"] in meme_ids else "монета",
                        url=f"https://www.coingecko.com/en/coins/{coin['id']}",
                        extra=f"mcap={cap}; vol24h={volume}; 7d={week}", origin="CoinGecko"))
    return rows


def protocols(hacks):
    data = attempt("DefiLlama протоколы", lambda: get_json("https://api.llama.fi/protocols"))
    hacked = {str(h.get("defillamaId")) for h in hacks if h.get("defillamaId")}
    top = max((p.get("tvl") or 0 for p in data), default=1)
    rows = []
    for item in data:
        tvl = item.get("tvl") or 0
        week = item.get("change_7d")
        flags = []
        if str(item.get("id")) in hacked:
            flags.append("был взлом")
        if str(item.get("audits") or "0") == "0" and item.get("category") != "CEX":
            flags.append("аудит не указан")
        if item.get("category") in ("Ponzi", "Volume Boosting"):
            flags.append("категория " + item["category"])
        if week is not None and week <= -30:
            flags.append("отток TVL за 7д")
        if item.get("listedAt") and time.time() - item["listedAt"] < 30 * 86400:
            flags.append("новый проект")
        significance = clamp(100 * (math.log10(max(tvl, 1)) - 3) / (math.log10(max(top, 10_000)) - 3))
        interest = clamp(abs(week or 0) * 2)
        handle = item.get("twitter") or ""
        rows.append(row("project", item.get("name"), significance, interest, flags,
                        symbol=item.get("symbol"), category=item.get("category"),
                        url=item.get("url"), x_handle=handle,
                        extra=f"tvl={round(tvl)}; 7d={week}", origin="DefiLlama"))
    return rows


def stocks():
    def listed():
        data = get_json("https://www.sec.gov/files/company_tickers_exchange.json")
        return [dict(zip(data["fields"], values)) for values in data["data"]]

    def nasdaq():
        lines = get("https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt").decode("utf-8").splitlines()
        header = lines[0].split("|")
        return [dict(zip(header, line.split("|"))) for line in lines[1:] if line.count("|") == len(header) - 1]

    companies = attempt("SEC список компаний", listed)
    status = {r["Symbol"]: r for r in attempt("Nasdaq справочник", nasdaq)}
    meaning = {"D": "не соответствует требованиям биржи", "E": "просрочил отчётность", "Q": "банкротство",
               "G": "нарушения и банкротство", "H": "нарушения и просрочка", "J": "просрочка и банкротство",
               "K": "нарушения, просрочка и банкротство"}
    seen, unique = set(), []
    for company in companies:
        if company["cik"] not in seen:  # несколько тикеров одной компании
            seen.add(company["cik"])
            unique.append(company)
    rows = []
    for position, company in enumerate(unique, 1):
        info = status.get(company["ticker"], {})
        flags = []
        if info.get("Financial Status") in meaning:
            flags.append(meaning[info["Financial Status"]])
        if company.get("exchange") == "OTC":
            flags.append("внебиржевая торговля")
        cik = f"{company['cik']:010d}"
        browse = f"https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={cik}"
        rows.append(row("stock", company["name"], by_rank(position, len(unique)), 0, flags,
                        symbol=company["ticker"], category=company.get("exchange") or "не указана",
                        url=browse, feed_url=f"{browse}&type=8-K&output=atom",
                        extra=f"форма 4: {browse}&type=4&owner=only&output=atom", origin="SEC + Nasdaq"))
    return rows


def exchanges():
    data = attempt("CoinGecko биржи", lambda: get_json("https://api.coingecko.com/api/v3/exchanges?per_page=250"))
    rows = []
    for item in data:
        trust = item.get("trust_score")
        flags = ["низкий trust score"] if trust is not None and trust <= 4 else []
        rows.append(row("exchange", item.get("name"), clamp((trust or 0) * 10), 0, flags,
                        category=item.get("country"), url=item.get("url"),
                        extra=f"trust={trust}; vol_btc={item.get('trade_volume_24h_btc')}", origin="CoinGecko"))
    return rows


def media():
    registry = json.loads((OUT.parents[1] / "radar" / "sources.json").read_text(encoding="utf-8"))
    rows = []
    for feed in registry["feeds"]:
        rows.append(row("feed", feed["name"], 70 if feed["group"] == "Регуляторы" else 55,
                        category=feed["group"], url=feed["url"], feed_url=feed["url"], origin="ручной реестр"))
    for channel in registry["telegram"]:
        url = f"https://t.me/s/{channel['channel']}"
        rows.append(row("telegram", channel["name"], 50, flags=["официальность не проверена"],
                        url=url, feed_url=url, origin="ручной реестр"))
    for account in registry["x_accounts"]:
        rows.append(row("x_account", account["name"], 50, flags=["аккаунт не сверен"],
                        category=account["group"], x_handle=account["handle"],
                        url=f"https://x.com/{account['handle']}", origin="память модели"))
    return rows


def threats(hacks):
    """Индикаторы угроз. Это не источники: эти адреса нельзя открывать."""
    found = {}

    def add(kind, value, origin):
        key = (kind, str(value).strip().lower())
        if key[1]:
            found.setdefault(key, set()).add(origin)

    raw = "https://raw.githubusercontent.com/"
    metamask = attempt("MetaMask фишинг", lambda: get_json(
        raw + "MetaMask/eth-phishing-detect/main/src/config.json").get("blacklist", []))
    for domain in metamask:
        add("domain", domain, "MetaMask")
    for domain in attempt("ScamSniffer домены", lambda: get_json(
            raw + "scamsniffer/scam-database/main/blacklist/domains.json")):
        add("domain", domain, "ScamSniffer")
    for address in attempt("ScamSniffer адреса", lambda: get_json(
            raw + "scamsniffer/scam-database/main/blacklist/address.json")):
        add("evm_address", address, "ScamSniffer")
    for address in attempt("OFAC ETH", lambda: get(
            raw + "0xB10C/ofac-sanctioned-digital-currency-addresses/lists/sanctioned_addresses_ETH.txt"
    ).decode("utf-8").split()):
        add("evm_address", address, "OFAC (копия 0xB10C)")
    write("threat_indicators.csv",
          [{"type": k, "value": v, "origins": "|".join(sorted(o)), "lists": len(o)}
           for (k, v), o in sorted(found.items())], ["type", "value", "origins", "lists"])
    write("hacks.csv",
          [{"date": time.strftime("%Y-%m-%d", time.gmtime(h["date"])), "name": h.get("name"),
            "amount_usd": h.get("amount"), "technique": h.get("technique"), "source": h.get("source")}
           for h in sorted(hacks, key=lambda h: h.get("date") or 0, reverse=True) if h.get("date")],
          ["date", "name", "amount_usd", "technique", "source"])
    return len(found)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    hacks = attempt("DefiLlama взломы", lambda: get_json("https://api.llama.fi/hacks"))
    groups = {"stocks": stocks(), "projects": protocols(hacks), "exchanges": exchanges(),
              "media": media(), "coins": coins()}
    everything = []
    for name, rows in groups.items():
        for item in rows:
            item["sphere"] = sphere_of(item)
        rows = groups[name] = assign_tiers(rows)
        write(f"{name}.csv", rows)
        everything += rows
    write("all_sources.csv", sorted(everything, key=lambda r: r["significance"], reverse=True))
    indicators = threats(hacks)

    spheres = {}
    for item in everything:
        spheres.setdefault(item["sphere"], []).append(item)
    folder = OUT / "by_sphere"
    folder.mkdir(exist_ok=True)
    for name, rows in spheres.items():
        rows.sort(key=lambda r: (r["significance"], r["interest"]), reverse=True)
        write(f"by_sphere/{name.replace(': ', ' - ')}.csv", rows)

    lines = ["# Каталог источников", "",
             f"Собрано {time.strftime('%Y-%m-%d %H:%M UTC', time.gmtime())}. "
             "Оценки — эвристики, на исходах не проверялись.", "",
             "| Набор | Записей | Значимые | Интересные | С флагами опасности | С X-аккаунтом |",
             "|---|---|---|---|---|---|"]
    for name, rows in list(groups.items()) + [("ВСЕГО", everything)]:
        lines.append("| {} | {} | {} | {} | {} | {} |".format(
            name, len(rows), sum("значимые" in r["classes"] for r in rows),
            sum("интересные" in r["classes"] for r in rows),
            sum(bool(r["danger_flags"]) for r in rows), sum(bool(r["x_handle"]) for r in rows)))
    breakdown = ["", "## Сферы", "", "| Сфера | Записей | Значимые | Интересные | Опасные |", "|---|---|---|---|---|"]
    for name, rows in sorted(spheres.items(), key=lambda t: -len(t[1])):
        breakdown.append("| {} | {} | {} | {} | {} |".format(
            name, len(rows), sum("значимые" in r["classes"] for r in rows),
            sum("интересные" in r["classes"] for r in rows), sum(bool(r["danger_flags"]) for r in rows)))
    lines += breakdown + ["", "Сфера акций определена по словам в названии компании и часто неточна."]
    lines += ["", f"Отдельно: {indicators} индикаторов угроз в `threat_indicators.csv` "
                  f"(это не источники, эти адреса не открывать), {len(hacks)} взломов в `hacks.csv`."]
    for title, rows, key in (
            ("Мемкоины: самые значимые", [r for r in groups["coins"] if r["category"] == "мемкоин"], "significance"),
            ("Монеты: самые интересные", groups["coins"], "interest"),
            ("Крупные проекты с флагами", [r for r in groups["projects"] if r["danger_flags"]], "significance")):
        lines += ["", f"## {title}", "", "| Название | Значимость | Интерес | Флаги |", "|---|---|---|---|"]
        for r in sorted(rows, key=lambda r: r[key], reverse=True)[:15]:
            name = str(r["name"]).replace("|", " ")[:50]
            lines.append(f"| {name} | {r['significance']} | {r['interest']} | {r['danger_flags'].replace('|', ', ')} |")
    lines += ["", "## Состояние сбора", ""] + [f"- {k}: {v}" for k, v in STATUS.items()]
    (OUT / "SUMMARY.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
