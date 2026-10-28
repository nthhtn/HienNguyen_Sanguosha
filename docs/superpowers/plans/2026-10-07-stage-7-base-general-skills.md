# Stage 7: The 25 Base Generals' Skills — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
- Give the 25 base Generals their real skills, by the General Skills spec's rule text, on the stage 6 skill engine.
- Remove the five placeholder skills (Ferocity, Valor, Insight, Vanguard, and Huang Yueying's empty set).
- Teach the bots every skill, prove each one fires in seeded simulations, and show every skill in the app: asks, selections, choices, conversions and Action History lines.

**Architecture:**
- **Engine (generic, names no card or skill)** gains the few pieces the skills need and stage 6 left out:
  - `SkillStepEffect` and `SkillDefinition.onStep`: a skill's own multi-step resolution, the way `CardStepEffect` serves cards. A selection can continue into one (`skill-step`).
  - `UseCardEffect` (a seat uses a card a skill made: Sow Discord's Duel), `ShowCardEffect` / `CardShownEvent` (a card shown to everyone: Sow Revolt).
  - One-card conversions, from the hand or from hand and equipment, with an `accepts` filter and "only outside your turn"; the dying round asks a seat that can rescue through a conversion (First Aid).
  - A card in a zone can count as another card (`CardZone.countsAs`): a diamond placed as Capture stays a Capture in the judgment area.
  - `DrawPhaseEffect.acted`, the `give` continuation's `tally`, `PendingResponse.data`, `discardOwed` (a Discard Phase flagged to skip mid-phase ends at once), `drawPileTop`, and `registry` passed to `onStep`, `onTarget` and `onResponse`.
- **Content:** one file per force (`generals/wei.ts`, `shu.ts`, `wu.ts`, `qun.ts`) exporting each General's skill set; shared skill helpers (`shared/skills.ts`, `shared/judgments.ts`); four new modifiers read by the queries (distance, Tools ignoring distance, untargetable with an empty hand, two answers needed); Sha and Duel learn Iron Cavalry's "no Shan" and Matchless's "two answers".
- **Around the engine:** rule-based bots by the spec's Bots section; the sim adds base-only batches, a forced pairing per General, and the "hidden General never fires a compulsory skill" invariant; the app adds the skill-specific text.

**Tech Stack:** TypeScript, Jest (ts-jest), Angular 22 (app task).

**Spec:**
- `docs/superpowers/specs/2026-10-05-general-skills-design.md`: "Common rules", "Rule text: the 25 base Generals", "Bots", "UI", "Testing" (Content, Bots, App, Simulator).
- `docs/superpowers/specs/2026-10-05-all-cards-and-skills-roadmap-design.md`: the decisions (reveal to use; "may" always asks; Lord skills inactive; no elemental damage).
- Stage 6 plan, for the engine as built: `docs/superpowers/plans/2026-10-06-stage-6-skill-engine.md` (its "departs from the spec" list still holds).

**Where this plan departs from the spec, and why:**
- **No `RetargetStepEffect`** (as stage 6 decided). Displace queues the Sha's `sha-armor` step at the new target.
- **Self-Restraint is asked as the Discard Phase begins, and only when the seat is over its hand limit.** Skipping a Discard Phase with nothing to discard changes nothing, so asking would be noise. Engine: a Discard Phase whose skip flag is set while it runs ends at once (`discardOwed`). The history says "Lu Meng used Self-Restraint", not "skipped the Discard Phase".
- **Matchless is a modifier (`doubleAnswers`), not a trigger.** Sha reads it when it asks for Shan (`needed: 2`), and Duel reads it for each Sha owed. A modifier is compulsory and off while Lu Bu is hidden, as the spec wants. It logs no line; the second Shan window says it.
- **Eight Trigrams under Matchless:** each time a Shan is still owed, Eight Trigrams may judge once. A red judgment counts as one of the two.
- **Devil's seat order** is worked out by content (`shared/judgments.ts`): a changer is asked only when no seat before it in order still has a say. `JUDGMENT_CHANGERS` lists the skills that change judgments (Devil now; Wind's Dark Magic later).
- **Evil Hero and Lightning:** Lightning is now moved to the discard pile *before* its 3 damage, so Cao Cao may take it. The judged card is unaffected (Heaven's Envy still takes it after the damage).
- **Feedback** picks from the hand (one face-down option) and the equipment, not the Judgment slot (the standard ruling).
- **The 10-seat batch can't draw only base Generals:** 10 seats need 50 candidates and there are 25. Base-only batches run at 2 and 5 seats; the existing property test keeps covering 2–10 seats with the whole registry (expansion Generals have no skills).
- **Coverage in the sim** counts skills that leave a trace in the log (an ask answered Use, an `AbilityUsedEvent`, a converted card, a reveal to use). Pure modifiers (Roar, Horsemanship, Empty City, Wondrous Talent, Humility, Matchless) leave none; their unit tests cover them.
- **Action History keeps one line per event.** The spec's compact examples ("used Reconsider: discarded 3, drew 3") read as consecutive lines ("Seat 1 used Reconsider", "Seat 1 discarded …", "Seat 1 drew 3 cards").
- **Sow Discord's two seat picks** both read "Choose a seat"; the history names who challenged whom.
- **"Iron Calvary" in the crawled data is a typo**; the data's skill name becomes "Iron Cavalry" (id `iron-cavalry`).
- **Lord skills** (Escort, Fierce General, Rescued) get a definition with `lord: true` and nothing else, so every base General's data skill has a definition (pinned by a test).
- **Stage 6 deferred minors folded in:** a top-N draw-pile helper (`drawPileTop`); bots honour `mayReveal` for conversions; `onSelect` effects are checked not to open a decision (an error, like the cancellable-first-selection rule).

## Global Constraints

- **The engine names no card or skill.** Content supplies everything specific (CLAUDE.md, "Extensibility"). Adding a skill means adding its definition, never a branch in a central switch.
- **Game state stays plain serialisable data.** Continuations, steps and asks hold data, never functions. Absent optional state is left out, not `null`/`[]` (`countsAs` absent when empty).
- **Common rules (General Skills spec), verbatim:**
  - "A hidden General's skills are off: Optional triggers and active skills are still offered, as "Reveal X to use Y". Saying yes reveals that General first, with every usual Guozhan consequence, then uses the skill. Conversions of a hidden General are offered the same way. Using one reveals the General. Compulsory triggers and modifiers of a hidden General don't apply."
  - "A seat's gender is its Main General's while the Main is revealed, otherwise its Deputy's while that is revealed. A seat with both Generals hidden has no gender."
  - "Lord skills (Escort, Fierce General, Rescued) are inactive in Guozhan."
  - "Losing HP is not damage. It has no source, and nothing that reacts to damage applies. A seat at 0 HP or below after losing HP is dying, as after damage."
- **"May" always asks:** every optional skill asks its owner with Use and Don't each time it could apply (roadmap decision).
- **No elemental damage:** every skill's damage is `nature: 'normal'`.
- **Every skill acts for its `owner`** (seat and slot passed by the engine), never by searching the state for its General's id: the same General can sit at two seats in tests.
- **UI text** follows CLAUDE.md's UI text style: buttons and labels Title Case ("Discard 2 Hand Cards", "Take 1 Damage", "As Sha · Fighting Saint", "Keep the Rest"); prompts, hints and history lines sentence case with keywords capitalised (card names, skill names, General, HP, Sha).
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A hidden General's conversion as an answer.** A hidden Zhao Yun answering a Sha with Dragon Courage: the window offers the conversion; Cancel leaves Zhao Yun hidden and the window open; confirming the Sha reveals him (the reveal line names Dragon Courage), then the Sha counts as a Shan. (Test in Task 8.)
2. **Displace and the discarded horse.** Da Qiao's only seat in range is reachable only while she rides her offensive horse: the horse is not offered as Displace's discard, and if nothing else she holds keeps a seat in range, Displace isn't asked at all. (Test in Task 11.)
3. **Matchless with Eight Trigrams.** Lu Bu's Sha at a seat wearing Eight Trigrams: a red judgment counts as one Shan and a second Shan is still asked for; passing it means the Sha hits. (Test in Task 12.)
4. **A converted Capture in the Judgment slot.** A diamond Shan placed with Country Scene is judged in its holder's Judgment Phase as a Capture (a heart spares the Play Phase), a second Capture can't be placed on that seat, and once it leaves the slot the zone forgets it. (Tests in Tasks 4 and 10.)
5. **Linked Camps and the last hand card.** Lu Xun draws 1 when his last hand card leaves by being played, discarded, discarded by another seat's Break, or taken by another seat (Raid's random take; Humility keeps Steal off him), and only once when a Serpent Spear takes his last two. (Test in Task 10.)

---

## File Structure

**Engine (`projects/engine/src/lib/`)**
- Create: `pipeline/skillStep.ts` (`applySkillStep`); tests `pipeline/skillStep.spec.ts`, `pipeline/useCardEffect.spec.ts`, `pipeline/conversionsStage7.spec.ts`, `cards/countsAs.spec.ts`.
- Modify: `domain/types.ts`, `registry/types.ts`, `pipeline/effects.ts`, `pipeline/events.ts`, `pipeline/resolve.ts`, `pipeline/cardStep.ts`, `pipeline/toolLifecycle.ts`, `cards/zones.ts`, `rules/legality.ts`, `rules/phaseSequence.ts`, `public-api.ts`; tests `rules/phaseSequence.spec.ts`, `pipeline/selection.spec.ts`, `pipeline/conversion.spec.ts`, `pipeline/dying.spec.ts`.

**Content (`projects/content/`)**
- Create:
  - `src/lib/generals/wei.ts`, `shu.ts`, `wu.ts`, `qun.ts` and their specs; `src/lib/generals/base.spec.ts` (every base data skill defined).
  - `src/lib/generals/skills.testing.ts` (the specs' table and actions).
  - `src/lib/shared/skills.ts`, `src/lib/shared/judgments.ts`.
- Delete: `src/lib/generals/setOne.ts`, `setOne.spec.ts`, `setTwo.ts`, `setTwo.spec.ts`.
- Modify: `src/lib/generals/index.ts`, `src/lib/shared/{abilities,queries,steps,choices,delayed,tools}.ts`, `src/lib/cards/{sha,duel,lightning,mass-attack,draw-two,harvest,peach-garden,coerce}.ts`, `src/lib/cards/equipment/sky-scorcher.ts`, `src/lib/display.ts`, `src/public-api.ts`, `data/generals/shu/ma-chao.json`; specs that used base Generals as fillers.

**Bots / sim:** `bots/src/lib/rule-based.ts` (+ spec), `bots/src/lib/skills.ts` (new: the skill rules), `sim/src/invariants.ts` (+ spec), `sim/src/forcedPairing.ts` (new), `sim/src/skills.spec.ts` (new), `sim/src/property.spec.ts`.

**App (`projects/app/src/app/`):** `labels.ts`, `game-board/action-history.ts`, `game-board/ability-description.ts`, `game-board/choice-description.ts`, `game-board/selection-dialog.ts`, `game-board/seat-tile.ts`, `game-board/round-table.ts` and their specs.

**Docs:** `docs/architecture/event-chain.md`; `docs/superpowers/specs/2026-10-05-general-skills-design.md` (a "Stage 7 rulings" section).

**Before Task 1:** the working tree has uncommitted app/content changes (22 files). Commit or stash them first; several tasks edit the same files.

---
### Task 1: Clear the ground — placeholders out, fillers without skills, the specs' table

Stage 7 gives skills to Generals that many specs use as plain fillers (Cao Cao, Xu Chu, Liu Bei, Guan Yu…). Once Cao Cao has Evil Hero, every damage to a filler Cao Cao asks a question and those specs stall. This task swaps fillers for Generals that keep no skills (the Wind/Fire/Forest/Mountain ones), removes the placeholders, and adds the shared table the skill specs use.

**Files:**
- Delete: `projects/content/src/lib/generals/setOne.ts`, `setOne.spec.ts`, `setTwo.ts`, `setTwo.spec.ts`
- Create: `projects/content/src/lib/generals/wei.ts`, `shu.ts`, `wu.ts`, `qun.ts`, `projects/content/src/lib/generals/skills.testing.ts`, `projects/content/src/lib/generals/index.spec.ts`
- Modify: `projects/content/src/lib/generals/index.ts`, `projects/content/src/public-api.ts`, `projects/content/data/generals/shu/ma-chao.json`, `scripts/assemble-content-data.py`
- Modify (fillers): `projects/content/src/lib/cards/equipment/sha-equipment.spec.ts`, `projects/content/src/lib/cards/playability.spec.ts`, `projects/content/src/lib/modes/guozhan.spec.ts`

**Interfaces:**
- Produces:
  - `WEI_GENERALS`, `SHU_GENERALS`, `WU_GENERALS`, `QUN_GENERALS: GeneralSkillSet[]` (empty now; Tasks 5–12 fill them).
  - `BASE_GENERAL_IDS: readonly string[]` (the 25, by force), exported from `content`.
  - `skills.testing.ts`: `registry`, `stubMode`, `kwMode`, `card()`, `seat()`, `table()`, `TableOptions`, `harness(mode)` returning `{ ctx, act, play, pass, respond, choose, use, decline, select, cancel, run, settle, useSkill, convert, arrange, legal }`, and `hp()`, `ids()`, `askedAbout()`, `abilityLog()`, `handIds()`.

**Filler swaps** (same kingdom, gender and max HP, no skills in play):

| Base General | Filler |
|---|---|
| cao-cao (Wei 4 ♂) | cao-ren |
| xu-chu (Wei 4 ♂) | xiahou-yuan |
| sima-yi (Wei 3 ♂) | xun-yu |
| guo-jia (Wei 3 ♂) | cao-pi |
| liu-bei (Shu 4 ♂) | huang-zhong |
| guan-yu (Shu 4 ♂) | wei-yan |
| zhang-fei (Shu 4 ♂) | meng-huo |
| zhao-yun (Shu 4 ♂) | jiang-wei |
| zhuge-liang (Shu 3 ♂) | liu-shan |
| huang-yueying (Shu 3 ♀) | xiao-qiao (Wu 3 ♀; only where the kingdom doesn't matter) |
| sun-quan (Wu 4 ♂) | sun-jian |
| gan-ning (Wu 4 ♂) | zhou-tai |
| zhou-yu (Wu 3 ♂) | lu-su |
| lu-xun (Wu 3 ♂) | zhang-zhao-and-zhang-hong |
| hua-tuo (Qun 3 ♂) | jia-xu |
| lu-bu (Qun 4 ♂) | yuan-shao |

- [ ] **Step 1: Fix the "Iron Calvary" typo**

In `projects/content/data/generals/shu/ma-chao.json` change `"name": "Iron Calvary"` to `"name": "Iron Cavalry"`. In `scripts/assemble-content-data.py` line 142 make the same change, so a re-run keeps it.

- [ ] **Step 2: Remove the placeholders and add the force files**

Delete the four `setOne`/`setTwo` files. Create `projects/content/src/lib/generals/wei.ts`:

```ts
import type { GeneralSkillSet } from './types';

// The Wei base Generals' skills (General Skills spec, "Wei"). Every skill acts
// for the `owner` the engine passes in: the same General can sit at two seats
// in tests, so a skill must never find "its" seat by searching for its id.
export const WEI_GENERALS: GeneralSkillSet[] = [];
```

Create `shu.ts`, `wu.ts` and `qun.ts` the same way (`SHU_GENERALS`, `WU_GENERALS`, `QUN_GENERALS`; the comment names the force). Replace `projects/content/src/lib/generals/index.ts` with:

```ts
import type { SkillDefinition } from 'engine';
import type { GeneralSkillSet } from './types';
import { WEI_GENERALS } from './wei';
import { SHU_GENERALS } from './shu';
import { WU_GENERALS } from './wu';
import { QUN_GENERALS } from './qun';

const HAND_CODED: GeneralSkillSet[] = [...WEI_GENERALS, ...SHU_GENERALS, ...WU_GENERALS, ...QUN_GENERALS];

// Skill logic keyed by general id. A general with data but no entry here is a
// playable vanilla general (skills: []).
export const GENERAL_SKILLS: ReadonlyMap<string, SkillDefinition[]> = new Map(HAND_CODED.map((g) => [g.id, g.skills]));

// The 25 base Generals (the standard edition), by force. Their skills are real;
// the expansions' wait for their own sub-projects.
export const BASE_GENERAL_IDS: readonly string[] = [
  'cao-cao', 'guo-jia', 'sima-yi', 'xiahou-dun', 'xu-chu', 'zhang-liao', 'zhen-ji',
  'guan-yu', 'huang-yueying', 'liu-bei', 'ma-chao', 'zhang-fei', 'zhao-yun', 'zhuge-liang',
  'da-qiao', 'gan-ning', 'huang-gai', 'lu-meng', 'lu-xun', 'sun-quan', 'sun-shangxiang', 'zhou-yu',
  'diao-chan', 'hua-tuo', 'lu-bu',
];
```

In `projects/content/src/public-api.ts` export `BASE_GENERAL_IDS` (next to the existing generals export; add `export { BASE_GENERAL_IDS } from './lib/generals';` if the file has none).

- [ ] **Step 3: Write the failing test for the base list**

Create `projects/content/src/lib/generals/index.spec.ts`:

```ts
import { generalsData } from '../../../data/generals';
import { BASE_GENERAL_IDS } from './index';

describe('BASE_GENERAL_IDS', () => {
  it('names the 25 base Generals, each with a data file from the base pack', () => {
    expect(BASE_GENERAL_IDS).toHaveLength(25);
    for (const id of BASE_GENERAL_IDS) {
      expect(generalsData[id]?.source.url).toContain('/base/');
    }
  });

  it('is every base-pack General in the data', () => {
    const base = Object.entries(generalsData).filter(([, g]) => g.source.url.includes('/base/')).map(([id]) => id);
    expect([...BASE_GENERAL_IDS].sort()).toEqual(base.sort());
  });
});
```

- [ ] **Step 4: Run it**

Run: `npx jest projects/content/src/lib/generals/index.spec.ts`
Expected: PASS (the list is written to match the data; a FAIL names the mismatch).

- [ ] **Step 5: Swap the fillers**

Apply the table above in `sha-equipment.spec.ts` (the default `['cao-cao', 'dong-zhuo']` becomes `['cao-ren', 'dong-zhuo']`; the female `'huang-yueying'` becomes `'xiao-qiao'`; update the comment "Default: Cao Cao and Dong Zhuo" to "Cao Ren and Dong Zhuo"), `playability.spec.ts` (`cao-cao`/`xu-chu` → `cao-ren`/`xiahou-yuan`) and `guozhan.spec.ts` (every base General in candidate lists and `seated(...)` pairs; the line-285 comment becomes "cao-ren and xiahou-yuan have no skills, isolating the mode-level draw"). HP expectations stay the same because the fillers match max HP. Leave display-only specs (wiki, assets, labels, gender, avatar, card art) alone: they read names and gender, not skills.

- [ ] **Step 6: Add the specs' table**

Create `projects/content/src/lib/generals/skills.testing.ts`:

```ts
import { advanceToDecision, getLegalActions, resolve } from 'engine';
import type { Action, CardInstance, GameModeDefinition, GameState, Kingdom, Phase, QueueItem, Target } from 'engine';
import { buildContentRegistry } from '../registry';
import { guozhanMode } from '../modes/guozhan';

// Shared by the skill specs (not exported from the package).

// The real cards and Generals.
export const registry = buildContentRegistry();
// A mode with no triggers of its own: only the skills under test act.
export const stubMode: GameModeDefinition = { id: 'stub', setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'], checkWinCondition: () => null, triggers: [] };
// Guozhan's own triggers (Draw Phase draw, Judgment Phase, dying, elimination), never ending the game.
export const kwMode: GameModeDefinition = { ...guozhanMode, checkWinCondition: () => null };

export const card = (instanceId: string, definitionId: string, suit: CardInstance['suit'] = 'spade', rank = 7): CardInstance => ({ instanceId, definitionId, suit, rank });
export const seat = (seatId: string): Target => ({ kind: 'seat', seatId });

export interface TableOptions {
  // A seat's [Main, Deputy, revealed?]. Default: Cao Ren and Dong Zhuo (male, no skills), revealed.
  generals?: Record<string, [string, string, boolean?]>;
  kingdoms?: Record<string, Kingdom>;
  hp?: Record<string, number>;
  maxHp?: Record<string, number>;
  phase?: Phase;
  // The turn owner; default seat-a.
  owner?: string;
  flags?: Record<string, boolean>;
  ownerUses?: Record<string, number>;
  // How many seats: 4 by default (seat-a … seat-d), at most 6.
  seats?: number;
}

const SEAT_IDS = ['seat-a', 'seat-b', 'seat-c', 'seat-d', 'seat-e', 'seat-f'];
const KINGDOMS: Kingdom[] = ['Wei', 'Shu', 'Wu', 'Qun', 'Wei', 'Shu'];

// Seats round the table at 4/4 HP, in seat-a's Play Phase unless told
// otherwise. `cards` fills zones by id ('drawPile': top first; 'seat-b:judgment').
export function table(cards: Record<string, CardInstance[]> = {}, o: TableOptions = {}): GameState {
  const ids = SEAT_IDS.slice(0, o.seats ?? 4);
  return {
    seats: ids.map((id, index) => {
      const [main, deputy, revealed = true] = o.generals?.[id] ?? ['cao-ren', 'dong-zhuo'];
      return {
        id, index, kingdom: o.kingdoms?.[id] ?? KINGDOMS[index], eliminated: false,
        generals: { main: { generalDefinitionId: main, revealed }, deputy: { generalDefinitionId: deputy, revealed } },
        combinedHp: o.hp?.[id] ?? 4, maxCombinedHp: o.maxHp?.[id] ?? 4,
        hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` },
      };
    }),
    players: [],
    turn: {
      turnNumber: 1, ownerSeatId: o.owner ?? 'seat-a', extraTurnStack: [],
      ...(o.flags ? { flags: o.flags } : {}), ...(o.ownerUses ? { ownerUses: o.ownerUses } : {}),
    },
    phase: o.phase ?? 'Play',
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: cards['drawPile'] ?? [] },
      { id: 'discardPile', kind: 'discardPile', cards: cards['discardPile'] ?? [] },
      { id: 'processing', kind: 'processing', cards: [] },
      ...ids.flatMap((id) => [
        { id: `${id}:hand`, kind: 'hand' as const, ownerSeatId: id, cards: cards[`${id}:hand`] ?? [] },
        { id: `${id}:equip`, kind: 'equip' as const, ownerSeatId: id, cards: cards[`${id}:equip`] ?? [] },
        { id: `${id}:judgment`, kind: 'judgment' as const, ownerSeatId: id, cards: cards[`${id}:judgment`] ?? [] },
      ]),
    ],
    pendingResponse: null, log: [], rng: { seed: 1, counter: 0 }, result: null, generalSelection: null,
  };
}

// The actions a spec drives the engine with, under `mode`.
export function harness(mode: GameModeDefinition = stubMode) {
  const ctx = { registry, mode };
  const act = (s: GameState, action: Action) => resolve(s, action, ctx).state;
  const legal = (s: GameState, seatId: string) => getLegalActions(s, seatId, registry);
  return {
    ctx,
    act,
    legal,
    play: (s: GameState, cardInstanceId: string, ...targets: string[]) =>
      act(s, { kind: 'PlayCardAction', seatId: s.turn.ownerSeatId, cardInstanceId, targets: targets.map(seat) }),
    pass: (s: GameState) => act(s, { kind: 'PassAction', seatId: s.pendingResponse!.respondingSeatId, pendingResponseId: s.pendingResponse!.id }),
    respond: (s: GameState, cardInstanceId: string) =>
      act(s, { kind: 'RespondAction', seatId: s.pendingResponse!.respondingSeatId, pendingResponseId: s.pendingResponse!.id, cardInstanceId }),
    choose: (s: GameState, optionId: string) => act(s, { kind: 'ChooseOptionAction', seatId: s.pendingChoice!.seatId, choiceId: s.pendingChoice!.id, optionId }),
    use: (s: GameState) => act(s, { kind: 'ChooseOptionAction', seatId: s.pendingChoice!.seatId, choiceId: s.pendingChoice!.id, optionId: 'use' }),
    decline: (s: GameState) => act(s, { kind: 'ChooseOptionAction', seatId: s.pendingChoice!.seatId, choiceId: s.pendingChoice!.id, optionId: 'decline' }),
    select: (s: GameState, ...ids: string[]) => act(s, { kind: 'SelectAction', seatId: s.pendingSelection!.seatId, selectionId: s.pendingSelection!.id, ids }),
    cancel: (s: GameState) => act(s, { kind: 'CancelSelectionAction', seatId: s.pendingSelection!.seatId, selectionId: s.pendingSelection!.id }),
    // Queue `queue` and resolve until a decision.
    run: (s: GameState, queue: QueueItem[]) => advanceToDecision({ ...s, resolutionQueue: queue }, ctx).state,
    settle: (s: GameState) => advanceToDecision(s, ctx).state,
    // The seat's offered UseSkillAction for `skillId`, submitted.
    useSkill: (s: GameState, seatId: string, skillId: string) => {
      const action = legal(s, seatId).find((a) => a.kind === 'UseSkillAction' && a.owner.kind === 'general' && a.owner.skillId === skillId);
      if (!action) throw new Error(`${seatId} is not offered ${skillId}`);
      return act(s, action);
    },
    // The seat's offered UseConversionAction for `conversionId` (at `targets`, or answering the open window).
    convert: (s: GameState, seatId: string, conversionId: string, ...targets: string[]) => {
      const action = legal(s, seatId).find(
        (a) => a.kind === 'UseConversionAction' && a.via.conversionId === conversionId && JSON.stringify(a.targets) === JSON.stringify(targets.map(seat))
      );
      if (!action) throw new Error(`${seatId} is not offered ${conversionId}`);
      return act(s, action);
    },
    arrange: (s: GameState, top: string[], bottom: string[]) =>
      act(s, { kind: 'ArrangeCardsAction', seatId: s.pendingArrangement!.seatId, arrangementId: s.pendingArrangement!.id, top, bottom }),
  };
}

export const hp = (s: GameState, seatId: string) => s.seats.find((x) => x.id === seatId)!.combinedHp;
export const ids = (s: GameState, zoneId: string) => s.zones.find((z) => z.id === zoneId)!.cards.map((c) => c.instanceId);
export const handIds = (s: GameState, seatId: string) => ids(s, `${seatId}:hand`);
// The ability a pending ask or selection is about, if any.
export const askedAbout = (s: GameState) => {
  const reason = s.pendingChoice?.reason ?? s.pendingSelection?.reason ?? s.pendingArrangement?.reason;
  return reason?.kind === 'ability' ? reason.abilityId : null;
};
export const abilityLog = (s: GameState) => s.log.filter((e) => e.kind === 'AbilityUsedEvent');
```

- [ ] **Step 7: Run the whole suite**

Run: `npx jest`
Expected: PASS, apart from nothing. The deleted placeholder specs are gone; no other spec depended on Ferocity, Valor, Insight or Vanguard. If one did (grep `ferocity|valor|insight|vanguard`), it was a placeholder test: delete that case.

- [ ] **Step 8: Commit**

```bash
git add -A projects/content scripts/assemble-content-data.py
git commit -m "refactor(content): placeholders out, skill-less fillers in specs, a shared table for skill specs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Engine — skill steps, a card used by an effect, a card shown, and small hooks

**Files:**
- Create: `projects/engine/src/lib/pipeline/skillStep.ts`, `projects/engine/src/lib/pipeline/skillStep.spec.ts`, `projects/engine/src/lib/pipeline/useCardEffect.spec.ts`
- Modify: `projects/engine/src/lib/domain/types.ts`, `projects/engine/src/lib/registry/types.ts`, `projects/engine/src/lib/pipeline/effects.ts`, `projects/engine/src/lib/pipeline/events.ts`, `projects/engine/src/lib/pipeline/resolve.ts`, `projects/engine/src/lib/pipeline/cardStep.ts`, `projects/engine/src/lib/pipeline/toolLifecycle.ts`, `projects/engine/src/lib/cards/zones.ts`, `projects/engine/src/lib/rules/phaseSequence.ts`, `projects/engine/src/lib/rules/legality.ts`, `projects/engine/src/public-api.ts`
- Test: `projects/engine/src/lib/rules/phaseSequence.spec.ts`, `projects/engine/src/lib/pipeline/selection.spec.ts`

**Interfaces:**
- Produces:
  - Effect `{ kind: 'SkillStepEffect'; owner: GeneralOwner; step: string; data?: Record<string, unknown> }`; `SkillDefinition.onStep?(state: GameState, step: Extract<Effect, { kind: 'SkillStepEffect' }>, registry: ContentRegistry): unknown[]`.
  - Selection continuation `{ kind: 'skill-step'; step: Extract<Effect, { kind: 'SkillStepEffect' }> }`: queues the step with `data.picked` = the picked ids.
  - Effect `{ kind: 'UseCardEffect'; seatId: string; card: UsedCard; targets: Target[] }`: `seatId` uses `card` at `targets`, as a play outside any limit (not counted, `free`).
  - Effect `{ kind: 'ShowCardEffect'; seatId: string; cardInstanceId: string; abilityId?: string }` → `CardShownEvent { kind: 'CardShownEvent'; seatId: string; card: CardInstance; abilityId?: string }`.
  - `DrawPhaseEffect.acted?: string[]`.
  - `give` continuation gains `tally?: string`: adds the number given to `turn.abilityUses[tally]`.
  - `PendingResponse.data?: Record<string, unknown>`: what the opening card carries between answers.
  - `CardDefinition.onStep(state, step, registry)`, `onTarget(state, ctx, registry)`, `onResponse(state, ctx, registry)`: the registry is passed as the last argument.
  - `drawPileTop(state: GameState, count: number): CardInstance[]` (zones.ts).
  - `discardOwed(state: GameState, seatId: string): number` (phaseSequence.ts): 0 for the turn owner once `skipDiscard` is set, else `cardsOverHandLimit`.

- [ ] **Step 1: Write the failing tests**

Create `projects/engine/src/lib/pipeline/skillStep.spec.ts`:

```ts
import { advanceToDecision, resolve } from './resolve';
import { ContentRegistry, GameModeDefinition, SkillDefinition } from '../registry/types';
import { GameState, GeneralOwner } from '../domain/types';
import { Effect } from './effects';
import { drawPileTop } from '../cards/zones';

const owner: GeneralOwner = { kind: 'general', seatId: 'a', slot: 'main', skillId: 'echo' };
const mode: GameModeDefinition = { id: 'stub', setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'], checkWinCondition: () => null, triggers: [] };
const card = (instanceId: string) => ({ instanceId, definitionId: 'x', suit: 'spade' as const, rank: 1 });

// Echo: step 'pick' opens a selection of a's hand; step 'picked' draws one card per pick.
const echo: SkillDefinition = {
  id: 'echo',
  onStep: (state, step) => {
    if (step.step === 'pick') {
      return [{
        kind: 'OpenSelectionEffect',
        selection: { id: 'sel', seatId: 'a', reason: { kind: 'ability', owner, abilityId: 'echo' }, of: 'cards', eligibleIds: ['h1', 'h2'], min: 1, max: 2, then: { kind: 'skill-step', step: { kind: 'SkillStepEffect', owner, step: 'picked', data: { keep: true } } } },
      }];
    }
    const picked = step.data?.['picked'] as string[];
    return [{ kind: 'DrawCardsEffect', seatId: 'a', count: picked.length }];
  },
};
const registry: ContentRegistry = { cards: new Map(), generals: new Map([['g', { id: 'g', kingdom: 'Wei', maxHp: 4, skills: [echo] }]]) };
const ctx = { registry, mode };

function table(queue: Effect[] = []): GameState {
  const seat = (id: string, index: number) => ({
    id, index, kingdom: 'Wei' as const, eliminated: false,
    generals: { main: { generalDefinitionId: 'g', revealed: true }, deputy: { generalDefinitionId: 'g', revealed: true } },
    combinedHp: 4, maxCombinedHp: 4, hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` },
  });
  return {
    seats: [seat('a', 0), seat('b', 1)], players: [], turn: { turnNumber: 1, ownerSeatId: 'a', extraTurnStack: [] }, phase: 'Play',
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: [card('d1'), card('d2'), card('d3')] },
      { id: 'discardPile', kind: 'discardPile', cards: [] },
      { id: 'processing', kind: 'processing', cards: [] },
      { id: 'a:hand', kind: 'hand', ownerSeatId: 'a', cards: [card('h1'), card('h2')] },
      { id: 'a:equip', kind: 'equip', ownerSeatId: 'a', cards: [] },
      { id: 'a:judgment', kind: 'judgment', ownerSeatId: 'a', cards: [] },
      { id: 'b:hand', kind: 'hand', ownerSeatId: 'b', cards: [] },
      { id: 'b:equip', kind: 'equip', ownerSeatId: 'b', cards: [] },
      { id: 'b:judgment', kind: 'judgment', ownerSeatId: 'b', cards: [] },
    ],
    pendingResponse: null, log: [], rng: { seed: 1, counter: 0 }, result: null, generalSelection: null,
    ...(queue.length ? { resolutionQueue: queue } : {}),
  };
}

describe('SkillStepEffect', () => {
  it("runs its skill's onStep, and a skill-step selection hands the picks on with the step's data", () => {
    const opened = advanceToDecision(table([{ kind: 'SkillStepEffect', owner, step: 'pick' }]), ctx).state;
    expect(opened.pendingSelection?.id).toBe('sel');
    const done = resolve(opened, { kind: 'SelectAction', seatId: 'a', selectionId: 'sel', ids: ['h1', 'h2'] }, ctx).state;
    expect(done.zones.find((z) => z.id === 'a:hand')!.cards.map((c) => c.instanceId)).toEqual(['h1', 'h2', 'd1', 'd2']);
  });

  it('a skill with no onStep fails loudly', () => {
    const bare: ContentRegistry = { cards: new Map(), generals: new Map([['g', { id: 'g', kingdom: 'Wei', maxHp: 4, skills: [{ id: 'echo' }] }]]) };
    expect(() => advanceToDecision(table([{ kind: 'SkillStepEffect', owner, step: 'pick' }]), { registry: bare, mode })).toThrow('echo has no onStep');
  });
});

describe('ShowCardEffect', () => {
  it('logs the card face for everyone; an unknown card shows nothing', () => {
    const shown = advanceToDecision(table([{ kind: 'ShowCardEffect', seatId: 'a', cardInstanceId: 'h1', abilityId: 'echo' }, { kind: 'ShowCardEffect', seatId: 'a', cardInstanceId: 'nope' }]), ctx).state;
    expect(shown.log).toEqual([{ kind: 'CardShownEvent', seatId: 'a', card: card('h1'), abilityId: 'echo' }]);
  });
});

describe('drawPileTop', () => {
  it('is the top cards of the draw pile, top first, as many as there are', () => {
    expect(drawPileTop(table(), 2).map((c) => c.instanceId)).toEqual(['d1', 'd2']);
    expect(drawPileTop(table(), 9)).toHaveLength(3);
  });
});

describe('the give continuation’s tally', () => {
  it('counts the cards given under the tally key', () => {
    const give: Effect = {
      kind: 'OpenSelectionEffect',
      selection: { id: 'g1', seatId: 'a', reason: { kind: 'ability', owner, abilityId: 'echo' }, of: 'cards', eligibleIds: ['h1', 'h2'], min: 1, max: 2, then: { kind: 'give', toSeatIds: ['b'], tally: 'a/main/echo/given' } },
    };
    const opened = advanceToDecision(table([give]), ctx).state;
    const picked = resolve(opened, { kind: 'SelectAction', seatId: 'a', selectionId: 'g1', ids: ['h1', 'h2'] }, ctx).state;
    const given = resolve(picked, { kind: 'ChooseOptionAction', seatId: 'a', choiceId: picked.pendingChoice!.id, optionId: 'b' }, ctx).state;
    expect(given.turn.abilityUses).toEqual({ 'a/main/echo/given': 2 });
    expect(given.zones.find((z) => z.id === 'b:hand')!.cards.map((c) => c.instanceId)).toEqual(['h1', 'h2']);
  });
});
```

Create `projects/engine/src/lib/pipeline/useCardEffect.spec.ts`:

```ts
import { advanceToDecision } from './resolve';
import { CardDefinition, ContentRegistry, GameModeDefinition } from '../registry/types';
import { GameState } from '../domain/types';

const mode: GameModeDefinition = { id: 'stub', setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'], checkWinCondition: () => null, triggers: [] };
// A card whose play heals its target 1: proves play() ran with the given seat and targets.
const mend: CardDefinition = { id: 'mend', name: 'Mend', category: 'tool', play: (_s, ctx) => [{ kind: 'HealEffect', target: ctx.targets[0], amount: 1 }] };
const registry: ContentRegistry = { cards: new Map([['mend', mend]]), generals: new Map() };

function table(): GameState {
  const seat = (id: string, index: number, combinedHp: number) => ({
    id, index, kingdom: 'Wei' as const, eliminated: false, generals: null, combinedHp, maxCombinedHp: 4,
    hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` },
  });
  return {
    seats: [seat('a', 0, 4), seat('b', 1, 2)], players: [], turn: { turnNumber: 1, ownerSeatId: 'a', extraTurnStack: [] }, phase: 'Play',
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: [] }, { id: 'discardPile', kind: 'discardPile', cards: [] }, { id: 'processing', kind: 'processing', cards: [] },
      ...['a', 'b'].flatMap((id) => [
        { id: `${id}:hand`, kind: 'hand' as const, ownerSeatId: id, cards: [] },
        { id: `${id}:equip`, kind: 'equip' as const, ownerSeatId: id, cards: [] },
        { id: `${id}:judgment`, kind: 'judgment' as const, ownerSeatId: id, cards: [] },
      ]),
    ],
    pendingResponse: null, log: [], rng: { seed: 1, counter: 0 }, result: null, generalSelection: null,
  };
}

describe('UseCardEffect', () => {
  it('uses a card with no physical card for a seat that is not the turn owner, uncounted', () => {
    const virtual = { as: 'mend', colour: 'none' as const, physical: [] };
    const s = advanceToDecision({ ...table(), resolutionQueue: [{ kind: 'UseCardEffect', seatId: 'b', card: virtual, targets: [{ kind: 'seat', seatId: 'b' }] }] }, { registry, mode }).state;
    expect(s.log[0]).toEqual({ kind: 'CardPlayedEvent', seatId: 'b', card: virtual, targets: [{ kind: 'seat', seatId: 'b' }] });
    expect(s.seats[1].combinedHp).toBe(3);
    expect(s.turn.cardPlays).toBeUndefined();
    expect(s.turn.ownerUses).toBeUndefined();
  });
});
```

In `projects/engine/src/lib/rules/phaseSequence.spec.ts` add (reuse the file's existing state builder; if it has none for a Discard Phase, build the state inline as below):

```ts
describe('discardOwed', () => {
  it('is what the turn owner is over its hand limit, or none once its Discard Phase is flagged to skip', () => {
    const base = discardTable(5); // the owner 'a' holds 5 cards at 3 HP: 2 over
    expect(discardOwed(base, 'a')).toBe(2);
    expect(phaseWaitsForPlayer(base)).toBe(true);
    const skipping = { ...base, turn: { ...base.turn, flags: { [skipFlagOf('Discard')]: true } } };
    expect(discardOwed(skipping, 'a')).toBe(0);
    expect(phaseWaitsForPlayer(skipping)).toBe(false);
  });
});
```

with this helper at the top of the spec (if the file has no equivalent):

```ts
function discardTable(handSize: number): GameState {
  const hand = Array.from({ length: handSize }, (_, i) => ({ instanceId: `c${i}`, definitionId: 'x', suit: 'spade' as const, rank: 1 }));
  return {
    seats: [{ id: 'a', index: 0, kingdom: 'Wei', eliminated: false, generals: null, combinedHp: 3, maxCombinedHp: 4, hand: { zoneId: 'a:hand' }, equipped: { zoneId: 'a:equip' }, judgment: { zoneId: 'a:judgment' } }],
    players: [], turn: { turnNumber: 1, ownerSeatId: 'a', extraTurnStack: [] }, phase: 'Discard',
    zones: [{ id: 'a:hand', kind: 'hand', ownerSeatId: 'a', cards: hand }],
    pendingResponse: null, log: [], rng: { seed: 1, counter: 0 }, result: null, generalSelection: null,
  };
}
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx jest projects/engine/src/lib/pipeline/skillStep.spec.ts projects/engine/src/lib/pipeline/useCardEffect.spec.ts projects/engine/src/lib/rules/phaseSequence.spec.ts`
Expected: FAIL — compile errors: `SkillStepEffect`, `skill-step`, `ShowCardEffect`, `UseCardEffect`, `tally`, `drawPileTop`, `discardOwed` don't exist.

- [ ] **Step 3: Types**

In `projects/engine/src/lib/domain/types.ts`:
- `PendingResponse` gains, after `outcome?`:

```ts
  // What the opening card carries from one answer to the next (Duel: how many
  // Sha are still owed this turn of it).
  data?: Record<string, unknown>;
```

- In `SelectionContinuation`, change the `give` member and add `skill-step`:

```ts
  // Give the picked cards to one of `toSeatIds`, chosen next; then `then`.
  // `tally`: add how many were given to turn.abilityUses[tally] (Kindness).
  | { kind: 'give'; toSeatIds: string[]; then?: Effect[]; tally?: string }
  // Queue a skill's `step` with the picked ids added to its data as `picked`.
  | { kind: 'skill-step'; step: Extract<Effect, { kind: 'SkillStepEffect' }> };
```

In `projects/engine/src/lib/registry/types.ts`:
- `CardDefinition`: `onResponse?(state: GameState, ctx: ResponseContext, registry: ContentRegistry): unknown[];`, `onTarget?(state: GameState, ctx: ToolTargetContext, registry: ContentRegistry): unknown[];`, `onStep?(state: GameState, step: Extract<Effect, { kind: 'CardStepEffect' }>, registry: ContentRegistry): unknown[];` (existing implementations that take fewer parameters still type-check).
- `SkillDefinition` gains, after `onJudged`:

```ts
  // One step of this skill's own resolution (SkillStepEffect), for skills that
  // decide in several moves (Raid, Kindness, Sow Revolt). Its effects go to the
  // front of the queue.
  onStep?(state: GameState, step: Extract<Effect, { kind: 'SkillStepEffect' }>, registry: ContentRegistry): unknown[];
```

In `projects/engine/src/lib/pipeline/effects.ts`, in the `Effect` union:
- `DrawPhaseEffect` becomes `| { kind: 'DrawPhaseEffect'; seatId: string; count: number; acted?: string[] }` with the comment line "`acted`: the skills that had their say (an ask's Don't sends it back through its before-triggers)."
- Add, after `AbilityUsedEffect`:

```ts
  // One step of a General's skill (SkillDefinition.onStep).
  | { kind: 'SkillStepEffect'; owner: GeneralOwner; step: string; data?: Record<string, unknown> }
  // `seatId` uses `card` at `targets`, as a play outside any limit: a card a
  // skill makes a seat use (Sow Discord's Duel). Not counted toward limits.
  | { kind: 'UseCardEffect'; seatId: string; card: UsedCard; targets: Target[] }
  // Shows a card to everyone (Sow Revolt's taken card): logs its face.
  | { kind: 'ShowCardEffect'; seatId: string; cardInstanceId: string; abilityId?: string }
```

Import `GeneralOwner` in effects.ts. In `applyEffect` add before `default`:

```ts
    case 'ShowCardEffect': {
      const card = state.zones.flatMap((z) => z.cards).find((c) => c.instanceId === effect.cardInstanceId);
      if (!card) return { state, events: [] };
      const event: EngineEvent = { kind: 'CardShownEvent', seatId: effect.seatId, card, ...(effect.abilityId ? { abilityId: effect.abilityId } : {}) };
      return { state: { ...state, log: [...state.log, event] }, events: [event] };
    }
    case 'SkillStepEffect':
    case 'UseCardEffect':
      throw new Error(`${effect.kind} needs the registry: resolve it through the pipeline`);
```

In `projects/engine/src/lib/pipeline/events.ts` add, and add `CardShownEvent` to `EngineEvent`:

```ts
// A card shown to every seat (Sow Revolt's taken card): its face is public.
export interface CardShownEvent {
  kind: 'CardShownEvent';
  seatId: string;
  card: CardInstance;
  abilityId?: string;
}
```

- [ ] **Step 4: The skill step, and the registry for card hooks**

Create `projects/engine/src/lib/pipeline/skillStep.ts`:

```ts
import { GameState } from '../domain/types';
import { ContentRegistry } from '../registry/types';
import { skillOf } from '../skills/generalSkills';
import { ApplyResult, Effect } from './effects';
import { queueFront } from './queue';

// One step of a General's skill: the skill's onStep says what it leads to.
// Like a card step, it needs the registry and only reshapes the queue. The
// skill is found whether or not it is in play now (its General may have just
// been eliminated); onStep decides what still happens.
export function applySkillStep(state: GameState, step: Extract<Effect, { kind: 'SkillStepEffect' }>, registry: ContentRegistry): ApplyResult {
  const skill = skillOf(state, step.owner, registry);
  if (!skill?.onStep) throw new Error(`Skill ${step.owner.skillId} has no onStep (step ${step.step})`);
  return { state: queueFront(state, skill.onStep(state, step, registry) as Effect[]), events: [] };
}
```

Note the test expects the message to contain `echo has no onStep`: "Skill echo has no onStep (step pick)" does.

In `projects/engine/src/lib/pipeline/cardStep.ts` pass the registry: `definition.onStep(state, step, registry)`.
In `projects/engine/src/lib/pipeline/toolLifecycle.ts` (`ToolRuleEffect`): `definition.onTarget(state, { … }, registry)`.

- [ ] **Step 5: Resolve**

In `projects/engine/src/lib/pipeline/resolve.ts`:
- Import `applySkillStep` from `./skillStep`.
- In `resolveEffect`, right after `const current = rewritten.effect;` add:

```ts
  // A card used by an effect goes through useCard, which logs and queues its own follow-ups.
  if (current.kind === 'UseCardEffect') {
    const used = useCard(state, current.seatId, current.card, { targets: current.targets, counted: false, free: true }, ctx);
    return { state: queueFront(used.state, rewritten.after), events: used.events };
  }
```

- In the `applied` chain add a branch before `applyEffect(state, current)`: `: current.kind === 'SkillStepEffect' ? applySkillStep(state, current, ctx.registry)`.
- In `useCard`, pass the registry to `onResponse`: `.onResponse?.(afterLog, { pending, seatId, cardInstanceId, card: used }, ctx.registry)`.
- In `continueSelection`:
  - `give`: the option effects become `[...moves, ...(then.tally ? [{ kind: 'IncrementEffect' as const, scope: 'turn' as const, key: then.tally, by: ids.length }] : []), ...(then.then ?? [])]`.
  - add the case:

```ts
    case 'skill-step':
      return { state: queueFront(state, [{ ...then.step, data: { ...then.step.data, picked: ids } }]), events: [] };
```

- In the `SelectAction` case, after running each `onSelect` effect, guard the stage 6 rule that they must not open a decision:

```ts
      for (const effect of selection.onSelect ?? []) {
        const step = resolveEffect(current, effect, ctx);
        current = step.state;
        events.push(...step.events);
        if (decisionPending(current)) throw new Error(`An onSelect effect of ${selection.id} opened a decision (${effect.kind})`);
      }
```

- In the `DiscardCardAction` case replace `cardsOverHandLimit(state, action.seatId) === 0` with `discardOwed(state, action.seatId) === 0`, and import `discardOwed` from `../rules/phaseSequence` (drop the now-unused `cardsOverHandLimit` import if nothing else uses it).

- [ ] **Step 6: The draw pile's top, and the Discard Phase owed**

In `projects/engine/src/lib/cards/zones.ts` add:

```ts
// The top `count` cards of the draw pile, top first (fewer if it holds fewer).
// They stay where they are (Astrology looks at them).
export function drawPileTop(state: GameState, count: number): CardInstance[] {
  return requireZoneOfKind(state.zones, 'drawPile').cards.slice(0, Math.max(0, count));
}
```

In `projects/engine/src/lib/rules/phaseSequence.ts` add, and use it in `phaseWaitsForPlayer` (`if (state.phase === 'Discard') return discardOwed(state, state.turn.ownerSeatId) > 0;`):

```ts
// How many cards `seatId` must still discard in its Discard Phase: what it is
// over its hand limit, or none once the phase is flagged to skip (a skill used
// as the phase began, Self-Restraint), which then ends at once.
export function discardOwed(state: GameState, seatId: string): number {
  if (seatId === state.turn.ownerSeatId && state.turn.flags?.[skipFlagOf('Discard')]) return 0;
  return cardsOverHandLimit(state, seatId);
}
```

In `projects/engine/src/lib/rules/legality.ts`, the Discard branch becomes `if (state.phase === 'Discard' && discardOwed(state, seatId) > 0)` (import from `./phaseSequence`).

- [ ] **Step 7: Run the tests**

Run: `npx jest projects/engine`
Expected: PASS. Existing card specs still pass: their `onStep`/`onTarget`/`onResponse` ignore the extra argument.

- [ ] **Step 8: Run the whole suite and commit**

Run: `npx jest`
Expected: PASS.

```bash
git add projects/engine
git commit -m "feat(engine): skill steps, a card used by an effect, a card shown, and the Discard Phase owed

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 3: Engine — one-card conversions, from equipment too; rescuing through a conversion; a card that counts as another

**Files:**
- Create: `projects/engine/src/lib/pipeline/conversionsStage7.spec.ts`, `projects/engine/src/lib/cards/countsAs.spec.ts`
- Modify: `projects/engine/src/lib/registry/types.ts`, `projects/engine/src/lib/domain/types.ts`, `projects/engine/src/lib/rules/legality.ts`, `projects/engine/src/lib/pipeline/effects.ts`, `projects/engine/src/lib/pipeline/resolve.ts`, `projects/engine/src/lib/cards/zones.ts`

**Interfaces:**
- Consumes: `conversionsOf`, `OwnedConversion`, `conversionActions` (stage 5/6).
- Produces:
  - `Conversion` becomes `{ id; as; cards: 1 | 2; from?: 'hand' | 'hand-and-equipment'; accepts?(card: CardInstance): boolean; when: 'play' | 'respond' | 'both'; outsideOwnTurnOnly?: boolean }`.
  - `conversionCards(state, seatId, conversion): CardInstance[]`; `answeringConversions(state, seatId, allowedCardIds: string[] | undefined, registry): OwnedConversion[]` (legality.ts).
  - `applyDying(state, effect, mayRescue?: (seatId: string) => boolean)` exported from effects.ts; the pipeline passes "can answer with a conversion into a rescue card".
  - `CardZone.countsAs?: Record<string, string>`; `MoveCardEffect.countsAs?: string`; `cardCountsAs(zone, card): string`; `recordCountsAs(zones, fromZoneId, toZoneId, card, countsAs?)` (zones.ts).
  - A delayed Tool used through a conversion places itself (its physical card goes straight to the judgment area, not via the discard pile).

- [ ] **Step 1: Write the failing tests**

Create `projects/engine/src/lib/pipeline/conversionsStage7.spec.ts`:

```ts
import { advanceToDecision, resolve } from './resolve';
import { getLegalActions } from '../rules/legality';
import { CardDefinition, ContentRegistry, GameModeDefinition, SkillDefinition } from '../registry/types';
import { CardInstance, GameState } from '../domain/types';
import { Effect } from './effects';

const mode: GameModeDefinition = { id: 'stub', setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'], checkWinCondition: () => null, triggers: [] };
const red = (c: CardInstance) => c.suit === 'heart' || c.suit === 'diamond';
const peach: CardDefinition = { id: 'peach', name: 'Peach', category: 'basic', play: () => [] };
const plain: CardDefinition = { id: 'plain', name: 'Plain', category: 'basic', play: () => [] };
const gear: CardDefinition = { id: 'gear', name: 'Gear', category: 'equipment', equipSlot: 'armor', play: () => [] };
// A red card from hand or equipment as a Peach, to answer, only outside its owner's turn.
const medic: SkillDefinition = { id: 'medic', conversions: [{ id: 'medic', as: 'peach', cards: 1, from: 'hand-and-equipment', accepts: red, when: 'respond', outsideOwnTurnOnly: true }] };
const registry: ContentRegistry = {
  cards: new Map([['peach', peach], ['plain', plain], ['gear', gear]]),
  generals: new Map([['healer', { id: 'healer', kingdom: 'Qun', maxHp: 3, skills: [medic] }], ['nobody', { id: 'nobody', kingdom: 'Wei', maxHp: 4, skills: [] }]]),
};
const ctx = { registry, mode };
const card = (instanceId: string, definitionId: string, suit: CardInstance['suit']): CardInstance => ({ instanceId, definitionId, suit, rank: 5 });

// a is dying at 0 HP; b holds the Medic General, two hand cards and a red Gear.
function table(owner: 'a' | 'b'): GameState {
  const seat = (id: string, index: number, general: string, combinedHp: number) => ({
    id, index, kingdom: 'Qun' as const, eliminated: false,
    generals: { main: { generalDefinitionId: general, revealed: true }, deputy: { generalDefinitionId: 'nobody', revealed: true } },
    combinedHp, maxCombinedHp: 4, hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` },
  });
  const dying: Effect = { kind: 'DyingEffect', seatId: 'a', order: ['a', 'b'], rescueCardIds: { any: ['peach'], self: [] }, entering: true };
  return {
    seats: [seat('a', 0, 'nobody', 0), seat('b', 1, 'healer', 4)], players: [], turn: { turnNumber: 1, ownerSeatId: owner, extraTurnStack: [] }, phase: 'Play',
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: [] }, { id: 'discardPile', kind: 'discardPile', cards: [] }, { id: 'processing', kind: 'processing', cards: [] },
      { id: 'a:hand', kind: 'hand', ownerSeatId: 'a', cards: [] }, { id: 'a:equip', kind: 'equip', ownerSeatId: 'a', cards: [] }, { id: 'a:judgment', kind: 'judgment', ownerSeatId: 'a', cards: [] },
      { id: 'b:hand', kind: 'hand', ownerSeatId: 'b', cards: [card('h1', 'plain', 'heart'), card('h2', 'plain', 'spade')] },
      { id: 'b:equip', kind: 'equip', ownerSeatId: 'b', cards: [card('e1', 'gear', 'diamond')] },
      { id: 'b:judgment', kind: 'judgment', ownerSeatId: 'b', cards: [] },
    ],
    pendingResponse: null, log: [], rng: { seed: 1, counter: 0 }, result: null, generalSelection: null, resolutionQueue: [dying],
  };
}

describe('a one-card conversion from hand and equipment', () => {
  it("asks a seat with no Peach in the dying round when it can make one, and offers only the cards it accepts", () => {
    const asked = advanceToDecision(table('a'), ctx).state;
    const passed = resolve(asked, { kind: 'PassAction', seatId: 'a', pendingResponseId: asked.pendingResponse!.id }, ctx).state;
    expect(passed.pendingResponse?.respondingSeatId).toBe('b');
    const convert = getLegalActions(passed, 'b', registry).find((a) => a.kind === 'UseConversionAction')!;
    expect(convert).toBeDefined();
    const selecting = resolve(passed, convert, ctx).state;
    expect(selecting.pendingSelection).toMatchObject({ eligibleIds: ['h1', 'e1'], min: 1, max: 1 });
    const saved = resolve(selecting, { kind: 'SelectAction', seatId: 'b', selectionId: selecting.pendingSelection!.id, ids: ['e1'] }, ctx).state;
    expect(saved.seats[0].combinedHp).toBe(1);
    expect(saved.zones.find((z) => z.id === 'b:equip')!.cards).toEqual([]);
  });

  it("is not offered on its owner's own turn, so that seat isn't asked without a Peach", () => {
    const asked = advanceToDecision(table('b'), ctx).state;
    const passed = resolve(asked, { kind: 'PassAction', seatId: 'a', pendingResponseId: asked.pendingResponse!.id }, ctx).state;
    expect(passed.pendingResponse).toBeNull();
    expect(passed.seats[0].eliminated).toBe(true);
  });
});
```

Create `projects/engine/src/lib/cards/countsAs.spec.ts`:

```ts
import { advanceToDecision, resolve } from '../pipeline/resolve';
import { getLegalActions } from '../rules/legality';
import { CardDefinition, ContentRegistry, GameModeDefinition, SkillDefinition } from '../registry/types';
import { CardInstance, GameState } from '../domain/types';
import { cardCountsAs } from './zones';

const mode: GameModeDefinition = { id: 'stub', setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'], checkWinCondition: () => null, triggers: [] };
// A delayed Tool that places itself in the target's judgment area, as what it was used as.
const trap: CardDefinition = {
  id: 'trap', name: 'Trap', category: 'tool', delayed: true,
  legalPlayTargets: () => [[{ kind: 'seat', seatId: 'b' }]],
  play: (_s, ctx) => [{ kind: 'MoveCardEffect', cardInstanceId: ctx.cardInstanceId, toZoneId: 'b:judgment', countsAs: ctx.card.as }],
};
const plain: CardDefinition = { id: 'plain', name: 'Plain', category: 'basic', play: () => [] };
const trapper: SkillDefinition = { id: 'trapper', conversions: [{ id: 'trapper', as: 'trap', cards: 1, when: 'play' }] };
const registry: ContentRegistry = {
  cards: new Map([['trap', trap], ['plain', plain]]),
  generals: new Map([['g', { id: 'g', kingdom: 'Wu', maxHp: 4, skills: [trapper] }]]),
};
const ctx = { registry, mode };
const c1: CardInstance = { instanceId: 'c1', definitionId: 'plain', suit: 'diamond', rank: 3 };

function table(): GameState {
  const seat = (id: string, index: number) => ({
    id, index, kingdom: 'Wu' as const, eliminated: false,
    generals: { main: { generalDefinitionId: 'g', revealed: true }, deputy: { generalDefinitionId: 'g', revealed: true } },
    combinedHp: 4, maxCombinedHp: 4, hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` },
  });
  return {
    seats: [seat('a', 0), seat('b', 1)], players: [], turn: { turnNumber: 1, ownerSeatId: 'a', extraTurnStack: [] }, phase: 'Play',
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: [] }, { id: 'discardPile', kind: 'discardPile', cards: [] }, { id: 'processing', kind: 'processing', cards: [] },
      { id: 'a:hand', kind: 'hand', ownerSeatId: 'a', cards: [c1] }, { id: 'a:equip', kind: 'equip', ownerSeatId: 'a', cards: [] }, { id: 'a:judgment', kind: 'judgment', ownerSeatId: 'a', cards: [] },
      { id: 'b:hand', kind: 'hand', ownerSeatId: 'b', cards: [] }, { id: 'b:equip', kind: 'equip', ownerSeatId: 'b', cards: [] }, { id: 'b:judgment', kind: 'judgment', ownerSeatId: 'b', cards: [] },
    ],
    pendingResponse: null, log: [], rng: { seed: 1, counter: 0 }, result: null, generalSelection: null,
  };
}

describe('a card that counts as another', () => {
  it('a delayed Tool made by a conversion goes straight to the judgment area, counting as that Tool', () => {
    const convert = getLegalActions(table(), 'a', registry).find((a) => a.kind === 'UseConversionAction')!;
    const selecting = resolve(table(), convert, ctx).state;
    const placed = resolve(selecting, { kind: 'SelectAction', seatId: 'a', selectionId: selecting.pendingSelection!.id, ids: ['c1'] }, ctx).state;
    const zone = placed.zones.find((z) => z.id === 'b:judgment')!;
    expect(zone.cards.map((c) => c.instanceId)).toEqual(['c1']);
    expect(zone.countsAs).toEqual({ c1: 'trap' });
    expect(cardCountsAs(zone, c1)).toBe('trap');
    expect(placed.log.some((e) => e.kind === 'CardMovedEvent' && e.toZoneId === 'discardPile')).toBe(false);
  });

  it('a zone forgets it once the card leaves, and records nothing for a card counting as itself', () => {
    const placed = advanceToDecision({ ...table(), resolutionQueue: [{ kind: 'MoveCardEffect', cardInstanceId: 'c1', toZoneId: 'b:judgment', countsAs: 'trap' }] }, ctx).state;
    const gone = advanceToDecision({ ...placed, resolutionQueue: [{ kind: 'MoveCardEffect', cardInstanceId: 'c1', toZoneId: 'discardPile' }] }, ctx).state;
    expect(gone.zones.find((z) => z.id === 'b:judgment')!.countsAs).toBeUndefined();
    const itself = advanceToDecision({ ...table(), resolutionQueue: [{ kind: 'MoveCardEffect', cardInstanceId: 'c1', toZoneId: 'b:judgment', countsAs: 'plain' }] }, ctx).state;
    expect(itself.zones.find((z) => z.id === 'b:judgment')!.countsAs).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx jest projects/engine/src/lib/pipeline/conversionsStage7.spec.ts projects/engine/src/lib/cards/countsAs.spec.ts`
Expected: FAIL — compile errors (`cards: 1`, `from`, `accepts`, `outsideOwnTurnOnly`, `countsAs`, `cardCountsAs`).

- [ ] **Step 3: The conversion shape**

In `projects/engine/src/lib/registry/types.ts` replace `Conversion` with:

```ts
// Using cards as another card (Serpent Spear: 2 hand cards as a Sha; Fighting
// Saint: a red card as a Sha).
export interface Conversion {
  // Unique among its owner's conversions.
  id: string;
  // The card the picked cards count as.
  as: string;
  // How many cards it takes.
  cards: 1 | 2;
  // Where they come from: the hand (default), or the hand and worn equipment.
  from?: 'hand' | 'hand-and-equipment';
  // Which cards may be used; absent = any.
  accepts?(card: CardInstance): boolean;
  // 'play': proactively in your Play Phase; 'respond': to answer a window.
  when: 'play' | 'respond' | 'both';
  // Only while it is not its owner's turn (First Aid).
  outsideOwnTurnOnly?: boolean;
}
```

- [ ] **Step 4: Legality**

In `projects/engine/src/lib/rules/legality.ts` (import `CardInstance` and `Conversion`) add:

```ts
// The cards `seatId` could use for `conversion`: its hand, then its worn
// equipment when the conversion allows, that the conversion accepts.
export function conversionCards(state: GameState, seatId: string, conversion: Conversion): CardInstance[] {
  const seat = state.seats.find((s) => s.id === seatId);
  if (!seat) return [];
  const cardsIn = (zoneId: string) => state.zones.find((z) => z.id === zoneId)?.cards ?? [];
  const pool = [...cardsIn(seat.hand.zoneId), ...(conversion.from === 'hand-and-equipment' ? cardsIn(seat.equipped.zoneId) : [])];
  return conversion.accepts ? pool.filter((c) => conversion.accepts!(c)) : pool;
}

// Whether `owned` can be used now: enough cards, and not barred by whose turn it is.
function usableNow(state: GameState, seatId: string, owned: OwnedConversion): boolean {
  if (owned.conversion.outsideOwnTurnOnly && state.turn.ownerSeatId === seatId) return false;
  return conversionCards(state, seatId, owned.conversion).length >= owned.conversion.cards;
}

// The conversions `seatId` could answer with, in a window that allows
// `allowedCardIds` (absent: any card).
export function answeringConversions(state: GameState, seatId: string, allowedCardIds: string[] | undefined, registry: ContentRegistry): OwnedConversion[] {
  return conversionsOf(state, seatId, registry).filter(
    (o) => o.conversion.when !== 'play' && (!allowedCardIds || allowedCardIds.includes(o.conversion.as)) && usableNow(state, seatId, o)
  );
}
```

Replace the body of `conversionActions` after its first guard with:

```ts
  const via = (o: OwnedConversion) => ({ owner: o.owner, conversionId: o.conversion.id });
  const pending = state.pendingResponse;
  if (pending) {
    if (pending.respondingSeatId !== seatId || !pending.allowedActionKinds.includes('RespondAction')) return [];
    return answeringConversions(state, seatId, pending.allowedCardIds, registry).map((o) => ({
      kind: 'UseConversionAction', seatId, via: via(o), targets: [], pendingResponseId: pending.id,
    }));
  }
  if (state.phase !== 'Play' || state.turn.ownerSeatId !== seatId) return [];
  return conversionsOf(state, seatId, registry)
    .filter((o) => o.conversion.when !== 'respond' && usableNow(state, seatId, o))
    .flatMap((o) =>
      legalTargetListsFor(state, seatId, '', o.conversion.as, registry).map((targets): UseConversion => ({ kind: 'UseConversionAction', seatId, via: via(o), targets }))
    );
```

Update the function's comment: "Either way the seat must hold enough cards the conversion accepts, and a conversion only for outside its owner's turn isn't offered on that turn."

- [ ] **Step 5: The selection's cards, and rescuing through a conversion**

In `projects/engine/src/lib/pipeline/resolve.ts`, `UseConversionAction`: replace the `hand` lookup and `eligibleIds: hand.map(...)` with `eligibleIds: conversionCards(state, action.seatId, owned.conversion).map((c) => c.instanceId)` (import `conversionCards`, `answeringConversions`).

In `projects/engine/src/lib/pipeline/effects.ts`, export `applyDying` and give it a third parameter:

```ts
// One step of the dying round. … (keep the comment) `mayRescue`: whether a seat
// with no rescue card in hand could still answer with one (a conversion into a
// Peach); the pipeline supplies it, since it needs the registry.
export function applyDying(state: GameState, effect: Extract<Effect, { kind: 'DyingEffect' }>, mayRescue?: (seatId: string) => boolean): ApplyResult {
```

and in it: `return !!hand?.cards.some((c) => effect.rescueCardIds.any.includes(c.definitionId)) || !!mayRescue?.(seatId);`.

In `resolveEffect`'s `applied` chain add before `applyEffect(state, current)`:

```ts
          : current.kind === 'DyingEffect'
            ? applyDying(state, current, (seatId) => answeringConversions(state, seatId, current.rescueCardIds.any, ctx.registry).length > 0)
```

- [ ] **Step 6: Counting as another card**

In `projects/engine/src/lib/domain/types.ts`, `CardZone` gains:

```ts
  // Cards here that count as another card than their own (a diamond placed as
  // Capture), by instance id. Forgotten when the card leaves. Absent when none.
  countsAs?: Record<string, string>;
```

In `projects/engine/src/lib/pipeline/effects.ts`, `MoveCardEffect` becomes `| { kind: 'MoveCardEffect'; cardInstanceId: string; toZoneId: string; onlyFrom?: string; countsAs?: string }` (comment: "`countsAs`: the card counts as that card where it lands (a Tool placed through a conversion)."). In its `applyEffect` case, replace `const zones = moveCard(...)` and the `card` lookup with:

```ts
      const moved = moveCard(state.zones, effect.cardInstanceId, effect.toZoneId);
      const card = moved.find((z) => z.id === effect.toZoneId)!.cards.at(-1)!;
      const zones = recordCountsAs(moved, origin!.id, effect.toZoneId, card, effect.countsAs);
      const destination = zones.find((z) => z.id === effect.toZoneId)!;
```

In `projects/engine/src/lib/cards/zones.ts` add:

```ts
// What `card` counts as where it lies in `zone`: what it was placed as, else itself.
export function cardCountsAs(zone: CardZone, card: CardInstance): string {
  return zone.countsAs?.[card.instanceId] ?? card.definitionId;
}

// `zones` after `card` moved from `fromZoneId` to `toZoneId`: the old zone
// forgets what it counted as there; the new one records `countsAs` (unless that
// is the card itself).
export function recordCountsAs(zones: CardZone[], fromZoneId: string, toZoneId: string, card: CardInstance, countsAs?: string): CardZone[] {
  return zones.map((zone) => {
    let map = zone.countsAs;
    if (zone.id === fromZoneId && map && card.instanceId in map) {
      const { [card.instanceId]: _gone, ...rest } = map;
      map = rest;
    }
    if (zone.id === toZoneId && countsAs && countsAs !== card.definitionId) map = { ...(map ?? {}), [card.instanceId]: countsAs };
    if (map === zone.countsAs) return zone;
    const { countsAs: _old, ...plain } = zone;
    return map && Object.keys(map).length > 0 ? { ...plain, countsAs: map } : plain;
  });
}
```

In `useCard` (resolve.ts) change `placesItself` to:

```ts
  // Equipment and delayed Tools played (not answered) place their own card,
  // a converted delayed Tool included (it lies there as what it was used as).
  const placesItself = !pending && (definition.category === 'equipment' || !!definition.delayed);
```

- [ ] **Step 7: Run the engine tests**

Run: `npx jest projects/engine`
Expected: PASS. `conversion.spec.ts` (Serpent Spear's 2 hand cards) still passes: `from` defaults to the hand.

- [ ] **Step 8: Run the whole suite and commit**

Run: `npx jest`
Expected: PASS.

```bash
git add projects/engine
git commit -m "feat(engine): one-card conversions from hand or equipment, rescuing through a conversion, cards that count as another

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 4: Content — the cards and queries the skills lean on, and the skill helpers

**Files:**
- Create: `projects/content/src/lib/shared/skills.ts`, `projects/content/src/lib/shared/groundwork.spec.ts`
- Modify: `projects/engine/src/lib/registry/types.ts` (`AbilityModifiers`), `projects/content/src/lib/shared/{abilities,queries,steps,choices,delayed,tools}.ts`, `projects/content/src/lib/cards/{sha,duel,lightning,mass-attack,draw-two,harvest,peach-garden,coerce}.ts`, `projects/content/src/lib/cards/equipment/sky-scorcher.ts`, `projects/content/src/lib/modes/guozhan.ts` (only if it imports `toolOnTargets`; it doesn't today)

**Interfaces:**
- Consumes: `cardCountsAs`, `usedCardFrom`, `usedCardKey`, `PendingResponse.data`, `SkillStepEffect` (Tasks 2–3).
- Produces:
  - `AbilityModifiers` gains `distanceToOthers?: number`, `toolsIgnoreDistance?: boolean`, `untargetableWithEmptyHandBy?: string[]`, `doubleAnswers?: boolean`.
  - `untargetableBy(state, seatId, cardId, registry)` also honours `untargetableWithEmptyHandBy`; `answersNeededAgainst(state, seatId, registry): 1 | 2`; `toolsIgnoreDistance(state, seatId, registry): boolean` (abilities.ts).
  - `seatDistance` adds the `from` seat's `distanceToOthers`.
  - `toolOnTargets(tool: UsedCard, userSeatId: string, targets: Target[], extra?: Target[]): Effect[]` (no state, no card lookup: the card as used).
  - `placeInJudgmentArea(state, cardInstanceId, seatId, countsAs?: string)`; `holdsDelayed` reads `countsAs`; the Judgment Phase judges a card as what it counts as.
  - `seatCardOptions(state, ownerSeatId, toZoneId, { judgment = true } = {})`.
  - `ShaStepData.unblockable?: boolean` carried by `shaStep`; at `sha-armor` an unblockable Sha goes straight to `sha-hit`; Sha asks for `answersNeededAgainst(user)` Shan.
  - Duel works with no physical card, carries `cause.card`, and asks for `answersNeededAgainst(other)` Sha each turn of it (`PendingResponse.data: { needed, provided }`).
  - Lightning moves itself to the discard pile before its damage; its damage carries `cause.card`.
  - `abilityKey(owner: AbilityOwner): string` exported from `shared/steps.ts` (the old private `ownerKey`).
  - `shared/skills.ts`: `SkillStep`, `skillStep`, `reasonOf`, `ask`, `used`, `draw`, `heal`, `skillDamage`, `discardMoves`, `selectionOf`, `choiceOf`, `seatOptions`, `isLiving`, `isHurt`, `handZoneId`, `equipZoneId`, `ownCards`, `otherLivingSeatIds`, `lastDrawnBy`, `lastMoveBetween`, `SkillRule`, `on`, `atDrawPhase` (signatures in Step 9).

- [ ] **Step 1: Write the failing tests**

Create `projects/content/src/lib/shared/groundwork.spec.ts`:

```ts
import type { AbilityModifiers, GameState } from 'engine';
import { usedCardOf } from 'engine';
import { card, harness, hp, ids, kwMode, registry, seat, table } from '../generals/skills.testing';
import { seatDistance } from './queries';
import { cardStep } from './steps';

// Test Generals with one compulsory modifier each (not in the real data).
const tester = (id: string, modifiers: AbilityModifiers) => registry.generals.set(id, { id, kingdom: 'Wei', maxHp: 4, skills: [{ id, compulsory: true, modifiers }] });
tester('test-rider', { distanceToOthers: -1 });
tester('test-reach', { toolsIgnoreDistance: true });
tester('test-humble', { untargetableBy: ['steal', 'capture'] });
tester('test-empty', { untargetableWithEmptyHandBy: ['sha', 'duel'] });
tester('test-matchless', { doubleAnswers: true });

const { legal, play, pass, respond, run } = harness();
const withA = (main: string, revealed = true) => ({ 'seat-a': [main, 'dong-zhuo', revealed] as [string, string, boolean] });
const targetsOf = (s: GameState, cardId: string) =>
  legal(s, 'seat-a').flatMap((a) => (a.kind === 'PlayCardAction' && a.cardInstanceId === cardId ? [a.targets[0]?.seatId] : []));

describe('distanceToOthers', () => {
  it('brings every other seat 1 closer, never below 1, and is off while its General is hidden', () => {
    const s = table({}, { generals: withA('test-rider') });
    expect(seatDistance(s, 'seat-a', 'seat-c', registry)).toBe(1);
    expect(seatDistance(s, 'seat-a', 'seat-b', registry)).toBe(1);
    expect(seatDistance(s, 'seat-c', 'seat-a', registry)).toBe(2);
    expect(seatDistance(table({}, { generals: withA('test-rider', false) }), 'seat-a', 'seat-c', registry)).toBe(2);
  });
});

describe('toolsIgnoreDistance', () => {
  it('lets Steal reach a seat 2 away', () => {
    const cards = { 'seat-a:hand': [card('st', 'steal')], 'seat-c:hand': [card('x', 'shan')] };
    expect(targetsOf(table(cards), 'st')).not.toContain('seat-c');
    expect(targetsOf(table(cards, { generals: withA('test-reach') }), 'st')).toContain('seat-c');
  });
});

describe('untargetableBy', () => {
  it('keeps Steal and Capture off the seat', () => {
    const s = table({ 'seat-a:hand': [card('st', 'steal'), card('cp', 'capture', 'spade', 6)], 'seat-b:hand': [card('x', 'shan')] }, { generals: { 'seat-b': ['test-humble', 'dong-zhuo'] } });
    expect(targetsOf(s, 'st')).not.toContain('seat-b');
    expect(targetsOf(s, 'cp')).not.toContain('seat-b');
  });

  it('with an empty hand only: Sha and Duel can’t target the seat', () => {
    const empty = table({ 'seat-a:hand': [card('s1', 'sha'), card('d1', 'duel')] }, { generals: { 'seat-b': ['test-empty', 'dong-zhuo'] } });
    expect(targetsOf(empty, 's1')).not.toContain('seat-b');
    expect(targetsOf(empty, 'd1')).not.toContain('seat-b');
    const holding = table({ 'seat-a:hand': [card('s1', 'sha'), card('d1', 'duel')], 'seat-b:hand': [card('x', 'peach')] }, { generals: { 'seat-b': ['test-empty', 'dong-zhuo'] } });
    expect(targetsOf(holding, 's1')).toContain('seat-b');
    expect(targetsOf(holding, 'd1')).toContain('seat-b');
  });
});

describe('doubleAnswers', () => {
  const shan = [card('n1', 'shan'), card('n2', 'shan', 'heart')];

  it('a Sha needs two Shan: one is not enough', () => {
    let s = play(table({ 'seat-a:hand': [card('s1', 'sha')], 'seat-b:hand': shan }, { generals: withA('test-matchless') }), 's1', 'seat-b');
    s = respond(s, 'n1');
    expect(s.pendingResponse?.respondingSeatId).toBe('seat-b');
    expect(hp(pass(s), 'seat-b')).toBe(3);
    expect(hp(respond(s, 'n2'), 'seat-b')).toBe(4);
  });

  it('in a Duel, the other seat plays two Sha each time before it turns back', () => {
    let s = play(table({ 'seat-a:hand': [card('d1', 'duel')], 'seat-b:hand': [card('b1', 'sha'), card('b2', 'sha')] }, { generals: withA('test-matchless') }), 'd1', 'seat-b');
    expect(s.pendingResponse?.respondingSeatId).toBe('seat-b');
    s = respond(s, 'b1');
    expect(s.pendingResponse?.respondingSeatId).toBe('seat-b');
    s = respond(s, 'b2');
    expect(s.pendingResponse?.respondingSeatId).toBe('seat-a');
    expect(hp(pass(s), 'seat-a')).toBe(3);
  });
});

describe('an unblockable Sha', () => {
  it('goes from its armour check straight to the hit: no Shan is asked for', () => {
    const sha = usedCardOf(card('s1', 'sha'));
    const s = run(table({ 'seat-b:hand': [card('n1', 'shan')] }), [cardStep('sha-armor', sha, 'seat-a', seat('seat-b'), { extra: 0, unblockable: true })]);
    expect(s.pendingResponse).toBeNull();
    expect(hp(s, 'seat-b')).toBe(3);
  });
});

describe('a Duel with no physical card', () => {
  it('runs its windows and deals damage caused by the Duel as used', () => {
    const virtual = { as: 'duel', colour: 'none' as const, physical: [] };
    const s = run(table(), [{ kind: 'UseCardEffect', seatId: 'seat-b', card: virtual, targets: [seat('seat-c')] }]);
    expect(s.pendingResponse?.respondingSeatId).toBe('seat-c');
    const hit = pass(s);
    expect(hp(hit, 'seat-c')).toBe(3);
    expect(hit.log.find((e) => e.kind === 'DamageDealtEvent')).toMatchObject({ damage: { source: seat('seat-b'), cause: { card: virtual } } });
  });
});

describe('Lightning', () => {
  it('goes to the discard pile before its 3 damage, which names it as the cause', () => {
    const bolt = card('li', 'lightning', 'spade', 1);
    // Guozhan's own triggers judge the Judgment slot.
    const s = harness(kwMode).settle(table({ 'seat-a:judgment': [bolt], drawPile: [card('j', 'shan', 'spade', 5), ...Array.from({ length: 4 }, (_, i) => card(`p${i}`, 'shan', 'heart'))] }, { phase: 'Start' }));
    const moved = s.log.findIndex((e) => e.kind === 'CardMovedEvent' && e.cardInstanceId === 'li' && e.toZoneId === 'discardPile');
    const damaged = s.log.findIndex((e) => e.kind === 'DamageDealtEvent');
    expect(moved).toBeGreaterThan(-1);
    expect(moved).toBeLessThan(damaged);
    expect(s.log[damaged]).toMatchObject({ damage: { amount: 3, cause: { cardInstanceId: 'li', card: { as: 'lightning' } } } });
  });
});

describe('a card that counts as a delayed Tool', () => {
  // A diamond Shan lying in seat-a's Judgment slot as a Capture.
  const placed = (judgedSuit: 'heart' | 'club') => {
    const s = table({ 'seat-a:judgment': [card('c1', 'shan', 'diamond', 3)], drawPile: [card('j', 'sha', judgedSuit, 9), ...Array.from({ length: 4 }, (_, i) => card(`p${i}`, 'shan'))] }, { phase: 'Start' });
    return { ...s, zones: s.zones.map((z) => (z.id === 'seat-a:judgment' ? { ...z, countsAs: { c1: 'capture' } } : z)) };
  };

  it('is judged as that Tool in the Judgment Phase', () => {
    const { settle: kwSettle } = harness(kwMode);
    const spared = kwSettle(placed('heart'));
    expect(spared.log.find((e) => e.kind === 'JudgmentEvent')).toMatchObject({ reader: { kind: 'card', card: { as: 'capture' } } });
    expect(spared.phase).toBe('Play');
    const captured = kwSettle(placed('club'));
    expect(captured.log.some((e) => e.kind === 'PhaseSkippedEvent' && e.phase === 'Play')).toBe(true);
    expect(ids(captured, 'seat-a:judgment')).toEqual([]);
  });

  it('counts as one already held: a second Capture can’t be placed there', () => {
    const s = { ...placed('heart'), phase: 'Play' as const, turn: { turnNumber: 1, ownerSeatId: 'seat-b', extraTurnStack: [] } };
    const withCapture = { ...s, zones: s.zones.map((z) => (z.id === 'seat-b:hand' ? { ...z, cards: [card('cp', 'capture', 'spade', 6)] } : z)) };
    const offers = legal(withCapture, 'seat-b').flatMap((a) => (a.kind === 'PlayCardAction' && a.cardInstanceId === 'cp' ? [a.targets[0]?.seatId] : []));
    expect(offers).not.toContain('seat-a');
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx jest projects/content/src/lib/shared/groundwork.spec.ts`
Expected: FAIL — compile errors on the new modifier fields; once those exist, the behaviour assertions fail.

- [ ] **Step 3: The modifiers**

In `projects/engine/src/lib/registry/types.ts`, `AbilityModifiers` gains:

```ts
  // Added to the owner's distance to every other seat (Horsemanship: -1); never below 1.
  distanceToOthers?: number;
  // The owner's Tools ignore distance (Wondrous Talent: Steal, Starvation).
  toolsIgnoreDistance?: boolean;
  // Card ids that can't target the owner while its hand is empty (Empty City: Sha, Duel).
  untargetableWithEmptyHandBy?: string[];
  // The owner's Sha needs two Shan, and in a Duel with it the other seat plays two Sha each time (Matchless).
  doubleAnswers?: boolean;
```

In `projects/content/src/lib/shared/abilities.ts` replace `untargetableBy` and add the two queries:

```ts
// Whether `cardId` can't target `seatId`: an ability of its says so (Wood
// Armor, Humility), or says so while its hand is empty (Empty City).
export function untargetableBy(state: GameState, seatId: string, cardId: string, registry: ContentRegistry): boolean {
  const seat = state.seats.find((s) => s.id === seatId);
  const handEmpty = !seat || (state.zones.find((z) => z.id === seat.hand.zoneId)?.cards.length ?? 0) === 0;
  return activeAbilities(state, seatId, registry).some(
    ({ modifiers }) => !!modifiers?.untargetableBy?.includes(cardId) || (handEmpty && !!modifiers?.untargetableWithEmptyHandBy?.includes(cardId))
  );
}

// How many answers `seatId`'s attacks need: Shan to dodge its Sha, Sha each
// time in a Duel with it. Two with Matchless, else one.
export function answersNeededAgainst(state: GameState, seatId: string, registry: ContentRegistry): 1 | 2 {
  return activeAbilities(state, seatId, registry).some((a) => a.modifiers?.doubleAnswers) ? 2 : 1;
}

// Whether `seatId`'s Tools ignore distance (Wondrous Talent).
export function toolsIgnoreDistance(state: GameState, seatId: string, registry: ContentRegistry): boolean {
  return activeAbilities(state, seatId, registry).some((a) => a.modifiers?.toolsIgnoreDistance);
}
```

In `projects/content/src/lib/shared/queries.ts`, `seatDistance`:

```ts
// Distance for targeting: living-seat ring distance, +1 if the target rides a
// defensive mount, −1 if the attacker rides an offensive mount, plus the
// attacker's distance modifiers (Horsemanship), never below 1.
export function seatDistance(state: GameState, fromSeatId: string, toSeatId: string, registry: ContentRegistry): number {
  const base = getSeatDistance(state, fromSeatId, toSeatId);
  if (!Number.isFinite(base)) return base;
  const defensive = equippedSlot(state, toSeatId, 'defensiveMount', registry) ? 1 : 0;
  const offensive = equippedSlot(state, fromSeatId, 'offensiveMount', registry) ? 1 : 0;
  const skills = activeAbilities(state, fromSeatId, registry).reduce((sum, a) => sum + (a.modifiers?.distanceToOthers ?? 0), 0);
  return Math.max(1, base + defensive - offensive + skills);
}
```

- [ ] **Step 4: Tools take the card as used**

In `projects/content/src/lib/shared/tools.ts` replace `toolOnTargets`:

```ts
// One ToolOnTargetEffect per target, in the order given, for `tool` (the Tool
// card as `userSeatId` uses it: itself, a conversion's card, or a skill's card
// with no physical card). `extra` rides along with each (Coerce's victim).
export function toolOnTargets(tool: UsedCard, userSeatId: string, targets: Target[], extra?: Target[]): Effect[] {
  return targets.map((target) => ({ kind: 'ToolOnTargetEffect', tool, userSeatId, target, ...(extra ? { extra } : {}), counterCardIds: COUNTER_CARD_IDS }));
}
```

Update every caller to pass `ctx.card` and drop `state`/`ctx.cardInstanceId`: `mass-attack.ts` (`toolOnTargets(ctx.card, ctx.seatId, targetsOf(state, ctx.seatId, registry))`), `draw-two.ts`, `harvest.ts`, `peach-garden.ts`, `coerce.ts` (`toolOnTargets(ctx.card, ctx.seatId, [ctx.targets[0]], [ctx.targets[1]])`), `duel.ts` (Step 7), `shared/choices.ts` (Step 5). Remove now-unused imports (`usedCardOf` in tools.ts). In `coerce.ts`, where it lists the victims a holder's Sha can reach, also drop seats `untargetableBy(state, victimId, 'sha', registry)`.

- [ ] **Step 5: Steal, Break, Capture, Starvation**

In `projects/content/src/lib/shared/choices.ts` (import `toolsIgnoreDistance` and `untargetableBy` from `./abilities`):
- `seatCardOptions` gains a fourth parameter `{ judgment = true }: { judgment?: boolean } = {}` and loops over `[...owned('equip'), ...(judgment ? owned('judgment') : [])]`. Comment: "`judgment: false` leaves the Judgment slot out (Feedback)."
- `pickACardTool`'s `legalPlayTargets` filter becomes:

```ts
        ([target]) =>
          target.kind === 'seat' &&
          holdsAnyCard(state, target.seatId) &&
          !untargetableBy(state, target.seatId, id, registry) &&
          (maxDistance === undefined || toolsIgnoreDistance(state, ctx.seatId, registry) || seatDistance(state, ctx.seatId, target.seatId, registry) <= maxDistance)
```

- its `play` becomes `(state, ctx) => (ctx.respondingTo || ctx.targets.length === 0 ? [] : toolOnTargets(ctx.card, ctx.seatId, [ctx.targets[0]]))`.

In `projects/content/src/lib/shared/delayed.ts`:

```ts
// Whether `seatId`'s judgment area already holds a `definitionId` (or a card placed as one).
export function holdsDelayed(state: GameState, seatId: string, definitionId: string): boolean {
  const zone = judgmentZoneOf(state, seatId);
  return !!zone?.cards.some((c) => cardCountsAs(zone, c) === definitionId);
}

// The move that puts a delayed Tool face up into `seatId`'s judgment area, as
// `countsAs` when it is another card used as that Tool (Country Scene).
export function placeInJudgmentArea(state: GameState, cardInstanceId: string, seatId: string, countsAs?: string): Effect[] {
  const zone = judgmentZoneOf(state, seatId);
  if (!zone) throw new Error(`Seat ${seatId} has no judgment area`);
  return [{ kind: 'MoveCardEffect', cardInstanceId, toZoneId: zone.id, ...(countsAs ? { countsAs } : {}) }];
}
```

- `skipPhaseTool`: the target filter gains `!untargetableBy(state, target.seatId, id, registry)` and the distance check becomes `(maxDistance === undefined || toolsIgnoreDistance(state, ctx.seatId, registry) || seatDistance(...) <= maxDistance)`; `play` passes `ctx.card.as`: `placeInJudgmentArea(state, ctx.cardInstanceId, target.seatId, ctx.card.as)`.
- `judgmentPhaseTrigger`'s effect builds each `tool` as what the card counts as:

```ts
    const zone = judgmentZoneOf(state, seatId)!;
    const lastInFirstOut = [...zone.cards].reverse();
    return lastInFirstOut.flatMap((card): Effect[] => {
      const as = cardCountsAs(zone, card);
      const tool = as === card.definitionId ? usedCardOf(card) : usedCardFrom([card], as);
      …
```

Import `cardCountsAs`, `usedCardFrom` from `engine`; `untargetableBy`, `toolsIgnoreDistance` from `./abilities`.

- [ ] **Step 6: Lightning**

In `projects/content/src/lib/cards/lightning.ts`:
- `play`: `placeInJudgmentArea(state, ctx.cardInstanceId, ctx.seatId, ctx.card.as)`.
- `onJudged`: the Lightning card goes to the discard pile first, then the damage, which names it:

```ts
  onJudged: (state, { tool, seatId, judged }) => {
    if (!isStruck(judged.suit, judged.rank)) return [];
    const card = tool.physical[0];
    const effects: Effect[] = [];
    // To the discard pile first, so a skill reacting to the damage can take it (Evil Hero).
    if (card) effects.push({ kind: 'MoveCardEffect', cardInstanceId: card.instanceId, toZoneId: requireZoneOfKind(state.zones, 'discardPile').id });
    effects.push({
      kind: 'DamageEffect',
      damage: { source: null, target: { kind: 'seat', seatId }, amount: 3, nature: 'normal', cause: { ...(card ? { cardInstanceId: card.instanceId } : {}), card: tool } },
    });
    return effects;
  },
```

- `onCleanup`: `placeInJudgmentArea(state, card.instanceId, next, tool.as)`.
- Update the header comment: "a spade from 2 to 9 discards Lightning, then deals 3 damage to the holder, with no source".

- [ ] **Step 7: Sha and Duel**

In `projects/content/src/lib/cards/sha.ts` (import `answersNeededAgainst` and `untargetableBy` from `../shared/abilities`):
- `ShaStepData` gains `// Can't be dodged: no Shan is asked for (Iron Cavalry).` `unblockable?: boolean;` and its comment lists it.
- `shaStep` keeps it:

```ts
// The next step of the same Sha at the same target, keeping its extra damage
// and whether it can be dodged.
export function shaStep(from: CardStep, step: string, more: ShaStepData = {}): CardStep {
  const { extra = 0, unblockable } = shaData(from);
  return cardStep(step, from.card, from.userSeatId, from.target, { extra, ...(unblockable ? { unblockable } : {}), ...more });
}
```

- `legalPlayTargets`'s filter adds `&& !untargetableBy(state, target.seatId, 'sha', registry)`.
- `onStep` takes `(state, step, registry)` and `sha-armor` becomes:

```ts
      case 'sha-armor':
        // An unblockable Sha hits; otherwise the target owes 1 Shan (2 against Matchless).
        return shaData(step).unblockable
          ? [shaStep(step, 'sha-hit')]
          : [shaStep(step, 'sha-shan', { needed: answersNeededAgainst(state, step.userSeatId, registry), provided: 0 })];
```

In `projects/content/src/lib/cards/equipment/sky-scorcher.ts`, `extraTargets`'s filter adds `&& !untargetableBy(state, s.id, 'sha', registry)`.

Replace `projects/content/src/lib/cards/duel.ts` with:

```ts
import type { CardDefinition, Effect, UsedCard } from 'engine';
import { usedCardKey } from 'engine';
import { otherLivingSeatTargets } from '../shared/queries';
import { toolOnTargets } from '../shared/tools';
import { answersNeededAgainst, untargetableBy } from '../shared/abilities';

const DUEL_DAMAGE = 1;

interface DuelData {
  // Sha this responder owes this time (2 against Matchless), and has played so far.
  needed: number;
  provided: number;
}

// One step of a Duel: `responderSeatId` must play a Sha or take the damage,
// dealt by `otherSeatId`. `answeredWith` names the Sha that led here. Works
// for a Duel with no physical card (Sow Discord's).
function duelWindow(tool: UsedCard, responderSeatId: string, otherSeatId: string, data: DuelData, answeredWith?: string): Effect {
  const key = usedCardKey(tool);
  const first = tool.physical[0]?.instanceId;
  return {
    kind: 'OpenResponseEffect',
    pendingResponse: {
      // Each step gets its own id: the opening one, then one per Sha answered.
      id: answeredWith ? `duel-response-${key}-${answeredWith}` : `duel-response-${key}`,
      respondingSeatId: responderSeatId,
      allowedActionKinds: ['RespondAction', 'PassAction'],
      allowedCardIds: ['sha'],
      sourceCard: { instanceId: key, definitionId: 'duel' },
      data: { ...data },
      context: {
        effect: {
          kind: 'DamageEffect',
          damage: {
            source: { kind: 'seat', seatId: otherSeatId },
            target: { kind: 'seat', seatId: responderSeatId },
            amount: DUEL_DAMAGE,
            nature: 'normal',
            cause: { ...(first ? { cardInstanceId: first } : {}), card: tool },
          },
        },
      },
    },
  };
}

// Duel: after its Wuxie check, starting with the target, the two seats take
// turns playing a Sha (two each time against Matchless); the first who doesn't
// takes 1 damage from the other.
export const duelCard: CardDefinition = {
  id: 'duel',
  name: 'Duel',
  category: 'tool',
  legalPlayTargets: (state, ctx, registry) => otherLivingSeatTargets(state, ctx.seatId).filter(([t]) => t.kind === 'seat' && !untargetableBy(state, t.seatId, 'duel', registry)),
  play: (_state, ctx) => {
    if (ctx.respondingTo) return [];
    if (ctx.targets.length === 0) return []; // no target chosen — a no-op rather than a crash
    return toolOnTargets(ctx.card, ctx.seatId, [ctx.targets[0]]);
  },
  onTarget: (state, { tool, userSeatId, target }, registry) => {
    if (target.kind !== 'seat') return [];
    return [duelWindow(tool, target.seatId, userSeatId, { needed: answersNeededAgainst(state, userSeatId, registry), provided: 0 })];
  },
  // A Sha: another is still owed (Matchless), or the Duel turns back on the other seat.
  onResponse: (state, { pending, seatId, cardInstanceId }, registry) => {
    const damage = pending.context.effect.kind === 'DamageEffect' ? pending.context.effect.damage : null;
    const tool = damage?.cause?.card;
    if (damage?.source?.kind !== 'seat' || !tool) return [];
    const { needed = 1, provided = 0 } = (pending.data ?? {}) as Partial<DuelData>;
    if (provided + 1 < needed) return [duelWindow(tool, seatId, damage.source.seatId, { needed, provided: provided + 1 }, cardInstanceId)];
    return [duelWindow(tool, damage.source.seatId, seatId, { needed: answersNeededAgainst(state, seatId, registry), provided: 0 }, cardInstanceId)];
  },
};
```

- [ ] **Step 8: `abilityKey`**

In `projects/content/src/lib/shared/steps.ts` rename `ownerKey` to an exported `abilityKey` (same body), with the comment "An ability's key in an `acted` list: the worn card, or the seat/slot/skill." Update its two uses in the file.

- [ ] **Step 9: The skill helpers**

Create `projects/content/src/lib/shared/skills.ts`:

```ts
import type {
  CardInstance, CardMovedEvent, CardsDrawnEvent, ChoiceOption, ContentRegistry, DecisionReason, Effect, GameState,
  GeneralOwner, PendingChoice, SelectionContinuation, SkillTrigger, TriggerPoint,
} from 'engine';
import { livingSeatOrderFrom, requireZoneOfKind } from 'engine';
import { abilityKey } from './steps';
import { handOf } from './queries';

// Building blocks for the General skills (generals/*.ts). Each takes the
// `owner` the engine gathered the skill for: the seat and slot it acts for.

export type SkillStep = Extract<Effect, { kind: 'SkillStepEffect' }>;
type DrawPhase = Extract<Effect, { kind: 'DrawPhaseEffect' }>;

// A step of `owner`'s skill (SkillDefinition.onStep), carrying `data`.
export function skillStep(owner: GeneralOwner, step: string, data: Record<string, unknown> = {}): SkillStep {
  return { kind: 'SkillStepEffect', owner, step, data };
}

// What a skill's decisions are about; `targetSeatId`: the other seat involved.
export function reasonOf(owner: GeneralOwner, targetSeatId?: string): DecisionReason {
  return { kind: 'ability', owner, abilityId: owner.skillId, ...(targetSeatId ? { targetSeatId } : {}) };
}

// Asks `owner`'s seat whether to use the skill: Use queues `effects`, Don't
// queues `otherwise`. A hidden General's ask reveals it on Use (the engine).
export function ask(owner: GeneralOwner, effects: Effect[], otherwise: Effect[] = [], targetSeatId?: string): Effect {
  return { kind: 'AskUseEffect', owner, abilityId: owner.skillId, effects, ...(otherwise.length > 0 ? { otherwise } : {}), ...(targetSeatId ? { targetSeatId } : {}) };
}

// Logs that the skill applied: `outcome` is content's code the history reads.
export function used(owner: GeneralOwner, outcome = 'used', targetSeatId?: string): Effect {
  return { kind: 'AbilityUsedEffect', owner, abilityId: owner.skillId, outcome, ...(targetSeatId ? { targetSeatId } : {}) };
}

export const draw = (seatId: string, count: number): Effect => ({ kind: 'DrawCardsEffect', seatId, count });
export const heal = (seatId: string, amount = 1): Effect => ({ kind: 'HealEffect', target: { kind: 'seat', seatId }, amount });

// Damage from `owner`'s seat to `targetSeatId`, caused by the skill (no card).
export function skillDamage(owner: GeneralOwner, targetSeatId: string, amount = 1): Effect {
  return {
    kind: 'DamageEffect',
    damage: { source: { kind: 'seat', seatId: owner.seatId }, target: { kind: 'seat', seatId: targetSeatId }, amount, nature: 'normal', cause: { skillId: owner.skillId } },
  };
}

// Each card to the discard pile, in order.
export function discardMoves(state: GameState, cardInstanceIds: readonly string[]): Effect[] {
  const discardPileId = requireZoneOfKind(state.zones, 'discardPile').id;
  return cardInstanceIds.map((cardInstanceId) => ({ kind: 'MoveCardEffect', cardInstanceId, toZoneId: discardPileId }));
}

interface SelectionSpec {
  of: 'cards' | 'seats';
  eligibleIds: string[];
  min: number;
  max: number;
  then: SelectionContinuation;
  // Absent: it can't be cancelled.
  onCancel?: Effect[];
  // Who selects; default the owner's seat.
  seatId?: string;
  targetSeatId?: string;
}

// A selection for `owner`'s skill.
export function selectionOf(state: GameState, owner: GeneralOwner, spec: SelectionSpec): Effect {
  const seatId = spec.seatId ?? owner.seatId;
  return {
    kind: 'OpenSelectionEffect',
    selection: {
      id: `${owner.skillId}-${seatId}-${state.log.length}`,
      seatId,
      reason: reasonOf(owner, spec.targetSeatId),
      of: spec.of,
      eligibleIds: spec.eligibleIds,
      min: spec.min,
      max: spec.max,
      then: spec.then,
      ...(spec.onCancel ? { onCancel: spec.onCancel } : {}),
    },
  };
}

interface ChoiceSpec {
  verb: PendingChoice['verb'];
  options: ChoiceOption[];
  // Who chooses; default the owner's seat.
  seatId?: string;
  targetSeatId?: string;
}

// A choice for `owner`'s skill.
export function choiceOf(state: GameState, owner: GeneralOwner, spec: ChoiceSpec): Effect {
  const seatId = spec.seatId ?? owner.seatId;
  return {
    kind: 'OpenChoiceEffect',
    choice: { id: `${owner.skillId}-${seatId}-${state.log.length}`, seatId, reason: reasonOf(owner, spec.targetSeatId), verb: spec.verb, options: spec.options },
  };
}

// One option per seat; picking one queues `effectsFor(seatId)`.
export function seatOptions(seatIds: readonly string[], effectsFor: (seatId: string) => Effect[]): ChoiceOption[] {
  return seatIds.map((seatId) => ({ id: seatId, shows: { kind: 'seat', seatId }, effects: effectsFor(seatId) }));
}

export const isLiving = (state: GameState, seatId: string) => state.seats.some((s) => s.id === seatId && !s.eliminated);
export const isHurt = (state: GameState, seatId: string) => state.seats.some((s) => s.id === seatId && !s.eliminated && s.combinedHp < s.maxCombinedHp);

export function handZoneId(state: GameState, seatId: string): string {
  const seat = state.seats.find((s) => s.id === seatId);
  if (!seat) throw new Error(`Unknown seat: ${seatId}`);
  return seat.hand.zoneId;
}

export function equipZoneId(state: GameState, seatId: string): string {
  const seat = state.seats.find((s) => s.id === seatId);
  if (!seat) throw new Error(`Unknown seat: ${seatId}`);
  return seat.equipped.zoneId;
}

// A seat's hand, then (with `withEquipment`) its worn cards.
export function ownCards(state: GameState, seatId: string, withEquipment: boolean): CardInstance[] {
  const worn = withEquipment ? (state.zones.find((z) => z.id === equipZoneId(state, seatId))?.cards ?? []) : [];
  return [...handOf(state, seatId), ...worn];
}

// The other living seats, in turn order after `seatId`.
export function otherLivingSeatIds(state: GameState, seatId: string): string[] {
  return livingSeatOrderFrom(state, seatId).filter((id) => id !== seatId);
}

// The cards `seatId` drew last (the latest CardsDrawnEvent for it).
export function lastDrawnBy(state: GameState, seatId: string): string[] {
  const event = [...state.log].reverse().find((e): e is CardsDrawnEvent => e.kind === 'CardsDrawnEvent' && e.seatId === seatId);
  return event?.cardInstanceIds ?? [];
}

// The card that last moved from `fromZoneId` to `toZoneId`, if any.
export function lastMoveBetween(state: GameState, fromZoneId: string, toZoneId: string): string | undefined {
  return [...state.log].reverse().find((e): e is CardMovedEvent => e.kind === 'CardMovedEvent' && e.fromZoneId === fromZoneId && e.toZoneId === toZoneId)?.cardInstanceId;
}

// A General skill's trigger: the owner is always a General's here.
export interface SkillRule<S> {
  condition(state: GameState, subject: S, owner: GeneralOwner, registry: ContentRegistry): boolean;
  effect(state: GameState, subject: S, owner: GeneralOwner, registry: ContentRegistry): Effect[];
}

export function on<S>(point: TriggerPoint, rule: SkillRule<S>): SkillTrigger {
  return {
    point,
    condition: (state, subject, owner, registry) => owner?.kind === 'general' && !!registry && rule.condition(state, subject as S, owner, registry),
    effect: (state, subject, owner, registry) => rule.effect(state, subject as S, owner as GeneralOwner, registry!),
  };
}

interface DrawPhaseRule {
  condition?(state: GameState, draw: DrawPhase, owner: GeneralOwner, registry: ContentRegistry): boolean;
  // What Use does, given the draw marked as having had this skill's say.
  use(state: GameState, passed: DrawPhase, owner: GeneralOwner, registry: ContentRegistry): Effect[];
}

// An optional skill at its owner's Draw Phase draw (Bare the Chest, Brave
// Gesture, Raid): asked once per draw; Don't lets the draw go ahead.
export function atDrawPhase(rule: DrawPhaseRule): SkillTrigger {
  return on<DrawPhase>('before:DrawPhaseEffect', {
    condition: (state, draw, owner, registry) =>
      draw.seatId === owner.seatId && !(draw.acted ?? []).includes(abilityKey(owner)) && (rule.condition?.(state, draw, owner, registry) ?? true),
    effect: (state, draw, owner, registry) => {
      const passed: DrawPhase = { ...draw, acted: [...(draw.acted ?? []), abilityKey(owner)] };
      return [ask(owner, rule.use(state, passed, owner, registry), [passed])];
    },
  });
}
```

- [ ] **Step 10: Run the tests**

Run: `npx jest projects/content`
Expected: PASS. Specs that compared a Duel's `pendingResponse` with `toEqual` now see `data: { needed: 1, provided: 0 }`: add it to those expectations (that is the only intended change in them). A spec that expected Lightning's damage before its move: flip the order.

- [ ] **Step 11: Run the whole suite and commit**

Run: `npx jest`
Expected: PASS.

```bash
git add projects/engine projects/content
git commit -m "feat(content): skill modifiers, an unblockable Sha, Matchless-ready Sha and Duel, converted delayed Tools, skill helpers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 5: Wei — Evil Hero, Feedback, Unyielding, Bestowed Rouse (and Escort)

Rule text: General Skills spec, "Wei". All four react to damage the owner takes (`after:DamageDealtEvent`). The mode's own after-triggers (reveal at half HP, dying) are gathered first, so a seat brought to 0 HP is rescued (or eliminated) before it is asked; an eliminated owner's ask is skipped by the engine.

**Files:**
- Modify: `projects/content/src/lib/generals/wei.ts`
- Create: `projects/content/src/lib/generals/wei.spec.ts`

**Interfaces:**
- Consumes: `shared/skills.ts` helpers, `seatCardOptions(…, { judgment: false })` (Task 4), `skill-step`/`give` continuations (Task 2).
- Produces: `WEI_GENERALS` entries `cao-cao` (`evil-hero`, `escort` lord), `sima-yi` (`feedback`; Task 6 adds `devil`), `xiahou-dun` (`unyielding`), `guo-jia` (`bestowed-rouse`; Task 6 adds `heavens-envy`). Skill objects are module constants named `evilHero`, `escort`, `feedback`, `unyielding`, `bestowedRouse` so Task 6 can list them.
- Unyielding's choice options: ids `discard` (label "Discard 2 Hand Cards") and `damage` (label "Take 1 Damage"); the chooser is the source seat; reason `{ kind: 'ability', owner, abilityId: 'unyielding', targetSeatId: sourceSeatId }`.

- [ ] **Step 1: Write the failing tests**

Create `projects/content/src/lib/generals/wei.spec.ts`:

```ts
import type { Effect, GameState } from 'engine';
import { skillsInPlay, usedCardFrom } from 'engine';
import { askedAbout, card, handIds, harness, hp, ids, registry, seat, table, TableOptions } from './skills.testing';

const { play, pass, run, use, decline, choose, select, cancel } = harness();
const at = (seatId: string, general: string, revealed = true): TableOptions['generals'] => ({ [seatId]: [general, 'xiahou-yuan', revealed] });
// seat-b's turn: it plays Sha s1 at seat-a, which doesn't dodge.
const shaHits = (cards: Record<string, ReturnType<typeof card>[]>, o: TableOptions) =>
  pass(play(table({ ...cards, 'seat-b:hand': [card('s1', 'sha'), ...(cards['seat-b:hand'] ?? [])] }, { owner: 'seat-b', ...o }), 's1', 'seat-a'));
const damage = (amount: number, cause?: Extract<Effect, { kind: 'DamageEffect' }>['damage']['cause']): Effect => ({
  kind: 'DamageEffect', damage: { source: seat('seat-b'), target: seat('seat-a'), amount, nature: 'normal', ...(cause ? { cause } : {}) },
});

describe('Cao Cao — Evil Hero', () => {
  it('may take the card that damaged him into his hand', () => {
    const s = shaHits({}, { generals: at('seat-a', 'cao-cao') });
    expect(askedAbout(s)).toBe('evil-hero');
    expect(handIds(use(s), 'seat-a')).toEqual(['s1']);
    expect(ids(decline(s), 'discardPile')).toEqual(['s1']);
  });

  it('takes both cards of a Serpent Spear Sha', () => {
    const [c1, c2] = [card('c1', 'peach', 'heart'), card('c2', 'shan', 'spade')];
    const s = run(table({ discardPile: [c1, c2] }, { generals: at('seat-a', 'cao-cao') }), [damage(1, { cardInstanceId: 'c1', card: usedCardFrom([c1, c2], 'sha') })]);
    expect(handIds(use(s), 'seat-a')).toEqual(['c1', 'c2']);
  });

  it('is not asked when the card has left the discard pile and processing, or for damage with no card', () => {
    const c1 = card('c1', 'sha');
    expect(run(table({ 'seat-c:hand': [c1] }, { generals: at('seat-a', 'cao-cao') }), [damage(1, { cardInstanceId: 'c1', card: usedCardFrom([c1], 'sha') })]).pendingChoice).toBeUndefined();
    expect(run(table({}, { generals: at('seat-a', 'cao-cao') }), [damage(1, { skillId: 'unyielding' })]).pendingChoice).toBeUndefined();
  });

  it('hidden: asked as a reveal; Use reveals Cao Cao, then takes the card', () => {
    const s = shaHits({}, { generals: at('seat-a', 'cao-cao', false) });
    expect(s.pendingChoice?.options[0].shows).toEqual({ kind: 'use', reveals: 'main' });
    const taken = use(s);
    expect(taken.seats[0].generals!.main.revealed).toBe(true);
    expect(taken.log.find((e) => e.kind === 'GeneralRevealedEvent')).toMatchObject({ seatId: 'seat-a', forAbilityId: 'evil-hero' });
    expect(handIds(taken, 'seat-a')).toEqual(['s1']);
  });

  it('Escort is a Lord skill: never in play', () => {
    expect(skillsInPlay(table({}, { generals: at('seat-a', 'cao-cao') }), 'seat-a', registry).map((s) => s.skill.id)).toEqual(['evil-hero']);
  });
});

describe('Sima Yi — Feedback', () => {
  it('may take one of the damaging seat’s cards: its hand face down, or a worn card', () => {
    const s = shaHits({ 'seat-b:hand': [card('x1', 'shan')], 'seat-b:equip': [card('cb', 'crossbow', 'club', 1)] }, { generals: at('seat-a', 'sima-yi') });
    expect(askedAbout(s)).toBe('feedback');
    expect(s.pendingChoice?.reason).toMatchObject({ targetSeatId: 'seat-b' });
    const picking = use(s);
    expect(picking.pendingChoice).toMatchObject({ seatId: 'seat-a', verb: 'take' });
    expect(picking.pendingChoice!.options.map((o) => o.id)).toEqual(['hand', 'cb']);
    const took = choose(picking, 'cb');
    expect(handIds(took, 'seat-a')).toEqual(['cb']);
    expect(handIds(choose(picking, 'hand'), 'seat-a')).toEqual(['x1']);
  });

  it('is not asked when the source holds nothing it could take, or there is no source', () => {
    expect(shaHits({ 'seat-b:judgment': [card('cp', 'capture')] }, { generals: at('seat-a', 'sima-yi') }).pendingChoice).toBeUndefined();
    const noSource: Effect = { kind: 'DamageEffect', damage: { source: null, target: seat('seat-a'), amount: 1, nature: 'normal' } };
    expect(run(table({}, { generals: at('seat-a', 'sima-yi') }), [noSource]).pendingChoice).toBeUndefined();
  });
});

describe('Xiahou Dun — Unyielding', () => {
  const judged = (suit: 'spade' | 'heart', bHand: ReturnType<typeof card>[]) =>
    use(shaHits({ drawPile: [card('j', 'sha', suit, 9)], 'seat-b:hand': bHand }, { generals: at('seat-a', 'xiahou-dun') }));
  const twoCards = [card('x1', 'shan'), card('x2', 'peach', 'heart')];

  it('on a judgment that is not a heart, the damaging seat discards 2 hand cards or takes 1 damage', () => {
    const s = judged('spade', twoCards);
    expect(s.pendingChoice).toMatchObject({ seatId: 'seat-b', verb: 'pick' });
    expect(s.pendingChoice!.options.map((o) => o.shows)).toEqual([{ kind: 'label', text: 'Discard 2 Hand Cards' }, { kind: 'label', text: 'Take 1 Damage' }]);
    const hurt = choose(s, 'damage');
    expect(hp(hurt, 'seat-b')).toBe(3);
    expect(hurt.log.filter((e) => e.kind === 'DamageDealtEvent').at(-1)).toMatchObject({ damage: { source: seat('seat-a'), cause: { skillId: 'unyielding' } } });
    const discarding = choose(s, 'discard');
    expect(discarding.pendingSelection).toMatchObject({ seatId: 'seat-b', min: 2, max: 2 });
    expect(discarding.pendingSelection!.onCancel).toBeUndefined();
    const discarded = select(discarding, 'x1', 'x2');
    expect(handIds(discarded, 'seat-b')).toEqual([]);
    expect(hp(discarded, 'seat-b')).toBe(4);
  });

  it('a heart does nothing; with fewer than 2 hand cards the seat must take the damage', () => {
    const heart = judged('heart', twoCards);
    expect(heart.pendingChoice).toBeUndefined();
    expect(hp(heart, 'seat-b')).toBe(4);
    const short = judged('spade', [card('x1', 'shan')]);
    expect(short.pendingChoice).toBeUndefined();
    expect(hp(short, 'seat-b')).toBe(3);
  });

  it('the judged card ends in the discard pile', () => {
    expect(ids(choose(judged('spade', twoCards), 'damage'), 'discardPile')).toContain('j');
  });
});

describe('Guo Jia — Bestowed Rouse', () => {
  const draws = Array.from({ length: 4 }, (_, i) => card(`d${i + 1}`, 'shan', 'heart', i + 1));
  const hit = (amount: number) => run(table({ drawPile: draws }, { generals: at('seat-a', 'guo-jia') }), [damage(amount)]);

  it('asks once per point of damage; each Use draws 2, which he may give away in any split', () => {
    let s = hit(2);
    expect(askedAbout(s)).toBe('bestowed-rouse');
    s = use(s);
    expect(handIds(s, 'seat-a')).toEqual(['d1', 'd2']);
    expect(s.pendingSelection).toMatchObject({ seatId: 'seat-a', eligibleIds: ['d1', 'd2'], min: 1, max: 2, then: { kind: 'give' } });
    s = choose(select(s, 'd1'), 'seat-c');
    expect(handIds(s, 'seat-c')).toEqual(['d1']);
    expect(s.pendingSelection?.eligibleIds).toEqual(['d2']);
    s = cancel(s); // keep the rest
    expect(askedAbout(s)).toBe('bestowed-rouse'); // the second point of damage
    s = decline(s);
    expect(handIds(s, 'seat-a')).toEqual(['d2']);
    expect(s.pendingChoice).toBeUndefined();
  });

  it('giving both drawn cards ends the giving', () => {
    const s = choose(select(use(hit(1)), 'd1', 'd2'), 'seat-b');
    expect(handIds(s, 'seat-b')).toEqual(['d1', 'd2']);
    expect(s.pendingSelection).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx jest projects/content/src/lib/generals/wei.spec.ts`
Expected: FAIL — no ask is ever pending (`WEI_GENERALS` is empty).

- [ ] **Step 3: Write the skills**

Replace `projects/content/src/lib/generals/wei.ts` with:

```ts
import type { CardInstance, DamageDealtEvent, Effect, GameState, SkillDefinition } from 'engine';
import { requireZoneOfKind } from 'engine';
import type { GeneralSkillSet } from './types';
import { seatCardOptions } from '../shared/choices';
import { handOf } from '../shared/queries';
import { ask, choiceOf, handZoneId, isLiving, lastDrawnBy, on, otherLivingSeatIds, reasonOf, selectionOf, skillDamage, skillStep } from '../shared/skills';

// The Wei base Generals' skills (General Skills spec, "Wei"). Every skill acts
// for the `owner` the engine passes in: the same General can sit at two seats
// in tests, so a skill must never find "its" seat by searching for its id.

const damagedSeatId = (event: DamageDealtEvent) => (event.damage.target.kind === 'seat' ? event.damage.target.seatId : null);

// The living seat other than `ownerSeatId` that dealt the damage, if any.
function otherSource(state: GameState, event: DamageDealtEvent, ownerSeatId: string): string | null {
  const source = event.damage.source;
  return source?.kind === 'seat' && source.seatId !== ownerSeatId && isLiving(state, source.seatId) ? source.seatId : null;
}

// The physical cards behind the damage that still lie in the discard pile or processing.
function takeableCards(state: GameState, event: DamageDealtEvent): CardInstance[] {
  const open = state.zones.filter((z) => z.kind === 'discardPile' || z.kind === 'processing');
  return (event.damage.cause?.card?.physical ?? []).filter((c) => open.some((z) => z.cards.some((x) => x.instanceId === c.instanceId)));
}

// Evil Hero (may): after you take damage caused by a card, you may take that
// card into your hand (both cards of a Serpent Spear Sha). Nothing happens if
// it has already left the discard pile and processing.
export const evilHero: SkillDefinition = {
  id: 'evil-hero',
  triggers: [
    on<DamageDealtEvent>('after:DamageDealtEvent', {
      condition: (state, event, owner) => damagedSeatId(event) === owner.seatId && takeableCards(state, event).length > 0,
      effect: (state, event, owner) => {
        const hand = handZoneId(state, owner.seatId);
        const from = [requireZoneOfKind(state.zones, 'discardPile').id, requireZoneOfKind(state.zones, 'processing').id];
        // Each card from wherever it lies when Use is picked; a move from the other zone does nothing.
        const takes: Effect[] = takeableCards(state, event).flatMap((c) =>
          from.map((zoneId): Effect => ({ kind: 'MoveCardEffect', cardInstanceId: c.instanceId, toZoneId: hand, onlyFrom: zoneId }))
        );
        return [ask(owner, takes)];
      },
    }),
  ],
};

// Escort: a Lord skill, inactive in Guozhan.
export const escort: SkillDefinition = { id: 'escort', lord: true };

// Feedback (may): after a seat damages you, you may take 1 of its cards: its
// hand as one face-down option, or a worn card. Nothing if it holds none.
export const feedback: SkillDefinition = {
  id: 'feedback',
  triggers: [
    on<DamageDealtEvent>('after:DamageDealtEvent', {
      condition: (state, event, owner) => {
        const from = otherSource(state, event, owner.seatId);
        return damagedSeatId(event) === owner.seatId && !!from && seatCardOptions(state, from, '', { judgment: false }).length > 0;
      },
      effect: (state, event, owner) => {
        const from = otherSource(state, event, owner.seatId)!;
        return [ask(owner, [skillStep(owner, 'take', { from })], [], from)];
      },
    }),
  ],
  // Which card to take, offered as Use is picked.
  onStep: (state, step) => {
    const from = step.data?.['from'] as string;
    const options = isLiving(state, from) ? seatCardOptions(state, from, handZoneId(state, step.owner.seatId), { judgment: false }) : [];
    return options.length > 0 ? [choiceOf(state, step.owner, { verb: 'take', options, targetSeatId: from })] : [];
  },
};

// Unyielding (may): after another seat damages you, you may judge. If the card
// isn't a heart, that seat discards 2 hand cards or takes 1 damage from you;
// with fewer than 2 hand cards it must take the damage.
export const unyielding: SkillDefinition = {
  id: 'unyielding',
  triggers: [
    on<DamageDealtEvent>('after:DamageDealtEvent', {
      condition: (state, event, owner) => damagedSeatId(event) === owner.seatId && !!otherSource(state, event, owner.seatId),
      effect: (state, event, owner) => {
        const sourceSeatId = otherSource(state, event, owner.seatId)!;
        return [ask(owner, [{ kind: 'JudgeEffect', seatId: owner.seatId, reader: { kind: 'skill', owner }, data: { sourceSeatId } }], [], sourceSeatId)];
      },
    }),
  ],
  // The judged card goes to the discard pile first; then the outcome.
  onJudged: (state, { owner, judged, data, done }) => {
    const sourceSeatId = data?.['sourceSeatId'] as string;
    if (judged.suit === 'heart' || !isLiving(state, sourceSeatId)) return [done];
    return [done, skillStep(owner, 'outcome', { sourceSeatId })];
  },
  onStep: (state, step) => {
    const { owner } = step;
    const sourceSeatId = step.data?.['sourceSeatId'] as string;
    if (!isLiving(state, sourceSeatId)) return [];
    const damage = skillDamage(owner, sourceSeatId);
    const hand = handOf(state, sourceSeatId);
    if (hand.length < 2) return [damage];
    const discard = selectionOf(state, owner, {
      seatId: sourceSeatId, targetSeatId: sourceSeatId, of: 'cards', eligibleIds: hand.map((c) => c.instanceId), min: 2, max: 2, then: { kind: 'discard' },
    });
    return [
      choiceOf(state, owner, {
        seatId: sourceSeatId,
        targetSeatId: sourceSeatId,
        verb: 'pick',
        options: [
          { id: 'discard', shows: { kind: 'label', text: 'Discard 2 Hand Cards' }, effects: [discard] },
          { id: 'damage', shows: { kind: 'label', text: 'Take 1 Damage' }, effects: [damage] },
        ],
      }),
    ];
  },
};

// Bestowed Rouse (may): for each 1 damage you take, you may draw 2 cards, then
// give any of those 2 to other living seats, in any split (Cancel keeps the rest).
export const bestowedRouse: SkillDefinition = {
  id: 'bestowed-rouse',
  triggers: [
    on<DamageDealtEvent>('after:DamageDealtEvent', {
      condition: (_state, event, owner) => damagedSeatId(event) === owner.seatId && event.damage.amount > 0,
      effect: (_state, event, owner) =>
        Array.from({ length: event.damage.amount }, () => ask(owner, [{ kind: 'DrawCardsEffect', seatId: owner.seatId, count: 2 }, skillStep(owner, 'drawn')])),
    }),
  ],
  // 'drawn': just after the draw; 'give': after each gift. Offers whichever of
  // the drawn cards are still in hand.
  onStep: (state, step) => {
    const { owner } = step;
    if (!isLiving(state, owner.seatId)) return [];
    const cards = step.step === 'drawn' ? lastDrawnBy(state, owner.seatId) : (step.data?.['cards'] as string[]);
    const inHand = new Set(handOf(state, owner.seatId).map((c) => c.instanceId));
    const left = cards.filter((id) => inHand.has(id));
    const others = otherLivingSeatIds(state, owner.seatId);
    if (left.length === 0 || others.length === 0) return [];
    return [
      selectionOf(state, owner, {
        of: 'cards', eligibleIds: left, min: 1, max: left.length,
        then: { kind: 'give', toSeatIds: others, then: [skillStep(owner, 'give', { cards })] },
        onCancel: [],
      }),
    ];
  },
};

export const WEI_GENERALS: GeneralSkillSet[] = [
  { id: 'cao-cao', skills: [evilHero, escort] },
  { id: 'sima-yi', skills: [feedback] },
  { id: 'xiahou-dun', skills: [unyielding] },
  { id: 'guo-jia', skills: [bestowedRouse] },
];
```

`reasonOf` is imported for Task 6 (Devil); if the linter flags it unused now, drop it from the import and add it back in Task 6.

- [ ] **Step 4: Run the tests**

Run: `npx jest projects/content/src/lib/generals/wei.spec.ts`
Expected: PASS.

- [ ] **Step 5: Run the whole suite and commit**

Run: `npx jest`
Expected: PASS. (A spec that seats Cao Cao, Sima Yi, Xiahou Dun or Guo Jia and deals them damage now gets an ask: swap in the Task 1 filler.)

```bash
git add projects/content
git commit -m "feat(content): Evil Hero, Feedback, Unyielding and Bestowed Rouse

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 6: Wei — Heaven's Envy, Devil, River Goddess, Overturned Country

Rule text: General Skills spec, "Wei". The judgment steps are stage 6's: `JudgeEffect` → `JudgmentShownEffect` (changers' moment; `acted` holds the seats that had their say, `changedBy` the last to replace the card) → `JudgmentResolveEffect` → `JudgmentDoneEffect` (`acted` holds ability keys).

**Files:**
- Create: `projects/content/src/lib/shared/judgments.ts`, `projects/content/src/lib/generals/wei-judgments.spec.ts`
- Modify: `projects/content/src/lib/generals/wei.ts`

**Interfaces:**
- Consumes: Task 5's `wei.ts`; `abilityKey` (Task 4).
- Produces:
  - `JUDGMENT_CHANGERS: ReadonlySet<string>`, `changerOrder(state, shown): string[]`, `nextToChange(state, shown, owner, registry): boolean` (`shared/judgments.ts`).
  - `WEI_GENERALS`: `sima-yi` = `[feedback, devil]`, `guo-jia` = `[heavensEnvy, bestowedRouse]`, `zhen-ji` = `[overturnedCountry, riverGoddess]`.

- [ ] **Step 1: Write the failing tests**

Create `projects/content/src/lib/generals/wei-judgments.spec.ts`:

```ts
import type { GameState } from 'engine';
import { usedCardOf } from 'engine';
import { askedAbout, card, handIds, harness, hp, ids, kwMode, seat, table, TableOptions } from './skills.testing';

const stub = harness();
const kw = harness(kwMode);
const filler = (n: number) => Array.from({ length: n }, (_, i) => card(`f${i}`, 'shan', 'diamond', 1));
// seat-a's turn from its Start Phase, under Guozhan's own triggers.
const judging = (cards: Record<string, ReturnType<typeof card>[]>, o: TableOptions) => kw.settle(table(cards, { phase: 'Start', ...o }));

describe("Guo Jia — Heaven's Envy", () => {
  const guoJia: TableOptions['generals'] = { 'seat-a': ['guo-jia', 'cao-pi'] };

  it('after a judgment of his takes effect, may take the judged card instead of discarding it', () => {
    const s = judging({ 'seat-a:judgment': [card('cp', 'capture', 'spade', 6)], drawPile: [card('j', 'sha', 'heart', 4), ...filler(4)] }, { generals: guoJia });
    expect(askedAbout(s)).toBe('heavens-envy');
    const taken = kw.use(s);
    expect(handIds(taken, 'seat-a')).toContain('j');
    expect(ids(taken, 'discardPile')).not.toContain('j');
    expect(ids(kw.decline(s), 'discardPile')).toContain('j');
  });

  it("is asked after Lightning's damage", () => {
    const s = judging({ 'seat-a:judgment': [card('li', 'lightning', 'spade', 1)], drawPile: [card('j', 'sha', 'spade', 5), ...filler(4)] }, { generals: guoJia });
    expect(hp(s, 'seat-a')).toBe(1);
    expect(askedAbout(s)).toBe('heavens-envy');
    expect(handIds(kw.use(s), 'seat-a')).toContain('j');
  });

  it("works on an Eight Trigrams judgment, before the Shan it counts as", () => {
    let s = stub.play(table({ 'seat-a:hand': [card('s1', 'sha')], 'seat-b:equip': [card('et', 'eight-trigrams', 'spade', 2)], drawPile: [card('j', 'peach', 'heart', 3)] }, { generals: { 'seat-b': ['guo-jia', 'cao-pi'] } }), 's1', 'seat-b');
    s = stub.use(s); // Eight Trigrams
    expect(askedAbout(s)).toBe('heavens-envy');
    s = stub.use(s);
    expect(handIds(s, 'seat-b')).toEqual(['j']);
    expect(hp(s, 'seat-b')).toBe(4); // the red judgment still counted as a Shan
  });
});

describe('Sima Yi — Devil', () => {
  const capture = card('cp', 'capture', 'spade', 6);
  // seat-c is judged for a Capture; Devil holders at the seats given.
  const judged = (devils: string[], hands: Record<string, ReturnType<typeof card>[]>) => {
    const generals = Object.fromEntries(devils.map((id) => [id, ['sima-yi', 'xun-yu'] as [string, string]]));
    const cards = Object.fromEntries(Object.entries(hands).map(([id, cs]) => [`${id}:hand`, cs]));
    return stub.run(table({ ...cards, drawPile: [card('j', 'sha', 'club', 9)] }, { generals }), [
      { kind: 'JudgeEffect', seatId: 'seat-c', reader: { kind: 'card', card: usedCardOf(capture) } },
    ]);
  };

  it('may replace the judgment card with a hand card; the old one is discarded and the new one is read', () => {
    let s = judged(['seat-b'], { 'seat-b': [card('h1', 'peach', 'heart', 2)] });
    expect(askedAbout(s)).toBe('devil');
    expect(s.pendingChoice?.reason).toMatchObject({ targetSeatId: 'seat-c' });
    s = stub.select(stub.use(s), 'h1');
    expect(s.log.find((e) => e.kind === 'JudgmentChangedEvent')).toMatchObject({ judgedSeatId: 'seat-c', card: { instanceId: 'h1' }, replaced: { instanceId: 'j' } });
    expect(ids(s, 'discardPile')).toEqual(['j', 'h1']); // the old card, then the judged one once read
    expect(s.turn.flags).toBeUndefined(); // a heart spares the Capture
    expect(ids(s, 'processing')).toEqual([]);
  });

  it("Don't, or Cancel at the pick, lets the card stand", () => {
    expect(stub.decline(judged(['seat-b'], { 'seat-b': [card('h1', 'peach', 'heart')] })).turn.flags).toEqual({ skipPlay: true });
    expect(stub.cancel(stub.use(judged(['seat-b'], { 'seat-b': [card('h1', 'peach', 'heart')] }))).turn.flags).toEqual({ skipPlay: true });
  });

  it('is not asked without a hand card', () => {
    expect(judged(['seat-b'], {}).pendingChoice).toBeUndefined();
  });

  it('asks in seat order from the judged seat; after a replacement, from the seat after the one that replaced it', () => {
    const hands = { 'seat-b': [card('hb', 'peach', 'heart')], 'seat-d': [card('hd', 'shan', 'diamond')] };
    const s = judged(['seat-b', 'seat-d'], hands);
    expect(s.pendingChoice?.seatId).toBe('seat-d'); // c is judged: d comes before b
    expect(stub.decline(s).pendingChoice?.seatId).toBe('seat-b');
    const replaced = stub.select(stub.use(s), 'hd');
    expect(replaced.pendingChoice?.seatId).toBe('seat-b'); // after d: a (no Devil), then b
    const both = stub.select(stub.use(replaced), 'hb');
    expect(both.log.filter((e) => e.kind === 'JudgmentChangedEvent')).toHaveLength(2);
    expect(both.pendingChoice).toBeUndefined(); // d has no hand card left
  });
});

describe('Zhen Ji — River Goddess', () => {
  // seat-d's turn ends; seat-a's starts.
  const startOfTurn = (drawPile: ReturnType<typeof card>[]) => stub.settle(table({ drawPile }, { generals: { 'seat-a': ['zhen-ji', 'xun-yu'] }, owner: 'seat-d', phase: 'End' }));

  it('judges again and again: each black card to her hand, the first red one discarded', () => {
    let s = startOfTurn([card('b1', 'sha', 'spade'), card('b2', 'shan', 'club'), card('r1', 'peach', 'heart'), card('x', 'sha')]);
    expect(askedAbout(s)).toBe('river-goddess');
    s = stub.use(s);
    expect(askedAbout(s)).toBe('river-goddess');
    s = stub.use(s);
    s = stub.use(s);
    expect(handIds(s, 'seat-a')).toEqual(['b1', 'b2']);
    expect(ids(s, 'discardPile')).toEqual(['r1']);
    expect(s.pendingChoice).toBeUndefined();
  });

  it("Don't ends it", () => {
    let s = stub.use(startOfTurn([card('b1', 'sha', 'spade'), card('b2', 'shan', 'club')]));
    s = stub.decline(s);
    expect(handIds(s, 'seat-a')).toEqual(['b1']);
    expect(s.pendingChoice).toBeUndefined();
  });
});

describe('Zhen Ji — Overturned Country', () => {
  it('uses a black hand card as a Shan', () => {
    let s = stub.play(table({ 'seat-b:hand': [card('s1', 'sha')], 'seat-a:hand': [card('k', 'wuxie', 'club', 4), card('r', 'peach', 'heart')] }, { owner: 'seat-b', generals: { 'seat-a': ['zhen-ji', 'xun-yu'] } }), 's1', 'seat-a');
    s = stub.convert(s, 'seat-a', 'overturned-country');
    expect(s.pendingSelection?.eligibleIds).toEqual(['k']);
    s = stub.select(s, 'k');
    expect(hp(s, 'seat-a')).toBe(4);
    expect(s.log.find((e) => e.kind === 'CardPlayedEvent' && e.seatId === 'seat-a')).toMatchObject({ card: { as: 'shan', physical: [{ instanceId: 'k' }], via: { abilityId: 'overturned-country' } } });
  });

  it('is not offered in her own Play Phase', () => {
    const s = table({ 'seat-a:hand': [card('k', 'wuxie', 'club')] }, { generals: { 'seat-a': ['zhen-ji', 'xun-yu'] } });
    expect(stub.legal(s, 'seat-a').some((a) => a.kind === 'UseConversionAction')).toBe(false);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx jest projects/content/src/lib/generals/wei-judgments.spec.ts`
Expected: FAIL — no Heaven's Envy, Devil or River Goddess ask; no Overturned Country conversion.

- [ ] **Step 3: The changers' order**

Create `projects/content/src/lib/shared/judgments.ts`:

```ts
import type { ContentRegistry, Effect, GameState, GeneralOwner } from 'engine';
import { livingSeatOrderFrom, skillsInPlay } from 'engine';
import { handOf } from './queries';

type Shown = Extract<Effect, { kind: 'JudgmentShownEffect' }>;

// The skills that may replace a judgment's card (Devil; Wind's Dark Magic
// later). Each holder is asked in seat order, one at a time (nextToChange).
export const JUDGMENT_CHANGERS: ReadonlySet<string> = new Set(['devil']);

// The seats asked about changing `shown`'s card, in order: from the judged
// seat; after a replacement, from the seat after the one that replaced it,
// which comes last.
export function changerOrder(state: GameState, shown: Shown): string[] {
  const start = shown.changedBy ?? shown.judgment.seatId;
  const order = livingSeatOrderFrom(state, start);
  return shown.changedBy && order[0] === start ? [...order.slice(1), start] : order;
}

// Whether `seatId` still has a say on `shown`: it holds a changer in play and
// a hand card to change with, and hasn't had its say.
function maySay(state: GameState, shown: Shown, seatId: string, registry: ContentRegistry): boolean {
  return (
    !(shown.acted ?? []).includes(seatId) &&
    handOf(state, seatId).length > 0 &&
    skillsInPlay(state, seatId, registry).some((s) => JUDGMENT_CHANGERS.has(s.skill.id))
  );
}

// Whether `owner`'s seat is the next to say whether it changes the judgment.
export function nextToChange(state: GameState, shown: Shown, owner: GeneralOwner, registry: ContentRegistry): boolean {
  return changerOrder(state, shown).find((seatId) => maySay(state, shown, seatId, registry)) === owner.seatId;
}
```

- [ ] **Step 4: The skills**

In `projects/content/src/lib/generals/wei.ts` add the imports `colourOf` (from `engine`), `abilityKey` (from `../shared/steps`), `nextToChange` (from `../shared/judgments`), and `PhaseChangedEvent` (type, from `engine`). Add before `WEI_GENERALS`:

```ts
type Shown = Extract<Effect, { kind: 'JudgmentShownEffect' }>;
type Done = Extract<Effect, { kind: 'JudgmentDoneEffect' }>;

const inProcessing = (state: GameState, cardInstanceId: string) => requireZoneOfKind(state.zones, 'processing').cards.some((c) => c.instanceId === cardInstanceId);

// Heaven's Envy (may): after a judgment of yours takes effect (Lightning has
// struck), you may take the judged card into your hand instead of discarding it.
export const heavensEnvy: SkillDefinition = {
  id: 'heavens-envy',
  triggers: [
    on<Done>('before:JudgmentDoneEffect', {
      condition: (state, done, owner) =>
        done.judgment.seatId === owner.seatId && !(done.acted ?? []).includes(abilityKey(owner)) && inProcessing(state, done.judgment.card.instanceId),
      effect: (state, done, owner) => {
        const passed: Done = { ...done, acted: [...(done.acted ?? []), abilityKey(owner)] };
        const take: Effect = { kind: 'MoveCardEffect', cardInstanceId: done.judgment.card.instanceId, toZoneId: handZoneId(state, owner.seatId) };
        return [ask(owner, [take, passed], [passed])];
      },
    }),
  ],
};

// Devil (may): when any seat's judgment card is turned up, before it takes
// effect, you may play a hand card to replace it; the old card is discarded.
// Asked in seat order from the judged seat; after a replacement, again from
// the seat after the one that replaced it (shared/judgments.ts).
export const devil: SkillDefinition = {
  id: 'devil',
  triggers: [
    on<Shown>('before:JudgmentShownEffect', {
      condition: (state, shown, owner, registry) => nextToChange(state, shown, owner, registry),
      effect: (state, shown, owner) => {
        const passed: Shown = { ...shown, acted: [...(shown.acted ?? []), owner.seatId] };
        const pick = selectionOf(state, owner, {
          of: 'cards', eligibleIds: handOf(state, owner.seatId).map((c) => c.instanceId), min: 1, max: 1,
          then: { kind: 'replace-judgment', judgment: shown.judgment, owner, abilityId: owner.skillId },
          onCancel: [passed], targetSeatId: shown.judgment.seatId,
        });
        return [ask(owner, [pick], [passed], shown.judgment.seatId)];
      },
    }),
  ],
};

// Overturned Country (conversion, respond): any black hand card as a Shan.
export const overturnedCountry: SkillDefinition = {
  id: 'overturned-country',
  conversions: [{ id: 'overturned-country', as: 'shan', cards: 1, accepts: (c) => colourOf(c) === 'black', when: 'respond' }],
};

// The ask that starts one River Goddess judgment.
const riverGoddessAsk = (owner: Parameters<typeof ask>[0]): Effect => ask(owner, [{ kind: 'JudgeEffect', seatId: owner.seatId, reader: { kind: 'skill', owner } }]);

// River Goddess (may): in your Start Phase you may judge again and again: each
// black card goes into your hand and you may judge again; the first red card
// is discarded, and that ends it.
export const riverGoddess: SkillDefinition = {
  id: 'river-goddess',
  triggers: [
    on<PhaseChangedEvent>('after:PhaseChangedEvent', {
      condition: (_state, event, owner) => event.phase === 'Start' && event.seatId === owner.seatId,
      effect: (_state, _event, owner) => [riverGoddessAsk(owner)],
    }),
  ],
  onJudged: (state, { owner, judged, done }) => {
    if (colourOf(judged) === 'red' || !isLiving(state, owner.seatId)) return [done];
    const keep: Effect = { kind: 'MoveCardEffect', cardInstanceId: judged.instanceId, toZoneId: handZoneId(state, owner.seatId), onlyFrom: requireZoneOfKind(state.zones, 'processing').id };
    return [keep, done, riverGoddessAsk(owner)];
  },
};
```

and change `WEI_GENERALS` to:

```ts
export const WEI_GENERALS: GeneralSkillSet[] = [
  { id: 'cao-cao', skills: [evilHero, escort] },
  { id: 'sima-yi', skills: [feedback, devil] },
  { id: 'xiahou-dun', skills: [unyielding] },
  { id: 'guo-jia', skills: [heavensEnvy, bestowedRouse] },
  { id: 'zhen-ji', skills: [overturnedCountry, riverGoddess] },
];
```

- [ ] **Step 5: Run the tests**

Run: `npx jest projects/content/src/lib/generals`
Expected: PASS.

- [ ] **Step 6: Run the whole suite and commit**

Run: `npx jest`
Expected: PASS.

```bash
git add projects/content
git commit -m "feat(content): Heaven's Envy, Devil, River Goddess and Overturned Country

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 7: The Draw Phase — Bare the Chest, Raid, Brave Gesture

Rule text: General Skills spec, Xu Chu, Zhang Liao (Wei) and Zhou Yu's Brave Gesture (Wu). All three are `before:DrawPhaseEffect` asks built with `atDrawPhase` (Task 4): each asks once per draw (`acted`), Main General first; Don't lets the draw go ahead to the next skill.

**Files:**
- Modify: `projects/content/src/lib/generals/wei.ts`, `projects/content/src/lib/generals/wu.ts`
- Create: `projects/content/src/lib/generals/draw-phase.spec.ts`

**Interfaces:**
- Consumes: `atDrawPhase`, `used`, `selectionOf`, `skillStep` (Task 4).
- Produces:
  - `BARE_THE_CHEST_FLAG = 'bare-the-chest'` (turn flag) exported from `wei.ts`.
  - `WEI_GENERALS` gains `xu-chu` (`bareTheChest`) and `zhang-liao` (`raid`); `WU_GENERALS` gains `zhou-yu` (`braveGesture`; Task 11 adds `sowRevolt`).
  - Outcomes logged: `more-damage` (Bare the Chest, `targetSeatId` = the damaged seat), `took-hand-card` (Raid, `targetSeatId` = the seat taken from).

- [ ] **Step 1: Write the failing tests**

Create `projects/content/src/lib/generals/draw-phase.spec.ts`:

```ts
import { abilityLog, askedAbout, card, handIds, harness, hp, kwMode, table, TableOptions } from './skills.testing';

const kw = harness(kwMode);
const pile = Array.from({ length: 6 }, (_, i) => card(`d${i + 1}`, 'shan', 'diamond', i + 1));
// seat-a's Judgment Phase ends; its Draw Phase draw comes next.
const drawPhase = (generals: [string, string], cards: Record<string, ReturnType<typeof card>[]> = {}, o: TableOptions = {}) =>
  kw.settle(table({ drawPile: pile, ...cards }, { phase: 'Judgment', generals: { 'seat-a': generals }, ...o }));

describe('Xu Chu — Bare the Chest', () => {
  it('draws 1 fewer; his Sha and Duel then deal 1 more damage this turn', () => {
    let s = drawPhase(['xu-chu', 'xiahou-yuan'], { 'seat-a:hand': [card('s1', 'sha'), card('du', 'duel', 'spade', 1)] });
    expect(askedAbout(s)).toBe('bare-the-chest');
    s = kw.use(s);
    expect(handIds(s, 'seat-a')).toEqual(['s1', 'du', 'd1']);
    expect(s.turn.flags).toEqual({ 'bare-the-chest': true });
    const hit = kw.pass(kw.play(s, 's1', 'seat-b'));
    expect(hp(hit, 'seat-b')).toBe(2);
    expect(abilityLog(hit).at(-1)).toMatchObject({ abilityId: 'bare-the-chest', outcome: 'more-damage', targetSeatId: 'seat-b' });
    expect(hp(kw.pass(kw.play(s, 'du', 'seat-c')), 'seat-c')).toBe(2);
  });

  it("Don't draws the usual 2, and nothing is boosted", () => {
    const s = kw.decline(drawPhase(['xu-chu', 'xiahou-yuan'], { 'seat-a:hand': [card('s1', 'sha')] }));
    expect(handIds(s, 'seat-a')).toEqual(['s1', 'd1', 'd2']);
    expect(hp(kw.pass(kw.play(s, 's1', 'seat-b')), 'seat-b')).toBe(3);
  });

  it('boosts only his own damage', () => {
    let s = kw.use(drawPhase(['xu-chu', 'xiahou-yuan']));
    s = kw.run(s, [{ kind: 'DamageEffect', damage: { source: { kind: 'seat', seatId: 'seat-b' }, target: { kind: 'seat', seatId: 'seat-c' }, amount: 1, nature: 'normal', cause: { card: { as: 'sha', colour: 'black', physical: [] } } } }]);
    expect(hp(s, 'seat-c')).toBe(3);
  });
});

describe('Zhang Liao — Raid', () => {
  const hands = { 'seat-b:hand': [card('b1', 'sha')], 'seat-d:hand': [card('x1', 'peach', 'heart'), card('x2', 'shan')] };

  it('instead of drawing, takes a random hand card from each of 1 or 2 other seats, in seat order', () => {
    let s = kw.use(drawPhase(['zhang-liao', 'xiahou-yuan'], hands));
    expect(s.pendingSelection).toMatchObject({ of: 'seats', eligibleIds: ['seat-b', 'seat-d'], min: 1, max: 2 });
    s = kw.select(s, 'seat-d', 'seat-b');
    expect(handIds(s, 'seat-a')).toHaveLength(2);
    expect(handIds(s, 'seat-a')[0]).toBe('b1');
    expect(handIds(s, 'seat-b')).toEqual([]);
    expect(handIds(s, 'seat-d')).toHaveLength(1);
    expect(abilityLog(s).map((e) => e.targetSeatId)).toEqual(['seat-b', 'seat-d']);
  });

  it('Cancel at the pick goes back to the draw', () => {
    const s = kw.cancel(kw.use(drawPhase(['zhang-liao', 'xiahou-yuan'], hands)));
    expect(handIds(s, 'seat-a')).toEqual(['d1', 'd2']);
  });

  it('is not asked when no other seat holds a hand card', () => {
    expect(drawPhase(['zhang-liao', 'xiahou-yuan']).pendingChoice).toBeUndefined();
  });

  it('with Bare the Chest on the Deputy: Raid is asked first, then Bare the Chest', () => {
    let s = drawPhase(['zhang-liao', 'xu-chu'], hands);
    expect(askedAbout(s)).toBe('raid');
    s = kw.decline(s);
    expect(askedAbout(s)).toBe('bare-the-chest');
    expect(handIds(kw.use(s), 'seat-a')).toEqual(['d1']);
  });
});

describe('Zhou Yu — Brave Gesture', () => {
  it('draws 1 extra card', () => {
    const s = drawPhase(['zhou-yu', 'sun-jian']);
    expect(askedAbout(s)).toBe('brave-gesture');
    expect(handIds(kw.use(s), 'seat-a')).toEqual(['d1', 'd2', 'd3']);
    expect(handIds(kw.decline(s), 'seat-a')).toEqual(['d1', 'd2']);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx jest projects/content/src/lib/generals/draw-phase.spec.ts`
Expected: FAIL — no ask at the draw.

- [ ] **Step 3: Xu Chu and Zhang Liao**

In `projects/content/src/lib/generals/wei.ts` add `atDrawPhase`, `used` to the `../shared/skills` import and `livingSeatOrderFrom` to the `engine` import; add before `WEI_GENERALS`:

```ts
// The turn flag Bare the Chest sets: this turn, its owner's Sha and Duel deal 1 more.
export const BARE_THE_CHEST_FLAG = 'bare-the-chest';

type DamageStep = Extract<Effect, { kind: 'DamageEffect' }>;

// Bare the Chest (may): in your Draw Phase you may draw 1 fewer card. If you
// do, damage from your Sha and Duel this turn is 1 greater.
export const bareTheChest: SkillDefinition = {
  id: 'bare-the-chest',
  triggers: [
    atDrawPhase({
      condition: (_state, draw) => draw.count > 0,
      use: (_state, passed) => [{ ...passed, count: passed.count - 1 }, { kind: 'SetTurnFlagEffect', flag: BARE_THE_CHEST_FLAG }],
    }),
    on<DamageStep>('before:DamageEffect', {
      condition: (state, { damage }, owner) =>
        !!state.turn.flags?.[BARE_THE_CHEST_FLAG] &&
        state.turn.ownerSeatId === owner.seatId &&
        damage.source?.kind === 'seat' &&
        damage.source.seatId === owner.seatId &&
        ['sha', 'duel'].includes(damage.cause?.card?.as ?? ''),
      effect: (_state, step, owner) => [{ ...step, damage: { ...step.damage, amount: step.damage.amount + 1 } }, used(owner, 'more-damage', step.damage.target.seatId)],
    }),
  ],
};

// The other living seats holding a hand card, in turn order.
const raidable = (state: GameState, seatId: string) => otherLivingSeatIds(state, seatId).filter((id) => handOf(state, id).length > 0);

// Raid (may): in your Draw Phase, instead of drawing, you may choose 1 or 2
// other seats that hold hand cards and take 1 random hand card from each, in
// seat order. Cancel at the pick goes back to the draw.
export const raid: SkillDefinition = {
  id: 'raid',
  triggers: [
    atDrawPhase({
      condition: (state, _draw, owner) => raidable(state, owner.seatId).length > 0,
      use: (state, passed, owner) => [
        selectionOf(state, owner, { of: 'seats', eligibleIds: raidable(state, owner.seatId), min: 1, max: 2, then: { kind: 'skill-step', step: skillStep(owner, 'take') }, onCancel: [passed] }),
      ],
    }),
  ],
  onStep: (state, step) => {
    const { owner } = step;
    const order = livingSeatOrderFrom(state, owner.seatId);
    const picked = [...((step.data?.['picked'] as string[]) ?? [])].sort((a, b) => order.indexOf(a) - order.indexOf(b));
    return picked.flatMap((seatId): Effect[] => [
      { kind: 'MoveRandomCardEffect', fromZoneId: handZoneId(state, seatId), toZoneId: handZoneId(state, owner.seatId) },
      used(owner, 'took-hand-card', seatId),
    ]);
  },
};
```

and `WEI_GENERALS` gains `{ id: 'xu-chu', skills: [bareTheChest] }` and `{ id: 'zhang-liao', skills: [raid] }`.

- [ ] **Step 4: Zhou Yu**

Replace `projects/content/src/lib/generals/wu.ts` with:

```ts
import type { SkillDefinition } from 'engine';
import type { GeneralSkillSet } from './types';
import { atDrawPhase } from '../shared/skills';

// The Wu base Generals' skills (General Skills spec, "Wu"). Every skill acts
// for the `owner` the engine passes in, never by searching for its General.

// Brave Gesture (may): in your Draw Phase you may draw 1 extra card.
export const braveGesture: SkillDefinition = {
  id: 'brave-gesture',
  triggers: [atDrawPhase({ use: (_state, passed) => [{ ...passed, count: passed.count + 1 }] })],
};

export const WU_GENERALS: GeneralSkillSet[] = [{ id: 'zhou-yu', skills: [braveGesture] }];
```

- [ ] **Step 5: Run the tests**

Run: `npx jest projects/content/src/lib/generals`
Expected: PASS. If the Raid order assertion fails, check `select(s, 'seat-d', 'seat-b')` is sorted by seat order in `onStep` (b before d).

- [ ] **Step 6: Run the whole suite and commit**

Run: `npx jest`
Expected: PASS (fillers from Task 1 keep `guozhan.spec.ts`'s Draw Phase tests free of asks).

```bash
git add projects/content
git commit -m "feat(content): Bare the Chest, Raid and Brave Gesture on the Draw Phase step

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 8: Shu — Roar, Horsemanship, Empty City, Wondrous Talent, Fighting Saint, Dragon Courage

Rule text: General Skills spec, "Shu". Four are compulsory modifiers (off while hidden); two are conversions (offered while hidden, revealing on confirm).

**Files:**
- Modify: `projects/content/src/lib/generals/shu.ts`
- Create: `projects/content/src/lib/generals/shu.spec.ts`

**Interfaces:**
- Consumes: the Task 4 modifiers; Task 3's one-card conversions.
- Produces: `SHU_GENERALS` entries `guan-yu` (`fightingSaint`), `zhang-fei` (`roar`), `zhao-yun` (`dragonCourage`: conversions `shan-as-sha`, `sha-as-shan`), `ma-chao` (`horsemanship`; Task 9 adds `ironCavalry`), `zhuge-liang` (`emptyCity`; Task 9 puts `astrology` first), `huang-yueying` (`wondrousTalent`; Task 9 puts `gatheringWisdom` first). Skill objects are exported constants.

- [ ] **Step 1: Write the failing tests**

Create `projects/content/src/lib/generals/shu.spec.ts`:

```ts
import type { GameState } from 'engine';
import { card, handIds, harness, hp, table, TableOptions } from './skills.testing';

const { legal, play, pass, respond, convert, select, cancel } = harness();
const at = (seatId: string, general: string, revealed = true): TableOptions['generals'] => ({ [seatId]: [general, 'wei-yan', revealed] });
const playTargets = (s: GameState, seatId: string, cardId: string) =>
  legal(s, seatId).flatMap((a) => (a.kind === 'PlayCardAction' && a.cardInstanceId === cardId ? [a.targets[0]?.seatId] : []));
const conversions = (s: GameState, seatId: string) => legal(s, seatId).filter((a) => a.kind === 'UseConversionAction');

describe('Zhang Fei — Roar', () => {
  it('no limit on Sha', () => {
    let s = table({ 'seat-a:hand': [card('s1', 'sha'), card('s2', 'sha'), card('s3', 'sha')] }, { generals: at('seat-a', 'zhang-fei') });
    s = pass(play(s, 's1', 'seat-b'));
    s = pass(play(s, 's2', 'seat-b'));
    expect(playTargets(s, 'seat-a', 's3')).toContain('seat-b');
  });

  it('is off while Zhang Fei is hidden', () => {
    const s = pass(play(table({ 'seat-a:hand': [card('s1', 'sha'), card('s2', 'sha')] }, { generals: at('seat-a', 'zhang-fei', false) }), 's1', 'seat-b'));
    expect(playTargets(s, 'seat-a', 's2')).toEqual([]);
  });
});

describe('Ma Chao — Horsemanship', () => {
  it('reaches a seat 2 away with an unarmed Sha', () => {
    const cards = { 'seat-a:hand': [card('s1', 'sha')] };
    expect(playTargets(table(cards, { generals: at('seat-a', 'ma-chao') }), 'seat-a', 's1')).toEqual(['seat-b', 'seat-c', 'seat-d']);
    expect(playTargets(table(cards, { generals: at('seat-a', 'ma-chao', false) }), 'seat-a', 's1')).toEqual(['seat-b', 'seat-d']);
  });
});

describe('Zhuge Liang — Empty City', () => {
  it('with no hand cards he can’t be targeted by Sha or Duel', () => {
    const attacker = { 'seat-a:hand': [card('s1', 'sha'), card('du', 'duel', 'spade', 1)] };
    const empty = table(attacker, { generals: at('seat-b', 'zhuge-liang') });
    expect(playTargets(empty, 'seat-a', 's1')).not.toContain('seat-b');
    expect(playTargets(empty, 'seat-a', 'du')).not.toContain('seat-b');
    const holding = table({ ...attacker, 'seat-b:hand': [card('x', 'peach', 'heart')] }, { generals: at('seat-b', 'zhuge-liang') });
    expect(playTargets(holding, 'seat-a', 's1')).toContain('seat-b');
    expect(playTargets(table(attacker, { generals: at('seat-b', 'zhuge-liang', false) }), 'seat-a', 's1')).toContain('seat-b');
  });
});

describe('Huang Yueying — Wondrous Talent', () => {
  it('her Steal and Starvation ignore distance', () => {
    const s = table({ 'seat-a:hand': [card('st', 'steal'), card('sv', 'starvation', 'club', 4)], 'seat-c:hand': [card('x', 'shan')] }, { generals: { 'seat-a': ['huang-yueying', 'wei-yan'] } });
    expect(playTargets(s, 'seat-a', 'st')).toContain('seat-c');
    expect(playTargets(s, 'seat-a', 'sv')).toContain('seat-c');
  });
});

describe('Guan Yu — Fighting Saint', () => {
  it('uses a red card from his hand or equipment as a Sha in his Play Phase', () => {
    const s = table({ 'seat-a:hand': [card('p', 'peach', 'heart'), card('k', 'shan', 'spade')], 'seat-a:equip': [card('rh', 'red-hare', 'heart', 5)] }, { generals: at('seat-a', 'guan-yu') });
    const selecting = convert(s, 'seat-a', 'fighting-saint', 'seat-b');
    expect(selecting.pendingSelection).toMatchObject({ eligibleIds: ['p', 'rh'], min: 1, max: 1 });
    const used = select(selecting, 'rh');
    expect(used.pendingResponse).toMatchObject({ respondingSeatId: 'seat-b', allowedCardIds: ['shan'] });
    expect(used.turn.cardPlays).toEqual({ sha: 1 });
    expect(handIds(used, 'seat-a')).toEqual(['p', 'k']);
  });

  it('answers a Duel with a red card', () => {
    let s = play(table({ 'seat-b:hand': [card('du', 'duel', 'spade', 1)], 'seat-a:hand': [card('p', 'peach', 'heart')] }, { owner: 'seat-b', generals: at('seat-a', 'guan-yu') }), 'du', 'seat-a');
    s = select(convert(s, 'seat-a', 'fighting-saint'), 'p');
    expect(s.pendingResponse?.respondingSeatId).toBe('seat-b');
  });

  it('is not offered without a red card', () => {
    expect(conversions(table({ 'seat-a:hand': [card('k', 'shan', 'spade')] }, { generals: at('seat-a', 'guan-yu') }), 'seat-a')).toEqual([]);
  });
});

describe('Zhao Yun — Dragon Courage', () => {
  it('a Shan as a Sha in his Play Phase', () => {
    const s = select(convert(table({ 'seat-a:hand': [card('n', 'shan', 'diamond')] }, { generals: at('seat-a', 'zhao-yun') }), 'seat-a', 'shan-as-sha', 'seat-b'), 'n');
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-b', allowedCardIds: ['shan'] });
  });

  it('a Sha as a Shan, answering', () => {
    let s = play(table({ 'seat-b:hand': [card('s1', 'sha')], 'seat-a:hand': [card('s2', 'sha', 'club')] }, { owner: 'seat-b', generals: at('seat-a', 'zhao-yun') }), 's1', 'seat-a');
    s = select(convert(s, 'seat-a', 'sha-as-shan'), 's2');
    expect(hp(s, 'seat-a')).toBe(4);
  });

  it('hidden: Cancel leaves him hidden and the window open; confirming reveals him, then the Sha is dodged', () => {
    let s = play(table({ 'seat-b:hand': [card('s1', 'sha')], 'seat-a:hand': [card('s2', 'sha', 'club')] }, { owner: 'seat-b', generals: at('seat-a', 'zhao-yun', false) }), 's1', 'seat-a');
    const window = s.pendingResponse!.id;
    const cancelled = cancel(convert(s, 'seat-a', 'sha-as-shan'));
    expect(cancelled.seats[0].generals!.main.revealed).toBe(false);
    expect(cancelled.pendingResponse?.id).toBe(window);
    s = select(convert(cancelled, 'seat-a', 'sha-as-shan'), 's2');
    expect(s.seats[0].generals!.main.revealed).toBe(true);
    expect(s.log.find((e) => e.kind === 'GeneralRevealedEvent')).toMatchObject({ seatId: 'seat-a', slot: 'main', forAbilityId: 'dragon-courage' });
    expect(hp(s, 'seat-a')).toBe(4);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx jest projects/content/src/lib/generals/shu.spec.ts`
Expected: FAIL — `SHU_GENERALS` is empty.

- [ ] **Step 3: Write the skills**

Replace `projects/content/src/lib/generals/shu.ts` with:

```ts
import type { CardInstance, SkillDefinition } from 'engine';
import { colourOf } from 'engine';
import type { GeneralSkillSet } from './types';

// The Shu base Generals' skills (General Skills spec, "Shu"). Every skill acts
// for the `owner` the engine passes in, never by searching for its General.

const red = (card: CardInstance) => colourOf(card) === 'red';

// Roar (compulsory): there is no limit on how many Sha you play.
export const roar: SkillDefinition = { id: 'roar', compulsory: true, modifiers: { shaLimit: Number.POSITIVE_INFINITY } };

// Horsemanship (compulsory): your distance to every other seat is 1 smaller, never below 1.
export const horsemanship: SkillDefinition = { id: 'horsemanship', compulsory: true, modifiers: { distanceToOthers: -1 } };

// Empty City (compulsory): while you have no hand cards, Sha and Duel can't target you.
export const emptyCity: SkillDefinition = { id: 'empty-city', compulsory: true, modifiers: { untargetableWithEmptyHandBy: ['sha', 'duel'] } };

// Wondrous Talent (compulsory): your Tools ignore distance (Steal, Starvation).
export const wondrousTalent: SkillDefinition = { id: 'wondrous-talent', compulsory: true, modifiers: { toolsIgnoreDistance: true } };

// Fighting Saint (conversion, play and respond): any red card from your hand
// or equipment as a Sha.
export const fightingSaint: SkillDefinition = {
  id: 'fighting-saint',
  conversions: [{ id: 'fighting-saint', as: 'sha', cards: 1, from: 'hand-and-equipment', accepts: red, when: 'both' }],
};

// Dragon Courage (conversion, play and respond): a Shan as a Sha, and a Sha as a Shan.
export const dragonCourage: SkillDefinition = {
  id: 'dragon-courage',
  conversions: [
    { id: 'shan-as-sha', as: 'sha', cards: 1, accepts: (c) => c.definitionId === 'shan', when: 'both' },
    { id: 'sha-as-shan', as: 'shan', cards: 1, accepts: (c) => c.definitionId === 'sha', when: 'respond' },
  ],
};

export const SHU_GENERALS: GeneralSkillSet[] = [
  { id: 'guan-yu', skills: [fightingSaint] },
  { id: 'zhang-fei', skills: [roar] },
  { id: 'zhao-yun', skills: [dragonCourage] },
  { id: 'ma-chao', skills: [horsemanship] },
  { id: 'zhuge-liang', skills: [emptyCity] },
  { id: 'huang-yueying', skills: [wondrousTalent] },
];
```

- [ ] **Step 4: Run the tests**

Run: `npx jest projects/content/src/lib/generals/shu.spec.ts`
Expected: PASS.

- [ ] **Step 5: Run the whole suite and commit**

Run: `npx jest`
Expected: PASS.

```bash
git add projects/content
git commit -m "feat(content): Roar, Horsemanship, Empty City, Wondrous Talent, Fighting Saint and Dragon Courage

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 9: Shu — Gathering Wisdom, Iron Cavalry, Astrology, Kindness (and Fierce General)

Rule text: General Skills spec, "Shu".

**Files:**
- Modify: `projects/content/src/lib/generals/shu.ts`
- Create: `projects/content/src/lib/generals/shu-triggers.spec.ts`

**Interfaces:**
- Consumes: `atStep`, `askAtStep`, `actedOn` (steps.ts); `ShaStepData.unblockable` (Task 4); `drawPileTop` (Task 2); `give` with `tally` (Task 2); `abilityUseKey` (engine).
- Produces: `SHU_GENERALS`: `huang-yueying` = `[gatheringWisdom, wondrousTalent]`, `ma-chao` = `[horsemanship, ironCavalry]`, `zhuge-liang` = `[astrology, emptyCity]`, `liu-bei` = `[kindness, fierceGeneral]`. Iron Cavalry logs outcome `unblockable` (`targetSeatId` = the Sha's target). Kindness tallies under `${abilityUseKey(owner)}/given` and marks its heal under `${abilityUseKey(owner)}/healed` in `turn.abilityUses`.

- [ ] **Step 1: Write the failing tests**

Create `projects/content/src/lib/generals/shu-triggers.spec.ts`:

```ts
import type { GameState } from 'engine';
import { abilityLog, askedAbout, card, handIds, harness, hp, ids, table, TableOptions } from './skills.testing';

const h = harness();
const at = (seatId: string, general: string, revealed = true): TableOptions['generals'] => ({ [seatId]: [general, 'wei-yan', revealed] });
const pile = (n: number, suit: 'heart' | 'spade' = 'heart') => Array.from({ length: n }, (_, i) => card(`c${i + 1}`, 'shan', suit, i + 1));
const drawn = (s: GameState) => s.log.flatMap((e) => (e.kind === 'CardsDrawnEvent' ? [e.cardInstanceIds.length] : []));

describe('Huang Yueying — Gathering Wisdom', () => {
  it('may draw 1 when she plays a non-delayed Tool, before it takes effect', () => {
    const s = h.play(table({ 'seat-a:hand': [card('dt', 'draw-two', 'heart', 7)], drawPile: pile(3) }, { generals: at('seat-a', 'huang-yueying') }), 'dt');
    expect(askedAbout(s)).toBe('gathering-wisdom');
    expect(drawn(h.use(s))).toEqual([1, 2]);
    expect(drawn(h.decline(s))).toEqual([2]);
  });

  it('counts a Wuxie she plays as an answer, and not a delayed Tool or a Basic card', () => {
    let s = h.play(table({ 'seat-b:hand': [card('st', 'steal', 'spade', 3)], 'seat-a:hand': [card('wx', 'wuxie', 'spade', 11)], drawPile: pile(2) }, { owner: 'seat-b', generals: at('seat-a', 'huang-yueying') }), 'st', 'seat-a');
    s = h.respond(s, 'wx');
    expect(askedAbout(s)).toBe('gathering-wisdom');
    const capture = h.play(table({ 'seat-a:hand': [card('cp', 'capture', 'spade', 6)] }, { generals: at('seat-a', 'huang-yueying') }), 'cp', 'seat-b');
    expect(capture.pendingChoice).toBeUndefined();
    const sha = h.play(table({ 'seat-a:hand': [card('s1', 'sha')] }, { generals: at('seat-a', 'huang-yueying') }), 's1', 'seat-b');
    expect(sha.pendingChoice).toBeUndefined();
  });
});

describe('Ma Chao — Iron Cavalry', () => {
  const attack = (judged: 'heart' | 'spade', more: Record<string, ReturnType<typeof card>[]> = {}) =>
    h.play(table({ 'seat-a:hand': [card('s1', 'sha')], 'seat-b:hand': [card('n1', 'shan')], drawPile: [card('j', 'peach', judged, 2)], ...more }, { generals: at('seat-a', 'ma-chao') }), 's1', 'seat-b');

  it('after targeting a seat with a Sha, may judge: on red that seat can’t play a Shan against it', () => {
    let s = attack('heart');
    expect(askedAbout(s)).toBe('iron-cavalry');
    expect(s.pendingChoice?.reason).toMatchObject({ targetSeatId: 'seat-b' });
    s = h.use(s);
    expect(s.pendingResponse).toBeNull();
    expect(hp(s, 'seat-b')).toBe(3);
    expect(abilityLog(s)).toEqual([expect.objectContaining({ abilityId: 'iron-cavalry', outcome: 'unblockable', targetSeatId: 'seat-b' })]);
    expect(ids(s, 'discardPile')).toContain('j');
  });

  it('on black the Shan is asked for as normal', () => {
    expect(h.use(attack('spade')).pendingResponse).toMatchObject({ respondingSeatId: 'seat-b', allowedCardIds: ['shan'] });
  });

  it('a red judgment also keeps Eight Trigrams out', () => {
    const s = h.use(attack('heart', { 'seat-b:equip': [card('et', 'eight-trigrams', 'spade', 2)] }));
    expect(s.pendingChoice).toBeUndefined();
    expect(hp(s, 'seat-b')).toBe(3);
  });

  it('armour still applies: Black Shield stops a black Sha', () => {
    const s = h.use(attack('heart', { 'seat-b:equip': [card('bs', 'black-shield', 'club', 2)] }));
    expect(hp(s, 'seat-b')).toBe(4);
  });
});

describe('Zhuge Liang — Astrology', () => {
  // seat-d's turn ends; seat-a's Start Phase begins.
  const start = (seats: number, cards = pile(6)) =>
    h.settle(table({ drawPile: cards }, { seats, generals: at('seat-a', 'zhuge-liang'), owner: seats === 6 ? 'seat-f' : 'seat-d', phase: 'End' }));

  it('looks at the top X cards (X = living seats) and puts each on top or at the bottom, in any order', () => {
    let s = start(4);
    expect(askedAbout(s)).toBe('astrology');
    s = h.use(s);
    expect(s.pendingArrangement?.cardInstanceIds).toEqual(['c1', 'c2', 'c3', 'c4']);
    s = h.arrange(s, ['c3', 'c1'], ['c2', 'c4']);
    expect(ids(s, 'drawPile')).toEqual(['c3', 'c1', 'c5', 'c6', 'c2', 'c4']);
  });

  it('looks at no more than 5', () => {
    expect(h.use(start(6, pile(7))).pendingArrangement?.cardInstanceIds).toHaveLength(5);
  });
});

describe('Liu Bei — Kindness', () => {
  const hand = ['k1', 'k2', 'k3', 'k4'].map((id) => card(id, 'shan', 'spade'));
  const liuBei = (combinedHp: number) => table({ 'seat-a:hand': hand }, { generals: at('seat-a', 'liu-bei'), hp: { 'seat-a': combinedHp } });
  const give = (s: GameState, to: string, ...cards: string[]) => h.choose(h.select(h.useSkill(s, 'seat-a', 'kindness'), ...cards), to);

  it('gives any hand cards to another seat, any number of times; he recovers 1 HP once, when 2 have been given', () => {
    let s = give(liuBei(2), 'seat-b', 'k1');
    expect(handIds(s, 'seat-b')).toEqual(['k1']);
    expect(hp(s, 'seat-a')).toBe(2);
    s = give(s, 'seat-c', 'k2');
    expect(hp(s, 'seat-a')).toBe(3);
    s = give(s, 'seat-b', 'k3', 'k4');
    expect(hp(s, 'seat-a')).toBe(3);
    expect(handIds(s, 'seat-b')).toEqual(['k1', 'k3', 'k4']);
  });

  it('Cancel undoes the use: nothing is counted and it is offered again', () => {
    const s = h.cancel(h.useSkill(liuBei(3), 'seat-a', 'kindness'));
    expect(s.turn.abilityUses).toBeUndefined();
    expect(h.legal(s, 'seat-a').some((a) => a.kind === 'UseSkillAction')).toBe(true);
  });

  it('is not offered with an empty hand', () => {
    expect(h.legal(table({}, { generals: at('seat-a', 'liu-bei') }), 'seat-a').some((a) => a.kind === 'UseSkillAction')).toBe(false);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx jest projects/content/src/lib/generals/shu-triggers.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Write the skills**

In `projects/content/src/lib/generals/shu.ts` extend the imports:

```ts
import type { CardInstance, CardPlayedEvent, GeneralOwner, PhaseChangedEvent, SkillDefinition } from 'engine';
import { abilityUseKey, colourOf, drawPileTop } from 'engine';
import type { GeneralSkillSet } from './types';
import { CardStep, actedOn, askAtStep, atStep } from '../shared/steps';
import { handOf } from '../shared/queries';
import { ask, draw, heal, on, otherLivingSeatIds, reasonOf, selectionOf, skillStep, used } from '../shared/skills';
```

and add before `SHU_GENERALS`:

```ts
// Gathering Wisdom (may): when you play a non-delayed Tool (an answering Wuxie
// included), you may draw 1 card, before the Tool takes effect.
export const gatheringWisdom: SkillDefinition = {
  id: 'gathering-wisdom',
  triggers: [
    on<CardPlayedEvent>('after:CardPlayedEvent', {
      condition: (_state, event, owner, registry) => {
        const definition = registry.cards.get(event.card.as);
        return event.seatId === owner.seatId && definition?.category === 'tool' && !definition.delayed;
      },
      effect: (_state, _event, owner) => [ask(owner, [draw(owner.seatId, 1)])],
    }),
  ],
};

// Iron Cavalry (may): after you target a seat with a Sha, you may judge. On
// red, that seat can't play a Shan against this Sha (Eight Trigrams included).
export const ironCavalry: SkillDefinition = {
  id: 'iron-cavalry',
  triggers: [
    atStep(['sha-targeted'], {
      condition: (_state, step, owner) => owner.kind === 'general' && step.userSeatId === owner.seatId,
      effect: (_state, step, owner) => {
        const passed = actedOn(step, owner);
        const judge = { kind: 'JudgeEffect' as const, seatId: owner.seatId, reader: { kind: 'skill' as const, owner: owner as GeneralOwner }, data: { step: passed }, otherwise: [passed] };
        return [askAtStep(owner, 'iron-cavalry', step, [judge])];
      },
    }),
  ],
  onJudged: (_state, { owner, judged, data, done }) => {
    const step = data?.['step'] as CardStep;
    if (colourOf(judged) !== 'red') return [done, step];
    return [done, used(owner, 'unblockable', step.target.seatId), { ...step, data: { ...step.data, unblockable: true } }];
  },
};

// Astrology (may): in your Start Phase you may look at the top X cards of the
// draw pile (X = living seats, at most 5) and put each back on top or at the
// bottom, in any order.
export const astrology: SkillDefinition = {
  id: 'astrology',
  triggers: [
    on<PhaseChangedEvent>('after:PhaseChangedEvent', {
      condition: (state, event, owner) => event.phase === 'Start' && event.seatId === owner.seatId && drawPileTop(state, 1).length > 0,
      effect: (_state, _event, owner) => [ask(owner, [skillStep(owner, 'look')])],
    }),
  ],
  onStep: (state, step) => {
    const living = state.seats.filter((s) => !s.eliminated).length;
    const cards = drawPileTop(state, Math.min(5, living));
    if (cards.length === 0) return [];
    return [{
      kind: 'OpenArrangementEffect',
      arrangement: { id: `astrology-${step.owner.seatId}-${state.log.length}`, seatId: step.owner.seatId, reason: reasonOf(step.owner), cardInstanceIds: cards.map((c) => c.instanceId) },
    }];
  },
};

const givenKey = (owner: GeneralOwner) => `${abilityUseKey(owner)}/given`;
const healedKey = (owner: GeneralOwner) => `${abilityUseKey(owner)}/healed`;

// Kindness (active, any number of times): in your Play Phase you may give any
// of your hand cards to another seat. Once per turn, when the total given this
// turn first reaches 2 or more, you recover 1 HP.
export const kindness: SkillDefinition = {
  id: 'kindness',
  active: {
    canUse: (state, { seatId }) => handOf(state, seatId).length > 0 && otherLivingSeatIds(state, seatId).length > 0,
    start: (state, { seatId, owner }) => {
      const hand = handOf(state, seatId).map((c) => c.instanceId);
      return [
        selectionOf(state, owner, {
          of: 'cards', eligibleIds: hand, min: 1, max: hand.length,
          then: { kind: 'give', toSeatIds: otherLivingSeatIds(state, seatId), tally: givenKey(owner), then: [skillStep(owner, 'heal')] },
          onCancel: [],
        }),
      ];
    },
  },
  onStep: (state, step) => {
    const uses = state.turn.abilityUses ?? {};
    if ((uses[givenKey(step.owner)] ?? 0) < 2 || uses[healedKey(step.owner)]) return [];
    return [{ kind: 'IncrementEffect', scope: 'turn', key: healedKey(step.owner), by: 1 }, heal(step.owner.seatId)];
  },
};

// Fierce General: a Lord skill, inactive in Guozhan.
export const fierceGeneral: SkillDefinition = { id: 'fierce-general', lord: true };
```

and `SHU_GENERALS` becomes:

```ts
export const SHU_GENERALS: GeneralSkillSet[] = [
  { id: 'guan-yu', skills: [fightingSaint] },
  { id: 'huang-yueying', skills: [gatheringWisdom, wondrousTalent] },
  { id: 'liu-bei', skills: [kindness, fierceGeneral] },
  { id: 'ma-chao', skills: [horsemanship, ironCavalry] },
  { id: 'zhang-fei', skills: [roar] },
  { id: 'zhao-yun', skills: [dragonCourage] },
  { id: 'zhuge-liang', skills: [astrology, emptyCity] },
];
```

- [ ] **Step 4: Run the tests**

Run: `npx jest projects/content/src/lib/generals`
Expected: PASS.

- [ ] **Step 5: Run the whole suite and commit**

Run: `npx jest`
Expected: PASS. The app's avatar-skills spec uses its own test registry, so the real Kindness doesn't touch it.

```bash
git add projects/content
git commit -m "feat(content): Gathering Wisdom, Iron Cavalry, Astrology and Kindness

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 10: Wu — Country Scene, Surprise, Humility, Linked Camps, Armed Consorts, Self-Restraint

Rule text: General Skills spec, "Wu". Linked Camps and Armed Consorts listen to `after:CardMovedEvent` by `fromZoneId`, so every way a card leaves counts; their draws come after the move.

**Files:**
- Modify: `projects/content/src/lib/generals/wu.ts`
- Create: `projects/content/src/lib/generals/wu.spec.ts`

**Interfaces:**
- Consumes: one-card conversions from hand and equipment (Task 3), `countsAs` placement (Tasks 3–4), `discardOwed` (Task 2), `used`, `draw`, `on`, `ask`, `handZoneId`, `equipZoneId` (Task 4).
- Produces: `WU_GENERALS` entries `da-qiao` (`countryScene`; Task 11 adds `displace`), `gan-ning` (`surprise`), `lu-xun` (`humility`, `linkedCamps`), `sun-shangxiang` (`armedConsorts`; Task 11 puts `marriage` first), `lu-meng` (`selfRestraint`). Linked Camps and Armed Consorts log outcome `used` before drawing.

- [ ] **Step 1: Write the failing tests**

Create `projects/content/src/lib/generals/wu.spec.ts`:

```ts
import type { GameState } from 'engine';
import { abilityLog, askedAbout, card, handIds, harness, ids, table, TableOptions } from './skills.testing';

const h = harness();
const at = (seatId: string, main: string, deputy = 'sun-jian', revealed = true): TableOptions['generals'] => ({ [seatId]: [main, deputy, revealed] });
const pile = Array.from({ length: 6 }, (_, i) => card(`d${i + 1}`, 'shan', 'heart', i + 1));
const drawnCount = (s: GameState) => s.log.reduce((n, e) => n + (e.kind === 'CardsDrawnEvent' ? e.cardInstanceIds.length : 0), 0);
const playTargets = (s: GameState, seatId: string, cardId: string) =>
  h.legal(s, seatId).flatMap((a) => (a.kind === 'PlayCardAction' && a.cardInstanceId === cardId ? [a.targets[0]?.seatId] : []));

describe('Da Qiao — Country Scene', () => {
  it('uses a diamond card from her hand or equipment as a Capture; it lies in the Judgment slot as one', () => {
    const s = table({ 'seat-a:hand': [card('dm', 'shan', 'diamond', 3), card('hr', 'peach', 'heart')], 'seat-a:equip': [card('dy', 'da-yuan', 'diamond', 13)] }, { generals: at('seat-a', 'da-qiao') });
    const selecting = h.convert(s, 'seat-a', 'country-scene', 'seat-b');
    expect(selecting.pendingSelection?.eligibleIds).toEqual(['dm', 'dy']);
    const placed = h.select(selecting, 'dm');
    const slot = placed.zones.find((z) => z.id === 'seat-b:judgment')!;
    expect(slot.cards.map((c) => c.instanceId)).toEqual(['dm']);
    expect(slot.countsAs).toEqual({ dm: 'capture' });
    expect(ids(placed, 'discardPile')).toEqual([]);
  });
});

describe('Gan Ning — Surprise', () => {
  it('uses a black card from his hand or equipment as a Break', () => {
    const s = table({ 'seat-a:hand': [card('k', 'shan', 'spade')], 'seat-b:equip': [card('cb', 'crossbow', 'diamond', 1)] }, { generals: at('seat-a', 'gan-ning') });
    const picking = h.select(h.convert(s, 'seat-a', 'surprise', 'seat-b'), 'k');
    expect(picking.pendingChoice).toMatchObject({ seatId: 'seat-a', verb: 'discard' });
    expect(ids(h.choose(picking, 'cb'), 'seat-b:equip')).toEqual([]);
  });
});

describe('Lu Xun — Humility', () => {
  it('Steal and Capture can’t target him', () => {
    const s = table({ 'seat-a:hand': [card('st', 'steal'), card('cp', 'capture', 'spade', 6)], 'seat-b:hand': [card('x', 'shan')] }, { generals: at('seat-b', 'lu-xun') });
    expect(playTargets(s, 'seat-a', 'st')).not.toContain('seat-b');
    expect(playTargets(s, 'seat-a', 'cp')).not.toContain('seat-b');
  });
});

describe('Lu Xun — Linked Camps', () => {
  const luXun = (hand: ReturnType<typeof card>[], o: TableOptions = {}, more: Record<string, ReturnType<typeof card>[]> = {}) =>
    table({ 'seat-a:hand': hand, drawPile: pile, ...more }, { generals: at('seat-a', 'lu-xun'), ...o });

  it('draws 1 when he plays his last hand card', () => {
    const s = h.play(luXun([card('s1', 'sha')]), 's1', 'seat-b');
    expect(handIds(s, 'seat-a')).toEqual(['d1']);
    expect(abilityLog(s)).toEqual([expect.objectContaining({ abilityId: 'linked-camps', outcome: 'used' })]);
  });

  it('draws 1 when it is discarded, discarded by Break, or taken by another seat', () => {
    expect(handIds(h.run(luXun([card('x', 'shan')]), [{ kind: 'MoveCardEffect', cardInstanceId: 'x', toZoneId: 'discardPile' }]), 'seat-a')).toEqual(['d1']);
    let broken = h.play(luXun([card('x', 'shan')], { owner: 'seat-b' }, { 'seat-b:hand': [card('br', 'break', 'spade', 3)] }), 'br', 'seat-a');
    broken = h.choose(broken, 'hand');
    expect(handIds(broken, 'seat-a')).toEqual(['d1']);
    const taken = h.run(luXun([card('x', 'shan')]), [{ kind: 'MoveRandomCardEffect', fromZoneId: 'seat-a:hand', toZoneId: 'seat-c:hand' }]);
    expect(handIds(taken, 'seat-a')).toEqual(['d1']);
  });

  it('only once when a Serpent Spear Sha takes his last two', () => {
    const s = h.select(h.convert(luXun([card('x1', 'shan'), card('x2', 'peach', 'heart')], {}, { 'seat-a:equip': [card('sp', 'serpent-spear', 'spade', 12)] }), 'seat-a', 'serpent-spear', 'seat-b'), 'x1', 'x2');
    expect(drawnCount(s)).toBe(1);
  });

  it('not while a card is left, and not while he is hidden', () => {
    expect(handIds(h.play(luXun([card('s1', 'sha'), card('x', 'shan')]), 's1', 'seat-b'), 'seat-a')).toEqual(['x']);
    expect(handIds(h.play(luXun([card('s1', 'sha')], { generals: at('seat-a', 'lu-xun', 'sun-jian', false) }), 's1', 'seat-b'), 'seat-a')).toEqual([]);
  });
});

describe('Sun Shangxiang — Armed Consorts', () => {
  const her = (equip: ReturnType<typeof card>[], hand: ReturnType<typeof card>[], deputy = 'sun-jian', o: TableOptions = {}, more = {}) =>
    table({ 'seat-a:equip': equip, 'seat-a:hand': hand, drawPile: pile, ...more }, { generals: at('seat-a', 'sun-shangxiang', deputy), ...o });

  it('draws 2 when a worn card is replaced', () => {
    const s = h.play(her([card('cb', 'crossbow', 'diamond', 1)], [card('is', 'ice-sword', 'spade', 2)]), 'is');
    expect(handIds(s, 'seat-a')).toEqual(['d1', 'd2']);
  });

  it('draws 2 when Steal takes a worn card', () => {
    let s = h.play(her([card('cb', 'crossbow', 'diamond', 1)], [], 'sun-jian', { owner: 'seat-b' }, { 'seat-b:hand': [card('st', 'steal', 'spade', 3)] }), 'st', 'seat-a');
    s = h.choose(s, 'cb');
    expect(handIds(s, 'seat-a')).toEqual(['d1', 'd2']);
  });

  it('draws 2 when she uses a worn card through a conversion', () => {
    const s = h.select(h.convert(her([card('cb', 'crossbow', 'club', 1)], [], 'gan-ning', {}, { 'seat-b:hand': [card('x', 'shan')] }), 'seat-a', 'surprise', 'seat-b'), 'cb');
    expect(handIds(s, 'seat-a')).toEqual(['d1', 'd2']);
  });
});

describe('Lu Meng — Self-Restraint', () => {
  // seat-a at 2 HP holds 4 cards: ending its Play Phase brings the Discard Phase.
  const ending = (o: TableOptions = {}) => {
    const s = table({ 'seat-a:hand': [card('k1', 'shan'), card('k2', 'shan'), card('k3', 'peach', 'heart'), card('k4', 'shan')] }, { generals: at('seat-a', 'lu-meng'), hp: { 'seat-a': 2 }, ...o });
    return h.act(s, { kind: 'EndPhaseAction', seatId: 'seat-a' });
  };

  it('with no Sha used this turn, may skip the Discard Phase', () => {
    const s = ending();
    expect(askedAbout(s)).toBe('self-restraint');
    const skipped = h.use(s);
    expect(handIds(skipped, 'seat-a')).toHaveLength(4);
    expect(skipped.turn.ownerSeatId).toBe('seat-b');
    expect(h.legal(h.decline(s), 'seat-a').every((a) => a.kind === 'DiscardCardAction')).toBe(true);
  });

  it('is not asked after any Sha this turn, answers included', () => {
    expect(ending({ ownerUses: { sha: 1 } }).pendingChoice).toBeUndefined();
  });

  it('is not asked with nothing to discard', () => {
    expect(ending({ hp: { 'seat-a': 4 } }).pendingChoice).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx jest projects/content/src/lib/generals/wu.spec.ts`
Expected: FAIL (only Brave Gesture exists).

- [ ] **Step 3: Write the skills**

In `projects/content/src/lib/generals/wu.ts` set the imports to:

```ts
import type { CardInstance, CardMovedEvent, PhaseChangedEvent, SkillDefinition } from 'engine';
import { cardsOverHandLimit, colourOf, skipFlagOf } from 'engine';
import type { GeneralSkillSet } from './types';
import { handOf } from '../shared/queries';
import { ask, atDrawPhase, draw, equipZoneId, handZoneId, on, used } from '../shared/skills';
```

and add before `WU_GENERALS`:

```ts
const black = (card: CardInstance) => colourOf(card) === 'black';

// Country Scene (conversion, play): any diamond card from your hand or equipment as a Capture.
export const countryScene: SkillDefinition = {
  id: 'country-scene',
  conversions: [{ id: 'country-scene', as: 'capture', cards: 1, from: 'hand-and-equipment', accepts: (c) => c.suit === 'diamond', when: 'play' }],
};

// Surprise (conversion, play): any black card from your hand or equipment as a Break.
export const surprise: SkillDefinition = {
  id: 'surprise',
  conversions: [{ id: 'surprise', as: 'break', cards: 1, from: 'hand-and-equipment', accepts: black, when: 'play' }],
};

// Humility (compulsory): Steal and Capture can't target you.
export const humility: SkillDefinition = { id: 'humility', compulsory: true, modifiers: { untargetableBy: ['steal', 'capture'] } };

// Linked Camps (compulsory): whenever you lose your last hand card, however it
// happens, you draw 1.
export const linkedCamps: SkillDefinition = {
  id: 'linked-camps',
  compulsory: true,
  triggers: [
    on<CardMovedEvent>('after:CardMovedEvent', {
      condition: (state, event, owner) =>
        event.fromZoneId === handZoneId(state, owner.seatId) && event.toZoneId !== event.fromZoneId && handOf(state, owner.seatId).length === 0,
      effect: (_state, _event, owner) => [used(owner), draw(owner.seatId, 1)],
    }),
  ],
};

// Armed Consorts (compulsory): each time a card leaves your equipment (replaced,
// taken, discarded, or used through a conversion), you draw 2.
export const armedConsorts: SkillDefinition = {
  id: 'armed-consorts',
  compulsory: true,
  triggers: [
    on<CardMovedEvent>('after:CardMovedEvent', {
      condition: (state, event, owner) => event.fromZoneId === equipZoneId(state, owner.seatId) && event.toZoneId !== event.fromZoneId,
      effect: (_state, _event, owner) => [used(owner), draw(owner.seatId, 2)],
    }),
  ],
};

// Self-Restraint (may): if you played or used no Sha this turn, answers
// included, you may skip your Discard Phase. Asked as it begins, and only when
// there is something to discard.
export const selfRestraint: SkillDefinition = {
  id: 'self-restraint',
  triggers: [
    on<PhaseChangedEvent>('after:PhaseChangedEvent', {
      condition: (state, event, owner) =>
        event.phase === 'Discard' &&
        event.seatId === owner.seatId &&
        state.turn.ownerSeatId === owner.seatId &&
        (state.turn.ownerUses?.['sha'] ?? 0) === 0 &&
        cardsOverHandLimit(state, owner.seatId) > 0,
      effect: (_state, _event, owner) => [ask(owner, [{ kind: 'SetTurnFlagEffect', flag: skipFlagOf('Discard') }])],
    }),
  ],
};
```

and `WU_GENERALS` becomes:

```ts
export const WU_GENERALS: GeneralSkillSet[] = [
  { id: 'da-qiao', skills: [countryScene] },
  { id: 'gan-ning', skills: [surprise] },
  { id: 'lu-meng', skills: [selfRestraint] },
  { id: 'lu-xun', skills: [humility, linkedCamps] },
  { id: 'sun-shangxiang', skills: [armedConsorts] },
  { id: 'zhou-yu', skills: [braveGesture] },
];
```

- [ ] **Step 4: Run the tests**

Run: `npx jest projects/content/src/lib/generals`
Expected: PASS.

- [ ] **Step 5: Run the whole suite and commit**

Run: `npx jest`
Expected: PASS.

```bash
git add projects/content
git commit -m "feat(content): Country Scene, Surprise, Humility, Linked Camps, Armed Consorts and Self-Restraint

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 11: Wu — Displace, Battered Body, Reconsider, Marriage, Sow Revolt (and Rescued)

Rule text: General Skills spec, "Wu".

**Files:**
- Modify: `projects/content/src/lib/generals/wu.ts`
- Create: `projects/content/src/lib/generals/wu-actives.spec.ts`

**Interfaces:**
- Consumes: `atStep`, `askAtStep`, `actedOn`, `CardStep` (steps.ts); `shaStep` (cards/sha.ts); `attackRange`, `seatDistance`, `handOf` (queries.ts); `untargetableBy` (abilities.ts); `seatGender` (gender.ts); the Task 4 skill helpers; `ShowCardEffect` (Task 2).
- Produces: `WU_GENERALS`: `da-qiao` = `[countryScene, displace]`, `huang-gai` = `[batteredBody]`, `sun-quan` = `[reconsider, rescued]`, `sun-shangxiang` = `[marriage, armedConsorts]`, `zhou-yu` = `[braveGesture, sowRevolt]`. Displace logs outcome `moved` (`targetSeatId` = the new target).

- [ ] **Step 1: Write the failing tests**

Create `projects/content/src/lib/generals/wu-actives.spec.ts`:

```ts
import type { GameState } from 'engine';
import { abilityLog, askedAbout, card, handIds, harness, hp, ids, kwMode, table, TableOptions } from './skills.testing';

const h = harness();
const at = (seatId: string, main: string, deputy = 'sun-jian', revealed = true): TableOptions['generals'] => ({ [seatId]: [main, deputy, revealed] });
const pile = Array.from({ length: 6 }, (_, i) => card(`d${i + 1}`, 'shan', 'heart', i + 1));
const offered = (s: GameState, seatId: string, skillId: string) =>
  h.legal(s, seatId).some((a) => a.kind === 'UseSkillAction' && a.owner.kind === 'general' && a.owner.skillId === skillId);

describe('Da Qiao — Displace', () => {
  // seat-b's Sha at Da Qiao (seat-a). Her neighbours are seat-b and seat-d.
  const shaAtHer = (cards: Record<string, ReturnType<typeof card>[]>) =>
    h.play(table({ 'seat-b:hand': [card('s1', 'sha')], ...cards }, { owner: 'seat-b', generals: at('seat-a', 'da-qiao') }), 's1', 'seat-a');

  it('discards 1 card to move the Sha onto another seat in her attack range, not its user; it goes on from the armour check', () => {
    let s = shaAtHer({ 'seat-a:hand': [card('x', 'peach', 'heart')] });
    expect(askedAbout(s)).toBe('displace');
    s = h.select(h.use(s), 'x');
    expect(s.pendingChoice?.options.map((o) => o.id)).toEqual(['seat-d']);
    s = h.choose(s, 'seat-d');
    expect(ids(s, 'discardPile')).toContain('x');
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-d', allowedCardIds: ['shan'] });
    expect(abilityLog(s)).toEqual([expect.objectContaining({ abilityId: 'displace', outcome: 'moved', targetSeatId: 'seat-d' })]);
    expect(hp(h.pass(s), 'seat-d')).toBe(3);
  });

  it('range is worked out after the discard: a horse she needs to reach the seat is not offered', () => {
    const horses = { 'seat-a:equip': [card('oh', 'red-hare', 'heart', 5)], 'seat-d:equip': [card('dh', 'di-lu', 'club', 5)] };
    const s = h.use(shaAtHer({ 'seat-a:hand': [card('x', 'shan')], ...horses }));
    expect(s.pendingSelection?.eligibleIds).toEqual(['x']);
    expect(shaAtHer(horses).pendingChoice).toBeUndefined(); // the horse is all she has: no ask
  });

  it('Cancel at the discard lets the Sha go on against her', () => {
    const s = h.cancel(h.use(shaAtHer({ 'seat-a:hand': [card('x', 'shan')] })));
    expect(s.pendingResponse?.respondingSeatId).toBe('seat-a');
  });
});

describe('Huang Gai — Battered Body', () => {
  it('loses 1 HP, then draws 2, any number of times', () => {
    let s = h.useSkill(table({ drawPile: pile }, { generals: at('seat-a', 'huang-gai') }), 'seat-a', 'battered-body');
    expect(hp(s, 'seat-a')).toBe(3);
    expect(handIds(s, 'seat-a')).toEqual(['d1', 'd2']);
    expect(s.log.find((e) => e.kind === 'HpLostEvent')).toEqual({ kind: 'HpLostEvent', seatId: 'seat-a', amount: 1, abilityId: 'battered-body' });
    expect(offered(s, 'seat-a', 'battered-body')).toBe(true);
  });

  it('if it leaves him dying, the dying round comes first; he draws only if he survives', () => {
    const kw = harness(kwMode);
    const atOne = (hand: ReturnType<typeof card>[]) => kw.useSkill(table({ drawPile: pile, 'seat-a:hand': hand }, { generals: at('seat-a', 'huang-gai'), hp: { 'seat-a': 1 } }), 'seat-a', 'battered-body');
    const dying = atOne([card('pe', 'peach', 'heart')]);
    expect(dying.pendingResponse?.reason).toEqual({ kind: 'dying', seatId: 'seat-a' });
    const saved = kw.respond(dying, 'pe');
    expect(hp(saved, 'seat-a')).toBe(1);
    expect(handIds(saved, 'seat-a')).toEqual(['d1', 'd2']);
    const gone = kw.pass(atOne([]));
    expect(gone.seats[0].eliminated).toBe(true);
    expect(gone.log.some((e) => e.kind === 'CardsDrawnEvent')).toBe(false);
  });
});

describe('Sun Quan — Reconsider', () => {
  const sunQuan = () => table({ 'seat-a:hand': [card('k1', 'shan'), card('k2', 'sha')], 'seat-a:equip': [card('cb', 'crossbow', 'diamond', 1)], drawPile: pile }, { generals: at('seat-a', 'sun-quan') });

  it('discards any number of hand or worn cards, then draws that many; once per turn', () => {
    let s = h.useSkill(sunQuan(), 'seat-a', 'reconsider');
    expect(s.pendingSelection).toMatchObject({ eligibleIds: ['k1', 'k2', 'cb'], min: 1, max: 3 });
    s = h.select(s, 'k1', 'cb');
    expect(handIds(s, 'seat-a')).toEqual(['k2', 'd1', 'd2']);
    expect(ids(s, 'discardPile')).toEqual(['k1', 'cb']);
    expect(offered(s, 'seat-a', 'reconsider')).toBe(false);
  });

  it('Cancel leaves it unused', () => {
    expect(offered(h.cancel(h.useSkill(sunQuan(), 'seat-a', 'reconsider')), 'seat-a', 'reconsider')).toBe(true);
  });
});

describe('Sun Shangxiang — Marriage', () => {
  // Hurt: seat-b (male), seat-c (female: Xiao Qiao), seat-d (both Generals hidden: no gender).
  const her = (hand = [card('k1', 'shan'), card('k2', 'sha')]) =>
    table({ 'seat-a:hand': hand }, {
      generals: { ...at('seat-a', 'sun-shangxiang'), 'seat-c': ['xiao-qiao', 'sun-jian'], 'seat-d': ['cao-ren', 'dong-zhuo', false] },
      hp: { 'seat-a': 2, 'seat-b': 2, 'seat-c': 2, 'seat-d': 2 },
    });

  it('discards 2 hand cards and chooses a hurt male seat; both recover 1 HP', () => {
    let s = h.select(h.useSkill(her(), 'seat-a', 'marriage'), 'k1', 'k2');
    expect(s.pendingChoice?.options.map((o) => o.id)).toEqual(['seat-b']);
    s = h.choose(s, 'seat-b');
    expect([hp(s, 'seat-a'), hp(s, 'seat-b')]).toEqual([3, 3]);
    expect(offered(s, 'seat-a', 'marriage')).toBe(false);
  });

  it('is not offered with fewer than 2 hand cards, or no hurt male seat', () => {
    expect(offered(her([card('k1', 'shan')]), 'seat-a', 'marriage')).toBe(false);
    const healthy = table({ 'seat-a:hand': [card('k1', 'shan'), card('k2', 'sha')] }, { generals: at('seat-a', 'sun-shangxiang'), hp: { 'seat-a': 2 } });
    expect(offered(healthy, 'seat-a', 'marriage')).toBe(false);
  });
});

describe('Zhou Yu — Sow Revolt', () => {
  const zhouYu = (taken: ReturnType<typeof card>) => table({ 'seat-a:hand': [taken] }, { generals: at('seat-a', 'zhou-yu') });
  const revolt = (taken: ReturnType<typeof card>, named: string) => {
    let s = h.select(h.useSkill(zhouYu(taken), 'seat-a', 'sow-revolt'), 'seat-b');
    expect(s.pendingChoice).toMatchObject({ seatId: 'seat-b', verb: 'pick' });
    expect(s.pendingChoice!.options.map((o) => o.shows)).toEqual(['spade', 'heart', 'club', 'diamond'].map((suit) => ({ kind: 'suit', suit })));
    s = h.choose(s, named);
    return s;
  };

  it('the chosen seat names a suit, takes a random hand card of his, shown to all; a different suit costs it 1 damage', () => {
    const s = revolt(card('t', 'sha', 'spade'), 'heart');
    expect(handIds(s, 'seat-b')).toEqual(['t']);
    expect(s.log.find((e) => e.kind === 'CardShownEvent')).toEqual({ kind: 'CardShownEvent', seatId: 'seat-b', card: card('t', 'sha', 'spade'), abilityId: 'sow-revolt' });
    expect(hp(s, 'seat-b')).toBe(3);
  });

  it('the right suit: no damage', () => {
    expect(hp(revolt(card('t', 'sha', 'spade'), 'spade'), 'seat-b')).toBe(4);
  });

  it('needs a hand card, and is once per turn', () => {
    expect(offered(table({}, { generals: at('seat-a', 'zhou-yu') }), 'seat-a', 'sow-revolt')).toBe(false);
    expect(offered(revolt(card('t', 'sha', 'spade'), 'spade'), 'seat-a', 'sow-revolt')).toBe(false);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx jest projects/content/src/lib/generals/wu-actives.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Write the skills**

In `projects/content/src/lib/generals/wu.ts` extend the imports:

```ts
import type { CardInstance, CardMovedEvent, ContentRegistry, GameState, GeneralOwner, PhaseChangedEvent, SkillDefinition } from 'engine';
import { cardsOverHandLimit, colourOf, skipFlagOf } from 'engine';
import type { GeneralSkillSet } from './types';
import { attackRange, handOf, seatDistance } from '../shared/queries';
import { untargetableBy } from '../shared/abilities';
import { seatGender } from '../shared/gender';
import { CardStep, actedOn, askAtStep, atStep } from '../shared/steps';
import { shaStep } from '../cards/sha';
import {
  ask, atDrawPhase, choiceOf, discardMoves, draw, equipZoneId, handZoneId, heal, isHurt, isLiving, lastMoveBetween, on,
  otherLivingSeatIds, ownCards, seatOptions, selectionOf, skillDamage, skillStep, used,
} from '../shared/skills';
```

and add before `WU_GENERALS`:

```ts
// The state as if `cardInstanceId` were gone (to work out range after a discard).
const without = (state: GameState, cardInstanceId: string): GameState => ({
  ...state,
  zones: state.zones.map((z) => ({ ...z, cards: z.cards.filter((c) => c.instanceId !== cardInstanceId) })),
});

// Where Da Qiao could move the Sha: other living seats in her attack range,
// not its user, that a Sha may target.
function displaceTargets(state: GameState, step: CardStep, ownerSeatId: string, registry: ContentRegistry): string[] {
  const range = attackRange(state, ownerSeatId, registry);
  return otherLivingSeatIds(state, ownerSeatId).filter(
    (id) => id !== step.userSeatId && seatDistance(state, ownerSeatId, id, registry) <= range && !untargetableBy(state, id, 'sha', registry)
  );
}

// The cards she could discard that still leave a seat to move the Sha to.
const spareCards = (state: GameState, step: CardStep, ownerSeatId: string, registry: ContentRegistry) =>
  ownCards(state, ownerSeatId, true)
    .filter((c) => displaceTargets(without(state, c.instanceId), step, ownerSeatId, registry).length > 0)
    .map((c) => c.instanceId);

// Displace (may): when a Sha targets you, you may discard 1 card to move it
// onto another living seat within your attack range (worked out after the
// discard), not its user. It goes on against that seat from its armour check.
export const displace: SkillDefinition = {
  id: 'displace',
  triggers: [
    atStep(['sha-targeted'], {
      condition: (state, step, owner, registry) => owner.kind === 'general' && step.target.seatId === owner.seatId && spareCards(state, step, owner.seatId, registry).length > 0,
      effect: (state, step, owner, registry) => {
        const general = owner as GeneralOwner;
        const passed = actedOn(step, owner);
        const pick = selectionOf(state, general, {
          of: 'cards', eligibleIds: spareCards(state, step, owner.seatId, registry), min: 1, max: 1,
          then: { kind: 'skill-step', step: skillStep(general, 'discarded', { step: passed }) },
          onCancel: [passed], targetSeatId: step.userSeatId,
        });
        return [askAtStep(owner, 'displace', step, [pick], step.userSeatId)];
      },
    }),
  ],
  onStep: (state, s, registry) => {
    const step = s.data?.['step'] as CardStep;
    if (s.step === 'discarded') return [...discardMoves(state, (s.data?.['picked'] as string[]) ?? []), skillStep(s.owner, 'move', { step })];
    const targets = displaceTargets(state, step, s.owner.seatId, registry);
    if (targets.length === 0) return [step];
    const options = seatOptions(targets, (seatId) => [used(s.owner, 'moved', seatId), { ...shaStep(step, 'sha-armor'), target: { kind: 'seat', seatId } }]);
    return [choiceOf(state, s.owner, { verb: 'pick', options, targetSeatId: step.userSeatId })];
  },
};

// Battered Body (active, any number of times): lose 1 HP, then draw 2. If that
// leaves you dying, the dying round comes first; you draw only if you survive.
export const batteredBody: SkillDefinition = {
  id: 'battered-body',
  active: {
    canUse: (state, { seatId }) => isLiving(state, seatId),
    start: (_state, { seatId, owner }) => [{ kind: 'LoseHpEffect', seatId, amount: 1, abilityId: owner.skillId }, skillStep(owner, 'draw')],
  },
  onStep: (state, step) => (isLiving(state, step.owner.seatId) ? [draw(step.owner.seatId, 2)] : []),
};

// Reconsider (active, once per turn): discard any number of cards (at least 1)
// from your hand or equipment, then draw that many.
export const reconsider: SkillDefinition = {
  id: 'reconsider',
  active: {
    usesPerTurn: 1,
    canUse: (state, { seatId }) => ownCards(state, seatId, true).length > 0,
    start: (state, { seatId, owner }) => {
      const cards = ownCards(state, seatId, true).map((c) => c.instanceId);
      return [selectionOf(state, owner, { of: 'cards', eligibleIds: cards, min: 1, max: cards.length, then: { kind: 'skill-step', step: skillStep(owner, 'discarded') }, onCancel: [] })];
    },
  },
  onStep: (state, step) => {
    const picked = (step.data?.['picked'] as string[]) ?? [];
    return [...discardMoves(state, picked), draw(step.owner.seatId, picked.length)];
  },
};

// Rescued: a Lord skill, inactive in Guozhan.
export const rescued: SkillDefinition = { id: 'rescued', lord: true };

// Other living male seats below their max HP.
const hurtMales = (state: GameState, seatId: string, registry: ContentRegistry) =>
  otherLivingSeatIds(state, seatId).filter((id) => isHurt(state, id) && seatGender(state, id, registry) === 'male');

// Marriage (active, once per turn): discard 2 hand cards and choose a male seat
// below its max HP; you and that seat each recover 1 HP.
export const marriage: SkillDefinition = {
  id: 'marriage',
  active: {
    usesPerTurn: 1,
    canUse: (state, { seatId }, registry) => handOf(state, seatId).length >= 2 && hurtMales(state, seatId, registry).length > 0,
    start: (state, { seatId, owner }) => [
      selectionOf(state, owner, { of: 'cards', eligibleIds: handOf(state, seatId).map((c) => c.instanceId), min: 2, max: 2, then: { kind: 'skill-step', step: skillStep(owner, 'discarded') }, onCancel: [] }),
    ],
  },
  onStep: (state, step, registry) => {
    const { owner } = step;
    if (step.step === 'discarded') return [...discardMoves(state, (step.data?.['picked'] as string[]) ?? []), skillStep(owner, 'pick')];
    const seats = hurtMales(state, owner.seatId, registry);
    return seats.length > 0 ? [choiceOf(state, owner, { verb: 'pick', options: seatOptions(seats, (id) => [heal(owner.seatId), heal(id)]) })] : [];
  },
};

const SUITS: CardInstance['suit'][] = ['spade', 'heart', 'club', 'diamond'];

// Sow Revolt (active, once per turn, needs a hand card): choose another seat.
// It names a suit, then takes 1 of your hand cards at random, shown to all,
// into its hand. If the card's suit isn't the one it named, it takes 1 damage
// from you.
export const sowRevolt: SkillDefinition = {
  id: 'sow-revolt',
  active: {
    usesPerTurn: 1,
    canUse: (state, { seatId }) => handOf(state, seatId).length > 0 && otherLivingSeatIds(state, seatId).length > 0,
    start: (state, { seatId, owner }) => [
      selectionOf(state, owner, { of: 'seats', eligibleIds: otherLivingSeatIds(state, seatId), min: 1, max: 1, then: { kind: 'skill-step', step: skillStep(owner, 'chosen') }, onCancel: [] }),
    ],
  },
  onStep: (state, step) => {
    const { owner } = step;
    const data = step.data ?? {};
    switch (step.step) {
      case 'chosen': {
        const target = (data['picked'] as string[])[0];
        const options = SUITS.map((suit) => ({ id: suit, shows: { kind: 'suit' as const, suit }, effects: [skillStep(owner, 'named', { target, suit })] }));
        return [choiceOf(state, owner, { seatId: target, targetSeatId: target, verb: 'pick', options })];
      }
      case 'named': {
        const target = data['target'] as string;
        if (!isLiving(state, target) || handOf(state, owner.seatId).length === 0) return [];
        return [{ kind: 'MoveRandomCardEffect', fromZoneId: handZoneId(state, owner.seatId), toZoneId: handZoneId(state, target) }, skillStep(owner, 'taken', data)];
      }
      default: {
        // 'taken': show it, and the damage on a wrong suit.
        const target = data['target'] as string;
        const takenId = lastMoveBetween(state, handZoneId(state, owner.seatId), handZoneId(state, target));
        const taken = handOf(state, target).find((c) => c.instanceId === takenId);
        if (!taken) return [];
        const show = { kind: 'ShowCardEffect' as const, seatId: target, cardInstanceId: taken.instanceId, abilityId: owner.skillId };
        return taken.suit !== data['suit'] && isLiving(state, target) ? [show, skillDamage(owner, target)] : [show];
      }
    }
  },
};
```

and `WU_GENERALS` becomes:

```ts
export const WU_GENERALS: GeneralSkillSet[] = [
  { id: 'da-qiao', skills: [countryScene, displace] },
  { id: 'gan-ning', skills: [surprise] },
  { id: 'huang-gai', skills: [batteredBody] },
  { id: 'lu-meng', skills: [selfRestraint] },
  { id: 'lu-xun', skills: [humility, linkedCamps] },
  { id: 'sun-quan', skills: [reconsider, rescued] },
  { id: 'sun-shangxiang', skills: [marriage, armedConsorts] },
  { id: 'zhou-yu', skills: [braveGesture, sowRevolt] },
];
```

- [ ] **Step 4: Run the tests**

Run: `npx jest projects/content/src/lib/generals`
Expected: PASS.

- [ ] **Step 5: Run the whole suite and commit**

Run: `npx jest`
Expected: PASS.

```bash
git add projects/content
git commit -m "feat(content): Displace, Battered Body, Reconsider, Marriage and Sow Revolt

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 12: Qun — Matchless, First Aid, Green Vesicle, Sow Discord, Eclipse the Moon; every base skill defined

Rule text: General Skills spec, "Qun".

**Files:**
- Modify: `projects/content/src/lib/generals/qun.ts`
- Create: `projects/content/src/lib/generals/qun.spec.ts`, `projects/content/src/lib/generals/base.spec.ts`

**Interfaces:**
- Consumes: `doubleAnswers` (Task 4), `UseCardEffect` (Task 2), First Aid's conversion fields and the dying round's `mayRescue` (Task 3), the Task 4 skill helpers.
- Produces: `QUN_GENERALS`: `diao-chan` = `[sowDiscord, eclipseTheMoon]`, `hua-tuo` = `[firstAid, greenVesicle]`, `lu-bu` = `[matchless]`. Sow Discord's Duel is `{ as: 'duel', colour: 'none', physical: [] }`, used by the second seat on the first.

- [ ] **Step 1: Write the failing tests**

Create `projects/content/src/lib/generals/qun.spec.ts`:

```ts
import type { Effect, GameState } from 'engine';
import { abilityLog, askedAbout, card, handIds, harness, hp, kwMode, seat, table, TableOptions } from './skills.testing';

const h = harness();
const at = (seatId: string, main: string, revealed = true): TableOptions['generals'] => ({ [seatId]: [main, 'jia-xu', revealed] });
const offered = (s: GameState, seatId: string, skillId: string) =>
  h.legal(s, seatId).some((a) => a.kind === 'UseSkillAction' && a.owner.kind === 'general' && a.owner.skillId === skillId);

describe('Lu Bu — Matchless', () => {
  it('his Sha needs two Shan; an Eight Trigrams red judgment counts as one', () => {
    let s = h.play(table({ 'seat-a:hand': [card('s1', 'sha')], 'seat-b:hand': [card('n1', 'shan')], 'seat-b:equip': [card('et', 'eight-trigrams', 'spade', 2)], drawPile: [card('j', 'peach', 'heart')] }, { generals: at('seat-a', 'lu-bu') }), 's1', 'seat-b');
    s = h.use(s); // Eight Trigrams: red
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-b', allowedCardIds: ['shan'] });
    expect(hp(h.pass(s), 'seat-b')).toBe(3);
    expect(hp(h.respond(s, 'n1'), 'seat-b')).toBe(4);
  });

  it('in a Duel with him, the other seat plays two Sha each time', () => {
    let s = h.play(table({ 'seat-a:hand': [card('du', 'duel', 'spade', 1)], 'seat-b:hand': [card('b1', 'sha')] }, { generals: at('seat-a', 'lu-bu') }), 'du', 'seat-b');
    s = h.respond(s, 'b1');
    expect(s.pendingResponse?.respondingSeatId).toBe('seat-b');
    expect(hp(h.pass(s), 'seat-b')).toBe(3);
  });

  it('is off while Lu Bu is hidden: one Shan is enough', () => {
    const s = h.play(table({ 'seat-a:hand': [card('s1', 'sha')], 'seat-b:hand': [card('n1', 'shan')] }, { generals: at('seat-a', 'lu-bu', false) }), 's1', 'seat-b');
    expect(h.respond(s, 'n1').pendingResponse).toBeNull();
  });
});

describe('Hua Tuo — First Aid', () => {
  // seat-c drops to 0 HP in `owner`'s turn; Hua Tuo (seat-a) holds a red card and no Peach.
  const dying = (owner: string) => {
    const hit: Effect = { kind: 'DamageEffect', damage: { source: seat('seat-b'), target: seat('seat-c'), amount: 4, nature: 'normal' } };
    return harness(kwMode).run(table({ 'seat-a:hand': [card('r', 'shan', 'heart')] }, { owner, generals: at('seat-a', 'hua-tuo') }), [hit]);
  };

  it("outside his turn, uses a red card as a Peach to save a dying seat (he is asked without a Peach)", () => {
    const kw = harness(kwMode);
    let s = kw.pass(dying('seat-b')); // seat-c itself
    expect(s.pendingResponse?.respondingSeatId).toBe('seat-a');
    s = kw.select(kw.convert(s, 'seat-a', 'first-aid'), 'r');
    expect(hp(s, 'seat-c')).toBe(1);
  });

  it('not in his own turn', () => {
    const kw = harness(kwMode);
    const s = kw.pass(dying('seat-a'));
    expect(s.seats[2].eliminated).toBe(true);
  });
});

describe('Hua Tuo — Green Vesicle', () => {
  it('discards 1 hand card; a hurt seat of his choice, himself included, recovers 1 HP; once per turn', () => {
    let s = table({ 'seat-a:hand': [card('k', 'shan'), card('k2', 'shan')] }, { generals: at('seat-a', 'hua-tuo'), hp: { 'seat-a': 2, 'seat-c': 3 } });
    s = h.select(h.useSkill(s, 'seat-a', 'green-vesicle'), 'k');
    expect(s.pendingChoice?.options.map((o) => o.id)).toEqual(['seat-a', 'seat-c']);
    s = h.choose(s, 'seat-c');
    expect(hp(s, 'seat-c')).toBe(4);
    expect(offered(s, 'seat-a', 'green-vesicle')).toBe(false);
  });

  it('is not offered while nobody is hurt', () => {
    expect(offered(table({ 'seat-a:hand': [card('k', 'shan')] }, { generals: at('seat-a', 'hua-tuo') }), 'seat-a', 'green-vesicle')).toBe(false);
  });
});

describe('Diao Chan — Sow Discord', () => {
  const her = (o: TableOptions = {}, cards: Record<string, ReturnType<typeof card>[]> = {}) =>
    table({ 'seat-a:hand': [card('k', 'shan')], ...cards }, { ...o, generals: { ...at('seat-a', 'diao-chan'), ...o.generals } });

  it('discards 1 card and picks two other male seats: the second uses a Duel on the first', () => {
    let s = h.select(h.useSkill(her(), 'seat-a', 'sow-discord'), 'k');
    expect(s.pendingChoice?.options.map((o) => o.id)).toEqual(['seat-b', 'seat-c', 'seat-d']);
    s = h.choose(s, 'seat-b');
    expect(s.pendingChoice?.options.map((o) => o.id)).toEqual(['seat-c', 'seat-d']);
    s = h.choose(s, 'seat-c');
    expect(s.log.find((e) => e.kind === 'CardPlayedEvent')).toEqual({ kind: 'CardPlayedEvent', seatId: 'seat-c', card: { as: 'duel', colour: 'none', physical: [] }, targets: [seat('seat-b')] });
    expect(s.pendingResponse?.respondingSeatId).toBe('seat-b');
    const hit = h.pass(s);
    expect(hp(hit, 'seat-b')).toBe(3);
    expect(hit.log.find((e) => e.kind === 'DamageDealtEvent')).toMatchObject({ damage: { source: seat('seat-c') } });
  });

  it('is not offered without two other male seats', () => {
    expect(offered(her({ generals: { 'seat-c': ['xiao-qiao', 'sun-jian'], 'seat-d': ['xiao-qiao', 'sun-jian'] } }), 'seat-a', 'sow-discord')).toBe(false);
  });

  it('a seat the Duel can’t target (Empty City) is never the first pick', () => {
    const s = h.select(h.useSkill(her({ generals: { 'seat-b': ['zhuge-liang', 'liu-shan'] } }), 'seat-a', 'sow-discord'), 'k');
    expect(s.pendingChoice?.options.map((o) => o.id)).toEqual(['seat-c', 'seat-d']);
  });
});

describe('Diao Chan — Eclipse the Moon', () => {
  it('draws 1 at the start of her End Phase', () => {
    const s = h.act(table({ drawPile: [card('d1', 'shan')] }, { generals: at('seat-a', 'diao-chan') }), { kind: 'EndPhaseAction', seatId: 'seat-a' });
    expect(handIds(s, 'seat-a')).toEqual(['d1']);
    expect(abilityLog(s)).toEqual([expect.objectContaining({ abilityId: 'eclipse-the-moon', outcome: 'used' })]);
  });
});
```

Create `projects/content/src/lib/generals/base.spec.ts`:

```ts
import { generalsData } from '../../../data/generals';
import { skillIdOf } from '../display';
import { BASE_GENERAL_IDS, GENERAL_SKILLS } from './index';

describe('the base Generals', () => {
  it('define every skill in their data, in order, with matching Lord flags', () => {
    for (const id of BASE_GENERAL_IDS) {
      const defined = GENERAL_SKILLS.get(id) ?? [];
      const data = generalsData[id].skills;
      expect({ id, skills: defined.map((s) => s.id) }).toEqual({ id, skills: data.map((s) => skillIdOf(s.name)) });
      expect({ id, lord: defined.map((s) => !!s.lord) }).toEqual({ id, lord: data.map((s) => !!s.lord) });
    }
  });

  it('no expansion General has skills yet', () => {
    expect([...GENERAL_SKILLS.keys()].sort()).toEqual([...BASE_GENERAL_IDS].sort());
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx jest projects/content/src/lib/generals/qun.spec.ts projects/content/src/lib/generals/base.spec.ts`
Expected: FAIL (Qun is empty; base.spec names the three Qun Generals).

- [ ] **Step 3: Write the skills**

Replace `projects/content/src/lib/generals/qun.ts` with:

```ts
import type { CardInstance, ContentRegistry, GameState, PhaseChangedEvent, SkillDefinition, UsedCard } from 'engine';
import { colourOf, livingSeatOrderFrom } from 'engine';
import type { GeneralSkillSet } from './types';
import { handOf } from '../shared/queries';
import { untargetableBy } from '../shared/abilities';
import { seatGender } from '../shared/gender';
import { choiceOf, discardMoves, draw, heal, isHurt, isLiving, on, otherLivingSeatIds, ownCards, seatOptions, selectionOf, skillStep, used } from '../shared/skills';

// The Qun base Generals' skills (General Skills spec, "Qun"). Every skill acts
// for the `owner` the engine passes in, never by searching for its General.

const red = (card: CardInstance) => colourOf(card) === 'red';

// Matchless (compulsory): your Sha needs two Shan to dodge (an Eight Trigrams
// red judgment counts as one); in a Duel with you, the other seat plays two Sha
// each time it is its turn to play. Sha and Duel read the modifier.
export const matchless: SkillDefinition = { id: 'matchless', compulsory: true, modifiers: { doubleAnswers: true } };

// First Aid (conversion, respond, only outside your turn): any red card from
// your hand or equipment as a Peach.
export const firstAid: SkillDefinition = {
  id: 'first-aid',
  conversions: [{ id: 'first-aid', as: 'peach', cards: 1, from: 'hand-and-equipment', accepts: red, when: 'respond', outsideOwnTurnOnly: true }],
};

// Living seats below their max HP, you included, in turn order from you.
const hurtSeats = (state: GameState, seatId: string) => livingSeatOrderFrom(state, seatId).filter((id) => isHurt(state, id));

// Green Vesicle (active, once per turn): discard 1 hand card; a seat of your
// choice below its max HP, you included, recovers 1 HP.
export const greenVesicle: SkillDefinition = {
  id: 'green-vesicle',
  active: {
    usesPerTurn: 1,
    canUse: (state, { seatId }) => handOf(state, seatId).length > 0 && hurtSeats(state, seatId).length > 0,
    start: (state, { seatId, owner }) => [
      selectionOf(state, owner, { of: 'cards', eligibleIds: handOf(state, seatId).map((c) => c.instanceId), min: 1, max: 1, then: { kind: 'skill-step', step: skillStep(owner, 'discarded') }, onCancel: [] }),
    ],
  },
  onStep: (state, step) => {
    const { owner } = step;
    if (step.step === 'discarded') return [...discardMoves(state, (step.data?.['picked'] as string[]) ?? []), skillStep(owner, 'pick')];
    const seats = hurtSeats(state, owner.seatId);
    return seats.length > 0 ? [choiceOf(state, owner, { verb: 'pick', options: seatOptions(seats, (id) => [heal(id)]) })] : [];
  },
};

// Other living male seats, but `except`.
const males = (state: GameState, seatId: string, registry: ContentRegistry, except: string[] = []) =>
  otherLivingSeatIds(state, seatId).filter((id) => !except.includes(id) && seatGender(state, id, registry) === 'male');

// Seats that can be the first pick: male, a Duel can target them, and another male is left to challenge them.
const challengeable = (state: GameState, seatId: string, registry: ContentRegistry) =>
  males(state, seatId, registry).filter((id) => !untargetableBy(state, id, 'duel', registry) && males(state, seatId, registry, [id]).length > 0);

// The Duel Sow Discord makes: no physical card.
const SOW_DISCORD_DUEL: UsedCard = { as: 'duel', colour: 'none', physical: [] };

// Sow Discord (active, once per turn): discard 1 card and choose two other male
// seats, in order. The second uses a Duel on the first, as if it had played
// one (the usual Wuxie check and Duel rules).
export const sowDiscord: SkillDefinition = {
  id: 'sow-discord',
  active: {
    usesPerTurn: 1,
    canUse: (state, { seatId }, registry) => ownCards(state, seatId, true).length > 0 && challengeable(state, seatId, registry).length > 0,
    start: (state, { seatId, owner }) => {
      const cards = ownCards(state, seatId, true).map((c) => c.instanceId);
      return [selectionOf(state, owner, { of: 'cards', eligibleIds: cards, min: 1, max: 1, then: { kind: 'skill-step', step: skillStep(owner, 'discarded') }, onCancel: [] })];
    },
  },
  onStep: (state, step, registry) => {
    const { owner } = step;
    switch (step.step) {
      case 'discarded':
        return [...discardMoves(state, (step.data?.['picked'] as string[]) ?? []), skillStep(owner, 'first')];
      case 'first': {
        const firsts = challengeable(state, owner.seatId, registry);
        return firsts.length > 0 ? [choiceOf(state, owner, { verb: 'pick', options: seatOptions(firsts, (id) => [skillStep(owner, 'second', { first: id })]) })] : [];
      }
      default: {
        const first = step.data?.['first'] as string;
        const seconds = males(state, owner.seatId, registry, [first]);
        if (!isLiving(state, first) || seconds.length === 0) return [];
        const duelFrom = (id: string) => [{ kind: 'UseCardEffect' as const, seatId: id, card: SOW_DISCORD_DUEL, targets: [{ kind: 'seat' as const, seatId: first }] }];
        return [choiceOf(state, owner, { verb: 'pick', targetSeatId: first, options: seatOptions(seconds, duelFrom) })];
      }
    }
  },
};

// Eclipse the Moon (compulsory): at the start of your End Phase, you draw 1.
export const eclipseTheMoon: SkillDefinition = {
  id: 'eclipse-the-moon',
  compulsory: true,
  triggers: [
    on<PhaseChangedEvent>('after:PhaseChangedEvent', {
      condition: (_state, event, owner) => event.phase === 'End' && event.seatId === owner.seatId,
      effect: (_state, _event, owner) => [used(owner), draw(owner.seatId, 1)],
    }),
  ],
};

export const QUN_GENERALS: GeneralSkillSet[] = [
  { id: 'diao-chan', skills: [sowDiscord, eclipseTheMoon] },
  { id: 'hua-tuo', skills: [firstAid, greenVesicle] },
  { id: 'lu-bu', skills: [matchless] },
];
```

- [ ] **Step 4: Run the tests**

Run: `npx jest projects/content/src/lib/generals`
Expected: PASS. If `base.spec.ts` fails on an order, reorder the force file's `skills` array to the data's order (the data is the source).

- [ ] **Step 5: Run the whole suite and commit**

Run: `npx jest`
Expected: PASS. The sim's property test now plays with real skills; if it fails, read the failing seed's message (a stall, a resting-state violation, a step budget) and fix the skill it names before moving on — Task 14 adds the skill-specific checks.

```bash
git add projects/content
git commit -m "feat(content): Matchless, First Aid, Green Vesicle, Sow Discord and Eclipse the Moon; every base skill defined

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 13: Bots — every skill by the spec's rules

Rule text: General Skills spec, "Bots". The bot reads only its redacted view, the engine's legal actions and the registry; it names skills by id, as it already names cards.

**Files:**
- Create: `projects/bots/src/lib/helpers.ts`, `projects/bots/src/lib/skills.ts`, `projects/bots/src/lib/skills.spec.ts`
- Modify: `projects/bots/src/lib/rule-based.ts`

**Interfaces:**
- Consumes: `conversionsOf`, `conversionCards`, `sameAbilityOwner`, `abilityUseKey`, `colourOf` (engine).
- Produces:
  - `helpers.ts` (moved out of rule-based.ts, unchanged): `definitionIdOf`, `isAlly`, `keepRank`, `leastUseful`, `mayReveal`; plus `handCards(view, seat)`, `ownCards(view, seat)`.
  - `skills.ts`: `wantsSkill(view, me, choice, registry): boolean | null`, `skillSelection(view, me, selection, registry): string[] | 'cancel' | null`, `skillChoice(view, me, choice): string | null`, `pickActiveSkill(view, me, legal, registry, group: 'early' | 'late'): UseSkill | undefined`, `conversionSpare(view, me, action, registry): boolean`, `devilCard(view, me, judgment, registry): string | null`, `genderOf(seat, registry)`.

- [ ] **Step 1: Move the shared helpers**

Create `projects/bots/src/lib/helpers.ts` and move into it, unchanged, `definitionIdOf`, `isAlly`, `keepRank`, `leastUseful` and `mayReveal` from `rule-based.ts` (export each). Add:

```ts
// A seat's hand, as the bot's view has it (its own face up).
export function handCards(view: GameState, seat: Seat): CardInstance[] {
  return view.zones.find((z) => z.id === seat.hand.zoneId)?.cards ?? [];
}

// A seat's hand, then its worn cards.
export function ownCards(view: GameState, seat: Seat): CardInstance[] {
  return [...handCards(view, seat), ...(view.zones.find((z) => z.id === seat.equipped.zoneId)?.cards ?? [])];
}
```

In `rule-based.ts` import them from `./helpers` and delete the local copies. Run `npx jest projects/bots` — Expected: PASS (a pure move).

- [ ] **Step 2: Write the failing tests**

Create `projects/bots/src/lib/skills.spec.ts`:

```ts
import { advanceToDecision, getLegalActions, redactStateForSeat, resolve } from 'engine';
import type { Action, CardInstance, Effect, GameModeDefinition, GameState, GeneralOwner, Kingdom, PendingChoice, PendingSelection } from 'engine';
import { buildContentRegistry } from 'content';
import { ruleBasedPolicy } from './rule-based';

const registry = buildContentRegistry();
const mode: GameModeDefinition = { id: 'stub', setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'], checkWinCondition: () => null, triggers: [] };
const ctx = { registry, mode };
const card = (instanceId: string, definitionId: string, suit: CardInstance['suit'] = 'spade', rank = 7): CardInstance => ({ instanceId, definitionId, suit, rank });

interface Options {
  generals?: Record<string, [string, string, boolean?]>;
  kingdoms?: Record<string, Kingdom>;
  hp?: Record<string, number>;
  maxHp?: Record<string, number>;
  owner?: string;
}
// Four seats (Wei, Shu, Wu, Qun by default) at 4/4 HP, all Generals revealed; seat-a's Play Phase.
function table(cards: Record<string, CardInstance[]> = {}, o: Options = {}): GameState {
  const ids = ['seat-a', 'seat-b', 'seat-c', 'seat-d'];
  const kingdoms: Kingdom[] = ['Wei', 'Shu', 'Wu', 'Qun'];
  return {
    seats: ids.map((id, index) => {
      const [main, deputy, revealed = true] = o.generals?.[id] ?? ['cao-ren', 'dong-zhuo'];
      return {
        id, index, kingdom: o.kingdoms?.[id] ?? kingdoms[index], eliminated: false,
        generals: { main: { generalDefinitionId: main, revealed }, deputy: { generalDefinitionId: deputy, revealed } },
        combinedHp: o.hp?.[id] ?? 4, maxCombinedHp: o.maxHp?.[id] ?? 4,
        hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` },
      };
    }),
    players: [], turn: { turnNumber: 1, ownerSeatId: o.owner ?? 'seat-a', extraTurnStack: [] }, phase: 'Play',
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: cards['drawPile'] ?? [] },
      { id: 'discardPile', kind: 'discardPile', cards: [] },
      { id: 'processing', kind: 'processing', cards: cards['processing'] ?? [] },
      ...ids.flatMap((id) => [
        { id: `${id}:hand`, kind: 'hand' as const, ownerSeatId: id, cards: cards[`${id}:hand`] ?? [] },
        { id: `${id}:equip`, kind: 'equip' as const, ownerSeatId: id, cards: cards[`${id}:equip`] ?? [] },
        { id: `${id}:judgment`, kind: 'judgment' as const, ownerSeatId: id, cards: [] },
      ]),
    ],
    pendingResponse: null, log: [], rng: { seed: 1, counter: 0 }, result: null, generalSelection: null,
  };
}

const actor = (s: GameState) => s.pendingChoice?.seatId ?? s.pendingSelection?.seatId ?? s.pendingResponse?.respondingSeatId ?? s.turn.ownerSeatId;
const decide = (s: GameState): Action => {
  const seatId = actor(s);
  return ruleBasedPolicy.decide(redactStateForSeat(s, seatId), seatId, getLegalActions(s, seatId, registry), registry, null).action;
};
const act = (s: GameState, action: Action) => resolve(s, action, ctx).state;
const general = (seatId: string, skillId: string): GeneralOwner => ({ kind: 'general', seatId, slot: 'main', skillId });
// An ask of `skillId` for seat-a, about `targetSeatId`; Don't queues `otherwise`.
const asking = (s: GameState, skillId: string, targetSeatId?: string, otherwise: Effect[] = []): GameState => {
  const choice: PendingChoice = {
    id: 'ask', seatId: 'seat-a', verb: 'use',
    reason: { kind: 'ability', owner: general('seat-a', skillId), abilityId: skillId, ...(targetSeatId ? { targetSeatId } : {}) },
    options: [{ id: 'use', shows: { kind: 'use' }, effects: [] }, { id: 'decline', shows: { kind: 'decline' }, effects: otherwise }],
  };
  return { ...s, pendingChoice: choice };
};
const picked = (a: Action) => (a.kind === 'ChooseOptionAction' ? a.optionId : a.kind === 'SelectAction' ? a.ids : a.kind);
const useSkill = (s: GameState, skillId: string) => {
  const action = getLegalActions(s, 'seat-a', registry).find((a) => a.kind === 'UseSkillAction' && a.owner.kind === 'general' && a.owner.skillId === skillId)!;
  return act(s, action);
};

describe('may-skills the bot always uses', () => {
  it.each(['evil-hero', 'feedback', 'heavens-envy', 'bestowed-rouse', 'gathering-wisdom', 'brave-gesture', 'self-restraint', 'river-goddess', 'iron-cavalry', 'astrology'])('%s', (skillId) => {
    expect(picked(decide(asking(table(), skillId)))).toBe('use');
  });

  it('keeps both Bestowed Rouse cards (cancels the giving)', () => {
    const selection: PendingSelection = { id: 'sel', seatId: 'seat-a', reason: { kind: 'ability', owner: general('seat-a', 'bestowed-rouse'), abilityId: 'bestowed-rouse' }, of: 'cards', eligibleIds: ['d1'], min: 1, max: 1, then: { kind: 'give', toSeatIds: ['seat-b'] }, onCancel: [] };
    expect(picked(decide({ ...table({ 'seat-a:hand': [card('d1', 'shan')] }), pendingSelection: selection }))).toBe('CancelSelectionAction');
  });
});

describe('Unyielding', () => {
  it('only against a non-ally; the target discards 2 with more than 3 hand cards, else takes the damage above 1 HP', () => {
    expect(picked(decide(asking(table(), 'unyielding', 'seat-b')))).toBe('use');
    expect(picked(decide(asking(table({}, { kingdoms: { 'seat-b': 'Wei' } }), 'unyielding', 'seat-b')))).toBe('decline');
    const choice = (hand: number, combinedHp: number): GameState => {
      const s = table({ 'seat-b:hand': Array.from({ length: hand }, (_, i) => card(`h${i}`, 'shan')) }, { hp: { 'seat-b': combinedHp } });
      return { ...s, pendingChoice: { id: 'u', seatId: 'seat-b', verb: 'pick', reason: { kind: 'ability', owner: general('seat-a', 'unyielding'), abilityId: 'unyielding', targetSeatId: 'seat-b' }, options: [{ id: 'discard', shows: { kind: 'label', text: 'Discard 2 Hand Cards' }, effects: [] }, { id: 'damage', shows: { kind: 'label', text: 'Take 1 Damage' }, effects: [] }] } };
    };
    expect(picked(decide(choice(4, 4)))).toBe('discard');
    expect(picked(decide(choice(2, 3)))).toBe('damage');
    expect(picked(decide(choice(2, 1)))).toBe('discard');
  });
});

describe('the Draw Phase', () => {
  it('Raid when two non-allies hold hand cards', () => {
    expect(picked(decide(asking(table({ 'seat-b:hand': [card('x', 'shan')], 'seat-c:hand': [card('y', 'shan')] }), 'raid')))).toBe('use');
    expect(picked(decide(asking(table({ 'seat-b:hand': [card('x', 'shan')] }), 'raid')))).toBe('decline');
  });

  it('Bare the Chest when holding 2 or more Sha', () => {
    expect(picked(decide(asking(table({ 'seat-a:hand': [card('s1', 'sha'), card('s2', 'sha')] }), 'bare-the-chest')))).toBe('use');
    expect(picked(decide(asking(table({ 'seat-a:hand': [card('s1', 'sha')] }), 'bare-the-chest')))).toBe('decline');
  });
});

describe('Devil', () => {
  // A Capture judgment on `judgedSeatId`, turned up as a club (it lands).
  const capture = { as: 'capture', colour: 'black' as const, suit: 'spade' as const, rank: 6, physical: [card('cp', 'capture', 'spade', 6)] };
  const shown = (judgedSeatId: string): Effect => ({ kind: 'JudgmentShownEffect', judgment: { seatId: judgedSeatId, reader: { kind: 'card', card: capture }, card: card('j', 'sha', 'club', 9) }, acted: ['seat-a'] });
  const hand = [card('p', 'peach', 'heart', 1), card('h', 'shan', 'heart', 2), card('k', 'sha', 'spade', 3)];

  it('replaces a judgment that hurts itself or an ally, with the least useful card that flips it', () => {
    const s = asking(table({ 'seat-a:hand': hand, processing: [card('j', 'sha', 'club', 9)] }), 'devil', 'seat-a', [shown('seat-a')]);
    expect(picked(decide(s))).toBe('use');
    const selection: PendingSelection = {
      id: 'sel', seatId: 'seat-a', reason: { kind: 'ability', owner: general('seat-a', 'devil'), abilityId: 'devil' }, of: 'cards', eligibleIds: ['p', 'h', 'k'], min: 1, max: 1,
      then: { kind: 'replace-judgment', judgment: (shown('seat-a') as Extract<Effect, { kind: 'JudgmentShownEffect' }>).judgment, owner: general('seat-a', 'devil'), abilityId: 'devil' }, onCancel: [],
    };
    expect(picked(decide({ ...table({ 'seat-a:hand': hand }), pendingSelection: selection }))).toEqual(['h']);
  });

  it('lets a judgment that hurts a non-ally stand', () => {
    expect(picked(decide(asking(table({ 'seat-a:hand': hand }), 'devil', 'seat-b', [shown('seat-b')])))).toBe('decline');
  });
});

describe('active skills in the Play Phase', () => {
  it('Battered Body above 3 HP, or above 2 holding a Peach', () => {
    // At full HP (max 3 in the second case) so the bot doesn't just eat the Peach.
    const huangGai = (combinedHp: number, hand: CardInstance[] = [], maxHp = 4) =>
      table({ 'seat-a:hand': hand, drawPile: [card('d1', 'shan'), card('d2', 'shan')] }, { generals: { 'seat-a': ['huang-gai', 'sun-jian'] }, kingdoms: { 'seat-a': 'Wu' }, hp: { 'seat-a': combinedHp }, maxHp: { 'seat-a': maxHp } });
    expect(decide(huangGai(4))).toMatchObject({ kind: 'UseSkillAction', owner: { skillId: 'battered-body' } });
    expect(decide(huangGai(3, [card('p', 'peach', 'heart')], 3))).toMatchObject({ kind: 'UseSkillAction' });
    expect(decide(huangGai(3)).kind).toBe('EndPhaseAction');
  });

  it('Reconsider discards every hand card ranked below Shan, never a Peach or worn cards', () => {
    const s = table({ 'seat-a:hand': [card('p', 'peach', 'heart'), card('n', 'shan'), card('x', 'harvest', 'heart', 3), card('s', 'sha')], 'seat-a:equip': [card('cb', 'crossbow', 'diamond', 1)] }, { generals: { 'seat-a': ['sun-quan', 'sun-jian'] }, kingdoms: { 'seat-a': 'Wu' } });
    const selecting = useSkill(s, 'reconsider');
    expect(picked(decide(selecting))).toEqual(['x', 's']);
  });

  it('Kindness gives the cards above 3 to a revealed ally', () => {
    const hand = ['k1', 'k2', 'k3', 'k4', 'k5'].map((id) => card(id, 'shan'));
    const s = table({ 'seat-a:hand': hand }, { generals: { 'seat-a': ['liu-bei', 'wei-yan'], 'seat-b': ['huang-zhong', 'jiang-wei'] }, kingdoms: { 'seat-a': 'Shu', 'seat-b': 'Shu' } });
    expect(decide(s)).toMatchObject({ kind: 'UseSkillAction', owner: { skillId: 'kindness' } });
    const selecting = useSkill(s, 'kindness');
    expect(picked(decide(selecting))).toHaveLength(2);
    const giving = act(selecting, decide(selecting));
    expect(picked(decide(giving))).toBe('seat-b');
  });

  it('Sow Revolt at the non-ally with the lowest HP', () => {
    // seat-c is Wu too (an ally); seat-d is the weakest non-ally.
    const s = table({ 'seat-a:hand': [card('k', 'shan')] }, { generals: { 'seat-a': ['zhou-yu', 'sun-jian'] }, kingdoms: { 'seat-a': 'Wu' }, hp: { 'seat-c': 1, 'seat-d': 2 } });
    const selecting = useSkill(s, 'sow-revolt');
    expect(picked(decide(selecting))).toEqual(['seat-d']);
  });

  it('Green Vesicle heals itself first', () => {
    const s = table({ 'seat-a:hand': [card('k', 'shan')] }, { generals: { 'seat-a': ['hua-tuo', 'jia-xu'] }, kingdoms: { 'seat-a': 'Qun' }, hp: { 'seat-a': 2, 'seat-b': 2 } });
    expect(decide(s)).toMatchObject({ kind: 'UseSkillAction', owner: { skillId: 'green-vesicle' } });
    const choosing = act(useSkill(s, 'green-vesicle'), { kind: 'SelectAction', seatId: 'seat-a', selectionId: useSkill(s, 'green-vesicle').pendingSelection!.id, ids: ['k'] });
    expect(picked(decide(choosing))).toBe('seat-a');
  });
});

describe('Sow Discord’s picks', () => {
  // seat-a shares its kingdom with none of the others, so all three are non-allies.
  const pick = (targetSeatId?: string): GameState => ({
    ...table({}, { hp: { 'seat-b': 3, 'seat-c': 2, 'seat-d': 4 } }),
    pendingChoice: {
      id: 'p', seatId: 'seat-a', verb: 'pick',
      reason: { kind: 'ability', owner: general('seat-a', 'sow-discord'), abilityId: 'sow-discord', ...(targetSeatId ? { targetSeatId } : {}) },
      options: ['seat-b', 'seat-c', 'seat-d'].filter((id) => id !== targetSeatId).map((id) => ({ id, shows: { kind: 'seat' as const, seatId: id }, effects: [] })),
    },
  });

  it('the first is the weakest non-ally; the second, the likelier winner (more HP)', () => {
    expect(picked(decide(pick()))).toBe('seat-c');
    expect(picked(decide(pick('seat-c')))).toBe('seat-d');
  });
});

describe('Displace', () => {
  it('with a card to spare and a non-ally to move the Sha to', () => {
    expect(picked(decide(asking(table({ 'seat-a:hand': [card('x', 'harvest', 'heart', 3)] }), 'displace', 'seat-b')))).toBe('use');
    expect(picked(decide(asking(table({ 'seat-a:hand': [card('p', 'peach', 'heart')] }), 'displace', 'seat-b')))).toBe('decline');
  });
});

describe('Sow Revolt’s suit', () => {
  it('names the suit Zhou Yu has shown least, hearts on a tie', () => {
    const s = table();
    const played = { kind: 'CardPlayedEvent' as const, seatId: 'seat-b', card: { as: 'sha', colour: 'black' as const, physical: [card('a', 'sha', 'spade'), card('b', 'sha', 'heart')] }, targets: [] };
    const naming = (log: GameState['log']): GameState => ({
      ...s, log,
      pendingChoice: { id: 'n', seatId: 'seat-a', verb: 'pick', reason: { kind: 'ability', owner: general('seat-b', 'sow-revolt'), abilityId: 'sow-revolt', targetSeatId: 'seat-a' }, options: (['spade', 'heart', 'club', 'diamond'] as const).map((suit) => ({ id: suit, shows: { kind: 'suit' as const, suit }, effects: [] })) },
    });
    expect(picked(decide(naming([])))).toBe('heart');
    expect(picked(decide(naming([played])))).toBe('club');
  });
});

describe('conversions', () => {
  it('Fighting Saint as a Sha when no real Sha is in hand, never spending a Peach', () => {
    const guanYu = (hand: CardInstance[]) => table({ 'seat-a:hand': hand }, { generals: { 'seat-a': ['guan-yu', 'wei-yan'] }, kingdoms: { 'seat-a': 'Shu' } });
    expect(decide(guanYu([card('h', 'shan', 'heart')]))).toMatchObject({ kind: 'UseConversionAction', via: { conversionId: 'fighting-saint' } });
    expect(decide(guanYu([card('p', 'peach', 'heart')])).kind).toBe('EndPhaseAction');
  });

  it('a hidden General’s conversion only when the bot may reveal', () => {
    const hidden = table({ 'seat-a:hand': [card('h', 'shan', 'heart')] }, { generals: { 'seat-a': ['guan-yu', 'wei-yan', false] }, kingdoms: { 'seat-a': 'Shu' }, hp: { 'seat-a': 3 } });
    expect(decide(hidden).kind).toBe('EndPhaseAction');
  });
});
```

- [ ] **Step 3: Run them to see them fail**

Run: `npx jest projects/bots/src/lib/skills.spec.ts`
Expected: FAIL — the bot declines every skill ask and never uses an active skill.

- [ ] **Step 4: The skill rules**

Create `projects/bots/src/lib/skills.ts`:

```ts
import type { Action, CardInstance, ContentRegistry, Effect, GameState, Judgment, PendingChoice, PendingSelection, Seat } from 'engine';
import { abilityUseKey, colourOf, conversionCards, conversionsOf, sameAbilityOwner } from 'engine';
import { definitionIdOf, handCards, isAlly, keepRank, leastUseful, mayReveal, ownCards } from './helpers';

// The General Skills spec's bot rules, skill by skill.

type UseSkill = Extract<Action, { kind: 'UseSkillAction' }>;
type UseConversion = Extract<Action, { kind: 'UseConversionAction' }>;

const living = (view: GameState) => view.seats.filter((s) => !s.eliminated);
const others = (view: GameState, me: Seat) => living(view).filter((s) => s.id !== me.id);
const hurt = (seat: Seat) => seat.combinedHp < seat.maxCombinedHp;
const byLowestHp = (seats: Seat[]) => [...seats].sort((a, b) => a.combinedHp - b.combinedHp || a.index - b.index);
const byHighestHp = (seats: Seat[]) => [...seats].sort((a, b) => b.combinedHp - a.combinedHp || a.index - b.index);
const handSize = (view: GameState, seat: Seat) => view.zones.find((z) => z.id === seat.hand.zoneId)?.cards.length ?? 0;

// A seat's gender as the table sees it: Main's while revealed, else Deputy's, else none.
export function genderOf(seat: Seat, registry: ContentRegistry): 'male' | 'female' | null {
  const generals = seat.generals;
  if (!generals) return null;
  const shown = generals.main.revealed ? generals.main : generals.deputy.revealed ? generals.deputy : null;
  return (shown && registry.generals.get(shown.generalDefinitionId)?.gender) ?? null;
}

// Whether a judgment card is good for the judged seat, by what reads it; null for a reader the bot doesn't know.
function goodForJudged(judgment: Judgment, card: CardInstance): boolean | null {
  const reader = judgment.reader.kind === 'card' ? judgment.reader.card.as : judgment.reader.owner.skillId;
  switch (reader) {
    case 'capture': return card.suit === 'heart';
    case 'starvation': return card.suit === 'club';
    case 'lightning': return !(card.suit === 'spade' && card.rank >= 2 && card.rank <= 9);
    case 'eight-trigrams':
    case 'iron-cavalry': return colourOf(card) === 'red';
    case 'river-goddess': return colourOf(card) === 'black';
    case 'unyielding': return card.suit !== 'heart';
    default: return null;
  }
}

// The hand card Devil replaces `judgment`'s card with, or null: only when the
// card stands against the bot's side (itself or an ally judged: bad for them;
// a non-ally: good for it), with the least useful card that flips it.
export function devilCard(view: GameState, me: Seat, judgment: Judgment, registry: ContentRegistry): string | null {
  const judged = view.seats.find((s) => s.id === judgment.seatId);
  const now = goodForJudged(judgment, judgment.card);
  if (!judged || now === null) return null;
  const wantGood = judged.id === me.id || isAlly(me, judged);
  if (now === wantGood) return null;
  const flips = handCards(view, me).filter((c) => goodForJudged(judgment, c) === wantGood).map((c) => c.instanceId);
  return flips.length > 0 ? leastUseful(view, registry, flips)[0] : null;
}

const declined = (choice: PendingChoice): Effect | undefined => choice.options.find((o) => o.id === 'decline')?.effects[0];

// Whether to use a General's optional skill (an ask); null: not a skill ask.
export function wantsSkill(view: GameState, me: Seat, choice: PendingChoice, registry: ContentRegistry): boolean | null {
  if (choice.reason.kind !== 'ability' || choice.reason.owner.kind !== 'general') return null;
  const target = view.seats.find((s) => s.id === (choice.reason as { targetSeatId?: string }).targetSeatId);
  switch (choice.reason.abilityId) {
    case 'evil-hero':
    case 'feedback':
    case 'heavens-envy':
    case 'bestowed-rouse':
    case 'gathering-wisdom':
    case 'brave-gesture':
    case 'self-restraint':
    case 'river-goddess':
    case 'iron-cavalry':
    case 'astrology':
      return true;
    case 'unyielding':
      return !!target && !isAlly(me, target);
    case 'raid':
      return others(view, me).filter((s) => !isAlly(me, s) && handSize(view, s) > 0).length >= 2;
    case 'bare-the-chest':
      return handCards(view, me).filter((c) => c.definitionId === 'sha').length >= 2;
    case 'devil': {
      const shown = declined(choice);
      return shown?.kind === 'JudgmentShownEffect' && devilCard(view, me, shown.judgment, registry) !== null;
    }
    case 'displace':
      // A card to spare (ranked below Shan) and a non-ally other than the Sha's user to move it to.
      return ownCards(view, me).some((c) => keepRank(view, registry, c.instanceId) < 3) && others(view, me).some((s) => !isAlly(me, s) && s.id !== target?.id);
    default:
      return null;
  }
}

// What to pick in a skill's selection: ids, 'cancel', or null (not a skill selection the bot knows).
export function skillSelection(view: GameState, me: Seat, selection: PendingSelection, registry: ContentRegistry): string[] | 'cancel' | null {
  if (selection.reason.kind !== 'ability' || selection.reason.owner.kind !== 'general') return null;
  const owner = selection.reason.owner;
  const eligible = selection.eligibleIds;
  const hand = new Set(handCards(view, me).map((c) => c.instanceId));
  switch (selection.reason.abilityId) {
    case 'devil': {
      const id = selection.then.kind === 'replace-judgment' ? devilCard(view, me, selection.then.judgment, registry) : null;
      return id ? [id] : 'cancel';
    }
    case 'displace': {
      const spare = leastUseful(view, registry, eligible).filter((id) => keepRank(view, registry, id) < 3);
      return spare.length > 0 ? [spare[0]] : 'cancel';
    }
    case 'kindness': {
      const given = view.turn.abilityUses?.[`${abilityUseKey(owner)}/given`] ?? 0;
      const count = Math.max(eligible.length - 3, hurt(me) && given < 2 ? 2 - given : 0, 1);
      return leastUseful(view, registry, eligible).slice(0, Math.min(count, eligible.length));
    }
    case 'reconsider': {
      const below = eligible.filter((id) => hand.has(id) && keepRank(view, registry, id) < 3);
      return below.length > 0 ? below : 'cancel';
    }
    case 'marriage':
    case 'green-vesicle':
    case 'sow-discord':
      return leastUseful(view, registry, eligible).slice(0, selection.min);
    case 'sow-revolt': {
      const seats = eligible.map((id) => view.seats.find((s) => s.id === id)!).filter(Boolean);
      return [(byLowestHp(seats.filter((s) => !isAlly(me, s)))[0] ?? seats[0]).id];
    }
    case 'bestowed-rouse':
      return 'cancel'; // keep both cards
    default:
      return null;
  }
}

const SUIT_ORDER: CardInstance['suit'][] = ['heart', 'spade', 'club', 'diamond'];

// The suit `seatId` has shown least this game (cards it played, and cards
// shown from it); hearts first on a tie.
function leastShownSuit(view: GameState, seatId: string): CardInstance['suit'] {
  const seen: Record<string, number> = {};
  for (const event of view.log) {
    if (event.kind === 'CardPlayedEvent' && event.seatId === seatId) for (const c of event.card.physical) seen[c.suit] = (seen[c.suit] ?? 0) + 1;
  }
  return [...SUIT_ORDER].sort((a, b) => (seen[a] ?? 0) - (seen[b] ?? 0))[0];
}

// The option to pick in a skill's choice of a seat, suit or label (or who gets
// given cards); null when it isn't one the bot knows.
export function skillChoice(view: GameState, me: Seat, choice: PendingChoice): string | null {
  if (choice.reason.kind !== 'ability' || choice.reason.owner.kind !== 'general') return null;
  const seats = choice.options.flatMap((o) => (o.shows.kind === 'seat' ? [view.seats.find((s) => s.id === (o.shows as { seatId: string }).seatId)!] : []));
  const ally = seats.find((s) => s.id !== me.id && isAlly(me, s));
  const firstNonAlly = byLowestHp(seats.filter((s) => s.id !== me.id && !isAlly(me, s)))[0];
  switch (choice.reason.abilityId) {
    case 'kindness':
    case 'bestowed-rouse':
    case 'marriage':
      return (ally ?? seats[0])?.id ?? null;
    case 'green-vesicle':
      return (seats.find((s) => s.id === me.id) ?? ally ?? seats[0])?.id ?? null;
    case 'displace':
      return (firstNonAlly ?? seats[0])?.id ?? null;
    case 'sow-discord':
      // The first pick (no target yet): a non-ally; the second: the likelier winner.
      return (choice.reason.targetSeatId ? byHighestHp(seats)[0] : (firstNonAlly ?? seats[0]))?.id ?? null;
    case 'sow-revolt':
      return leastShownSuit(view, choice.reason.owner.seatId);
    case 'unyielding': {
      const pick = handSize(view, me) > 3 ? 'discard' : me.combinedHp > 1 ? 'damage' : 'discard';
      return choice.options.some((o) => o.id === pick) ? pick : choice.options[0].id;
    }
    default:
      return null;
  }
}

// Whether the bot uses `skillId` now, in its Play Phase.
function wantsActive(view: GameState, me: Seat, skillId: string, registry: ContentRegistry): boolean {
  const hand = handCards(view, me);
  const spare = hand.filter((c) => keepRank(view, registry, c.instanceId) < 4);
  const allies = others(view, me).filter((s) => isAlly(me, s));
  switch (skillId) {
    case 'battered-body':
      return me.combinedHp > 3 || (me.combinedHp > 2 && hand.some((c) => c.definitionId === 'peach'));
    case 'reconsider':
      return hand.some((c) => keepRank(view, registry, c.instanceId) < 3);
    case 'green-vesicle':
      return spare.length > 0 && (hurt(me) || allies.some(hurt));
    case 'marriage':
      return spare.length >= 2 && (hurt(me) || allies.some((s) => hurt(s) && genderOf(s, registry) === 'male'));
    case 'sow-revolt':
      return others(view, me).some((s) => !isAlly(me, s));
    case 'sow-discord': {
      const males = others(view, me).filter((s) => genderOf(s, registry) === 'male');
      return males.length >= 2 && males.some((s) => !isAlly(me, s));
    }
    case 'kindness': {
      const owner = { kind: 'general' as const, seatId: me.id, slot: 'main' as const, skillId };
      const given = (['main', 'deputy'] as const).reduce((n, slot) => n + (view.turn.abilityUses?.[`${abilityUseKey({ ...owner, slot })}/given`] ?? 0), 0);
      return allies.length > 0 && (hand.length > 3 || (hurt(me) && given < 2 && hand.length >= 2));
    }
    default:
      return false;
  }
}

const ACTIVE_ORDER = { early: ['battered-body', 'reconsider', 'green-vesicle', 'marriage'], late: ['sow-revolt', 'sow-discord', 'kindness'] } as const;

// The active skill to use now from `group`, if any: offered, wanted, and its
// General revealed or the bot willing to reveal it.
export function pickActiveSkill(view: GameState, me: Seat, legal: Action[], registry: ContentRegistry, group: 'early' | 'late'): UseSkill | undefined {
  const offered = legal.filter((a): a is UseSkill => a.kind === 'UseSkillAction' && a.owner.kind === 'general');
  for (const skillId of ACTIVE_ORDER[group]) {
    const action = offered.find((a) => a.owner.kind === 'general' && a.owner.skillId === skillId);
    if (!action || action.owner.kind !== 'general') continue;
    const revealed = !!me.generals?.[action.owner.slot].revealed;
    if ((revealed || mayReveal(me)) && wantsActive(view, me, skillId, registry)) return action;
  }
  return undefined;
}

// Whether a conversion is worth it: the bot may reveal its General if needed,
// and the least useful cards it would take hold no Peach.
export function conversionSpare(view: GameState, me: Seat, action: UseConversion, registry: ContentRegistry): boolean {
  const owned = conversionsOf(view, me.id, registry).find((o) => o.conversion.id === action.via.conversionId && sameAbilityOwner(o.owner, action.via.owner));
  if (!owned || (owned.needsReveal && !mayReveal(me))) return false;
  const cards = leastUseful(view, registry, conversionCards(view, me.id, owned.conversion).map((c) => c.instanceId)).slice(0, owned.conversion.cards);
  return cards.length === owned.conversion.cards && !cards.some((id) => definitionIdOf(view, id) === 'peach');
}

// The conversion abilities whose card selection the bot fills (least useful first).
export const CONVERSION_SKILLS: ReadonlySet<string> = new Set(['fighting-saint', 'dragon-courage', 'overturned-country', 'first-aid', 'country-scene', 'surprise']);
```

Note: `keepRank` and `leastUseful` read the card's definition id through the view; a worn card is found there too.

- [ ] **Step 5: Wire it into the policy**

In `projects/bots/src/lib/rule-based.ts`:

1. Import `CONVERSION_SKILLS, conversionSpare, pickActiveSkill, skillChoice, skillSelection, wantsSkill` from `./skills`. Remove `spareForConversion` (replaced by `conversionSpare`). `SELECTS_FOR` becomes `new Set(['axe', 'green-dragon-blade', 'serpent-spear', ...CONVERSION_SKILLS])`.
2. Step 1a (a selection), first thing inside `if (selectTemplate && view.pendingSelection && me)`:

```ts
    const skillPick = skillSelection(view, me, selection, registry);
    if (skillPick === 'cancel' && cancel) return take(cancel);
    if (Array.isArray(skillPick) && skillPick.length >= selection.min) return take({ ...selectTemplate, ids: skillPick });
```

(declare `const cancel = …` before it, moving the existing line up).
3. Step 1a' (an ability's ask): the `wants` line becomes

```ts
      const skillWants = wantsSkill(view, me, choiceNow, registry);
      const wants = (skillWants ?? wantsToUse(view, me, choiceNow.reason.abilityId, choiceNow.reason.targetSeatId)) && (!reveals || mayReveal(me));
```

and only applies when the choice is an ask (`choiceNow.verb === 'use'`). Right after that `if`, add a skill's pick:

```ts
    if (choiceNow.reason.kind === 'ability' && (choiceNow.verb === 'pick' || choiceNow.verb === 'give')) {
      const optionId = skillChoice(view, me, choiceNow);
      const pick = choiceActions.find((a) => a.optionId === optionId) ?? choiceActions[0];
      return take(pick);
    }
```

4. Step 2 (responding): `converted` becomes the first `UseConversionAction` for which `conversionSpare(view, self, a, registry)` holds:

```ts
    const converted = legal.find((a): a is UseConversion => a.kind === 'UseConversionAction' && !!self && conversionSpare(view, self, a, registry));
    const chosen = best ?? converted;
```

5. Step 5 (Play Phase):
   - after the Peach Garden line: `const early = pickActiveSkill(view, self, legal, registry, 'early'); if (early) return take(early);`
   - after the Steal/Break grab: conversions into a Break or a Capture, under the same rules as the cards:

```ts
    const conversionsAs = (as: string) =>
      legal.filter((a): a is UseConversion => a.kind === 'UseConversionAction' && !a.pendingResponseId && a.targets.length === 1 && conversionAs(a, view, registry) === as && conversionSpare(view, self, a, registry));
    const breakVia = conversionsAs('break').find((a) => !isAlly(self, view.seats.find((s) => s.id === a.targets[0].seatId)!));
    if (breakVia) return take(breakVia);
    const captureVia = conversionsAs('capture')
      .filter((a) => !isAlly(self, view.seats.find((s) => s.id === a.targets[0].seatId)!))
      .sort((x, y) => (view.seats.find((s) => s.id === y.targets[0].seatId)?.combinedHp ?? 0) - (view.seats.find((s) => s.id === x.targets[0].seatId)?.combinedHp ?? 0))[0];
    if (captureVia) return take(captureVia);
```

     with the helper (top of the file):

```ts
// What a conversion action makes, read from the seat's conversions.
const conversionAs = (a: UseConversion, view: GameState, registry: ContentRegistry) =>
  conversionsOf(view, a.seatId, registry).find((o) => o.conversion.id === a.via.conversionId && sameAbilityOwner(o.owner, a.via.owner))?.conversion.as;
```

     (import `conversionsOf`, `sameAbilityOwner` from `engine`).
   - the Serpent Spear branch becomes "a conversion into a Sha": filter `conversionAs(a, view, registry) === 'sha'` and replace `spareForConversion(view, self, registry)` with `conversionSpare(view, self, conversion, registry)`; it still only runs when no real Sha was offered.
   - just before `if (endPhase) return take(endPhase);`: `const late = pickActiveSkill(view, self, legal, registry, 'late'); if (late) return take(late);`

- [ ] **Step 6: Run the tests**

Run: `npx jest projects/bots`
Expected: PASS, the existing rule-based specs included (their test registry has no skills, so nothing new fires there).

- [ ] **Step 7: Run the whole suite and commit**

Run: `npx jest`
Expected: PASS.

```bash
git add projects/bots
git commit -m "feat(bots): the base Generals' skills by the General Skills spec's bot rules

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 14: Simulator — base-only batches, a forced pairing per General, and "a hidden General never fires a compulsory skill"

Spec: General Skills spec, "Testing", Simulator. The 10-seat batch stays on the whole registry (see the departures).

**Files:**
- Create: `projects/sim/src/forcedPairing.ts`, `projects/sim/src/skills.spec.ts`
- Modify: `projects/sim/src/invariants.ts`, `projects/sim/src/invariants.spec.ts`, `projects/sim/src/property.spec.ts`

**Interfaces:**
- Consumes: `BASE_GENERAL_IDS` (content), `discardOwed` (engine), `runGame` (sim).
- Produces:
  - `checkCompulsoryWhileHidden(state: GameState, registry: ContentRegistry): string[]`, also run by `checkInvariants` when given a registry.
  - `baseRegistry(registry: ContentRegistry): ContentRegistry` (only the 25 base Generals); `withForcedPairing(state: GameState, seatId: string, pair: [string, string]): GameState`; `partnerOf(generalId: string, registry: ContentRegistry): string`; `firedSkills(state: GameState, seatId: string): Set<string>` (forcedPairing.ts).

- [ ] **Step 1: Write the failing invariant test**

In `projects/sim/src/invariants.spec.ts` add (it uses the real registry, for a real compulsory skill):

```ts
import { buildContentRegistry } from 'content';
import { checkCompulsoryWhileHidden } from './invariants';

describe('checkCompulsoryWhileHidden', () => {
  const registry = buildContentRegistry();
  const owner = { kind: 'general' as const, seatId: 'seat-a', slot: 'main' as const, skillId: 'linked-camps' };
  const fired = { kind: 'AbilityUsedEvent' as const, owner, abilityId: 'linked-camps', outcome: 'used' };
  const luXun = (revealed: boolean, log: GameState['log']) =>
    baseState({
      seats: [{ ...baseState().seats[0], kingdom: 'Wu', generals: { main: { generalDefinitionId: 'lu-xun', revealed }, deputy: { generalDefinitionId: 'sun-jian', revealed: false } } }],
      log,
    });

  it('flags a compulsory skill used while its General was hidden', () => {
    expect(checkCompulsoryWhileHidden(luXun(true, [fired, { kind: 'GeneralRevealedEvent', seatId: 'seat-a', slot: 'main' }]), registry)).toEqual([
      "seat-a's hidden lu-xun fired its compulsory linked-camps",
    ]);
  });

  it('accepts it once revealed, by an event or from the start', () => {
    expect(checkCompulsoryWhileHidden(luXun(true, [{ kind: 'GeneralRevealedEvent', seatId: 'seat-a', slot: 'main' }, fired]), registry)).toEqual([]);
    expect(checkCompulsoryWhileHidden(luXun(true, [fired]), registry)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx jest projects/sim/src/invariants.spec.ts`
Expected: FAIL — `checkCompulsoryWhileHidden` is not exported.

- [ ] **Step 3: The invariant**

In `projects/sim/src/invariants.ts` add:

```ts
// A hidden General never fires a compulsory skill: in log order, every
// AbilityUsedEvent of a compulsory General skill comes after that General was
// revealed (or it was revealed before the log began, as in a built state).
export function checkCompulsoryWhileHidden(state: GameState, registry: ContentRegistry): string[] {
  const slotKey = (seatId: string, slot: 'main' | 'deputy') => `${seatId}/${slot}`;
  const revealedByEvent = new Set(state.log.flatMap((e) => (e.kind === 'GeneralRevealedEvent' ? [slotKey(e.seatId, e.slot)] : [])));
  const revealed = new Set(
    state.seats.flatMap((s) =>
      (['main', 'deputy'] as const).filter((slot) => s.generals?.[slot].revealed && !revealedByEvent.has(slotKey(s.id, slot))).map((slot) => slotKey(s.id, slot))
    )
  );
  const violations: string[] = [];
  for (const event of state.log) {
    if (event.kind === 'GeneralRevealedEvent') revealed.add(slotKey(event.seatId, event.slot));
    if (event.kind !== 'AbilityUsedEvent' || event.owner.kind !== 'general') continue;
    const { seatId, slot, skillId } = event.owner;
    const generalId = state.seats.find((s) => s.id === seatId)?.generals?.[slot].generalDefinitionId;
    const skill = generalId ? registry.generals.get(generalId)?.skills.find((s) => s.id === skillId) : undefined;
    if (skill?.compulsory && !revealed.has(slotKey(seatId, slot))) violations.push(`${seatId}'s hidden ${generalId} fired its compulsory ${skillId}`);
  }
  return violations;
}
```

and at the end of `checkInvariants`, before `return violations;`: `if (registry) violations.push(...checkCompulsoryWhileHidden(state, registry));`.

In `projects/sim/src/property.spec.ts` the probe's condition uses `discardOwed(state, event.seatId) > 0` instead of `cardsOverHandLimit(...)` (import `discardOwed` from `engine`): a Self-Restraint skip ends the turn legitimately over the limit.

- [ ] **Step 4: Run it**

Run: `npx jest projects/sim/src/invariants.spec.ts`
Expected: PASS.

- [ ] **Step 5: Forced pairings**

Create `projects/sim/src/forcedPairing.ts`:

```ts
import type { ContentRegistry, GameState } from 'engine';
import { BASE_GENERAL_IDS } from 'content';

// The registry with only the 25 base Generals (their skills are the real ones).
export function baseRegistry(registry: ContentRegistry): ContentRegistry {
  return { cards: registry.cards, generals: new Map([...registry.generals].filter(([id]) => BASE_GENERAL_IDS.includes(id))) };
}

// The next base General of the same kingdom (in BASE_GENERAL_IDS order, wrapping).
export function partnerOf(generalId: string, registry: ContentRegistry): string {
  const kingdom = registry.generals.get(generalId)?.kingdom;
  const same = BASE_GENERAL_IDS.filter((id) => registry.generals.get(id)?.kingdom === kingdom);
  return same[(same.indexOf(generalId) + 1) % same.length];
}

// `seatId` is dealt exactly `pair` (so it plays them, the first as Main); every
// other seat 5 of the rest. Any 5 Generals hold a same-kingdom pair (four
// kingdoms), so every seat can still choose.
export function withForcedPairing(state: GameState, seatId: string, pair: [string, string]): GameState {
  const candidates = state.generalSelection?.candidates;
  if (!candidates) throw new Error('withForcedPairing needs a game still choosing its Generals');
  const pool = Object.values(candidates).flat().filter((id) => !pair.includes(id));
  const others = Object.keys(candidates).filter((id) => id !== seatId);
  if (pool.length < others.length * 5) throw new Error(`Not enough Generals left to deal ${others.length} seats`);
  const next: Record<string, string[]> = { [seatId]: [...pair] };
  others.forEach((id, i) => (next[id] = pool.slice(i * 5, i * 5 + 5)));
  return { ...state, generalSelection: { candidates: next } };
}

// The skills of `seatId`'s Generals that left a trace in the log: an ask
// answered Use, an AbilityUsedEvent, a card used through the skill, a reveal to use it.
export function firedSkills(state: GameState, seatId: string): Set<string> {
  const fired = new Set<string>();
  for (const e of state.log) {
    if (e.kind === 'AbilityUsedEvent' && e.owner.kind === 'general' && e.owner.seatId === seatId) fired.add(e.owner.skillId);
    if (e.kind === 'ChoiceMadeEvent' && e.seatId === seatId && e.reason.kind === 'ability' && e.reason.owner.kind === 'general' && e.shows.kind === 'use') fired.add(e.reason.abilityId);
    if (e.kind === 'CardPlayedEvent' && e.seatId === seatId && e.card.via?.owner.kind === 'general') fired.add(e.card.via.abilityId);
    if (e.kind === 'GeneralRevealedEvent' && e.seatId === seatId && e.forAbilityId) fired.add(e.forAbilityId);
  }
  return fired;
}
```

- [ ] **Step 6: Write the batch and coverage specs**

Create `projects/sim/src/skills.spec.ts`:

```ts
import { createGame } from 'engine';
import type { GameState } from 'engine';
import { BASE_GENERAL_IDS, buildContentRegistry, guozhanMode } from 'content';
import { generalsData } from '../../content/data/generals';
import { runGame } from './runGame';
import { checkInvariants, checkRestingState } from './invariants';
import { baseRegistry, firedSkills, partnerOf, withForcedPairing } from './forcedPairing';

const registry = baseRegistry(buildContentRegistry());
const ctx = { registry, mode: guozhanMode };
// Skills that are only modifiers leave no trace in the log; their unit tests cover them.
const MODIFIERS_ONLY = new Set(['roar', 'horsemanship', 'empty-city', 'wondrous-talent', 'humility', 'matchless']);
const skillId = (name: string) => name.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function checked(state: GameState, label: string, failures: string[]) {
  const violations = checkInvariants(state, registry);
  if (violations.length > 0) failures.push(`${label}: ${violations.join('; ')}`);
  if (!state.result) failures.push(`${label}: did not terminate`);
  if (JSON.stringify(JSON.parse(JSON.stringify(state))) !== JSON.stringify(state)) failures.push(`${label}: not serialisable`);
}

describe('simulated games with only the base Generals', () => {
  it('2 and 5 seats, random and rule-based bots: they finish, with no invariant broken', () => {
    const failures: string[] = [];
    let seed = 1000;
    for (const seats of [2, 5]) {
      for (let i = 0; i < 10; i++) {
        seed++;
        const initial = createGame(guozhanMode, registry, Array.from({ length: seats }, (_, n) => `seat-${n}`), seed);
        for (const [bot, maxActions] of [['random', 5000], ['rule-based', 20000]] as const) {
          const resting = new Set<string>();
          const { finalState } = runGame(initial, ctx, seed * 7 + 1, maxActions, bot, (s) => checkRestingState(s).forEach((v) => resting.add(v)));
          const label = `seed ${seed} (${seats} seats) [${bot}]`;
          if (resting.size > 0) failures.push(`${label}: ${[...resting].join('; ')}`);
          checked(finalState, label, failures);
        }
      }
    }
    expect(failures).toEqual([]);
  }, 300000);

  it('each base General, dealt to seat-0 with a same-kingdom partner, fires every skill that leaves a trace', () => {
    const missing: string[] = [];
    const failures: string[] = [];
    for (const generalId of BASE_GENERAL_IDS) {
      const expected = generalsData[generalId].skills.filter((s) => !s.lord).map((s) => skillId(s.name)).filter((id) => !MODIFIERS_ONLY.has(id));
      if (expected.length === 0) continue;
      const fired = new Set<string>();
      for (let seed = 1; seed <= 30 && expected.some((id) => !fired.has(id)); seed++) {
        const initial = withForcedPairing(createGame(guozhanMode, registry, ['seat-0', 'seat-1', 'seat-2', 'seat-3', 'seat-4'], seed), 'seat-0', [generalId, partnerOf(generalId, registry)]);
        const { finalState } = runGame(initial, ctx, seed * 13 + 5, 20000, 'rule-based');
        checked(finalState, `${generalId} seed ${seed}`, failures);
        firedSkills(finalState, 'seat-0').forEach((id) => fired.add(id));
      }
      const unfired = expected.filter((id) => !fired.has(id));
      if (unfired.length > 0) missing.push(`${generalId}: ${unfired.join(', ')}`);
    }
    expect(failures).toEqual([]);
    expect(missing).toEqual([]);
  }, 600000);
});
```

If the `../../content/data/generals` import is outside the sim project's `rootDir`, read skill names through content's `generalDisplayData(id)?.skills` instead and filter Lord skills with `registry.generals.get(id)?.skills.find((s) => s.id === skillIdOf(name))?.lord` (`skillIdOf` is exported from content).

- [ ] **Step 7: Run them**

Run: `npx jest projects/sim`
Expected: PASS. If the coverage test names a skill that never fired:
1. Check it isn't a bug: run one forced game for that General and read the log for the skill's asks (a missing ask is a bug in its condition; an ask the bot declines is the bot rule).
2. A skill that is just rare under the bot rules (Devil, Heaven's Envy, First Aid, Self-Restraint, Kindness are the likeliest): raise that loop's seed limit from 30 to 60. Report any skill still unfired at 60 rather than weakening the check.

- [ ] **Step 8: Run the whole suite and commit**

Run: `npx jest`
Expected: PASS.

```bash
git add projects/sim
git commit -m "test(sim): base-only batches, a forced pairing per General, and no compulsory skill from a hidden General

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 15: App — skill asks, selections, choices, conversions, the Judgment slot and Action History

Spec: General Skills spec, "UI". Stage 6 built the windows; this task gives them each skill's words.

**Files:**
- Modify: `projects/content/src/lib/display.ts` (+ `display.spec.ts`), `projects/app/src/app/labels.ts` (+ spec), `projects/app/src/app/game-board/action-history.ts` (+ spec), `projects/app/src/app/game-board/ability-description.ts` (+ spec), `projects/app/src/app/game-board/choice-description.ts` (+ spec), `projects/app/src/app/game-board/selection-dialog.ts`, `projects/app/src/app/game-board/seat-tile.ts` (+ spec), `projects/app/src/app/game-board/round-table.ts`, `projects/app/src/app/game-board/game-board.ts`

**Interfaces:**
- Consumes: outcomes `used`, `more-damage`, `unblockable`, `moved`, `took-hand-card`; `CardShownEvent`; `CardZone.countsAs`; `skill-step` continuations.
- Produces:
  - content `selectionText(abilityId): { prompt: string; confirm: string; cancel?: string } | null`; `ABILITY_HINTS` entries for every asked skill.
  - `SelectionDescription.cancelLabel: string`.
  - `SeatTile` input `judgmentCountsAs: Record<string, string>` (default `{}`).

- [ ] **Step 1: Write the failing tests**

In `projects/content/src/lib/display.spec.ts` add:

```ts
describe('skill texts', () => {
  it('every asked base skill has a hint, and the multi-pick skills have selection text', () => {
    for (const id of ['evil-hero', 'feedback', 'unyielding', 'bestowed-rouse', 'heavens-envy', 'devil', 'river-goddess', 'bare-the-chest', 'raid', 'brave-gesture', 'gathering-wisdom', 'iron-cavalry', 'astrology', 'displace', 'self-restraint']) {
      expect(abilityHint(id)).toEqual(expect.any(String));
    }
    expect(selectionText('reconsider')).toEqual({ prompt: 'Choose cards to discard, then draw as many', confirm: 'Discard' });
    expect(selectionText('bestowed-rouse')).toEqual({ prompt: 'Choose drawn cards to give away', confirm: 'Give', cancel: 'Keep the Rest' });
    expect(selectionText('sha')).toBeNull();
  });
});
```

(import `selectionText` alongside `abilityHint`).

In `projects/app/src/app/labels.spec.ts`, inside `describe('actionLabel', …)` add:

```ts
  it('labels a skill conversion as what it makes and the skill', () => {
    const registry = buildContentRegistry();
    const base = stateWithZones();
    const state: GameState = {
      ...base,
      seats: [{
        id: 'seat-0', index: 0, kingdom: 'Shu', eliminated: false, combinedHp: 4, maxCombinedHp: 4,
        generals: { main: { generalDefinitionId: 'guan-yu', revealed: true }, deputy: { generalDefinitionId: 'wei-yan', revealed: true } },
        hand: { zoneId: 'hand-0' }, equipped: { zoneId: 'equip-0' }, judgment: { zoneId: 'judgment-0' },
      }],
    };
    const use = (targets: Target[]): Action => ({
      kind: 'UseConversionAction', seatId: 'seat-0', via: { owner: { kind: 'general', seatId: 'seat-0', slot: 'main', skillId: 'fighting-saint' }, conversionId: 'fighting-saint' }, targets,
    });
    expect(actionLabel(use([]), state, registry)).toBe('As Sha · Fighting Saint');
    expect(actionLabel(use([{ kind: 'seat', seatId: 'seat-1' }]), state, registry)).toBe('As Sha · Fighting Saint Targeting Seat 1');
  });
```

(import `buildContentRegistry` from `content`).

In `projects/app/src/app/game-board/action-history.spec.ts` add:

```ts
describe('actionHistory: the base Generals’ skills', () => {
  const general = (seatId: string, skillId: string) => ({ kind: 'general' as const, seatId, slot: 'main' as const, skillId });
  const used = (seatId: string, skillId: string, outcome: string, targetSeatId?: string): EngineEvent => ({
    kind: 'AbilityUsedEvent', owner: general(seatId, skillId), abilityId: skillId, outcome, ...(targetSeatId ? { targetSeatId } : {}),
  });

  it('names a one-card conversion by the card, what it counted as, and the skill', () => {
    const red: CardInstance = { instanceId: 'r', definitionId: 'peach', suit: 'heart', rank: 9 };
    const via = { owner: general('seat-0', 'fighting-saint'), abilityId: 'fighting-saint', conversionId: 'fighting-saint' };
    expect(texts([{ kind: 'CardPlayedEvent', seatId: 'seat-0', card: usedCardFrom([red], 'sha', via), targets: [seat('seat-1')] }])).toEqual([
      'Seat 0 used Peach (9 ♥) as Sha (Fighting Saint) on Seat 1',
    ]);
  });

  it('says what a skill did', () => {
    expect(texts([used('seat-0', 'linked-camps', 'used')])).toEqual(['Seat 0 used Linked Camps']);
    expect(texts([used('seat-0', 'bare-the-chest', 'more-damage', 'seat-1')])).toEqual(["Seat 0's Bare the Chest: 1 more damage"]);
    expect(texts([used('seat-0', 'iron-cavalry', 'unblockable', 'seat-1')])).toEqual(["Seat 0's Iron Cavalry: Seat 1 can't play a Shan"]);
    expect(texts([used('seat-0', 'displace', 'moved', 'seat-1')])).toEqual(["Seat 0's Displace moved the Sha to Seat 1"]);
    expect(texts([used('seat-0', 'raid', 'took-hand-card', 'seat-1')])).toEqual(['Seat 0 took a hand card from Seat 1 (Raid)']);
  });

  it('says a shown card, and a card taken with a skill', () => {
    expect(texts([{ kind: 'CardShownEvent', seatId: 'seat-1', card: sha, abilityId: 'sow-revolt' }])).toEqual(['Seat 1 showed Sha (7 ♠)']);
    const took: EngineEvent[] = [
      { kind: 'ChoiceMadeEvent', seatId: 'seat-0', verb: 'take', reason: { kind: 'ability', owner: general('seat-0', 'feedback'), abilityId: 'feedback', targetSeatId: 'seat-1' }, shows: { kind: 'hidden-hand', seatId: 'seat-1', count: 2 } },
      { kind: 'CardMovedEvent', cardInstanceId: 'x', fromZoneId: 'seat-1:hand', toZoneId: 'seat-0:hand' },
    ];
    expect(texts(took)).toEqual(['Seat 0 took a hand card from Seat 1 with Feedback']);
  });
});
```

In `projects/app/src/app/game-board/ability-description.spec.ts`, in `describe('describeSelection', …)` add (reuse the file's `state`, `template`, `cancel` helpers):

```ts
  it("a skill's selection uses the skill's words", () => {
    const owner = { kind: 'general' as const, seatId: 'seat-0', slot: 'main' as const, skillId: 'bestowed-rouse' };
    const sel: PendingSelection = {
      id: 'sel', seatId: 'seat-0', reason: { kind: 'ability', owner, abilityId: 'bestowed-rouse' }, of: 'cards', eligibleIds: [], min: 1, max: 2,
      then: { kind: 'give', toSeatIds: ['seat-1'] }, onCancel: [],
    };
    expect(describe2(sel)).toMatchObject({ title: 'Bestowed Rouse', prompt: 'Choose drawn cards to give away', confirmLabel: 'Give', cancelLabel: 'Keep the Rest' });
  });
```

In `projects/app/src/app/game-board/choice-description.spec.ts` add:

```ts
  it("a skill's take (Feedback): choose a card to take from the seat", () => {
    const feedback: PendingChoice = {
      id: 'f', seatId: 'seat-0', verb: 'take', options: [],
      reason: { kind: 'ability', owner: { kind: 'general', seatId: 'seat-0', slot: 'main', skillId: 'feedback' }, abilityId: 'feedback', targetSeatId: 'seat-1' },
    };
    expect(describeChoice(state(feedback), 'seat-0')).toEqual({ title: 'Feedback', prompt: 'Choose a card to take from Seat 1', confirmLabel: 'Take' });
  });
```

In `projects/app/src/app/game-board/seat-tile.spec.ts` add a case (follow the file's existing render helper) that sets the `judgment` input to `[{ instanceId: 'dm', definitionId: 'shan', suit: 'diamond', rank: 3 }]` and `judgmentCountsAs` to `{ dm: 'capture' }`, and expects the judgment slot's text to contain `As Capture` and its title to be `Judgment Area: Shan as Capture`.

- [ ] **Step 2: Run them to see them fail**

Run: `npx jest projects/content/src/lib/display.spec.ts projects/app/src/app/labels.spec.ts projects/app/src/app/game-board`
Expected: FAIL on each new case.

- [ ] **Step 3: Content's texts**

In `projects/content/src/lib/display.ts` add to `ABILITY_HINTS` (sentence case; `{target}` is the seat the ask names):

```ts
  'evil-hero': 'Take the card that damaged you into your hand',
  feedback: "Take one of {target}'s cards",
  unyielding: 'Judge: unless it is a heart, {target} discards 2 hand cards or takes 1 damage',
  'bestowed-rouse': 'Draw 2 cards, then give any of them away',
  'heavens-envy': 'Take the judgment card into your hand',
  devil: "Replace {target}'s judgment card with one of your hand cards",
  'river-goddess': 'Judge: keep each black card and judge again; a red card ends it',
  'bare-the-chest': 'Draw 1 fewer card; your Sha and Duel deal 1 more damage this turn',
  raid: 'Instead of drawing, take a hand card from 1 or 2 other seats',
  'brave-gesture': 'Draw 1 more card',
  'gathering-wisdom': 'Draw 1 card',
  'iron-cavalry': "Judge: on red, {target} can't play a Shan against this Sha",
  astrology: 'Look at the top cards of the draw pile and put them back in any order',
  displace: 'Discard 1 card to move the Sha to another seat in your attack range',
  'self-restraint': 'Skip your Discard Phase',
```

and add:

```ts
// What a skill's selection says: its prompt, its confirm button and, when
// cancelling means something else than "back", its cancel button.
const SELECTION_TEXT: Record<string, { prompt: string; confirm: string; cancel?: string }> = {
  reconsider: { prompt: 'Choose cards to discard, then draw as many', confirm: 'Discard' },
  kindness: { prompt: 'Choose cards to give', confirm: 'Give' },
  'bestowed-rouse': { prompt: 'Choose drawn cards to give away', confirm: 'Give', cancel: 'Keep the Rest' },
  marriage: { prompt: 'Choose 2 hand cards to discard', confirm: 'Discard' },
  'green-vesicle': { prompt: 'Choose a hand card to discard', confirm: 'Discard' },
  'sow-discord': { prompt: 'Choose a card to discard', confirm: 'Discard' },
  displace: { prompt: 'Choose a card to discard', confirm: 'Discard' },
  raid: { prompt: 'Choose 1 or 2 seats to take a hand card from', confirm: 'Take' },
  'sow-revolt': { prompt: 'Choose a seat', confirm: 'Choose' },
};

export function selectionText(abilityId: string): { prompt: string; confirm: string; cancel?: string } | null {
  return SELECTION_TEXT[abilityId] ?? null;
}
```

Export `selectionText` from `projects/content/src/public-api.ts` if display's functions are listed there one by one.

- [ ] **Step 4: The app**

`projects/app/src/app/labels.ts`, `conversionLabel`:

```ts
// "Use 2 Cards as Sha" (a worn card's), "As Sha · Fighting Saint" (a skill's),
// with its targets for a play.
export function conversionLabel(action: Extract<Action, { kind: 'UseConversionAction' }>, state: GameState, registry: ContentRegistry): string {
  const owner = action.via.owner;
  const cardName = (id: string) => registry.cards.get(id)?.name ?? id;
  let base = 'Use Cards';
  if (owner.kind === 'equipment') {
    const worn = findCardInstance(state, owner.cardInstanceId);
    const conversion = worn && registry.cards.get(worn.definitionId)?.abilities?.conversions?.find((c) => c.id === action.via.conversionId);
    if (conversion) base = `Use ${conversion.cards} Cards as ${cardName(conversion.as)}`;
  } else {
    const generalId = state.seats.find((s) => s.id === owner.seatId)?.generals?.[owner.slot].generalDefinitionId;
    const skill = generalId ? registry.generals.get(generalId)?.skills.find((s) => s.id === owner.skillId) : undefined;
    const conversion = skill?.conversions?.find((c) => c.id === action.via.conversionId);
    if (conversion) base = `As ${cardName(conversion.as)} · ${abilityName(owner.skillId)}`;
  }
  return action.targets.length > 0 ? `${base} Targeting ${action.targets.map((t) => targetLabel(t, state.players)).join(', ')}` : base;
}
```

`projects/app/src/app/game-board/action-history.ts`:
- `usedLabel`:

```ts
const usedLabel = (used: UsedCard) => {
  if (used.via) {
    const as = `${cardName(used.as)} (${abilityName(used.via.abilityId)})`;
    return used.physical.length === 1 ? `${named(used.physical[0])} as ${as}` : `${used.physical.length} cards as ${as}`;
  }
  return used.physical.length === 1 && used.physical[0].definitionId === used.as ? named(used.physical[0]) : cardName(used.as);
};
```

- `pickLine`'s `tool`: `const tool = made.reason.kind === 'choice' ? ` with ${cardName(made.reason.card.as)}` : made.reason.kind === 'ability' ? ` with ${abilityName(made.reason.abilityId)}` : '';`
- a new case:

```ts
      case 'CardShownEvent':
        action(`${name(event.seatId)} showed ${named(event.card)}`, event.card);
        break;
```

- in `AbilityUsedEvent`, after the `counts-as-shan` branch:

```ts
        } else if (event.outcome === 'more-damage') {
          action(`${owner}'s ${ability}: 1 more damage`);
        } else if (event.outcome === 'unblockable' && event.targetSeatId) {
          action(`${owner}'s ${ability}: ${name(event.targetSeatId)} can't play a Shan`);
        } else if (event.outcome === 'moved' && event.targetSeatId) {
          action(`${owner}'s ${ability} moved the Sha to ${name(event.targetSeatId)}`);
        } else if (event.outcome === 'took-hand-card' && event.targetSeatId) {
          action(`${owner} took a hand card from ${name(event.targetSeatId)} (${ability})`);
        }
```

`projects/app/src/app/game-board/ability-description.ts`:
- `SelectionDescription` gains `// The cancel button's label: "Cancel", or the skill's own ("Keep the Rest").` `cancelLabel: string;`
- `selectionPrompt`: `use-card` with `then.as` becomes `selection.max === 1 ? `Choose a card to use as ${cardName(then.as)}` : `Choose ${count} hand cards to use as ${cardName(then.as)}``; add `case 'skill-step': return `Choose ${count} ${selection.of === 'seats' ? (selection.max === 1 ? 'seat' : 'seats') : selection.max === 1 ? 'card' : 'cards'}`;`.
- `CONFIRM_LABELS` gains `'skill-step': 'Confirm'`.
- `describeSelection`: read `const text = selection.reason.kind === 'ability' ? selectionText(selection.reason.abilityId) : null;` (import from `content`) and return `prompt: text?.prompt ?? selectionPrompt(state, selection, items)`, `confirmLabel: text?.confirm ?? CONFIRM_LABELS[selection.then.kind]`, `cancelLabel: text?.cancel ?? 'Cancel'`.

`projects/app/src/app/game-board/selection-dialog.ts`: the cancel button shows `{{ d.cancelLabel }}` instead of the literal `Cancel`.

`projects/app/src/app/game-board/choice-description.ts`, in the ability branch, before the `pick`/`give` handling:

```ts
  // A skill's take from another seat (Feedback).
  if (choice.reason.kind === 'ability' && choice.verb === 'take') {
    const from = choice.reason.targetSeatId ? ` from ${seatName(state.players, choice.reason.targetSeatId)}` : '';
    return { title: abilityName(choice.reason.abilityId), prompt: `Choose a card to take${from}`, confirmLabel: 'Take' };
  }
```

`projects/app/src/app/game-board/seat-tile.ts`:
- add the input `readonly judgmentCountsAs = input<Record<string, string>>({});` next to `judgment`.
- in the judgment slot, the title becomes `'Judgment Area: ' + cardIdDisplayName(card.definitionId) + (judgmentCountsAs()[card.instanceId] ? ' as ' + cardIdDisplayName(judgmentCountsAs()[card.instanceId]) : '')`, and after the card button add:

```html
                @if (judgmentCountsAs()[card.instanceId]; as countsAs) {
                  <span class="counts-as">As {{ cardIdDisplayName(countsAs) }}</span>
                }
```

  with the style `.counts-as { font-size: 9px; line-height: 1; text-align: center; }` (the slot grows by its height; keep `.slot` at 44px wide).
- `round-table.ts` and `game-board.ts`, where they bind `[judgment]`, also bind `[judgmentCountsAs]="countsAsOf(<the same zone id>)"`, with:

```ts
  // What each card in a zone counts as, when placed as another card (Country Scene's Capture).
  protected countsAsOf(zoneId: string): Record<string, string> {
    return this.state().zones.find((z) => z.id === zoneId)?.countsAs ?? {};
  }
```

  (use whichever signal the component already reads its state from, as `judgmentOf`/`zoneCards` do).

- [ ] **Step 5: Run the tests**

Run: `npx jest projects/content projects/app`
Expected: PASS.

- [ ] **Step 6: Check it in the running app**

Use the `run` skill (or `npm start`) and play a game with base Generals: confirm a skill ask shows its hint and "Reveal and Use" for a hidden General, a conversion button reads "As Sha · Fighting Saint", Bestowed Rouse's selection offers "Keep the Rest", and a Country Scene Capture shows "As Capture" in the Judgment slot. Note anything that looks off; fix what is in this task's files.

- [ ] **Step 7: Run the whole suite and commit**

Run: `npx jest`
Expected: PASS.

```bash
git add projects/content projects/app
git commit -m "feat(app): words for the base Generals' skills: hints, selections, choices, conversions, the Judgment slot and history lines

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 16: Docs — the event chain and the spec's stage 7 rulings

**Files:**
- Modify: `docs/architecture/event-chain.md`, `docs/superpowers/specs/2026-10-05-general-skills-design.md`

- [ ] **Step 1: The event chain**

In `docs/architecture/event-chain.md`:
- In the extension-points table, the stage-7 rows now name real skills as built (Kindness, Devil, Heaven's Envy, Brave Gesture, Astrology); add rows:

| Need | Hook | Example |
|---|---|---|
| A skill deciding in several moves | `SkillStepEffect` → `SkillDefinition.onStep`; a selection's `skill-step` continuation | Raid, Kindness, Sow Revolt |
| A seat using a card a skill made | `UseCardEffect` (not counted, outside limits) | Sow Discord's Duel |
| Showing a card to everyone | `ShowCardEffect` → `CardShownEvent` | Sow Revolt |
| Using one card as another | `Conversion` with `cards: 1`, `from`, `accepts`, `outsideOwnTurnOnly` | Fighting Saint, First Aid |
| A card lying as another card | `MoveCardEffect.countsAs` → `CardZone.countsAs` | Country Scene's Capture |
| Skipping the Discard Phase as it begins | the `skipDiscard` turn flag (`discardOwed`) | Self-Restraint |
| A rule change read by content's queries | `AbilityModifiers` (`distanceToOthers`, `toolsIgnoreDistance`, `untargetableWithEmptyHandBy`, `doubleAnswers`) | Horsemanship, Wondrous Talent, Empty City, Matchless |

- Add a short section "Judgment changers' order": the `JUDGMENT_CHANGERS` set and `nextToChange` (content), with the rule "from the judged seat; after a replacement, from the seat after the one that replaced it".

- [ ] **Step 2: The spec's rulings**

Append to `docs/superpowers/specs/2026-10-05-general-skills-design.md` a section:

```markdown
## Stage 7 rulings

Settled while building stage 7 (see its plan for the reasons):

- Self-Restraint is asked as the Discard Phase begins, only when there is something to discard.
- Matchless is a modifier; under it, Eight Trigrams may judge once for each Shan still owed.
- Lightning is discarded before its damage, so Evil Hero can take it.
- Feedback takes from the hand or the equipment, not the Judgment slot.
- A card used through a conversion as a delayed Tool lies in the Judgment slot as that Tool.
- Lord skills have definitions marked `lord: true` and nothing else.
- Base-only simulations run at 2 and 5 seats; 10 seats use the whole registry.
```

- [ ] **Step 3: Commit**

```bash
git add docs
git commit -m "docs: the base Generals' skills in the event chain; stage 7 rulings in the General Skills spec

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## After the last task

- Run `npx jest` once more; all green.
- Run the sim CLI at 2, 5 and 10 seats (`npx ts-node projects/sim/src/cli.ts --help` shows the flags) and confirm every game finishes.
- Update the memory note on the roadmap: stage 7 merged, with the test count and any deferred minors.
- Merge locally to `main` (the stage workflow), via superpowers:finishing-a-development-branch.
