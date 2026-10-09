# Stage 8: The Wind Generals — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the 8 Wind Generals (Cao Ren, Xiahou Yuan, Huang Zhong, Wei Yan, Xiao Qiao, Zhou Tai, Zhang Jiao, Yu Ji) their real skills, with bots, sim coverage and app text, as stage 7 did for the base Generals.

**Architecture:**
- **Engine (generic):**
  - face-down seats;
  - a face-up `pile` zone per seat;
  - a Play Phase flagged to skip ends at once;
  - `acted` on damage and dying, plus `pointsBelowOne` on dying;
  - `ReplaceJudgmentEffect.oldTo`;
  - `DecisionReason` ability `cardId`;
  - `onJudged` gets the registry;
  - deferred conversions, which suspend the window they answer;
  - `UseCardEffect.counted` / `answering`;
  - Wuxie checks ask a seat that can make a Wuxie by conversion;
  - `Conversion.accepts(card, state, seatId)`.
- **Content:**
  - `suitOf` / `colourFor`, applying the `suitAs` modifier, read by every suit rule;
  - `JUDGMENT_CHANGERS` becomes a map from skill to the cards it may change with;
  - one file, `generals/wind.ts`.
- **Around it:** bots by the spec's rules; a sim with base + Wind Generals and a forced pairing per Wind General; app badges, pile row, Bewilder's doubt wording and history lines.

**Tech Stack:** TypeScript, Jest (ts-jest), Angular 22 (app task).

**Spec:** `docs/superpowers/specs/2026-10-07-stage-8-wind-generals-design.md` (binding). Stage 7's General Skills spec "Common rules" still hold.

**Built in earlier stages (reused, not redone):**
- skill steps, `UseCardEffect`, `ShowCardEffect`;
- one-card conversions and `playConversionCards`;
- `countsAs`, `discardOwed`;
- `askAtStep` / `atStep`, `atDrawPhase`, `shared/skills.ts`;
- `nextToChange`;
- forced pairings and `firedSkills` in the sim.

**Where this plan departs from the spec, and why:**
- **No separate naming dialog for Bewilder.** Each card Yu Ji can name is a deferred conversion, so the action list already offers "As Sha · Bewilder" with its targets, like every conversion. Naming and targets come from one button.
- **Godspeed's first option is asked at the start of the turn, not "as the Judgment Phase begins".** Kingdom War judges delayed Tools on entering the Judgment Phase, before any skill could ask. Asking just before it, when the Start Phase begins, is the latest point that still skips it.
- **A Bewilder answer suspends the window it answers.** The engine clears `pendingResponse` while the doubt round runs and hands the window to the skill. The skill answers it (`UseCardEffect.answering`) or re-opens it. Otherwise the queue couldn't run the doubt round while a response is pending.
- **Every suit rule reads `suitOf`, not only Xiao Qiao's own skills.** Beauty must reach Capture, Starvation, Lightning, Eight Trigrams and every skill's judgment, so all readers switch.
- **Refusing Death asks once per card,** as the spec's "may … again" says. Declining a later card means the dying round goes ahead.
- **Wind Generals used as test fillers are swapped out** in Task 1, as stage 7 swapped the base ones.
- **Beauty doesn't change a used card's colour as armour sees it.** `UsedCard.colour` is the engine's. Black Shield still sees Xiao Qiao's spade Sha as black. The spec lists where her suits count (her judgments, Fantasy's cost, conversions), and armour isn't among them.
- **Godspeed's second option, for bots:** "no other card play is left" is read as "no Sha in hand" when the Play Phase begins, since the ask comes before any play.

## Global Constraints

- **The engine names no card or skill.** Content supplies everything specific (CLAUDE.md, "Extensibility").
- **Game state stays plain serialisable data.** Absent optional state is left out (`faceDown` absent, not `false`; empty `countsAs` absent).
- **No elemental damage:** "a skill that deals lightning or fire damage deals plain damage instead" (spec, Common rules).
- **"May" always asks;** hidden Generals' optional skills are offered as "Reveal X to use Y"; compulsory skills and modifiers of a hidden General don't apply; Lord skills are inactive (General Skills spec).
- **Face down:** "When a face-down seat's turn would start, it turns face up instead and the turn passes to the next seat. Nothing else changes" (spec).
- **Every skill acts for its `owner`,** never by searching the state for its General's id.
- **UI text** follows CLAUDE.md's UI text style. Buttons and labels in Title Case ("Believe", "Doubt", "Face Down"); prompts and history lines in sentence case with keywords capitalised.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Bewilder answering a Wuxie check.** Yu Ji, holding no real Wuxie, is asked in the Wuxie check (through the conversion). If nobody doubts, the Tool is cancelled; if he is caught lying, the window comes back to him and the Tool goes ahead when he passes. The queue keeps the Tool's own rule exactly once. (Test in Task 8.)
2. **A face-down seat's turn.** The seat after a face-down seat plays its turn; the face-down seat turns face up with no phase entered and its turn flags never set. Two face-down seats in a row both turn up, and the third seat plays. (Test in Task 2.)
3. **Zhou Tai brought from 1 HP to −1 by one hit.** Two cards are turned (each asked). With no matching ranks he stays alive at −1, no dying round starts, and the sim's "living at 0 HP" check accepts it. A later hit of 1 turns one more. (Tests in Tasks 6 and 10.)
4. **Beauty and the delayed Tools.** A Capture judged on Xiao Qiao with a spade turned up counts as a heart and spares her Play Phase. A Lightning judged on her with a spade 5 doesn't strike. (Test in Task 6.)
5. **Godspeed's second option skips a Play Phase already entered.** Using it ends the Play Phase at once after the Sha, the turn goes on to Discard, and cards aren't playable meanwhile. (Test in Task 5.)

---

## File Structure

**Engine (`projects/engine/src/lib/`):**
- Modify: `domain/types.ts`, `registry/types.ts`, `pipeline/effects.ts`, `pipeline/events.ts`, `pipeline/resolve.ts`, `pipeline/judgment.ts`, `pipeline/toolLifecycle.ts`, `rules/phaseSequence.ts`, `rules/legality.ts`, `domain/redact.ts` (only if a new field needs masking).
- Create: `pipeline/faceDown.spec.ts`, `pipeline/stage8.spec.ts`, `pipeline/deferredConversion.spec.ts`.

**Content (`projects/content/`):**
- Create: `src/lib/generals/wind.ts`, `src/lib/generals/wind-wei-shu.spec.ts`, `wind-wu.spec.ts`, `wind-qun.spec.ts`, `bewilder.spec.ts`, `src/lib/shared/suits.ts`.
- Modify:
  - `src/lib/generals/index.ts` (`WIND_GENERALS`, `WIND_GENERAL_IDS`), `src/lib/generals/skills.testing.ts` (default fillers);
  - `src/lib/shared/judgments.ts`, `src/lib/shared/delayed.ts`, `src/lib/shared/abilities.ts`;
  - `src/lib/cards/lightning.ts`, `src/lib/cards/equipment/eight-trigrams.ts`;
  - `src/lib/generals/{wei,shu,wu,qun}.ts` (suit readers, `accepts` signature);
  - `src/lib/modes/kingdomWar.ts` (pile zones, `pointsBelowOne`, pile discard);
  - `src/lib/display.ts`, `src/public-api.ts`;
  - specs that use Wind Generals as fillers.

**Bots / sim:** `bots/src/lib/skills.ts`, `bots/src/lib/wind.ts` (new), `bots/src/lib/rule-based.ts`, specs; `sim/src/forcedPairing.ts`, `sim/src/invariants.ts`, `sim/src/wind.spec.ts` (new).

**App (`projects/app/src/app/`):** `game-board/seat-tile.ts`, `game-board/round-table.ts`, `game-board/game-board.ts`, `game-board/choice-description.ts`, `game-board/action-history.ts`, `labels.ts`, with their specs.

**Docs:** `docs/architecture/event-chain.md`; the stage 8 spec's "Stage 8 rulings" section.

---
### Task 1: Clear the ground — Wind fillers out, the Wind file in

Stage 7 swapped base Generals out of the specs for Wind/Fire/Forest/Mountain ones that had no skills. The Wind ones get skills now (Cao Ren's Entrench asks at every End Phase), so they are swapped again, for Generals of later packs.

**Files:**
- Create: `projects/content/src/lib/generals/wind.ts`
- Modify: `projects/content/src/lib/generals/index.ts`, `projects/content/src/public-api.ts`, `projects/content/src/lib/generals/index.spec.ts`
- Modify (fillers): `projects/content/src/lib/generals/skills.testing.ts`, `wei.spec.ts`, `wu-actives.spec.ts`, `draw-phase.spec.ts`, `qun.spec.ts`, `shu-triggers.spec.ts`, `shu.spec.ts`, `projects/content/src/lib/cards/equipment/sha-equipment.spec.ts`, `projects/content/src/lib/cards/playability.spec.ts`, `projects/content/src/lib/modes/kingdomWar.spec.ts`, `projects/content/src/lib/registry.spec.ts`, `projects/bots/src/lib/skills.spec.ts`

**Interfaces:**
- Produces: `WIND_GENERALS: GeneralSkillSet[]` (empty now; Tasks 5–8 fill it); `WIND_GENERAL_IDS: readonly string[]` exported from `content`.

**Filler swaps** (none of these has skills until stages 9–11):

| Wind General | Filler |
|---|---|
| cao-ren (Wei 4 ♂) | xu-huang |
| xiahou-yuan (Wei 4 ♂) | zhang-he |
| huang-zhong (Shu 4 ♂) | jiang-wei |
| wei-yan (Shu 4 ♂) | meng-huo |
| xiao-qiao (Wu 3 ♀) | zhu-rong (Shu 4 ♀; only where the kingdom doesn't matter) |
| zhou-tai (Wu 4 ♂) | sun-ce |
| zhang-jiao, yu-ji (Qun 3 ♂) | zuo-ci |

If a swap puts the same General twice in one table, take another skill-less General of the same kingdom and gender (Wei: deng-ai, dian-wei; Wu: taishi-ci, lu-su). HP comes from the tables' own options, so expectations don't change.

- [ ] **Step 1: Write the failing test**

In `projects/content/src/lib/generals/index.spec.ts` add:

```ts
import { WIND_GENERAL_IDS } from './index';

describe('WIND_GENERAL_IDS', () => {
  it('is every Wind General in the data', () => {
    const wind = Object.entries(generalsData).filter(([, g]) => g.source.expansion === 'Wind').map(([id]) => id);
    expect([...WIND_GENERAL_IDS].sort()).toEqual(wind.sort());
    expect(WIND_GENERAL_IDS).toHaveLength(8);
  });
});
```

(merge the import with the file's existing one).

- [ ] **Step 2: Run it**

Run: `npx jest projects/content/src/lib/generals/index.spec.ts`
Expected: FAIL — `WIND_GENERAL_IDS` is not exported.

- [ ] **Step 3: The Wind file and the list**

Create `projects/content/src/lib/generals/wind.ts`:

```ts
import type { GeneralSkillSet } from './types';

// The Wind Generals' skills (stage 8 spec, "Rule text"). Every skill acts for
// the `owner` the engine passes in: the same General can sit at two seats in
// tests, so a skill must never find "its" seat by searching for its id.
export const WIND_GENERALS: GeneralSkillSet[] = [];
```

In `projects/content/src/lib/generals/index.ts` import `WIND_GENERALS`, add it to `HAND_CODED` (after `QUN_GENERALS`), and add:

```ts
// The 8 Wind Generals (stage 8).
export const WIND_GENERAL_IDS: readonly string[] = ['cao-ren', 'xiahou-yuan', 'huang-zhong', 'wei-yan', 'xiao-qiao', 'zhou-tai', 'zhang-jiao', 'yu-ji'];
```

In `projects/content/src/public-api.ts` change the generals export to `export { BASE_GENERAL_IDS, WIND_GENERAL_IDS } from './lib/generals';`.

In `projects/content/src/lib/generals/base.spec.ts`, the "no expansion General has skills yet" case becomes "only base and Wind Generals have skills": `expect([...GENERAL_SKILLS.keys()].sort()).toEqual([...BASE_GENERAL_IDS, ...WIND_GENERAL_IDS].filter((id) => GENERAL_SKILLS.has(id)).sort())`, and a new case runs the same "define every skill in their data, in order, with matching Lord flags" loop over `WIND_GENERAL_IDS` (it fails until Task 8; mark it `it.todo` here and turn it into a real `it` in Task 8).

- [ ] **Step 4: Swap the fillers**

Apply the table above in the listed specs and in `skills.testing.ts` (its default `['cao-ren', 'dong-zhuo']` becomes `['xu-huang', 'dong-zhuo']`, and its comment says "Xu Huang and Dong Zhuo"). In `registry.spec.ts`, the "data-only generals get no skills" line checks `xu-huang` instead of `cao-ren`.

- [ ] **Step 5: Run the whole suite**

Run: `npx jest`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A projects
git commit -m "refactor(content): Wind fillers out of the specs, the Wind Generals' file in

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Engine — face-down seats, a pile per seat, small hooks for stage 8

**Files:**
- Create: `projects/engine/src/lib/pipeline/faceDown.spec.ts`, `projects/engine/src/lib/pipeline/stage8.spec.ts`
- Modify: `projects/engine/src/lib/domain/types.ts`, `projects/engine/src/lib/registry/types.ts`, `projects/engine/src/lib/pipeline/effects.ts`, `projects/engine/src/lib/pipeline/events.ts`, `projects/engine/src/lib/pipeline/resolve.ts`, `projects/engine/src/lib/pipeline/judgment.ts`, `projects/engine/src/lib/rules/phaseSequence.ts`, `projects/engine/src/lib/cards/zones.ts`

**Interfaces:**
- Produces:
  - `Seat.faceDown?: true`; `Seat.pile?: CardZoneRef`; zone kind `'pile'` (face up).
  - Effect `{ kind: 'TurnFaceDownEffect'; seatId: string }`; event `SeatTurnedEvent { kind: 'SeatTurnedEvent'; seatId: string; faceDown: boolean; passedTurn?: true }`.
  - `pileZoneOf(state, seatId): CardZone | undefined` (zones.ts).
  - `phaseWaitsForPlayer` is false in a Play Phase whose skip flag is set.
  - `DamageEffect.acted?: string[]`; `DyingEffect.acted?: string[]`, `DyingEffect.pointsBelowOne?: number`.
  - `ReplaceJudgmentEffect.oldTo?: string`; the `replace-judgment` continuation gains `oldTo?: string`.
  - `DecisionReason` ability variant gains `cardId?: string` ("the card this decision is about": Bewilder's claim).
  - `CardDefinition.onJudged(state, ctx, registry)` and `SkillDefinition.onJudged(state, ctx, registry)`: the registry is passed.

- [ ] **Step 1: Write the failing tests**

Create `projects/engine/src/lib/pipeline/faceDown.spec.ts`:

```ts
import { advanceToDecision } from './resolve';
import { ContentRegistry, GameModeDefinition } from '../registry/types';
import { GameState } from '../domain/types';
import { phaseWaitsForPlayer, skipFlagOf } from '../rules/phaseSequence';

const mode: GameModeDefinition = { id: 'stub', setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'], checkWinCondition: () => null, triggers: [] };
const registry: ContentRegistry = { cards: new Map(), generals: new Map() };
const ctx = { registry, mode };

// Seats a–d; `faceDown` seats start face down; a's End Phase.
function table(faceDown: string[] = []): GameState {
  const ids = ['a', 'b', 'c', 'd'];
  return {
    seats: ids.map((id, index) => ({
      id, index, kingdom: 'Wei' as const, eliminated: false, generals: null, combinedHp: 4, maxCombinedHp: 4,
      hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` },
      ...(faceDown.includes(id) ? { faceDown: true as const } : {}),
    })),
    players: [], turn: { turnNumber: 1, ownerSeatId: 'a', extraTurnStack: [] }, phase: 'End',
    zones: [{ id: 'drawPile', kind: 'drawPile', cards: [] }, { id: 'discardPile', kind: 'discardPile', cards: [] }, { id: 'processing', kind: 'processing', cards: [] },
      ...ids.flatMap((id) => [{ id: `${id}:hand`, kind: 'hand' as const, ownerSeatId: id, cards: [] }, { id: `${id}:equip`, kind: 'equip' as const, ownerSeatId: id, cards: [] }, { id: `${id}:judgment`, kind: 'judgment' as const, ownerSeatId: id, cards: [] }])],
    pendingResponse: null, log: [], rng: { seed: 1, counter: 0 }, result: null, generalSelection: null,
  };
}

describe('a face-down seat', () => {
  it('turns face up instead of taking its turn; the next seat plays', () => {
    const s = advanceToDecision(table(['b']), ctx).state;
    expect(s.turn.ownerSeatId).toBe('c');
    expect(s.phase).toBe('Play');
    expect(s.seats[1].faceDown).toBeUndefined();
    expect(s.log).toContainEqual({ kind: 'SeatTurnedEvent', seatId: 'b', faceDown: false, passedTurn: true });
    expect(s.log.some((e) => e.kind === 'PhaseChangedEvent' && e.seatId === 'b')).toBe(false);
  });

  it('two in a row both turn face up, and the third seat plays', () => {
    const s = advanceToDecision(table(['b', 'c']), ctx).state;
    expect(s.turn.ownerSeatId).toBe('d');
    expect(s.seats.every((x) => !x.faceDown)).toBe(true);
  });

  it('TurnFaceDownEffect turns a seat face down, once', () => {
    const s = advanceToDecision({ ...table(), phase: 'Play', resolutionQueue: [{ kind: 'TurnFaceDownEffect', seatId: 'a' }, { kind: 'TurnFaceDownEffect', seatId: 'a' }] }, ctx).state;
    expect(s.seats[0].faceDown).toBe(true);
    expect(s.log.filter((e) => e.kind === 'SeatTurnedEvent')).toEqual([{ kind: 'SeatTurnedEvent', seatId: 'a', faceDown: true }]);
  });
});

describe('a Play Phase flagged to skip while it runs', () => {
  it('no longer waits for the player', () => {
    const s = { ...table(), phase: 'Play' as const };
    expect(phaseWaitsForPlayer(s)).toBe(true);
    expect(phaseWaitsForPlayer({ ...s, turn: { ...s.turn, flags: { [skipFlagOf('Play')]: true } } })).toBe(false);
  });
});
```

Create `projects/engine/src/lib/pipeline/stage8.spec.ts`:

```ts
import { advanceToDecision } from './resolve';
import { ContentRegistry, GameModeDefinition } from '../registry/types';
import { CardInstance, GameState, Judgment } from '../domain/types';
import { pileZoneOf } from '../cards/zones';

const mode: GameModeDefinition = { id: 'stub', setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'], checkWinCondition: () => null, triggers: [] };
const registry: ContentRegistry = { cards: new Map([['mark', { id: 'mark', name: 'Mark', category: 'tool', delayed: true, play: () => [], onJudged: () => [] }]]), generals: new Map() };
const ctx = { registry, mode };
const card = (instanceId: string, suit: CardInstance['suit'] = 'spade'): CardInstance => ({ instanceId, definitionId: 'x', suit, rank: 4 });

function table(): GameState {
  return {
    seats: [{ id: 'a', index: 0, kingdom: 'Wei', eliminated: false, generals: null, combinedHp: 4, maxCombinedHp: 4, hand: { zoneId: 'a:hand' }, equipped: { zoneId: 'a:equip' }, judgment: { zoneId: 'a:judgment' }, pile: { zoneId: 'a:pile' } }],
    players: [], turn: { turnNumber: 1, ownerSeatId: 'a', extraTurnStack: [] }, phase: 'Play',
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: [] }, { id: 'discardPile', kind: 'discardPile', cards: [] },
      { id: 'processing', kind: 'processing', cards: [card('old')] },
      { id: 'a:hand', kind: 'hand', ownerSeatId: 'a', cards: [card('new', 'heart')] },
      { id: 'a:equip', kind: 'equip', ownerSeatId: 'a', cards: [] }, { id: 'a:judgment', kind: 'judgment', ownerSeatId: 'a', cards: [] },
      { id: 'a:pile', kind: 'pile', ownerSeatId: 'a', cards: [] },
    ],
    pendingResponse: null, log: [], rng: { seed: 1, counter: 0 }, result: null, generalSelection: null,
  };
}

describe('a pile under a seat', () => {
  it('is found by pileZoneOf, and a card moved there is face up in the log', () => {
    const s = advanceToDecision({ ...table(), resolutionQueue: [{ kind: 'MoveCardEffect', cardInstanceId: 'new', toZoneId: 'a:pile' }] }, ctx).state;
    expect(pileZoneOf(s, 'a')?.cards.map((c) => c.instanceId)).toEqual(['new']);
    expect(s.log[0]).toMatchObject({ kind: 'CardMovedEvent', card: { instanceId: 'new' } });
  });
});

describe('ReplaceJudgmentEffect.oldTo', () => {
  it('sends the replaced card to the zone given instead of the discard pile', () => {
    const judgment: Judgment = { seatId: 'a', reader: { kind: 'card', card: { as: 'mark', colour: 'black', physical: [] } }, card: card('old') };
    const s = advanceToDecision({
      ...table(),
      resolutionQueue: [{ kind: 'ReplaceJudgmentEffect', judgment, withCardInstanceId: 'new', owner: { kind: 'general', seatId: 'a', slot: 'main', skillId: 'm' }, abilityId: 'm', oldTo: 'a:hand' }],
    }, ctx).state;
    expect(s.zones.find((z) => z.id === 'a:hand')!.cards.map((c) => c.instanceId)).toEqual(['old']);
    expect(s.zones.find((z) => z.id === 'discardPile')!.cards.map((c) => c.instanceId)).toEqual(['new']);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx jest projects/engine/src/lib/pipeline/faceDown.spec.ts projects/engine/src/lib/pipeline/stage8.spec.ts`
Expected: FAIL — the face-down seat takes its turn; `pileZoneOf` doesn't exist; `oldTo` is ignored.

- [ ] **Step 3: Types**

`projects/engine/src/lib/domain/types.ts`:
- `Seat` gains, after `judgment`:

```ts
  // Cards kept face up under the seat's General (Refusing Death). Absent in
  // tables without one.
  pile?: CardZoneRef;
  // Turned face down (Entrench): its next turn is skipped as it turns face up.
  faceDown?: true;
```

- `CardZone.kind` gains `'pile'`.
- `DecisionReason`'s ability variant becomes `| { kind: 'ability'; owner: AbilityOwner; abilityId: string; targetSeatId?: string; cardId?: string }`, with the comment "`cardId`: the card the decision is about (Bewilder's claim)."
- The `replace-judgment` continuation becomes `| { kind: 'replace-judgment'; judgment: Judgment; owner: AbilityOwner; abilityId: string; oldTo?: string }`.

`projects/engine/src/lib/registry/types.ts`: `CardDefinition.onJudged?(state: GameState, ctx: JudgedContext, registry: ContentRegistry): unknown[];` and `SkillDefinition.onJudged?(state: GameState, ctx: SkillJudgedContext, registry: ContentRegistry): unknown[];`.

`projects/engine/src/lib/pipeline/effects.ts`, in `Effect`:
- `DamageEffect` becomes `| { kind: 'DamageEffect'; damage: Damage; acted?: string[] }` ("`acted`: abilities that had their say on it (Fantasy)").
- `DyingEffect` gains `acted?: string[]; pointsBelowOne?: number` ("`acted`: abilities that had their say on entering (Refusing Death); `pointsBelowOne`: how many points of HP the drop took below 1, set by the mode on entering").
- `ReplaceJudgmentEffect` gains `oldTo?: string` ("where the replaced card goes; default the discard pile").
- Add `| { kind: 'TurnFaceDownEffect'; seatId: string }`.

and in `applyEffect`:

```ts
    case 'TurnFaceDownEffect': {
      const seat = state.seats.find((s) => s.id === effect.seatId);
      if (!seat) throw new Error(`Unknown seat: ${effect.seatId}`);
      if (seat.eliminated || seat.faceDown) return { state, events: [] };
      const seats = state.seats.map((s) => (s.id === seat.id ? { ...s, faceDown: true as const } : s));
      const event: EngineEvent = { kind: 'SeatTurnedEvent', seatId: seat.id, faceDown: true };
      return { state: { ...state, seats, log: [...state.log, event] }, events: [event] };
    }
```

In `projects/engine/src/lib/pipeline/events.ts` add (and add to `EngineEvent`):

```ts
// A seat turned face down, or face up again; `passedTurn`: it turned face up
// instead of taking its turn.
export interface SeatTurnedEvent {
  kind: 'SeatTurnedEvent';
  seatId: string;
  faceDown: boolean;
  passedTurn?: true;
}
```

- [ ] **Step 4: Behaviour**

`projects/engine/src/lib/cards/zones.ts`:

```ts
// The pile under `seatId`'s General, if its table has one.
export function pileZoneOf(state: GameState, seatId: string): CardZone | undefined {
  const seat = state.seats.find((s) => s.id === seatId);
  return seat?.pile && state.zones.find((z) => z.id === seat.pile!.zoneId);
}
```

`projects/engine/src/lib/rules/phaseSequence.ts`, `phaseWaitsForPlayer`: `if (state.phase === 'Play') return !state.turn.flags?.[skipFlagOf('Play')];` with the comment "A Play Phase flagged to skip while it runs (Godspeed) ends at once."

`projects/engine/src/lib/pipeline/judgment.ts`:
- `readJudgment` passes `registry` as the third argument to both `onJudged` calls.
- `ReplaceJudgmentEffect`: `toZoneId: effect.oldTo ?? discardPile.id` for the old card's move.

`projects/engine/src/lib/pipeline/resolve.ts`:
- `continueSelection`'s `replace-judgment` case passes `...(then.oldTo ? { oldTo: then.oldTo } : {})` into the effect.
- `enterNextPhase` handles face-down seats:

```ts
function enterNextPhase(state: GameState, ctx: EngineContext): ResolveResult {
  let current = state;
  let next = advancePhaseOrTurn(current);
  const events: GameEvent[] = [];
  // A face-down seat's turn: it turns face up instead, and the turn passes on.
  while (next.turn.turnNumber !== current.turn.turnNumber) {
    const owner = current.seats.find((s) => s.id === next.turn.ownerSeatId);
    if (!owner?.faceDown) break;
    const { faceDown: _up, ...faceUp } = owner;
    current = { ...current, seats: current.seats.map((s) => (s.id === owner.id ? faceUp : s)), turn: next.turn, phase: 'End' };
    events.push({ kind: 'TurnAdvancedEvent', seatId: owner.id, turnNumber: next.turn.turnNumber } as TurnAdvancedEvent);
    events.push({ kind: 'SeatTurnedEvent', seatId: owner.id, faceDown: false, passedTurn: true });
    next = advancePhaseOrTurn(current);
  }
  const { phase, turn, skipped } = next;
  if (turn.turnNumber !== current.turn.turnNumber) {
    const turnEvent: TurnAdvancedEvent = { kind: 'TurnAdvancedEvent', seatId: turn.ownerSeatId, turnNumber: turn.turnNumber };
    events.push(turnEvent);
  }
  for (const skippedPhase of skipped) {
    const skipEvent: PhaseSkippedEvent = { kind: 'PhaseSkippedEvent', seatId: turn.ownerSeatId, phase: skippedPhase };
    events.push(skipEvent);
  }
  const phaseEvent: PhaseChangedEvent = { kind: 'PhaseChangedEvent', seatId: turn.ownerSeatId, phase };
  events.push(phaseEvent);
  return logWithTriggers({ ...current, phase, turn }, events, ctx);
}
```

(Every seat turned face up stops being face down, so the loop ends.)

- [ ] **Step 5: Run the tests**

Run: `npx jest projects/engine`
Expected: PASS.

- [ ] **Step 6: Run the whole suite and commit**

Run: `npx jest` — Expected: PASS (content's `onJudged` implementations ignore the new argument).

```bash
git add projects/engine
git commit -m "feat(engine): face-down seats, a pile per seat, a Play Phase skipped mid-phase, and stage 8's small hooks

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Engine — deferred conversions, uses that answer or count, Wuxie through a conversion

**Files:**
- Create: `projects/engine/src/lib/pipeline/deferredConversion.spec.ts`
- Modify: `projects/engine/src/lib/registry/types.ts`, `projects/engine/src/lib/domain/types.ts`, `projects/engine/src/lib/pipeline/effects.ts`, `projects/engine/src/lib/pipeline/resolve.ts`, `projects/engine/src/lib/pipeline/toolLifecycle.ts`, `projects/engine/src/lib/rules/legality.ts`; callers of `conversionCards` (`projects/bots/src/lib/skills.ts`)

**Interfaces:**
- Produces:
  - `Conversion.deferred?: true`; `Conversion.accepts?(card: CardInstance, state: GameState, seatId: string, registry: ContentRegistry): boolean`.
  - `conversionCards(state, seatId, conversion, registry)` and `playConversionCards(state, seatId, conversion, targets, registry)`: the registry is passed on to `accepts`.
  - For a deferred conversion, the confirmed selection queues the owning skill's step `{ kind: 'SkillStepEffect', owner, step: 'deferred', data: { as, conversionId, targets, picked: [id], window? } }`. When it answers a window, `window` is that `PendingResponse`, and `pendingResponse` is cleared while the skill decides.
  - The `skill-step` continuation gains `suspendWindow?: true` (what the line above uses).
  - `UseCardEffect` gains `counted?: boolean` (toward per-turn limits, and spends Wine) and `answering?: PendingResponse` (the card answers that window).
  - A Wuxie check asks a seat that can answer with a conversion into a counter card.

- [ ] **Step 1: Write the failing tests**

Create `projects/engine/src/lib/pipeline/deferredConversion.spec.ts`:

```ts
import { advanceToDecision, resolve } from './resolve';
import { getLegalActions } from '../rules/legality';
import { CardDefinition, ContentRegistry, GameModeDefinition, SkillDefinition } from '../registry/types';
import { Action, } from './actions';
import { CardInstance, GameState, PendingResponse } from '../domain/types';
import { Effect } from './effects';

const mode: GameModeDefinition = { id: 'stub', setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'], checkWinCondition: () => null, triggers: [] };
// 'ward' answers a window; 'mend' heals its target when played.
const ward: CardDefinition = { id: 'ward', name: 'Ward', category: 'basic', legalPlayTargets: () => [], play: () => [] };
const mend: CardDefinition = { id: 'mend', name: 'Mend', category: 'basic', legalPlayTargets: () => [[{ kind: 'seat', seatId: 'b' }]], play: (_s, ctx) => (ctx.respondingTo ? [] : [{ kind: 'HealEffect', target: ctx.targets[0], amount: 1 }]) };
const nay: CardDefinition = { id: 'nay', name: 'Nay', category: 'tool', legalPlayTargets: () => [], play: () => [] };
// Trick: any hand card as a Ward or a Mend, decided later by the skill's own step.
const trick: SkillDefinition = {
  id: 'trick',
  conversions: [
    { id: 'as-ward', as: 'ward', cards: 1, when: 'respond', deferred: true },
    { id: 'as-mend', as: 'mend', cards: 1, when: 'play', deferred: true },
  ],
  onStep: (state, step) => {
    const data = step.data as { as: string; targets: { kind: 'seat'; seatId: string }[]; picked: string[]; window?: PendingResponse };
    const card = state.zones.flatMap((z) => z.cards).find((c) => c.instanceId === data.picked[0])!;
    return [{ kind: 'UseCardEffect', seatId: step.owner.seatId, card: { as: data.as, colour: 'none', physical: [card] }, targets: data.targets, counted: !data.window, ...(data.window ? { answering: data.window } : {}) }];
  },
};
// Nay-er: any hand card as a Nay, at once.
const nayer: SkillDefinition = { id: 'nayer', conversions: [{ id: 'as-nay', as: 'nay', cards: 1, when: 'respond' }] };
const registry: ContentRegistry = {
  cards: new Map([['ward', ward], ['mend', mend], ['nay', nay]]),
  generals: new Map([['g', { id: 'g', kingdom: 'Qun', maxHp: 4, skills: [trick] }], ['n', { id: 'n', kingdom: 'Qun', maxHp: 4, skills: [nayer] }], ['v', { id: 'v', kingdom: 'Qun', maxHp: 4, skills: [] }]]),
};
const ctx = { registry, mode };
const card = (instanceId: string): CardInstance => ({ instanceId, definitionId: 'junk', suit: 'club', rank: 2 });

function table(bGeneral = 'g'): GameState {
  const seat = (id: string, index: number, general: string) => ({
    id, index, kingdom: 'Qun' as const, eliminated: false, combinedHp: 3, maxCombinedHp: 4,
    generals: { main: { generalDefinitionId: general, revealed: true }, deputy: { generalDefinitionId: 'v', revealed: true } },
    hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` },
  });
  return {
    seats: [seat('a', 0, 'g'), seat('b', 1, bGeneral)], players: [], turn: { turnNumber: 1, ownerSeatId: 'a', extraTurnStack: [] }, phase: 'Play',
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: [] }, { id: 'discardPile', kind: 'discardPile', cards: [] }, { id: 'processing', kind: 'processing', cards: [] },
      { id: 'a:hand', kind: 'hand', ownerSeatId: 'a', cards: [card('a1')] }, { id: 'a:equip', kind: 'equip', ownerSeatId: 'a', cards: [] }, { id: 'a:judgment', kind: 'judgment', ownerSeatId: 'a', cards: [] },
      { id: 'b:hand', kind: 'hand', ownerSeatId: 'b', cards: [card('b1')] }, { id: 'b:equip', kind: 'equip', ownerSeatId: 'b', cards: [] }, { id: 'b:judgment', kind: 'judgment', ownerSeatId: 'b', cards: [] },
    ],
    pendingResponse: null, log: [], rng: { seed: 1, counter: 0 }, result: null, generalSelection: null,
  };
}
const convert = (s: GameState, seatId: string, conversionId: string) =>
  resolve(s, getLegalActions(s, seatId, registry).find((a): a is Extract<Action, { kind: 'UseConversionAction' }> => a.kind === 'UseConversionAction' && a.via.conversionId === conversionId)!, ctx).state;
const select = (s: GameState, id: string) => resolve(s, { kind: 'SelectAction', seatId: s.pendingSelection!.seatId, selectionId: s.pendingSelection!.id, ids: [id] }, ctx).state;

describe('a deferred conversion', () => {
  it('in the Play Phase: the skill’s step decides, and its use counts as a play', () => {
    const s = select(convert(table(), 'a', 'as-mend'), 'a1');
    expect(s.seats[1].combinedHp).toBe(4);
    expect(s.turn.cardPlays).toEqual({ mend: 1 });
    expect(s.log.find((e) => e.kind === 'CardPlayedEvent')).toMatchObject({ seatId: 'a', card: { as: 'mend' }, targets: [{ kind: 'seat', seatId: 'b' }] });
  });

  it('answering: the window is set aside while the skill decides, then answered', () => {
    const window: Effect = {
      kind: 'OpenResponseEffect',
      pendingResponse: { id: 'w', respondingSeatId: 'b', allowedActionKinds: ['RespondAction', 'PassAction'], allowedCardIds: ['ward'], context: { effect: { kind: 'DamageEffect', damage: { source: null, target: { kind: 'seat', seatId: 'b' }, amount: 1, nature: 'normal' } } } },
    };
    const open = advanceToDecision({ ...table(), resolutionQueue: [window] }, ctx).state;
    const selecting = convert(open, 'b', 'as-ward');
    expect(selecting.pendingResponse?.id).toBe('w');
    const answered = select(selecting, 'b1');
    expect(answered.pendingResponse).toBeNull();
    expect(answered.seats[1].combinedHp).toBe(3); // the damage was answered
    expect(answered.log.find((e) => e.kind === 'CardPlayedEvent')).toMatchObject({ seatId: 'b', card: { as: 'ward' } });
    expect(answered.turn.cardPlays).toBeUndefined();
  });
});

describe('a Wuxie check', () => {
  it('asks a seat with no counter card that can make one by conversion', () => {
    const check: Effect = { kind: 'WuxieCheckEffect', subject: { kind: 'tool', tool: { as: 'mend', colour: 'none', physical: [] }, userSeatId: 'a', target: { kind: 'seat', seatId: 'b' } }, order: ['b'], counterCardIds: ['nay'] };
    expect(advanceToDecision({ ...table('n'), resolutionQueue: [check] }, ctx).state.pendingResponse?.respondingSeatId).toBe('b');
    expect(advanceToDecision({ ...table('v'), resolutionQueue: [check] }, ctx).state.pendingResponse).toBeNull();
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx jest projects/engine/src/lib/pipeline/deferredConversion.spec.ts`
Expected: FAIL — the conversion is used at once (no step); the Wuxie check skips seat b.

- [ ] **Step 3: Types**

`projects/engine/src/lib/registry/types.ts`, `Conversion`:

```ts
  // Which cards may be used; absent = any. `seatId` holds the card (a suit
  // modifier of that seat may apply).
  accepts?(card: CardInstance, state: GameState, seatId: string, registry: ContentRegistry): boolean;
  …
  // The picked card isn't used at once: the owning skill's step 'deferred'
  // decides (Bewilder's doubt round). Only a General's skill may defer.
  deferred?: true;
```

`projects/engine/src/lib/domain/types.ts`: the `skill-step` continuation becomes `| { kind: 'skill-step'; step: Extract<Effect, { kind: 'SkillStepEffect' }>; suspendWindow?: true }` ("`suspendWindow`: the open window goes into the step's data as `window` and is cleared while the skill decides").

`projects/engine/src/lib/pipeline/effects.ts`: `UseCardEffect` becomes `| { kind: 'UseCardEffect'; seatId: string; card: UsedCard; targets: Target[]; counted?: boolean; answering?: PendingResponse }` ("`counted`: a play toward per-turn limits, spending Wine; `answering`: the card answers that window").

- [ ] **Step 4: Legality**

`projects/engine/src/lib/rules/legality.ts`: `conversionCards(state, seatId, conversion, registry)` calls `conversion.accepts(c, state, seatId, registry)`; `playConversionCards` and `usableNow` pass `registry` through (`usableNow(state, seatId, owned, registry)`); update the three callers in the file.

- [ ] **Step 5: The pipeline**

`projects/engine/src/lib/pipeline/resolve.ts`:
- `UseConversionAction`: after building `selection`, a deferred conversion continues into its skill:

```ts
      if (owned.conversion.deferred) {
        if (owned.owner.kind !== 'general') throw new Error(`Only a General's skill may defer a conversion (${owned.conversion.id})`);
        const step = {
          kind: 'SkillStepEffect' as const,
          owner: owned.owner,
          step: 'deferred',
          data: { as: owned.conversion.as, conversionId: owned.conversion.id, targets: action.targets },
        };
        selection.then = { kind: 'skill-step', step, ...(action.pendingResponseId ? { suspendWindow: true as const } : {}) };
      }
```

  (declare `selection` with `let`, or build it with a conditional `then`, whichever reads cleaner).
- `continueSelection`'s `skill-step` case:

```ts
    case 'skill-step': {
      const window = then.suspendWindow ? state.pendingResponse : null;
      const step = { ...then.step, data: { ...then.step.data, picked: ids, ...(window ? { window } : {}) } };
      return { state: queueFront(window ? { ...state, pendingResponse: null } : state, [step]), events: [] };
    }
```

- `resolveEffect`'s `UseCardEffect` branch:

```ts
  if (current.kind === 'UseCardEffect') {
    const counted = !!current.counted;
    const used = useCard(state, current.seatId, current.card, { targets: current.targets, counted, ...(counted ? {} : { free: true }), ...(current.answering ? { respondTo: current.answering } : {}) }, ctx);
    return { state: queueFront(used.state, rewritten.after), events: used.events };
  }
```

  (`useCard` clears `pendingResponse` for an answer; for a suspended window it is already null, which is fine.)

`projects/engine/src/lib/pipeline/toolLifecycle.ts`: `applyWuxieCheck(state, effect, registry)` (pass it from `applyLifecycleEffect`), and

```ts
  const holdsCounter = (seatId: string) => {
    const seat = state.seats.find((s) => s.id === seatId);
    const hand = seat && state.zones.find((z) => z.id === seat.hand.zoneId);
    // A counter card in hand, or a conversion that makes one.
    return !!hand?.cards.some((c) => effect.counterCardIds.includes(c.definitionId)) || answeringConversions(state, seatId, effect.counterCardIds, registry).length > 0;
  };
```

(import `answeringConversions` from `../rules/legality`).

- [ ] **Step 6: Callers**

`projects/bots/src/lib/skills.ts`: `conversionCards(view, me.id, owned.conversion, registry)`. Content's `accepts` implementations (wei/shu/wu/qun) take `(c)` and ignore the rest; they keep compiling. (Task 4 moves them onto `colourFor`.)

- [ ] **Step 7: Run the tests, the suite, and commit**

Run: `npx jest projects/engine/src/lib/pipeline/deferredConversion.spec.ts`, then `npx jest` — Expected: PASS.

```bash
git add projects/engine projects/bots
git commit -m "feat(engine): deferred conversions that set their window aside, uses that answer or count, Wuxie through a conversion

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 4: Content — suits through `suitOf`, judgment changers by the cards they use, the mode's pile and `pointsBelowOne`

**Files:**
- Create: `projects/content/src/lib/shared/suits.ts`, `projects/content/src/lib/shared/suits.spec.ts`
- Modify:
  - `projects/engine/src/lib/registry/types.ts` (`AbilityModifiers.suitAs`);
  - `projects/content/src/lib/shared/delayed.ts`, `projects/content/src/lib/shared/judgments.ts`;
  - `projects/content/src/lib/cards/lightning.ts`, `projects/content/src/lib/cards/equipment/eight-trigrams.ts`;
  - `projects/content/src/lib/generals/{wei,shu,wu,qun}.ts`;
  - `projects/content/src/lib/modes/kingdomWar.ts` (+ spec).

**Interfaces:**
- Produces:
  - `AbilityModifiers.suitAs?: Partial<Record<CardInstance['suit'], CardInstance['suit']>>`.
  - `suitOf(state, seatId, card, registry): CardInstance['suit']`; `colourFor(state, seatId, card, registry): 'red' | 'black'` (`shared/suits.ts`).
  - `JUDGMENT_CHANGERS: ReadonlyMap<string, (state, seatId, registry) => CardInstance[]>`: each changer skill and the cards it may change a judgment with. `nextToChange` keeps its signature.
  - Kingdom War: every seat has `pile: { zoneId: `${id}:pile` }` and a `pile` zone; an eliminated seat discards it; the dying round's entry carries `pointsBelowOne`.

- [ ] **Step 1: Write the failing tests**

Create `projects/content/src/lib/shared/suits.spec.ts`:

```ts
import { card, harness, kwMode, registry, table } from '../generals/skills.testing';
import { colourFor, suitOf } from './suits';
import { usedCardOf } from 'engine';

// A test General whose spades count as hearts (Beauty's modifier), not in the real data.
registry.generals.set('test-beauty', { id: 'test-beauty', kingdom: 'Wu', maxHp: 3, skills: [{ id: 'test-beauty', compulsory: true, modifiers: { suitAs: { spade: 'heart' } } }] });
const withBeauty = (revealed = true) => table({}, { generals: { 'seat-a': ['test-beauty', 'dong-zhuo', revealed] } });

describe('suitOf', () => {
  it("applies the seat's suit modifiers, only while its General is revealed", () => {
    const spade = card('s', 'sha', 'spade');
    expect(suitOf(withBeauty(), 'seat-a', spade, registry)).toBe('heart');
    expect(colourFor(withBeauty(), 'seat-a', spade, registry)).toBe('red');
    expect(suitOf(withBeauty(false), 'seat-a', spade, registry)).toBe('spade');
    expect(suitOf(withBeauty(), 'seat-b', spade, registry)).toBe('spade');
  });

  it('a Capture judged on that seat reads a spade as a heart, and spares the Play Phase', () => {
    const { run } = harness();
    const capture = usedCardOf(card('cp', 'capture', 'spade', 6));
    const s = run({ ...withBeauty(), zones: withBeauty().zones.map((z) => (z.id === 'drawPile' ? { ...z, cards: [card('j', 'sha', 'spade', 9)] } : z)) }, [
      { kind: 'JudgeEffect', seatId: 'seat-a', reader: { kind: 'card', card: capture } },
    ]);
    expect(s.turn.flags).toBeUndefined();
  });
});

describe('Kingdom War: the pile under each General', () => {
  it('every seat has one, face up', () => {
    const { state } = kwMode.setup(['seat-0', 'seat-1'], registry, { seed: 3, counter: 0 });
    expect(state.seats.map((s) => s.pile)).toEqual([{ zoneId: 'seat-0:pile' }, { zoneId: 'seat-1:pile' }]);
    expect(state.zones.filter((z) => z.kind === 'pile').map((z) => z.ownerSeatId)).toEqual(['seat-0', 'seat-1']);
  });
});
```

In `projects/content/src/lib/modes/kingdomWar.spec.ts` add (import `table` and `kwMode` from `../generals/skills.testing`):

```ts
describe('Kingdom War: the dying round knows how far below 1 HP a drop went', () => {
  it('the mode’s dying trigger sets pointsBelowOne from the drop', () => {
    const s = table({}, { hp: { 'seat-b': -1 } });
    const event = { kind: 'DamageDealtEvent' as const, damage: { source: null, target: { kind: 'seat' as const, seatId: 'seat-b' }, amount: 2, nature: 'normal' as const } };
    const dying = kwMode.triggers.filter((t) => t.point === 'after:DamageDealtEvent' && t.condition(s, event)).flatMap((t) => t.effect(s, event)).find((e) => (e as { kind: string }).kind === 'DyingEffect');
    expect(dying).toMatchObject({ kind: 'DyingEffect', seatId: 'seat-b', entering: true, pointsBelowOne: 2 });
    const later = { ...event, damage: { ...event.damage, amount: 1 } };
    const s2 = table({}, { hp: { 'seat-b': -2 } });
    expect(kwMode.triggers.filter((t) => t.point === 'after:DamageDealtEvent' && t.condition(s2, later)).flatMap((t) => t.effect(s2, later)).find((e) => (e as { kind: string }).kind === 'DyingEffect')).toMatchObject({ pointsBelowOne: 1 });
  });
});
```



- [ ] **Step 2: Run them to see them fail**

Run: `npx jest projects/content/src/lib/shared/suits.spec.ts projects/content/src/lib/modes/kingdomWar.spec.ts`
Expected: FAIL — `./suits` doesn't exist; seats have no pile; `pointsBelowOne` is absent.

- [ ] **Step 3: Suits**

`projects/engine/src/lib/registry/types.ts`, `AbilityModifiers` gains:

```ts
  // How the owner's own cards' suits count (Beauty: { spade: 'heart' }): its
  // hand, worn and judgment cards wherever a rule reads a suit.
  suitAs?: Partial<Record<CardInstance['suit'], CardInstance['suit']>>;
```

Create `projects/content/src/lib/shared/suits.ts`:

```ts
import type { CardInstance, ContentRegistry, GameState } from 'engine';
import { activeAbilities } from './abilities';

// The suit `card` counts as for `seatId` (its own card or its judgment): a
// suit modifier of the seat may change it (Beauty). Every rule that reads the
// suit of a seat's own card or judgment reads it here.
export function suitOf(state: GameState, seatId: string, card: CardInstance, registry: ContentRegistry): CardInstance['suit'] {
  for (const abilities of activeAbilities(state, seatId, registry)) {
    const as = abilities.modifiers?.suitAs?.[card.suit];
    if (as) return as;
  }
  return card.suit;
}

// Its colour, by that suit.
export function colourFor(state: GameState, seatId: string, card: CardInstance, registry: ContentRegistry): 'red' | 'black' {
  const suit = suitOf(state, seatId, card, registry);
  return suit === 'heart' || suit === 'diamond' ? 'red' : 'black';
}
```

- [ ] **Step 4: Every suit reader**

Switch each to `suitOf`/`colourFor` with the judged seat, or the card's holder:
- `shared/delayed.ts` `skipPhaseTool`: `onJudged: (state, { judged, seatId }, registry) => (suitOf(state, seatId, judged, registry) === spares ? [] : [...])`.
- `cards/lightning.ts`: `onJudged: (state, { tool, seatId, judged }, registry) => { if (!isStruck(suitOf(state, seatId, judged, registry), judged.rank)) return []; …`.
- `cards/equipment/eight-trigrams.ts`: `onJudged: (state, { judged, data, seatId, tool, done }, registry) => { const step = …; if (colourFor(state, seatId, judged, registry) === 'black') return [done, step]; …`.
- `generals/wei.ts`:
  - Unyielding: `suitOf(state, owner.seatId, judged, registry) === 'heart'`;
  - River Goddess: `colourFor(state, owner.seatId, judged, registry) === 'red'`;
  - Overturned Country: `accepts: (c, state, seatId, registry) => colourFor(state, seatId, c, registry) === 'black'`.
- `generals/shu.ts`:
  - `red` becomes `(c, state, seatId, registry) => colourFor(state, seatId, c, registry) === 'red'` (Fighting Saint);
  - Iron Cavalry's `onJudged` uses `colourFor(state, owner.seatId, judged, registry)`.
- `generals/wu.ts`:
  - Country Scene: `accepts: (c, state, seatId, registry) => suitOf(state, seatId, c, registry) === 'diamond'`;
  - `black` the same way (Surprise);
  - Sow Revolt's taken card compares `suitOf(state, target, taken, registry) !== data['suit']`, where `onStep` gets `registry`.
- `generals/qun.ts`: First Aid's `red` the same way.

- [ ] **Step 5: Judgment changers by their cards**

In `projects/content/src/lib/shared/judgments.ts` replace the set with a map and use it in `maySay`:

```ts
// The skills that may replace a judgment's card, each with the cards its seat
// may change one with (Devil: a hand card; Dark Magic, stage 8: a black hand or
// worn card). Each holder is asked in seat order, one at a time (nextToChange).
export const JUDGMENT_CHANGERS: Map<string, (state: GameState, seatId: string, registry: ContentRegistry) => CardInstance[]> = new Map([
  ['devil', (state, seatId) => handOf(state, seatId)],
]);

function maySay(state: GameState, shown: Shown, seatId: string, registry: ContentRegistry): boolean {
  if ((shown.acted ?? []).includes(seatId)) return false;
  return skillsInPlay(state, seatId, registry).some((s) => (JUDGMENT_CHANGERS.get(s.skill.id)?.(state, seatId, registry).length ?? 0) > 0);
}
```

(The map is filled at module load by each changer's own file: Task 7 adds `dark-magic` from `wind.ts` with `JUDGMENT_CHANGERS.set(...)`.)

- [ ] **Step 6: The mode**

`projects/content/src/lib/modes/kingdomWar.ts`:
- `setup`: each seat gets `pile: { zoneId: `${id}:pile` }`; the zones gain `{ id: s.pile!.zoneId, kind: 'pile' as const, ownerSeatId: s.id, cards: [] }` per seat (after the judgment zone).
- The elimination trigger discards `[seat.hand, seat.equipped, seat.judgment, ...(seat.pile ? [seat.pile] : [])]`.
- `hpDropTriggers`' dying effect adds `pointsBelowOne`:

```ts
      effect: (state, subject) => {
        const seat = seatOf(state, subject)!;
        const event = subject as DamageDealtEvent | HpLostEvent;
        const amount = event.kind === 'HpLostEvent' ? event.amount : event.damage.amount;
        return [{
          kind: 'DyingEffect',
          seatId: seat.id,
          order: turnOrderFrom(state, state.turn.ownerSeatId),
          rescueCardIds: RESCUE_CARD_IDS,
          entering: true,
          // How many points of HP this drop took below 1 (Refusing Death turns one card each).
          pointsBelowOne: Math.min(amount, 1 - seat.combinedHp),
        }];
      },
```

- [ ] **Step 7: Run the tests, the suite, and commit**

Run: `npx jest projects/content`, then `npx jest` — Expected: PASS. (`kingdomWar.spec.ts` cases that compare whole seats or zone lists gain the pile; update those expectations.)

```bash
git add projects/engine projects/content
git commit -m "feat(content): suits through suitOf, judgment changers by their cards, a pile under each General, pointsBelowOne

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 5: Cao Ren, Xiahou Yuan, Huang Zhong, Wei Yan — Entrench, Godspeed, Strong Bow, Violent Spirit

Rule text: stage 8 spec, "Wei" and "Shu".

**Files:**
- Modify: `projects/content/src/lib/generals/wind.ts`
- Create: `projects/content/src/lib/generals/wind-wei-shu.spec.ts`

**Interfaces:**
- Consumes: `TurnFaceDownEffect`, the Play skip mid-phase (Task 2); `UseCardEffect`; `atStep`, `askAtStep`, `actedOn`; `shared/skills.ts`; `untargetableBy`, `attackRange`, `seatDistance`, `handOf`.
- Produces: `WIND_GENERALS` entries `cao-ren` (`entrench`), `xiahou-yuan` (`godspeed`), `huang-zhong` (`strongBow`), `wei-yan` (`violentSpirit`). Godspeed's Sha is `GODSPEED_SHA = { as: 'sha', colour: 'none', physical: [] }`. Outcomes: `unblockable` (Strong Bow, `targetSeatId`), `used` (Violent Spirit).

- [ ] **Step 1: Write the failing tests**

Create `projects/content/src/lib/generals/wind-wei-shu.spec.ts`:

```ts
import type { GameState } from 'engine';
import { abilityLog, askedAbout, card, handIds, harness, hp, table, TableOptions } from './skills.testing';

const h = harness();
const at = (seatId: string, general: string, revealed = true): TableOptions['generals'] => ({ [seatId]: [general, 'zhang-he', revealed] });
const pile = Array.from({ length: 6 }, (_, i) => card(`d${i + 1}`, 'shan', 'diamond', i + 1));

describe('Cao Ren — Entrench', () => {
  const ending = () => h.act(table({ drawPile: pile }, { generals: at('seat-a', 'cao-ren') }), { kind: 'EndPhaseAction', seatId: 'seat-a' });

  it('at the start of his End Phase, may turn face down and draw 3', () => {
    const s = ending();
    expect(askedAbout(s)).toBe('entrench');
    const used = h.use(s);
    expect(used.seats[0].faceDown).toBe(true);
    expect(handIds(used, 'seat-a')).toEqual(['d1', 'd2', 'd3']);
    expect(h.decline(s).seats[0].faceDown).toBeUndefined();
  });
});

describe('Xiahou Yuan — Godspeed', () => {
  // seat-d's turn ends; seat-a's begins.
  const turnStarts = (cards: Record<string, ReturnType<typeof card>[]> = {}) =>
    h.settle(table(cards, { generals: at('seat-a', 'xiahou-yuan'), owner: 'seat-d', phase: 'End' }));

  it('option 1: skips Judgment and Draw to use a Sha on any seat, ignoring distance, outside the Sha limit', () => {
    let s = turnStarts();
    expect(askedAbout(s)).toBe('godspeed');
    s = h.use(s);
    expect(s.pendingChoice?.options.map((o) => o.id)).toEqual(['seat-b', 'seat-c', 'seat-d']);
    s = h.choose(s, 'seat-c');
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-c', allowedCardIds: ['shan'] });
    s = h.pass(s);
    expect(hp(s, 'seat-c')).toBe(3);
    expect(s.log.filter((e) => e.kind === 'PhaseSkippedEvent').map((e) => e.kind === 'PhaseSkippedEvent' && e.phase)).toEqual(['Judgment', 'Draw']);
    expect(s.turn.cardPlays).toBeUndefined();
    expect(s.phase).toBe('Play');
  });

  it('option 2: as the Play Phase begins, skips it and discards an Equipment card to use a Sha; the turn moves on', () => {
    let s = h.settle(table({ 'seat-a:hand': [card('cb', 'crossbow', 'diamond', 1)] }, { generals: at('seat-a', 'xiahou-yuan'), phase: 'Draw' }));
    expect(askedAbout(s)).toBe('godspeed');
    s = h.use(s);
    expect(s.pendingSelection?.eligibleIds).toEqual(['cb']);
    s = h.choose(h.select(s, 'cb'), 'seat-c');
    s = h.pass(s);
    expect(hp(s, 'seat-c')).toBe(3);
    expect(s.log.some((e) => e.kind === 'PhaseChangedEvent' && e.seatId === 'seat-a' && e.phase === 'Discard')).toBe(true);
    expect(s.turn.ownerSeatId).toBe('seat-b');
  });

  it('both options in one turn', () => {
    let s = turnStarts({ 'seat-a:hand': [card('cb', 'crossbow', 'diamond', 1)] });
    s = h.pass(h.choose(h.use(s), 'seat-b'));
    expect(askedAbout(s)).toBe('godspeed'); // the Play Phase's ask
  });
});

describe('Huang Zhong — Strong Bow', () => {
  const shot = (bHand: number) =>
    h.play(table({ 'seat-a:hand': [card('s1', 'sha')], 'seat-b:hand': [card('n1', 'shan'), ...Array.from({ length: bHand - 1 }, (_, i) => card(`b${i}`, 'peach', 'heart'))] }, { generals: at('seat-a', 'huang-zhong') }), 's1', 'seat-b');

  it('when the target holds at least his HP in cards, may make the Sha unblockable', () => {
    let s = shot(4);
    expect(askedAbout(s)).toBe('strong-bow');
    s = h.use(s);
    expect(s.pendingResponse).toBeNull();
    expect(hp(s, 'seat-b')).toBe(3);
    expect(abilityLog(s)).toEqual([expect.objectContaining({ abilityId: 'strong-bow', outcome: 'unblockable', targetSeatId: 'seat-b' })]);
  });

  it('or at most his attack range in cards; otherwise not asked', () => {
    expect(askedAbout(shot(1))).toBe('strong-bow');
    expect(askedAbout(shot(2))).toBeNull();
  });
});

describe('Wei Yan — Violent Spirit', () => {
  it('recovers 1 HP per point of damage he deals to a seat in his attack range', () => {
    const s = h.pass(h.play(table({ 'seat-a:hand': [card('s1', 'sha')] }, { generals: at('seat-a', 'wei-yan'), hp: { 'seat-a': 2 }, flags: { wine: true } }), 's1', 'seat-b'));
    expect(hp(s, 'seat-b')).toBe(2);
    expect(hp(s, 'seat-a')).toBe(4);
  });

  it('not for a seat outside his range', () => {
    const s = h.pass(h.play(table({ 'seat-a:hand': [card('du', 'duel', 'spade', 1)] }, { generals: at('seat-a', 'wei-yan'), hp: { 'seat-a': 2 } }), 'du', 'seat-c'));
    expect(hp(s, 'seat-c')).toBe(3);
    expect(hp(s, 'seat-a')).toBe(2);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx jest projects/content/src/lib/generals/wind-wei-shu.spec.ts`
Expected: FAIL — no ask, no heal.

- [ ] **Step 3: Write the skills**

Replace `projects/content/src/lib/generals/wind.ts` with:

```ts
import type { DamageDealtEvent, Effect, GameState, GeneralOwner, PhaseChangedEvent, SkillDefinition, UsedCard } from 'engine';
import { skipFlagOf } from 'engine';
import type { ContentRegistry } from 'engine';
import type { GeneralSkillSet } from './types';
import { attackRange, handOf, seatDistance } from '../shared/queries';
import { untargetableBy } from '../shared/abilities';
import { actedOn, askAtStep, atStep } from '../shared/steps';
import { ask, choiceOf, discardMoves, draw, equipZoneId, heal, isLiving, on, otherLivingSeatIds, seatOptions, selectionOf, skillStep, used } from '../shared/skills';

// The Wind Generals' skills (stage 8 spec, "Rule text"). Every skill acts for
// the `owner` the engine passes in: the same General can sit at two seats in
// tests, so a skill must never find "its" seat by searching for its id.

// Entrench (may): at the start of your End Phase, you may turn your seat face
// down and draw 3 cards.
export const entrench: SkillDefinition = {
  id: 'entrench',
  triggers: [
    on<PhaseChangedEvent>('after:PhaseChangedEvent', {
      condition: (_state, event, owner) => event.phase === 'End' && event.seatId === owner.seatId,
      effect: (_state, _event, owner) => [ask(owner, [{ kind: 'TurnFaceDownEffect', seatId: owner.seatId }, draw(owner.seatId, 3)])],
    }),
  ],
};

// Godspeed's Sha: no physical card, outside the Sha limit.
export const GODSPEED_SHA: UsedCard = { as: 'sha', colour: 'none', physical: [] };

// The seats a Sha of `seatId` may target, ignoring distance.
const anyShaTarget = (state: GameState, seatId: string, registry: ContentRegistry) =>
  otherLivingSeatIds(state, seatId).filter((id) => !untargetableBy(state, id, 'sha', registry));

// The Equipment cards `seatId` holds or wears.
const equipmentOf = (state: GameState, seatId: string, registry: ContentRegistry) => [
  ...handOf(state, seatId).filter((c) => registry.cards.get(c.definitionId)?.category === 'equipment'),
  ...(state.zones.find((z) => z.id === equipZoneId(state, seatId))?.cards ?? []),
];

// Godspeed (may; each option at most once per turn): skip your Judgment and
// Draw Phases (asked as the turn starts, since the Judgment Phase judges on
// entry), or skip your Play Phase and discard an Equipment card (asked as it
// begins). Either way you use a Sha on any seat a Sha may target, ignoring
// distance.
export const godspeed: SkillDefinition = {
  id: 'godspeed',
  triggers: [
    on<PhaseChangedEvent>('after:PhaseChangedEvent', {
      condition: (state, event, owner, registry) => event.phase === 'Start' && event.seatId === owner.seatId && anyShaTarget(state, owner.seatId, registry).length > 0,
      effect: (_state, _event, owner) => [
        ask(owner, [{ kind: 'SetTurnFlagEffect', flag: skipFlagOf('Judgment') }, { kind: 'SetTurnFlagEffect', flag: skipFlagOf('Draw') }, skillStep(owner, 'sha')]),
      ],
    }),
    on<PhaseChangedEvent>('after:PhaseChangedEvent', {
      condition: (state, event, owner, registry) =>
        event.phase === 'Play' && event.seatId === owner.seatId && equipmentOf(state, owner.seatId, registry).length > 0 && anyShaTarget(state, owner.seatId, registry).length > 0,
      effect: (state, _event, owner, registry) => [
        ask(owner, [
          selectionOf(state, owner, {
            of: 'cards', eligibleIds: equipmentOf(state, owner.seatId, registry).map((c) => c.instanceId), min: 1, max: 1,
            then: { kind: 'skill-step', step: skillStep(owner, 'discarded') }, onCancel: [],
          }),
        ]),
      ],
    }),
  ],
  onStep: (state, step, registry) => {
    const { owner } = step;
    if (step.step === 'discarded') {
      // The Play Phase ends once the Sha is done (a Play Phase flagged to skip ends at once).
      return [...discardMoves(state, (step.data?.['picked'] as string[]) ?? []), { kind: 'SetTurnFlagEffect', flag: skipFlagOf('Play') }, skillStep(owner, 'sha')];
    }
    const targets = anyShaTarget(state, owner.seatId, registry);
    const shaAt = (seatId: string): Effect[] => [{ kind: 'UseCardEffect', seatId: owner.seatId, card: GODSPEED_SHA, targets: [{ kind: 'seat', seatId }] }];
    return targets.length > 0 && isLiving(state, owner.seatId) ? [choiceOf(state, owner, { verb: 'pick', options: seatOptions(targets, shaAt) })] : [];
  },
};

const hpOf = (state: GameState, seatId: string) => state.seats.find((s) => s.id === seatId)?.combinedHp ?? 0;

// Strong Bow (may): in your turn, after your Sha targets a seat whose hand size
// is at least your HP, or at most your attack range, you may make it
// unblockable.
export const strongBow: SkillDefinition = {
  id: 'strong-bow',
  triggers: [
    atStep(['sha-targeted'], {
      condition: (state, step, owner, registry) => {
        if (owner.kind !== 'general' || step.userSeatId !== owner.seatId || state.turn.ownerSeatId !== owner.seatId) return false;
        const cards = handOf(state, step.target.seatId).length;
        return cards >= hpOf(state, owner.seatId) || cards <= attackRange(state, owner.seatId, registry);
      },
      effect: (_state, step, owner) => {
        const passed = actedOn(step, owner);
        return [askAtStep(owner, 'strong-bow', step, [used(owner as GeneralOwner, 'unblockable', step.target.seatId), { ...passed, data: { ...passed.data, unblockable: true } }])];
      },
    }),
  ],
};

// Violent Spirit (compulsory): after you deal damage to a seat within your
// attack range (measured after the damage), you recover 1 HP per point dealt.
export const violentSpirit: SkillDefinition = {
  id: 'violent-spirit',
  compulsory: true,
  triggers: [
    on<DamageDealtEvent>('after:DamageDealtEvent', {
      condition: (state, event, owner, registry) => {
        const { source, target, amount } = event.damage;
        return (
          source?.kind === 'seat' && source.seatId === owner.seatId && target.seatId !== owner.seatId && amount > 0 &&
          seatDistance(state, owner.seatId, target.seatId, registry) <= attackRange(state, owner.seatId, registry)
        );
      },
      effect: (_state, event, owner) => [used(owner), heal(owner.seatId, event.damage.amount)],
    }),
  ],
};

export const WIND_GENERALS: GeneralSkillSet[] = [
  { id: 'cao-ren', skills: [entrench] },
  { id: 'xiahou-yuan', skills: [godspeed] },
  { id: 'huang-zhong', skills: [strongBow] },
  { id: 'wei-yan', skills: [violentSpirit] },
];
```

- [ ] **Step 4: Run the tests, the suite, and commit**

Run: `npx jest projects/content/src/lib/generals/wind-wei-shu.spec.ts`, then `npx jest` — Expected: PASS.

```bash
git add projects/content
git commit -m "feat(content): Entrench, Godspeed, Strong Bow and Violent Spirit

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Xiao Qiao and Zhou Tai — Fantasy, Beauty, Refusing Death

**Files:**
- Modify: `projects/content/src/lib/generals/wind.ts`
- Create: `projects/content/src/lib/generals/wind-wu.spec.ts`

**Interfaces:**
- Consumes: `suitOf` (Task 4); `DamageEffect.acted`, `DyingEffect.acted`/`pointsBelowOne`, `pileZoneOf`, `drawPileTop` (Task 2).
- Produces: `WIND_GENERALS` gains `xiao-qiao` (`fantasy`, `beauty`) and `zhou-tai` (`refusingDeath`). Refusing Death outcomes: `stays-alive` (no dying round) and `matched` (dying round goes ahead).

- [ ] **Step 1: Write the failing tests**

Create `projects/content/src/lib/generals/wind-wu.spec.ts`:

```ts
import type { Effect } from 'engine';
import { usedCardOf } from 'engine';
import { abilityLog, askedAbout, card, handIds, harness, hp, ids, kwMode, seat, table, TableOptions } from './skills.testing';

const h = harness();
const kw = harness(kwMode);
const xiaoQiao: TableOptions['generals'] = { 'seat-a': ['xiao-qiao', 'sun-ce'] };
const zhouTai: TableOptions['generals'] = { 'seat-a': ['zhou-tai', 'sun-ce'] };
const hit = (amount: number, source: string | null = 'seat-b'): Effect => ({
  kind: 'DamageEffect', damage: { source: source ? seat(source) : null, target: seat('seat-a'), amount, nature: 'normal' },
});

describe('Xiao Qiao — Fantasy', () => {
  it('discards a heart card to move the damage to another seat, which then draws as many as it is missing HP', () => {
    let s = h.run(table({ 'seat-a:hand': [card('h', 'peach', 'heart')], drawPile: [card('d1', 'shan')] }, { generals: xiaoQiao }), [hit(1)]);
    expect(askedAbout(s)).toBe('fantasy');
    s = h.choose(h.select(h.use(s), 'h'), 'seat-c');
    expect(hp(s, 'seat-a')).toBe(4);
    expect(hp(s, 'seat-c')).toBe(3);
    expect(handIds(s, 'seat-c')).toEqual(['d1']);
  });

  it("Beauty: her spades count as hearts for Fantasy's cost", () => {
    const s = h.use(h.run(table({ 'seat-a:hand': [card('sp', 'sha', 'spade'), card('cl', 'sha', 'club')] }, { generals: xiaoQiao }), [hit(1)]));
    expect(s.pendingSelection?.eligibleIds).toEqual(['sp']);
  });

  it("Don't, or no heart: the damage is hers", () => {
    expect(hp(h.decline(h.run(table({ 'seat-a:hand': [card('h', 'peach', 'heart')] }, { generals: xiaoQiao }), [hit(1)])), 'seat-a')).toBe(3);
    expect(h.run(table({ 'seat-a:hand': [card('cl', 'sha', 'club')] }, { generals: xiaoQiao }), [hit(1)]).pendingChoice).toBeUndefined();
  });
});

describe('Xiao Qiao — Beauty and the delayed Tools', () => {
  const judgedOnHer = (tool: string, judged: ReturnType<typeof card>) =>
    kw.settle(table({ 'seat-a:judgment': [card('t', tool, 'spade', 1)], drawPile: [judged, ...Array.from({ length: 4 }, (_, i) => card(`f${i}`, 'shan', 'diamond'))] }, { generals: xiaoQiao, phase: 'Start' }));

  it('a spade judged for her Capture counts as a heart and spares her Play Phase', () => {
    const s = judgedOnHer('capture', card('j', 'sha', 'spade', 9));
    expect(s.phase).toBe('Play');
    expect(s.turn.ownerSeatId).toBe('seat-a');
  });

  it('a spade 5 judged for her Lightning counts as a heart: no strike', () => {
    expect(hp(judgedOnHer('lightning', card('j', 'sha', 'spade', 5)), 'seat-a')).toBe(4);
  });
});

describe('Zhou Tai — Refusing Death', () => {
  const zt = (drawPile: ReturnType<typeof card>[]) => table({ drawPile }, { generals: zhouTai, hp: { 'seat-a': 1 } });

  it('from 1 HP to -1: two cards turned, each asked; no match, so he stays alive with no dying round', () => {
    let s = kw.run(zt([card('r1', 'shan', 'heart', 5), card('r2', 'shan', 'heart', 7)]), [hit(2)]);
    expect(askedAbout(s)).toBe('refusing-death');
    s = kw.use(s);
    expect(askedAbout(s)).toBe('refusing-death');
    s = kw.use(s);
    expect(hp(s, 'seat-a')).toBe(-1);
    expect(s.seats[0].eliminated).toBe(false);
    expect(s.pendingResponse).toBeNull();
    expect(ids(s, 'seat-a:pile')).toEqual(['r1', 'r2']);
    expect(abilityLog(s).at(-1)).toMatchObject({ abilityId: 'refusing-death', outcome: 'stays-alive' });
  });

  it('a later hit of 1 turns one more card', () => {
    let s = kw.use(kw.use(kw.run(zt([card('r1', 'shan', 'heart', 5), card('r2', 'shan', 'heart', 7), card('r3', 'shan', 'heart', 9)]), [hit(2)])));
    s = kw.run(s, [hit(1)]);
    expect(askedAbout(s)).toBe('refusing-death');
    s = kw.use(s);
    expect(ids(s, 'seat-a:pile')).toEqual(['r1', 'r2', 'r3']);
    expect(hp(s, 'seat-a')).toBe(-2);
  });

  it('a matching rank: the dying round goes ahead', () => {
    const s = kw.use(kw.use(kw.run(zt([card('r1', 'shan', 'heart', 5), card('r2', 'sha', 'spade', 5)]), [hit(2)])));
    expect(s.pendingResponse?.reason).toEqual({ kind: 'dying', seatId: 'seat-a' });
    expect(abilityLog(s).at(-1)).toMatchObject({ outcome: 'matched' });
  });

  it("Don't: the dying round goes ahead", () => {
    expect(kw.decline(kw.run(zt([card('r1', 'shan', 'heart', 5)]), [hit(1)])).pendingResponse?.reason).toEqual({ kind: 'dying', seatId: 'seat-a' });
  });

  it('each time he recovers HP, he may discard one of the cards', () => {
    let s = kw.use(kw.run(zt([card('r1', 'shan', 'heart', 5)]), [hit(1)]));
    s = kw.run(s, [{ kind: 'HealEffect', target: seat('seat-a'), amount: 1 }]);
    expect(askedAbout(s)).toBe('refusing-death');
    s = kw.select(kw.use(s), 'r1');
    expect(ids(s, 'seat-a:pile')).toEqual([]);
    expect(ids(s, 'discardPile')).toContain('r1');
  });
});
```

`table()` in `skills.testing.ts` gives no seat a pile. In this step also extend it: each seat gets `pile: { zoneId: `${id}:pile` }` and a `pile` zone filled from `cards[`${id}:pile`]`. Run the whole content suite after that edit (only `toEqual`s on whole seats or zone lists should notice; add the pile to them).

- [ ] **Step 2: Run them to see them fail**

Run: `npx jest projects/content/src/lib/generals/wind-wu.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Write the skills**

In `projects/content/src/lib/generals/wind.ts` extend the imports (`HealEvent` type; `drawPileTop`, `pileZoneOf` from `engine`; `abilityKey` from `../shared/steps`; `suitOf` from `../shared/suits`; `isHurt` is not needed) and add before `WIND_GENERALS`:

```ts
type DamageStep = Extract<Effect, { kind: 'DamageEffect' }>;
type Dying = Extract<Effect, { kind: 'DyingEffect' }>;

// Her hand cards that count as hearts.
const heartsIn = (state: GameState, seatId: string, registry: ContentRegistry) => handOf(state, seatId).filter((c) => suitOf(state, seatId, c, registry) === 'heart');

// Fantasy (may): when damage would be dealt to you, you may discard a heart
// card to move it onto another living seat (same source, amount and cause).
// After it is dealt, that seat draws as many cards as it is missing HP.
export const fantasy: SkillDefinition = {
  id: 'fantasy',
  triggers: [
    on<DamageStep>('before:DamageEffect', {
      condition: (state, step, owner, registry) =>
        step.damage.target.seatId === owner.seatId && step.damage.amount > 0 && !(step.acted ?? []).includes(abilityKey(owner)) &&
        heartsIn(state, owner.seatId, registry).length > 0 && otherLivingSeatIds(state, owner.seatId).length > 0,
      effect: (state, step, owner, registry) => {
        const passed: DamageStep = { ...step, acted: [...(step.acted ?? []), abilityKey(owner)] };
        const pick = selectionOf(state, owner, {
          of: 'cards', eligibleIds: heartsIn(state, owner.seatId, registry).map((c) => c.instanceId), min: 1, max: 1,
          then: { kind: 'skill-step', step: skillStep(owner, 'discarded', { damage: passed }) }, onCancel: [passed],
        });
        return [ask(owner, [pick], [passed])];
      },
    }),
  ],
  onStep: (state, step) => {
    const { owner } = step;
    const damage = step.data?.['damage'] as DamageStep;
    if (step.step === 'discarded') return [...discardMoves(state, (step.data?.['picked'] as string[]) ?? []), skillStep(owner, 'move', { damage })];
    if (step.step === 'move') {
      const moveTo = (seatId: string): Effect[] => [{ ...damage, damage: { ...damage.damage, target: { kind: 'seat', seatId } } }, skillStep(owner, 'draw', { seatId })];
      return [choiceOf(state, owner, { verb: 'pick', options: seatOptions(otherLivingSeatIds(state, owner.seatId), moveTo) })];
    }
    // 'draw': the seat that took it draws as many cards as it is missing HP.
    const seatId = step.data?.['seatId'] as string;
    const seat = state.seats.find((s) => s.id === seatId);
    const missing = seat && !seat.eliminated ? seat.maxCombinedHp - Math.max(seat.combinedHp, 0) : 0;
    return missing > 0 ? [draw(seatId, missing)] : [];
  },
};

// Beauty (compulsory): your spades count as hearts (suitOf).
export const beauty: SkillDefinition = { id: 'beauty', compulsory: true, modifiers: { suitAs: { spade: 'heart' } } };

// One Refusing Death card: asked, then turned up under the General and checked.
const refusingAsk = (owner: GeneralOwner, dying: Dying, left: number): Effect => ask(owner, [skillStep(owner, 'turn', { dying, left })], [dying]);

// Refusing Death (may): when you would enter the dying round, you may turn the
// top card of the draw pile face up under your General, and again for each
// further point the drop took below 1. A rank already there: the dying round
// goes ahead. Otherwise you stay alive below 0 HP. Each time you recover HP,
// you may discard one of those cards.
export const refusingDeath: SkillDefinition = {
  id: 'refusing-death',
  triggers: [
    on<Dying>('before:DyingEffect', {
      condition: (state, dying, owner) =>
        dying.entering === true && dying.seatId === owner.seatId && !(dying.acted ?? []).includes(abilityKey(owner)) && !!pileZoneOf(state, owner.seatId) && drawPileTop(state, 1).length > 0,
      effect: (_state, dying, owner) => [refusingAsk(owner, { ...dying, acted: [...(dying.acted ?? []), abilityKey(owner)] }, Math.max(1, dying.pointsBelowOne ?? 1))],
    }),
    on<HealEvent>('after:HealEvent', {
      condition: (state, event, owner) => event.target.seatId === owner.seatId && isLiving(state, owner.seatId) && (pileZoneOf(state, owner.seatId)?.cards.length ?? 0) > 0,
      effect: (state, _event, owner) => [
        ask(owner, [
          selectionOf(state, owner, { of: 'cards', eligibleIds: pileZoneOf(state, owner.seatId)!.cards.map((c) => c.instanceId), min: 1, max: 1, then: { kind: 'discard' }, onCancel: [] }),
        ]),
      ],
    }),
  ],
  onStep: (state, step) => {
    const { owner } = step;
    const dying = step.data?.['dying'] as Dying;
    const left = step.data?.['left'] as number;
    const pile = pileZoneOf(state, owner.seatId);
    if (step.step === 'turn') {
      const [top] = drawPileTop(state, 1);
      if (!top || !pile) return [dying];
      return [{ kind: 'MoveCardEffect', cardInstanceId: top.instanceId, toZoneId: pile.id }, skillStep(owner, 'check', { dying, left, cardInstanceId: top.instanceId })];
    }
    // 'check': a matching rank sends him to the dying round.
    const turned = pile?.cards.find((c) => c.instanceId === step.data?.['cardInstanceId']);
    if (!turned || pile!.cards.some((c) => c.instanceId !== turned.instanceId && c.rank === turned.rank)) return [used(owner, 'matched'), dying];
    return left > 1 ? [refusingAsk(owner, dying, left - 1)] : [used(owner, 'stays-alive')];
  },
};
```

and `WIND_GENERALS` gains `{ id: 'xiao-qiao', skills: [fantasy, beauty] }` and `{ id: 'zhou-tai', skills: [refusingDeath] }`.

- [ ] **Step 4: Run the tests, the suite, and commit**

Run: `npx jest projects/content/src/lib/generals/wind-wu.spec.ts`, then `npx jest`.
Expected: PASS, except the sim's property test, which may now find Zhou Tai alive below 0 HP ("living at … HP with no rescue round pending"). That check learns about Refusing Death in Task 10. If it fails here, pull that one change forward: in `projects/sim/src/invariants.ts`, a living seat at 0 HP or below is fine when its latest `AbilityUsedEvent` with outcome `stays-alive` comes after its latest `DamageDealtEvent`/`HpLostEvent`. Ledger it as a ruling.

```bash
git add projects/content projects/sim
git commit -m "feat(content): Fantasy, Beauty and Refusing Death

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Zhang Jiao — Lightning Strike, Dark Magic (and Amber Sky)

**Files:**
- Modify: `projects/content/src/lib/generals/wind.ts`
- Create: `projects/content/src/lib/generals/wind-qun.spec.ts`

**Interfaces:**
- Consumes: `JUDGMENT_CHANGERS`, `nextToChange` (Task 4); `ReplaceJudgmentEffect.oldTo` via the `replace-judgment` continuation (Task 2); `colourFor`, `suitOf`.
- Produces: `WIND_GENERALS` gains `zhang-jiao` (`lightningStrike`, `darkMagic`, `amberSky`); `JUDGMENT_CHANGERS` gains `dark-magic`.

- [ ] **Step 1: Write the failing tests**

Create `projects/content/src/lib/generals/wind-qun.spec.ts`:

```ts
import { usedCardOf } from 'engine';
import { askedAbout, card, handIds, harness, hp, ids, table, TableOptions } from './skills.testing';

const h = harness();
const zhangJiao = (seatId: string): TableOptions['generals'] => ({ [seatId]: ['zhang-jiao', 'zuo-ci'] });

describe('Zhang Jiao — Lightning Strike', () => {
  const dodged = (judged: ReturnType<typeof card>) => {
    let s = h.play(table({ 'seat-b:hand': [card('s1', 'sha')], 'seat-a:hand': [card('n1', 'shan')], drawPile: [judged] }, { owner: 'seat-b', generals: zhangJiao('seat-a') }), 's1', 'seat-a');
    s = h.respond(s, 'n1');
    expect(askedAbout(s)).toBe('lightning-strike');
    return h.choose(h.use(s), 'seat-b');
  };

  it('after he plays a Shan, a seat he picks judges: on a spade it takes 2 plain damage with no source', () => {
    const s = dodged(card('j', 'sha', 'spade', 5));
    expect(hp(s, 'seat-b')).toBe(2);
    expect(s.log.filter((e) => e.kind === 'DamageDealtEvent').at(-1)).toMatchObject({ damage: { source: null, amount: 2, nature: 'normal' } });
  });

  it('anything else does nothing', () => {
    expect(hp(dodged(card('j', 'sha', 'heart', 5)), 'seat-b')).toBe(4);
  });
});

describe('Zhang Jiao — Dark Magic', () => {
  const capture = usedCardOf(card('cp', 'capture', 'spade', 6));
  const judgedOnC = (generals: TableOptions['generals'], hands: Record<string, ReturnType<typeof card>[]>, judged = card('j', 'peach', 'heart', 4)) =>
    h.run(table({ ...Object.fromEntries(Object.entries(hands).map(([id, cs]) => [`${id}:hand`, cs])), drawPile: [judged] }, { generals }), [
      { kind: 'JudgeEffect', seatId: 'seat-c', reader: { kind: 'card', card: capture } },
    ]);

  it('replaces the judged card with a black card; the old card goes to his hand', () => {
    let s = judgedOnC(zhangJiao('seat-a'), { 'seat-a': [card('k', 'sha', 'club', 3), card('r', 'peach', 'heart', 2)] });
    expect(askedAbout(s)).toBe('dark-magic');
    s = h.use(s);
    expect(s.pendingSelection?.eligibleIds).toEqual(['k']);
    s = h.select(s, 'k');
    expect(handIds(s, 'seat-a')).toEqual(['r', 'j']);
    expect(s.turn.flags).toEqual({ skipPlay: true }); // a club: the Capture lands
    expect(ids(s, 'discardPile')).toEqual(['k']);
  });

  it('is ordered with Devil, from the judged seat', () => {
    const s = judgedOnC({ ...zhangJiao('seat-d'), 'seat-b': ['sima-yi', 'xun-yu'] }, { 'seat-d': [card('k', 'sha', 'club', 3)], 'seat-b': [card('x', 'shan')] });
    expect(s.pendingChoice).toMatchObject({ seatId: 'seat-d', reason: { abilityId: 'dark-magic' } });
    expect(h.decline(s).pendingChoice).toMatchObject({ seatId: 'seat-b', reason: { abilityId: 'devil' } });
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx jest projects/content/src/lib/generals/wind-qun.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Write the skills**

In `projects/content/src/lib/generals/wind.ts` (imports: `CardPlayedEvent` type; `JUDGMENT_CHANGERS`, `nextToChange` from `../shared/judgments`; `colourFor` from `../shared/suits`; `ownCards`, `handZoneId`, `skillDamage` is not used — Lightning Strike's damage has no source) add:

```ts
type Shown = Extract<Effect, { kind: 'JudgmentShownEffect' }>;

// Lightning Strike (may): after you play or use a Shan, you may pick any
// living seat. It judges: on a spade it takes 2 plain damage with no source.
export const lightningStrike: SkillDefinition = {
  id: 'lightning-strike',
  triggers: [
    on<CardPlayedEvent>('after:CardPlayedEvent', {
      condition: (_state, event, owner) => event.seatId === owner.seatId && event.card.as === 'shan',
      effect: (_state, _event, owner) => [ask(owner, [skillStep(owner, 'pick')])],
    }),
  ],
  onStep: (state, step) => {
    const { owner } = step;
    const living = state.seats.filter((s) => !s.eliminated).sort((a, b) => a.index - b.index).map((s) => s.id);
    const judge = (seatId: string): Effect[] => [{ kind: 'JudgeEffect', seatId, reader: { kind: 'skill', owner } }];
    return [choiceOf(state, owner, { verb: 'pick', options: seatOptions(living, judge) })];
  },
  onJudged: (state, { owner, seatId, judged, done }, registry) =>
    suitOf(state, seatId, judged, registry) === 'spade' && isLiving(state, seatId)
      ? [done, { kind: 'DamageEffect', damage: { source: null, target: { kind: 'seat', seatId }, amount: 2, nature: 'normal', cause: { skillId: owner.skillId } } }]
      : [done],
};

// The black cards in a seat's hand and equipment (Dark Magic's).
const blackCards = (state: GameState, seatId: string, registry: ContentRegistry) => ownCards(state, seatId, true).filter((c) => colourFor(state, seatId, c, registry) === 'black');
JUDGMENT_CHANGERS.set('dark-magic', blackCards);

// Dark Magic (may): when any seat's judgment card is turned up, before it takes
// effect, you may replace it with a black card from your hand or equipment;
// the old card goes into your hand. Ordered with Devil (shared/judgments.ts).
export const darkMagic: SkillDefinition = {
  id: 'dark-magic',
  triggers: [
    on<Shown>('before:JudgmentShownEffect', {
      condition: (state, shown, owner, registry) => nextToChange(state, shown, owner, registry) && blackCards(state, owner.seatId, registry).length > 0,
      effect: (state, shown, owner, registry) => {
        const passed: Shown = { ...shown, acted: [...(shown.acted ?? []), owner.seatId] };
        const pick = selectionOf(state, owner, {
          of: 'cards', eligibleIds: blackCards(state, owner.seatId, registry).map((c) => c.instanceId), min: 1, max: 1,
          then: { kind: 'replace-judgment', judgment: shown.judgment, owner, abilityId: owner.skillId, oldTo: handZoneId(state, owner.seatId) },
          onCancel: [passed], targetSeatId: shown.judgment.seatId,
        });
        return [ask(owner, [pick], [passed], shown.judgment.seatId)];
      },
    }),
  ],
};

// Amber Sky: a Lord skill, inactive in Kingdom War.
export const amberSky: SkillDefinition = { id: 'amber-sky', lord: true };
```

and `WIND_GENERALS` gains `{ id: 'zhang-jiao', skills: [lightningStrike, darkMagic, amberSky] }`.

The seat that has both Devil and Dark Magic doesn't exist (Sima Yi is Wei, Zhang Jiao Qun), so a seat's say covers whichever changer it holds; `nextToChange` already counts a seat once.

- [ ] **Step 4: Run the tests, the suite, and commit**

Run: `npx jest projects/content/src/lib/generals`, then `npx jest` — Expected: PASS.

```bash
git add projects/content
git commit -m "feat(content): Lightning Strike and Dark Magic

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Yu Ji — Bewilder

**Files:**
- Modify: `projects/content/src/lib/generals/wind.ts`, `projects/content/src/lib/shared/skills.ts` (`choiceOf`/`reasonOf` take a `cardId`), `projects/content/src/lib/generals/base.spec.ts` (the Wind loop becomes a real `it`)
- Create: `projects/content/src/lib/generals/bewilder.spec.ts`

**Interfaces:**
- Consumes: deferred conversions, `UseCardEffect.counted`/`answering` (Task 3); `DecisionReason.cardId` (Task 2); `ShowCardEffect`; `suitOf`.
- Produces:
  - `WIND_GENERALS` gains `yu-ji` (`bewilder`), with conversions `bewilder-<card id>` for each of `BEWILDER_CARDS = ['sha', 'shan', 'peach', 'wine', 'duel', 'draw-two', 'barbarians', 'hail-of-arrows', 'peach-garden', 'steal', 'break', 'harvest', 'coerce', 'wuxie']`.
  - Each doubt choice has option ids `believe` (label "Believe") and `doubt` (label "Doubt"), reason `{ kind: 'ability', owner, abilityId: 'bewilder', cardId: <named card> }`, and is asked of each other living seat in turn order from Yu Ji.
  - Outcomes logged: `claim-believed`, `claim-true`, `claim-false`.
  - `reasonOf(owner, targetSeatId?, cardId?)`; `ChoiceSpec.cardId?`.

- [ ] **Step 1: Write the failing tests**

Create `projects/content/src/lib/generals/bewilder.spec.ts`:

```ts
import type { GameState } from 'engine';
import { abilityLog, askedAbout, card, handIds, harness, hp, ids, table, TableOptions } from './skills.testing';

const h = harness();
const yuJi = (seatId = 'seat-a'): TableOptions['generals'] => ({ [seatId]: ['yu-ji', 'zuo-ci'] });
// Each other seat answers in turn: 'b' for believe, 'd' for doubt.
const answer = (s: GameState, answers: string) => [...answers].reduce((acc, a) => h.choose(acc, a === 'd' ? 'doubt' : 'believe'), s);
const claimSha = (claimed: ReturnType<typeof card>, answers: string) =>
  answer(h.select(h.convert(table({ 'seat-a:hand': [claimed], drawPile: [card('d1', 'shan'), card('d2', 'shan')] }, { generals: yuJi() }), 'seat-a', 'bewilder-sha', 'seat-b'), claimed.instanceId), answers);

describe('Yu Ji — Bewilder', () => {
  it('asks every other seat in turn whether it believes, naming the card claimed', () => {
    const s = h.select(h.convert(table({ 'seat-a:hand': [card('x', 'shan')] }, { generals: yuJi() }), 'seat-a', 'bewilder-sha', 'seat-b'), 'x');
    expect(s.pendingChoice).toMatchObject({ seatId: 'seat-b', verb: 'pick', reason: { abilityId: 'bewilder', cardId: 'sha' } });
    expect(s.pendingChoice!.options.map((o) => o.shows)).toEqual([{ kind: 'label', text: 'Believe' }, { kind: 'label', text: 'Doubt' }]);
    expect(h.choose(s, 'believe').pendingChoice?.seatId).toBe('seat-c');
  });

  it('believed by all: the card takes effect as named, and counts as a play', () => {
    const s = claimSha(card('x', 'shan', 'club'), 'bbb');
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-b', allowedCardIds: ['shan'] });
    expect(s.turn.cardPlays).toEqual({ sha: 1 });
    expect(s.log.find((e) => e.kind === 'CardShownEvent')).toMatchObject({ seatId: 'seat-a', card: { instanceId: 'x' } });
    expect(abilityLog(s)).toEqual([expect.objectContaining({ abilityId: 'bewilder', outcome: 'claim-believed' })]);
  });

  it('doubted and a lie: each doubter draws 1, and the card is discarded', () => {
    const s = claimSha(card('x', 'shan', 'club'), 'bdd');
    expect(handIds(s, 'seat-c')).toEqual(['d1']);
    expect(handIds(s, 'seat-d')).toEqual(['d2']);
    expect(ids(s, 'discardPile')).toEqual(['x']);
    expect(s.pendingResponse).toBeNull();
  });

  it('doubted and true on a heart: each doubter loses 1 HP, and the card still takes effect', () => {
    const s = claimSha(card('x', 'sha', 'heart'), 'dbb');
    expect(hp(s, 'seat-b')).toBe(3);
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-b' });
  });

  it('doubted and true on another suit: each doubter loses 1 HP, and the card is discarded', () => {
    const s = claimSha(card('x', 'sha', 'spade'), 'dbb');
    expect(hp(s, 'seat-b')).toBe(3);
    expect(s.pendingResponse).toBeNull();
    expect(ids(s, 'discardPile')).toEqual(['x']);
  });

  it('answering a window: a believed claim answers it', () => {
    let s = h.play(table({ 'seat-b:hand': [card('s1', 'sha')], 'seat-a:hand': [card('x', 'peach', 'heart')] }, { owner: 'seat-b', generals: yuJi() }), 's1', 'seat-a');
    s = h.select(h.convert(s, 'seat-a', 'bewilder-shan'), 'x');
    expect(s.pendingResponse).toBeNull(); // set aside while the seats answer
    s = answer(s, 'bbb');
    expect(hp(s, 'seat-a')).toBe(4);
  });

  it('answering a Wuxie check with no real Wuxie: believed, the Tool is cancelled; caught lying, the check comes back and the Tool goes ahead', () => {
    // seat-b plays Steal on Yu Ji; she holds only x.
    const steal = () => h.play(table({ 'seat-b:hand': [card('st', 'steal', 'spade', 3)], 'seat-a:hand': [card('x', 'shan')] }, { owner: 'seat-b', generals: yuJi() }), 'st', 'seat-a');
    let s = steal();
    expect(s.pendingResponse?.respondingSeatId).toBe('seat-a');
    s = answer(h.select(h.convert(s, 'seat-a', 'bewilder-wuxie'), 'x'), 'bbb');
    expect(s.pendingChoice).toBeUndefined(); // no Steal choice: cancelled
    expect(s.pendingResponse).toBeNull();
    let lie = answer(h.select(h.convert(steal(), 'seat-a', 'bewilder-wuxie'), 'x'), 'bdb');
    expect(lie.pendingResponse?.respondingSeatId).toBe('seat-a');
    lie = h.pass(lie);
    // The Steal goes ahead once: seat-b picks from Yu Ji, whose hand is empty now, so nothing is left to pick.
    expect(lie.log.filter((e) => e.kind === 'CardPlayedEvent' && e.card.as === 'steal')).toHaveLength(1);
    expect(lie.pendingResponse).toBeNull();
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx jest projects/content/src/lib/generals/bewilder.spec.ts`
Expected: FAIL — `bewilder-sha` is not offered.

- [ ] **Step 3: `cardId` in the helpers**

In `projects/content/src/lib/shared/skills.ts`:

```ts
export function reasonOf(owner: GeneralOwner, targetSeatId?: string, cardId?: string): DecisionReason {
  return { kind: 'ability', owner, abilityId: owner.skillId, ...(targetSeatId ? { targetSeatId } : {}), ...(cardId ? { cardId } : {}) };
}
```

`ChoiceSpec` gains `cardId?: string`, and `choiceOf` passes it: `reason: reasonOf(owner, spec.targetSeatId, spec.cardId)`.

- [ ] **Step 4: Bewilder**

In `projects/content/src/lib/generals/wind.ts` (imports: `PendingResponse`, `Target` types; `usedCardFrom` from `engine`) add:

```ts
// The cards Yu Ji may name: every Basic card and non-delayed Tool.
export const BEWILDER_CARDS = ['sha', 'shan', 'peach', 'wine', 'duel', 'draw-two', 'barbarians', 'hail-of-arrows', 'peach-garden', 'steal', 'break', 'harvest', 'coerce', 'wuxie'];

// A Bewilder claim on its way: what was named, at whom, the face-down card,
// the window it answers (set aside meanwhile), and the doubt round so far.
interface Claim {
  as: string;
  conversionId: string;
  targets: Target[];
  cardInstanceId: string;
  window?: PendingResponse;
  order: string[];
  next: number;
  doubters: string[];
}

// Bewilder (in your Play Phase, and to answer a window): you pick a hand card
// face down and name a Basic or non-delayed Tool card you could use now. Each
// other living seat, in turn order, believes or doubts. Then the card is shown:
// nobody doubted, it takes effect as named; doubted and a lie, each doubter
// draws 1 and it is discarded; doubted and true, each doubter loses 1 HP, and it
// takes effect only if it is a heart.
export const bewilder: SkillDefinition = {
  id: 'bewilder',
  conversions: BEWILDER_CARDS.map((as) => ({ id: `bewilder-${as}`, as, cards: 1 as const, when: 'both' as const, deferred: true as const })),
  onStep: (state, step, registry) => {
    const { owner } = step;
    if (step.step === 'deferred') {
      const data = step.data as { as: string; conversionId: string; targets: Target[]; picked: string[]; window?: PendingResponse };
      const claim: Claim = {
        as: data.as, conversionId: data.conversionId, targets: data.targets, cardInstanceId: data.picked[0],
        ...(data.window ? { window: data.window } : {}), order: otherLivingSeatIds(state, owner.seatId), next: 0, doubters: [],
      };
      return [skillStep(owner, 'ask', { claim })];
    }
    const claim = step.data?.['claim'] as Claim;
    if (step.step === 'ask') {
      let i = claim.next;
      while (i < claim.order.length && !isLiving(state, claim.order[i])) i++;
      if (i >= claim.order.length) return [skillStep(owner, 'reveal', { claim })];
      const seatId = claim.order[i];
      const after = (doubters: string[]) => [skillStep(owner, 'ask', { claim: { ...claim, next: i + 1, doubters } })];
      return [
        choiceOf(state, owner, {
          seatId, verb: 'pick', cardId: claim.as,
          options: [
            { id: 'believe', shows: { kind: 'label', text: 'Believe' }, effects: after(claim.doubters) },
            { id: 'doubt', shows: { kind: 'label', text: 'Doubt' }, effects: after([...claim.doubters, seatId]) },
          ],
        }),
      ];
    }
    // 'reveal'
    const reopen: Effect[] = claim.window ? [{ kind: 'OpenResponseEffect', pendingResponse: claim.window }] : [];
    const picked = handOf(state, owner.seatId).find((c) => c.instanceId === claim.cardInstanceId);
    if (!picked) return reopen;
    const show: Effect = { kind: 'ShowCardEffect', seatId: owner.seatId, cardInstanceId: picked.instanceId, abilityId: owner.skillId };
    const useIt: Effect = {
      kind: 'UseCardEffect', seatId: owner.seatId,
      card: usedCardFrom([picked], claim.as, { owner, abilityId: owner.skillId, conversionId: claim.conversionId }),
      targets: claim.targets, counted: !claim.window, ...(claim.window ? { answering: claim.window } : {}),
    };
    const discard = [...discardMoves(state, [picked.instanceId]), ...reopen];
    if (claim.doubters.length === 0) return [show, used(owner, 'claim-believed'), useIt];
    if (picked.definitionId !== claim.as) return [show, used(owner, 'claim-false'), ...claim.doubters.map((id) => draw(id, 1)), ...discard];
    const losses: Effect[] = claim.doubters.map((seatId) => ({ kind: 'LoseHpEffect', seatId, amount: 1, abilityId: owner.skillId }));
    return [show, used(owner, 'claim-true'), ...losses, ...(suitOf(state, owner.seatId, picked, registry) === 'heart' ? [useIt] : discard)];
  },
};
```

and `WIND_GENERALS` gains `{ id: 'yu-ji', skills: [bewilder] }`. In `base.spec.ts` turn the Wind `it.todo` into the real loop over `WIND_GENERAL_IDS`.

- [ ] **Step 5: Run the tests, the suite, and commit**

Run: `npx jest projects/content/src/lib/generals`, then `npx jest`.
Expected: PASS. The sim's random bot may now use Bewilder conversions everywhere; if the property test stops terminating, the rule-based bot's conversion use is the likely cause (Task 9 limits it). In that case, pull Task 9's `conversionSpare` change for deferred conversions forward and ledger it.

```bash
git add projects/content
git commit -m "feat(content): Bewilder — a face-down claim, believed or doubted

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 9: Bots — the Wind skills by the spec's rules

**Files:**
- Create: `projects/bots/src/lib/wind.ts`, `projects/bots/src/lib/wind.spec.ts`
- Modify: `projects/bots/src/lib/skills.ts`

**Interfaces:**
- Consumes: `wantsSkill`, `skillSelection`, `skillChoice`, `conversionSpare`, `devilCard` (stage 7); the helpers in `helpers.ts`.
- Produces:
  - `wantsWind(view, me, choice, registry): boolean | null`, `windSelection(view, me, selection, registry): string[] | 'cancel' | null`, `windChoice(view, me, choice): string | null`. `skills.ts`'s three functions fall back to these in their `default` case.
  - `devilCard(view, me, judgment, registry, candidates?: string[])`: `candidates` defaults to the bot's hand.
  - `conversionSpare` returns false for a deferred conversion unless the bot holds more than 4 cards (it bluffs only then; a true claim it would make with the real card itself).

- [ ] **Step 1: Write the failing tests**

Create `projects/bots/src/lib/wind.spec.ts`, reusing the builder of `skills.spec.ts` (copy its `table`, `decide`, `asking`, `picked`, `general` helpers, or move them to a shared `projects/bots/src/lib/testing.ts` used by both — the move is the better option):

```ts
describe('Wind skills: asks', () => {
  it('Entrench with 2 or fewer cards at 3 HP or more and no hurt ally; not otherwise', () => {
    expect(picked(decide(asking(table({ 'seat-a:hand': [card('x', 'shan')] }), 'entrench')))).toBe('use');
    expect(picked(decide(asking(table({ 'seat-a:hand': ['a', 'b', 'c'].map((id) => card(id, 'shan')) }), 'entrench')))).toBe('decline');
    expect(picked(decide(asking(table({}, { hp: { 'seat-a': 2 } }), 'entrench')))).toBe('decline');
  });

  it('Godspeed at the Start: with an empty Judgment slot and a non-ally at 2 HP or less', () => {
    const start = (hpB: number) => ({ ...asking(table({}, { hp: { 'seat-b': hpB } }), 'godspeed'), phase: 'Start' as const });
    expect(picked(decide(start(2)))).toBe('use');
    expect(picked(decide(start(4)))).toBe('decline');
  });

  it('Strong Bow on a non-ally; Refusing Death and Lightning Strike always', () => {
    expect(picked(decide(asking(table(), 'strong-bow', 'seat-b')))).toBe('use');
    expect(picked(decide(asking(table({}, { kingdoms: { 'seat-b': 'Wei' } }), 'strong-bow', 'seat-b')))).toBe('decline');
    expect(picked(decide(asking(table(), 'refusing-death')))).toBe('use');
    expect(picked(decide(asking(table(), 'lightning-strike')))).toBe('use');
  });

  it('Fantasy with a spare heart when the damage would leave it at 2 HP or less', () => {
    const damage: Effect = { kind: 'DamageEffect', damage: { source: seat('seat-b'), target: seat('seat-a'), amount: 2, nature: 'normal' } };
    expect(picked(decide(asking(table({ 'seat-a:hand': [card('h', 'shan', 'heart')] }), 'fantasy', undefined, [damage])))).toBe('use');
    expect(picked(decide(asking(table({ 'seat-a:hand': [card('p', 'peach', 'heart')] }), 'fantasy', undefined, [damage])))).toBe('decline');
  });
});

describe('Wind skills: picks', () => {
  const pick = (abilityId: string, targetSeatId?: string, cardId?: string, labels?: string[]): GameState => ({
    ...table({}, { hp: { 'seat-c': 2 } }),
    pendingChoice: {
      id: 'p', seatId: 'seat-a', verb: 'pick',
      reason: { kind: 'ability', owner: general(cardId ? 'seat-b' : 'seat-a', abilityId), abilityId, ...(targetSeatId ? { targetSeatId } : {}), ...(cardId ? { cardId } : {}) },
      options: labels
        ? labels.map((id) => ({ id, shows: { kind: 'label' as const, text: id }, effects: [] }))
        : ['seat-b', 'seat-c', 'seat-d'].map((id) => ({ id, shows: { kind: 'seat' as const, seatId: id }, effects: [] })),
    },
  });

  it('Godspeed, Fantasy and Lightning Strike aim at the weakest non-ally', () => {
    for (const id of ['godspeed', 'fantasy', 'lightning-strike']) expect(picked(decide(pick(id)))).toBe('seat-c');
  });

  it('Believe or Doubt: an ally believes; a non-ally doubts a Sha, Peach or Wuxie at 3 HP or more', () => {
    expect(picked(decide(pick('bewilder', undefined, 'sha', ['believe', 'doubt'])))).toBe('doubt');
    expect(picked(decide(pick('bewilder', undefined, 'draw-two', ['believe', 'doubt'])))).toBe('believe');
    const ally = { ...pick('bewilder', undefined, 'sha', ['believe', 'doubt']) };
    ally.seats = ally.seats.map((s) => (s.id === 'seat-b' ? { ...s, kingdom: 'Wei' as const } : s));
    expect(picked(decide(ally))).toBe('believe');
  });
});

describe('Bewilder as Yu Ji', () => {
  it('bluffs only with more than 4 cards', () => {
    const yuJi = (n: number) => table({ 'seat-a:hand': Array.from({ length: n }, (_, i) => card(`x${i}`, 'shan', 'club', i + 2)) }, { generals: { 'seat-a': ['yu-ji', 'zuo-ci'] }, kingdoms: { 'seat-a': 'Qun' } });
    expect(decide(yuJi(3)).kind).toBe('EndPhaseAction');
    expect(decide(yuJi(5))).toMatchObject({ kind: 'UseConversionAction', via: { conversionId: expect.stringMatching(/^bewilder-/) } });
  });
});
```

(`Effect`, `seat`, `GameState` imports as in `skills.spec.ts`.)

- [ ] **Step 2: Run them to see them fail**

Run: `npx jest projects/bots/src/lib/wind.spec.ts`
Expected: FAIL — every Wind ask is declined; the bot bluffs with 3 cards.

- [ ] **Step 3: The rules**

Create `projects/bots/src/lib/wind.ts`:

```ts
import type { CardInstance, ContentRegistry, Effect, GameState, PendingChoice, PendingSelection, Seat } from 'engine';
import { handCards, isAlly, keepRank, leastUseful, ownCards } from './helpers';
import { devilCard } from './skills';

// The stage 8 spec's bot rules for the Wind skills.

const others = (view: GameState, me: Seat) => view.seats.filter((s) => !s.eliminated && s.id !== me.id);
const hurt = (s: Seat) => s.combinedHp < s.maxCombinedHp;
const weakest = (seats: Seat[]) => [...seats].sort((a, b) => a.combinedHp - b.combinedHp || a.index - b.index)[0];
const declined = (choice: PendingChoice): Effect | undefined => choice.options.find((o) => o.id === 'decline')?.effects[0];
const heartLike = (c: CardInstance) => c.suit === 'heart' || c.suit === 'spade'; // spades count for Beauty's holder; Fantasy's selection filters exactly
const isEquipment = (registry: ContentRegistry, c: CardInstance) => registry.cards.get(c.definitionId)?.category === 'equipment';

export function wantsWind(view: GameState, me: Seat, choice: PendingChoice, registry: ContentRegistry): boolean | null {
  if (choice.reason.kind !== 'ability') return null;
  const target = view.seats.find((s) => s.id === (choice.reason as { targetSeatId?: string }).targetSeatId);
  const hand = handCards(view, me);
  switch (choice.reason.abilityId) {
    case 'entrench':
      return hand.length <= 2 && me.combinedHp >= 3 && !others(view, me).some((s) => isAlly(me, s) && hurt(s));
    case 'godspeed': {
      if (view.phase === 'Start') {
        const slot = view.zones.find((z) => z.id === me.judgment.zoneId)?.cards.length ?? 0;
        return slot === 0 && others(view, me).some((s) => !isAlly(me, s) && s.combinedHp <= 2);
      }
      // As the Play Phase begins: a hand Equipment card for a slot already filled, and no Sha to play.
      const worn = new Set((view.zones.find((z) => z.id === me.equipped.zoneId)?.cards ?? []).map((c) => registry.cards.get(c.definitionId)?.equipSlot));
      const spare = hand.some((c) => isEquipment(registry, c) && worn.has(registry.cards.get(c.definitionId)?.equipSlot));
      return spare && !hand.some((c) => c.definitionId === 'sha');
    }
    case 'strong-bow':
      return !!target && !isAlly(me, target);
    case 'refusing-death':
    case 'lightning-strike':
      return true;
    case 'fantasy': {
      const damage = declined(choice);
      const amount = damage?.kind === 'DamageEffect' ? damage.damage.amount : 1;
      return hand.some((c) => heartLike(c) && c.definitionId !== 'peach') && me.combinedHp - amount <= 2;
    }
    case 'dark-magic': {
      const shown = declined(choice);
      const black = ownCards(view, me).filter((c) => c.suit === 'spade' || c.suit === 'club').map((c) => c.instanceId);
      return shown?.kind === 'JudgmentShownEffect' && devilCard(view, me, shown.judgment, registry, black) !== null;
    }
    default:
      return null;
  }
}

export function windSelection(view: GameState, me: Seat, selection: PendingSelection, registry: ContentRegistry): string[] | 'cancel' | null {
  if (selection.reason.kind !== 'ability') return null;
  const eligible = selection.eligibleIds;
  switch (selection.reason.abilityId) {
    case 'godspeed':
    case 'refusing-death':
      return leastUseful(view, registry, eligible).slice(0, 1);
    case 'fantasy': {
      const spare = leastUseful(view, registry, eligible).filter((id) => keepRank(view, registry, id) < 4);
      return spare.length > 0 ? [spare[0]] : 'cancel';
    }
    case 'dark-magic': {
      const id = selection.then.kind === 'replace-judgment' ? devilCard(view, me, selection.then.judgment, registry, eligible) : null;
      return id ? [id] : 'cancel';
    }
    case 'bewilder': {
      // A true claim if a card is what was named; else the least useful (a bluff).
      const as = selection.then.kind === 'skill-step' ? (selection.then.step.data?.['as'] as string | undefined) : undefined;
      const truthful = eligible.find((id) => view.zones.some((z) => z.cards.some((c) => c.instanceId === id && c.definitionId === as)));
      return [truthful ?? leastUseful(view, registry, eligible)[0]];
    }
    default:
      return null;
  }
}

export function windChoice(view: GameState, me: Seat, choice: PendingChoice): string | null {
  if (choice.reason.kind !== 'ability') return null;
  const reason = choice.reason;
  const seats = choice.options.flatMap((o) => (o.shows.kind === 'seat' ? [view.seats.find((s) => s.id === (o.shows as { seatId: string }).seatId)!] : []));
  switch (reason.abilityId) {
    case 'godspeed':
    case 'fantasy':
    case 'lightning-strike':
      return (weakest(seats.filter((s) => s.id !== me.id && !isAlly(me, s))) ?? seats.find((s) => s.id !== me.id) ?? seats[0])?.id ?? null;
    case 'bewilder': {
      const claimer = view.seats.find((s) => s.id === reason.owner.seatId);
      if (claimer && isAlly(me, claimer)) return 'believe';
      return me.combinedHp >= 3 && ['sha', 'peach', 'wuxie'].includes(reason.cardId ?? '') ? 'doubt' : 'believe';
    }
    default:
      return null;
  }
}
```

In `projects/bots/src/lib/skills.ts`:
- `wantsSkill`'s `default:` returns `wantsWind(view, me, choice, registry)`; `skillSelection`'s `default:` returns `windSelection(...)`; `skillChoice`'s `default:` returns `windChoice(...)`.
- `skillChoice` is reached for `verb: 'pick'` choices; the Bewilder doubt is one. The rule-based bot's step 1a' already calls it for `pick`.
- `devilCard` gains `candidates: string[] = handCards(view, me).map((c) => c.instanceId)` and filters those instead of the hand.
- `conversionSpare`: after the reveal check, `if (owned.conversion.deferred) return handCards(view, me).length > 4;` (`ownCards` imported from helpers where needed).
- In `wantsSkill`, the generic ask check returns early only for General skills: keep `wantsWind` reachable for any ability ask.

- [ ] **Step 4: Run the tests, the suite, and commit**

Run: `npx jest projects/bots`, then `npx jest` — Expected: PASS.

```bash
git add projects/bots
git commit -m "feat(bots): the Wind skills by the stage 8 spec's bot rules

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Simulator — base and Wind batches, a forced pairing per Wind General, Refusing Death in the invariants

**Files:**
- Modify: `projects/sim/src/forcedPairing.ts`, `projects/sim/src/invariants.ts` (+ spec)
- Create: `projects/sim/src/wind.spec.ts`

**Interfaces:**
- Produces: `registryWith(registry, ids: readonly string[]): ContentRegistry` (`baseRegistry` becomes `registryWith(registry, BASE_GENERAL_IDS)`); `partnerOf(generalId, registry, pool: readonly string[] = BASE_GENERAL_IDS)`.

- [ ] **Step 1: Write the failing tests**

In `projects/sim/src/invariants.spec.ts` add:

```ts
describe('a seat kept alive below 0 HP', () => {
  it('is fine after Refusing Death says so, and not before', () => {
    const owner = { kind: 'general' as const, seatId: 'seat-a', slot: 'main' as const, skillId: 'refusing-death' };
    const hit = { kind: 'DamageDealtEvent' as const, damage: { source: null, target: { kind: 'seat' as const, seatId: 'seat-a' }, amount: 2, nature: 'normal' as const } };
    const alive = { kind: 'AbilityUsedEvent' as const, owner, abilityId: 'refusing-death', outcome: 'stays-alive' };
    const below = (log: GameState['log']) => baseState({ seats: [{ ...baseState().seats[0], combinedHp: -1 }], log });
    expect(checkInvariants(below([hit, alive]))).toEqual([]);
    expect(checkInvariants(below([alive, hit]))).toEqual(['Seat seat-a is living at -1 HP with no rescue round pending']);
  });
});
```

Create `projects/sim/src/wind.spec.ts`, following `skills.spec.ts`: a registry of `[...BASE_GENERAL_IDS, ...WIND_GENERAL_IDS]` (`registryWith`); batches at 2, 4 and 6 seats, 10 seeds each, random and rule-based, with `checkRestingState` on every step and `checkInvariants` at the end; then, for each Wind General, up to 30 seeds of a 5-seat rule-based game with `withForcedPairing(…, 'seat-0', [id, partnerOf(id, registry, [...BASE_GENERAL_IDS, ...WIND_GENERAL_IDS])])`, until `firedSkills` covers every non-Lord skill but `beauty` (a modifier). Expect no failures and nothing missing.

- [ ] **Step 2: Run them to see them fail**

Run: `npx jest projects/sim/src/invariants.spec.ts projects/sim/src/wind.spec.ts`
Expected: FAIL — `registryWith` doesn't exist; the alive-below-0 case is flagged.

- [ ] **Step 3: Make them pass**

`projects/sim/src/forcedPairing.ts`:

```ts
// The registry with only the Generals in `ids`.
export function registryWith(registry: ContentRegistry, ids: readonly string[]): ContentRegistry {
  return { cards: registry.cards, generals: new Map([...registry.generals].filter(([id]) => ids.includes(id))) };
}

export const baseRegistry = (registry: ContentRegistry) => registryWith(registry, BASE_GENERAL_IDS);

// The next General of the same kingdom in `pool` (wrapping).
export function partnerOf(generalId: string, registry: ContentRegistry, pool: readonly string[] = BASE_GENERAL_IDS): string {
  const kingdom = registry.generals.get(generalId)?.kingdom;
  const same = pool.filter((id) => registry.generals.get(id)?.kingdom === kingdom);
  return same[(same.indexOf(generalId) + 1) % same.length];
}
```

`projects/sim/src/invariants.ts`, the "living at 0 HP" check:

```ts
  for (const seat of state.seats) {
    const rescuePending = state.pendingResponse?.reason?.kind === 'dying' && state.pendingResponse.reason.seatId === seat.id;
    if (!seat.eliminated && seat.combinedHp <= 0 && !rescuePending && !keptAlive(state, seat.id)) {
      violations.push(`Seat ${seat.id} is living at ${seat.combinedHp} HP with no rescue round pending`);
    }
  }
```

with

```ts
// Whether a skill kept `seatId` alive below 1 HP since its HP last dropped
// (Refusing Death logs outcome 'stays-alive').
function keptAlive(state: GameState, seatId: string): boolean {
  for (let i = state.log.length - 1; i >= 0; i--) {
    const e = state.log[i];
    if (e.kind === 'AbilityUsedEvent' && e.owner.seatId === seatId && e.outcome === 'stays-alive') return true;
    if ((e.kind === 'DamageDealtEvent' && e.damage.target.seatId === seatId) || (e.kind === 'HpLostEvent' && e.seatId === seatId)) return false;
  }
  return false;
}
```

(If Task 6 already pulled this forward, this step only confirms it.)

- [ ] **Step 4: Run, tune, commit**

Run: `npx jest projects/sim`
Expected: PASS. A Wind skill unfired within 30 seeds: first check that its ask is offered (a missing ask is a bug); if it's just rare under the bot rules, raise that General's limit to 60. Report any still unfired rather than weakening the check.

Run `npx jest` — Expected: PASS.

```bash
git add projects/sim
git commit -m "test(sim): base and Wind batches, a forced pairing per Wind General, Refusing Death in the invariants

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: App — face down, the pile, Bewilder's doubt, the Wind skills' words

**Files:**
- Modify: `projects/content/src/lib/display.ts` (+ spec), `projects/app/src/app/game-board/seat-tile.ts`, `round-table.ts`, `game-board.ts`, `choice-description.ts`, `action-history.ts` and their specs

**Interfaces:**
- Produces: `SeatTile` input `pile: CardInstance[]` (default `[]`); the tile reads `seat().faceDown`.

- [ ] **Step 1: Write the failing tests**

- `display.spec.ts`:
  - every Wind ask has a hint: `entrench`, `godspeed`, `strong-bow`, `fantasy`, `refusing-death`, `lightning-strike`, `dark-magic`;
  - `selectionText('fantasy')` is `{ prompt: 'Choose a heart card to discard', confirm: 'Discard' }`;
  - `selectionText('godspeed')` is `{ prompt: 'Choose an Equipment card to discard', confirm: 'Discard' }`.
- `seat-tile.spec.ts`:
  - a seat with `faceDown: true` shows a "Face Down" badge, and its avatar has a `face-down` class;
  - `pile` cards render as small face-up cards with `aria-label="Under General"` on their row.
- `choice-description.spec.ts`: a Bewilder doubt choice (reason `cardId: 'sha'`, owner seat-1, labels Believe/Doubt) describes as `{ title: 'Bewilder', prompt: 'Seat 1 claims Sha. Believe or doubt?', confirmLabel: 'Choose' }`.
- `action-history.spec.ts`:
  - `SeatTurnedEvent` face down → "Seat 0 turned face down"; with `passedTurn` → "Seat 0 turned face up and passed the turn";
  - a `CardMovedEvent` into `seat-0:pile` with a face → "Seat 0 put Sha (7 ♠) under their General";
  - outcomes `stays-alive` → "Seat 0's Refusing Death: no match, Seat 0 stays alive"; `matched` → "Seat 0's Refusing Death: a rank matched";
  - a Bewilder `ChoiceMadeEvent` (label Doubt, reason `cardId: 'sha'`, owner seat-1) → "Seat 0 doubted Seat 1's Sha"; Believe → "Seat 0 believed Seat 1's Sha";
  - outcomes `claim-true` → "Seat 1's Sha was true", `claim-false` → "Seat 1's Sha was a bluff", `claim-believed` → no line.

Add a `pile` zone to the history spec's `zones` fixture.

- [ ] **Step 2: Run them to see them fail**

Run: `npx jest projects/content/src/lib/display.spec.ts projects/app/src/app/game-board`
Expected: FAIL on each new case.

- [ ] **Step 3: Make them pass**

`display.ts` `ABILITY_HINTS` (sentence case):

```ts
  entrench: 'Turn face down and draw 3 cards',
  godspeed: 'Skip phases to use a Sha on any seat, ignoring distance',
  'strong-bow': "Make your Sha unblockable for {target}",
  fantasy: 'Discard a heart card to pass the damage to another seat',
  'refusing-death': 'Turn the top card of the draw pile under your General to stay alive',
  'lightning-strike': 'A seat of your choice judges: on a spade it takes 2 damage',
  'dark-magic': "Replace {target}'s judgment card with a black card, and take the old one",
```

and `SELECTION_TEXT` gains `fantasy`, `godspeed` (above), `'refusing-death': { prompt: 'Choose a card under your General to discard', confirm: 'Discard', cancel: 'Keep Them' }`, `'dark-magic': { prompt: 'Choose a black card to replace the judgment', confirm: 'Replace' }`.

`seat-tile.ts`:
- a `readonly pile = input<CardInstance[]>([])`;
- in the avatar's section, `@if (seat().faceDown) { <span class="badge face-down-badge">Face Down</span> }`, and `[class.face-down]="seat().faceDown"` on the avatar wrapper, styled `filter: grayscale(0.6) brightness(0.8)`;
- under the avatar, `@if (pile().length) { <div class="pile" aria-label="Under General">@for (card of pile(); track card.instanceId) { <app-playing-card size="small" [card]="card" /> }</div> }` with `.pile { display: flex; gap: 2px; flex-wrap: wrap; }`.

`round-table.ts` / `game-board.ts`: bind `[pile]="zoneCards(seat.pile?.zoneId ?? '')"` (round-table's `judgmentOf`).

`choice-description.ts`, before the generic `pick` handling:

```ts
  // A claim to believe or doubt (Bewilder).
  if (choice.reason.kind === 'ability' && choice.reason.cardId && choice.verb === 'pick') {
    const claimer = seatName(state.players, choice.reason.owner.seatId);
    return { title: abilityName(choice.reason.abilityId), prompt: `${claimer} claims ${cardName(choice.reason.cardId)}. Believe or doubt?`, confirmLabel: 'Choose' };
  }
```

`action-history.ts`:
- `case 'SeatTurnedEvent':` the two lines above.
- In `CardMovedEvent`, before the discard handling: `if (event.card && to?.kind === 'pile' && to.ownerSeatId) { action(`${name(to.ownerSeatId)} put ${named(event.card)} under their General`, event.card); break; }`.
- `ChoiceMadeEvent` with `shows.kind === 'label'` and `reason.kind === 'ability' && reason.cardId`: `` `${chooser} ${shows.text === 'Doubt' ? 'doubted' : 'believed'} ${name(reason.owner.seatId)}'s ${cardName(reason.cardId)}` `` (instead of "chose …").
- `AbilityUsedEvent` outcomes `stays-alive`, `matched`, `claim-true`, `claim-false` as above. `claim-believed` writes nothing: the card's own "used" line follows.

- [ ] **Step 4: Run, check in the app, commit**

Run: `npx jest`. Expected: PASS. `npx ng build app` builds.

Drive the app as in stage 7: dev server, headless Chrome, states built by the engine loaded through `GameService`. Screenshot:
- a face-down seat;
- Zhou Tai with two cards under him;
- a Bewilder doubt dialog seen by a human seat.

```bash
git add projects/content projects/app
git commit -m "feat(app): face down, the pile under a General, Bewilder's doubt, and the Wind skills' words

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Docs — the event chain and the spec's rulings

**Files:**
- Modify: `docs/architecture/event-chain.md`, `docs/superpowers/specs/2026-10-07-stage-8-wind-generals-design.md`

- [ ] **Step 1: The event chain**

Add rows to "Plugging into the chain":

| To add… | Write… | Example |
|---|---|---|
| Turning a seat face down | `TurnFaceDownEffect`; its next turn is passed (`SeatTurnedEvent`) | Entrench |
| Cards kept under a General | the seat's `pile` zone (`pileZoneOf`) | Refusing Death |
| A conversion decided later | `Conversion.deferred` → the skill's `deferred` step; a window it answers is set aside (`UseCardEffect.answering`) | Bewilder |
| A suit that counts as another | `AbilityModifiers.suitAs`, read through content's `suitOf` | Beauty |

Also note under "Judgment changers' order" that `JUDGMENT_CHANGERS` maps each changer to the cards it may use (Devil: a hand card; Dark Magic: a black hand or worn card).

- [ ] **Step 2: The spec's rulings**

Append to the stage 8 spec:

```markdown
## Stage 8 rulings

- Godspeed's first option is asked as the Start Phase begins: Kingdom War judges delayed Tools on entering the Judgment Phase.
- Bewilder has no naming dialog: each nameable card is a conversion button ("As Sha · Bewilder"), with its targets.
- While Bewilder answers a window, the window is set aside and then answered or re-opened.
- Every suit rule reads `suitOf`, so Beauty reaches the delayed Tools and Eight Trigrams.
- Refusing Death asks once per card; declining a later card lets the dying round go ahead.
- A used card's colour (as armour sees it) is the engine's, unchanged by Beauty.
```

- [ ] **Step 3: Commit**

```bash
git add docs
git commit -m "docs: the Wind skills in the event chain; stage 8 rulings

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## After the last task

- `npx jest` once more; all green.
- Sim CLI batches at 2, 5 and 10 seats (`npx tsx projects/sim/src/cli.ts batch 100 <seats>`): all pass.
- Update the roadmap memory note: stage 8 done, with the test count and deferred minors.
- Merge locally to `main` via superpowers:finishing-a-development-branch.
