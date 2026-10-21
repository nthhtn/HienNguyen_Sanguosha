"""Tests for crawl-alternate-generals.py against small saved excerpts of the blog.
Run: python3 -m unittest discover -s scripts -p 'test_*.py'"""
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("crawl_alternate_generals", HERE / "crawl-alternate-generals.py")
crawl = importlib.util.module_from_spec(spec)
spec.loader.exec_module(crawl)

def fixture(name):
    return (HERE / f"fixtures/{name}").read_text(encoding="utf-8")


INDEX = fixture("kw-index-excerpt.html")


class ParseIndex(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.entries = crawl.parse_index(INDEX)

    def test_links_grouped_by_force(self):
        self.assertEqual(len(self.entries), 12)
        for force in ("shu", "wei", "wu", "qun"):
            self.assertEqual(len([e for e in self.entries if e["force"] == force]), 3)

    def test_page_order_and_slug(self):
        first = self.entries[0]
        self.assertEqual((first["force"], first["slug"]), ("shu", "liu-bei"))
        self.assertTrue(first["url"].endswith("/2012/08/liu-bei.html"))
        self.assertEqual(self.entries[-1]["slug"], "lu-bu")

    def test_links_outside_the_post_body_are_ignored(self):
        self.assertNotIn("not-a-general", [e["slug"] for e in self.entries])


class ParseGeneral(unittest.TestCase):
    """Fixtures are trimmed copies of the blog pages for Liu Bei (one skill),
    Liu Shan (two skills, a tag, curly quotes) and Sima Yi (Chinese name with
    no space before it); each ends with a fake comment that must never be read."""

    @classmethod
    def setUpClass(cls):
        cls.liu_bei = crawl.parse_general(fixture("kw-general-liu-bei.html"))
        cls.multi = crawl.parse_general(fixture("kw-general-multi-skill.html"))
        cls.odd = crawl.parse_general(fixture("kw-general-odd.html"))

    def test_liu_bei(self):
        g = self.liu_bei
        self.assertEqual((g["name"], g["nameZh"]), ("Liu Bei", "刘备"))
        self.assertEqual(len(g["skills"]), 1)
        skill = g["skills"][0]
        self.assertEqual((skill["name"], skill["nameZh"]), ("Benevolence", "仁德"))
        self.assertTrue(skill["text"].startswith("During your action phase, you can give"))
        self.assertEqual(g["synergisticPartners"], [
            "Guan Yu 关羽 (Sworn Brother)",
            "Zhang Fei 张飞 (Sworn Brother)",
            "Gan Fu Ren (Lady Gan) 甘夫人 (Wife)",
        ])
        self.assertTrue(g["differenceFromNormal"].startswith('"Benevolence" is weakened'))

    def test_title_is_the_translated_description_without_quotes(self):
        # as printed on the page; it is really Cao Cao's epithet, and is not corrected
        self.assertEqual(self.liu_bei["title"], "The Ambitious Leader in Tumultuous Times")

    def test_two_skills_keep_order_and_tag(self):
        skills = self.multi["skills"]
        self.assertEqual([s["name"] for s in skills], ["Relish", "Devolution"])
        self.assertEqual([s["nameZh"] for s in skills], ["享乐", "放权"])
        self.assertEqual(skills[0]["tag"], "Enforced ability")
        self.assertNotIn("tag", skills[1])
        self.assertTrue(skills[1]["text"].startswith("You can skip your action phase"))

    def test_comment_text_is_not_data(self):
        for g in (self.liu_bei, self.multi, self.odd):
            self.assertNotIn("Fake Comment Skill", [s["name"] for s in g["skills"]])
            self.assertNotIn("Comment text", g["differenceFromNormal"] or "")

    def test_odd_layout_page(self):
        g = self.odd
        self.assertEqual((g["name"], g["nameZh"]), ("Sima Yi", "司马懿"))
        self.assertEqual([s["name"] for s in g["skills"]], ["Retaliation", "Demonic Talent"])
        self.assertEqual(g["skills"][1]["nameZh"], "鬼才")

    def test_no_ability_label_raises_general_error(self):
        page = "<html><head><title>Nobody 无 ~ x</title></head><body><div class='post-body entry-content'>Who is he:<br />Nobody.</div></body></html>"
        with self.assertRaises(crawl.GeneralError):
            crawl.parse_general(page)

    def test_names_unescape_entities_and_drop_a_dangling_ampersand(self):
        def page(title):
            return (f"<html><head><title>{title} ~ x</title></head><body><div class='post-body entry-content'>"
                    "<b>Character ability: \"Dual Heroes 双雄 (a b)\"</b><br />Text.</div></body></html>")
        pair = crawl.parse_general(page("Yán Liáng &amp; Wén Chǒu 颜良文丑"))
        self.assertEqual((pair["name"], pair["nameZh"]), ("Yan Liang & Wen Chou", "颜良文丑"))
        trio = crawl.parse_general(page("Zhāng Zhāo &amp; Zhāng Hóng &amp; 张昭张纮"))
        self.assertEqual(trio["name"], "Zhang Zhao & Zhang Hong")

    def test_partners_nil_is_empty(self):
        page = ("<html><head><title>Zhāng Liáo 张辽 ~ x</title></head><body><div class='post-body entry-content'>"
                "<b>Character ability: \"Sudden Strike 突击 (tū jī)\"</b><br />Text.<br /><br />"
                "<b>Synergistic Partners:</b><br />Nil.<br /></div></body></html>")
        self.assertEqual(crawl.parse_general(page)["synergisticPartners"], [])


DEFAULT = {
    "liu-bei": {"name": "Liu Bei", "nameZh": "刘备", "maxHp": 4, "gender": "male", "force": "shu"},
    "zhuge-liang": {"name": "Zhuge Liang", "nameZh": "诸葛亮", "maxHp": 3, "gender": "male", "force": "shu"},
    "fire-zhuge-liang": {"name": "Zhuge Liang", "nameZh": "诸葛亮", "maxHp": 3, "gender": "male", "force": "shu"},
    "xiahou-dun": {"name": "Xiahou Dun", "nameZh": "夏侯敦", "maxHp": 4, "gender": "male", "force": "wei"},
    "cai-wenji": {"name": "Cai Wenji", "nameZh": "蔡文姬", "maxHp": 3, "gender": "female", "force": "qun"},
    "yan-liang-and-wen-chou": {"name": "Yan Liang and Wen Chou", "nameZh": "颜良 & 文丑", "maxHp": 4, "gender": "male", "force": "qun"},
    "lu-meng": {"name": "Lu Meng", "nameZh": None, "maxHp": 4, "gender": "male", "force": "wu"},
    "sun-quan-a": {"name": "Sun Quan", "nameZh": "孙权", "maxHp": 4, "gender": "male", "force": "wu"},
    "sun-quan-b": {"name": "Sun Quan", "nameZh": "孙权", "maxHp": 4, "gender": "male", "force": "wu"},
}


def parsed(name, name_zh):
    return {"name": name, "nameZh": name_zh}


class MatchDefault(unittest.TestCase):
    def test_nameZh_match_is_trusted(self):
        self.assertEqual(crawl.match_default(parsed("Liu Bei", "刘备"), DEFAULT), ("liu-bei", "nameZh"))
        self.assertEqual(crawl.match_default(parsed("Someone Else", "刘备"), DEFAULT), ("liu-bei", "nameZh"))

    def test_name_fallback_with_one_candidate_matches(self):
        self.assertEqual(crawl.match_default(parsed("Xiahou Dun", "夏侯惇"), DEFAULT), ("xiahou-dun", "name"))
        self.assertEqual(crawl.match_default(parsed("Cai Wen Ji (Lady Cai)", "蔡文姬"), DEFAULT), ("cai-wenji", "nameZh"))
        self.assertEqual(crawl.match_default(parsed("Cai Wen Ji (Lady Cai)", None), DEFAULT), ("cai-wenji", "name"))
        self.assertEqual(crawl.match_default(parsed("Lu Meng", "吕蒙"), DEFAULT), ("lu-meng", "name"))
        self.assertEqual(
            crawl.match_default(parsed("Yan Liang & Wen Chou", None), DEFAULT), ("yan-liang-and-wen-chou", "name"))

    def test_nameZh_ignores_spaces_and_ampersands(self):
        self.assertEqual(
            crawl.match_default(parsed("Yan Liang & Wen Chou", "颜良文丑"), DEFAULT), ("yan-liang-and-wen-chou", "nameZh"))

    def test_name_fallback_with_two_candidates_matches_nothing(self):
        self.assertEqual(crawl.match_default(parsed("Zhuge Liang", None), DEFAULT), (None, None))
        self.assertEqual(crawl.match_default(parsed("Sun Quan", None), DEFAULT), (None, None))

    def test_unmatched_returns_none(self):
        self.assertEqual(crawl.match_default(parsed("Ding Feng", "丁奉"), DEFAULT), (None, None))

    def test_id_is_default_id_when_matched(self):
        self.assertEqual(crawl.general_id("liu-bei", "liu-bei"), "liu-bei")
        self.assertEqual(crawl.general_id("cai-wen-ji-lady-cai", "cai-wenji"), "cai-wenji")

    def test_id_from_slug_drops_lady_suffix(self):
        self.assertEqual(crawl.general_id("gan-fu-ren-lady-gan", None), "gan-fu-ren")

    def test_id_from_slug_keeps_other_slugs(self):
        self.assertEqual(crawl.general_id("yan-liang-wen-chou", None), "yan-liang-wen-chou")

    def test_real_default_loads_57_generals(self):
        default = crawl.load_default_generals()
        self.assertEqual(len(default), 57)
        self.assertEqual(default["cao-cao"]["force"], "wei")
        self.assertEqual(default["cao-cao"]["maxHp"], 4)


class BuildRecord(unittest.TestCase):
    ENTRY = {"force": "shu", "url": "http://x/2012/08/liu-bei.html", "slug": "liu-bei"}

    def test_record_copies_hp_and_gender_from_default(self):
        parsed_page = crawl.parse_general(fixture("kw-general-liu-bei.html"))
        rec = crawl.build_record(self.ENTRY, parsed_page, DEFAULT, "2026-10-21")
        self.assertEqual((rec["id"], rec["force"]), ("liu-bei", "shu"))
        self.assertEqual((rec["maxHp"], rec["gender"], rec["hpFrom"]), (4, "male", "default"))
        self.assertEqual(rec["source"], {"url": self.ENTRY["url"], "listedUnder": "shu", "crawledAt": "2026-10-21"})

    def test_unmatched_record_has_no_hp_or_gender_keys(self):
        page = crawl.parse_general(fixture("kw-general-liu-bei.html"))
        page.update(name="Nobody", nameZh="无人")
        rec = crawl.build_record({**self.ENTRY, "slug": "gan-fu-ren-lady-gan"}, page, DEFAULT, "2026-10-21")
        self.assertEqual(rec["id"], "gan-fu-ren")
        for key in ("maxHp", "gender", "hpFrom"):
            self.assertNotIn(key, rec)
        self.assertEqual(rec["nameZh"], "无人")

    def test_nameZh_falls_back_to_the_matched_default_general(self):
        page = crawl.parse_general(fixture("kw-general-liu-bei.html"))
        page["nameZh"] = None
        self.assertEqual(crawl.build_record(self.ENTRY, page, DEFAULT, "d")["nameZh"], "刘备")

    def test_heroes_force_is_recorded_as_listed_under_heroes(self):
        page = crawl.parse_general(fixture("kw-general-liu-bei.html"))
        rec = crawl.build_record({**self.ENTRY, "force": "qun"}, page, DEFAULT, "d")
        self.assertEqual((rec["force"], rec["source"]["listedUnder"]), ("qun", "heroes"))

    def test_record_key_order_is_stable(self):
        rec = crawl.build_record(self.ENTRY, crawl.parse_general(fixture("kw-general-liu-bei.html")), DEFAULT, "d")
        self.assertEqual(list(rec), [
            "id", "name", "nameZh", "force", "title", "maxHp", "gender", "hpFrom",
            "skills", "synergisticPartners", "differenceFromNormal", "source"])


class FetchPage(unittest.TestCase):
    def test_cache_is_read_first(self):
        with tempfile.TemporaryDirectory() as tmp:
            (Path(tmp) / "liu-bei.html").write_text("cached", encoding="utf-8")
            self.assertEqual(crawl.fetch_page("http://127.0.0.1:1/2012/liu-bei.html", Path(tmp), pause=0), "cached")

    def test_a_network_error_is_a_general_error(self):
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(crawl.GeneralError):
                crawl.fetch_page("http://127.0.0.1:1/2012/missing.html", Path(tmp), pause=0)


class Main(unittest.TestCase):
    INDEX = (
        "<html><body><div class='post-body entry-content'>"
        '<a name="shu"></a>'
        '<a href="http://x/2012/08/liu-bei.html"><img src="a.jpg"/></a>'
        '<a href="http://x/2012/08/liu-shan.html"><img src="a.jpg"/></a>'
        '<a name="wei"></a>'
        '<a href="http://x/2012/08/sima-yi.html"><img src="a.jpg"/></a>'
        '<a href="http://x/2012/08/ghost.html"><img src="a.jpg"/></a>'
        "<div class='post-share-buttons'></div></div></body></html>"
    )

    def run_main(self, tmp):
        tmp = Path(tmp)
        (tmp / "index.html").write_text(self.INDEX, encoding="utf-8")
        pages = tmp / "pages"
        pages.mkdir(exist_ok=True)
        for slug, fx in (("liu-bei", "liu-bei"), ("liu-shan", "multi-skill"), ("sima-yi", "odd")):
            (pages / f"{slug}.html").write_text(fixture(f"kw-general-{fx}.html"), encoding="utf-8")
        out = tmp / "out"
        code = crawl.main(["--file", str(tmp / "index.html"), "--pages", str(pages), "--out", str(out)])
        return code, out

    def test_main_writes_files_by_force_from_saved_pages(self):
        with tempfile.TemporaryDirectory() as tmp:
            code, out = self.run_main(tmp)
            self.assertEqual(code, 0)
            rec = json.loads((out / "generals/shu/liu-bei.json").read_text(encoding="utf-8"))
            self.assertEqual(rec["name"], "Liu Bei")
            self.assertTrue((out / "generals/shu/liu-shan.json").exists())
            self.assertTrue((out / "generals/wei/sima-yi.json").exists())

    def test_one_unreadable_page_is_skipped_and_run_exits_zero(self):
        with tempfile.TemporaryDirectory() as tmp:
            code, out = self.run_main(tmp)
            self.assertEqual(code, 0)
            self.assertFalse(list(out.glob("generals/*/ghost.json")))
            self.assertEqual(len(list(out.glob("generals/*/*.json"))), 3)

    def test_main_adds_the_generals_block_and_keeps_the_card_report(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "out"
            out.mkdir()
            cards = "# Alternate vs Default\n\n## Identical (3)\n\n"
            (out / "diff-vs-default.md").write_text(cards, encoding="utf-8")
            self.run_main(tmp)
            report = (out / "diff-vs-default.md").read_text(encoding="utf-8")
            self.assertTrue(report.startswith(cards + "<!-- generals:start -->"))
            self.assertIn("- ghost (wei): no saved page ghost.html", report)
            self.run_main(tmp)
            self.assertEqual(report, (out / "diff-vs-default.md").read_text(encoding="utf-8"))

    def test_rerun_is_byte_identical(self):
        with tempfile.TemporaryDirectory() as tmp:
            _, out = self.run_main(tmp)
            first = {p: p.read_bytes() for p in sorted(out.glob("generals/*/*.json"))}
            self.run_main(tmp)
            self.assertEqual(first, {p: p.read_bytes() for p in sorted(out.glob("generals/*/*.json"))})


def skill(name, zh, text):
    return {"name": name, "nameZh": zh, "text": text}


REPORT_DEFAULT = {
    "liu-bei": {"name": "Liu Bei", "nameZh": "刘备", "force": "shu",
                "skills": [skill("Benevolence", "仁德", "Give cards; regain 1 HP at two."),
                           {**skill("Rouse", "激将", "Ruler skill."), "lord": True}]},
    "cao-cao": {"name": "Cao Cao", "nameZh": "曹操", "force": "wei",
                "skills": [skill("Evil Hero", "奸雄", "Take the card that damaged him.")]},
    "dong-zhuo": {"name": "Dong Zhuo", "nameZh": "董卓", "force": "qun", "skills": []},
}


def rec(id_, name, zh, force, skills, hp_from="default"):
    r = {"id": id_, "name": name, "nameZh": zh, "force": force, "skills": skills}
    if hp_from:
        r["hpFrom"] = hp_from
    return r


class Report(unittest.TestCase):
    def report(self, records, matches, unparsed=()):
        return crawl.generals_report(records, matches, REPORT_DEFAULT, list(unparsed))

    def liu_bei(self, text="Give cards; regain 1 HP at three.", force="shu"):
        return rec("liu-bei", "Liu Bei", "刘备", force, [skill("Benevolence", "仁德", text)])

    def test_normalise_unifies_quotes_dashes_and_space(self):
        self.assertEqual(crawl.normalise_text("  \u201cA\u201d  \u2014 it\u2019s\n b "), "\"A\" - it's b")

    def test_block_is_marked(self):
        block = self.report([], {})
        self.assertTrue(block.startswith("<!-- generals:start -->"))
        self.assertTrue(block.rstrip().endswith("<!-- generals:end -->"))

    def test_report_lists_only_in_each_side(self):
        ding = rec("ding-feng", "Ding Feng", "丁奉", "wu", [], hp_from=None)
        block = self.report([self.liu_bei(), ding], {"liu-bei": ("liu-bei", "nameZh"), "ding-feng": (None, None)})
        self.assertIn("## Only in Alternate (1)", block)
        self.assertIn("- Ding Feng (丁奉), wu", block)
        self.assertIn("## Only in Default (2)", block)
        self.assertIn("- Cao Cao (曹操), wei", block)
        self.assertIn("- Dong Zhuo (董卓), qun", block)

    def test_report_force_differs(self):
        block = self.report([self.liu_bei(force="wei")], {"liu-bei": ("liu-bei", "nameZh")})
        self.assertIn("## Force differs (1)", block)
        self.assertIn("- Liu Bei: Alternate wei, Default shu", block)

    def test_report_skill_text_difference_after_normalisation_only(self):
        same = self.liu_bei("Give cards;  regain 1 HP at two.")  # whitespace only
        block = self.report([same], {"liu-bei": ("liu-bei", "nameZh")})
        self.assertNotIn("text differs", block)
        real = self.liu_bei()
        block = self.report([real], {"liu-bei": ("liu-bei", "nameZh")})
        self.assertIn("Benevolence", block)
        self.assertIn("text differs", block)
        self.assertIn("regain 1 HP at three", block)
        self.assertIn("only in Default: Rouse", block)

    def test_report_skill_present_on_one_side_only(self):
        extra = rec("liu-bei", "Liu Bei", "刘备", "shu",
                    [skill("Benevolence", "仁德", "Give cards; regain 1 HP at two."), skill("New", "新", "x")])
        block = self.report([extra], {"liu-bei": ("liu-bei", "nameZh")})
        self.assertIn("only in Alternate: New", block)

    def test_report_lists_fallback_matches(self):
        block = self.report([self.liu_bei()], {"liu-bei": ("liu-bei", "name")})
        self.assertIn("## Matched by English name (1)", block)
        self.assertIn("- Liu Bei -> liu-bei", block)

    def test_report_lists_missing_hp(self):
        ding = rec("ding-feng", "Ding Feng", "丁奉", "wu", [], hp_from=None)
        block = self.report([ding], {"ding-feng": (None, None)})
        self.assertIn("## Missing HP and gender (1)", block)
        self.assertIn("- Ding Feng (丁奉)", block)

    def test_report_lists_unparsed_with_reason(self):
        block = self.report([], {}, [{"slug": "ghost", "force": "wei", "reason": "no Character ability on the page"}])
        self.assertIn("## Unparsed pages (1)", block)
        self.assertIn("- ghost (wei): no Character ability on the page", block)

    def test_splice_replaces_block_and_keeps_the_rest(self):
        old = "# Cards\n\nbody\n\n<!-- generals:start -->\nold\n<!-- generals:end -->\n"
        new = "<!-- generals:start -->\nnew\n<!-- generals:end -->\n"
        self.assertEqual(crawl.splice_report(old, new), "# Cards\n\nbody\n\n" + new)

    def test_splice_appends_when_absent(self):
        new = "<!-- generals:start -->\nnew\n<!-- generals:end -->\n"
        self.assertEqual(crawl.splice_report("# Cards\n\nbody\n", new), "# Cards\n\nbody\n\n" + new)
        self.assertEqual(crawl.splice_report("", new), new)


if __name__ == "__main__":
    unittest.main()
