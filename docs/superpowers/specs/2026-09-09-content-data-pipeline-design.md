# Sanguosha Content Data Pipeline — Design Spec

Status: Approved for implementation planning
Date: 2026-09-09 (revised 2026-09-10: authoritative spreadsheets discovered
mid-crawl; data model restructured to one-file-per-item; full base-set crawl
completed; revised 2026-10-02: the 9 remaining base-set trick cards crawled)

## Purpose

Give `projects/content` a data-driven source for general and card *identity data*
(name, kingdom, HP, printed skill/card text) crawled from a public English-language
Sanguosha reference site, while keeping all executable game logic (skill
`condition`/`effect` functions, card `play()` functions) exactly where it is today:
hand-written TypeScript, keyed by id, with rule text written before implementation
per CLAUDE.md's process rule.

This does not change how skills/cards *behave*. It changes where their non-logic
fields (name, kingdom, HP, printed text) come from and how the registry is built:
today those fields are hardcoded inline inside the same TypeScript object as the
logic; after this change they live in per-item JSON files and get merged with the
logic at registry-build time.

## Scope of this milestone

In scope:
- One JSON file per general/card under `projects/content/data/`, organized by
  kingdom (generals) and category/subtype (cards) — see "Data model" below.
- `buildContentRegistry()` changes from a flat hardcoded array to a merge of the
  data-file records + a small id-keyed map of hand-coded logic.
- Migrating the 6 already-implemented generals' and 7 already-implemented cards'
  data fields (currently hardcoded in `setOne.ts`/`setTwo.ts`/`cards/*.ts`) into
  the new data files, with `setOne.ts`/`setTwo.ts` refactored to export logic only.
- The base-set crawl: the 25 base-set generals (Wei 7, Shu 7, Wu 8, Hero/Qun 3)
  and the base card set (3 basic + 12 trick + 15 equipment = 30 cards) —
  **crawl is now complete**, see "Base-set crawl results" below.
- A documented crawl process that turned out to combine two sources: two
  authoritative spreadsheets (kingdom/HP/gender for generals; suit/rank/count for
  cards) discovered mid-crawl, plus supervised page-by-page extraction for prose
  fields (skill text, card rules text) that aren't in either spreadsheet.

Explicitly out of scope (deferred):
- Any general/card beyond the base set (expansion packs, God/Demon/Wraith/Saint/
  Immortal/Barbarian/Yellow Turban/Jin/Han factions).
- Implementing skill logic or `play()` logic for any newly-data-only general/card
  — that remains its own rule-texted task per general/card, same as today.
- Any change to `Effect`/`Action`/`Event` types or the resolution pipeline.
- Wiring `cards[].printings`/`count` into actual deck construction
  (`kingdomWar.ts`'s `buildDeckSpec` currently hardcodes 4 copies of every card
  uniformly) — the real per-card counts are now captured as data, but switching
  deck-building to use them is a separate decision with its own balance
  implications, not bundled into this data-pipeline milestone.
- Four open data-quality items — see "Open items requiring a decision" below —
  none block landing the pipeline itself, but should be resolved before this
  data is treated as fully authoritative.

## Data model

One JSON file per general/card, keyed by nothing internally (the id comes from
the filename) — each category/kingdom folder has an `index.ts` that imports every
file in it and assembles the final `Record<string, ...Data>`, injecting the
folder-derived fields (`kingdom` for generals; `category`/`subtype` for cards) so
they are never duplicated inside the JSON itself.

```
projects/content/data/
  generals/
    wei/cao-cao.json, sima-yi.json, xiahou-dun.json, zhang-liao.json,
        xu-chu.json, guo-jia.json, zhen-ji.json
    shu/zhuge-liang.json, liu-bei.json, guan-yu.json, zhang-fei.json,
        zhao-yun.json, ma-chao.json, huang-yueying.json
    wu/sun-quan.json, sun-shangxiang.json, gan-ning.json, lu-meng.json,
       huang-gai.json, zhou-yu.json, da-qiao.json, lu-xun.json
    qun/lu-bu.json, hua-tuo.json, diao-chan.json
    index.ts
  cards/
    basic/sha.json, shan.json, peach.json
    trick/duel.json, wuxie.json, draw-two.json, barbarians.json, break.json,
          capture.json, coerce.json, hail-of-arrows.json, harvest.json,
          lightning.json, peach-garden.json, steal.json
    equipment/weapon/crossbow.json, black-pommel.json, gender-swords.json,
                     serpent-spear.json, axe.json, sky-scorcher.json,
                     longbow.json, green-dragon-blade.json
    equipment/armor/eight-trigrams.json
    equipment/horse/red-hare.json, da-yuan.json, zi-xing.json,
                    shadow-runner.json, storm-runner.json, di-lu.json
    index.ts
```

### General file shape (e.g. `generals/wei/cao-cao.json`)

```ts
interface GeneralFileData {
  name: string; // e.g. "Cao Cao"
  nameZh?: string; // e.g. "曹操" — omitted (not guessed) if the source is unreliable, see Open Items
  title?: string; // epithet, e.g. "Martial Emperor of Wei"
  titleZh?: string;
  maxHp: number | null; // null = not yet known; see "maxHp sourcing" below
  skills: Array<{ name: string; nameZh: string; text: string }>; // 0+ entries;
                                          // printed text only, never executable
  source: { url: string; site: string; crawledAt: string };
}
```

`generals/index.ts` imports every file, adds `kingdom` (derived from which
subfolder — `wei/` → `'Wei'`, `qun/` → `'Qun'`, etc.) and exports:
`generalsData: Record<string, GeneralData>` where
`GeneralData extends GeneralFileData { kingdom: 'Wei'|'Shu'|'Wu'|'Qun' }`.
`kingdom` is never `'hidden'` — that sentinel is redaction-only (added by the
app milestone's Task 2) and never appears in source data.

`skills` is an array, not a single field — confirmed necessary early in the
crawl: most generals have two skills.

### Card file shape (e.g. `cards/equipment/weapon/crossbow.json`)

```ts
interface CardFileData {
  name: string;
  nameZh?: string;
  text?: string; // printed rules text, reference only, never executable —
                  // absent for the 6 horse cards, see Open Items
  range?: number; // weapons only, e.g. Crossbow's "Range: 1"
  printings?: Array<{ suit: 'spade' | 'heart' | 'club' | 'diamond'; rank: number }>;
                     // basic/trick cards only — every real physical copy's
                     // printed suit/rank, from the AllCards spreadsheet
  count?: number; // number of physical copies in a standard base-set deck
  source: { url: string; site: string; crawledAt: string };
}
```

`cards/index.ts` imports every file, adds `category` (derived from the
top-level folder: `basic/` | `trick/` | `equipment/`) and `subtype` (derived
from the sub-folder, equipment only: `weapon/` | `armor/` | `horse/`), and
exports `cardsData: Record<string, CardData>` where
`CardData extends CardFileData { category: ...; subtype?: ... }`.

## Registry integration

`ContentRegistry`'s shape (`Map<string, CardDefinition>` / `Map<string, GeneralDefinition>`,
`projects/engine/src/lib/registry/types.ts`) does not change. `lookupCard`/`lookupGeneral`
and everything downstream of them (resolve pipeline, legality, triggers) does not change.
Only `projects/content/src/lib/registry.ts`'s `buildContentRegistry()` changes, from a flat
hardcoded array to a merge.

**Two asymmetric inclusion rules**, settled during design and both deliberate:

1. **A general with data but no hand-coded skill logic is included**, with `skills: []`
   in the built `GeneralDefinition` — a real, selectable, playable vanilla character
   (matches real Sanguosha's occasional skill-less characters; matches CLAUDE.md's
   data-driven-registry extensibility principle). This means every crawled general
   with complete data becomes playable immediately, without waiting for someone to
   implement its skill.
2. **A general with incomplete core data (`maxHp === null`) is excluded from the
   built registry entirely**, with a loud warning at registry-build time listing
   excluded ids. `maxHp` is not optional at the engine level — `Seat.combinedHp`/
   `maxCombinedHp` cannot be constructed without a real number, so a missing value
   must never silently default (e.g. to a generic `4`); it must keep that general
   out of play until the real number is supplied. This is a stricter rule than (1)
   because `maxHp` is load-bearing for `GeneralInstance` construction in a way an
   empty skill array is not. (In practice: after the spreadsheet discovery, every
   one of the 25 base-set generals has a real `maxHp` — this rule now matters only
   for future expansion-set crawls that haven't looked the number up yet.)
3. **A card with data but no hand-coded `play()` logic is excluded from the built
   registry entirely** (no loud-vs-silent nuance needed here — there is no sensible
   default `play()` for an unimplemented card, unlike a general's optional skill
   array). A card only becomes playable once both its data and its logic exist.
   (In practice: of the 30 crawled cards, only 6 — Sha, Shan, Peach, Duel, Wuxie,
   and Green Dragon Blade — currently have logic; the other 24 have data only and
   will be excluded from the built registry until someone implements them.)

```ts
// projects/content/src/lib/registry.ts (shape after this change)
import { generalsData } from '../data/generals';
import { cardsData } from '../data/cards';

// Existing hand-coded files change from exporting full GeneralDefinition objects
// to exporting just { id, skills } — see "setOne.ts / setTwo.ts refactor" below.
import { GENERAL_SKILLS } from './generals/index';
import { CARD_LOGIC } from './cards/index';

export function buildContentRegistry(): ContentRegistry {
  const generals: GeneralDefinition[] = [];
  for (const [id, data] of Object.entries(generalsData)) {
    if (data.maxHp === null) {
      console.warn(`Excluding general "${id}" from registry: maxHp not yet known.`);
      continue;
    }
    generals.push({
      id,
      kingdom: data.kingdom,
      maxHp: data.maxHp,
      skills: GENERAL_SKILLS[id] ?? [],
    });
  }

  const cards: CardDefinition[] = [];
  for (const [id, data] of Object.entries(cardsData)) {
    const logic = CARD_LOGIC[id];
    if (!logic) continue; // no play() implementation yet — not registry-eligible
    cards.push({ id, name: data.name, category: data.category, play: logic.play });
  }

  return {
    cards: new Map(cards.map((c) => [c.id, c])),
    generals: new Map(generals.map((g) => [g.id, g])),
  };
}
```

## `setOne.ts` / `setTwo.ts` refactor

The 6 already-implemented generals currently export full `GeneralDefinition` objects
(id + kingdom + maxHp + skills, all hardcoded together). They change to export just
their `SkillTrigger[]`, collected into a `GENERAL_SKILLS: Record<string, SkillDefinition[]>`
map (file location: a new small `projects/content/src/lib/generals/index.ts`, or kept
inline in `setOne.ts`/`setTwo.ts` — implementation-plan-level detail). Their
`id`/`kingdom`/`maxHp` move into the new per-general data files as real entries
(not `null` — these 6 are already fully known, this is a data *migration*, not
new data-gathering). Note: **Dong Zhuo's existing hardcoded `maxHp: 4` does not
match any real printing** — see Open Items — the migration should carry the
existing value forward as-is (behavior-neutral) and treat correcting it as a
separate decision, not silently fix it mid-migration.

Same shape of change for `cards/sha.ts` etc.: they change from exporting a full
`CardDefinition` to exporting just `{ play }`, collected into `CARD_LOGIC`. Their
`name`/`category` move into the new per-card data files. Same caveat for
**"Silver Lion"**, which isn't a real card name found anywhere on the source site
— see Open Items.

This is the only behavior-neutral refactor in this milestone — the 6 generals and
7 cards must behave identically before and after (same skills, same play logic,
same ids), just sourced from different files. The engine/content Jest suite is
the regression gate for this.

## `maxHp` sourcing policy

**Revised from the original design.** `maxHp` is not sourced from page-by-page
crawling — confirmed early on that the wiki does not publish HP as text
anywhere on general pages (it's rendered only inside the character-art image).
It is also, it turns out, **not** manually supplied by a human typing in
remembered values — a live spreadsheet (`AllGenerals`, linked from the site's
own `generals` hub page, exported as CSV) was discovered mid-crawl with
authoritative `Name, Expansion, Alignment (kingdom), Ruler, Health, Gender`
columns for the entire roster across every expansion. This is now the source
of truth for `maxHp`, `kingdom`, and `gender` for every general — confirmed
against the four pilot generals' manually-supplied kingdom/HP values, with one
real discrepancy found (see Open Items, Lu Bu). `null` remains the explicit
placeholder for "not yet looked up in the spreadsheet" — never a guessed number.

The equivalent `AllCards` spreadsheet (linked from the `cards` hub page) is the
source of truth for `printings`/`count` on basic and trick cards. Equipment is
not in either spreadsheet — its `text`/`range` still comes from page-by-page
crawling (see Extraction discipline).

## Naming and kingdom mapping

- **Ids are never renamed to match the site.** The site calls Sha "Attack" and
  Shan "Escape"; our existing ids/`name` fields (`sha`/`'Sha'`, `shan`/`'Shan'`)
  stay as-is. When crawling a card whose site-name differs from an
  already-implemented card, the crawler maps site-name → existing id manually
  (this only applies to the 3 basic cards already implemented; new cards get
  their own fresh id derived from the site's name, kebab-cased).
- **Kingdom translation:** the site's (and the AllGenerals spreadsheet's) fourth
  faction is labeled "Hero" — our engine's `Kingdom` type uses `'Qun'` (pinyin
  for 群) as that same fourth kingdom. Every general in the Hero faction/folder
  gets `kingdom: 'Qun'`, never a literal `'Hero'` (not a valid `Kingdom` value).
  Wei/Shu/Wu map directly. This mapping is now applied once, at folder-assignment
  time (see Data model) — `kingdom` is not a field inside any individual JSON
  file, so there's no risk of a file's own field disagreeing with its folder.

## Extraction discipline

The site's markup is generic Google-Docs-style spans with no semantic classes
separating "skill name" from "strengths/weaknesses commentary" — there is no
reliable CSS selector to grab just the wanted fields. Worse, a single
LLM-summarized pass over a page (the default behavior of a naive fetch-and-ask
tool call) was observed early in the crawl to **fabricate a plausible-looking
but false value** ("HP: 4 units", stated with confidence) for a field that
turned out not to exist in the source at all. This was only caught by
independently stripping the raw HTML to plain text and re-checking — and it is
why `maxHp` was later moved off page-crawling entirely (see above).

The crawl process that emerged, and that every future expansion-pack crawl
should follow:
1. **Check for a linked spreadsheet first** (the site's category hub pages —
   `generals`, `cards` — sometimes link a Google Sheets export with clean
   tabular data; fetch `.../export?format=csv` from the spreadsheet's id).
   Structured fields the spreadsheet already has (kingdom, HP, gender,
   suit/rank/count) are pulled from there, not re-derived by page reading.
2. For whatever the spreadsheet doesn't cover (skill text, card rules text,
   Chinese names, equipment stats) — fetch the page's raw HTML, strip it to
   clean plain text, and read the actual stripped text directly. Extract only
   fields that are literally present, verbatim. Never accept a
   summarized/inferred value for a field without locating its literal text
   first.
3. Cross-check anything surprising (a missing expected field, an unusual
   value) against the pattern established by other pages of the same kind
   before concluding it's genuinely absent vs. a one-off parsing miss — this
   is how "HP is systematically absent from every general page" and "horse
   cards' rule text is systematically absent, baked into card art instead"
   were both confirmed as real, structural gaps rather than one-page misses.
4. If a source page itself contains an internal inconsistency (e.g. one
   general's page showing a different general's Chinese name), report it as a
   source-data problem and omit the unreliable field — do not silently
   correct it from memory, even when the correction is well-known, and do not
   silently keep the wrong value either.

This stayed a supervised process (five parallel crawl passes, each following
this exact discipline, covering the full base set) rather than a fully
automated unsupervised loop — the fabrication risk above is real, and running
several independent supervised passes in parallel scales fine at base-set size
without giving up supervision.

## Workspace changes made

- `tsconfig.json`: `"resolveJsonModule": true` added to `compilerOptions` —
  done. Required for the per-item JSON imports inside `data/*/index.ts` to
  type-check; verified with a standalone `tsc --noEmit` pass against both
  `index.ts` files plus a `ts-node` runtime check confirming the assembled
  `generalsData`/`cardsData` records are correct, before touching
  `registry.ts` itself (that refactor is still pending, tracked as
  implementation-plan work, not done as part of this data-gathering pass).
- Two throwaway Python scripts (`scripts/assemble-content-data.py`,
  `scripts/restructure-content-data.py`) record exactly how the crawled data
  was transcribed and split into the final file layout — not part of the
  ongoing pipeline (they reference temp files and hardcoded transcriptions
  from this one crawl session), kept for provenance/reproducibility rather
  than as reusable tooling.
- No reusable `scripts/fetch-sgs-page.sh` was built — the actual crawl process
  that emerged (spreadsheet-first, parallel supervised page-reads for the
  rest) didn't end up needing one; each crawl pass ran its own
  curl-and-strip inline. Worth building if a future expansion-pack crawl
  turns out to repeat the exact same shape of work often enough to justify it.

## Base-set crawl results (complete)

All 25 base-set generals and 30 base-set cards are crawled and committed as
per-item JSON files (see Data model). Source: the 4-general/6-card pilot batch
crawled and hand-verified during initial design, plus 20 more generals and 12
more equipment items crawled via 5 parallel supervised passes, all following
the Extraction discipline above (several genuine data gaps were correctly
reported as absent rather than guessed — see Open Items). A later re-check
found two pilot-batch prose fields that do not match their source pages —
see Open Items, item 5.

The last 9 trick cards (Barbarians, Break, Capture, Coerce, Hail of Arrows,
Harvest, Lightning, Peach Garden, Steal) were added on 2026-10-02 the same
way: `printings`/`count` from the AllCards spreadsheet's Base rows (`Number`
column; printing count checked against it for every card), `name`/`nameZh`/
`text` from each page's stripped plain text. `text` is the card's main rules
text only, verbatim (typos included), without the page's "Clarification"
notes. Completeness was checked against the site's Base hub page
(`expansions/original/base`), which lists exactly these 25 generals and 30
cards.

Cards: 3 basic (Sha, Shan, Peach), 12 trick (10 instant, plus 2 delayed —
Capture and Lightning, see Open Items, item 6), 8 weapons, 1 armor (Eight
Trigrams — the only Base-set armor that exists), 6 horses (data-only, no rule
text available — see Open Items).

## Open items requiring a decision

None of these block landing the pipeline itself, but should be resolved
before this data is treated as fully authoritative:

1. **Lu Bu's `maxHp`.** The AllGenerals spreadsheet has multiple Lu Bu rows
   across expansions — Base = 4, a Forest-expansion "God" variant = 5. The
   design conversation's pilot batch was given `5` by the human partner,
   which matches the Forest variant, not Base. Current data uses `4` (Base,
   matching this milestone's declared scope) pending confirmation.
2. **Lu Meng's `nameZh` is omitted.** The source page shows 陆逊, which is
   actually Lu Xun's Chinese name (confirmed: a bug on the source site, not a
   crawl/parsing error — verified byte-for-byte, and 陆逊 does not appear
   anywhere else on Lu Meng's page). Left blank rather than either keeping
   the wrong value or inserting the correct one (吕蒙) from memory, pending a
   decision on how to handle a confirmed-wrong source value.
3. **The 6 horse cards have no `text`/`range` data at all.** Confirmed across
   all 6 pages: the rules text is only present baked into an embedded
   card-art image, not as extractable text. Real Sanguosha horses are simple
   (+1/-1 attacking-distance effects), so this could be supplied directly by
   a human the same way `maxHp` originally was, rather than crawled.
4. **Two pre-existing-content issues, found while cross-checking the
   spreadsheet against already-implemented generals/cards, unrelated to the
   new crawl work itself:**
   - `projects/content/src/lib/generals/setTwo.ts`'s Dong Zhuo has
     `maxHp: 4`, but Dong Zhuo is not a Base-set general at all — he only
     exists in the Forest expansion, where his real `Health` is 8 (he's a
     high-HP Ruler variant there). The current value appears to have been an
     arbitrary simplification made during original implementation, not
     sourced from any real printing.
   - `projects/content/src/lib/cards/equipment.ts`'s "Silver Lion" is not a
     real Base-set (or apparently any-expansion) card name found anywhere on
     the source site or its spreadsheets.
   Neither is fixed as part of this milestone — both are decisions about
   already-shipped content, out of scope for a data-gathering pass.
5. **Duel's and Wuxie's `text` do not match their source pages.** Both came
   from the pilot batch and read as paraphrases, not transcriptions. The
   pages currently say — Duel: "A player can target anyone with this card. If
   the target does not play an attack, they are damaged. If they attack then
   the source must take damage or attack. Whoever does not attack, takes
   damage."; Negate: "Any player can play this in response to any tool card
   being played. The tool card then no longer works." (Draw Two, the third
   pilot-batch trick, does match.) Not yet corrected.
6. **Delayed tricks are not distinguished in the data.** The AllCards
   spreadsheet types Capture and Lightning as "Delay Tool", but they sit in
   the flat `trick/` folder with no `subtype`, same as instant tricks. The
   engine will need the distinction once either is implemented; options
   include a `trick/delay/` sub-folder that derives a `subtype: 'delay'`,
   which would extend the folder-derived-field rule beyond equipment. Their
   card art is also landscape (974×654), unlike every other card.

## Testing strategy

- `registry.spec.ts` (existing, `projects/content/src/lib/registry.spec.ts`):
  extend with cases for both exclusion rules — a general with `maxHp: null` is
  excluded with a console warning; a card with no matching `CARD_LOGIC` entry is
  excluded silently (no warning needed — this is the expected, common state for
  every not-yet-implemented card, not an error condition).
- The 6-general/7-card migration is checked by the *unchanged* existing
  general/card spec files (`setOne.spec.ts`, `setTwo.spec.ts`, `cards.spec.ts`,
  `tricks.spec.ts`) continuing to pass byte-for-byte after the refactor — this is
  the regression proof that the migration preserved behavior.
- No test asserts against the crawled prose fields' exact wording (`skills[].text`,
  `cards[].text`) — those are reference data, not executable behavior, and pinning
  their exact string in a test would make the test fail on every future crawl
  correction for no behavioral reason.
