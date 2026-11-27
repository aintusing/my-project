#!/usr/bin/env python3
"""Build graph/fixtures/sources.js: source registry + one headline snapshot.

Reads the registry as text/JSON only (never runs the vendor code), fetches each
feed once with the stdlib, and writes a URL-free ES module.

  py -3.12 -I build_sources.py --raw <new empty dir>           fetch and build
  py -3.12 -I build_sources.py --raw <existing dir> --offline  rebuild from raw

Feed content is untrusted data: it is only parsed, never executed or followed.
"""
import argparse
import collections
import concurrent.futures as cf
import datetime as dt
import gzip
import html
import http.client
import io
import ipaddress
import json
import pathlib
import re
import socket
import ssl
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
import zlib
from email.utils import parsedate_to_datetime

GRAPH = pathlib.Path(__file__).resolve().parents[1]
PROJECT = GRAPH.parent
VENDOR = PROJECT.parent / "vendor" / "worldmonitor"
UA = "radar-prototype/0.1"
TIMEOUT = 15
CAP = 5 * 1024 * 1024
MAX_BYTES = 1_500_000
PER_SOURCE, MAX_HEADLINES, MAX_AGE_DAYS = 8, 4000, 30

# category id -> Russian label; the order here is the output order.
LABELS = {
    "politics": "Мировая политика", "us": "США", "europe": "Европа",
    "middleeast": "Ближний Восток", "africa": "Африка", "latam": "Латинская Америка",
    "asia": "Азия и Тихий океан", "intel": "Разведка и безопасность",
    "crisis": "Кризисы", "advisories": "Предупреждения для путешественников",
    "gov": "Государственные органы", "thinktanks": "Аналитические центры",
    "policy": "Технологическая политика", "security": "Кибербезопасность",
    "energy": "Энергетика", "climate": "Климат", "science": "Наука",
    "health": "Здравоохранение", "nature": "Природа", "finance": "Финансы",
    "markets": "Рынки", "forex": "Валютный рынок", "bonds": "Облигации",
    "commodities": "Сырьевые товары", "commodity-news": "Новости сырьевых рынков",
    "gold-silver": "Золото и серебро", "base-metals": "Промышленные металлы",
    "critical-minerals": "Критические минералы", "mining-news": "Горнодобыча",
    "mining-companies": "Горнодобывающие компании",
    "commodity-regulation": "Регулирование сырьевого сектора",
    "supply-chain": "Цепочки поставок", "aviation": "Авиация", "crypto": "Криптовалюты",
    "centralbanks": "Центробанки", "economic": "Экономика", "derivatives": "Деривативы",
    "fintech": "Финтех", "fin-regulation": "Финансовое регулирование",
    "regulation": "Действия регуляторов", "institutional": "Институциональные инвесторы",
    "analysis": "Аналитика рынков", "ipo": "IPO", "gccNews": "Страны Залива",
    "nq-news": "Индекс Nasdaq-100", "tech": "Технологии", "ai": "Искусственный интеллект",
    "hardware": "Оборудование и чипы", "cloud": "Облака", "dev": "Разработка",
    "github": "Открытый код", "producthunt": "Новые продукты", "outages": "Сбои сервисов",
    "startups": "Стартапы", "vcblogs": "Венчурные блоги",
    "regionalStartups": "Региональные стартапы", "funding": "Инвестиционные раунды",
    "unicorns": "Единороги", "accelerators": "Акселераторы", "layoffs": "Увольнения",
    "podcasts": "Подкасты", "live-news": "Срочные новости", "positive": "Позитивные новости",
    "inspiring": "Вдохновляющее", "community": "Сообщество",
}

# Other literal feed catalogs in the vendor repo: (file, category).
EXTRA = [
    ("scripts/seed-security-advisories.mjs", "advisories"),
    ("scripts/seed-regulatory-actions.mjs", "regulation"),
    ("scripts/seed-climate-news.mjs", "climate"),
    ("scripts/seed-energy-intelligence.mjs", "energy"),
    ("server/worldmonitor/aviation/v1/list-aviation-news.ts", "aviation"),
    ("scripts/seed-aviation.mjs", "aviation"),
    ("server/worldmonitor/infrastructure/v1/list-service-statuses.ts", "outages"),
]

URL_CHARS = r"[A-Za-z0-9\-._~:/?#\[\]@!$&'()*+,;=%]"
URL_RE = re.compile(
    rf"(?i)(?:\b[a-z][a-z0-9+.\-]*://|\bwww\.){URL_CHARS}*"
    rf"|\b(?:[a-z0-9-]+\.)+[a-z]{{2,}}/{URL_CHARS}*|://"
)


def clean(text, limit=160):
    """Untrusted text -> one line of plain text without markup or URLs."""
    text = html.unescape(html.unescape(text or ""))
    text = re.sub(r"<[^<>]*>", " ", text)
    text = "".join(" " if c.isspace() else c for c in text
                   if c.isspace() or unicodedata.category(c)[0] != "C" or c in "\u200c\u200d")
    text = re.sub(r"\s+", " ", URL_RE.sub(" ", text)).strip()
    if len(text) > limit:
        text = text[: limit - 1].rstrip() + "…"
    return text


# ── registry ────────────────────────────────────────────────────────────────

def real_url(url):
    """Unwrap /api/rss-proxy?url=<encoded>; return None unless http(s)."""
    if "rss-proxy" in url:
        inner = urllib.parse.parse_qs(urllib.parse.urlsplit(url).query).get("url")
        url = inner[0] if inner else ""
    url = url.strip()
    return url if re.match(r"(?i)https?://", url) else None


def url_key(url):
    p = urllib.parse.urlsplit(url)
    return urllib.parse.unquote_plus(urllib.parse.urlunsplit(
        (p.scheme.lower(), p.netloc.lower(), p.path or "/", p.query, "")))


def load_registry():
    sources, seen = [], set()
    tiers = json.loads((VENDOR / "shared/source-tiers.json").read_text("utf-8"))

    def add(name, url, category, origin):
        url = real_url(url)
        if not url or url_key(url) in seen:
            return
        seen.add(url_key(url))
        tier = tiers.get(name)
        sources.append({"name": clean(name, 100) or "unnamed", "url": url, "category": category,
                        "tier": tier if tier in (1, 2, 3, 4) else None, "origin": origin})

    catalog = json.loads((VENDOR / "shared/news-catalog.json").read_text("utf-8"))
    for feed in catalog["feeds"]:
        places = feed["placements"]
        place = next((p for p in places if p["edition"] == "full"), places[0])
        urls = feed["url"]
        if isinstance(urls, str):
            add(feed["name"], urls, place["category"], "news-catalog")
        else:
            for lang, url in urls.items():
                add(f"{feed['name']} ({lang})", url, place["category"], "news-catalog")

    literal = re.compile(
        r"\{[^{}]*?\b(?:name|sourceName|source|agency):\s*'([^']+)'[^{}]*?"
        r"\b(?:url|statusPage):\s*'(https?://[^']+)'[^{}]*\}")
    for path, category in EXTRA:
        for name, url in literal.findall((VENDOR / path).read_text("utf-8")):
            if re.search(r"(?i)rss|feed|\.xml|\.atom", url):
                add(name, url, category, "vendor-extra")

    disease = (VENDOR / "scripts/seed-disease-outbreaks.mjs").read_text("utf-8")
    names = {"CDC_FEED": "CDC Outbreaks", "ECDC_EPI_UPDATES_FEED": "ECDC Epidemiological Updates",
             "ECDC_NEWS_FEED": "ECDC News", "UNOG_NEWSROOM_FEED": "UN Geneva Newsroom"}
    for const, name in names.items():
        m = re.search(rf"const {const}\s*=\s*'([^']+)'", disease)
        if m:
            add(name, m.group(1), "health", "vendor-extra")
    m = re.search(r"CIDRAP_TOPIC_IDS\s*=\s*\[([\d,\s]+)\]", disease)
    for topic in re.findall(r"\d+", m.group(1) if m else ""):
        add(f"CIDRAP topic {topic}", f"https://www.cidrap.umn.edu/news/{topic}/rss",
            "health", "vendor-extra")
    research = (VENDOR / "scripts/seed-research.mjs").read_text("utf-8")
    m = re.search(r"RSS_URL\s*=\s*'([^']+)'", research)
    if m:
        add("dev.events", m.group(1), "dev", "vendor-extra")

    radar = json.loads((PROJECT / "radar/sources.json").read_text("utf-8"))
    for feed in radar.get("feeds", []):
        add(feed["name"], feed["url"], "crypto", "radar")
    return sources


# ── fetching ────────────────────────────────────────────────────────────────

class Blocked(OSError):
    pass


def safe_socket(host, port, timeout):
    """Resolve, refuse any non-public address, connect to the vetted address."""
    for attempt in range(3):
        try:
            infos = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
            break
        except socket.gaierror:
            if attempt == 2:
                raise
            time.sleep(0.5)
    for info in infos:
        ip = ipaddress.ip_address(info[4][0].split("%")[0])
        ip = getattr(ip, "ipv4_mapped", None) or ip
        if not ip.is_global or ip.is_multicast:
            raise Blocked("non-public address")
    error = OSError("no address")
    infos.sort(key=lambda i: i[0] != socket.AF_INET)
    for family, kind, proto, _, address in infos[:3]:
        sock = socket.socket(family, kind, proto)
        sock.settimeout(timeout)
        try:
            sock.connect(address)
            return sock
        except OSError as exc:
            sock.close()
            error = exc
    raise error


class HTTP(http.client.HTTPConnection):
    def connect(self):
        self.sock = safe_socket(self.host, self.port, self.timeout)


class HTTPS(http.client.HTTPSConnection):
    def connect(self):
        raw = safe_socket(self.host, self.port, self.timeout)
        self.sock = ssl.create_default_context().wrap_socket(raw, server_hostname=self.host)


class HTTPHandler(urllib.request.HTTPHandler):
    def http_open(self, req):
        return self.do_open(HTTP, req)


class HTTPSHandler(urllib.request.HTTPSHandler):
    def https_open(self, req):
        return self.do_open(HTTPS, req)


def opener():
    # Built by hand: no proxy, file, ftp or data handlers. Redirect targets go
    # through the same two connection classes, so they are vetted too.
    director = urllib.request.OpenerDirector()
    for handler in (HTTPHandler(), HTTPSHandler(), urllib.request.HTTPRedirectHandler(),
                    urllib.request.HTTPDefaultErrorHandler(),
                    urllib.request.HTTPErrorProcessor(), urllib.request.UnknownHandler()):
        director.add_handler(handler)
    return director


def iri_to_uri(url):
    p = urllib.parse.urlsplit(url)
    netloc = p.netloc.encode("idna").decode("ascii")
    safe = "/?:@!$&'()*+,;=%-._~[]"
    return urllib.parse.urlunsplit((p.scheme, netloc, urllib.parse.quote(p.path, safe=safe),
                                    urllib.parse.quote(p.query, safe=safe), ""))


def fetch(url):
    """Return (body, None) or (None, failure reason). One attempt."""
    deadline = time.monotonic() + TIMEOUT
    try:
        req = urllib.request.Request(iri_to_uri(url), headers={
            "User-Agent": UA, "Accept-Encoding": "identity",
            "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, */*;q=0.5"})
        with opener().open(req, timeout=TIMEOUT) as res:
            chunks, size = [], 0
            while True:
                if time.monotonic() > deadline:
                    return None, "timeout"
                chunk = res.read1(65536)
                if not chunk:
                    break
                size += len(chunk)
                if size > CAP:
                    return None, "too_large"
                chunks.append(chunk)
        body = b"".join(chunks)
        if body[:2] == b"\x1f\x8b":
            body = zlib.decompressobj(31).decompress(body, CAP + 1)
            if len(body) > CAP:
                return None, "too_large"
        return body, None
    except urllib.error.HTTPError as exc:
        return None, f"http_{exc.code}"
    except Exception as exc:  # any network failure is a recorded result
        cause = getattr(exc, "reason", exc)
        for kind, label in ((Blocked, "blocked_address"), (socket.gaierror, "dns"),
                            (TimeoutError, "timeout"), (ssl.SSLError, "tls"),
                            (ConnectionError, "connection"),
                            (http.client.HTTPException, "protocol")):
            if isinstance(cause, kind):
                return None, label
        return None, "timeout" if "timed out" in str(cause) else "network_other"


def fetch_all(sources, raw):
    if raw.exists() and any(raw.iterdir()):
        sys.exit("--raw must be a new or empty directory")
    raw.mkdir(parents=True, exist_ok=True)
    results = {}

    def one(index):
        body, error = fetch(sources[index]["url"])
        if body is not None:
            (raw / f"{index:05d}.bin").write_bytes(body)
        return index, error

    # 20 workers in total; the aggregator host gets only 5 of them.
    google = [i for i, s in enumerate(sources)
              if urllib.parse.urlsplit(s["url"]).hostname == "news.google.com"]
    rest = sorted(set(range(len(sources))) - set(google))
    with cf.ThreadPoolExecutor(5) as a, cf.ThreadPoolExecutor(15) as b:
        jobs = [a.submit(one, i) for i in google] + [b.submit(one, i) for i in rest]
        for n, job in enumerate(cf.as_completed(jobs), 1):
            index, error = job.result()
            results[sources[index]["url"]] = error
            if n % 200 == 0:
                print(f"fetched {n}/{len(sources)}", flush=True)
    meta = {"fetched": dt.datetime.now(dt.timezone.utc).isoformat(),
            "results": [{"file": f"{i:05d}.bin", "url": s["url"], "error": results[s["url"]]}
                        for i, s in enumerate(sources)]}
    (raw / "meta.json").write_text(json.dumps(meta), "utf-8")


# ── parsing ─────────────────────────────────────────────────────────────────

def parse_date(text):
    text = (text or "").strip()
    if not text:
        return None
    value = None
    for parse in (lambda s: dt.datetime.fromisoformat(s), parsedate_to_datetime,
                  lambda s: dt.datetime.strptime(s, "%d/%m/%Y %H:%M:%S"),
                  lambda s: dt.datetime.strptime(s, "%Y-%m-%d %H:%M:%S %z")):
        try:
            value = parse(text)
            break
        except Exception:
            continue
    if value is None:
        return None
    try:
        if value.tzinfo is None:
            value = value.replace(tzinfo=dt.timezone.utc)
        return value.astimezone(dt.timezone.utc)
    except Exception:
        return None


def parse_xml(body):
    if b"<!entity" in body.replace(b"\x00", b"").lower():
        raise ValueError("entity_rejected")
    body = body.lstrip()
    try:
        return ET.fromstring(body)
    except (ET.ParseError, ValueError, LookupError):
        pass
    # Tolerant second pass: legacy encodings, HTML entities, control characters.
    m = re.search(rb"""encoding=["']([A-Za-z0-9_\-]+)["']""", body[:200])
    encoding = "utf-16" if body[:2] in (b"\xff\xfe", b"\xfe\xff") else (
        m.group(1).decode() if m else "utf-8-sig")
    try:
        text = body.decode(encoding, "replace")
    except LookupError:
        text = body.decode("utf-8", "replace")
    if "<!entity" in text.lower():
        raise ValueError("entity_rejected")
    text = re.sub(r"^\ufeff?\s*<\?xml[^>]*\?>", "", text)
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", text)
    text = re.sub(r"&(?!(?:amp|lt|gt|quot|apos);|#\d+;|#x[0-9a-fA-F]+;)([A-Za-z][A-Za-z0-9]*;)?",
                  lambda m: html.escape(html.unescape("&" + m.group(1))) if m.group(1) else "&amp;",
                  text)
    try:
        return ET.fromstring(text.strip())
    except (ET.ParseError, ValueError):
        head = text.lstrip()[:500].lower()
        raise ValueError("html_not_feed" if "<html" in head or "<!doctype html" in head
                         else "not_feed" if not head.startswith("<") else "xml_parse")


def local(element):
    return element.tag.rsplit("}", 1)[-1].lower() if isinstance(element.tag, str) else ""


def parse_feed(body):
    """Return [(utc datetime or None, title)] for RSS, Atom, RDF or news sitemaps."""
    root = parse_xml(body)
    kind = local(root)
    if kind not in ("rss", "feed", "rdf", "urlset", "channel"):
        raise ValueError("html_not_feed" if kind == "html" else "not_feed")
    wanted = {"url"} if kind == "urlset" else {"item", "entry"}
    items = []
    for node in root.iter():
        if local(node) not in wanted:
            continue
        fields = {}
        for child in (node.iter() if kind == "urlset" else node):
            fields.setdefault(local(child), "".join(child.itertext()))
        title = clean(fields.get("title"))
        if not title:
            continue
        date = None
        for key in ("pubdate", "published", "publication_date", "date", "issued", "updated"):
            date = parse_date(fields.get(key))
            if date:
                break
        items.append((date, title))
    if not items:
        raise ValueError("no_items")
    return items


# ── output ──────────────────────────────────────────────────────────────────

def build(sources, raw):
    meta = json.loads((raw / "meta.json").read_text("utf-8"))
    by_url = {r["url"]: r for r in meta["results"]}
    now = dt.datetime.fromisoformat(meta["fetched"])
    oldest, newest = now - dt.timedelta(days=MAX_AGE_DAYS), now
    rows, per_source, reasons = [], [], collections.Counter()
    for source in sources:
        record = by_url.get(source["url"])
        items, error = [], record["error"] if record else "not_fetched"
        if error is None:
            try:
                items = parse_feed((raw / record["file"]).read_bytes())
            except ValueError as exc:
                error = str(exc) if re.fullmatch(r"[a-z_]+", str(exc)) else "xml_parse"
            except Exception:
                error = "parse_error"
        if error:
            reasons[error] += 1
        dated = sorted((i for i in items if i[0] and i[0] <= newest), reverse=True)
        picked, titles = [], set()
        for date, title in dated:
            if date >= oldest and title not in titles:
                titles.add(title)
                picked.append((date, title))
            if len(picked) == PER_SOURCE:
                break
        per_source.append(picked)
        rows.append({"name": source["name"], "category": source["category"],
                     "tier": source["tier"], "status": "ok" if items else "failed",
                     "items": len(items),
                     "latest": dated[0][0].strftime("%Y-%m-%d") if dated else None})

    # Round-robin by rank, so the total cap trims depth before it drops sources.
    pool = []
    for rank in range(PER_SOURCE):
        layer = [(p[rank][0], i, p[rank][1]) for i, p in enumerate(per_source) if rank < len(p)]
        pool.extend(sorted(layer, reverse=True))

    used = {r["category"] for r in rows}
    categories = [{"id": k, "label": v} for k, v in LABELS.items() if k in used]
    categories += [{"id": k, "label": "Прочее: " + k} for k in sorted(used - set(LABELS))]
    limit = MAX_HEADLINES
    while True:
        headlines = [{"t": d.strftime("%Y-%m-%dT%H:%M"), "s": i, "title": t}
                     for d, i, t in sorted(pool[:limit], key=lambda h: (h[0], -h[1]), reverse=True)]
        output = render(now.strftime("%Y-%m-%d"), rows, categories, headlines)
        if len(output) < MAX_BYTES:
            break
        limit = min(limit, len(pool)) - 100
    target = GRAPH / "fixtures" / "sources.js"
    target.write_bytes(output)
    print(json.dumps({
        "total": len(rows), "ok": sum(r["status"] == "ok" for r in rows),
        "headlines": len(headlines), "eligible": len(pool),
        "sources_with_headlines": len({h["s"] for h in headlines}),
        "categories": len(categories), "bytes": len(output), "fetched": meta["fetched"],
        "origins": collections.Counter(s["origin"] for s in sources),
        "google_news": google_stats(sources, rows),
        "reasons": dict(reasons.most_common())}, ensure_ascii=True, indent=1))


def google_stats(sources, rows):
    flags = [r["status"] == "ok" for s, r in zip(sources, rows)
             if urllib.parse.urlsplit(s["url"]).hostname == "news.google.com"]
    return {"total": len(flags), "ok": sum(flags)}


def render(generated, rows, categories, headlines):
    def j(value):
        return (json.dumps(value, ensure_ascii=False, separators=(",", ":"))
                .replace("\u2028", "\\u2028").replace("\u2029", "\\u2029"))

    def block(values):
        return "[\n" + ",\n".join("    " + j(v) for v in values) + "\n  ]"

    ok = sum(r["status"] == "ok" for r in rows)
    text = ("// Generated source registry and headline snapshot. See ATTRIBUTION-sources.md.\n"
            "export default {\n"
            f"  generated: '{generated}', total: {len(rows)}, ok: {ok},\n"
            f"  categories: {block(categories)},\n"
            f"  sources: {block(rows)},\n"
            f"  headlines: {block(headlines)}\n"
            "};\n")
    return text.encode("utf-8", "replace")


def main():
    args = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    args.add_argument("--raw", required=True, type=pathlib.Path)
    args.add_argument("--offline", action="store_true")
    opts = args.parse_args()
    sources = load_registry()
    print(f"registered {len(sources)}", flush=True)
    if not opts.offline:
        fetch_all(sources, opts.raw)
    build(sources, opts.raw)


if __name__ == "__main__":
    main()
