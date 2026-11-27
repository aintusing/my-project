"""Оркестратор проверки токена."""
import concurrent.futures as cf
import re

from .agents import contract, insiders, judge, market
from .core import clean

EVM_ADDRESS = re.compile(r"0x[0-9a-fA-F]{40}")
SOLANA_ADDRESS = re.compile(r"[1-9A-HJ-NP-Za-km-z]{32,44}")


def _error(error):
    return clean(f"ошибка: {type(error).__name__}: {error}", 140)


def scan(address, chain=None):
    address = address.strip()
    is_evm = bool(EVM_ADDRESS.fullmatch(address))
    if not is_evm and not SOLANA_ADDRESS.fullmatch(address):
        raise ValueError("это не похоже на адрес токена EVM или Solana")

    sources, findings, facts, pairs = {}, [], {}, []
    try:
        pairs = market.load_pairs(address)
        sources["dexscreener"] = "ok" if pairs else "пулы не найдены"
    except Exception as error:
        sources["dexscreener"] = _error(error)
    chain = chain or (market.pick_chain(pairs) if is_evm else "solana")
    if chain:
        facts, market_findings = market.analyze(pairs, chain)
        findings += market_findings
    liquidity = facts.get("liquidity_usd")

    jobs = {}
    if chain == "solana":
        jobs["goplus"] = lambda: contract.goplus_solana(address)
        jobs["rugcheck"] = lambda: contract.rugcheck(address)
    else:
        if chain in contract.GOPLUS_CHAINS:
            jobs["goplus"] = lambda: contract.goplus_evm(address, chain)
        if chain in contract.HONEYPOT_CHAINS:
            jobs["honeypot.is"] = lambda: contract.honeypot_is(address, chain)
    if not jobs:
        sources["security"] = f"сеть {chain or 'не определена'} не поддерживается"

    security_ok = 0
    with cf.ThreadPoolExecutor(4) as pool:
        futures = {name: pool.submit(job) for name, job in jobs.items()}
        for name, future in futures.items():
            try:
                data = future.result()
                if name == "rugcheck":
                    new = contract.analyze_rugcheck(data) + insiders.analyze_solana(data, liquidity)
                elif name == "honeypot.is":
                    new = contract.analyze_honeypot(data)
                elif chain == "solana":
                    new = contract.analyze_goplus_solana(data)
                else:
                    new = contract.analyze_goplus_evm(data) + insiders.analyze_evm(data, liquidity)
                findings += new
                sources[name] = "ok"
                security_ok += 1
            except Exception as error:
                sources[name] = _error(error)

    result = judge.verdict(findings, security_ok)
    result["findings"] = [{**f.to_dict(), "text": clean(f.text, 200)} for f in result["findings"]]
    return {"address": address, "chain": chain, "market": facts, "sources": sources, **result}
