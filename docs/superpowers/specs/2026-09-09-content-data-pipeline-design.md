# Sanguosha Content Data Pipeline — Design Spec

Status: Approved for implementation planning
Date: 2026-09-09

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
logic; after this change they live in two JSON files and get merged with the logic
at registry-build time.

## Scope of this milestone

In scope:
- Two data files: `projects/content/data/generals.json`, `projects/content/data/cards.json`.
- `buildContentRegistry()` changes from a flat hardcoded array to a merge of JSON
  data + a small id-keyed map of hand-coded logic.
- Migrating the 6 already-implemented generals' and 7 already-implemented cards'
  data fields (currently hardcoded in `setOne.ts`/`setTwo.ts`/`cards/*.ts`) into
  the new JSON files, with `setOne.ts`/`setTwo.ts` refactored to export logic only.
- The base-set crawl: the ~25 base-set generals (Wei/Shu/Wu/Hero factions, no
  expansion packs) and the base card set (~10-13 cards, per the earlier scoping
  decision — "base set only" for this milestone, not the full 100-300+ roster).
- The pilot batch already hand-validated during design (4 generals: Cao Cao, Zhuge
  Liang, Sun Shangxiang, Lu Bu; 6 cards: Sha, Shan, Peach, Crossbow, Eight
  Trigrams, Draw Two) — this data is correct and ships as part of this milestone's
  first commit, not re-derived.
- A documented, repeatable crawl *process* (fetch script + an extraction discipline
  that cross-verifies against raw text rather than trusting a single tool pass) for
  crawling the remaining base-set entries.

Explicitly out of scope (deferred):
- Any general/card beyond the base set (expansion packs, God/Demon/Wraith/Saint/
  Immortal/Barbarian/Yellow Turban/Jin/Han factions).
- Implementing skill logic or `play()` logic for any newly-data-only general/card
  — that remains its own rule-texted task per general/card, same as today.
- Any change to `Effect`/`Action`/`Event` types or the resolution pipeline.
- Fully automated, unsupervised crawling — see "Extraction discipline" below for
  why this is deliberately semi-manual.

## Data model

### `projects/content/data/generals.json`

One entry per general, keyed by our own canonical kebab-case id (unchanged from
today's ids for the 6 already-implemented generals — no renaming).

```ts
interface GeneralData {
  name: string; // e.g. "Cao Cao"
  nameZh: string; // e.g. "曹操"
  title?: string; // epithet, e.g. "Martial Emperor of Wei"
  titleZh?: string;
  kingdom: 'Wei' | 'Shu' | 'Wu' | 'Qun'; // never 'hidden' — that sentinel is
                                          // redaction-only, added by Task 2 of the
                                          // app plan, and never appears in source data
  maxHp: number | null; // null = not yet known; see "maxHp sourcing" below
  skills: Array<{ name: string; nameZh: string; text: string }>; // 0+ entries;
                                          // printed text only, never executable
  source: {
    url: string;
    site: string; // "English Sanguosha (Jason Keeney and Scott Maresh)"
    crawledAt: string; // ISO date
  };
}
// generals.json : Record<string, GeneralData>
```

`skills` is an array (not a single field) — confirmed necessary during the pilot:
3 of the 4 pilot generals have two skills each. An empty array is valid (a general
with data but no known/crawled skill).

### `projects/content/data/cards.json`

One entry per card, keyed by canonical kebab-case id.

```ts
interface CardData {
  name: string;
  nameZh?: string;
  category: 'basic' | 'trick' | 'equipment'; // matches CardDefinition.category exactly
  subtype?: 'weapon' | 'armor' | 'horse' | 'treasure'; // equipment only
  text: string; // printed rules text, reference only, never executable
  range?: number; // weapons only, e.g. Crossbow's "Range: 1"
  printings?: Array<{ suit: 'spade' | 'heart' | 'club' | 'diamond'; rank: number }>;
                     // basic cards only — each real physical copy's printed
                     // suit/rank; an array because a card type has multiple
                     // differently-printed physical copies in a real deck
  source: { url: string; site: string; crawledAt: string };
}
// cards.json : Record<string, CardData>
```

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
   empty skill array is not.
3. **A card with data but no hand-coded `play()` logic is excluded from the built
   registry entirely** (no loud-vs-silent nuance needed here — there is no sensible
   default `play()` for an unimplemented card, unlike a general's optional skill
   array). A card only becomes playable once both its data and its logic exist.

```ts
// projects/content/src/lib/registry.ts (shape after this change)
import generalsData from '../data/generals.json';
import cardsData from '../data/cards.json';
import type { GeneralData, CardData } from './data-types'; // the interfaces above

// Existing hand-coded files change from exporting full GeneralDefinition objects
// to exporting just { id, skills } — see "setOne.ts / setTwo.ts refactor" below.
import { GENERAL_SKILLS } from './generals/index';
import { CARD_LOGIC } from './cards/index';

export function buildContentRegistry(): ContentRegistry {
  const generals: GeneralDefinition[] = [];
  for (const [id, data] of Object.entries(generalsData as Record<string, GeneralData>)) {
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
  for (const [id, data] of Object.entries(cardsData as Record<string, CardData>)) {
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
`id`/`kingdom`/`maxHp` move into `generals.json` as real entries (not `null` — these
6 are already fully known, this is a data *migration*, not new data-gathering).

Same shape of change for `cards/sha.ts` etc.: they change from exporting a full
`CardDefinition` to exporting just `{ play }`, collected into `CARD_LOGIC`. Their
`name`/`category` move into `cards.json`.

This is the only behavior-neutral refactor in this milestone — the 6 generals and
7 cards must behave identically before and after (same skills, same play logic,
same ids), just sourced from different files. The engine/content Jest suite
(currently 76+31 tests across engine+content) is the regression gate for this.

## `maxHp` sourcing policy

`maxHp` is treated differently from every other field in this schema: it is a
small integer fact from the base ruleset, not prose from a specific site, so it
carries no "verbatim quote" concern the way skill/card text does. It is **not**
sourced from the crawled site (confirmed during the pilot: the site does not
publish HP as text anywhere on general pages — it's rendered only inside the
character-art image, which is not text-extractable). It is supplied directly
(by whoever is running the crawl session) per general, the same way the pilot's
suit/rank data was supplied directly rather than crawled. `null` is the explicit
placeholder for "not yet supplied" (see registry-exclusion rule above) — never a
guessed number.

## Naming and kingdom mapping

- **Ids are never renamed to match the site.** The site calls Sha "Attack" and
  Shan "Escape"; our existing ids/`name` fields (`sha`/`'Sha'`, `shan`/`'Shan'`)
  stay as-is. When crawling a card whose site-name differs from an
  already-implemented card, the crawler maps site-name → existing id manually
  (this only applies to the 3 basic cards already implemented; new cards get
  their own fresh id derived from the site's name, kebab-cased).
- **Kingdom translation:** the site's fourth faction is labeled "Hero 群" — our
  engine's `Kingdom` type uses `'Qun'` (pinyin for 群) as that same fourth
  kingdom. Every general crawled from the site's Hero faction section gets
  `kingdom: 'Qun'` in `generals.json`, not a literal `'Hero'` (which is not a
  valid `Kingdom` value and would fail to compile). Wei/Shu/Wu map directly
  (site and engine already agree on those three names).

## Extraction discipline (why this stays semi-manual)

The site's markup is generic Google-Docs-style spans with no semantic classes
separating "skill name" from "strengths/weaknesses commentary" — there is no
reliable CSS selector to grab just the wanted fields. Worse, a single
LLM-summarized pass over a page (the default behavior of a naive fetch-and-ask
tool call) was observed during the pilot to **fabricate a plausible-looking but
false value** ("HP: 4 units", stated with confidence) for a field that turned out
not to exist in the source at all. This was only caught by independently
stripping the raw HTML to plain text and re-checking.

Because of this, the crawl process for every future page is:
1. Fetch raw HTML (script below).
2. Strip to clean plain text (script below).
3. Read the actual stripped text directly — extract only fields that are
   literally present, verbatim. Never accept a summarized/inferred value for a
   field without locating its literal text first.
4. Cross-check anything surprising (a missing expected field, an unusual value)
   against at least the pattern already established by prior pages before
   treating it as confirmed absent vs. a one-off parsing miss (this is exactly
   how the "HP is systematically absent, not just missing on one page" finding
   was confirmed during the pilot — checked all 4 generals, not just one, before
   concluding).

This deliberately stays a supervised, one-page-at-a-time process rather than a
fully automated unsupervised crawl loop — the fabrication risk above is real and
the base-set scope (~25 generals, ~10-13 cards) is small enough that supervision
cost is low relative to the cost of silently wrong game data.

## Workspace changes required

- `tsconfig.json`: add `"resolveJsonModule": true` to `compilerOptions` (required
  for `import generalsData from '../data/generals.json'` to type-check under
  `ts-jest`/`tsc`; Angular's own bundler already supports this without the flag,
  but the plain `tsc --noEmit` verification gate needs it explicit).
- New file: `scripts/fetch-sgs-page.sh` — takes a page slug/URL, curls the raw
  HTML, strips it to clean plain text via the same Python one-liner used during
  the pilot, and prints the result. A thin, reusable version of the exact two
  manual steps used throughout this design session. Lives at the repo root
  (`scripts/`), not inside any Angular project, since it is a one-off data-authoring
  tool, not shipped application code.

## Pilot batch (already validated, ships in this milestone's first commit)

The following was hand-crawled and verified during this spec's design session and
is treated as ground truth, not re-derived:

**Generals:** Cao Cao (Wei, HP 4), Zhuge Liang (Shu, HP 3), Sun Shangxiang (Wu,
HP 3), Lu Bu (Qun, HP 5) — full records including all skills, given earlier in
this design conversation.

**Cards:** Sha/Shan/Peach `printings` backfilled (10-club, 7-diamond, 12-heart
respectively) for the 3 already-implemented basic cards; Crossbow (weapon,
range 1), Eight Trigrams (armor), Draw Two (trick) as 3 brand-new cards with
data but, per the registry-inclusion rule, no `play()` logic yet — they will not
appear in the built registry (and therefore not be playable) until someone
implements and rule-texts their logic, which is out of scope for this milestone.

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
