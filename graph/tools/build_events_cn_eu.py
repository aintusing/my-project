#!/usr/bin/env python3
"""Build fixtures/events-cn-eu.js (China and Europe events) from keyless public sources.

Usage:
  python -I tools/build_events_cn_eu.py <raw_folder> --fetch [--only a,b] [--seconds N]
  python -I tools/build_events_cn_eu.py <raw_folder>            # build from saved files

Downloaded files are untrusted data: they are only parsed (JSON, text, XML without ENTITY),
never executed. TLS verification is the Python default. No contact details are sent.
"""
import argparse, csv, datetime as dt, gzip, html, io, json, re, subprocess, threading, time
import urllib.error, urllib.parse, urllib.request
import xml.etree.ElementTree as ET
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from email.utils import parsedate_to_datetime
from pathlib import Path

UA = "radar-prototype/0.1"
GENERATED = dt.date(2026, 11, 27)
ROOT = Path(__file__).resolve().parent.parent

# name -> (group, url). Groups: inst, reg, cnnews, eunews, hkgov
FEEDS = {
    "ec_presscorner": ("inst", "https://ec.europa.eu/commission/presscorner/api/rss?language=en"),
    "council": ("inst", "https://www.consilium.europa.eu/en/rss/pressreleases.ashx"),
    "europarl_press": ("inst", "https://www.europarl.europa.eu/rss/doc/press-releases/en.xml"),
    "europarl_top": ("inst", "https://www.europarl.europa.eu/rss/doc/top-stories/en.xml"),
    "europarl_plenary": ("inst", "https://www.europarl.europa.eu/rss/doc/texts-adopted/en.xml"),
    "eea": ("inst", "https://www.eea.europa.eu/en/newsroom/rss-feeds/eeas-press-releases-rss"),
    "efsa": ("inst", "https://www.efsa.europa.eu/en/press/rss"),
    "ecdc": ("inst", "https://www.ecdc.europa.eu/en/taxonomy/term/1307/feed"),
    "ecb_press": ("reg", "https://www.ecb.europa.eu/rss/press.html"),
    "ecb_statpress": ("reg", "https://www.ecb.europa.eu/rss/statpress.html"),
    "ecb_pub": ("reg", "https://www.ecb.europa.eu/rss/pub.html"),
    "ecb_operations": ("reg", "https://www.ecb.europa.eu/rss/operations.html"),
    "ecb_supervision": ("reg", "https://www.bankingsupervision.europa.eu/rss/press.html"),
    "esma": ("reg", "https://www.esma.europa.eu/rss.xml"),
    "eba": ("reg", "https://www.eba.europa.eu/news-press/news/rss.xml"),
    "eiopa": ("reg", "https://www.eiopa.europa.eu/node/4770/rss_en"),
    "boe_news": ("reg", "https://www.bankofengland.co.uk/rss/news"),
    "boe_pub": ("reg", "https://www.bankofengland.co.uk/rss/publications"),
    "boe_stats": ("reg", "https://www.bankofengland.co.uk/rss/statistics"),
    "fca": ("reg", "https://www.fca.org.uk/news/rss.xml"),
    "bafin": ("reg", "https://www.bafin.de/DE/Service/TopNavigation/RSS/_function/rssnewsfeed.xml"),
    "amf_fr": ("reg", "https://www.amf-france.org/en/flux-rss/display/21"),
    "bundesbank": ("reg", "https://www.bundesbank.de/service/rss/en/633286/feed.rss"),
    "bancaditalia": ("reg", "https://www.bancaditalia.it/util/index.rss.html?lingua=en"),
    "snb": ("reg", "https://www.snb.ch/public/en/rss/pressrel"),
    "riksbank": ("reg", "https://www.riksbank.se/en-gb/rss/press-releases/"),
    "norgesbank": ("reg", "https://www.norges-bank.no/en/rss-feeds/Press-releases---Norges-Bank/"),
    "nbp": ("reg", "https://nbp.pl/en/feed/"),
    "cnb": ("reg", "https://www.cnb.cz/en/.content/rss/rss_00001.rss"),
    "hkma": ("reg", "https://www.hkma.gov.hk/eng/other-information/rss/rss_press-release.xml"),
    "sfc_hk": ("reg", "https://www.sfc.hk/en/RSS-Feeds/Press-releases"),
    "hk_gov": ("hkgov", "https://www.info.gov.hk/gia/rss/general_en.xml"),
    "hk_gov_zh": ("hkgov", "https://www.info.gov.hk/gia/rss/general_zh.xml"),
    "xinhua_world": ("cnnews", "http://www.xinhuanet.com/english/rss/worldrss.xml"),
    "xinhua_china": ("cnnews", "http://www.xinhuanet.com/english/rss/chinarss.xml"),
    "chinadaily_china": ("cnnews", "https://www.chinadaily.com.cn/rss/china_rss.xml"),
    "chinadaily_world": ("cnnews", "https://www.chinadaily.com.cn/rss/world_rss.xml"),
    "chinadaily_biz": ("cnnews", "https://www.chinadaily.com.cn/rss/bizchina_rss.xml"),
    "peoples_china": ("cnnews", "http://en.people.cn/rss/90785.xml"),
    "peoples_world": ("cnnews", "http://en.people.cn/rss/90777.xml"),
    "peoples_zh": ("cnnews", "http://www.people.com.cn/rss/politics.xml"),
    "peoples_zh_world": ("cnnews", "http://www.people.com.cn/rss/world.xml"),
    "peoples_zh_fin": ("cnnews", "http://www.people.com.cn/rss/finance.xml"),
    "globaltimes": ("cnnews", "https://www.globaltimes.cn/rss/outbrain.xml"),
    "cgtn_china": ("cnnews", "https://www.cgtn.com/subscribe/rss/section/china.xml"),
    "cgtn_world": ("cnnews", "https://www.cgtn.com/subscribe/rss/section/world.xml"),
    "cgtn_biz": ("cnnews", "https://www.cgtn.com/subscribe/rss/section/business.xml"),
    "scmp_china": ("cnnews", "https://www.scmp.com/rss/4/feed"),
    "scmp_news": ("cnnews", "https://www.scmp.com/rss/91/feed"),
    "scmp_hk": ("cnnews", "https://www.scmp.com/rss/2/feed"),
    "scmp_biz": ("cnnews", "https://www.scmp.com/rss/92/feed"),
    "caixin": ("cnnews", "https://www.caixinglobal.com/rss/"),
    "36kr": ("cnnews", "https://36kr.com/feed"),
    "hkfp": ("cnnews", "https://hongkongfp.com/feed/"),
    "sixthtone": ("cnnews", "https://www.sixthtone.com/rss"),
    "technode": ("cnnews", "https://technode.com/feed/"),
    "dw_en": ("eunews", "https://rss.dw.com/rdf/rss-en-all"),
    "dw_de": ("eunews", "https://rss.dw.com/rdf/rss-de-all"),
    "france24_en": ("eunews", "https://www.france24.com/en/rss"),
    "france24_fr": ("eunews", "https://www.france24.com/fr/rss"),
    "bbc_europe": ("eunews", "https://feeds.bbci.co.uk/news/world/europe/rss.xml"),
    "lemonde": ("eunews", "https://www.lemonde.fr/rss/une.xml"),
    "lemonde_europe": ("eunews", "https://www.lemonde.fr/europe/rss_full.xml"),
    "euronews": ("eunews", "https://www.euronews.com/rss"),
    "politico_eu": ("eunews", "https://www.politico.eu/feed/"),
    "ansa": ("eunews", "https://www.ansa.it/sito/ansait_rss.xml"),
    "ansa_world": ("eunews", "https://www.ansa.it/sito/notizie/mondo/mondo_rss.xml"),
    "elpais": ("eunews", "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada"),
    "handelsblatt": ("eunews", "https://www.handelsblatt.com/contentexport/feed/schlagzeilen"),
    "tagesschau": ("eunews", "https://www.tagesschau.de/index~rss2.xml"),
    "nos": ("eunews", "https://feeds.nos.nl/nosnieuwsalgemeen"),
    "svt": ("eunews", "https://www.svt.se/nyheter/rss.xml"),
    "yle": ("eunews", "https://feeds.yle.fi/uutiset/v1/recent.rss?publisherIds=YLE_UUTISET"),
    "nrk": ("eunews", "https://www.nrk.no/toppsaker.rss"),
    "kyivindependent": ("eunews", "https://kyivindependent.com/news-archive/rss/"),
    "meduza": ("eunews", "https://meduza.io/rss/all"),
    "rte": ("eunews", "https://www.rte.ie/feeds/rss/?index=/news/"),
    "swissinfo": ("eunews", "https://www.swissinfo.ch/eng/feed/"),
    "notesfrompoland": ("eunews", "https://notesfrompoland.com/feed/"),
    "balkaninsight": ("eunews", "https://balkaninsight.com/feed/"),
}
EMS_URL = "https://rapidmapping.emergency.copernicus.eu/backend/dashboard-api/public-activations-info/?limit=1000"
ESTAT_URL = "https://ec.europa.eu/eurostat/api/dissemination/catalogue/toc/txt?lang=en"
BOXES = {"eu": (34, 72, -25, 45), "cn": (18, 54, 73, 135)}

LOG, LOCK = {}, threading.Lock()


def note(key, value):
    with LOCK:
        LOG[key] = value


def get(url, data=None, timeout=45, tries=3):
    headers = {"User-Agent": UA, "Accept-Encoding": "gzip"}
    if data is not None:
        headers["Content-Type"] = "application/json"
    for n in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, data=data, headers=headers), timeout=timeout) as r:
                body = r.read()
                if r.headers.get("Content-Encoding") == "gzip" or body[:2] == b"\x1f\x8b":
                    body = gzip.decompress(body)
                return body
        except urllib.error.HTTPError as e:
            # refusals are final; only throttling and server faults are retried, politely
            if e.code not in (429, 500, 502, 503, 504) or n == tries - 1:
                raise
            time.sleep(8 if e.code == 429 else 3)
        except Exception as e:
            if data is None and "CERTIFICATE_VERIFY_FAILED" in str(e):
                # Python does not fetch missing intermediates or roots; system curl uses the OS verifier.
                # Verification stays on: if curl rejects the chain too, the source is skipped.
                return subprocess.run(["curl", "-sS", "--fail", "-L", "-m", str(timeout), "-A", UA, url],
                                      capture_output=True, check=True).stdout
            if n == tries - 1:
                raise
            time.sleep(2)


def save(raw, folder, name, body):
    d = raw / folder
    d.mkdir(parents=True, exist_ok=True)
    (d / name).write_bytes(body)


# ---------------------------------------------------------------- fetch
def fetch_feeds(raw):
    def one(item):
        name, (_, url) = item
        try:
            body = get(url, timeout=25, tries=2)
            if b"<!ENTITY" in body:
                raise ValueError("XML with ENTITY rejected")
            save(raw, "feeds", name + ".xml", body)
            note("feed:" + name, "ok")
        except Exception as e:
            note("feed:" + name, f"skip: {e}"[:160])
    with ThreadPoolExecutor(10) as ex:
        list(ex.map(one, FEEDS.items()))


def fetch_simple(raw, key, url, fname, timeout=120):
    try:
        save(raw, key, fname, get(url, timeout=timeout))
        note(key, "ok")
    except Exception as e:
        note(key, f"skip: {e}"[:160])


def fetch_emsc(raw):
    starts = [dt.date(y, m, 1) for y in range(2015, 2027) for m in (1, 4, 7, 10) if dt.date(y, m, 1) <= GENERATED]
    ends = starts[1:] + [GENERATED + dt.timedelta(1)]
    # newest first; windows already saved are not requested again
    for a, b in reversed(list(zip(starts, ends))):
        for reg, (s, n, w, e) in BOXES.items():
            if (raw / "emsc" / f"{reg}_{a}_0.txt").exists():
                continue
            q = dict(format="text", minmag=2, minlat=s, maxlat=n, minlon=w, maxlon=e,
                     start=a.isoformat(), end=b.isoformat(), limit=20000)
            try:
                offset, part = 1, 0
                while True:
                    body = get("https://www.seismicportal.eu/fdsnws/event/1/query?" +
                               urllib.parse.urlencode({**q, "offset": offset}), timeout=90)
                    save(raw, "emsc", f"{reg}_{a}_{part}.txt", body)
                    rows = max(body.count(b"\n") - 1, 0)
                    if rows < 19999:
                        break
                    offset, part = offset + 20000, part + 1
                note(f"emsc:{reg}:{a}", "ok")
            except Exception as ex:
                note(f"emsc:{reg}:{a}", f"skip: {ex}"[:160])
            time.sleep(0.5)


def fetch_xbrl(raw, seconds):
    t0, size = time.time(), 500
    page = 1 + len(list((raw / "xbrl").glob("big*.json")))
    while time.time() - t0 < seconds:
        q = {"page[size]": size, "page[number]": page, "include": "entity", "sort": "-date_added"}
        try:
            body = get("https://filings.xbrl.org/api/filings?" + urllib.parse.urlencode(q), timeout=40, tries=1)
            j = json.loads(body)
        except urllib.error.HTTPError as e:
            note("xbrl", f"partial, stopped at page {page} of size {size}: {e}"[:160])
            if e.code != 429:
                return
            time.sleep(20)  # honour the rate limit
            continue
        except Exception as e:
            note("xbrl", f"partial, stopped at page {page} of size {size}: {e}"[:160])
            return
        save(raw, "xbrl", f"big{page:04d}.json", body)
        total = j.get("meta", {}).get("count")
        if not j.get("links", {}).get("next") or not j.get("data"):
            note("xbrl", f"ok: all {page} pages, source count {total}")
            return
        note("xbrl", f"partial: {page} pages of {size}, source count {total}")
        page += 1
        time.sleep(3)


def fetch_ted(raw, seconds):
    t0 = time.time()
    days = [GENERATED - dt.timedelta(i) for i in range(0, 400)]
    days = [d for d in days if not (raw / "ted" / f"{d}.json").exists()]
    lock = threading.Lock()

    def worker():
        while time.time() - t0 < seconds:
            with lock:
                if not days:
                    return
                day = days.pop(0)
            token, rows = None, []
            try:
                while True:
                    q = {"query": f"publication-date={day:%Y%m%d}", "limit": 250, "paginationMode": "ITERATION",
                         "fields": ["publication-number", "publication-date", "notice-title", "buyer-country"]}
                    if token:
                        q["iterationNextToken"] = token
                    j = json.loads(get("https://api.ted.europa.eu/v3/notices/search", json.dumps(q).encode(), 60, 5))
                    got = j.get("notices", [])
                    for x in got:
                        title = x.get("notice-title") or {}
                        rows.append([x.get("publication-number"), day.isoformat(), x.get("buyer-country") or [],
                                     title.get("eng") or next(iter(title.values()), "")])
                    token = j.get("iterationNextToken")
                    if len(got) < 250 or not token:
                        break
                    if time.time() - t0 > seconds + 30:
                        return  # incomplete day is dropped
                    time.sleep(0.3)
                save(raw, "ted", f"{day}.json", json.dumps(rows, ensure_ascii=False).encode())
                note(f"ted:{day}", f"ok: {len(rows)}")
            except Exception as e:
                note(f"ted:{day}", f"skip: {e}"[:160])
                time.sleep(5)
    with ThreadPoolExecutor(3) as ex:
        for f in [ex.submit(worker) for _ in range(3)]:
            f.result()


def fetch_govuk(raw, seconds=240):
    t0 = time.time()
    for kind in ("press_release", "news_story"):
        start = 0
        while time.time() - t0 < seconds:
            q = {"count": 1000, "start": start, "order": "-public_timestamp",
                 "filter_content_store_document_type": kind, "fields": "title,public_timestamp"}
            try:
                body = get("https://www.gov.uk/api/search.json?" + urllib.parse.urlencode(q), timeout=60)
                j = json.loads(body)
            except Exception as e:
                note(f"govuk:{kind}", f"partial at {start}: {e}"[:160])
                break
            save(raw, "govuk", f"{kind}_{start:07d}.json", body)
            start += 1000
            note(f"govuk:{kind}", f"ok: up to {min(start, j.get('total', 0))} of {j.get('total')}")
            if start >= j.get("total", 0):
                break
            time.sleep(0.3)


def fetch(raw, only, seconds):
    jobs = {
        "feeds": lambda: fetch_feeds(raw),
        "ems": lambda: fetch_simple(raw, "ems", EMS_URL, "activations.json"),
        "eurostat": lambda: fetch_simple(raw, "eurostat", ESTAT_URL, "toc.tsv", 150),
        "emsc": lambda: fetch_emsc(raw),
        "xbrl": lambda: fetch_xbrl(raw, seconds),
        "ted": lambda: fetch_ted(raw, seconds),
        "govuk": lambda: fetch_govuk(raw),
    }
    picked = [k for k in jobs if not only or k in only]
    with ThreadPoolExecutor(len(picked)) as ex:
        futures = {k: ex.submit(jobs[k]) for k in picked}
        for k, f in futures.items():
            try:
                f.result()
                print("done", k, flush=True)
            except Exception as e:
                note(k, f"skip: {e}"[:160])
    logfile = raw / "fetch_log.json"
    old = json.loads(logfile.read_text("utf-8")) if logfile.exists() else {}
    logfile.write_text(json.dumps({**old, **LOG}, indent=1, sort_keys=True), "utf-8")


# ---------------------------------------------------------------- build
SENSITIVE = re.compile(
    r"\b(jail|sentenc|convict|arrest|charg|accus|murder|kill|dies|died|dead\b|death|obituar|suspect|victim|"
    r"rape|abus|assault|stab|missing|fraudster|disqualified|banned|fined|pleads?|trial|court|tribunal|"
    r"appoint|honours|man\b|woman\b|boy\b|girl\b|teen|mother|father|son\b|daughter|pensioner|"
    r"mort|tu[ée]|proc[èe]s|condamn|meurtr|get[öo]tet|prozess|verurteil|festgenommen|mord|muert|asesin|"
    r"deten|juicio|uccis|arrestat|omicidio|morto|dood|moord|rechtbank|d[öo]d|d[öo]mt|kuoli|surma|"
    r"суд|убий|убит|умер|арест|приговор|задерж)|男子|女子|被捕|被告|死|案|涉嫌|判囚", re.I)


# enforcement notices often name individuals
ENFORCEMENT = re.compile(r"(bans?|reprimand\w*|prosecut\w*|suspend\w*|fines|sanctions? (?:on|against)|"
                         r"disciplin\w*|enforcement|against (?:Mr|Ms|Mrs))|(?:Mr|Ms|Mrs|Dr)\.? [A-Z]", re.I)


def clean(text, limit=120):
    t = html.unescape(html.unescape(str(text or "")))
    t = re.sub(r"<[^>]*>", " ", t)
    t = re.sub(r"(?:https?:|ftp:)\S*|www\.\S+|\S+@\S+", " ", t, flags=re.I)
    t = "".join(c if c.isprintable() else " " for c in t)
    t = " ".join(t.replace("<", " ").replace(">", " ").split())
    return t if len(t) <= limit else t[:limit - 1].rstrip() + "…"


def day_of(text):
    s = (text or "").strip()
    if not s:
        return None
    m = re.search(r"(20\d\d)-(\d\d)-(\d\d)", s)
    named = re.match(r"([A-Z][a-z]{2}) (\d{1,2}), (20\d\d)", s)
    try:
        if named:
            d = dt.datetime.strptime(" ".join(named.groups()), "%b %d %Y").date()
        elif m:
            d = dt.date(int(m[1]), int(m[2]), int(m[3]))
        else:
            d = parsedate_to_datetime(s).date()
    except Exception:
        m = re.search(r"(\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w* (20\d\d)", s)
        if not m:
            return None
        d = dt.datetime.strptime(f"{m[1]} {m[2]} {m[3]}", "%d %b %Y").date()
    return d if dt.date(2000, 1, 1) <= d <= GENERATED else None


def load_world():
    text = (ROOT / "fixtures" / "world.js").read_text("utf-8")
    j = json.loads(text[text.index("export default") + 14:].strip().rstrip(";"))
    return j["countries"]


class Agg:
    def __init__(self, countries):
        self.countries = countries
        self.sets, self.cells, self.months, self.items = [], {}, Counter(), {}

    def dataset(self, key, label, group, color, geo):
        self.sets.append(dict(id="cneu_" + key, label=label, group=group, color=color,
                              total=0, from_=None, to=None, geo=geo))
        self.items[len(self.sets) - 1] = []
        return len(self.sets) - 1

    def add(self, ds, d, title=None, lon=None, lat=None, country=None, weight=1):
        s = self.sets[ds]
        s["total"] += 1
        s["from_"] = d if s["from_"] is None or d < s["from_"] else s["from_"]
        s["to"] = d if s["to"] is None or d > s["to"] else s["to"]
        self.months[(f"{d:%Y-%m}", ds)] += 1
        point = None
        if s["geo"] == "exact" and lon is not None:
            point = (min(int((lon + 180) // 1), 359) - 179.5, min(int((lat + 90) // 1), 179) - 89.5)
        elif s["geo"] == "country" and country in self.countries:
            point = tuple(self.countries[country]["at"])
            lon, lat = point
        if point:
            c = self.cells.setdefault((point[0], point[1], ds), [0, 0, 0])
            age = (GENERATED - d).days
            c[0] += age < 7
            c[1] += age < 30
            c[2] += 1
        if title:
            self.items[ds].append((d, weight, title, lon, lat, country))


EU_NAMES = {
    "ICELAND": "IS", "NORWAY": "NO", "SWEDEN": "SE", "FINLAND": "FI", "DENMARK": "DK", "UNITED KINGDOM": "GB",
    "IRELAND": "IE", "FRANCE": "FR", "SPAIN": "ES", "PORTUGAL": "PT", "ITALY": "IT", "SICILY": "IT", "SARDINIA": "IT",
    "GERMANY": "DE", "AUSTRIA": "AT", "SWITZERLAND": "CH", "BELGIUM": "BE", "NETHERLANDS": "NL", "POLAND": "PL",
    "CZECH REPUBLIC": "CZ", "SLOVAKIA": "SK", "HUNGARY": "HU", "SLOVENIA": "SI", "CROATIA": "HR",
    "BOSNIA AND HERZEGOVINA": "BA", "SERBIA": "RS", "MONTENEGRO": "ME", "ALBANIA": "AL", "GREECE": "GR",
    "CRETE": "GR", "BULGARIA": "BG", "ROMANIA": "RO", "MOLDOVA": "MD", "UKRAINE": "UA", "BELARUS": "BY",
    "LITHUANIA": "LT", "LATVIA": "LV", "ESTONIA": "EE", "CYPRUS": "CY",
}


def quake_country(reg, name):
    n = name.upper().strip()
    if reg == "cn":
        return "CN" if n.endswith(", CHINA") and "BORDER" not in n else None
    if n in EU_NAMES:
        return EU_NAMES[n]
    for prefix in ("NORTHERN ", "SOUTHERN ", "EASTERN ", "WESTERN ", "CENTRAL "):
        if n.startswith(prefix):
            return EU_NAMES.get(n[len(prefix):])
    return None


def build_quakes(raw, agg):
    ids = {}
    for key, label, color in (("quakes_eu25", "EMSC: Европа и окрестности, M2.5+ (пересекается с USGS)", "#a9784f"),
                              ("quakes_eu20", "EMSC: Европа и окрестности, M2.0–2.4", "#b9a07a"),
                              ("quakes_cn25", "EMSC: Китай и соседние районы, M2.5+ (пересекается с USGS)", "#8f6a5c"),
                              ("quakes_cn20", "EMSC: Китай и соседние районы, M2.0–2.4", "#a8948a")):
        ids[key] = agg.dataset(key, label, "nature", color, "exact")
    seen = set()
    for path in sorted((raw / "emsc").glob("*.txt")):
        reg = path.name[:2]
        for line in path.read_text("utf-8", "replace").splitlines():
            f = line.split("|")
            if line.startswith("#") or len(f) < 13 or f[0] in seen:
                continue
            d = day_of(f[1])
            try:
                lat, lon, mag = float(f[2]), float(f[3]), float(f[10])
            except ValueError:
                continue
            if not d or mag < 2 or not (-90 <= lat <= 90 and -180 <= lon <= 180):
                continue
            seen.add(f[0])
            ds = ids[f"quakes_{reg}{'25' if mag >= 2.5 else '20'}"]
            title = clean(f"M{mag:.1f} {f[12]}") if (GENERATED - d).days < 30 else None
            agg.add(ds, d, title, round(lon, 2), round(lat, 2), quake_country(reg, f[12]), round(mag, 1))


def build_ems(raw, agg):
    path = raw / "ems" / "activations.json"
    if not path.exists():
        return
    ds = agg.dataset("ems", "Copernicus EMS: активации экстренного картографирования", "security", "#a8685f", "exact")
    j = json.loads(path.read_text("utf-8"))
    for x in j.get("results", j if isinstance(j, list) else []):
        d = day_of(x.get("activationTime") or x.get("eventTime"))
        if not d:
            continue
        m = re.search(r"POINT\s*\(\s*(-?[\d.]+)\s+(-?[\d.]+)", str(x.get("centroid") or ""))
        lon, lat = (round(float(m[1]), 2), round(float(m[2]), 2)) if m else (None, None)
        title = clean(f"{x.get('code', '')} {x.get('category', '')}: {x.get('name', '')}")
        # global service: keep only activations whose centre is inside the Europe or China boxes
        if lon is None or not any(s <= lat <= n and w <= lon <= e for s, n, w, e in BOXES.values()):
            continue
        names = x.get("countries") or []
        country = None
        if len(names) == 1:
            country = "CN" if names[0] == "China" else EU_NAMES.get(str(names[0]).upper())
        agg.add(ds, d, title, lon, lat, country, 1)


ISO3 = dict(zip(
    "AUT BEL BGR HRV CYP CZE DNK EST FIN FRA DEU GRC HUN IRL ITA LVA LTU LUX MLT NLD POL PRT ROU SVK SVN ESP SWE ISL NOR LIE CHE GBR MKD SRB MNE ALB BIH MDA UKR TUR XKX GEO USA CHN JPN HKG MAR TUN EGY ISR ARM AZE BLR KOR IND CAN GRL AND MCO SMR".split(),
    "AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE IS NO LI CH GB MK RS ME AL BA MD UA TR XK GE US CN JP HK MA TN EG IL AM AZ BY KR IN CA GL AD MC SM".split()))


def build_ted(raw, agg):
    files = sorted((raw / "ted").glob("*.json"))
    if not files:
        return
    ds = agg.dataset("ted", "TED: уведомления о госзакупках в ЕС", "markets", "#5f7f9e", "country")
    seen = set()
    for path in files:
        for number, day, countries, title in json.loads(path.read_text("utf-8")):
            d = day_of(day)
            if not d or number in seen:
                continue
            seen.add(number)
            iso = ISO3.get(countries[0]) if countries else None
            # keep "country – category" only: the free-text subject may name people
            parts = re.split(r"\s+[–—]\s+", str(title))
            short = clean(" – ".join(parts[:2])) if len(parts) >= 3 else None
            agg.add(ds, d, f"{short} (TED {number})"[:120] if short else None, None, None, iso, 1)


def build_xbrl(raw, agg):
    files = sorted((raw / "xbrl").glob("*.json"))
    if not files:
        return
    ds = agg.dataset("esef", "Годовые отчёты ESEF/UKSEF (filings.xbrl.org)", "markets", "#6f8f86", "country")
    seen = set()
    legal = re.compile(r"\b(plc|ag|se|sa|s\.a\.?|spa|s\.p\.a\.?|nv|n\.v\.?|ab|asa|a/s|oyj|ltd|limited|group|holding|"
                       r"holdings|gmbh|bank|inc|kgaa|ad|d\.d\.?|as|hf|sca|company|corporation|trust)\b", re.I)
    for path in files:
        j = json.loads(path.read_text("utf-8"))
        names = {x["id"]: x.get("attributes", {}).get("name") for x in j.get("included", []) if x.get("type") == "entity"}
        for x in j.get("data", []):
            a = x.get("attributes", {})
            d = day_of(a.get("date_added"))
            if x.get("id") in seen or not d:
                continue
            seen.add(x.get("id"))
            ref = (x.get("relationships", {}).get("entity", {}).get("data") or {}).get("id")
            name = clean(names.get(ref), 70)
            title = None
            if name and legal.search(name):
                title = clean(f"{name}: годовой отчёт ESEF, период по {a.get('period_end')}")
            agg.add(ds, d, title, None, None, a.get("country"), 1)


def build_eurostat(raw, agg):
    path = raw / "eurostat" / "toc.tsv"
    if not path.exists():
        return
    ds = agg.dataset("eurostat", "Eurostat: последние обновления наборов данных", "markets", "#8a86a8", "none")
    text = path.read_text("utf-8-sig", "replace")
    seen = set()
    rows = csv.reader(io.StringIO(text), delimiter="\t")
    head = [h.strip().lower() for h in next(rows)]
    at = {k: next(i for i, h in enumerate(head) if h.startswith(k)) for k in ("title", "code", "type", "last update of data")}
    for r in rows:
        if len(r) < len(head) or r[at["type"]].strip() not in ("dataset", "table") or r[at["code"]] in seen:
            continue
        m = re.match(r"\s*(\d\d)\.(\d\d)\.(\d{4})", r[at["last update of data"]])
        d = day_of(f"{m[3]}-{m[2]}-{m[1]}") if m else None
        if not d:
            continue
        seen.add(r[at["code"]])
        agg.add(ds, d, clean(f"{r[at['title']].strip()} ({r[at['code']].strip()})"), None, None, None, 1)


def build_govuk(raw, agg):
    files = sorted((raw / "govuk").glob("*.json"))
    if not files:
        return
    ds = agg.dataset("govuk", "GOV.UK: пресс-релизы и новости правительства Британии", "politics", "#7c6f93", "country")
    seen = set()
    for path in files:
        for x in json.loads(path.read_text("utf-8")).get("results", []):
            d = day_of(x.get("public_timestamp"))
            if not d or x.get("_id") in seen:
                continue
            seen.add(x.get("_id"))
            t = clean(x.get("title"))
            hide = SENSITIVE.search(t) or ENFORCEMENT.search(t)
            agg.add(ds, d, None if hide else t, None, None, "GB", 1)


def parse_feed(body):
    if b"<!ENTITY" in body:
        raise ValueError("XML with ENTITY rejected")
    root = ET.fromstring(body.lstrip(b"\xef\xbb\xbf \t\r\n"))
    for el in root.iter():
        if el.tag.rsplit("}", 1)[-1] not in ("item", "entry"):
            continue
        f = {}
        for c in el:
            f.setdefault(c.tag.rsplit("}", 1)[-1], "".join(c.itertext()))
        date = f.get("pubDate") or f.get("published") or f.get("updated") or f.get("date")
        if not date:  # ESMA keeps the date only in a <time> element inside the description
            m = re.search(r'datetime="(20\d\d-\d\d-\d\d)', f.get("description", ""))
            date = m[1] if m else None
        yield f.get("title"), date


def build_feeds(raw, agg, stats):
    spec = {
        "inst": ("eu_inst", "Институты ЕС: пресс-релизы и новости (RSS)", "politics", "#5d6f9c", "none"),
        "reg": ("regulators", "Центробанки и регуляторы Европы и Гонконга (RSS)", "markets", "#4f8a8b", "none"),
        "hkgov": ("hkgov", "Правительство Гонконга: сообщения (RSS)", "politics", "#9a7188", "country"),
        "cnnews": ("news_cn", "СМИ и агентства Китая и Гонконга (RSS)", "politics", "#a3625f", "none"),
        "eunews": ("news_eu", "СМИ Европы (RSS)", "politics", "#6c8466", "none"),
    }
    for group, args in spec.items():
        found, seen = [], set()
        for name, (g, _) in FEEDS.items():
            path = raw / "feeds" / (name + ".xml")
            if g != group or not path.exists():
                continue
            try:
                entries = list(parse_feed(path.read_bytes()))
            except Exception as e:
                stats[name] = f"parse error: {e}"[:120]
                continue
            kept = 0
            for title, date in entries:
                t, d = clean(title), day_of(date)
                if not t or not d or t.lower() in seen:
                    continue
                seen.add(t.lower())
                found.append((d, t))
                kept += 1
            stats[name] = kept
        if not found:
            continue
        ds = agg.dataset(*args)
        for d, t in found:
            hide = group != "inst" and (SENSITIVE.search(t) or ENFORCEMENT.search(t))
            agg.add(ds, d, None if hide else t, None, None, "HK" if group == "hkgov" else None, 1)


def latest_of(agg):
    out = []
    for ds, items in agg.items.items():
        if agg.sets[ds]["id"].startswith("cneu_quakes"):
            ranked = sorted(items, key=lambda x: (x[1], x[0]), reverse=True)[:150]
        elif agg.sets[ds]["id"] in ("cneu_ted", "cneu_govuk", "cneu_esef"):
            # newest first, at most 12 per country and day so one publisher batch does not fill the list
            ranked, per = [], Counter()
            for x in sorted(items, key=lambda x: x[0], reverse=True):
                if per[(x[0], x[5])] < (12 if agg.sets[ds]["id"] != "cneu_govuk" else 40):
                    per[(x[0], x[5])] += 1
                    ranked.append(x)
                if len(ranked) == 150:
                    break
        else:
            ranked = sorted(items, key=lambda x: x[0], reverse=True)[:150]
        for d, w, title, lon, lat, country in sorted(ranked, key=lambda x: x[0], reverse=True):
            out.append(dict(d=d.isoformat(), ds=ds, title=title[:120], lon=lon, lat=lat,
                            country=country if country in agg.countries else None, weight=w))
    return out


def build(raw):
    agg, stats = Agg(load_world()), {}
    build_quakes(raw, agg)
    build_ems(raw, agg)
    build_ted(raw, agg)
    build_xbrl(raw, agg)
    build_eurostat(raw, agg)
    build_govuk(raw, agg)
    build_feeds(raw, agg, stats)
    # drop empty datasets and renumber
    keep = [i for i, s in enumerate(agg.sets) if s["total"]]
    new = {old: i for i, old in enumerate(keep)}
    datasets = []
    for i in keep:
        s = agg.sets[i]
        datasets.append(dict(id=s["id"], label=s["label"], group=s["group"], color=s["color"], total=s["total"],
                             **{"from": s["from_"].isoformat()}, to=s["to"].isoformat(), geo=s["geo"]))
    cells = sorted([lon, lat, new[ds], *c] for (lon, lat, ds), c in agg.cells.items())
    latest = [{**x, "ds": new[x["ds"]]} for x in latest_of(agg) if x["ds"] in new]
    timeline = []
    if datasets:
        y, m = map(int, min(d["from"] for d in datasets)[:7].split("-"))
        while (y, m) <= (GENERATED.year, GENERATED.month):
            key = f"{y}-{m:02d}"
            timeline.append(dict(date=key, counts=[agg.months[(key, i)] for i in keep]))
            y, m = (y + 1, 1) if m == 12 else (y, m + 1)
    dump = lambda v: json.dumps(v, ensure_ascii=False, separators=(",", ":"))
    lines = ["// Generated aggregate of public event data. See ATTRIBUTION-events-cn-eu.md.", "export default {",
             f"  generated: '{GENERATED}',"]
    for key, value in (("datasets", datasets), ("cells", cells), ("latest", latest), ("timeline", timeline)):
        lines.append(f"  {key}: [")
        lines += [f"    {dump(v)}," for v in value]
        lines.append("  ],")
    lines += ["  companies: {}", "};", ""]
    out = ROOT / "fixtures" / "events-cn-eu.js"
    text = "\n".join(lines).replace(" ", " ").replace(" ", " ")
    out.write_text(text, "utf-8", newline="\n")
    for d in datasets:
        print(d["id"], d["total"], d["from"], d["to"])
    print("TOTAL", sum(d["total"] for d in datasets), "cells", len(cells), "latest", len(latest), "bytes", out.stat().st_size)
    (raw / "build_stats.json").write_text(json.dumps(stats, indent=1, sort_keys=True), "utf-8")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("raw", type=Path)
    p.add_argument("--fetch", action="store_true")
    p.add_argument("--only", default="")
    p.add_argument("--seconds", type=int, default=300, help="time budget for TED and filings.xbrl.org")
    a = p.parse_args()
    if a.fetch:
        a.raw.mkdir(parents=True, exist_ok=True)
        fetch(a.raw, set(filter(None, a.only.split(","))), a.seconds)
    build(a.raw)
