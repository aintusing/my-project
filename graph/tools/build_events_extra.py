"""Build graph/fixtures/events-extra.js from free keyless public sources.

Usage:  python -I build_events_extra.py <new-raw-dir> [--offline]
Downloads are untrusted data: saved under <new-raw-dir>/<source>/, only parsed.
--offline re-parses a raw dir filled by an earlier run.

Source URLs:
  NASA EONET v3      https://eonet.gsfc.nasa.gov/api/v3/events
  GDACS              https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH
  NWS alerts         https://api.weather.gov/alerts/active
  NOAA NCEI hazards  https://www.ngdc.noaa.gov/hazel/hazard-service/api/v1/{tsunamis/events,volcanoes}
  Smithsonian GVP    https://volcano.si.edu/news/WeeklyVolcanoRSS.xml
  NASA/JPL CNEOS     https://ssd-api.jpl.nasa.gov/fireball.api
  WHO outbreak news  https://www.who.int/api/news/diseaseoutbreaknews
  CISA KEV           https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json
  Federal Register   https://www.federalregister.gov/api/v1/documents.json
  DefiLlama hacks    https://api.llama.fi/hacks
  Launch Library 2   https://ll.thespacedevs.com/2.3.0/launches/previous/
  OFAC SDN addresses https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/ADD.CSV
  World Bank news    https://search.worldbank.org/api/v2/news
  UN News RSS        https://news.un.org/feed/subscribe/en/news/all/rss.xml
  Central banks      see BANKS below
  Crypto news RSS    radar/sources.json ("feeds")
"""
import csv, datetime as dt, html, io, json, math, os, re, sys, time
import concurrent.futures as cf
import urllib.error, urllib.request
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime
from pathlib import Path

GEN = dt.date(2026, 11, 27)
YEAR_AGO = GEN - dt.timedelta(days=365)
UA = "radar-prototype/0.1"
GRAPH = Path(__file__).resolve().parent.parent
RAW = Path(sys.argv[1]).resolve()
OFFLINE = "--offline" in sys.argv

BANKS = [  # file, publisher, ISO2 of publisher seat, url
    ("ecb", "ECB", "DE", "https://www.ecb.europa.eu/rss/press.html"),
    ("fed", "Federal Reserve", "US", "https://www.federalreserve.gov/feeds/press_all.xml"),
    ("boe", "Bank of England", "GB", "https://www.bankofengland.co.uk/rss/news"),
    ("bis", "BIS", "CH", "https://www.bis.org/doclist/all_pressrels.rss"),
    ("boj", "Bank of Japan", "JP", "https://www.boj.or.jp/en/rss/whatsnew.xml"),
    ("boc", "Bank of Canada", "CA", "https://www.bankofcanada.ca/content_type/press-releases/feed/"),
    ("rba", "RBA", "AU", "https://www.rba.gov.au/rss/rss-cb-media-releases.xml"),
    ("snb", "SNB", "CH", "https://www.snb.ch/public/en/rss/pressrel"),
    ("eba", "EBA", "FR", "https://www.eba.europa.eu/news-press/news/rss.xml"),
    ("esma", "ESMA", "FR", "https://www.esma.europa.eu/rss.xml"),
    ("fca", "UK FCA", "GB", "https://www.fca.org.uk/news/rss.xml"),
]

status = {}  # file -> "ok" or failure reason


def get(src, name, url, timeout=40, deadline=75):
    """Download to RAW/src/name; return bytes or None (reason recorded)."""
    path = RAW / src / name
    key = f"{src}/{name}"
    if OFFLINE:
        if path.exists():
            status[key] = "ok"
            return path.read_bytes()
        status[key] = "not downloaded"
        return None
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        t0 = time.time()
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
        buf = bytearray()
        with urllib.request.urlopen(req, timeout=timeout) as r:
            while chunk := r.read1(65536):
                buf += chunk
                if time.time() - t0 > deadline or len(buf) > 80_000_000:
                    raise TimeoutError("download deadline or size cap exceeded")
        path.write_bytes(buf)
        status[key] = "ok"
        return bytes(buf)
    except Exception as e:  # any failure means the source is skipped
        status[key] = f"{type(e).__name__}: {e}"[:160]
        return None


def jload(b):
    if b is None:
        return None
    try:
        return json.loads(b.decode("utf-8-sig"))
    except ValueError as e:
        print("bad json:", e)
        return None


def clean(s, n=120):
    s = html.unescape(re.sub(r"<[^>]*>", " ", html.unescape(str(s or ""))))
    s = re.sub(r"(?i)\b(?:https?://|ftp://|www\.)\S+", "", s)
    s = " ".join(re.sub(r"[\x00-\x1f\x7f  ]", " ", s).split())
    return s if len(s) <= n else s[: n - 1].rstrip() + "…"


def pdate(s):
    s = str(s or "").strip()
    if not s:
        return None
    m = re.match(r"(\d{4})-(\d\d)-(\d\d)", s)
    try:
        if m:
            return dt.date(*map(int, m.groups()))
        return parsedate_to_datetime(s).date()
    except (ValueError, TypeError, IndexError, OverflowError):
        return None


world_text = (GRAPH / "fixtures" / "world.js").read_text(encoding="utf-8")
cpos = world_text.index('"countries"')
COUNTRIES = json.JSONDecoder().raw_decode(world_text[world_text.index("{", cpos):])[0]
# English short names (Unicode CLDR); world.js names are Russian.
EN = "AE:United Arab Emirates|AF:Afghanistan|AL:Albania|AM:Armenia|AO:Angola|AQ:Antarctica|AR:Argentina|AT:Austria|AU:Australia|AZ:Azerbaijan|BA:Bosnia & Herzegovina|BD:Bangladesh|BE:Belgium|BF:Burkina Faso|BG:Bulgaria|BI:Burundi|BJ:Benin|BM:Bermuda|BN:Brunei|BO:Bolivia|BR:Brazil|BS:Bahamas|BT:Bhutan|BW:Botswana|BY:Belarus|BZ:Belize|CA:Canada|CH:Switzerland|CI:Côte d’Ivoire|CL:Chile|CM:Cameroon|CN:China|CO:Colombia|CR:Costa Rica|CU:Cuba|CY:Cyprus|CZ:Czechia|DE:Germany|DJ:Djibouti|DK:Denmark|DO:Dominican Republic|DZ:Algeria|EC:Ecuador|EE:Estonia|EG:Egypt|ER:Eritrea|ES:Spain|ET:Ethiopia|FI:Finland|FJ:Fiji|FR:France|GA:Gabon|GB:United Kingdom|GE:Georgia|GG:Guernsey|GH:Ghana|GL:Greenland|GM:Gambia|GN:Guinea|GR:Greece|GT:Guatemala|GW:Guinea-Bissau|GY:Guyana|HK:Hong Kong SAR China|HN:Honduras|HR:Croatia|HT:Haiti|HU:Hungary|ID:Indonesia|IE:Ireland|IL:Israel|IM:Isle of Man|IN:India|IQ:Iraq|IR:Iran|IS:Iceland|IT:Italy|JE:Jersey|JM:Jamaica|JO:Jordan|JP:Japan|KE:Kenya|KG:Kyrgyzstan|KH:Cambodia|KP:North Korea|KR:South Korea|KW:Kuwait|KY:Cayman Islands|KZ:Kazakhstan|LA:Laos|LB:Lebanon|LK:Sri Lanka|LR:Liberia|LS:Lesotho|LT:Lithuania|LU:Luxembourg|LV:Latvia|LY:Libya|MA:Morocco|MC:Monaco|MD:Moldova|ME:Montenegro|MG:Madagascar|MH:Marshall Islands|ML:Mali|MM:Myanmar (Burma)|MN:Mongolia|MR:Mauritania|MT:Malta|MW:Malawi|MX:Mexico|MY:Malaysia|MZ:Mozambique|NA:Namibia|NC:New Caledonia|NE:Niger|NG:Nigeria|NH:Vanuatu|NI:Nicaragua|NL:Netherlands|NO:Norway|NP:Nepal|NZ:New Zealand|OM:Oman|PA:Panama|PE:Peru|PG:Papua New Guinea|PH:Philippines|PK:Pakistan|PL:Poland|PR:Puerto Rico|PT:Portugal|PY:Paraguay|QA:Qatar|RH:Zimbabwe|RO:Romania|RS:Serbia|RU:Russia|RW:Rwanda|SA:Saudi Arabia|SC:Seychelles|SD:Sudan|SE:Sweden|SG:Singapore|SI:Slovenia|SK:Slovakia|SL:Sierra Leone|SN:Senegal|SO:Somalia|SR:Suriname|SV:El Salvador|SY:Syria|SZ:Eswatini|TD:Chad|TG:Togo|TH:Thailand|TJ:Tajikistan|TL:Timor-Leste|TM:Turkmenistan|TN:Tunisia|TR:Türkiye|TW:Taiwan|TZ:Tanzania|UA:Ukraine|UG:Uganda|US:United States|UY:Uruguay|UZ:Uzbekistan|VC:St. Vincent & Grenadines|VD:Vietnam|VE:Venezuela|VG:British Virgin Islands|WS:Samoa|XK:Kosovo|YE:Yemen|ZA:South Africa|ZM:Zambia"
NAMES = {n.lower(): c for c, n in (x.split(":", 1) for x in EN.split("|")) if c in COUNTRIES}
ALIASES = {
    "united states": "US", "united states of america": "US", "usa": "US",
    "united kingdom": "GB", "united kingdom of great britain and northern ireland": "GB",
    "russian federation": "RU", "russia": "RU", "iran (islamic republic of)": "IR", "iran": "IR",
    "korea, north": "KP", "democratic people's republic of korea": "KP",
    "korea, south": "KR", "republic of korea": "KR", "syrian arab republic": "SY", "syria": "SY",
    "viet nam": "VN", "venezuela (bolivarian republic of)": "VE", "bolivia (plurinational state of)": "BO",
    "united republic of tanzania": "TZ", "democratic republic of the congo": "CD",
    "congo, democratic republic of the": "CD", "democratic republic of congo": "CD", "congo": "CG",
    "congo, republic of the": "CG", "burma": "MM", "côte d'ivoire": "CI", "cote d ivoire": "CI",
    "lao people's democratic republic": "LA", "türkiye": "TR", "turkey": "TR",
    "kingdom of saudi arabia": "SA", "the netherlands": "NL", "czech republic": "CZ",
    "central african republic": "CF", "south sudan": "SS", "dominican republic": "DO",
    "region: gaza": "PS", "west bank": "PS", "occupied palestinian territory": "PS",
    "bosnia and herzegovina": "BA", "kyrgyz republic": "KG", "lao pdr": "LA",
    "egypt, arab republic of": "EG", "yemen, republic of": "YE", "gambia, the": "GM", "equatorial guinea": "GQ", "north macedonia": "MK",
}
ALIASES = {k: v for k, v in ALIASES.items() if v in COUNTRIES}


def iso(name):
    n = " ".join(str(name or "").split()).strip().lower()
    n = re.sub(r"^the ", "", n)
    return ALIASES.get(n) or NAMES.get(n)


def ev(d, title, lon=None, lat=None, country=None, weight=1):
    d = pdate(d) if not isinstance(d, dt.date) else d
    title = clean(title)
    if d is None or d > GEN or d.year < 1990 or not title:
        return None
    try:
        lon, lat = float(lon), float(lat)
        if not (-180 <= lon <= 180 and -90 <= lat <= 90):
            lon = lat = None
    except (TypeError, ValueError):
        lon = lat = None
    if country not in COUNTRIES:
        country = None
    if lon is None and country:
        lon, lat = COUNTRIES[country]["at"]
    return {"d": d, "title": title, "lon": None if lon is None else round(lon, 2),
            "lat": None if lat is None else round(lat, 2), "country": country,
            "weight": round(float(weight), 2)}


def centroid(geom):
    pts = []

    def walk(c):
        if isinstance(c, list) and c:
            if isinstance(c[0], (int, float)):
                pts.append(c)
            else:
                for x in c:
                    walk(x)

    walk((geom or {}).get("coordinates"))
    if not pts:
        return None, None
    return sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts)


def rss(b):
    """Yield (date, title) from RSS 2.0 / RDF / Atom. DTDs are rejected."""
    if b is None or b"<!DOCTYPE" in b[:4000] or b"<!ENTITY" in b:
        return []
    try:
        root = ET.fromstring(b.lstrip())
    except (ET.ParseError, ValueError):
        return []
    out = []
    for it in root.iter():
        if it.tag.rsplit("}", 1)[-1] not in ("item", "entry"):
            continue
        f = {}
        for c in it:
            f.setdefault(c.tag.rsplit("}", 1)[-1], (c.text or "").strip())
        d = next((x for k in ("pubDate", "published", "date", "updated") if (x := pdate(f.get(k)))), None)
        if d and f.get("title"):
            out.append((d, f["title"]))
    return out


# ---------------------------------------------------------------- sources

def s_eonet():
    base = "https://eonet.gsfc.nasa.gov/api/v3/events?status={}&days=365"
    j = jload(get("eonet", "all.json", base.format("all"), 90, 150))
    events = (j or {}).get("events", [])
    if not j:
        for s in ("open", "closed"):
            events += (jload(get("eonet", s + ".json", base.format(s), 90, 150)) or {}).get("events", [])
    out = []
    for e in events:
        g = e.get("geometry") or []
        if not g:
            continue
        lon, lat = centroid(g[-1])
        cat = (e.get("categories") or [{}])[0]
        w = {"volcanoes": 5, "severeStorms": 4, "floods": 4, "earthquakes": 3, "seaLakeIce": 2}.get(cat.get("id"), 1)
        out.append(ev(g[0].get("date"), f"{cat.get('title', 'Event')}: {e.get('title')}", lon, lat, weight=w))
    return out


def s_gdacs():
    out, seen = [], set()
    for page in range(1, 31):
        url = ("https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=TC;FL;VO;DR;WF"
               f"&fromDate={YEAR_AGO}&toDate={GEN}&alertlevel=Green;Orange;Red&pageSize=100&pageNumber={page}")
        j = jload(get("gdacs", f"p{page}.json", url))
        new = 0
        for f in (j or {}).get("features", []):
            p = f.get("properties", {})
            key = (p.get("eventtype"), p.get("eventid"))
            if key in seen or p.get("eventtype") == "EQ":
                continue
            seen.add(key)
            new += 1
            lon, lat = centroid(f.get("geometry"))
            w = {"Red": 3, "Orange": 2}.get(p.get("alertlevel"), 1)
            out.append(ev(p.get("fromdate"), f"{p.get('alertlevel')} alert: {p.get('name') or p.get('description')}",
                          lon, lat, weight=w))
        if not new:
            break
        time.sleep(0.5)
    return out


def s_nws():
    j = jload(get("nws", "active.json", "https://api.weather.gov/alerts/active"))
    out = []
    for f in (j or {}).get("features", []):
        p = f.get("properties", {})
        if p.get("status") != "Actual" or p.get("messageType") == "Cancel":
            continue
        lon, lat = centroid(f.get("geometry"))
        w = {"Extreme": 4, "Severe": 3, "Moderate": 2}.get(p.get("severity"), 1)
        area = (p.get("areaDesc") or "").split(";")[0]
        out.append(ev(p.get("sent"), f"{p.get('event')} — {area}", lon, lat, weight=w))
    return out


def ncei(kind, name):
    base = f"https://www.ngdc.noaa.gov/hazel/hazard-service/api/v1/{kind}?minYear=2024"
    out = []
    j = jload(get("ncei", name + ".json", base))
    for x in (j or {}).get("items", []):
        try:
            d = dt.date(x["year"], x["month"], x["day"])
        except (KeyError, ValueError):
            continue
        if name == "tsunami":
            title = f"Tsunami: {x.get('locationName')}, {x.get('country')}"
            if x.get("maxWaterHeight") is not None:
                title += f"; max water height {x['maxWaterHeight']} m"
            w = 1 + math.log10(1 + (x.get("maxWaterHeight") or 0)) * 3
        else:
            title = f"Significant eruption: {x.get('name')}, {x.get('country')}"
            w = 3 + (x.get("vei") or 0)
        out.append(ev(d, title, x.get("longitude"), x.get("latitude"), iso(x.get("country")), w))
    return out


def s_gvp():
    b = get("gvp", "weekly.xml", "https://volcano.si.edu/news/WeeklyVolcanoRSS.xml")
    if b is None or b"<!DOCTYPE" in b[:4000] or b"<!ENTITY" in b:
        return []
    out = []
    for it in ET.fromstring(b.lstrip()).iter("item"):
        f = {c.tag.rsplit("}", 1)[-1]: (c.text or "") for c in it}
        pt = (f.get("point") or "").split()
        lat, lon = pt if len(pt) == 2 else (None, None)
        title = f.get("title", "")
        m = re.search(r"\(([^)]+)\)", title)
        out.append(ev(f.get("pubDate"), title, lon, lat, iso(m.group(1)) if m else None,
                      3 if "New" in title else 2))
    return out


def s_fireball():
    j = jload(get("cneos", "fireball.json", f"https://ssd-api.jpl.nasa.gov/fireball.api?date-min={YEAR_AGO}"))
    out = []
    for row in (j or {}).get("data", []):
        r = dict(zip(j["fields"], row))
        lat = lon = None
        if r.get("lat") and r.get("lon"):
            lat = float(r["lat"]) * (-1 if r["lat-dir"] == "S" else 1)
            lon = float(r["lon"]) * (-1 if r["lon-dir"] == "W" else 1)
        kt = float(r.get("impact-e") or 0)
        out.append(ev(r.get("date"), f"Fireball: estimated impact energy {kt} kt", lon, lat, weight=1 + kt))
    return out


def s_who():
    out = []
    for page in range(3):
        url = ("https://www.who.int/api/news/diseaseoutbreaknews?$orderby=PublicationDateAndTime%20desc"
               f"&$top=100&$skip={page * 100}&$select=Title,OverrideTitle,UseOverrideTitle,PublicationDateAndTime,DonId")
        rows = (jload(get("who", f"p{page}.json", url)) or {}).get("value", [])
        for x in rows:
            t = (x.get("OverrideTitle") if x.get("UseOverrideTitle") else None) or x.get("Title") or ""
            parts = re.split(r"\s*[–—]\s*|\s+-\s*|\s*-\s+", t)
            cc = iso(parts[-1]) if len(parts) > 1 else None
            out.append(ev(x.get("PublicationDateAndTime"), t, country=cc, weight=2))
        if len(rows) < 100:
            break
        time.sleep(0.5)
    return out


def s_kev():
    j = jload(get("kev", "kev.json", "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json"))
    return [ev(v.get("dateAdded"), f"{v.get('cveID')}: {v.get('vulnerabilityName')}",
               weight=3 if v.get("knownRansomwareCampaignUse") == "Known" else 1)
            for v in (j or {}).get("vulnerabilities", [])]


def s_llama():
    j = jload(get("llama", "hacks.json", "https://api.llama.fi/hacks"))
    out = []
    for x in j or []:
        try:
            d = dt.datetime.fromtimestamp(int(x["date"]), dt.timezone.utc).date()
        except (KeyError, ValueError, TypeError, OSError):
            continue
        amt = x.get("amount") or 0
        money = f", ${amt:,.0f}" if amt else ""
        out.append(ev(d, f"Hack: {x.get('name')}{money} ({x.get('technique') or x.get('classification')})",
                      weight=1 + math.log10(1 + amt)))
    return out


def s_fedreg():
    out, seen = [], set()
    for slug, short in (("securities-and-exchange-commission", "SEC"),
                        ("commodity-futures-trading-commission", "CFTC"),
                        ("treasury-department", "Treasury")):
        for page in range(1, 11):
            url = ("https://www.federalregister.gov/api/v1/documents.json?per_page=1000&order=newest"
                   f"&page={page}&conditions[agencies][]={slug}&conditions[publication_date][gte]={YEAR_AGO}"
                   f"&conditions[publication_date][lte]={GEN}"
                   "&fields[]=title&fields[]=publication_date&fields[]=type&fields[]=document_number")
            j = jload(get("fedreg", f"{short}-{page}.json", url))
            for x in (j or {}).get("results", []) or []:
                n = x.get("document_number")
                if n in seen:
                    continue
                seen.add(n)
                w = {"Presidential Document": 4, "Rule": 3, "Proposed Rule": 2.5}.get(x.get("type"), 1)
                out.append(ev(x.get("publication_date"), f"{short} {x.get('type')}: {x.get('title')}", weight=w))
            if not j or page >= (j.get("total_pages") or 0):
                break
            time.sleep(0.4)
    return out


def s_launch():
    out = []
    for page in range(5):  # anonymous limit is 15 requests per hour
        url = ("https://ll.thespacedevs.com/2.3.0/launches/previous/?limit=100&ordering=-net"
               f"&offset={page * 100}")
        j = jload(get("ll2", f"p{page}.json", url, 60, 100))
        rows = (j or {}).get("results", [])
        oldest = None
        for x in rows:
            d = pdate(x.get("net"))
            oldest = d or oldest
            if not d or d < YEAR_AGO:
                continue
            pad = x.get("pad") or {}
            st = (x.get("status") or {}).get("abbrev")
            out.append(ev(d, f"Launch ({st}): {x.get('name')}", pad.get("longitude"), pad.get("latitude"),
                          weight=3 if "Fail" in str(st) else 1))
        if len(rows) < 100 or (oldest and oldest < YEAR_AGO):
            break
        time.sleep(2)
    return out


def s_ofac():
    """Country counts only: distinct list entries with an address there. No names are read."""
    b = get("ofac", "add.csv",
            "https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/ADD.CSV", 60, 100)
    if b is None:
        b = get("ofac", "add_legacy.csv", "https://www.treasury.gov/ofac/downloads/add.csv", 60, 100)
    if b is None:
        return []
    per = {}
    for row in csv.reader(io.StringIO(b.decode("utf-8", "replace"))):
        if len(row) >= 5 and (cc := iso(row[4])):
            per.setdefault(cc, set()).add(row[0])
    out = []
    for cc, ids in per.items():
        e = ev(GEN, f"OFAC SDN: {COUNTRIES[cc]['name']} — записей с адресом в стране: {len(ids)}",
               country=cc, weight=len(ids))
        e["n"] = len(ids)
        out.append(e)
    return out


def s_banks():
    out = []
    for key, pub, cc, url in BANKS:
        for d, t in rss(get("banks", key + ".xml", url, 30, 50)):
            out.append(ev(d, f"{pub}: {t}", country=cc, weight=1))
    # US market regulators listed in radar/sources.json
    for i, f in enumerate(x for x in FEEDS if x["group"] == "Регуляторы"):
        for d, t in rss(get("banks", f"reg{i}.xml", f["url"], 30, 50)):
            out.append(ev(d, f"{f['name']}: {t}", country="US", weight=1))
    return out


def s_worldbank():
    j = jload(get("worldbank", "news.json",
                  "https://search.worldbank.org/api/v2/news?format=json&rows=500&os=0&srt=lnchdt&order=desc&lang_exact=English",
                  60, 100))
    out = []
    for x in (j or {}).get("documents", {}).values():
        if not isinstance(x, dict) or "title" not in x:
            continue
        t = x["title"]
        t = t.get("cdata!") if isinstance(t, dict) else t
        names = x.get("count")
        names = names if isinstance(names, str) else ""
        # only single-country items are placed on the map
        out.append(ev(x.get("lnchdt"), t, country=iso(names), weight=1))
    return out


def s_un():
    b = get("un", "news.xml", "https://news.un.org/feed/subscribe/en/news/all/rss.xml")
    return [ev(d, t) for d, t in rss(b)]


FEEDS = json.loads((GRAPH.parent / "radar" / "sources.json").read_text(encoding="utf-8"))["feeds"]


def s_crypto():
    feeds = [f for f in FEEDS if f["group"] != "Регуляторы"]

    def one(i_f):
        i, f = i_f
        items = rss(get("crypto", f"feed{i:02}.xml", f["url"], 25, 40))
        return [ev(d, f"{f['name']}: {t}", weight=2 if f["group"].startswith("Расслед") else 1)
                for d, t in items if d >= YEAR_AGO]

    with cf.ThreadPoolExecutor(8) as ex:
        return [e for part in ex.map(one, enumerate(feeds)) for e in part]


# id, Russian label, group, color, geo, loader
DATASETS = [
    ("eonet", "Природные события NASA EONET", "nature", "#ff7a1a", "exact", s_eonet),
    ("gdacs", "Оповещения о бедствиях GDACS (без землетрясений)", "nature", "#e5484d", "exact", s_gdacs),
    ("nws", "Активные погодные предупреждения NWS (США)", "nature", "#3aa0ff", "exact", s_nws),
    ("tsunami", "Цунами (NOAA NCEI)", "nature", "#00b8d9", "exact", lambda: ncei("tsunamis/events", "tsunami")),
    ("eruptions", "Значимые извержения (NOAA NCEI)", "nature", "#b5361c", "exact", lambda: ncei("volcanoes", "eruptions")),
    ("gvp", "Недельный отчёт о вулканах (Smithsonian GVP)", "nature", "#d9480f", "exact", s_gvp),
    ("fireballs", "Болиды (NASA/JPL CNEOS)", "nature", "#ffd43b", "exact", s_fireball),
    ("who", "Вспышки болезней (ВОЗ)", "security", "#37b24d", "country", s_who),
    ("kev", "Эксплуатируемые уязвимости (CISA KEV)", "security", "#ae3ec9", "none", s_kev),
    ("hacks", "Взломы в DeFi (DefiLlama)", "security", "#f03e8e", "none", s_llama),
    ("ofac", "Санкционный список OFAC по странам (срез)", "politics", "#868e96", "country", s_ofac),
    ("fedreg", "Federal Register: SEC, CFTC, Минфин США", "politics", "#7048e8", "none", s_fedreg),
    ("launches", "Космические запуски (Launch Library 2)", "politics", "#74c0fc", "exact", s_launch),
    ("un", "Новости ООН", "politics", "#4c6ef5", "none", s_un),
    ("banks", "Релизы центробанков и регуляторов", "markets", "#12b886", "country", s_banks),
    ("worldbank", "Новости Всемирного банка", "markets", "#0ca678", "country", s_worldbank),
    ("cryptonews", "Крипто- и финансовые новости (RSS)", "markets", "#f59f00", "none", s_crypto),
]


def run(row):
    try:
        events = [e for e in row[5]() if e]
    except Exception as e:  # unexpected shape: skip the source, record why
        status[row[0] + "/parse"] = f"{type(e).__name__}: {e}"[:160]
        events = []
    uniq = {(e["d"], e["title"], e["lon"], e["lat"]): e for e in events}
    print(row[0], len(uniq), flush=True)
    return list(uniq.values())


def main():
    RAW.mkdir(parents=True, exist_ok=True)
    if not OFFLINE and any(RAW.iterdir()):
        sys.exit("raw dir must be new and empty")
    with cf.ThreadPoolExecutor(len(DATASETS)) as ex:
        results = list(ex.map(run, DATASETS))

    datasets, cells, latest, months, stats = [], {}, [], {}, []
    used = [(row, evs) for row, evs in zip(DATASETS, results) if evs]
    for i, (row, evs) in enumerate(used):
        ident, label, group, color, geo, _ = row
        snapshot = ident == "ofac"
        geolocated = 0
        for e in evs:
            n = e.get("n", 1)
            age = (GEN - e["d"]).days
            if not snapshot:
                months.setdefault(e["d"].strftime("%Y-%m"), [0] * len(used))[i] += 1
            if e["lon"] is None:
                continue
            geolocated += n
            key = (min(math.floor(e["lon"]), 179) + 0.5, min(math.floor(e["lat"]), 89) + 0.5, i)
            c = cells.setdefault(key, [0, 0, 0])
            if not snapshot:
                c[0] += n if age < 7 else 0
                c[1] += n if age < 30 else 0
            c[2] += n
        total = sum(e.get("n", 1) for e in evs)
        lo, hi = min(e["d"] for e in evs), max(e["d"] for e in evs)
        datasets.append({"id": ident, "label": label, "group": group, "color": color, "total": total,
                         "from": str(lo), "to": str(hi), "geo": geo})
        pool = sorted(evs, key=lambda e: (e["d"], e["weight"], e["title"]), reverse=True)[:600]
        top = sorted(pool, key=lambda e: (e["weight"], e["d"], e["title"]), reverse=True)[:150]
        for e in sorted(top, key=lambda e: (e["d"], e["weight"], e["title"]), reverse=True):
            latest.append({"d": str(e["d"]), "ds": i, "title": e["title"], "lon": e["lon"], "lat": e["lat"],
                           "country": e["country"], "weight": e["weight"]})
        stats.append({"id": ident, "total": total, "geolocated": geolocated, "from": str(lo), "to": str(hi)})

    timeline = [{"date": m, "counts": c + [0] * (len(used) - len(c))} for m, c in sorted(months.items())]
    data = {"generated": str(GEN), "datasets": datasets,
            "cells": [[k[0], k[1], k[2], *v] for k, v in sorted(cells.items(), key=lambda kv: (kv[0][2], kv[0][0], kv[0][1]))],
            "latest": latest, "timeline": timeline, "companies": {}}
    dump = lambda x: json.dumps(x, ensure_ascii=False, separators=(",", ":"))
    body = ",\n".join(
        f"{dump(k)}:" + ("[\n" + ",\n".join(map(dump, v)) + "\n]" if isinstance(v, list) and v else dump(v))
        for k, v in data.items())
    out = ("// Generated aggregate of public event data. See ATTRIBUTION-events-extra.md.\n"
           "export default {\n" + body + "\n};\n")
    (GRAPH / "fixtures" / "events-extra.js").write_text(out, encoding="utf-8", newline="\n")
    report = {"bytes": len(out.encode()), "datasets": stats,
              "requests": dict(sorted(status.items())),
              "empty": [r[0] for r, e in zip(DATASETS, results) if not e]}
    (RAW / "build-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")
    print("bytes", report["bytes"], "empty", report["empty"])
    for k, v in report["requests"].items():
        if v != "ok":
            print("FAIL", k, v)
    for s in stats:
        print(s)


if __name__ == "__main__":
    main()
