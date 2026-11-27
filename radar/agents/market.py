"""Агент рынка: сеть, ликвидность, возраст пула, объём (DexScreener)."""
import time

from ..core import Finding, clean, fetch_json, to_float

SOURCE = "dexscreener"


def load_pairs(address):
    data = fetch_json(f"https://api.dexscreener.com/latest/dex/tokens/{address}")
    pairs = data.get("pairs") or []
    wanted = address.lower()
    return [p for p in pairs if (p.get("baseToken") or {}).get("address", "").lower() == wanted]


def liquidity_of(pair):
    return to_float((pair.get("liquidity") or {}).get("usd")) or 0.0


def pick_chain(pairs):
    totals = {}
    for pair in pairs:
        chain = pair.get("chainId")
        totals[chain] = totals.get(chain, 0.0) + liquidity_of(pair)
    return max(totals, key=totals.get) if totals else None


def analyze(pairs, chain, now_ms=None):
    pairs = [p for p in pairs if p.get("chainId") == chain]
    if not pairs:
        return {}, []
    now_ms = now_ms or time.time() * 1000
    top = max(pairs, key=liquidity_of)
    known = any(to_float((p.get("liquidity") or {}).get("usd")) is not None for p in pairs)
    liquidity = sum(liquidity_of(p) for p in pairs) if known else None
    volume = sum(to_float((p.get("volume") or {}).get("h24")) or 0.0 for p in pairs)
    created = [p["pairCreatedAt"] for p in pairs if p.get("pairCreatedAt") is not None]
    age_hours = (now_ms - min(created)) / 3_600_000 if created else None
    facts = {
        "name": clean(top["baseToken"].get("name"), 60),
        "symbol": clean(top["baseToken"].get("symbol"), 20),
        "chain": chain,
        "price_usd": to_float(top.get("priceUsd")),
        "liquidity_usd": None if liquidity is None else round(liquidity),
        "volume_24h_usd": round(volume),
        "oldest_pool_age_hours": None if age_hours is None else round(age_hours, 1),
        "url": clean(top.get("url"), 200),
    }
    found = []
    if liquidity is None:
        found.append(Finding("medium", "liquidity_unknown", "Ликвидность неизвестна (например, bonding curve)", SOURCE))
    elif liquidity < 10_000:
        found.append(Finding("high", "thin_liquidity", f"Ликвидность ${liquidity:,.0f}: выйти почти невозможно", SOURCE))
    elif liquidity < 50_000:
        found.append(Finding("medium", "low_liquidity", f"Низкая ликвидность ${liquidity:,.0f}", SOURCE))
    if age_hours is not None and age_hours < 24:
        found.append(Finding("medium", "fresh_pool", f"Пулу {age_hours:.1f} ч: истории нет", SOURCE))
    if liquidity and volume / liquidity > 20:
        found.append(Finding("medium", "volume_anomaly", f"Объём в {volume / liquidity:.0f} раз больше ликвидности: возможна накрутка", SOURCE))
    return facts, found
