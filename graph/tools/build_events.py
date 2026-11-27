"""Build graph/fixtures/events.js from locally downloaded public data.

Usage (Python 3.12, stdlib only, no network access):
    python -I build_events.py <raw_folder> [--sec-loc sec_loc.json] [--generated YYYY-MM-DD]

The raw folder is treated as untrusted data (it is only read). Layout and download URLs:

  <raw>/gdelt/YYYYMMDD.export.CSV.zip
      https://data.gdeltproject.org/events/YYYYMMDD.export.CSV.zip
  <raw>/usgs/*.csv   (split the period so each request stays under 20000 rows)
      https://earthquake.usgs.gov/fdsnws/event/1/query?format=csv&minmagnitude=2.5
          &orderby=time&starttime=...&endtime=...
  <raw>/sec/*.gz     (optional; one master.gz per quarter, renamed e.g. 2026-QTR3.master.gz)
      https://www.sec.gov/Archives/edgar/full-index/<year>/QTR<n>/master.gz

Send a neutral User-Agent and keep the request rate low. SEC may refuse automated
clients; see ATTRIBUTION-events.md. Prints build statistics as JSON to stdout.
"""
import argparse
import csv
import datetime as dt
import gzip
import io
import json
import math
import re
import zipfile
from collections import Counter, defaultdict
from pathlib import Path

GRAPH = Path(__file__).resolve().parents[1]
LATEST_MAX = 150
SIZE_MAX = 2_500_000

# id, Russian label, group, color, geo
GDELT_SETS = [
    ("gdelt_diplomacy", "Дипломатия и заявления (по СМИ)", "politics", "#4f8ef7", "exact"),
    ("gdelt_aid", "Сотрудничество, помощь и уступки (по СМИ)", "politics", "#34c38f", "exact"),
    ("gdelt_pressure", "Требования, обвинения и угрозы (по СМИ)", "politics", "#f2b134", "exact"),
    ("gdelt_sanctions", "Разрыв отношений и санкции (по СМИ)", "politics", "#9b6dff", "exact"),
    ("gdelt_protest", "Протесты (по СМИ)", "conflict", "#ff8a3d", "exact"),
    ("gdelt_conflict", "Силовые действия и конфликты (по СМИ)", "conflict", "#e5484d", "exact"),
]
ROOT_SET = {**{f"{i:02d}": 0 for i in range(1, 6)}, "06": 1, "07": 1, "08": 1,
            **{f"{i:02d}": 2 for i in range(9, 14)}, "16": 3, "14": 4,
            "15": 5, "17": 5, "18": 5, "19": 5, "20": 5}
ROOT_RU = {
    "01": "публичное заявление", "02": "обращение или призыв", "03": "намерение сотрудничать",
    "04": "консультации", "05": "дипломатическое сотрудничество", "06": "материальное сотрудничество",
    "07": "помощь", "08": "уступка", "09": "расследование", "10": "требование", "11": "осуждение",
    "12": "отказ", "13": "угроза", "14": "протест", "15": "демонстрация силы",
    "16": "сокращение отношений или санкции", "17": "принуждение", "18": "нападение",
    "19": "боевые действия", "20": "массовое насилие",
}
USGS_SET = ("usgs_quakes", "Землетрясения M2.5+", "nature", "#c9884a", "exact")
SEC_SETS = [
    ("sec_current", "Текущие отчёты 8-K", "markets", "#00b8d9", "country"),
    ("sec_form4", "Сделки инсайдеров (форма 4)", "markets", "#2dd4bf", "country"),
    ("sec_stakes", "Крупные пакеты (13D/13G)", "markets", "#7dd3fc", "country"),
    ("sec_reports", "Отчётность 10-K и 10-Q", "markets", "#60a5fa", "country"),
    ("sec_offers", "Размещения и продажи (S-1, 144)", "markets", "#a5b4fc", "country"),
]

# FIPS 10-4 country code (used by GDELT) -> ISO 3166-1 alpha-2
FIPS_ISO = dict(p.split(":") for p in """
AA:AW AC:AG AE:AE AF:AF AG:DZ AJ:AZ AL:AL AM:AM AN:AD AO:AO AQ:AS AR:AR AS:AU AU:AT AV:AI AY:AQ BA:BH
BB:BB BC:BW BD:BM BE:BE BF:BS BG:BD BH:BZ BK:BA BL:BO BM:MM BN:BJ BO:BY BP:SB BR:BR BT:BT BU:BG BX:BN
BY:BI CA:CA CB:KH CD:TD CE:LK CF:CG CG:CD CH:CN CI:CL CJ:KY CK:CC CM:CM CN:KM CO:CO CQ:MP CS:CR CT:CF
CU:CU CV:CV CW:CK CY:CY DA:DK DJ:DJ DO:DM DR:DO EC:EC EG:EG EI:IE EK:GQ EN:EE ER:ER ES:SV ET:ET EZ:CZ
FG:GF FI:FI FJ:FJ FK:FK FM:FM FO:FO FP:PF FR:FR GA:GM GB:GA GG:GE GH:GH GI:GI GJ:GD GK:GG GL:GL GM:DE
GP:GP GQ:GU GR:GR GT:GT GV:GN GY:GY GZ:PS HA:HT HK:HK HO:HN HR:HR HU:HU IC:IS ID:ID IM:IM IN:IN IR:IR
IS:IL IT:IT IV:CI IZ:IQ JA:JP JE:JE JM:JM JO:JO KE:KE KG:KG KN:KP KR:KI KS:KR KT:CX KU:KW KV:XK KZ:KZ
LA:LA LE:LB LG:LV LH:LT LI:LR LO:SK LS:LI LT:LS LU:LU LY:LY MA:MG MB:MQ MC:MO MD:MD MF:YT MG:MN MH:MS
MI:MW MJ:ME MK:MK ML:ML MN:MC MO:MA MP:MU MR:MR MT:MT MU:OM MV:MV MX:MX MY:MY MZ:MZ NC:NC NE:NU NF:NF
NG:NE NH:VU NI:NG NL:NL NN:SX NO:NO NP:NP NR:NR NS:SR NU:NI NZ:NZ OD:SS PA:PY PC:PN PE:PE PK:PK PL:PL
PM:PA PO:PT PP:PG PS:PW PU:GW QA:QA RE:RE RI:RS RM:MH RN:MF RO:RO RP:PH RQ:PR RS:RU RW:RW SA:SA SB:PM
SC:KN SE:SC SF:ZA SG:SN SH:SH SI:SI SL:SL SM:SM SN:SG SO:SO SP:ES ST:LC SU:SD SV:SJ SW:SE SY:SY SZ:CH
TB:BL TD:TT TH:TH TI:TJ TK:TC TL:TK TN:TO TO:TG TP:ST TS:TN TT:TL TU:TR TV:TV TW:TW TX:TM TZ:TZ UC:CW
UG:UG UK:GB UP:UA US:US UV:BF UY:UY UZ:UZ VC:VC VE:VE VI:VG VM:VN VQ:VI VT:VA WA:NA WE:PS WF:WF WI:EH
WS:WS WZ:SZ YM:YE ZA:ZM ZI:ZW
""".split())

# trailing part of a USGS place name that means the United States ("Georgia" is resolved by longitude)
US_STATES = {s.replace("_", " ") for s in """Alabama Alaska Arizona Arkansas California Colorado
Connecticut Delaware Florida Hawaii Idaho Illinois Indiana Iowa Kansas Kentucky Louisiana Maine Maryland
Massachusetts Michigan Minnesota Mississippi Missouri Montana Nebraska Nevada New_Hampshire New_Jersey
New_Mexico New_York North_Carolina North_Dakota Ohio Oklahoma Oregon Pennsylvania Rhode_Island
South_Carolina South_Dakota Tennessee Texas Utah Vermont Virginia Washington West_Virginia Wisconsin
Wyoming CA AK NV HI WA OR UT ID MT WY OK TX""".split()}


def clean(text, limit=120):
    """Strip markup, control characters and anything URL-like from untrusted text."""
    text = re.sub(r"(?i)\b(?:https?|ftp)://\S*|\bwww\.\S*", "", text)
    text = "".join(c for c in text if c.isprintable() and c not in "<>`\\�")
    text = " ".join(text.split())
    # JavaScript measures length in UTF-16 units
    while len(text.encode("utf-16-le")) // 2 > limit:
        text = text[:-1]
    return text


def coords(lat, lon):
    try:
        lat, lon = float(lat), float(lon)
    except ValueError:
        return None
    if not (-90 <= lat <= 90 and -180 <= lon <= 180) or (lat == 0 and lon == 0):
        return None
    return lon, lat


def parse_day(text):
    try:
        return dt.date.fromisoformat(text)
    except ValueError:
        return None


class Agg:
    def __init__(self, generated):
        self.generated = generated
        self.total = Counter()
        self.unlocated = Counter()
        self.days = Counter()                       # (ds, date) -> n
        self.cells = defaultdict(lambda: [0, 0, 0])  # (lon, lat, ds) -> [7d, 30d, all]

    def add(self, ds, day, point, grid=True):
        self.total[ds] += 1
        self.days[ds, day] += 1
        if point is None:
            self.unlocated[ds] += 1
            return
        if grid:  # centre of the 1-degree square
            point = (min(math.floor(point[0]), 179) + 0.5, min(math.floor(point[1]), 89) + 0.5)
        cell = self.cells[point[0], point[1], ds]
        age = (self.generated - day).days
        cell[0] += age < 7
        cell[1] += age < 30
        cell[2] += 1


def read_gdelt(folder, agg, offset, stats):
    seen, names = set(), {}
    recent = [{} for _ in GDELT_SETS]  # place -> best candidate
    s = stats["gdelt"] = Counter()
    for path in sorted(folder.glob("*.export.CSV.zip")):
        s["files"] += 1
        with zipfile.ZipFile(path) as z, z.open(z.namelist()[0]) as raw:
            for line in io.TextIOWrapper(raw, encoding="utf-8", errors="replace", newline="\n"):
                r = line.rstrip("\r\n").split("\t")
                s["rows"] += 1
                if len(r) != 58 or not r[0].isdigit():
                    s["malformed"] += 1
                    continue
                gid = int(r[0])
                if gid in seen:
                    s["duplicate_id"] += 1
                    continue
                seen.add(gid)
                local = ROOT_SET.get(r[28])
                if local is None:
                    s["no_category"] += 1
                    continue
                added = r[56][:8]
                day = parse_day(f"{added[:4]}-{added[4:6]}-{added[6:]}")
                if day is None or day > agg.generated:
                    s["bad_date"] += 1
                    continue
                ds = offset + local
                point = coords(r[53], r[54]) if r[49] in ("1", "2", "3", "4", "5") else None
                agg.add(ds, day, point)
                if point is None:
                    continue
                iso = FIPS_ISO.get(r[51])
                if r[49] == "1":
                    s["country_centroid"] += 1
                    if iso:
                        names.setdefault(r[50], iso)
                elif r[49] in ("2", "5"):
                    s["state_centroid"] += 1
                if (agg.generated - day).days < 7 and r[31].isdigit():
                    place = clean(r[50], 70)
                    weight = int(r[31])
                    best = recent[local].get(place)
                    if place and (best is None or (weight, day) > (best["weight"], parse_day(best["d"]))):
                        recent[local][place] = {
                            "d": day.isoformat(), "ds": ds,
                            "title": clean(f"По СМИ (авто-кодирование): {ROOT_RU[r[28]]} — {place} · "
                                           f"CAMEO {r[28]}, упоминаний: {weight}"),
                            "lon": round(point[0], 3), "lat": round(point[1], 3),
                            "country": iso, "weight": weight}
    latest = []
    for group in recent:
        latest += sorted(group.values(), key=lambda e: (-e["weight"], e["title"]))[:LATEST_MAX]
    return latest, names


def read_usgs(folder, agg, ds, names, stats):
    seen, events = set(), []
    s = stats["usgs"] = Counter()
    for path in sorted(folder.glob("*.csv")):
        s["files"] += 1
        with path.open(encoding="utf-8", errors="replace", newline="") as f:
            for r in csv.DictReader(f):
                s["rows"] += 1
                if r.get("id") in seen:
                    s["duplicate_id"] += 1
                    continue
                seen.add(r.get("id"))
                if r.get("type") != "earthquake":
                    s["not_earthquake"] += 1
                    continue
                day = parse_day((r.get("time") or "")[:10])
                if day is None or day > agg.generated:
                    s["bad_date"] += 1
                    continue
                point = coords(r.get("latitude", ""), r.get("longitude", ""))
                agg.add(ds, day, point)
                try:
                    mag = float(r.get("mag", ""))
                except ValueError:
                    continue
                if point and (agg.generated - day).days < 30:
                    place = r.get("place") or "место не указано"
                    tail = place.rsplit(", ", 1)[-1].removesuffix(" region").strip()
                    events.append({
                        "d": day.isoformat(), "ds": ds,
                        "title": clean(f"Землетрясение M{mag:.1f} — {place}"),
                        "lon": round(point[0], 3), "lat": round(point[1], 3),
                        "country": "US" if tail in US_STATES or (tail == "Georgia" and point[0] < 0)
                        else "MX" if tail == "MX" else names.get(tail),
                        "weight": round(mag, 2)})
    return sorted(events, key=lambda e: (e["weight"], e["d"]), reverse=True)[:LATEST_MAX]


def sec_category(form):
    base = form.removesuffix("/A")
    if base == "8-K":
        return 0
    if base == "4":
        return 1
    if base in ("SC 13D", "SC 13G", "SCHEDULE 13D", "SCHEDULE 13G"):
        return 2
    if base in ("10-K", "10-Q"):
        return 3
    if base in ("S-1", "144"):
        return 4
    return None


def load_module(path):
    text = path.read_text(encoding="utf-8")
    return json.loads(text[text.index("export default") + 14:].strip().rstrip(";"))


def stock_names(stocks_csv, snapshot):
    """CIK -> stock node name, limited to names that exist in the graph snapshot."""
    nodes = {n["name"] for n in load_module(snapshot)["nodes"] if n.get("group") == "stock"}
    result = {}
    with stocks_csv.open(encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            m = re.search(r"CIK=0*(\d+)", row.get("url") or "")
            if m and row.get("name") in nodes:
                result.setdefault(m[1], row["name"])
    return result


def read_sec(folder, agg, offset, locations, stocks, countries, stats):
    s = stats["sec"] = Counter()
    filings = defaultdict(list)  # (category, accession) -> [(cik, name, form, date)]
    start = agg.generated - dt.timedelta(days=365)
    for path in sorted(folder.glob("*.gz")):
        s["files"] += 1
        with gzip.open(path, "rt", encoding="latin-1") as f:
            for line in f:
                r = line.rstrip("\r\n").split("|")
                if len(r) != 5 or not r[0].isdigit():
                    continue
                s["rows"] += 1
                local, day = sec_category(r[2]), parse_day(r[3])
                if local is None or day is None or not start < day <= agg.generated:
                    s["other_form_or_date"] += 1
                    continue
                accession = r[4].rsplit("/", 1)[-1]
                filings[local, accession].append((str(int(r[0])), r[1], r[2], day))
    latest, companies = [[] for _ in SEC_SETS], {}
    for (local, accession), parties in filings.items():
        # a filing is listed once per filer: prefer the listed company over other parties
        cik, name, form, day = sorted(parties, key=lambda p: (p[0] not in stocks, p[0] not in locations, p[0]))[0]
        country = (locations.get(cik) or "").split("-")[0] or None
        point = tuple(countries[country]["at"]) if country in countries else None
        agg.add(offset + local, day, point, grid=False)
        listed = {stocks[p[0]] for p in parties if p[0] in stocks}
        for company in listed:
            c = companies.setdefault(company, {"total": 0, "form4": 0, "current": 0, "last": ""})
            c["total"] += 1
            c["form4"] += local == 1
            c["current"] += local == 0
            c["last"] = max(c["last"], day.isoformat())
        # titles are built only for listed companies, so no private person can be named
        if point and cik in stocks:
            latest[local].append({
                "d": day.isoformat(), "ds": offset + local,
                "title": clean(f"{stocks[cik]} — форма {form}"),
                "lon": point[0], "lat": point[1], "country": country, "weight": 1})
    out = []
    for group in latest:
        out += sorted(group, key=lambda e: (e["d"], e["title"]), reverse=True)[:LATEST_MAX]
    return out, companies


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("raw", type=Path)
    ap.add_argument("--sec-loc", type=Path)
    ap.add_argument("--generated", type=dt.date.fromisoformat, default=dt.date(2026, 11, 27))
    ap.add_argument("--out", type=Path, default=GRAPH / "fixtures" / "events.js")
    args = ap.parse_args()

    agg, stats = Agg(args.generated), {}
    has_sec = any((args.raw / "sec").glob("*.gz"))
    sets = (SEC_SETS if has_sec else []) + GDELT_SETS + [USGS_SET]
    gdelt_at = len(SEC_SETS) if has_sec else 0
    usgs_at = len(sets) - 1

    latest, companies = [], {}
    if has_sec:
        if not args.sec_loc:
            ap.error("--sec-loc is required when SEC index files are present")
        latest, companies = read_sec(
            args.raw / "sec", agg, 0,
            json.loads(args.sec_loc.read_text(encoding="utf-8")),
            stock_names(GRAPH.parents[1] / "catalog" / "out" / "stocks.csv", GRAPH / "fixtures" / "snapshot.js"),
            load_module(GRAPH / "fixtures" / "world.js")["countries"], stats)
    gdelt_latest, names = read_gdelt(args.raw / "gdelt", agg, gdelt_at, stats)
    latest += gdelt_latest + read_usgs(args.raw / "usgs", agg, usgs_at, names, stats)

    missing = [sets[i][0] for i in range(len(sets)) if not agg.total[i]]
    if missing:
        raise SystemExit(f"no events parsed for: {missing}")

    datasets = []
    for i, (ident, label, group, color, geo) in enumerate(sets):
        days = [d for (ds, d) in agg.days if ds == i]
        datasets.append({"id": ident, "label": label, "group": group, "color": color,
                         "total": agg.total[i], "from": min(days).isoformat(),
                         "to": max(days).isoformat(), "geo": geo})
    first = min(d for _, d in agg.days)
    last = max(d for _, d in agg.days)
    timeline = []
    for n in range((last - first).days + 1):
        day = first + dt.timedelta(n)
        timeline.append({"date": day.isoformat(),
                         "counts": [agg.days.get((i, day), 0) for i in range(len(sets))]})
    cells = [[lon, lat, ds, *v] for (lon, lat, ds), v in sorted(agg.cells.items(), key=lambda k: (k[0][2], k[0][:2]))]
    latest.sort(key=lambda e: (e["d"], e["weight"]), reverse=True)

    data = {"generated": args.generated.isoformat(), "datasets": datasets, "cells": cells,
            "latest": latest, "timeline": timeline, "companies": companies}
    dumps = lambda v: json.dumps(v, ensure_ascii=False, separators=(",", ":"))
    body = ",\n".join(f"{k}:{dumps(v)}" for k, v in data.items())
    text = ("// Generated aggregate of public event data. See ATTRIBUTION-events.md.\n"
            f"export default {{\n{body}\n}};\n")
    size = len(text.encode("utf-8"))
    if size >= SIZE_MAX:
        raise SystemExit(f"output too large: {size} bytes")
    args.out.write_text(text, encoding="utf-8", newline="\n")

    stats["datasets"] = {d["id"]: {"total": d["total"], "unlocated": agg.unlocated[i],
                                   "from": d["from"], "to": d["to"],
                                   "latest": sum(e["ds"] == i for e in latest)}
                         for i, d in enumerate(datasets)}
    stats.update(cells=len(cells), companies=len(companies), bytes=size)
    print(json.dumps(stats, indent=1))


if __name__ == "__main__":
    main()
