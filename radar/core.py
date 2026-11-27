"""Общий слой: HTTP, типы, безопасный вывод внешних строк."""
import json
import os
import urllib.request
from dataclasses import asdict, dataclass

TIMEOUT = 25
MAX_BYTES = 20_000_000
DEFAULT_UA = "radar-prototype/0.1"

SEVERITIES = ("critical", "high", "medium", "info")


@dataclass(frozen=True)
class Finding:
    severity: str  # critical | high | medium | info
    code: str
    text: str
    source: str

    def to_dict(self):
        return asdict(self)


def fetch(url, user_agent=None):
    headers = {"User-Agent": user_agent or DEFAULT_UA, "Accept": "*/*"}
    request = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
        body = response.read(MAX_BYTES + 1)
    if len(body) > MAX_BYTES:
        raise ValueError("ответ слишком большой")
    return body


def fetch_json(url):
    return json.loads(fetch(url))


def sec_user_agent():
    # SEC просит указывать контакт в User-Agent. Пользователь задаёт его сам.
    return os.environ.get("SEC_USER_AGENT") or DEFAULT_UA


def clean(value, limit=160):
    """Названия токенов и заголовки приходят извне: убираем управляющие символы."""
    text = "".join(c if c.isprintable() else " " for c in str(value or ""))
    text = " ".join(text.split())
    return text[:limit]


def to_float(value):
    """None означает «неизвестно», а не ноль."""
    try:
        return float(value)
    except (TypeError, ValueError):
        return None
