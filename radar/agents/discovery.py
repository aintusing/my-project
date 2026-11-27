"""Агент разведки: что сейчас раскручивают и какие были взломы."""
import time

from ..core import clean, fetch_json


def boosted():
    # Boost на DexScreener — платное продвижение, а не знак качества.
    data = fetch_json("https://api.dexscreener.com/token-boosts/latest/v1")
    return [{"chain": clean(t.get("chainId")), "address": clean(t.get("tokenAddress")),
             "note": clean(t.get("description"), 80)} for t in data]


def _pools(kind):
    data = fetch_json(f"https://api.geckoterminal.com/api/v2/networks/{kind}")
    rows = []
    for pool in data.get("data", []):
        attributes = pool.get("attributes", {})
        token = ((pool.get("relationships", {}).get("base_token") or {}).get("data") or {}).get("id", "")
        chain, _, address = token.rpartition("_")
        rows.append({"chain": clean(chain), "address": clean(address),
                     "note": clean(f"{attributes.get('name')} | liq ${attributes.get('reserve_in_usd')}", 80)})
    return rows


def trending_pools():
    return _pools("trending_pools")


def new_pools():
    return _pools("new_pools")


def coingecko_trending():
    data = fetch_json("https://api.coingecko.com/api/v3/search/trending")
    return [{"chain": "-", "address": clean(c["item"].get("id")),
             "note": clean(f"{c['item'].get('symbol')} {c['item'].get('name')}", 80)}
            for c in data.get("coins", [])]


def recent_hacks(days=30):
    since = time.time() - days * 86400
    rows = [h for h in fetch_json("https://api.llama.fi/hacks") if (h.get("date") or 0) >= since]
    rows.sort(key=lambda h: h["date"], reverse=True)
    return [{"date": time.strftime("%Y-%m-%d", time.gmtime(h["date"])), "name": clean(h.get("name"), 60),
             "amount_usd": h.get("amount"), "technique": clean(h.get("technique"), 80)} for h in rows]


LISTS = {"boosted": boosted, "trending": trending_pools, "new": new_pools, "coingecko": coingecko_trending}
