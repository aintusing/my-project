"""Агент инсайдеров: концентрация держателей, создатель, блокировка ликвидности,
а для акций — свежие формы 4 (сделки инсайдеров по данным SEC)."""
from ..core import Finding, to_float
from . import edgar

BURN = {"0x0000000000000000000000000000000000000000", "0x000000000000000000000000000000000000dead"}
SMALL_POOL_USD = 1_000_000


def concentration_finding(percent, source):
    note = f"10 крупнейших кошельков держат {percent:.0f}% (среди них могут быть биржи)"
    if percent >= 50:
        return Finding("high", "concentration", note, source)
    if percent >= 30:
        return Finding("medium", "concentration", note, source)
    return Finding("info", "concentration", note, source)


def analyze_evm(data, liquidity_usd=None):
    src, found = "goplus", []
    wallets = [h for h in data.get("holders") or []
               if str(h.get("is_contract")) != "1" and str(h.get("is_locked")) != "1"
               and str(h.get("address", "")).lower() not in BURN]
    if data.get("holders"):
        top = sum(to_float(h.get("percent")) or 0 for h in wallets[:10]) * 100
        found.append(concentration_finding(top, src))
    creator = to_float(data.get("creator_percent"))
    if creator is not None and creator >= 0.05:
        severity = "high" if creator >= 0.2 else "medium"
        found.append(Finding(severity, "creator_holding", f"У создателя {creator:.0%} эмиссии", src))
    lp = data.get("lp_holders") or []
    small = liquidity_usd is not None and liquidity_usd < SMALL_POOL_USD
    if small and not _main_pool_is_v2(data):
        # В пулах V3/V4 позиции — NFT, список LP-держателей ничего не доказывает.
        found.append(Finding("info", "lp_unverifiable",
                             "Главный пул не V2: блокировку ликвидности проверить вручную", src))
    elif small and lp:
        locked = sum(to_float(h.get("percent")) or 0 for h in lp
                     if str(h.get("is_locked")) == "1" or str(h.get("address", "")).lower() in BURN)
        if locked < 0.5:
            found.append(Finding("high", "lp_unlocked",
                                 f"Заблокировано или сожжено лишь {locked:.0%} LP: ликвидность могут вынуть", src))
    return found


def _main_pool_is_v2(data):
    pools = data.get("dex") or []
    if not pools:
        return False
    main = max(pools, key=lambda p: to_float(p.get("liquidity")) or 0)
    return str(main.get("liquidity_type", "")).endswith("V2")


def analyze_solana(report, liquidity_usd=None):
    src, found = "rugcheck", []
    known = report.get("knownAccounts") or {}

    def is_pool(holder):
        for key in (holder.get("owner"), holder.get("address")):
            if (known.get(key) or {}).get("type") == "AMM":
                return True
        return False

    holders = [h for h in report.get("topHolders") or [] if not is_pool(h)]
    if holders:
        found.append(concentration_finding(sum(to_float(h.get("pct")) or 0 for h in holders[:10]), src))
    supply = to_float((report.get("token") or {}).get("supply"))
    balance = to_float(report.get("creatorBalance"))
    if supply and balance and balance / supply >= 0.05:
        severity = "high" if balance / supply >= 0.2 else "medium"
        found.append(Finding(severity, "creator_holding", f"У создателя {balance / supply:.0%} эмиссии", src))
    insiders = report.get("graphInsidersDetected") or 0
    if insiders:
        # Граф переводов шумный даже у крупных токенов, поэтому это подсказка, а не приговор.
        found.append(Finding("info", "insider_graph",
                             f"Связанных кошельков по графу переводов: {insiders}. Проверить вручную", src))
    markets = report.get("markets") or []
    if markets and liquidity_usd is not None and liquidity_usd < SMALL_POOL_USD:
        deepest = max(markets, key=_market_usd)
        locked = to_float((deepest.get("lp") or {}).get("lpLockedPct"))
        if locked is not None and locked < 50:
            found.append(Finding("high", "lp_unlocked",
                                 f"В главном пуле заблокировано лишь {locked:.0f}% LP", src))
    return found


def _market_usd(market):
    lp = market.get("lp") or {}
    return (to_float(lp.get("baseUSD")) or 0) + (to_float(lp.get("quoteUSD")) or 0)


def sec_form4(limit=20):
    """Лента форм 4. Одна подача приходит дважды (эмитент и лицо), объединяем."""
    filings = {}
    for entry in edgar.current_filings("4", owner="only"):
        if entry["form"] != "4":
            continue
        item = filings.setdefault(entry["id"], {"updated": entry["updated"], "link": entry["link"], "parties": []})
        item["parties"].append(entry["title"])
    return list(filings.values())[:limit]
