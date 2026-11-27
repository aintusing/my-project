# Attribution: daily candles

File: `fixtures/candles.js`, built by `tools/build_candles.py`.

## Source

- Candles: Binance public spot market data API (`api.binance.com`, `/api/v3/klines`, `interval=1d`), keyless.
- Market list and current prices: `/api/v3/exchangeInfo` and `/api/v3/ticker/price` from the same API.
- Identity check only: CoinGecko public API (`/coins/markets`, top 1000 by market cap), keyless. Data provided by CoinGecko. None of its values are stored in `candles.js`.
- Asset list and display names: `fixtures/snapshot.js`.
- Requests used User-Agent `radar-prototype/0.1`.

## Date and counts

- Retrieved: 2026-11-27. Last completed UTC day in the file: 2026-11-26.
- 120 series (111 coins, 9 memecoins), 42782 daily candles, 2225433 bytes.
- 113 series have 365 candles. Shorter ones: HYPE 64, AERO 133, GRAM 148, NIGHT 261, SENT 309, ZAMA 298, 币安人生 324. Only what Binance returned for the symbol is included.
- 99 higher- or equal-ranked candidates were passed over before the limit of 120 was reached:
  - 58 had no active Binance USDT spot market;
  - 30 stablecoins or cash-like tokens;
  - 8 tokenized stocks or ETFs;
  - 2 gold-pegged tokens (XAUT, PAXG);
  - 1 duplicate symbol (the second AERO node, Aerodrome Finance).

## Method

- Order: snapshot `meta.score`, highest first; ties keep snapshot order.
- An asset is accepted only if CoinGecko lists the same symbol with the exact snapshot name, and its price is within 5% of the Binance USDT price at retrieval.
- The check compares current identity. It does not prove that older history had no token swap, rename or redenomination under the same symbol.
- The unfinished current day is dropped. Missing days are never filled or interpolated.
- Row: date (UTC open day), open, high, low, close, quote volume in USDT. Prices keep the exchange's decimals (trailing zeros removed); quote volume is rounded to a whole number.
- Prices and volumes describe Binance only, not the whole market.

## Terms

Redistribution rights are **unverified**. Public, keyless access does not by itself grant permission to store, republish or commercially use this data. Review the current Binance API terms of use and the CoinGecko API terms before publishing or distributing `candles.js` or anything derived from it. This note is not legal advice.

## Rebuild

```
py -3.12 -I tools/build_candles.py --raw <new empty dir outside the project>
py -3.12 -I tools/build_candles.py --raw <same dir> --offline
node --test test/candles.test.js
```
