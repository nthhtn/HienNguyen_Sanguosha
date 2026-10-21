"""Tests for crawl-alternate-generals.py against small saved excerpts of the blog.
Run: python3 -m unittest discover -s scripts -p 'test_*.py'"""
import importlib.util
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


if __name__ == "__main__":
    unittest.main()
