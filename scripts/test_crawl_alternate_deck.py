"""Tests for crawl-alternate-deck.py against a small saved excerpt of the page.
Run: python3 -m unittest discover -s scripts -p 'test_*.py'"""
import importlib.util
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("crawl_alternate_deck", HERE / "crawl-alternate-deck.py")
crawl = importlib.util.module_from_spec(spec)
spec.loader.exec_module(crawl)

HTML = (HERE / "fixtures/ltk-cards-excerpt.html").read_text(encoding="utf-8")


def pairs(card):
    return [(p["suit"], p["rank"]) for p in card["printings"]]


class ParseDistribution(unittest.TestCase):
    def test_repeated_rank_is_a_copy(self):
        got = crawl.parse_distribution("黑桃7/8/8，红桃Q")
        self.assertEqual(
            [(p["suit"], p["rank"]) for p in got],
            [("spade", 7), ("spade", 8), ("spade", 8), ("heart", 12)],
        )

    def test_face_ranks(self):
        got = crawl.parse_distribution("梅花A/J/K")
        self.assertEqual([p["rank"] for p in got], [1, 11, 13])

    def test_refuses_to_guess(self):
        for bad in ("4黑2红", "黑桃Z", "黑桃14"):
            with self.assertRaises(crawl.CardError):
                crawl.parse_distribution(bad)


class ParseExcerpt(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cards, cls.skipped = crawl.parse_cards(HTML, "guozhan")
        cls.cards = {c["nameZh"]: c for c in cards}

    def test_nothing_skipped(self):
        self.assertEqual(self.skipped, [])

    def test_only_the_requested_edition_is_taken(self):
        # Standard lists 7 spades for Slash; 国战 starts at 5 and has 21 cards in all.
        self.assertEqual(len(self.cards["杀"]["printings"]), 21)
        self.assertEqual(self.cards["杀"]["printings"][0], {"rank": 5, "suit": "spade"})

    def test_missing_effect_text_is_none_not_a_guess(self):
        self.assertIsNone(self.cards["杀"]["text"])

    def test_text_in_a_second_row_of_the_same_edition(self):
        # 过河拆桥 has a 国战 row for the suits and another for the effect text.
        card = self.cards["过河拆桥"]
        self.assertEqual(pairs(card), [("spade", 3), ("spade", 4), ("heart", 12)])
        self.assertIn("弃置目标角色的区域里的一张牌", card["text"])

    def test_text_in_a_full_width_row(self):
        self.assertIn("获得目标角色的区域里的一张牌", self.cards["顺手牵羊"]["text"])

    def test_distribution_cell_shared_by_two_editions(self):
        # 青釭剑's cell spans 标准 and 国战 (rowspan=2): both get exactly its printings.
        card = self.cards["青釭剑"]
        self.assertEqual(pairs(card), [("spade", 6)])
        self.assertEqual((card["category"], card["subtype"], card["range"]), ("equipment", "weapon", 2))

    def test_edition_with_its_own_cell_beside_standard(self):
        # 八卦阵: Standard has ♠2 ♣2, 国战 has only ♠2.
        card = self.cards["八卦阵"]
        self.assertEqual(pairs(card), [("spade", 2)])
        self.assertEqual(card["subtype"], "armor")

    def test_mount(self):
        card = self.cards["赤兔"]
        self.assertEqual((card["subtype"], card["mount"]), ("mount", "offensive"))
        self.assertEqual(pairs(card), [("heart", 5)])

    def test_card_with_unclosed_cells_on_the_page(self):
        self.assertIn("吴六剑", self.cards)


class SkipsWhatItCannotRead(unittest.TestCase):
    def test_unreadable_distribution_is_reported_and_skipped(self):
        html = (
            '<table id="cardtable"><tr><th colspan="3">基本牌</th></tr>'
            '<tr><th>闪</th><td>黑桃Z</td><th class="guozhan">国战</th></tr>'
            '<tr><th>桃</th><td>红桃3</td><th class="guozhan">国战</th></tr></table>'
        )
        cards, skipped = crawl.parse_cards(html, "guozhan")
        self.assertEqual([c["nameZh"] for c in cards], ["桃"])
        self.assertEqual([s["nameZh"] for s in skipped], ["闪"])


class DeckEntries(unittest.TestCase):
    CARDS = [
        {"nameZh": "青釭剑", "defaultCardId": "black-pommel", "printings": [{"rank": 6, "suit": "spade"}]},
        {"nameZh": "吴六剑", "defaultCardId": None, "printings": [{"rank": 6, "suit": "diamond"}]},
    ]
    IDS = {"吴六剑": {"id": "wu-six-swords", "name": "Wu Six Swords"}}

    def test_a_matched_card_uses_its_default_id(self):
        entries = crawl.deck_entries(self.CARDS, self.IDS)
        self.assertEqual(entries[0]["cardId"], "black-pommel")

    def test_a_card_default_lacks_uses_its_ids_json_id(self):
        entries = crawl.deck_entries(self.CARDS, self.IDS)
        self.assertEqual(entries[1]["cardId"], "wu-six-swords")

    def test_entries_carry_exactly_the_printings(self):
        entries = crawl.deck_entries(self.CARDS, self.IDS)
        self.assertEqual(entries[1], {"cardId": "wu-six-swords", "printings": [{"rank": 6, "suit": "diamond"}]})

    def test_a_card_with_no_id_anywhere_is_an_error_naming_it(self):
        with self.assertRaisesRegex(crawl.CardError, "吴六剑"):
            crawl.deck_entries(self.CARDS, {})


class KeepGeneralsBlock(unittest.TestCase):
    BLOCK = "<!-- generals:start -->\n# Generals\n<!-- generals:end -->\n"

    def test_card_report_rewrite_preserves_generals_block(self):
        existing = "# Alternate vs Default\n\nold cards\n\n" + self.BLOCK
        self.assertEqual(
            crawl.keep_generals_block("# Alternate vs Default\n\nnew cards\n", existing),
            "# Alternate vs Default\n\nnew cards\n\n" + self.BLOCK)

    def test_no_block_leaves_the_report_unchanged(self):
        self.assertEqual(crawl.keep_generals_block("new cards\n", "old cards\n"), "new cards\n")
        self.assertEqual(crawl.keep_generals_block("new cards\n", ""), "new cards\n")


if __name__ == "__main__":
    unittest.main()
