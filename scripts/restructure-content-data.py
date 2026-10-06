#!/usr/bin/env python3
"""One-off restructuring script: splits the flat generals.json/cards.json into
one-file-per-item under content/data/, organized by kingdom (generals) and
category/subtype (cards), and generates the two index.ts manifests. Throwaway
tool, not part of the ongoing pipeline."""
import json
import os
import shutil

ROOT = "/Users/hing/Workspace/my_sanguosha/projects/content/data"

with open(f"{ROOT}/generals.json", encoding="utf-8") as f:
    generals = json.load(f)
with open(f"{ROOT}/cards.json", encoding="utf-8") as f:
    cards = json.load(f)

# Fix the green-dragon-blade placeholder source with the real crawled data.
cards["green-dragon-blade"].update({
    "nameZh": "青龙偃月刀",
    "text": "Range: 3. When a player has this equipped and the target of their attack uses an escape, the attacker may attack the target again.",
    "range": 3,
    "source": {
        "url": "https://sites.google.com/site/englishsanguosha/expansions/original/base/green-dragon-blade",
        "site": "English Sanguosha (Jason Keeney and Scott Maresh)",
        "crawledAt": "2026-09-10",
    },
})

KINGDOM_DIR = {"Wei": "wei", "Shu": "shu", "Wu": "wu", "Qun": "qun"}

for old in ["generals", "cards"]:
    shutil.rmtree(f"{ROOT}/{old}", ignore_errors=True)

# --- generals ---
generals_by_kingdom: dict[str, list[str]] = {"wei": [], "shu": [], "wu": [], "qun": []}
for gid, g in generals.items():
    kingdom_dir = KINGDOM_DIR[g.pop("kingdom")]
    os.makedirs(f"{ROOT}/generals/{kingdom_dir}", exist_ok=True)
    with open(f"{ROOT}/generals/{kingdom_dir}/{gid}.json", "w", encoding="utf-8") as f:
        json.dump(g, f, ensure_ascii=False, indent=2, sort_keys=True)
        f.write("\n")
    generals_by_kingdom[kingdom_dir].append(gid)

os.remove(f"{ROOT}/generals.json")

# --- cards ---
def camel(gid: str) -> str:
    parts = gid.split("-")
    return parts[0] + "".join(p.capitalize() for p in parts[1:])


card_placement: dict[str, str] = {}  # id -> relative dir under cards/
for cid, c in cards.items():
    category = c.pop("category")
    if category == "equipment":
        subtype = c.pop("subtype")
        rel = f"equipment/{subtype}"
    else:
        rel = category
    os.makedirs(f"{ROOT}/cards/{rel}", exist_ok=True)
    with open(f"{ROOT}/cards/{rel}/{cid}.json", "w", encoding="utf-8") as f:
        json.dump(c, f, ensure_ascii=False, indent=2, sort_keys=True)
        f.write("\n")
    card_placement[cid] = rel

os.remove(f"{ROOT}/cards.json")

# --- generals/index.ts ---
lines = []
var_names = {}
for kingdom_dir, ids in generals_by_kingdom.items():
    for gid in sorted(ids):
        var = camel(gid) + kingdom_dir.capitalize()
        var_names[gid] = var
        lines.append(f"import {var} from './{kingdom_dir}/{gid}.json';")
lines.append("")
lines.append("export interface GeneralSkillData {")
lines.append("  name: string;")
lines.append("  nameZh: string;")
lines.append("  text: string;")
lines.append("}")
lines.append("")
lines.append("export interface GeneralFileData {")
lines.append("  name: string;")
lines.append("  nameZh?: string;")
lines.append("  title?: string;")
lines.append("  titleZh?: string;")
lines.append("  maxHp: number | null;")
lines.append("  gender: 'male' | 'female';")
lines.append("  skills: GeneralSkillData[];")
lines.append("  source: { url: string; site: string; crawledAt: string; expansion?: string; genderFrom?: string };")
lines.append("}")
lines.append("")
lines.append("export interface GeneralData extends GeneralFileData {")
lines.append("  kingdom: 'Wei' | 'Shu' | 'Wu' | 'Qun';")
lines.append("}")
lines.append("")
kingdom_label = {"wei": "Wei", "shu": "Shu", "wu": "Wu", "qun": "Qun"}
lines.append("export const generalsData: Record<string, GeneralData> = {")
for kingdom_dir, ids in generals_by_kingdom.items():
    for gid in sorted(ids):
        lines.append(f"  '{gid}': {{ ...({var_names[gid]} as GeneralFileData), kingdom: '{kingdom_label[kingdom_dir]}' }},")
lines.append("};")
with open(f"{ROOT}/generals/index.ts", "w", encoding="utf-8") as f:
    f.write("\n".join(lines) + "\n")

# --- cards/index.ts ---
lines = []
var_names = {}
for cid in sorted(cards.keys()):
    rel = card_placement[cid]
    var = camel(cid) + "".join(p.capitalize() for p in rel.split("/"))
    var_names[cid] = var
    lines.append(f"import {var} from './{rel}/{cid}.json';")
lines.append("")
lines.append("export interface CardPrinting {")
lines.append("  suit: 'spade' | 'heart' | 'club' | 'diamond';")
lines.append("  rank: number;")
lines.append("}")
lines.append("")
lines.append("export interface CardFileData {")
lines.append("  name: string;")
lines.append("  nameZh?: string;")
lines.append("  text?: string;")
lines.append("  range?: number;")
lines.append("  printings?: CardPrinting[];")
lines.append("  count?: number;")
lines.append("  source: { url: string; site: string; crawledAt: string };")
lines.append("}")
lines.append("")
lines.append("export interface CardData extends CardFileData {")
lines.append("  category: 'basic' | 'tool' | 'equipment';")
lines.append("  subtype?: 'weapon' | 'armor' | 'horse' | 'treasure';")
lines.append("}")
lines.append("")
lines.append("export const cardsData: Record<string, CardData> = {")
for cid in sorted(cards.keys()):
    rel = card_placement[cid]
    if rel.startswith("equipment/"):
        subtype = rel.split("/")[1]
        extra = f", category: 'equipment', subtype: '{subtype}'"
    else:
        extra = f", category: '{rel}'"
    lines.append(f"  '{cid}': {{ ...({var_names[cid]} as CardFileData){extra} }},")
lines.append("};")
with open(f"{ROOT}/cards/index.ts", "w", encoding="utf-8") as f:
    f.write("\n".join(lines) + "\n")

print("Generals by kingdom:", {k: len(v) for k, v in generals_by_kingdom.items()})
print("Cards by category/subtype:", {})
from collections import Counter
print(Counter(card_placement.values()))
