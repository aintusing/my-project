"""Деление на сферы. Крипта — по категории DefiLlama, акции — грубо по словам в названии."""
import re

CRYPTO = {
    "Биржи и обмен": ["CEX", "Dexs", "DEX Aggregator", "OTC Marketplace", "Trading App", "Telegram Bot", "DCA Tools"],
    "Кредитование и долг": ["Lending", "CDP", "CDP Manager", "Uncollateralized Lending", "NFT Lending", "NftFi", "Liquidations", "Collateral Markets", "Collateral Management", "Secondary Debt Markets"],
    "Доходность и стейкинг": ["Yield", "Farm", "Yield Aggregator", "Liquid Staking", "Staking Pool", "Restaking", "Liquid Restaking", "Leveraged Farming", "Liquidity Manager", "Liquidity Automation", "Yield Lottery", "Staking Rental", "Governance Incentives", "Restaked BTC"],
    "Деривативы и прогнозы": ["Derivatives", "Options", "Options Vault", "Synthetics", "Perps Aggregator", "Prediction Market", "Exotic Options", "Interest Rate Derivatives", "Basis Trading", "Indexes"],
    "Стейблкоины": ["Algo-Stables", "Stablecoin Issuer", "Stablecoin Wrapper", "Dual-Token Stablecoin", "Partially Algorithmic Stablecoin", "Reserve Currency"],
    "Мосты и инфраструктура": ["Bridge", "Canonical Bridge", "Cross Chain Bridge", "Bridge Aggregator", "Bridge Aggregators", "Chain", "Oracle", "MEV", "Block Builders", "Developer Tools", "Transaction Execution", "Mining Pools", "Domains", "Wallets", "Interface", "Anchor BTC", "Decentralized BTC"],
    "Реальные активы и платежи": ["RWA", "Payments", "Crypto Card Issuer", "Treasury Manager", "Onchain Capital Allocator", "Risk Curators", "Private Investment Platform", "CeDeFi", "Insurance"],
    "ИИ и DePIN": ["AI Agents", "Decentralized AI", "DePIN", "Video Infrastructure"],
    "Игры, NFT и соцсети": ["Gaming", "NFT Marketplace", "NFT Launchpad", "NFT Automated Strategies", "Physical TCG", "SoFi", "Gamified Mining", "Luck Games"],
    "Запуск токенов и мемы": ["Launchpad", "Meme", "Token Locker", "Volume Boosting", "Ponzi"],
    "Приватность и безопасность": ["Privacy", "Security Extension", "Bug Bounty", "Identity & Reputation"],
}
BY_CATEGORY = {category: sphere for sphere, categories in CRYPTO.items() for category in categories}

STOCK_WORDS = [
    ("Здоровье и биотех", r"pharm|therapeut|bio|medic|health|genomic|oncolog|surgical"),
    ("Финансы", r"bank|bancorp|bancshares|financ|capital|insur|trust|credit|asset|invest|holdings? acquisition|acquisition"),
    ("Технологии и ИИ", r"tech|software|semiconductor|data|cyber|digital|micro|systems|quantum|robot|\bai\b|cloud|network"),
    ("Энергия и сырьё", r"energy|oil|gas|petrol|solar|power|mining|gold|silver|lithium|uranium|metals|resources|chemical"),
    ("Недвижимость", r"realty|reit|propert|estate|homes"),
    ("Промышленность и транспорт", r"industr|motor|auto|aero|airlines|rail|shipping|logistic|marine|defense|construction"),
    ("Потребительский сектор и медиа", r"food|beverage|brands|retail|stores|restaurant|apparel|media|entertainment|gaming|hotel|education"),
]
STOCK_PATTERNS = [(name, re.compile(pattern, re.IGNORECASE)) for name, pattern in STOCK_WORDS]


def sphere_of(item):
    kind = item["kind"]
    if kind == "project":
        return BY_CATEGORY.get(item["category"], "Крипто: прочее")
    if kind == "coin":
        return "Запуск токенов и мемы" if item["category"] == "мемкоин" else "Монеты"
    if kind == "exchange":
        return "Биржи и обмен"
    if kind == "stock":
        for name, pattern in STOCK_PATTERNS:
            if pattern.search(item["name"]):
                return "Акции: " + name
        return "Акции: сфера не определена"
    return "Медиа и инсайдеры"
