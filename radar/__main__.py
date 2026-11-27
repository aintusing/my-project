"""Командная строка: python -m radar <команда>."""
import argparse
import json
import sys

from . import registry, watch
from .agents import discovery, edgar, feeds, insiders, social
from .scan import scan

MARKS = {"critical": "[!!!]", "high": "[ !!]", "medium": "[  !]", "info": "[  i]"}


def print_scan(report):
    market = report["market"]
    print(f"\n{market.get('symbol', '?')} {market.get('name', '')} | {report['chain']} | {report['address']}")
    if market:
        liquidity = market["liquidity_usd"]
        liquidity = "?" if liquidity is None else f"${liquidity:,}"
        print(f"Ликвидность {liquidity} | объём 24ч ${market['volume_24h_usd']:,} "
              f"| возраст пула, ч: {market['oldest_pool_age_hours']}")
    print(f"ВЕРДИКТ: {report['label']} (полнота проверки: {report['confidence']})")
    for finding in report["findings"]:
        print(f"  {MARKS[finding['severity']]} {finding['text']}  <{finding['source']}>")
    print("Источники:", ", ".join(f"{k}: {v}" for k, v in report["sources"].items()))
    print("Это не гарантия безопасности и не инвестиционная рекомендация.")


def main(argv=None):
    parser = argparse.ArgumentParser(prog="radar")
    parser.add_argument("--json", action="store_true", help="вывод в JSON")
    commands = parser.add_subparsers(dest="command", required=True)
    p = commands.add_parser("scan", help="проверить токен")
    p.add_argument("address")
    p.add_argument("--chain")
    p = commands.add_parser("discover", help="что сейчас раскручивают")
    p.add_argument("list", choices=sorted(discovery.LISTS), nargs="?", default="trending")
    p = commands.add_parser("news", help="новости изданий и регуляторов")
    p.add_argument("--find")
    p.add_argument("--risk", action="store_true")
    commands.add_parser("hacks", help="взломы за 30 дней")
    commands.add_parser("execs", help="свежие 8-K Item 5.02")
    commands.add_parser("insiders", help="свежие формы 4")
    commands.add_parser("social", help="Telegram и X")
    commands.add_parser("sources", help="реестр источников")
    p = commands.add_parser("watch", help="автообновление и панель")
    p.add_argument("--every", type=int, default=300, help="секунды, не меньше 120")
    p.add_argument("--tokens", type=int, default=12, help="сколько новых токенов проверять за цикл")
    p.add_argument("--data", default="data")
    p.add_argument("--port", type=int, help="показать панель на 127.0.0.1")
    p.add_argument("--once", action="store_true")
    args = parser.parse_args(argv)

    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    if args.command == "watch":
        watch.run(args.data, args.every, args.tokens, args.once, args.port)
        return 0
    if args.command == "sources":
        data = registry.load()
        if args.json:
            print(json.dumps(data, ensure_ascii=False, indent=2))
            return 0
        print(data["note"])
        for account in data["x_accounts"]:
            print(f"X   @{account['handle']:<20} {account['group']}")
        for channel in data["telegram"]:
            print(f"TG  {channel['channel']:<21} {channel['name']}")
        for entry in data["feeds"] + data["sites"]:
            print(f"WEB {entry['name']:<21} {entry['url']}")
        return 0

    status = None
    try:
        if args.command == "scan":
            data = scan(args.address, args.chain)
        elif args.command == "discover":
            data = discovery.LISTS[args.list]()[:20]
        elif args.command == "news":
            data, status = feeds.collect(args.find, args.risk)
        elif args.command == "social":
            telegram, status = social.telegram()
            x_items, x_status = social.x_posts()
            status.update(x_status)
            data = sorted(telegram + x_items, key=lambda i: i["updated"], reverse=True)[:30]
        elif args.command == "hacks":
            data = discovery.recent_hacks()
        elif args.command == "execs":
            data = edgar.executive_events()
        else:
            data = insiders.sec_form4()
    except Exception as error:
        print(f"Ошибка: {type(error).__name__}: {error}", file=sys.stderr)
        return 1

    if args.json:
        print(json.dumps(data if status is None else {"items": data, "sources": status},
                         ensure_ascii=False, indent=2))
        return 0
    if args.command == "scan":
        print_scan(data)
        return 0
    for row in data:
        if args.command in ("news", "social"):
            print(f"{row['updated'][:16]} [{row['source']}] {row['title']}\n    {row['link']}")
        elif args.command == "discover":
            print(f"{row['chain']:<12} {row['address']}  {row['note']}")
        elif args.command == "hacks":
            amount = f"${row['amount_usd']:,.0f}" if row["amount_usd"] else "?"
            print(f"{row['date']} {amount:>16} {row['name']} — {row['technique']}")
        elif args.command == "execs":
            print(f"{row['updated'][:16]} {row['company']}\n    {row['link']}")
        else:
            print(f"{row['updated'][:16]} {' | '.join(row['parties'])}\n    {row['link']}")
    if not data:
        print("Пусто: подходящих записей нет.")
    if status:
        print("\nИсточники:", ", ".join(f"{k}: {v}" for k, v in status.items()))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
