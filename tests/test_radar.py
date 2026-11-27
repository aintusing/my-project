"""Офлайн-тесты правил: без сети."""
import unittest

from radar import dashboard, registry, watch
from radar.agents import contract, feeds, insiders, judge, market, social
from radar.core import Finding, clean
from radar.scan import scan
from radar.store import Store, now

ZERO = "0x0000000000000000000000000000000000000000"


def codes(findings, severity=None):
    return {f.code for f in findings if severity in (None, f.severity)}


class JudgeTests(unittest.TestCase):
    def test_silence_is_not_safety(self):
        self.assertEqual(judge.verdict([], 0)["level"], "unknown")

    def test_medium_without_security_is_unknown(self):
        self.assertEqual(judge.verdict([Finding("medium", "a", "a", "x")], 0)["level"], "unknown")

    def test_worst_wins(self):
        found = [Finding("medium", "a", "a", "x"), Finding("critical", "b", "b", "y")]
        self.assertEqual(judge.verdict(found, 2)["level"], "critical")

    def test_clean_token(self):
        self.assertEqual(judge.verdict([], 2)["level"], "none")


class ContractTests(unittest.TestCase):
    def test_honeypot_and_tax(self):
        found = contract.analyze_goplus_evm({"is_honeypot": "1", "sell_tax": "0.99", "buy_tax": "0"})
        self.assertLessEqual({"honeypot", "sell_tax"}, codes(found, "critical"))

    def test_unknown_tax_is_reported(self):
        found = contract.analyze_goplus_evm({"sell_tax": "", "buy_tax": "0"})
        self.assertIn("sell_tax_unknown", codes(found))

    def test_renounced_owner_downgrades(self):
        data = {"owner_address": ZERO, "hidden_owner": "0", "can_take_back_ownership": "0",
                "is_proxy": "0", "is_mintable": "1", "buy_tax": "0", "sell_tax": "0"}
        self.assertIn("is_mintable", codes(contract.analyze_goplus_evm(data), "info"))

    def test_empty_owner_is_not_renounced(self):
        data = {"owner_address": "", "hidden_owner": "0", "can_take_back_ownership": "0",
                "is_proxy": "0", "is_mintable": "1"}
        self.assertIn("is_mintable", codes(contract.analyze_goplus_evm(data), "high"))

    def test_failed_simulation_is_not_ok(self):
        with self.assertRaises(LookupError):
            contract.analyze_honeypot({"simulationSuccess": False})

    def test_solana_authorities(self):
        found = contract.analyze_goplus_solana({"mintable": {"status": "1"}, "freezable": {"status": "0"}})
        self.assertEqual(codes(found), {"mintable"})


class InsiderAndMarketTests(unittest.TestCase):
    def test_contracts_and_burn_excluded(self):
        data = {"holders": [
            {"address": "0xaaa", "is_contract": 1, "percent": "0.9"},
            {"address": ZERO, "is_contract": 0, "percent": "0.05"},
            {"address": "0xbbb", "is_contract": 0, "percent": "0.02"}]}
        self.assertEqual(codes(insiders.analyze_evm(data), "info"), {"concentration"})

    def test_unlocked_lp_in_small_pool(self):
        data = {"lp_holders": [{"address": "0xaaa", "is_locked": 0, "percent": "1"}],
                "dex": [{"liquidity_type": "UniV2", "liquidity": "5000"}]}
        self.assertIn("lp_unlocked", codes(insiders.analyze_evm(data, 5000), "high"))

    def test_v3_pool_is_not_called_unlocked(self):
        data = {"lp_holders": [{"address": "0xaaa", "is_locked": 0, "percent": "1"}],
                "dex": [{"liquidity_type": "UniV3", "liquidity": "5000"}]}
        self.assertEqual(codes(insiders.analyze_evm(data, 5000)), {"lp_unverifiable"})

    def test_missing_liquidity_is_unknown_not_zero(self):
        pair = {"chainId": "solana", "baseToken": {"name": "X", "symbol": "X"}}
        facts, found = market.analyze([pair], "solana")
        self.assertIsNone(facts["liquidity_usd"])
        self.assertEqual(codes(found), {"liquidity_unknown"})

    def test_market_flags(self):
        pair = {"chainId": "base", "baseToken": {"name": "X", "symbol": "X"},
                "liquidity": {"usd": 1000}, "volume": {"h24": 90000}, "pairCreatedAt": 0}
        _, found = market.analyze([pair], "base", now_ms=3_600_000)
        self.assertEqual(codes(found), {"thin_liquidity", "fresh_pool", "volume_anomaly"})


class UpdateTests(unittest.TestCase):
    def row(self, **extra):
        return {"link": "https://e.test/1", "source": "s", "title": "t",
                "updated": now().isoformat(), **extra}

    def test_duplicates_are_not_new(self):
        store = Store(":memory:")
        self.assertEqual(len(store.add("news", [self.row()])), 1)
        self.assertEqual(store.add("news", [self.row()]), [])
        store.close()

    def test_old_items_skipped(self):
        store = Store(":memory:")
        self.assertEqual(store.add("news", [self.row(updated="2000-01-01T00:00:00+00:00")]), [])
        store.close()

    def test_telegram_parsing_skips_reply_quote(self):
        page = ('<div data-post="chan/5"><div class="tgme_widget_message_text js">quoted</div>'
                '<div class="tgme_widget_message_text js">real<br/>post &amp; more</div>'
                '<time datetime="2026-01-01T00:00:00+00:00"></time></div>')
        post = social.parse_telegram(page, "c")[0]
        self.assertEqual((post["title"], post["link"]), ("real post & more", "https://t.me/chan/5"))

    def test_x_without_token_is_silent(self):
        import os
        from unittest import mock
        with mock.patch.dict(os.environ, {}, clear=True):
            items, status = social.x_posts()
        self.assertEqual(items, [])
        self.assertIn("не подключён", status["X"])

    def test_x_queries_fit_limit_and_cover_all(self):
        handles = [a["handle"] for a in registry.load()["x_accounts"]]
        queries = list(social._queries(handles))
        self.assertTrue(all(len(q) <= 480 for q in queries))
        self.assertEqual(sum(q.count("from:") for q in queries), len(handles))

    def test_registry_has_no_duplicates(self):
        data = registry.load()
        handles = [a["handle"].lower() for a in data["x_accounts"]]
        self.assertEqual(len(handles), len(set(handles)))

    def test_token_choice_keeps_watchlist_first(self):
        lists = [[{"address": "b"}, {"address": "a"}], [{"address": "c"}]]
        self.assertEqual(watch.pick_tokens(["a"], lists, 2), ["a", "b", "c"])

    def test_dashboard_escapes_external_text(self):
        store = Store(":memory:")
        store.add("news", [self.row(title="<script>x()</script>", link="javascript:alert(1)")])
        page = dashboard.render(store, registry.load(), {}, "now")
        store.close()
        self.assertNotIn("<script>x()", page)
        self.assertNotIn('href="javascript:', page)


class SafetyTests(unittest.TestCase):
    def test_control_characters_removed(self):
        self.assertNotIn("\x1b", clean("bad\x1b[2Jname"))

    def test_entity_xml_rejected(self):
        with self.assertRaises(ValueError):
            feeds.parse_feed(b'<!DOCTYPE a [<!ENTITY b "c">]><a/>')

    def test_bad_address_rejected_before_network(self):
        with self.assertRaises(ValueError):
            scan("../../etc?x=1")


if __name__ == "__main__":
    unittest.main()
