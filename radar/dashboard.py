"""Панель: один самодостаточный HTML. Все внешние строки экранируются."""
from html import escape

LEVEL_ORDER = {"critical": 0, "high": 1, "medium": 2, "unknown": 3, "none": 4}

STYLE = """
:root{--bg:#0d1117;--card:#161b22;--line:#30363d;--text:#e6edf3;--dim:#8b949e;
--critical:#ff4d4f;--high:#ff8c37;--medium:#e3b341;--unknown:#8b949e;--none:#3fb950;--link:#58a6ff}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:14px/1.45 system-ui,sans-serif}
header{padding:16px;border-bottom:1px solid var(--line)}h1{margin:0 0 4px;font-size:20px}
h2{font-size:15px;margin:0 0 8px}.dim{color:var(--dim);font-size:12px}
input,button{background:var(--card);color:var(--text);border:1px solid var(--line);border-radius:6px;padding:7px 10px;font:inherit}
input{width:100%;max-width:420px;margin-top:10px}nav{display:flex;flex-wrap:wrap;gap:6px;padding:12px 16px 0}
button{cursor:pointer}button[aria-selected=true]{border-color:var(--link);color:var(--link)}
section{display:none;margin:12px 16px;background:var(--card);border:1px solid var(--line);border-radius:8px;padding:12px}
section.on{display:block}.row{padding:8px 0;border-top:1px solid var(--line);overflow-wrap:anywhere}
a{color:var(--link);text-decoration:none}.tag{display:inline-block;border:1px solid currentColor;border-radius:4px;padding:0 6px;font-size:12px;font-weight:600}
.critical{color:var(--critical)}.high{color:var(--high)}.medium{color:var(--medium)}.unknown{color:var(--unknown)}.none{color:var(--none)}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px}.chips a{border:1px solid var(--line);border-radius:14px;padding:3px 10px}
"""

SCRIPT = """
const tabs=[...document.querySelectorAll('button[data-tab]')],box=document.getElementById('q');
function show(id){tabs.forEach(b=>b.setAttribute('aria-selected',b.dataset.tab===id));
document.querySelectorAll('section').forEach(s=>s.classList.toggle('on',s.id===id));sessionStorage.tab=id}
function filter(){const q=box.value.toLowerCase();sessionStorage.q=box.value;
document.querySelectorAll('.row').forEach(r=>r.hidden=!r.textContent.toLowerCase().includes(q))}
tabs.forEach(b=>b.onclick=()=>show(b.dataset.tab));box.oninput=filter;
box.value=sessionStorage.q||'';show(document.getElementById(sessionStorage.tab)?sessionStorage.tab:tabs[0].dataset.tab);filter();
setInterval(()=>{if(document.activeElement!==box)location.reload()},60000);
"""


def link(url, label):
    if not str(url).startswith(("https://", "http://")):
        return escape(str(label))
    return f'<a href="{escape(str(url))}" target="_blank" rel="noopener noreferrer">{escape(str(label))}</a>'


def item_rows(items):
    if not items:
        return '<p class="dim">Пока пусто.</p>'
    return "".join(
        f'<div class="row"><div class="dim">{escape(i["published"][:16].replace("T", " "))} UTC · '
        f'{escape(i["source"])}</div>{link(i["link"], i["title"] or i["link"])}</div>' for i in items)


def token_rows(tokens):
    if not tokens:
        return '<p class="dim">Токены ещё не проверялись.</p>'
    rows = []
    for token in sorted(tokens, key=lambda t: LEVEL_ORDER.get(t["level"], 9)):
        market = token.get("market") or {}
        liquidity = market.get("liquidity_usd")
        liquidity = "?" if liquidity is None else f"${liquidity:,}"
        flags = "".join(f'<div class="{escape(f["severity"])}">• {escape(f["text"])}</div>'
                        for f in token["findings"] if f["severity"] != "info")
        title = f'{market.get("symbol", "?")} · {token.get("chain")}'
        rows.append(
            f'<div class="row"><span class="tag {escape(token["level"])}">{escape(token["label"])}</span> '
            f'{link(market.get("url", ""), title)} <span class="dim">ликвидность {liquidity} · '
            f'проверено {escape(token.get("checked", "")[11:16])} UTC</span>'
            f'<div class="dim">{escape(token["address"])}</div>{flags}</div>')
    return "".join(rows)


def source_rows(sources):
    parts = [f'<p class="medium">{escape(sources["note"])}</p>']
    groups = {}
    for account in sources["x_accounts"]:
        groups.setdefault("X: " + account["group"], []).append(
            link(f'https://x.com/{account["handle"]}', f'{account["name"]} @{account["handle"]}'))
    groups["Telegram"] = [link(f'https://t.me/s/{c["channel"]}', c["name"]) for c in sources["telegram"]]
    for key, prefix in (("sites", "Сайты: "), ("feeds", "Ленты: ")):
        for entry in sources[key]:
            groups.setdefault(prefix + entry["group"], []).append(link(entry["url"], entry["name"]))
    for name, links in groups.items():
        parts.append(f'<h2>{escape(name)} ({len(links)})</h2><div class="chips">{"".join(links)}</div>')
    return "".join(parts)


def render(store, sources, status, updated):
    sections = [
        ("tokens", "Мемкоины и риск", token_rows(store.tokens())),
        ("alerts", "Тревоги", item_rows(store.items(risk=True))),
        ("social", "Инсайдеры: TG и X", item_rows(store.items("social"))),
        ("news", "Издания", item_rows(store.items("news"))),
        ("hacks", "Взломы", item_rows(store.items("hack"))),
        ("sec", "Руководители и формы 4", item_rows(store.items("sec"))),
        ("registry", "Реестр источников", source_rows(sources)),
        ("health", "Состояние", "".join(
            f'<div class="row">{escape(k)}: <span class="{"none" if v.startswith("ok") else "high"}">{escape(v)}</span></div>'
            for k, v in sorted(status.items()))),
    ]
    nav = "".join(f'<button data-tab="{key}">{escape(title)}</button>' for key, title, _ in sections)
    body = "".join(f'<section id="{key}"><h2>{escape(title)}</h2>{content}</section>'
                   for key, title, content in sections)
    return (
        '<!doctype html><html lang="ru"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; script-src \'unsafe-inline\'">'
        f'<title>Radar</title><style>{STYLE}</style></head><body><header><h1>Radar: мемкоины, крипта, инсайдеры</h1>'
        f'<div class="dim">Обновлено {escape(updated)} UTC · записей {store.count()} · не инвестиционная рекомендация. '
        'Отсутствие флагов не означает безопасность.</div>'
        f'<input id="q" type="search" placeholder="Фильтр: тикер, имя, слово" aria-label="Фильтр"></header>'
        f'<nav>{nav}</nav>{body}<script>{SCRIPT}</script></body></html>')
