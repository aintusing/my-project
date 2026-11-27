"""Агент контракта: права владельца, продажа, налоги (GoPlus, honeypot.is, RugCheck)."""
from ..core import Finding, fetch_json, to_float

GOPLUS_CHAINS = {
    "ethereum": 1, "bsc": 56, "base": 8453, "arbitrum": 42161, "polygon": 137,
    "optimism": 10, "avalanche": 43114, "linea": 59144, "scroll": 534352,
}
HONEYPOT_CHAINS = {"ethereum": 1, "bsc": 56, "base": 8453}
ZERO_OWNERS = {"0x0000000000000000000000000000000000000000", "0x000000000000000000000000000000000000dead"}


def _on(data, key):
    return str(data.get(key)) == "1"


def goplus_evm(address, chain):
    url = f"https://api.gopluslabs.io/api/v1/token_security/{GOPLUS_CHAINS[chain]}?contract_addresses={address}"
    data = (fetch_json(url).get("result") or {}).get(address.lower())
    if not data:
        raise LookupError("токен не найден")
    return data


def analyze_goplus_evm(data):
    src, found = "goplus", []

    def add(severity, code, text):
        found.append(Finding(severity, code, text, src))

    if _on(data, "is_honeypot"):
        add("critical", "honeypot", "Honeypot: купить можно, продать нельзя")
    if _on(data, "cannot_sell_all"):
        add("high", "cannot_sell_all", "Нельзя продать весь остаток")
    if _on(data, "cannot_buy"):
        add("high", "cannot_buy", "Покупка заблокирована")
    if str(data.get("is_open_source")) == "0":
        add("high", "closed_source", "Исходный код не опубликован")
    if _on(data, "honeypot_with_same_creator"):
        add("high", "creator_history", "Создатель уже выпускал honeypot")
    for key, name in (("buy_tax", "покупку"), ("sell_tax", "продажу")):
        tax = to_float(data.get(key))
        if tax is None:
            add("info", f"{key}_unknown", f"Налог на {name} неизвестен")
        elif tax >= 0.5:
            add("critical", key, f"Налог на {name} {tax:.0%}")
        elif tax >= 0.1:
            add("high", key, f"Налог на {name} {tax:.0%}")
        elif tax >= 0.05:
            add("medium", key, f"Налог на {name} {tax:.0%}")

    # Владельческие функции опасны, только если ими есть кому управлять.
    owner = str(data.get("owner_address") or "").lower()
    renounced = (owner in ZERO_OWNERS
                 and str(data.get("hidden_owner")) == "0"
                 and str(data.get("can_take_back_ownership")) == "0"
                 and str(data.get("is_proxy")) == "0")
    for key, severity, text in (
        ("hidden_owner", "high", "Скрытый владелец"),
        ("can_take_back_ownership", "high", "Права владельца можно вернуть"),
        ("owner_change_balance", "critical", "Владелец может менять балансы"),
        ("selfdestruct", "high", "Контракт можно самоуничтожить"),
    ):
        if _on(data, key):
            add(severity, key, text)
    for key, severity, text in (
        ("is_mintable", "high", "Можно допечатать токены"),
        ("transfer_pausable", "high", "Переводы можно остановить"),
        ("slippage_modifiable", "high", "Налог можно изменить"),
        ("personal_slippage_modifiable", "high", "Налог можно задать отдельному кошельку"),
        ("is_blacklisted", "medium", "Есть чёрный список адресов"),
        ("is_proxy", "medium", "Прокси: код можно заменить"),
        ("external_call", "medium", "Внешние вызовы в переводе"),
    ):
        if _on(data, key):
            if renounced:
                add("info", key, f"{text} (владелец обнулён)")
            else:
                add(severity, key, text)
    return found


def goplus_solana(address):
    url = f"https://api.gopluslabs.io/api/v1/solana/token_security?contract_addresses={address}"
    result = fetch_json(url).get("result") or {}
    data = result.get(address)
    if not data:
        raise LookupError("токен не найден")
    return data


def analyze_goplus_solana(data):
    src, found = "goplus", []
    for key, severity, text in (
        ("mintable", "high", "Активна эмиссия (mint authority)"),
        ("freezable", "high", "Счета можно замораживать"),
        ("balance_mutable_authority", "critical", "Есть право менять чужие балансы"),
        ("closable", "high", "Токен-программу можно закрыть"),
        ("transfer_fee_upgradable", "high", "Комиссию перевода можно изменить"),
        ("transfer_hook_upgradable", "high", "Логику перевода можно подменить"),
        ("metadata_mutable", "info", "Метаданные можно менять"),
    ):
        if str((data.get(key) or {}).get("status")) == "1":
            found.append(Finding(severity, key, text, src))
    if _on(data, "non_transferable"):
        found.append(Finding("critical", "non_transferable", "Токен нельзя передать", src))
    if data.get("transfer_hook"):
        found.append(Finding("medium", "transfer_hook", "Перевод проходит через внешнюю программу", src))
    return found


def honeypot_is(address, chain):
    url = f"https://api.honeypot.is/v2/IsHoneypot?address={address}&chainID={HONEYPOT_CHAINS[chain]}"
    return fetch_json(url)


def analyze_honeypot(data):
    src = "honeypot.is"
    if (data.get("honeypotResult") or {}).get("isHoneypot"):
        return [Finding("critical", "honeypot", "Симуляция продажи провалилась: honeypot", src)]
    if not data.get("simulationSuccess"):
        raise LookupError("симуляция не выполнена")
    found = []
    tax = to_float((data.get("simulationResult") or {}).get("sellTax"))
    if tax is not None and tax >= 10:
        severity = "critical" if tax >= 50 else "high"
        found.append(Finding(severity, "sell_tax", f"Симуляция: налог на продажу {tax:.0f}%", src))
    return found


def rugcheck(address):
    return fetch_json(f"https://api.rugcheck.xyz/v1/tokens/{address}/report")


def analyze_rugcheck(data):
    src, found = "rugcheck", []
    if data.get("rugged"):
        found.append(Finding("critical", "rugged", "Отмечен как уже случившийся rug pull", src))
    if data.get("mintAuthority"):
        found.append(Finding("high", "mintable", "Активна эмиссия (mint authority)", src))
    if data.get("freezeAuthority"):
        found.append(Finding("high", "freezable", "Счета можно замораживать", src))
    levels = {"danger": "high", "warn": "medium"}
    for risk in data.get("risks") or []:
        found.append(Finding(levels.get(risk.get("level"), "info"), "rugcheck_risk",
                             str(risk.get("name", "риск"))[:120], src))
    return found
