#!/usr/bin/env python3
"""One-off assembly script: merges crawled skill/card text (hand-transcribed from
the crawl subagents' reports) with the authoritative AllGenerals/AllCards
spreadsheets (kingdom, HP, gender, suit/rank/count) into the final
generals.json / cards.json. Not part of the ongoing pipeline — a throwaway
tool for landing this one big base-set batch in one consistent pass."""
import csv
import json

CRAWLED_AT = "2026-09-10"
SITE = "English Sanguosha (Jason Keeney and Scott Maresh)"


def source(url):
    return {"url": url, "site": SITE, "crawledAt": CRAWLED_AT}


# --- kingdom/HP/gender from the AllGenerals spreadsheet (Base rows only) ---
with open("/tmp/sgs/allgenerals.csv", encoding="utf-8") as f:
    rows = list(csv.DictReader(f))
base_rows = {r["Name"]: r for r in rows if r["Expansion"] == "Base"}

KINGDOM_MAP = {"Wei": "Wei", "Shu": "Shu", "Wu": "Wu", "Hero": "Qun"}


def stats(name):
    r = base_rows[name]
    return KINGDOM_MAP[r["Alignment"]], int(r["Health"])


# --- skills, hand-transcribed from the crawl subagents' verbatim reports ---
GENERALS = {
    "cao-cao": {
        "name": "Cao Cao", "nameZh": "曹操", "title": "Martial Emperor of Wei", "titleZh": "魏武帝",
        "skills": [
            {"name": "Evil Hero", "nameZh": "奸雄", "text": "When Cao Cao is damaged by a card, he can immediately put it into his hand."},
            {"name": "Escort", "nameZh": "护驾", "text": "King Ability: If Cao Cao needs to use an Escape, a member of Wei can use an Escape on his behalf."},
        ],
        "source": source("https://sites.google.com/site/englishsanguosha/expansions/original/base/base-cao-cao"),
    },
    "zhuge-liang": {
        "name": "Zhuge Liang", "nameZh": "诸葛亮", "title": "Old Prime Minister", "titleZh": "迟暮的丞相",
        "skills": [
            {"name": "Astrology", "nameZh": "观星", "text": "Before his judgment phase, Zhuge Liang can look at the top X cards of the deck, X either the number of characters in play or 5, whichever number is smaller. He can then rearrange the order of these cards and put as many on the bottom of the deck as he chooses."},
            {"name": "Empty City", "nameZh": "空城", "text": "When Zhuge Liang has no hand cards, he cannot be the target of an attack or duel."},
        ],
        "source": source("https://sites.google.com/site/englishsanguosha/expansions/original/base/base-zhuge-liang"),
    },
    "sun-shangxiang": {
        "name": "Sun Shangxiang", "nameZh": "孙尚香", "title": "Archery Lady", "titleZh": "弓腰姬",
        "skills": [
            {"name": "Marriage", "nameZh": "结姻", "text": "Once during Sun Shangxiang's turn, she can discard two hand cards and select a male character who is not at full health. By doing so, she heals herself and the male character by one unit of health each."},
            {"name": "Armed Consorts", "nameZh": "枭姬", "text": "For each piece of equipment that leaves her equipment area, Sun Shangxiang draws two cards."},
        ],
        "source": source("https://sites.google.com/site/englishsanguosha/expansions/original/base/base-sun-shangxiang"),
    },
    "lu-bu": {
        "name": "Lu Bu", "nameZh": "吕布", "title": "Embodiment of Force", "titleZh": "武的化身",
        "skills": [
            {"name": "Matchless", "nameZh": "无双", "text": "When Lu Bu attacks a player, they must use an additional Escape to stop the attack. When Lu Bu duels another player, they must use an additional Attack every round of the duel."},
        ],
        "source": source("https://sites.google.com/site/englishsanguosha/expansions/original/base/base-lu-bu"),
    },
    "xiahou-dun": {
        "name": "Xiahou Dun", "nameZh": "夏侯敦", "title": "One Eyed Companion", "titleZh": "独眼的罗刹",
        "skills": [
            {"name": "Unyielding", "nameZh": "刚烈", "text": "When Xiahou Dun is damaged by another character, he can flip a judgment card. If the card is not a heart, the character that damaged him must either receive one unit of damage from Xiahou Dun or discard two hand cards."},
        ],
        "source": source("https://sites.google.com/site/englishsanguosha/expansions/original/base/base-xiahou-dun"),
    },
    "sima-yi": {
        "name": "Sima Yi", "nameZh": "司马懿", "title": "Ever Watchful Wolf", "titleZh": "狼顾之鬼",
        "skills": [
            {"name": "Feedback", "nameZh": "反馈", "text": "When a player damages Sima Yi, he can choose to take one of their cards and place it in his hand."},
            {"name": "Devil", "nameZh": "鬼才", "text": "After a judgment card is flipped, Sima Yi can discard one of his hand cards. The hand card that Sima Yi discard then becomes the new judgment card."},
        ],
        "source": source("https://sites.google.com/site/englishsanguosha/expansions/original/base/base-sima-yi"),
    },
    "zhang-liao": {
        "name": "Zhang Liao", "nameZh": "张辽", "title": "General of the Vanguard", "titleZh": "前将军",
        "skills": [
            {"name": "Raid", "nameZh": "突袭", "text": "During Zhang Liao's drawing phase, he can choose to forego drawing two cards from the deck and instead select up to two characters with hand cards. Zhang Liao takes one hand card from each character and places them in his hand."},
        ],
        "source": source("https://sites.google.com/site/englishsanguosha/expansions/original/base/base-zhang-liao"),
    },
    "xu-chu": {
        "name": "Xu Chu", "nameZh": "许诸", "title": "Crazy Tiger", "titleZh": "虎痴",
        "skills": [
            {"name": "Bare the Chest", "nameZh": "裸衣", "text": "During Xu Chu's drawing phase, he can choose to draw one fewer card. During his action phase, all damage that he causes by using Attacks or Duels is increased by one."},
        ],
        "source": source("https://sites.google.com/site/englishsanguosha/expansions/original/base/base-xu-chu"),
    },
    "guo-jia": {
        "name": "Guo Jia", "nameZh": "郭嘉", "title": "Prophet with an Early End", "titleZh": "早终的先知",
        "skills": [
            {"name": "Heaven's Envy", "nameZh": "天妒", "text": "Whenever Guo Jia flips a judgement card, he places into his hand before it takes effect."},
            {"name": "Bestowed Rouse", "nameZh": "遣计", "text": "For each unit of damage that Guo Jia receives, he draws two cards. He can then distribute these cards in any way that he sees fit among the characters in play."},
        ],
        "source": source("https://sites.google.com/site/englishsanguosha/expansions/original/base/base-guo-jia"),
    },
    "zhen-ji": {
        "name": "Zhen Ji", "nameZh": "甄姬", "title": "Unfortunate Beauty", "titleZh": "薄幸的美人",
        "skills": [
            {"name": "Overturned Country", "nameZh": "倾国", "text": "Zhen Ji can use any black hand card as escape."},
            {"name": "River Goddess", "nameZh": "洛神", "text": "Before her judgment phase, Zhen Ji can choose to flip a judgment card. If the card is black, she can continue flipping additional cards. This process repeats until a red card is flipped. The red card is discarded, while all black cards are added to her hand."},
        ],
        "source": source("https://sites.google.com/site/englishsanguosha/expansions/original/base/base-zhen-ji"),
    },
    "liu-bei": {
        "name": "Liu Bei", "nameZh": "刘备", "title": "Hero Through Troubled Times", "titleZh": "乱世的枭雄",
        "skills": [
            {"name": "Kindness", "nameZh": "仁德", "text": "Liu Bei's can give any number of his hand cards to any players. If he gives away more than one card, he recovers one unit of health."},
            {"name": "Fierce General", "nameZh": "激将", "text": "King Ability: If Liu Bei needs to use an attack, he can ask any member of Shu to provide him one."},
        ],
        "source": source("https://sites.google.com/site/englishsanguosha/expansions/original/base/base-liu-bei"),
    },
    "guan-yu": {
        "name": "Guan Yu", "nameZh": "关羽", "title": "Bearded Gentleman", "titleZh": "美须公",
        "skills": [
            {"name": "Fighting Saint", "nameZh": "武圣", "text": "Guan Yu can use any red card as an attack."},
        ],
        "source": source("https://sites.google.com/site/englishsanguosha/expansions/original/base/base-guan-yu"),
    },
    "zhang-fei": {
        "name": "Zhang Fei", "nameZh": "张飞", "title": "Ten Thousand Men Cannot Equal", "titleZh": "万夫不当",
        "skills": [
            {"name": "Roar", "nameZh": "咆哮", "text": "Zhang Fei has no restrictions on how many times he can attack during his turn."},
        ],
        "source": source("https://sites.google.com/site/englishsanguosha/expansions/original/base/base-zhang-fei"),
    },
    "zhao-yun": {
        "name": "Zhao Yun", "nameZh": "赵云", "title": "Young General", "titleZh": "少年将军",
        "skills": [
            {"name": "Dragon Courage", "nameZh": "龙胆", "text": "Zhao Yun can use attacks and escapes interchangeably."},
        ],
        "source": source("https://sites.google.com/site/englishsanguosha/expansions/original/base/base-zhao-yun"),
    },
    "ma-chao": {
        "name": "Ma Chao", "nameZh": "马超", "title": "One Rider Matches One Thousand", "titleZh": "一骑当千",
        "skills": [
            {"name": "Horsemanship", "nameZh": "马术", "text": "Ma Chao always has a -1 bonus."},
            {"name": "Iron Calvary", "nameZh": "铁骑", "text": "When Ma Chao attacks a player, he can flip a judgment card. If it is red, the attack cannot be escaped."},
        ],
        "source": source("https://sites.google.com/site/englishsanguosha/expansions/original/base/base-ma-chao"),
    },
    "huang-yueying": {
        "name": "Huang Yueying", "nameZh": "黄月英", "title": "Veiled Heroine", "titleZh": "归隐的杰女",
        "skills": [
            {"name": "Gathering Wisdom", "nameZh": "集智", "text": "Whenever Huang Yueying uses a non-delay tool card, she immediately draws a card."},
            {"name": "Wondrous Talent", "nameZh": "奇才", "text": "Whenever Huang Yueying uses a tool card, she has no range restrictions."},
        ],
        "source": source("https://sites.google.com/site/englishsanguosha/expansions/original/base/base-huang-yueying"),
    },
    "sun-quan": {
        "name": "Sun Quan", "nameZh": "孙权", "title": "Young and Worthy Lord", "titleZh": "年轻的贤君",
        "skills": [
            {"name": "Reconsider", "nameZh": "制衡", "text": "Once during his turn, Sun Quan can discard any number of cards to draw the same number."},
            {"name": "Rescued", "nameZh": "救援", "text": "King Ability: Whenever another member of Wu uses a Peach to save Sun Quan from the brink of death, it provides him with two units of health."},
        ],
        "source": source("https://sites.google.com/site/englishsanguosha/expansions/original/base/base-sun-quan"),
    },
    "gan-ning": {
        "name": "Gan Ning", "nameZh": "甘宁", "title": "Pirate with Silk Sails", "titleZh": "锦帆游侠",
        "skills": [
            {"name": "Surprise", "nameZh": "奇袭", "text": "During his turn, Gan Ning can use any black card as Break."},
        ],
        "source": source("https://sites.google.com/site/englishsanguosha/expansions/original/base/base-gan-ning"),
    },
    "lu-meng": {
        "name": "Lu Meng", "titleZh": None, "title": "Ford the River in White", "titleZh_note": None,
        "titleZh": "白衣渡江",
        "skills": [
            {"name": "Self-Restraint", "nameZh": "克己", "text": "If Lu Meng does not use any Attack cards during his turn, he can skip his discard phase."},
        ],
        "source": source("https://sites.google.com/site/englishsanguosha/expansions/original/base/base-lu-meng"),
        # nameZh deliberately omitted: the source page shows "陆逊", which is Lu Xun's
        # real Chinese name, not Lu Meng's (吕蒙) -- confirmed a source-site data
        # error during crawling, not a parsing mistake. Left out rather than guessed.
    },
    "huang-gai": {
        "name": "Huang Gai", "nameZh": "黄盖", "title": "Losing Flesh for the Country", "titleZh": "轻身为国",
        "skills": [
            {"name": "Battered Body", "nameZh": "苦肉", "text": "As many times as he would like during his turn, Huang Gai can choose to lose one unit of health to draw two cards."},
        ],
        "source": source("https://sites.google.com/site/englishsanguosha/expansions/original/base/base-huang-gai"),
    },
    "zhou-yu": {
        "name": "Zhou Yu", "nameZh": "周瑜", "title": "Viceroy", "titleZh": "大都督",
        "skills": [
            {"name": "Brave Gesture", "nameZh": "英姿", "text": "During his drawing phase, Zhou Yu can draw an additional card."},
            {"name": "Sow Revolt", "nameZh": "反间", "text": "Once per turn, Zhou Yu can select a player and force them to choose a suit. Then, the target chooses one of Zhou Yu's hand cards. The card is then revealed and placed in the target's hand. If the target guessed the suit incorrectly, they receive one unit of damage."},
        ],
        "source": source("https://sites.google.com/site/englishsanguosha/expansions/original/base/base-zhou-yu"),
    },
    "da-qiao": {
        "name": "Da Qiao", "nameZh": "大乔", "title": "Reserved Flower", "titleZh": "矜持之花",
        "skills": [
            {"name": "Country Scene", "nameZh": "国色", "text": "During Da Qiao's turn, she can use any diamond-suited card as Capture."},
            {"name": "Displace", "nameZh": "流离", "text": "When Da Qiao is the target of an attack, she can discard any card to redirect the attack to any other player within her attacking range other than the source."},
        ],
        "source": source("https://sites.google.com/site/englishsanguosha/expansions/original/base/base-da-qiao"),
    },
    "lu-xun": {
        "name": "Lu Xun", "nameZh": "陆逊", "title": "Young and Learned Hero", "titleZh": "儒生雄才",
        "skills": [
            {"name": "Humility", "nameZh": "谦逊", "text": "Lu Xun cannot be the target of Steal or Capture."},
            {"name": "Linked Camps", "nameZh": "连营", "text": "Whenever Lu Xun uses or loses his last hand card, he immediately draws a card."},
        ],
        "source": source("https://sites.google.com/site/englishsanguosha/expansions/original/base/base-lu-xun"),
    },
    "hua-tuo": {
        "name": "Hua Tuo", "nameZh": "华佗", "title": "God Doctor", "titleZh": "神医",
        "skills": [
            {"name": "First Aid", "nameZh": "急救", "text": "Outside of his turn, Hua Tuo can use any red card as a peach."},
            {"name": "Green Vesicle", "nameZh": "青囊", "text": "Once per turn, Hua Tuo can discard any hand card to heal any character one unit of health."},
        ],
        "source": source("https://sites.google.com/site/englishsanguosha/expansions/original/base/base-hua-tuo"),
    },
    "diao-chan": {
        "name": "Diao Chan", "nameZh": "貂蝉", "title": "Masterpiece of Dance and Beauty", "titleZh": "绝世的舞姬",
        "skills": [
            {"name": "Sow Discord", "nameZh": "离间", "text": "Once during her turn, Diao Chan can discard any card and choose two male characters to undergo a duel."},
            {"name": "Eclipse the Moon", "nameZh": "闭月", "text": "After her discard phase, Diao Chan draws one card."},
        ],
        "source": source("https://sites.google.com/site/englishsanguosha/expansions/original/base/base-diao-chan"),
    },
}

for gid, g in GENERALS.items():
    g.pop("titleZh_note", None)
    kingdom, hp = stats(g["name"])
    g["kingdom"] = kingdom
    g["maxHp"] = hp

# Lu Bu conflict: user said 5 (matches the Forest "God" variant), spreadsheet's
# Base row says 4. Using the Base value since that's our declared scope, but
# this is flagged to the user for confirmation, not silently finalized.
assert GENERALS["lu-bu"]["maxHp"] == 4

with open("/Users/hing/Workspace/my_sanguosha/projects/content/data/generals.json", "w", encoding="utf-8") as f:
    json.dump(GENERALS, f, ensure_ascii=False, indent=2, sort_keys=True)
    f.write("\n")

print(f"Wrote generals.json with {len(GENERALS)} entries")


# --- cards.json ---
def printings_from_csv(name, expansion="Base"):
    with open("/tmp/sgs/allcards.csv", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    row = next((r for r in rows if r["Name"] == name and r["Expansion"] == expansion), None)
    if not row:
        return None, None
    result = []
    for suit_col, suit in [("Spade", "spade"), ("Club", "club"), ("Diamond", "diamond"), ("Heart", "heart")]:
        val = row[suit_col].strip()
        if not val:
            continue
        for rank_str in val.split(","):
            rank_str = rank_str.strip().strip("()")
            rank_map = {"A": 1, "J": 11, "Q": 12, "K": 13}
            rank = rank_map.get(rank_str, None)
            if rank is None:
                try:
                    rank = int(rank_str)
                except ValueError:
                    continue
            result.append({"suit": suit, "rank": rank})
    return result, int(row["Number"])


CARDS = {}

sha_printings, sha_count = printings_from_csv("Attack")
CARDS["sha"] = {
    "name": "Sha", "category": "basic", "printings": sha_printings, "count": sha_count,
    "source": source("https://sites.google.com/site/englishsanguosha/expansions/original/base/attack"),
}
shan_printings, shan_count = printings_from_csv("Escape", expansion="Base")
CARDS["shan"] = {
    "name": "Shan", "category": "basic", "printings": shan_printings, "count": shan_count,
    "source": source("https://sites.google.com/site/englishsanguosha/expansions/original/base/escape"),
}
peach_printings, peach_count = printings_from_csv("Peach", expansion="Base")
CARDS["peach"] = {
    "name": "Peach", "category": "basic", "printings": peach_printings, "count": peach_count,
    "source": source("https://sites.google.com/site/englishsanguosha/expansions/original/base/peach"),
}
duel_printings, duel_count = printings_from_csv("Duel")
CARDS["duel"] = {
    "name": "Duel", "nameZh": "决斗", "category": "trick",
    "text": "The player challenges another player to a duel. The two players alternate playing Attack cards, starting with the target. The first player unable to play one takes damage equal to the number of Attacks played by the other.",
    "printings": duel_printings, "count": duel_count,
    "source": source("https://sites.google.com/site/englishsanguosha/expansions/original/base/duel"),
}
negate_printings, negate_count = printings_from_csv("Negate", expansion="Base")
CARDS["wuxie"] = {
    "name": "Wuxie", "nameZh": "无懈可击", "category": "trick",
    "text": "Negates the effects of a Tool card, or the effects of another Negate.",
    "printings": negate_printings, "count": negate_count,
    "source": source("https://sites.google.com/site/englishsanguosha/expansions/original/base/negate"),
}
draw_two_printings, draw_two_count = printings_from_csv("Draw Two")
CARDS["draw-two"] = {
    "name": "Draw Two", "nameZh": "无中生有", "category": "trick",
    "text": "The player that plays this draws two cards from the deck.",
    "printings": draw_two_printings, "count": draw_two_count,
    "source": source("https://sites.google.com/site/englishsanguosha/expansions/original/base/draw-two"),
}

# Equipment: weapons
CARDS["crossbow"] = {
    "name": "Crossbow", "nameZh": "诸葛连弩", "category": "equipment", "subtype": "weapon",
    "text": "Range: 1. With this equipped, a player may attack as much as desired during their turn.",
    "range": 1,
    "source": source("https://sites.google.com/site/englishsanguosha/expansions/original/base/crossbow"),
}
CARDS["black-pommel"] = {
    "name": "Black Pommel", "nameZh": "青釭剑", "category": "equipment", "subtype": "weapon",
    "text": "With this equipped, a player ignores the armor of the target.", "range": 2,
    "source": source("https://sites.google.com/site/englishsanguosha/expansions/original/base/black-pommel"),
}
CARDS["gender-swords"] = {
    "name": "Gender Swords", "nameZh": "雌雄双股剑", "category": "equipment", "subtype": "weapon",
    "text": "When a player attacks a target of the opposite gender, the player can force the target to make a choice. The target must either discard a hand card or the player to draw one.",
    "range": 2,
    "source": source("https://sites.google.com/site/englishsanguosha/expansions/original/base/gender-swords"),
}
CARDS["serpent-spear"] = {
    "name": "Serpent Spear", "nameZh": "丈八蛇矛", "category": "equipment", "subtype": "weapon",
    "text": "When an attack is desired, the wearer can decide to discard two hand cards to generate the attack.",
    "range": 3,
    "source": source("https://sites.google.com/site/englishsanguosha/expansions/original/base/serpent-spear"),
}
CARDS["axe"] = {
    "name": "Axe", "nameZh": "贯石斧", "category": "equipment", "subtype": "weapon",
    "text": "When the target of the player's attack escapes the attack, the player can then discard two other cards to cause the attack to hit.",
    "range": 3,
    "source": source("https://sites.google.com/site/englishsanguosha/expansions/original/base/axe"),
}
CARDS["sky-scorcher"] = {
    "name": "Sky Scorcher", "nameZh": "方天画戟", "category": "equipment", "subtype": "weapon",
    "text": "When the player with this equipped is using their last hand card to attack, they can target up to two additional players.",
    "range": 4,
    "source": source("https://sites.google.com/site/englishsanguosha/expansions/original/base/sky-scorcher"),
}
CARDS["longbow"] = {
    "name": "Longbow", "nameZh": "麒麟弓", "category": "equipment", "subtype": "weapon",
    "text": "When the player with this weapon damages another player with an attack, they can discard an equipped horse of the target.",
    "range": 5,
    "source": source("https://sites.google.com/site/englishsanguosha/expansions/original/base/longbow"),
}
CARDS["green-dragon-blade"] = {
    "name": "Green Dragon Blade", "category": "equipment", "subtype": "weapon", "range": 2,
    "source": source("https://sites.google.com/site/englishsanguosha/generals/wei"),
    # already implemented pre-crawl; text/range not re-verified against source this pass
}

# Equipment: armor
CARDS["eight-trigrams"] = {
    "name": "Eight Trigrams", "nameZh": "八卦阵", "category": "equipment", "subtype": "armor",
    "text": "Whenever an escape is needed, the wearer can perform a judgment. If it is red, the escape is considered to be provided.",
    "source": source("https://sites.google.com/site/englishsanguosha/expansions/original/base/eight-trigrams"),
}

# Equipment: horses -- rule text NOT captured (baked into card art images, not
# extractable as text; confirmed absent across all 6 during crawl)
for hid, name, name_zh in [
    ("red-hare", "Red Hare", "赤兔"), ("da-yuan", "Da Yuan", "大宛"), ("zi-xing", "Zi Xing", "紫骍"),
    ("shadow-runner", "Shadow Runner", "绝影"), ("storm-runner", "Storm Runner", "爪黄飞电"), ("di-lu", "Di Lu", "的卢"),
]:
    CARDS[hid] = {
        "name": name, "nameZh": name_zh, "category": "equipment", "subtype": "horse",
        "source": source(f"https://sites.google.com/site/englishsanguosha/expansions/original/base/{hid}"),
        # text/horseType omitted: not present as literal page text (image-only)
    }

with open("/Users/hing/Workspace/my_sanguosha/projects/content/data/cards.json", "w", encoding="utf-8") as f:
    json.dump(CARDS, f, ensure_ascii=False, indent=2, sort_keys=True)
    f.write("\n")

print(f"Wrote cards.json with {len(CARDS)} entries")
