#!/usr/bin/env python3
"""Build graph/fixtures/candles.js: real daily candles for significant crypto assets.

Candidates come from fixtures/snapshot.js (groups coin and meme, best score first).
Candles come from the Binance public spot API. An asset is accepted only when the
CoinGecko public listing has the same symbol and exact name, and its price agrees
with the Binance SYMBOL/USDT price. Nothing is filled in or interpolated.

  py -3.12 -I build_candles.py --raw <new empty dir>             fetch and build
  py -3.12 -I build_candles.py --raw <existing dir> --offline    rebuild from raw

Downloads are untrusted data: they are only parsed as JSON.
"""
import argparse
import datetime as dt
import json
import pathlib
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from decimal import Decimal

GRAPH = pathlib.Path(__file__).resolve().parents[1]
UA = "radar-prototype/0.1"
BINANCE = "https://api.binance.com/api/v3/"
COINGECKO = "https://api.coingecko.com/api/v3/coins/markets"
TIMEOUT = 30
CAP = 40 * 1024 * 1024
MAX_BYTES = 2_500_000
MAX_SERIES = 120
DAYS = 365
MIN_CANDLES = 30
PRICE_TOLERANCE = 0.05
CG_PAGES = 4
HEADER = "// Generated daily candles. See ATTRIBUTION-candles.md.\n"

STABLE = set(
    "USDT USDC USDS USD1 DAI USDG RLUSD USDE PYUSD U FDUSD SOFID EURC BFUSD TUSD "
    "USDY USDD GHO USDF CRVUSD YLDS USDGO USAT REUSD OUSD AUSD APXUSD UUSD FIDD "
    "EURCV EURI XUSD USDP FRAX USD0 USTC".split()
)
GOLD = {"XAUT", "PAXG"}
WRAPPED = {"WBTC", "WBETH", "BNSOL"}
STOCK_NAME = re.compile(r"tokenized|xstock|bstocks", re.I)


def candidates():
    """Coin and meme nodes of the snapshot, highest score first (stable on ties)."""
    text = (GRAPH / "fixtures" / "snapshot.js").read_text(encoding="utf-8")

    def const(name):
        start = text.index(f"const {name} = ") + len(f"const {name} = ")
        return json.JSONDecoder().raw_decode(text, start)[0]

    groups = const("G")
    out = []
    for group, _sphere, _size, name, _country, meta in const("R"):
        if groups[group] in ("coin", "meme") and meta and meta.get("symbol"):
            out.append({"symbol": meta["symbol"], "name": name, "score": meta.get("score") or 0})
    out.sort(key=lambda c: -c["score"])
    return out


class Source:
    """JSON downloads cached under the raw directory."""

    def __init__(self, raw, offline):
        self.raw, self.offline = raw, offline

    def get(self, filename, url, params=None, pause=0.25):
        path = self.raw / filename
        if self.offline:
            return json.loads(path.read_bytes()) if path.exists() else None
        if params:
            url += "?" + urllib.parse.urlencode(params)
        request = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
        for attempt in (1, 2, 3):
            try:
                with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
                    body = response.read(CAP + 1)
                    used = int(response.headers.get("x-mbx-used-weight-1m") or 0)
                if len(body) > CAP:
                    raise RuntimeError(f"{filename}: response over size cap")
                path.write_bytes(body)
                time.sleep(60 if used > 3000 else pause)
                return json.loads(body)
            except urllib.error.HTTPError as error:
                # 429 is a rate limit: wait as told. Blocks (403, 418, 451) stop the run.
                if error.code == 429 and attempt < 3:
                    wait = int(error.headers.get("Retry-After") or 60)
                    if wait <= 120:
                        time.sleep(wait)
                        continue
                raise RuntimeError(f"{filename}: HTTP {error.code}") from None
            except (urllib.error.URLError, TimeoutError) as error:
                if attempt == 3:
                    raise RuntimeError(f"{filename}: {error}") from None
                time.sleep(3 * attempt)


def number(text):
    """Exchange decimal string as a compact JS literal, without float rounding."""
    value = Decimal(text)
    if not value.is_finite() or value < 0:
        raise ValueError(f"bad number {text!r}")
    out = format(value, "f")
    return (out.rstrip("0").rstrip(".") if "." in out else out) or "0"


def candles(rows, now_ms):
    """Completed days only, oldest first; invalid rows raise."""
    out = []
    for row in rows:
        opened, o, h, l, c, closed, quote = row[0], row[1], row[2], row[3], row[4], row[6], row[7]
        if closed >= now_ms:
            continue
        day = dt.datetime.fromtimestamp(opened / 1000, dt.timezone.utc).date().isoformat()
        o, h, l, c = (number(v) for v in (o, h, l, c))
        if not 0 < Decimal(l) <= min(Decimal(o), Decimal(c)) <= max(Decimal(o), Decimal(c)) <= Decimal(h):
            raise ValueError(f"inconsistent candle on {day}")
        if out and day <= out[-1][0]:
            raise ValueError(f"candles out of order on {day}")
        out.append((day, o, h, l, c, str(round(Decimal(number(quote))))))
    return out[-DAYS:]


def js(value):
    return json.dumps(value, ensure_ascii=False)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--raw", required=True, type=pathlib.Path)
    parser.add_argument("--offline", action="store_true")
    args = parser.parse_args()
    raw = args.raw.resolve()
    if raw.is_relative_to(GRAPH):
        sys.exit("--raw must be outside the project")
    if not args.offline:
        raw.mkdir(parents=True, exist_ok=True)
        if any(raw.iterdir()):
            sys.exit("--raw must be an empty directory")
    source = Source(raw, args.offline)

    meta_path = raw / "run.json"
    if args.offline:
        now_ms = json.loads(meta_path.read_bytes())["now_ms"]
    else:
        now_ms = source.get("time.json", BINANCE + "time")["serverTime"]
        meta_path.write_text(json.dumps({"now_ms": now_ms}), encoding="utf-8")
    today = dt.datetime.fromtimestamp(now_ms / 1000, dt.timezone.utc).date()
    yesterday = (today - dt.timedelta(days=1)).isoformat()

    info = source.get("exchangeInfo.json", BINANCE + "exchangeInfo", {"permissions": "SPOT"})
    trading = {
        s["baseAsset"]
        for s in info["symbols"]
        if s["quoteAsset"] == "USDT" and s["status"] == "TRADING"
    }
    prices = {t["symbol"]: float(t["price"]) for t in source.get("prices.json", BINANCE + "ticker/price")}

    gecko = {}
    for page in range(1, CG_PAGES + 1):
        rows = source.get(
            f"coingecko-{page}.json",
            COINGECKO,
            {"vs_currency": "usd", "order": "market_cap_desc", "per_page": 250, "page": page},
            pause=15,
        )
        if rows is None:
            sys.exit(f"missing CoinGecko page {page}")
        for row in rows:
            key = (str(row["symbol"]).upper(), row["name"])
            if row.get("current_price"):
                gecko.setdefault(key, []).append(float(row["current_price"]))

    series, skipped, seen = [], [], set()
    size = len(HEADER.encode()) + 200
    for item in candidates():
        if len(series) >= MAX_SERIES:
            break
        symbol, name = item["symbol"], item["name"]

        def skip(reason):
            skipped.append({"symbol": symbol, "name": name, "score": item["score"], "reason": reason})

        if STOCK_NAME.search(name):
            skip("tokenized stock or ETF")
        elif symbol in STABLE:
            skip("stablecoin or cash-like token")
        elif symbol in GOLD:
            skip("gold-pegged token")
        elif symbol in WRAPPED:
            skip("wrapped or staked duplicate")
        elif symbol not in trading:
            skip("no active Binance USDT spot market")
        elif symbol in seen:
            skip("duplicate symbol")
        else:
            pair = symbol + "USDT"
            reference = gecko.get((symbol, name))
            if not reference:
                skip("identity unverified: no CoinGecko match for symbol and name")
                continue
            if pair not in prices or not any(abs(prices[pair] / r - 1) <= PRICE_TOLERANCE for r in reference):
                skip("identity unverified: price differs from CoinGecko")
                continue
            try:
                rows = source.get(f"klines-{pair}.json", BINANCE + "klines",
                                  {"symbol": pair, "interval": "1d", "limit": DAYS + 1})
                if rows is None:
                    skip("no raw candles")
                    continue
                data = candles(rows, now_ms)
            except (RuntimeError, ValueError) as error:
                if "HTTP 4" in str(error):
                    raise
                skip(str(error))
                continue
            if len(data) < MIN_CANDLES:
                skip(f"under {MIN_CANDLES} completed candles")
            elif data[-1][0] != yesterday:
                skip("history is stale")
            elif all(0.97 <= float(r[4]) <= 1.03 for r in data):
                skip("price pegged near 1: treated as stablecoin")
            else:
                body = ",\n".join(f'["{r[0]}",{",".join(r[1:])}]' for r in data)
                block = f"{{symbol:{js(symbol)},name:{js(name)},quote:\"USDT\",candles:[\n{body}\n]}}"
                added = len(block.encode("utf-8")) + 2
                if size + added >= MAX_BYTES:
                    skip("file size limit")
                    continue
                size += added
                seen.add(symbol)
                series.append((symbol, block, len(data)))

    if not series:
        sys.exit("no series built")
    text = (
        HEADER
        + f"export default {{ generated: '{today.isoformat()}', source: 'Binance', series: [\n"
        + ",\n".join(block for _, block, _ in series)
        + "\n] };\n"
    )
    if "://" in text or len(text.encode("utf-8")) >= MAX_BYTES:
        sys.exit("output violates the contract")
    (GRAPH / "fixtures" / "candles.js").write_text(text, encoding="utf-8", newline="\n")

    report = {
        "generated": today.isoformat(),
        "last_day": yesterday,
        "series": len(series),
        "candles": sum(n for _, _, n in series),
        "full_history": sum(n == DAYS for _, _, n in series),
        "bytes": len(text.encode("utf-8")),
        "skipped": skipped,
    }
    (raw / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")
    reasons = {}
    for s in skipped:
        reasons.setdefault(s["reason"], []).append(s["symbol"])
    sys.stdout.reconfigure(encoding="utf-8")
    print({k: v for k, v in report.items() if k != "skipped"})
    for reason, symbols in sorted(reasons.items(), key=lambda kv: -len(kv[1])):
        print(f"{len(symbols)} {reason}: {' '.join(symbols)}")


if __name__ == "__main__":
    main()
