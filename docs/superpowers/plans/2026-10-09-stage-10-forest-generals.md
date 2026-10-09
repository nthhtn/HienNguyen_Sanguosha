# Stage 10: The Forest Generals — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
- Give the 8 Forest Generals their real skills: Xu Huang, Cao Pi, Meng Huo, Zhu Rong, Sun Jian, Lu Su, Dong Zhuo and Jia Xu.
- Add the small generic engine pieces those skills need.

**Architecture:**
- **Engine (generic, names no card or skill):**
  - `ReduceMaxHpEffect` and `MaxHpReducedEvent`;
  - `ToolResolvedEffect`, queued behind every proactively played non-delayed Tool, so a trigger can act "after it finished resolving";
  - `DiscardZoneEffect.acted`, so an ask before a seat's death discard can be declined without asking twice;
  - `PendingResponse.sourceSkill`, so answering a skill's own window queues one of its steps with the answering card.
- **Content:**
  - four new `AbilityModifiers` fields, read by content queries only;
  - `generals/forest.ts`;
  - the Kingdom War dying order honours Complete Kill.
- **Around it:** bots play the Forest skills, the sim adds a Forest batch and forced pairings, the app gains the Upheaval window, the new prompts and history lines.

**Tech Stack:** TypeScript, Jest (ts-jest), Angular 22 (app task).

**Spec:** `docs/superpowers/specs/2026-10-09-stage-10-forest-generals-design.md` (binding). Stages 7–9 common rules still hold.

**Where this plan departs from the spec, and why:**
- **Upheaval asks the target first, then opens a Sha window.** Each seat picks a seat in its range (or "Pass (Lose 1 HP)"), then a response window asks for the Sha (real or converted). A seat with a seat in range but no Sha must press Pass; only a seat with no seat in range loses the HP automatically. The effect is the spec's; the window is the engine's existing way to ask for a Sha at a fixed target (Coerce's).
- **Unnatural Death is a before-trigger on the dead seat's `DiscardZoneEffect`**, not a new "death hook". The mode already queues one `DiscardZoneEffect` per zone; the ask replaces the hand's one. This needs only the `acted` field.
- **Giant Elephant needs `ToolResolvedEffect`.** A used card leaves the hand for the discard pile at once, so "after it finishes resolving" needs a marker at the end of the Tool's queue items.
- **Complete Kill filters the dying round's `order`** in Kingdom War's dying trigger (only the turn owner and the dying seat are listed) rather than filtering Peach plays; in the Play Phase only the owner plays Peach anyway.
- **Curtain is a modifier plus a backstop trigger.** The modifier keeps black Tools off the seat lists of Steal, Break, Duel, Capture and Starvation; a `before:ToolOnTargetEffect` trigger cancels any other black Tool at the seat (area Tools, conversions).
- **Blockade's +1 range counts only while Xu Huang is revealed** (a hidden General's modifiers are off); using the conversion reveals him, but the targets are listed before that.
- **Resurgence's hearts are the printed suit** of the revealed card.

## Global Constraints

- **The engine names no card or skill.** Content supplies everything specific (CLAUDE.md, "Extensibility").
- **Game state stays plain serialisable data.** Absent optional state is left out (no `undefined` fields).
- **"May" always asks;** hidden Generals' optional skills are offered as "Reveal X to use Y"; compulsory skills and modifiers of a hidden General don't apply; Lord skills are inactive.
- **Every skill acts for its `owner`.** Never find a seat by General id.
- **Skill ids** are the English name in kebab case: `blockade`, `unnatural-death`, `exile`, `culprit`, `resurgence`, `giant-elephant`, `intense-edge`, `brave-spirit`, `charity`, `alliance`, `wine`, `garden-of-lust`, `collapse`, `complete-kill`, `upheaval`, `curtain`, plus the Lord skills `exaltation` and `violent-tyrant`.
- **No elemental damage.** (Nothing in Forest deals any.)
- **UI text** follows CLAUDE.md's UI text style. Buttons and labels in Title Case ("Reduce Max HP by 1", "Pass (Lose 1 HP)"); prompts, hints and history lines in sentence case with keywords capitalised.
- **Tests:** `npx jest <path>` runs one spec; `npx jest` runs everything. ts-jest type-checks, so a type error fails a test run.
- Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Unnatural Death with a declined ask.** Cao Pi says Don't: the dead seat's cards are discarded as usual, once each, and he is not asked again for the equipment or Judgment slot. (Task 3.)
2. **Giant Elephant against Zhu Rong's own Barbarians, and a Barbarians already taken.** She takes only another seat's card, only if it is still in the discard pile. (Task 4.)
3. **Charity at exactly 5 cards and with tied seats.** Five cards give nothing; a tie for fewest hand cards asks Lu Su to choose. (Task 5.)
4. **Alliance's offers.** Equal hands are never offered; a pair that costs more than Lu Su holds is never offered; picking the first seat never lists an unaffordable partner. (Task 5.)
5. **Upheaval with a dead seat in the list, and twice in a game.** A seat that dies before its turn is skipped; the second use is not offered. (Task 6.)

---

## File Structure

**Engine (`projects/engine/src/lib/`):**
- Modify: `pipeline/effects.ts`, `pipeline/events.ts`, `pipeline/resolve.ts`, `domain/types.ts`, `registry/types.ts`.
- Create: `pipeline/forestGroundwork.spec.ts`.

**Content (`projects/content/`):**
- Create:
  - `src/lib/generals/forest.ts`, with specs `forest-wei.spec.ts`, `forest-shu.spec.ts`, `forest-wu.spec.ts`, `forest-qun.spec.ts`;
  - `src/lib/shared/groundwork10.spec.ts`.
- Modify:
  - `src/lib/shared/abilities.ts`, `src/lib/shared/tools.ts`, `src/lib/shared/delayed.ts`, `src/lib/shared/choices.ts`;
  - `src/lib/cards/sha.ts`, `src/lib/cards/duel.ts`, `src/lib/cards/coerce.ts`;
  - `src/lib/modes/kingdomWar.ts`;
  - `src/lib/generals/index.ts`, `src/public-api.ts`, `src/lib/display.ts`.

**Bots / sim:** `bots/src/lib/forest.ts` (new), `bots/src/lib/skills.ts`, `bots/src/lib/rule-based.ts`, `bots/src/lib/forest.spec.ts` (new); `sim/src/forest.spec.ts` (new).

**App (`projects/app/src/app/game-board/`):** `action-history.ts`, `choice-description.ts`, `response-description.ts` and their specs.

---

### Task 1: Engine — max HP reduction, Tool-resolved marker, skill-sourced windows, `acted` on zone discards

**Files:**
- Modify: `projects/engine/src/lib/pipeline/effects.ts`, `projects/engine/src/lib/pipeline/events.ts`, `projects/engine/src/lib/pipeline/resolve.ts`, `projects/engine/src/lib/domain/types.ts`
- Test: `projects/engine/src/lib/pipeline/forestGroundwork.spec.ts` (create)

**Interfaces:**
- Produces:
  - `Effect` gains `{ kind: 'ReduceMaxHpEffect'; seatId: string; amount: number }`. It lowers `maxCombinedHp`, clamps `combinedHp` to it, logs `MaxHpReducedEvent`, and eliminates the seat (logging `SeatEliminatedEvent`) when max HP reaches 0.
  - `Effect` gains `{ kind: 'ToolResolvedEffect'; seatId: string; tool: UsedCard }`. It does nothing itself; `before:ToolResolvedEffect` is its trigger point. `useCard` queues it last for a Tool (category `'tool'`, not `delayed`) that is played, not answered.
  - `DiscardZoneEffect` gains `acted?: string[]`.
  - `PendingResponse` gains `sourceSkill?: { owner: GeneralOwner; step: string; data?: Record<string, unknown> }`. Answering the window queues `SkillStepEffect { owner, step, data: { ...data, answeredBy: <seat id>, answeredCard: <UsedCard> } }`.
  - `MaxHpReducedEvent { kind: 'MaxHpReducedEvent'; seatId: string; amount: number; maxHp: number }` in the `EngineEvent` union.

- [ ] **Step 1: Write the failing tests**

Create `projects/engine/src/lib/pipeline/forestGroundwork.spec.ts`:

```ts
import { advanceToDecision, resolve } from './resolve';
import type { CardDefinition, ContentRegistry, GameModeDefinition, SkillDefinition } from '../registry/types';
import type { GameState, GeneralOwner } from '../domain/types';
import type { Effect } from './effects';

const owner: GeneralOwner = { kind: 'general', seatId: 'a', slot: 'main', skillId: 'probe' };
const stub: GameModeDefinition = { id: 'stub', setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'], checkWinCondition: () => null, triggers: [] };
const card = (instanceId: string, definitionId = 'x') => ({ instanceId, definitionId, suit: 'spade' as const, rank: 7 });

// What the probe skill saw when its 'answered' step ran.
let seen: Record<string, unknown> | undefined;
const probe: SkillDefinition = {
  id: 'probe',
  onStep: (_state, step) => {
    seen = step.data;
    return [{ kind: 'DrawCardsEffect', seatId: step.data?.['answeredBy'] as string, count: 1 }];
  },
};
const noopTool: CardDefinition = { id: 'noop-tool', name: 'Noop Tool', category: 'tool', legalPlayTargets: () => [[]], play: () => [] };
const quick: CardDefinition = { id: 'quick', name: 'Quick', category: 'basic', legalPlayTargets: () => [[]], play: () => [] };
const registry: ContentRegistry = {
  cards: new Map([['noop-tool', noopTool], ['quick', quick]]),
  generals: new Map([['g', { id: 'g', kingdom: 'Wei', maxHp: 4, skills: [probe] }]]),
};

function table(over: Partial<GameState> = {}): GameState {
  const seat = (id: string, index: number) => ({
    id, index, kingdom: 'Wei' as const, eliminated: false,
    generals: { main: { generalDefinitionId: 'g', revealed: true }, deputy: { generalDefinitionId: 'g', revealed: true } },
    combinedHp: 4, maxCombinedHp: 4, hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` },
  });
  return {
    seats: [seat('a', 0), seat('b', 1)], players: [], turn: { turnNumber: 1, ownerSeatId: 'a', extraTurnStack: [] }, phase: 'Play',
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: [card('d1'), card('d2')] },
      { id: 'discardPile', kind: 'discardPile', cards: [] },
      { id: 'processing', kind: 'processing', cards: [] },
      { id: 'a:hand', kind: 'hand', ownerSeatId: 'a', cards: [card('t1', 'noop-tool'), card('q1', 'quick')] },
      { id: 'a:equip', kind: 'equip', ownerSeatId: 'a', cards: [] },
      { id: 'a:judgment', kind: 'judgment', ownerSeatId: 'a', cards: [] },
      { id: 'b:hand', kind: 'hand', ownerSeatId: 'b', cards: [card('q2', 'quick')] },
      { id: 'b:equip', kind: 'equip', ownerSeatId: 'b', cards: [] },
      { id: 'b:judgment', kind: 'judgment', ownerSeatId: 'b', cards: [] },
    ],
    pendingResponse: null, log: [], rng: { seed: 1, counter: 0 }, result: null, generalSelection: null,
    ...over,
  };
}
const hand = (s: GameState, id: string) => s.zones.find((z) => z.id === `${id}:hand`)!.cards.map((c) => c.instanceId);

describe('ReduceMaxHpEffect', () => {
  const run = (s: GameState, effect: Effect) => advanceToDecision({ ...s, resolutionQueue: [effect] }, { registry, mode: stub }).state;

  it('lowers max HP and drops HP to it, logging the change', () => {
    const s = run(table(), { kind: 'ReduceMaxHpEffect', seatId: 'a', amount: 1 });
    expect(s.seats[0]).toMatchObject({ maxCombinedHp: 3, combinedHp: 3, eliminated: false });
    expect(s.log).toContainEqual({ kind: 'MaxHpReducedEvent', seatId: 'a', amount: 1, maxHp: 3 });
  });

  it('leaves HP alone when it is already below the new max', () => {
    const t = table();
    const s = run({ ...t, seats: t.seats.map((x) => (x.id === 'a' ? { ...x, combinedHp: 1 } : x)) }, { kind: 'ReduceMaxHpEffect', seatId: 'a', amount: 1 });
    expect(s.seats[0]).toMatchObject({ maxCombinedHp: 3, combinedHp: 1 });
  });

  it('eliminates a seat whose max HP reaches 0', () => {
    const t = table();
    const s = run({ ...t, seats: t.seats.map((x) => (x.id === 'a' ? { ...x, maxCombinedHp: 1, combinedHp: 1 } : x)) }, { kind: 'ReduceMaxHpEffect', seatId: 'a', amount: 1 });
    expect(s.seats[0].eliminated).toBe(true);
    expect(s.log).toContainEqual({ kind: 'MaxHpReducedEvent', seatId: 'a', amount: 1, maxHp: 0 });
    expect(s.log).toContainEqual({ kind: 'SeatEliminatedEvent', seatId: 'a' });
  });
});

describe('ToolResolvedEffect', () => {
  const marker: GameModeDefinition = {
    ...stub,
    triggers: [{ point: 'before:ToolResolvedEffect', condition: () => true, effect: () => [{ kind: 'DrawCardsEffect', seatId: 'a', count: 1 }] }],
  };
  const play = (id: string) => resolve(table(), { kind: 'PlayCardAction', seatId: 'a', cardInstanceId: id, targets: [] }, { registry, mode: marker }).state;

  it('is queued behind a played Tool, where triggers can act on it', () => {
    expect(hand(play('t1'), 'a')).toEqual(['q1', 'd1']);
  });

  it('is not queued for a Basic card', () => {
    expect(hand(play('q1'), 'a')).toEqual(['t1']);
  });
});

describe('PendingResponse.sourceSkill', () => {
  const window = (): GameState =>
    table({
      pendingResponse: {
        id: 'w', respondingSeatId: 'b', allowedActionKinds: ['RespondAction', 'PassAction'], allowedCardIds: ['quick'],
        context: { effect: { kind: 'DrawCardsEffect', seatId: 'a', count: 1 } },
        sourceSkill: { owner, step: 'answered', data: { victim: 'a' } },
      },
    });

  it('answering queues the skill step with the answerer and the answering card', () => {
    seen = undefined;
    const s = resolve(window(), { kind: 'RespondAction', seatId: 'b', pendingResponseId: 'w', cardInstanceId: 'q2' }, { registry, mode: stub }).state;
    expect(seen).toMatchObject({ victim: 'a', answeredBy: 'b', answeredCard: { as: 'quick' } });
    expect(hand(s, 'b')).toEqual(['d1']); // the probe drew for the answerer; the window's own effect (a draws) did not run
    expect(hand(s, 'a')).toEqual(['t1', 'q1']);
  });

  it('passing runs the window effect and not the skill step', () => {
    seen = undefined;
    const s = resolve(window(), { kind: 'PassAction', seatId: 'b', pendingResponseId: 'w' }, { registry, mode: stub }).state;
    expect(seen).toBeUndefined();
    expect(hand(s, 'a')).toEqual(['t1', 'q1', 'd1']);
  });
});

describe('DiscardZoneEffect.acted', () => {
  it('is carried and the zone is still discarded', () => {
    const s = advanceToDecision(
      { ...table(), resolutionQueue: [{ kind: 'DiscardZoneEffect', zoneId: 'b:hand', acted: ['x'] }] },
      { registry, mode: stub }
    ).state;
    expect(s.zones.find((z) => z.id === 'discardPile')!.cards.map((c) => c.instanceId)).toEqual(['q2']);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest projects/engine/src/lib/pipeline/forestGroundwork.spec.ts`
Expected: FAIL — type errors (`ReduceMaxHpEffect`, `ToolResolvedEffect`, `sourceSkill`, `acted` do not exist).

- [ ] **Step 3: Implement**

In `projects/engine/src/lib/pipeline/events.ts`, add after `SeatEliminatedEvent`:

```ts
// A seat's max HP went down (Collapse); `maxHp` is what it is now.
export interface MaxHpReducedEvent {
  kind: 'MaxHpReducedEvent';
  seatId: string;
  amount: number;
  maxHp: number;
}
```

and add `| MaxHpReducedEvent` to the `EngineEvent` union (after `| SeatEliminatedEvent`).

In `projects/engine/src/lib/pipeline/effects.ts`:

1. Change the `DiscardZoneEffect` member to `| { kind: 'DiscardZoneEffect'; zoneId: string; acted?: string[] }`.
2. Add two members to the `Effect` union (next to `EliminateSeatEffect`):

```ts
  | { kind: 'ReduceMaxHpEffect'; seatId: string; amount: number }
  // Marks the end of a played Tool's queue items; it does nothing itself. A
  // before-trigger on it is "after the Tool has finished resolving".
  | { kind: 'ToolResolvedEffect'; seatId: string; tool: UsedCard }
```

3. Add two cases to `applyEffect`, before `case 'SkillStepEffect':`:

```ts
    case 'ReduceMaxHpEffect': {
      const seat = state.seats.find((s) => s.id === effect.seatId);
      if (!seat) throw new Error(`Unknown seat: ${effect.seatId}`);
      if (seat.eliminated || effect.amount <= 0) return { state, events: [] };
      const maxCombinedHp = Math.max(0, seat.maxCombinedHp - effect.amount);
      const combinedHp = Math.min(seat.combinedHp, maxCombinedHp);
      const out = maxCombinedHp <= 0;
      const seats = state.seats.map((s) => (s.id === seat.id ? { ...s, maxCombinedHp, combinedHp, eliminated: out } : s));
      const events: EngineEvent[] = [
        { kind: 'MaxHpReducedEvent', seatId: seat.id, amount: seat.maxCombinedHp - maxCombinedHp, maxHp: maxCombinedHp },
        ...(out ? [{ kind: 'SeatEliminatedEvent' as const, seatId: seat.id }] : []),
      ];
      return { state: { ...state, seats, log: [...state.log, ...events] }, events };
    }
    case 'ToolResolvedEffect':
      return { state, events: [] };
```

In `projects/engine/src/lib/domain/types.ts`, add to `PendingResponse` after `onAnswer`:

```ts
  // A General's skill opened this window: answering it queues the skill's
  // `step` with `data` plus who answered (`answeredBy`) and the card as used
  // (`answeredCard`), in place of the card definition's say (`sourceCard`).
  sourceSkill?: { owner: GeneralOwner; step: string; data?: Record<string, unknown> };
```

In `projects/engine/src/lib/pipeline/resolve.ts`, in `useCard`, replace the final `return` block and add the two new lists:

```ts
  // A skill's own window: its step hears who answered and with what.
  const fromSkill: Effect[] = pending?.sourceSkill
    ? [{ kind: 'SkillStepEffect', owner: pending.sourceSkill.owner, step: pending.sourceSkill.step, data: { ...pending.sourceSkill.data, answeredBy: seatId, answeredCard: used } }]
    : [];
  // The end of a played Tool's queue items (not of a delayed Tool, which waits to be judged).
  const toolDone: Effect[] = !pending && definition.category === 'tool' && !definition.delayed ? [{ kind: 'ToolResolvedEffect', seatId, tool: used }] : [];
  const followUps = afterTriggerFollowUps(tallied, [event], ctx);
  return {
    state: queueFront(tallied, [...leaveHand, ...followUps, ...effects, ...(pending?.onAnswer ?? []), ...fromSource, ...fromSkill, ...toolDone]),
    events: [event],
  };
```

- [ ] **Step 4: Run the new spec, then the whole engine project**

Run: `npx jest projects/engine/src/lib/pipeline/forestGroundwork.spec.ts`
Expected: PASS.
Run: `npx jest --selectProjects engine`
Expected: PASS. If an older spec asserts the exact `resolutionQueue` right after a Tool is played, it now also holds a trailing `ToolResolvedEffect`: update that expectation to include it. Nothing else should change.

- [ ] **Step 5: Run the other projects to catch exhaustive switches**

Run: `npx jest`
Expected: PASS. (A `never`-exhaustive switch over `EngineEvent` or `Effect` anywhere would fail to compile; add a case that does nothing, or the right line, for `MaxHpReducedEvent`, `ReduceMaxHpEffect` and `ToolResolvedEffect`.)

- [ ] **Step 6: Commit**

```bash
git add projects/engine docs/superpowers/plans/2026-10-09-stage-10-forest-generals.md
git commit -m "feat(engine): max HP reduction, Tool-resolved marker, skill-sourced windows" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Content groundwork — modifiers, Garden of Lust's count, Starvation range, Curtain's colour, Complete Kill's order, the Forest file

**Files:**
- Modify: `projects/engine/src/lib/registry/types.ts`, `projects/content/src/lib/shared/abilities.ts`, `projects/content/src/lib/shared/tools.ts`, `projects/content/src/lib/shared/delayed.ts`, `projects/content/src/lib/shared/choices.ts`, `projects/content/src/lib/cards/sha.ts`, `projects/content/src/lib/cards/duel.ts`, `projects/content/src/lib/cards/coerce.ts`, `projects/content/src/lib/modes/kingdomWar.ts`, `projects/content/src/lib/generals/index.ts`, `projects/content/src/public-api.ts`
- Create: `projects/content/src/lib/generals/forest.ts`, `projects/content/src/lib/shared/groundwork10.spec.ts`

**Interfaces:**
- Produces (engine, `AbilityModifiers`):
  - `rangeBonusFor?: Record<string, number>`;
  - `untargetableByBlackTools?: boolean`;
  - `peachOnlyOwnerAndDying?: boolean`;
  - `doubleAnswersWithFemale?: boolean`.
- Produces (content `shared/abilities.ts`):
  - `untargetableBy(state, seatId, cardId, registry, colour?: 'red' | 'black' | 'none'): boolean` (the new optional `colour`);
  - `answersNeededAgainst(state, seatId, registry, versus?: string): 1 | 2`;
  - `rangeBonusFor(state, seatId, cardId, registry): number`;
  - `peachLockedTo(state, registry): string | null` — the turn owner's seat id when its Complete Kill is in play, else `null`.
- Produces (content `shared/tools.ts`): `playColour(state, ctx: { seatId: string; cardInstanceId: string }, registry): 'red' | 'black' | 'none'`.
- Produces (content `generals/forest.ts`): `FOREST_GENERALS: GeneralSkillSet[]` (empty now), and the Lord skills `exaltation`, `violentTyrant`. `generals/index.ts` exports `FOREST_GENERAL_IDS`.

- [ ] **Step 1: Write the failing tests**

Create `projects/content/src/lib/shared/groundwork10.spec.ts`:

```ts
import type { SkillDefinition } from 'engine';
import { card, harness, kwMode, registry, table } from '../generals/skills.testing';
import { answersNeededAgainst, peachLockedTo, rangeBonusFor, untargetableBy } from './abilities';

const h = harness();
const kw = harness(kwMode);

// Test-only Generals carrying one modifier each. They live only in this spec's
// registry, so the fillers every table seats stay vanilla.
const testGeneral = (id: string, modifiers: NonNullable<SkillDefinition['modifiers']>) =>
  registry.generals.set(id, { id, kingdom: 'Wei', maxHp: 4, skills: [{ id: `skill-${id}`, compulsory: true, modifiers }] });
const withGeneral = (main: string, revealed = true) => table({}, { generals: { 'seat-a': [main, 'filler-jiang-wei', revealed] } });

beforeAll(() => {
  testGeneral('t-range', { rangeBonusFor: { starvation: 1 } });
  testGeneral('t-black', { untargetableByBlackTools: true });
  testGeneral('t-garden', { doubleAnswersWithFemale: true });
  testGeneral('t-peach', { peachOnlyOwnerAndDying: true });
});

describe('the new modifiers', () => {
  it('rangeBonusFor sums the bonus for that card', () => {
    const s = withGeneral('t-range');
    expect(rangeBonusFor(s, 'seat-a', 'starvation', registry)).toBe(1);
    expect(rangeBonusFor(s, 'seat-a', 'capture', registry)).toBe(0);
    expect(rangeBonusFor(s, 'seat-b', 'starvation', registry)).toBe(0);
  });

  it('untargetableBy with a black colour: a Tool, not a Basic card', () => {
    const s = withGeneral('t-black');
    expect(untargetableBy(s, 'seat-a', 'duel', registry, 'black')).toBe(true);
    expect(untargetableBy(s, 'seat-a', 'duel', registry, 'red')).toBe(false);
    expect(untargetableBy(s, 'seat-a', 'duel', registry)).toBe(false);
    expect(untargetableBy(s, 'seat-a', 'sha', registry, 'black')).toBe(false);
  });

  it('a hidden General has no modifiers', () => {
    expect(untargetableBy(withGeneral('t-black', false), 'seat-a', 'duel', registry, 'black')).toBe(false);
  });

  it('answersNeededAgainst: two against a female when either seat has Garden of Lust', () => {
    const s = table({}, { generals: { 'seat-a': ['t-garden', 'filler-jiang-wei'], 'seat-b': ['diao-chan', 'filler-jiang-wei'] } });
    expect(answersNeededAgainst(s, 'seat-a', registry, 'seat-b')).toBe(2); // the owner attacks a female
    expect(answersNeededAgainst(s, 'seat-b', registry, 'seat-a')).toBe(2); // a female attacks the owner
    expect(answersNeededAgainst(s, 'seat-a', registry, 'seat-c')).toBe(1); // a male
    expect(answersNeededAgainst(s, 'seat-a', registry)).toBe(1);
  });

  it('peachLockedTo names the turn owner while its Complete Kill is in play', () => {
    expect(peachLockedTo(withGeneral('t-peach'), registry)).toBe('seat-a');
    expect(peachLockedTo(withGeneral('t-peach', false), registry)).toBeNull();
    expect(peachLockedTo(table({}), registry)).toBeNull();
  });
});

describe('Starvation range', () => {
  it('a +1 range bonus reaches distance 2', () => {
    const hand = { 'seat-a:hand': [card('st', 'starvation', 'club', 3)] };
    const reach = (generals: string) => h.legal(table(hand, { generals: { 'seat-a': [generals, 'filler-jiang-wei'] } }), 'seat-a').filter((a) => a.kind === 'PlayCardAction' && a.cardInstanceId === 'st').map((a) => (a.kind === 'PlayCardAction' ? a.targets[0].seatId : ''));
    expect(reach('filler-xu-huang')).toEqual(['seat-b', 'seat-d']);
    expect(reach('t-range')).toEqual(['seat-b', 'seat-c', 'seat-d']);
  });
});

describe('Dying order under Complete Kill', () => {
  const hit = (seatId: string) => ({ kind: 'DamageEffect' as const, damage: { source: null, target: { kind: 'seat' as const, seatId }, amount: 1, nature: 'normal' as const, cause: {} } });
  const peachAt = (generals: Record<string, [string, string, boolean?]>) =>
    table({ 'seat-c:hand': [card('p', 'peach', 'heart', 4)] }, { generals, hp: { 'seat-b': 1 } });

  it('without it, the Peach holder is asked after the dying seat passes', () => {
    let s = kw.run(peachAt({}), [hit('seat-b')]);
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-b' });
    s = kw.pass(s);
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-c' });
  });

  it('with it, only the turn owner and the dying seat are asked', () => {
    let s = kw.run(peachAt({ 'seat-a': ['t-peach', 'filler-jiang-wei'] }), [hit('seat-b')]);
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-b' });
    s = kw.pass(s);
    expect(s.pendingResponse).toBeNull();
    expect(s.seats.find((x) => x.id === 'seat-b')!.eliminated).toBe(true);
  });
});
```


- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest projects/content/src/lib/shared/groundwork10.spec.ts`
Expected: FAIL — type errors (new modifier fields and functions do not exist).

- [ ] **Step 3: Implement**

In `projects/engine/src/lib/registry/types.ts`, add to `AbilityModifiers` (after `suitAs`):

```ts
  // Extra reach for using the named cards (Blockade: { starvation: 1 }).
  rangeBonusFor?: Record<string, number>;
  // Black Tools can't target the owner (Curtain).
  untargetableByBlackTools?: boolean;
  // In the turn owner's turn, only the owner and the dying seat may use Peach (Complete Kill).
  peachOnlyOwnerAndDying?: boolean;
  // The owner's Sha needs two Shan against a female, and a female's Sha at the owner needs two (Garden of Lust).
  doubleAnswersWithFemale?: boolean;
```

In `projects/content/src/lib/shared/abilities.ts`:

1. Add `import { seatGender } from './gender';` below the engine import.
2. Replace `untargetableBy` with:

```ts
// Whether `cardId` can't target `seatId`: an ability of its says so (Wood
// Armor, Humility), says so while its hand is empty (Empty City), or says so
// of black Tools (Curtain; `colour` is the colour the Tool is used as).
export function untargetableBy(state: GameState, seatId: string, cardId: string, registry: ContentRegistry, colour?: 'red' | 'black' | 'none'): boolean {
  const seat = state.seats.find((s) => s.id === seatId);
  const handEmpty = !seat || (state.zones.find((z) => z.id === seat.hand.zoneId)?.cards.length ?? 0) === 0;
  const isTool = registry.cards.get(cardId)?.category === 'tool';
  return activeAbilities(state, seatId, registry).some(
    ({ modifiers }) =>
      !!modifiers?.untargetableBy?.includes(cardId) ||
      (handEmpty && !!modifiers?.untargetableWithEmptyHandBy?.includes(cardId)) ||
      (colour === 'black' && isTool && !!modifiers?.untargetableByBlackTools)
  );
}
```

3. Replace `answersNeededAgainst` with:

```ts
// How many answers `seatId`'s attacks need: Shan to dodge its Sha, Sha each
// time in a Duel with it. Two with Matchless; two for a Sha against (or by) a
// female with Garden of Lust (`versus` is the other seat); else one.
export function answersNeededAgainst(state: GameState, seatId: string, registry: ContentRegistry, versus?: string): 1 | 2 {
  if (activeAbilities(state, seatId, registry).some((a) => a.modifiers?.doubleAnswers)) return 2;
  if (!versus) return 1;
  const garden = (holder: string, other: string) =>
    seatGender(state, other, registry) === 'female' && activeAbilities(state, holder, registry).some((a) => a.modifiers?.doubleAnswersWithFemale);
  return garden(seatId, versus) || garden(versus, seatId) ? 2 : 1;
}

// The extra reach `seatId` has for using the card `cardId` (Blockade).
export function rangeBonusFor(state: GameState, seatId: string, cardId: string, registry: ContentRegistry): number {
  return activeAbilities(state, seatId, registry).reduce((sum, a) => sum + (a.modifiers?.rangeBonusFor?.[cardId] ?? 0), 0);
}

// The turn owner's seat id while its Complete Kill is in play (only it and the
// dying seat may use Peach), else null.
export function peachLockedTo(state: GameState, registry: ContentRegistry): string | null {
  const owner = state.turn.ownerSeatId;
  return activeAbilities(state, owner, registry).some((a) => a.modifiers?.peachOnlyOwnerAndDying) ? owner : null;
}
```

In `projects/content/src/lib/shared/tools.ts`, add (with the imports `ContentRegistry` from engine, and `colourFor` from `./suits`):

```ts
// The colour a card is used as when `ctx.seatId` plays it: its first physical
// card's colour (a conversion's cards share one colour where it matters), or
// none for a card with no physical card.
export function playColour(state: GameState, ctx: { seatId: string; cardInstanceId: string }, registry: ContentRegistry): 'red' | 'black' | 'none' {
  const found = state.zones.flatMap((z) => z.cards).find((c) => c.instanceId === ctx.cardInstanceId);
  return found ? colourFor(state, ctx.seatId, found, registry) : 'none';
}
```

The import line becomes `import type { ContentRegistry, Effect, GameState, Target, UsedCard } from 'engine';` plus `import { colourFor } from './suits';`.

In `projects/content/src/lib/cards/sha.ts`, in the `'sha-armor'` step, change the call to

```ts
          : [shaStep(step, 'sha-shan', { needed: answersNeededAgainst(state, step.userSeatId, registry, step.target.seatId), provided: 0 })];
```

In `projects/content/src/lib/shared/delayed.ts` (`skipPhaseTool`'s `legalPlayTargets`), import `rangeBonusFor` and `playColour`, and replace the filter's last two conditions:

```ts
    legalPlayTargets: (state, ctx, registry) =>
      otherLivingSeatTargets(state, ctx.seatId).filter(
        ([target]) =>
          target.kind === 'seat' &&
          !holdsDelayed(state, target.seatId, id) &&
          !untargetableBy(state, target.seatId, id, registry, playColour(state, ctx, registry)) &&
          (maxDistance === undefined ||
            toolsIgnoreDistance(state, ctx.seatId, registry) ||
            seatDistance(state, ctx.seatId, target.seatId, registry) <= maxDistance + rangeBonusFor(state, ctx.seatId, id, registry))
      ),
```

The imports become `import { rangeBonusFor, toolsIgnoreDistance, untargetableBy } from './abilities';` and `import { COUNTER_CARD_IDS, playColour } from './tools';`.

In `projects/content/src/lib/shared/choices.ts` (`pickACardTool`), import `playColour` from `./tools` (it already imports `toolOnTargets` from there) and change the `untargetableBy` call to `!untargetableBy(state, target.seatId, id, registry, playColour(state, ctx, registry))`.

In `projects/content/src/lib/cards/duel.ts`, import `playColour` from `../shared/tools` and change `legalPlayTargets` to:

```ts
  legalPlayTargets: (state, ctx, registry) =>
    otherLivingSeatTargets(state, ctx.seatId).filter(([t]) => t.kind === 'seat' && !untargetableBy(state, t.seatId, 'duel', registry, playColour(state, ctx, registry))),
```

In `projects/content/src/lib/cards/coerce.ts`, import `untargetableBy` already present and `playColour` from `../shared/tools`; in `legalPlayTargets`, change the holder filter to

```ts
      .filter((holder) => holder.id !== ctx.seatId && wearsWeapon(holder.id) && !untargetableBy(state, holder.id, 'coerce', registry, playColour(state, ctx, registry)))
```

In `projects/content/src/lib/modes/kingdomWar.ts`:

1. Add `import { peachLockedTo } from '../shared/abilities';`.
2. In `hpDropTriggers`, change the third trigger's `effect` signature and `order`:

```ts
      effect: (state, subject, _owner, registry) => {
        const seat = seatOf(state, subject)!;
        const event = subject as DamageDealtEvent | HpLostEvent;
        const amount = event.kind === 'HpLostEvent' ? event.amount : event.damage.amount;
        const everyone = turnOrderFrom(state, state.turn.ownerSeatId);
        // Complete Kill: in its owner's turn only the owner and the dying seat are asked.
        const locked = registry ? peachLockedTo(state, registry) : null;
        return [{
          kind: 'DyingEffect',
          seatId: seat.id,
          order: locked ? everyone.filter((id) => id === locked || id === seat.id) : everyone,
          rescueCardIds: RESCUE_CARD_IDS,
          entering: true,
          // How many points of HP this drop took below 1 (Refusing Death turns one card each).
          pointsBelowOne: Math.min(amount, 1 - seat.combinedHp),
        }];
      },
```

Create `projects/content/src/lib/generals/forest.ts`:

```ts
import type { CardInstance, CardsTurnedUpEvent, ContentRegistry, DamageDealtEvent, Effect, GameState, GeneralOwner, PhaseChangedEvent, SkillDefinition, UsedCard } from 'engine';
import { requireZoneOfKind } from 'engine';
import type { GeneralSkillSet } from './types';
import { attackRange, handOf, seatDistance } from '../shared/queries';
import { untargetableBy } from '../shared/abilities';
import { competeStart, competeStep } from '../shared/compete';
import { colourFor } from '../shared/suits';
import { abilityKey } from '../shared/steps';
import { seatCardOptions } from '../shared/choices';
import { shaAt } from '../cards/sha';
import { ask, atDrawPhase, choiceOf, discardMoves, draw, handZoneId, heal, hpOf, isHurt, isLiving, on, otherLivingSeatIds, ownCards, seatOptions, selectionOf, skillStep, used } from '../shared/skills';

// The Forest Generals' skills (stage 10 spec, "Rule text"). Every skill acts
// for the `owner` the engine passes in: the same General can sit at two seats
// in tests, so a skill must never find "its" seat by searching for its id.

const picked = (step: { data?: Record<string, unknown> }) => (step.data?.['picked'] as string[] | undefined) ?? [];

type DamageStep = Extract<Effect, { kind: 'DamageEffect' }>;
type DiscardZone = Extract<Effect, { kind: 'DiscardZoneEffect' }>;
type ToolResolved = Extract<Effect, { kind: 'ToolResolvedEffect' }>;
type ToolOnTarget = Extract<Effect, { kind: 'ToolOnTargetEffect' }>;

// The HP `seatId` is missing.
const missingHp = (state: GameState, seatId: string) => {
  const seat = state.seats.find((s) => s.id === seatId);
  return seat ? Math.max(0, seat.maxCombinedHp - seat.combinedHp) : 0;
};

// Exaltation and Violent Tyrant: Lord skills, inactive in Kingdom War.
export const exaltation: SkillDefinition = { id: 'exaltation', lord: true };
export const violentTyrant: SkillDefinition = { id: 'violent-tyrant', lord: true };

export const FOREST_GENERALS: GeneralSkillSet[] = [];
```

In `projects/content/src/lib/generals/index.ts`:

```ts
import { FOREST_GENERALS } from './forest';
```
add `...FOREST_GENERALS` to `HAND_CODED`, and append:

```ts
// The 8 Forest Generals (stage 10).
export const FOREST_GENERAL_IDS: readonly string[] = ['xu-huang', 'cao-pi', 'meng-huo', 'zhu-rong', 'sun-jian', 'lu-su', 'dong-zhuo', 'jia-xu'];
```

In `projects/content/src/public-api.ts`, change the generals export to `export { BASE_GENERAL_IDS, FIRE_GENERAL_IDS, FOREST_GENERAL_IDS, WIND_GENERAL_IDS } from './lib/generals';`.

- [ ] **Step 4: Run the new spec**

Run: `npx jest projects/content/src/lib/shared/groundwork10.spec.ts`
Expected: PASS.

- [ ] **Step 5: Run the whole suite**

Run: `npx jest`
Expected: PASS (a registry spec may need the Forest Lord skills — if a spec asserts which Generals have hand-coded skills, none yet change, since `FOREST_GENERALS` is empty).

- [ ] **Step 6: Commit**

```bash
git add projects docs
git commit -m "feat(content): Forest groundwork: modifiers, Garden of Lust count, Starvation range, Complete Kill order" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Wei — Xu Huang (Blockade), Cao Pi (Unnatural Death, Exile)

**Files:**
- Modify: `projects/content/src/lib/generals/forest.ts`
- Test: `projects/content/src/lib/generals/forest-wei.spec.ts` (create)

**Interfaces:**
- Produces: `blockade`, `unnaturalDeath`, `exile` (exported `SkillDefinition`s) and `FOREST_GENERALS` entries for `xu-huang` and `cao-pi`.

- [ ] **Step 1: Write the failing tests**

Create `projects/content/src/lib/generals/forest-wei.spec.ts`:

```ts
import { abilityLog, askedAbout, card, handIds, harness, hp, ids, kwMode, table, TableOptions } from './skills.testing';

const h = harness();
const kw = harness(kwMode);
const at = (seatId: string, main: string, deputy = 'filler-jiang-wei', revealed = true): TableOptions['generals'] => ({ [seatId]: [main, deputy, revealed] });
const hit = (seatId: string, amount: number) => ({
  kind: 'DamageEffect' as const,
  damage: { source: null, target: { kind: 'seat' as const, seatId }, amount, nature: 'normal' as const, cause: {} },
});

describe('Xu Huang — Blockade', () => {
  const hand = { 'seat-a:hand': [card('c1', 'sha', 'club', 4), card('e1', 'crossbow', 'club', 1), card('r1', 'shan', 'heart', 3), card('t1', 'duel', 'spade', 2)] };

  it('any black Basic or Equipment hand card can be used as Starvation, at distance 2', () => {
    let s = table(hand, { generals: at('seat-a', 'xu-huang') });
    s = h.convert(s, 'seat-a', 'blockade', 'seat-c');
    expect(s.pendingSelection).toMatchObject({ of: 'cards', eligibleIds: ['c1', 'e1'] }); // not the red Shan, not the black Tool
    s = h.select(s, 'c1');
    expect(ids(s, 'seat-c:judgment')).toEqual(['c1']);
  });

  it('without Blockade the same card is not offered as Starvation', () => {
    const s = table(hand, { generals: at('seat-a', 'filler-xu-huang') });
    expect(h.legal(s, 'seat-a').some((a) => a.kind === 'UseConversionAction')).toBe(false);
  });

  it('a hidden Xu Huang is offered it too, and the reach is the normal 1 until he is revealed', () => {
    const s = table(hand, { generals: at('seat-a', 'xu-huang', 'filler-jiang-wei', false) });
    const targets = h.legal(s, 'seat-a').filter((a) => a.kind === 'UseConversionAction').map((a) => (a.kind === 'UseConversionAction' ? a.targets[0].seatId : ''));
    expect(targets).toEqual(['seat-b', 'seat-d']);
  });
});

describe('Cao Pi — Unnatural Death', () => {
  const victim = (o: TableOptions = {}) =>
    table(
      { 'seat-b:hand': [card('x', 'sha')], 'seat-b:equip': [card('e', 'black-pommel', 'spade', 6)], 'seat-b:judgment': [card('j', 'capture', 'spade', 6)] },
      { generals: at('seat-a', 'cao-pi'), hp: { 'seat-b': 1 }, ...o }
    );
  // seat-b is hit to 0, nobody can save it: it is eliminated.
  const dies = (s: ReturnType<typeof victim>) => kw.pass(kw.run(s, [hit('seat-b', 1)]));

  it('when another seat dies, Cao Pi may take all its hand, equipment and Judgment cards', () => {
    let s = dies(victim());
    expect(askedAbout(s)).toBe('unnatural-death');
    s = kw.use(s);
    expect(handIds(s, 'seat-a').sort()).toEqual(['e', 'j', 'x']);
    expect(ids(s, 'discardPile')).toEqual([]);
    expect(abilityLog(s)).toContainEqual(expect.objectContaining({ abilityId: 'unnatural-death', outcome: 'took-cards', targetSeatId: 'seat-b' }));
  });

  it("Don't: everything is discarded as usual, and he is asked once (Review Focus 1)", () => {
    const s = kw.decline(dies(victim()));
    expect(s.pendingChoice).toBeUndefined();
    expect(ids(s, 'discardPile').sort()).toEqual(['e', 'j', 'x']);
    expect(handIds(s, 'seat-a')).toEqual([]);
  });

  it('a seat with no cards is not asked about', () => {
    const s = dies(table({}, { generals: at('seat-a', 'cao-pi'), hp: { 'seat-b': 1 } }));
    expect(askedAbout(s)).toBeNull();
  });

  it('does not apply to his own death, and a hidden Cao Pi is offered it as a reveal', () => {
    const own = kw.pass(kw.run(table({ 'seat-a:hand': [card('x', 'sha')] }, { generals: at('seat-a', 'cao-pi'), hp: { 'seat-a': 1 } }), [hit('seat-a', 1)]));
    expect(askedAbout(own)).toBeNull();
    const hidden = dies(victim({ generals: at('seat-a', 'cao-pi', 'filler-jiang-wei', false) }));
    expect(askedAbout(hidden)).toBe('unnatural-death');
    expect(hidden.pendingChoice!.options.find((o) => o.id === 'use')!.shows).toMatchObject({ kind: 'use', reveals: 'main' });
  });
});

describe('Cao Pi — Exile', () => {
  const hurt = (o: TableOptions = {}) => table({ drawPile: [1, 2, 3, 4].map((n) => card(`d${n}`, 'shan', 'heart', n)) }, { generals: at('seat-a', 'cao-pi'), maxHp: { 'seat-a': 3 }, hp: { 'seat-a': 3 }, ...o });

  it('after damage, turns another seat face down and it draws his missing HP', () => {
    let s = h.run(hurt(), [hit('seat-a', 2)]);
    expect(askedAbout(s)).toBe('exile');
    s = h.choose(h.use(s), 'seat-b');
    expect(s.seats[1].faceDown).toBe(true);
    expect(handIds(s, 'seat-b')).toEqual(['d1', 'd2']); // 3 max HP - 1 HP
  });

  it('a face-down seat turns face up, and still draws', () => {
    const t = hurt();
    const s0 = { ...t, seats: t.seats.map((x) => (x.id === 'seat-b' ? { ...x, faceDown: true as const } : x)) };
    const s = h.choose(h.use(h.run(s0, [hit('seat-a', 1)])), 'seat-b');
    expect(s.seats[1].faceDown).toBeUndefined();
    expect(handIds(s, 'seat-b')).toEqual(['d1']);
  });

  it("Don't does nothing, and zero damage never asks", () => {
    expect(h.decline(h.run(hurt(), [hit('seat-a', 1)])).seats[1].faceDown).toBeUndefined();
    expect(askedAbout(h.run(hurt(), [hit('seat-a', 0)]))).toBeNull();
  });

  it('never offers himself', () => {
    const s = h.use(h.run(hurt(), [hit('seat-a', 1)]));
    expect(s.pendingChoice!.options.map((o) => o.id)).toEqual(['seat-b', 'seat-c', 'seat-d']);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest projects/content/src/lib/generals/forest-wei.spec.ts`
Expected: FAIL — `xu-huang` and `cao-pi` have no skills yet (`h.convert` throws "not offered").

- [ ] **Step 3: Implement**

In `projects/content/src/lib/generals/forest.ts`, replace `export const FOREST_GENERALS: GeneralSkillSet[] = [];` with:

```ts
// Accepts black Basic and Equipment hand cards (as the holder's suits count).
const blackBasicOrEquipment = (card: CardInstance, state: GameState, seatId: string, registry: ContentRegistry) =>
  colourFor(state, seatId, card, registry) === 'black' && ['basic', 'equipment'].includes(registry.cards.get(card.definitionId)?.category ?? '');

// Blockade: a black Basic or Equipment hand card may be used as Starvation, and
// reaches 1 further (counted while Xu Huang is revealed).
export const blockade: SkillDefinition = {
  id: 'blockade',
  modifiers: { rangeBonusFor: { starvation: 1 } },
  conversions: [{ id: 'blockade', as: 'starvation', cards: 1, accepts: blackBasicOrEquipment, when: 'play' }],
};

// The cards of a seat's hand, equipment and Judgment slot.
const everyCardOf = (state: GameState, seat: { hand: { zoneId: string }; equipped: { zoneId: string }; judgment: { zoneId: string } }) =>
  [seat.hand, seat.equipped, seat.judgment].flatMap(({ zoneId }) => state.zones.find((z) => z.id === zoneId)?.cards ?? []);

// Unnatural Death (may): when another seat dies, take all its hand, equipment
// and Judgment cards instead of letting them be discarded. Asked in front of
// the mode's discard of the dead seat's hand; Use takes the three zones, so
// the discards that follow find nothing, and Don't lets the discard go on.
export const unnaturalDeath: SkillDefinition = {
  id: 'unnatural-death',
  triggers: [
    on<DiscardZone>('before:DiscardZoneEffect', {
      condition: (state, effect, owner) => {
        if (!isLiving(state, owner.seatId) || (effect.acted ?? []).includes(abilityKey(owner))) return false;
        const dead = state.seats.find((s) => s.eliminated && s.hand.zoneId === effect.zoneId);
        return !!dead && dead.id !== owner.seatId && everyCardOf(state, dead).length > 0;
      },
      effect: (state, effect, owner) => {
        const dead = state.seats.find((s) => s.hand.zoneId === effect.zoneId)!;
        const passed: DiscardZone = { ...effect, acted: [...(effect.acted ?? []), abilityKey(owner)] };
        const take: Effect[] = everyCardOf(state, dead).map((c) => ({ kind: 'MoveCardEffect', cardInstanceId: c.instanceId, toZoneId: handZoneId(state, owner.seatId) }));
        return [ask(owner, [used(owner, 'took-cards', dead.id), ...take], [passed], dead.id)];
      },
    }),
  ],
};

// Exile (may): after you take damage, choose another living seat: it turns
// over (face up if it was down) and draws as many cards as you are now missing
// HP. Once per damage event.
export const exile: SkillDefinition = {
  id: 'exile',
  triggers: [
    on<DamageDealtEvent>('after:DamageDealtEvent', {
      condition: (state, event, owner) =>
        event.damage.target.kind === 'seat' && event.damage.target.seatId === owner.seatId && event.damage.amount > 0 && isLiving(state, owner.seatId) && otherLivingSeatIds(state, owner.seatId).length > 0,
      effect: (_state, _event, owner) => [ask(owner, [skillStep(owner, 'pick')])],
    }),
  ],
  onStep: (state, step) => {
    const { owner } = step;
    if (!isLiving(state, owner.seatId)) return [];
    const missing = missingHp(state, owner.seatId);
    const turnOver = (id: string): Effect =>
      state.seats.find((s) => s.id === id)?.faceDown ? { kind: 'TurnFaceUpEffect', seatId: id } : { kind: 'TurnFaceDownEffect', seatId: id };
    return [
      choiceOf(state, owner, {
        verb: 'pick',
        options: seatOptions(otherLivingSeatIds(state, owner.seatId), (id) => [used(owner, 'exiled', id), turnOver(id), ...(missing > 0 ? [draw(id, missing)] : [])]),
      }),
    ];
  },
};

export const FOREST_GENERALS: GeneralSkillSet[] = [
  { id: 'xu-huang', skills: [blockade] },
  { id: 'cao-pi', skills: [unnaturalDeath, exile, exaltation] },
];
```

- [ ] **Step 4: Run the new spec**

Run: `npx jest projects/content/src/lib/generals/forest-wei.spec.ts`
Expected: PASS.

- [ ] **Step 5: Run the whole content project**

Run: `npx jest --selectProjects content`
Expected: PASS. If a spec still uses the real `xu-huang` or `cao-pi` as a vanilla General, switch it to `filler-xu-huang` / `filler-cao-pi`.

- [ ] **Step 6: Commit**

```bash
git add projects/content
git commit -m "feat(content): Xu Huang's Blockade, Cao Pi's Unnatural Death and Exile" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Shu — Meng Huo (Culprit, Resurgence), Zhu Rong (Giant Elephant, Intense Edge)

**Files:**
- Modify: `projects/content/src/lib/generals/forest.ts`
- Test: `projects/content/src/lib/generals/forest-shu.spec.ts` (create)

**Interfaces:**
- Consumes: Task 1's `ToolResolvedEffect`; Task 2's file header (all imports already present); `competeStart`/`competeStep` from `shared/compete.ts`.
- Produces: `culprit`, `resurgence`, `giantElephant`, `intenseEdge`, and the `meng-huo`, `zhu-rong` entries.

- [ ] **Step 1: Write the failing tests**

Create `projects/content/src/lib/generals/forest-shu.spec.ts`:

```ts
import { abilityLog, askedAbout, card, handIds, harness, hp, ids, kwMode, table, TableOptions } from './skills.testing';

const h = harness();
const kw = harness(kwMode);
const at = (seatId: string, main: string, deputy = 'filler-jiang-wei', revealed = true): TableOptions['generals'] => ({ [seatId]: [main, deputy, revealed] });
const damages = (s: ReturnType<typeof table>) => s.log.flatMap((e) => (e.kind === 'DamageDealtEvent' ? [e.damage] : []));
// Everyone passes until nobody is asked; the seats asked, in order.
const passAll = (s: ReturnType<typeof table>) => {
  const asked: string[] = [];
  let cur = s;
  while (cur.pendingResponse) {
    asked.push(cur.pendingResponse.respondingSeatId);
    cur = h.pass(cur);
  }
  return { state: cur, asked };
};

describe('Meng Huo — Culprit', () => {
  const barbarians = (o: TableOptions = {}) => h.play(table({ 'seat-b:hand': [card('bb', 'barbarians', 'spade', 7)] }, { owner: 'seat-b', generals: at('seat-a', 'meng-huo'), ...o }), 'bb');

  it('Barbarians skips him, and the damage it deals elsewhere counts as his', () => {
    const { state, asked } = passAll(barbarians());
    expect(asked).toEqual(['seat-c', 'seat-d']);
    expect(hp(state, 'seat-a')).toBe(4);
    expect(damages(state)).toEqual([
      expect.objectContaining({ source: { kind: 'seat', seatId: 'seat-a' }, target: { kind: 'seat', seatId: 'seat-c' } }),
      expect.objectContaining({ source: { kind: 'seat', seatId: 'seat-a' }, target: { kind: 'seat', seatId: 'seat-d' } }),
    ]);
  });

  it('a hidden Meng Huo is hit, and the source stays the user', () => {
    const { state, asked } = passAll(barbarians({ generals: at('seat-a', 'meng-huo', 'filler-jiang-wei', false) }));
    expect(asked).toEqual(['seat-c', 'seat-d', 'seat-a']);
    expect(damages(state).every((d) => d.source?.kind === 'seat' && d.source.seatId === 'seat-b')).toBe(true);
  });

  it('his own Barbarians keeps him as the source', () => {
    const own = h.play(table({ 'seat-a:hand': [card('bb', 'barbarians', 'spade', 7)] }, { generals: at('seat-a', 'meng-huo') }), 'bb');
    const { state } = passAll(own);
    expect(damages(state)).toHaveLength(3);
  });
});

describe('Meng Huo — Resurgence', () => {
  const pile = [card('h1', 'peach', 'heart', 5), card('s1', 'sha', 'spade', 6), card('h2', 'peach', 'heart', 7), card('c1', 'shan', 'club', 8), card('rest', 'shan', 'diamond', 9)];
  // seat-d's turn ends; seat-a's Draw Phase comes.
  const drawing = (o: TableOptions = {}) => kw.settle(table({ drawPile: pile }, { generals: at('seat-a', 'meng-huo'), owner: 'seat-d', phase: 'End', hp: { 'seat-a': 2 }, ...o }));

  it('instead of drawing: reveal as many cards as missing HP; each heart heals 1 and is discarded; the rest go to his hand', () => {
    let s = drawing();
    expect(askedAbout(s)).toBe('resurgence');
    s = kw.use(s);
    expect(hp(s, 'seat-a')).toBe(3); // missing 2: h1 (heart) and s1 (spade) revealed
    expect(ids(s, 'discardPile')).toEqual(['h1']);
    expect(handIds(s, 'seat-a')).toEqual(['s1']);
    expect(ids(s, 'drawPile')).toEqual(['h2', 'c1', 'rest']);
  });

  it('two hearts heal 2 and both are discarded', () => {
    const s = kw.use(drawing({ drawPile: [card('h1', 'peach', 'heart', 5), card('h2', 'peach', 'heart', 7), card('x', 'sha')] }));
    expect(hp(s, 'seat-a')).toBe(4);
    expect(ids(s, 'discardPile')).toEqual(['h1', 'h2']);
    expect(handIds(s, 'seat-a')).toEqual([]);
  });

  it("Don't draws normally; at full HP it is not offered", () => {
    expect(handIds(kw.decline(drawing()), 'seat-a')).toEqual(['h1', 's1']);
    expect(askedAbout(drawing({ hp: { 'seat-a': 4 } }))).toBeNull();
  });
});

describe('Zhu Rong — Giant Elephant', () => {
  const barbarians = (o: TableOptions = {}, owner = 'seat-b') =>
    h.play(table({ [`${owner}:hand`]: [card('bb', 'barbarians', 'spade', 7)] }, { owner, generals: at('seat-a', 'zhu-rong'), ...o }), 'bb');

  it("Barbarians skips her; after it finishes resolving she takes the card", () => {
    const { state, asked } = passAll(barbarians());
    expect(asked).toEqual(['seat-c', 'seat-d']);
    expect(handIds(state, 'seat-a')).toEqual(['bb']);
    expect(ids(state, 'discardPile')).toEqual([]);
    expect(hp(state, 'seat-a')).toBe(4);
  });

  it("not her own Barbarians (Review Focus 2); a hidden Zhu Rong is hit and takes nothing", () => {
    const own = passAll(h.play(table({ 'seat-a:hand': [card('bb', 'barbarians', 'spade', 7)] }, { generals: at('seat-a', 'zhu-rong') }), 'bb')).state;
    expect(ids(own, 'discardPile')).toEqual(['bb']);
    const hidden = passAll(barbarians({ generals: at('seat-a', 'zhu-rong', 'filler-jiang-wei', false) }));
    expect(hidden.asked).toEqual(['seat-c', 'seat-d', 'seat-a']);
    expect(handIds(hidden.state, 'seat-a')).toEqual([]);
  });
});

describe('Zhu Rong — Intense Edge', () => {
  // seat-a's Sha hits seat-b, who holds no Shan.
  const hitB = (aHand: ReturnType<typeof card>[], bHand: ReturnType<typeof card>[], o: TableOptions = {}) =>
    h.pass(h.play(table({ 'seat-a:hand': [card('s1', 'sha'), ...aHand], 'seat-b:hand': bHand, 'seat-b:equip': [card('e', 'black-pommel', 'spade', 6)] }, { generals: at('seat-a', 'zhu-rong'), ...o }), 's1', 'seat-b'));

  it('after her Sha damages a seat she may compete; on a win she takes one of its cards', () => {
    let s = hitB([card('c9', 'sha', 'heart', 9)], [card('b5', 'sha', 'heart', 5), card('b6', 'peach', 'heart', 6)]);
    expect(askedAbout(s)).toBe('intense-edge');
    s = h.select(h.select(h.use(s), 'c9'), 'b5');
    expect(s.pendingChoice).toMatchObject({ verb: 'take', seatId: 'seat-a' });
    s = h.choose(s, 'e');
    expect(handIds(s, 'seat-a')).toEqual(['e']);
  });

  it('a tie loses: she takes nothing', () => {
    const s = h.select(h.select(h.use(hitB([card('c7', 'sha', 'heart', 7)], [card('b7', 'sha', 'heart', 7)])), 'c7'), 'b7');
    expect(s.pendingChoice).toBeUndefined();
    expect(handIds(s, 'seat-a')).toEqual([]);
  });

  it('is not offered without a hand card on both sides, or when the Sha did no damage', () => {
    expect(askedAbout(hitB([], [card('b5', 'sha')]))).toBeNull(); // her hand is empty after the Sha
    expect(askedAbout(hitB([card('c9', 'sha', 'heart', 9)], []))).toBeNull(); // its hand is empty
    const dodged = h.respond(h.play(table({ 'seat-a:hand': [card('s1', 'sha'), card('c9', 'sha', 'heart', 9)], 'seat-b:hand': [card('d', 'shan', 'heart', 2)] }, { generals: at('seat-a', 'zhu-rong') }), 's1', 'seat-b'), 'd');
    expect(askedAbout(dodged)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest projects/content/src/lib/generals/forest-shu.spec.ts`
Expected: FAIL (the four skills do not exist).

- [ ] **Step 3: Implement**

In `projects/content/src/lib/generals/forest.ts`, insert before `export const FOREST_GENERALS`:

```ts
// Culprit (compulsory): Barbarians skips you, and the damage another seat's
// Barbarians deals counts as yours.
export const culprit: SkillDefinition = {
  id: 'culprit',
  compulsory: true,
  modifiers: { untargetableBy: ['barbarians'] },
  triggers: [
    on<DamageStep>('before:DamageEffect', {
      // Once per damage (`acted`): an ask later in the chain sends the damage back through here.
      condition: (state, { damage, acted }, owner) =>
        !(acted ?? []).includes(abilityKey(owner)) &&
        damage.cause?.card?.as === 'barbarians' &&
        damage.source?.kind === 'seat' &&
        damage.source.seatId !== owner.seatId &&
        isLiving(state, owner.seatId),
      effect: (_state, step, owner) => [
        { ...step, damage: { ...step.damage, source: { kind: 'seat', seatId: owner.seatId } }, acted: [...(step.acted ?? []), abilityKey(owner)] },
        used(owner, 'culprit', (step.damage.target as { seatId: string }).seatId),
      ],
    }),
  ],
};

// Resurgence (may): in your Draw Phase, if hurt, instead of drawing reveal as
// many cards as you miss HP. Each heart recovers 1 HP and is discarded; the
// rest go to your hand.
export const resurgence: SkillDefinition = {
  id: 'resurgence',
  triggers: [
    atDrawPhase({
      condition: (state, draw, owner) => draw.count > 0 && isHurt(state, owner.seatId),
      use: (state, _passed, owner) => [{ kind: 'RevealToProcessingEffect', count: missingHp(state, owner.seatId) }, skillStep(owner, 'sort')],
    }),
  ],
  onStep: (state, step) => {
    const { owner } = step;
    const processing = requireZoneOfKind(state.zones, 'processing');
    const turnedUp = [...state.log].reverse().find((e): e is CardsTurnedUpEvent => e.kind === 'CardsTurnedUpEvent');
    const here = new Set(processing.cards.map((c) => c.instanceId));
    const revealed = (turnedUp?.cards ?? []).filter((c) => here.has(c.instanceId));
    const hearts = revealed.filter((c) => c.suit === 'heart');
    const rest = revealed.filter((c) => c.suit !== 'heart');
    return [
      used(owner, 'revealed'),
      ...hearts.map(() => heal(owner.seatId, 1)),
      ...discardMoves(state, hearts.map((c) => c.instanceId)),
      ...rest.map((c): Effect => ({ kind: 'MoveCardEffect', cardInstanceId: c.instanceId, toZoneId: handZoneId(state, owner.seatId), onlyFrom: processing.id })),
    ];
  },
};

// Giant Elephant (compulsory): another seat's Barbarians skips you; once it has
// finished resolving, you take it into your hand (if it still lies discarded).
export const giantElephant: SkillDefinition = {
  id: 'giant-elephant',
  compulsory: true,
  modifiers: { untargetableBy: ['barbarians'] },
  triggers: [
    on<ToolResolved>('before:ToolResolvedEffect', {
      condition: (state, effect, owner) => {
        const discard = requireZoneOfKind(state.zones, 'discardPile');
        return (
          effect.tool.as === 'barbarians' &&
          effect.seatId !== owner.seatId &&
          isLiving(state, owner.seatId) &&
          effect.tool.physical.some((c) => discard.cards.some((d) => d.instanceId === c.instanceId))
        );
      },
      effect: (state, effect, owner) => {
        const discard = requireZoneOfKind(state.zones, 'discardPile');
        const moves = effect.tool.physical.map((c): Effect => ({ kind: 'MoveCardEffect', cardInstanceId: c.instanceId, toZoneId: handZoneId(state, owner.seatId), onlyFrom: discard.id }));
        // The first effect stands in for the marker; the log line follows.
        return [...moves, used(owner, 'took-card')];
      },
    }),
  ],
};

// Intense Edge (may): when your Sha damages another seat, compete with it; on a
// win take one of its cards (a hidden hand card, or a worn or Judgment card).
export const intenseEdge: SkillDefinition = {
  id: 'intense-edge',
  triggers: [
    on<DamageDealtEvent>('after:DamageDealtEvent', {
      condition: (state, event, owner) => {
        const { source, target, amount, cause } = event.damage;
        return (
          source?.kind === 'seat' && source.seatId === owner.seatId &&
          target.kind === 'seat' && target.seatId !== owner.seatId &&
          amount > 0 && cause?.card?.as === 'sha' &&
          isLiving(state, owner.seatId) && isLiving(state, target.seatId) &&
          handOf(state, owner.seatId).length > 0 && handOf(state, target.seatId).length > 0
        );
      },
      effect: (_state, event, owner) => {
        const target = (event.damage.target as { seatId: string }).seatId;
        return [ask(owner, [skillStep(owner, 'start', { target })], [], target)];
      },
    }),
  ],
  onStep: (state, step) => {
    const competing = competeStep(state, step);
    if (competing) return competing;
    const { owner } = step;
    const target = step.data?.['target'] as string;
    if (step.step === 'start') return competeStart(state, owner, target, 'result');
    // 'result'
    if (!step.data?.['won'] || !isLiving(state, target) || !isLiving(state, owner.seatId)) return [];
    const options = seatCardOptions(state, target, handZoneId(state, owner.seatId));
    return options.length > 0 ? [choiceOf(state, owner, { verb: 'take', targetSeatId: target, options })] : [];
  },
};

export const FOREST_GENERALS: GeneralSkillSet[] = [
  { id: 'xu-huang', skills: [blockade] },
  { id: 'cao-pi', skills: [unnaturalDeath, exile, exaltation] },
  { id: 'meng-huo', skills: [culprit, resurgence] },
  { id: 'zhu-rong', skills: [giantElephant, intenseEdge] },
];
```

Delete the old three-entry `FOREST_GENERALS` block that Task 3 wrote.

Note on the Culprit rewrite: `rewriteEffect` takes the first output as the changed effect; returning only the rewritten `DamageEffect` (marked `acted`) is enough.

- [ ] **Step 4: Run the new spec**

Run: `npx jest projects/content/src/lib/generals/forest-shu.spec.ts`
Expected: PASS. If "Barbarians skips him" fails on the log shape, assert on `DamageDealtEvent` entries (`e.damage.source`, `e.damage.target`) directly; the test's `e.kind === 'DamageEffect'` branch is a type guard only.

- [ ] **Step 5: Run the whole content project**

Run: `npx jest --selectProjects content`
Expected: PASS; switch any spec that relied on a real `meng-huo` or `zhu-rong` as a vanilla General to the `filler-` one.

- [ ] **Step 6: Commit**

```bash
git add projects/content
git commit -m "feat(content): Meng Huo's Culprit and Resurgence, Zhu Rong's Giant Elephant and Intense Edge" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Wu — Sun Jian (Brave Spirit), Lu Su (Charity, Alliance)

**Files:**
- Modify: `projects/content/src/lib/generals/forest.ts`
- Test: `projects/content/src/lib/generals/forest-wu.spec.ts` (create)

**Interfaces:**
- Produces: `braveSpirit`, `charity`, `alliance`, and the `sun-jian`, `lu-su` entries.

- [ ] **Step 1: Write the failing tests**

Create `projects/content/src/lib/generals/forest-wu.spec.ts`:

```ts
import { askedAbout, card, handIds, harness, hp, ids, table, TableOptions } from './skills.testing';

const h = harness();
const at = (seatId: string, main: string, deputy = 'filler-jiang-wei', revealed = true): TableOptions['generals'] => ({ [seatId]: [main, deputy, revealed] });
const cards = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => card(`${prefix}${i + 1}`, 'shan', 'heart', i + 1));

describe('Sun Jian — Brave Spirit', () => {
  // seat-d's turn ends; seat-a's Start Phase comes.
  const starting = (o: TableOptions = {}, extra: Record<string, ReturnType<typeof card>[]> = {}) =>
    h.settle(table({ drawPile: cards('d', 6), ...extra }, { generals: at('seat-a', 'sun-jian'), owner: 'seat-d', phase: 'End', hp: { 'seat-a': 1 }, ...o }));

  it('at the start of his turn, if damaged, the seat he picks either draws X and discards 1, or draws 1 and discards X', () => {
    let s = starting(); // X = 3
    expect(askedAbout(s)).toBe('brave-spirit');
    s = h.choose(h.use(s), 'seat-b');
    expect(s.pendingChoice).toMatchObject({ seatId: 'seat-b' });
    expect(s.pendingChoice!.options.map((o) => o.shows)).toEqual([{ kind: 'label', text: 'Draw 3, Then Discard 1' }, { kind: 'label', text: 'Draw 1, Then Discard 3' }]);
    s = h.choose(s, 'draw-x');
    expect(s.pendingSelection).toMatchObject({ seatId: 'seat-b', min: 1, max: 1 });
    s = h.select(s, 'd1');
    expect(handIds(s, 'seat-b')).toEqual(['d2', 'd3']);
    expect(ids(s, 'discardPile')).toEqual(['d1']);
  });

  it('the other option: draw 1, discard X (at most what the seat holds)', () => {
    let s = h.choose(h.choose(h.use(starting()), 'seat-b'), 'draw-1');
    expect(s.pendingSelection).toMatchObject({ min: 1, max: 1 }); // only 1 card held
    s = h.select(s, 'd1');
    expect(handIds(s, 'seat-b')).toEqual([]);
  });

  it('he may pick himself', () => {
    const s = h.use(starting());
    expect(s.pendingChoice!.options.map((o) => o.id)).toEqual(['seat-a', 'seat-b', 'seat-c', 'seat-d']);
  });

  it('is not asked at full HP, and Don’t does nothing', () => {
    expect(askedAbout(starting({ hp: { 'seat-a': 4 } }))).toBeNull();
    expect(handIds(h.decline(starting()), 'seat-b')).toEqual([]);
  });
});

describe('Lu Su — Charity', () => {
  const drawing = (hand: number, o: TableOptions = {}, extra: Record<string, ReturnType<typeof card>[]> = {}) =>
    h.run(table({ 'seat-a:hand': cards('a', hand), drawPile: cards('d', 6), ...extra }, { generals: at('seat-a', 'lu-su'), ...o }), [{ kind: 'DrawPhaseEffect', seatId: 'seat-a', count: 2 }]);

  it('draws 2 extra; with more than 5 cards he gives half (rounded down) to the seat with fewest hand cards', () => {
    let s = drawing(2, {}, { 'seat-c:hand': cards('c', 1), 'seat-d:hand': cards('e', 2) }); // 2 + 4 = 6 cards
    expect(askedAbout(s)).toBe('charity');
    s = h.use(s);
    expect(s.pendingSelection).toMatchObject({ min: 3, max: 3, seatId: 'seat-a' });
    s = h.select(s, 'a1', 'a2', 'd1');
    expect(handIds(s, 'seat-a')).toHaveLength(3);
    expect(handIds(s, 'seat-b')).toEqual(['a1', 'a2', 'd1']); // seat-b holds 0
  });

  it('exactly 5 cards: nothing is given (Review Focus 3)', () => {
    const s = h.use(drawing(1));
    expect(s.pendingSelection).toBeUndefined();
    expect(handIds(s, 'seat-a')).toHaveLength(5);
  });

  it('a tie for fewest hand cards: he chooses who gets them', () => {
    let s = h.select(h.use(drawing(2)), 'a1', 'a2', 'd1'); // seat-b, seat-c and seat-d all hold 0
    expect(s.pendingChoice).toMatchObject({ verb: 'give', seatId: 'seat-a' });
    expect(s.pendingChoice!.options.map((o) => o.id)).toEqual(['seat-b', 'seat-c', 'seat-d']);
    s = h.choose(s, 'seat-c');
    expect(handIds(s, 'seat-c')).toEqual(['a1', 'a2', 'd1']);
  });

  it("Don't draws just 2", () => {
    expect(handIds(h.decline(drawing(2)), 'seat-a')).toHaveLength(4);
  });
});

describe('Lu Su — Alliance', () => {
  const tableOf = (aCards: number, bCards: number, cCards: number, dCards = cCards, o: TableOptions = {}) =>
    table({ 'seat-a:hand': cards('a', aCards), 'seat-b:hand': cards('b', bCards), 'seat-c:hand': cards('c', cCards), 'seat-d:hand': cards('e', dCards) }, { generals: at('seat-a', 'lu-su'), ...o });
  const offered = (s: ReturnType<typeof tableOf>) => h.legal(s, 'seat-a').some((a) => a.kind === 'UseSkillAction' && a.owner.kind === 'general' && a.owner.skillId === 'alliance');

  it('two other seats swap hands, and he discards as many cards as the difference', () => {
    let s = h.useSkill(tableOf(3, 4, 1), 'seat-a', 'alliance');
    expect(s.pendingSelection).toMatchObject({ of: 'seats', min: 1, max: 1 });
    s = h.select(s, 'seat-b');
    expect(s.pendingChoice!.options.map((o) => o.id)).toEqual(['seat-c', 'seat-d']);
    s = h.choose(s, 'seat-c');
    expect(s.pendingSelection).toMatchObject({ of: 'cards', min: 3, max: 3 });
    s = h.select(s, 'a1', 'a2', 'a3');
    expect(ids(s, 'discardPile')).toEqual(['a1', 'a2', 'a3']);
    expect(handIds(s, 'seat-b')).toEqual(['c1']);
    expect(handIds(s, 'seat-c')).toEqual(['b1', 'b2', 'b3', 'b4']);
  });

  it('equal hands are never offered as a pair (Review Focus 4)', () => {
    let s = h.useSkill(tableOf(3, 4, 1, 4), 'seat-a', 'alliance');
    s = h.select(s, 'seat-b');
    expect(s.pendingChoice!.options.map((o) => o.id)).toEqual(['seat-c']); // seat-d holds 4 as well
  });

  it('a pair that costs more than he holds is not offered', () => {
    expect(offered(tableOf(2, 4, 1))).toBe(false); // cost 3, he holds 2
    expect(offered(tableOf(3, 4, 1))).toBe(true);
  });

  it('his equipment pays too', () => {
    const base = tableOf(1, 4, 1, 1);
    const withGear = { ...base, zones: base.zones.map((z) => (z.id === 'seat-a:equip' ? { ...z, cards: [card('g1', 'crossbow', 'club', 1), card('g2', 'silver-lion', 'club', 1)] } : z)) };
    let t = h.select(h.useSkill(withGear, 'seat-a', 'alliance'), 'seat-b');
    t = h.choose(t, 'seat-c');
    expect(t.pendingSelection!.eligibleIds).toEqual(['a1', 'g1', 'g2']);
    t = h.select(t, 'g1', 'g2', 'a1');
    expect(handIds(t, 'seat-b')).toEqual(['c1']);
  });

  it('once per turn', () => {
    const fresh = tableOf(8, 4, 1);
    let t = h.select(h.useSkill(fresh, 'seat-a', 'alliance'), 'seat-b');
    t = h.select(h.choose(t, 'seat-c'), 'a1', 'a2', 'a3');
    expect(offered(fresh)).toBe(true);
    expect(offered(t)).toBe(false); // five cards left, and pairs he could pay for, but the use is spent
  });

  it('cancelling the first pick costs nothing', () => {
    const s = h.cancel(h.useSkill(tableOf(3, 4, 1), 'seat-a', 'alliance'));
    expect(offered(s)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest projects/content/src/lib/generals/forest-wu.spec.ts`
Expected: FAIL (skills missing).

- [ ] **Step 3: Implement**

In `projects/content/src/lib/generals/forest.ts`, insert before `export const FOREST_GENERALS`:

```ts
// Brave Spirit (may): at the start of your Start Phase, if damaged (X = missing
// HP), pick any seat (yourself included). It chooses: draw X then discard 1, or
// draw 1 then discard X.
export const braveSpirit: SkillDefinition = {
  id: 'brave-spirit',
  triggers: [
    on<PhaseChangedEvent>('after:PhaseChangedEvent', {
      condition: (state, event, owner) => event.phase === 'Start' && event.seatId === owner.seatId && isHurt(state, owner.seatId),
      effect: (_state, _event, owner) => [ask(owner, [skillStep(owner, 'pick')])],
    }),
  ],
  onStep: (state, step) => {
    const { owner } = step;
    if (step.step === 'pick') {
      const x = missingHp(state, owner.seatId);
      if (x < 1 || !isLiving(state, owner.seatId)) return [];
      const seats = [...state.seats].filter((s) => !s.eliminated).sort((a, b) => a.index - b.index).map((s) => s.id);
      return [choiceOf(state, owner, { verb: 'pick', options: seatOptions(seats, (id) => [skillStep(owner, 'forced', { target: id, x })]) })];
    }
    const target = step.data?.['target'] as string;
    if (!isLiving(state, target)) return [];
    if (step.step === 'forced') {
      const x = step.data?.['x'] as number;
      return [
        choiceOf(state, owner, {
          verb: 'pick',
          seatId: target,
          targetSeatId: owner.seatId,
          options: [
            { id: 'draw-x', shows: { kind: 'label', text: `Draw ${x}, Then Discard 1` }, effects: [used(owner, 'drew', target), draw(target, x), skillStep(owner, 'discard', { target, n: 1 })] },
            { id: 'draw-1', shows: { kind: 'label', text: `Draw 1, Then Discard ${x}` }, effects: [used(owner, 'drew', target), draw(target, 1), skillStep(owner, 'discard', { target, n: x })] },
          ],
        }),
      ];
    }
    if (step.step === 'discard') {
      const hand = handOf(state, target);
      const n = Math.min(step.data?.['n'] as number, hand.length);
      if (n === 0) return [];
      return [
        selectionOf(state, owner, {
          seatId: target, of: 'cards', eligibleIds: hand.map((c) => c.instanceId), min: n, max: n, targetSeatId: owner.seatId,
          then: { kind: 'skill-step', step: skillStep(owner, 'discarded') },
        }),
      ];
    }
    // 'discarded'
    return discardMoves(state, picked(step));
  },
};

// Charity (may): in your Draw Phase draw 2 more. Then, holding more than 5 hand
// cards, give half of them (rounded down) to the other seat with the fewest
// hand cards (you choose among a tie).
export const charity: SkillDefinition = {
  id: 'charity',
  triggers: [
    atDrawPhase({
      condition: (_state, draw) => draw.count > 0,
      use: (_state, passed, owner) => [{ ...passed, count: passed.count + 2 }, skillStep(owner, 'give')],
    }),
  ],
  onStep: (state, step) => {
    const { owner } = step;
    if (!isLiving(state, owner.seatId)) return [];
    const others = otherLivingSeatIds(state, owner.seatId);
    if (step.step === 'give') {
      const hand = handOf(state, owner.seatId);
      if (hand.length <= 5 || others.length === 0) return [];
      const half = Math.floor(hand.length / 2);
      return [selectionOf(state, owner, { of: 'cards', eligibleIds: hand.map((c) => c.instanceId), min: half, max: half, then: { kind: 'skill-step', step: skillStep(owner, 'to') } })];
    }
    // 'to'
    const cards = picked(step);
    const fewest = Math.min(...others.map((id) => handOf(state, id).length));
    const tied = others.filter((id) => handOf(state, id).length === fewest);
    const moves = (id: string): Effect[] => cards.map((cardInstanceId) => ({ kind: 'MoveCardEffect', cardInstanceId, toZoneId: handZoneId(state, id) }));
    if (tied.length === 1) return [used(owner, 'gave', tied[0]), ...moves(tied[0])];
    return [choiceOf(state, owner, { verb: 'give', options: seatOptions(tied, moves) })];
  },
};

// Cards a seat holds in hand and worn.
const cardCount = (state: GameState, seatId: string) => ownCards(state, seatId, true).length;

// The seats Lu Su can pair with `first`: other living seats (not him, not
// `first`) whose hand size differs, at a difference he can pay in cards.
const alliancePartners = (state: GameState, luSu: string, first: string) =>
  otherLivingSeatIds(state, luSu).filter((id) => {
    const cost = Math.abs(handOf(state, first).length - handOf(state, id).length);
    return id !== first && cost > 0 && cost <= cardCount(state, luSu);
  });

// Alliance (active, once per turn): choose two other seats with different hand
// sizes; discard as many cards as the difference; they swap hands.
export const alliance: SkillDefinition = {
  id: 'alliance',
  active: {
    usesPerTurn: 1,
    canUse: (state, { seatId }) => otherLivingSeatIds(state, seatId).some((id) => alliancePartners(state, seatId, id).length > 0),
    start: (state, { seatId, owner }) => [
      selectionOf(state, owner, {
        of: 'seats',
        eligibleIds: otherLivingSeatIds(state, seatId).filter((id) => alliancePartners(state, seatId, id).length > 0),
        min: 1, max: 1,
        then: { kind: 'skill-step', step: skillStep(owner, 'second') },
        onCancel: [],
      }),
    ],
  },
  onStep: (state, step) => {
    const { owner } = step;
    if (step.step === 'second') {
      const first = picked(step)[0];
      return [choiceOf(state, owner, { verb: 'pick', targetSeatId: first, options: seatOptions(alliancePartners(state, owner.seatId, first), (second) => [skillStep(owner, 'pay', { first, second })]) })];
    }
    const first = step.data?.['first'] as string;
    const second = step.data?.['second'] as string;
    if (!isLiving(state, first) || !isLiving(state, second) || !isLiving(state, owner.seatId)) return [];
    if (step.step === 'pay') {
      const cost = Math.abs(handOf(state, first).length - handOf(state, second).length);
      if (cost === 0) return [];
      return [
        selectionOf(state, owner, {
          of: 'cards', eligibleIds: ownCards(state, owner.seatId, true).map((c) => c.instanceId), min: cost, max: cost,
          then: { kind: 'skill-step', step: skillStep(owner, 'swap', { first, second }) },
        }),
      ];
    }
    // 'swap'
    const toSecond = handOf(state, first).map((c): Effect => ({ kind: 'MoveCardEffect', cardInstanceId: c.instanceId, toZoneId: handZoneId(state, second) }));
    const toFirst = handOf(state, second).map((c): Effect => ({ kind: 'MoveCardEffect', cardInstanceId: c.instanceId, toZoneId: handZoneId(state, first) }));
    return [...discardMoves(state, picked(step)), used(owner, 'swap-first', first), used(owner, 'swapped', second), ...toSecond, ...toFirst];
  },
};

export const FOREST_GENERALS: GeneralSkillSet[] = [
  { id: 'xu-huang', skills: [blockade] },
  { id: 'cao-pi', skills: [unnaturalDeath, exile, exaltation] },
  { id: 'meng-huo', skills: [culprit, resurgence] },
  { id: 'zhu-rong', skills: [giantElephant, intenseEdge] },
  { id: 'sun-jian', skills: [braveSpirit] },
  { id: 'lu-su', skills: [charity, alliance] },
];
```

Delete the previous four-entry `FOREST_GENERALS` block.

- [ ] **Step 4: Run the new spec**

Run: `npx jest projects/content/src/lib/generals/forest-wu.spec.ts`
Expected: PASS. Two spots to check if a test fails on a detail rather than the rule:
- the `'his equipment pays too'` test reads `eligibleIds` order (`ownCards` is hand first, then worn); adjust the expected order if the hand zone lists differently;
- the last line of that test builds a state with no pending decision to ask `canUse` once the turn count is spent; if `h.legal` still lists the skill because the selection left state pending, assert `t.turn.abilityUses` records the use instead.

- [ ] **Step 5: Run the whole content project**

Run: `npx jest --selectProjects content`
Expected: PASS; switch real `sun-jian` / `lu-su` vanilla uses in older specs to their fillers.

- [ ] **Step 6: Commit**

```bash
git add projects/content
git commit -m "feat(content): Sun Jian's Brave Spirit, Lu Su's Charity and Alliance" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Qun — Dong Zhuo (Wine, Garden of Lust, Collapse), Jia Xu (Complete Kill, Upheaval, Curtain)

**Files:**
- Modify: `projects/content/src/lib/generals/forest.ts`
- Test: `projects/content/src/lib/generals/forest-qun.spec.ts` (create)

**Interfaces:**
- Consumes: Task 1's `sourceSkill`, `ReduceMaxHpEffect`; Task 2's modifiers, `peachLockedTo`.
- Produces: `wine`, `gardenOfLust`, `collapse`, `completeKill`, `upheaval`, `curtain`, and the `dong-zhuo`, `jia-xu` entries. Upheaval's window carries `reason { kind: 'ability', owner, abilityId: 'upheaval', targetSeatId: <victim> }` and `sourceSkill { owner, step: 'sha', data: { victim, left } }`. Its seat choice has ids `<seatId>` for each seat in range and `pass`.

- [ ] **Step 1: Write the failing tests**

Create `projects/content/src/lib/generals/forest-qun.spec.ts`:

```ts
import type { GameState } from 'engine';
import { askedAbout, card, handIds, harness, hp, ids, kwMode, table, TableOptions } from './skills.testing';

const h = harness();
const kw = harness(kwMode);
const at = (seatId: string, main: string, deputy = 'filler-jiang-wei', revealed = true): TableOptions['generals'] => ({ [seatId]: [main, deputy, revealed] });
const hit = (seatId: string, amount: number) => ({
  kind: 'DamageEffect' as const,
  damage: { source: null, target: { kind: 'seat' as const, seatId }, amount, nature: 'normal' as const, cause: {} },
});
const offered = (s: GameState, seatId: string, skillId: string) =>
  h.legal(s, seatId).some((a) => a.kind === 'UseSkillAction' && a.owner.kind === 'general' && a.owner.skillId === skillId);

describe('Dong Zhuo — Wine', () => {
  it('a spade hand card can be used as Wine, a heart cannot', () => {
    let s = table({ 'seat-a:hand': [card('sp', 'shan', 'spade', 3), card('he', 'shan', 'heart', 3)] }, { generals: at('seat-a', 'dong-zhuo') });
    s = h.convert(s, 'seat-a', 'wine');
    expect(s.pendingSelection).toMatchObject({ eligibleIds: ['sp'] });
    s = h.select(s, 'sp');
    expect(s.turn.flags?.['wine']).toBe(true);
  });

  it('rescues himself while dying', () => {
    let s = kw.run(table({ 'seat-a:hand': [card('sp', 'shan', 'spade', 3)] }, { generals: at('seat-a', 'dong-zhuo'), hp: { 'seat-a': 1 } }), [hit('seat-a', 1)]);
    s = kw.convert(s, 'seat-a', 'wine');
    s = kw.select(s, 'sp');
    expect(hp(s, 'seat-a')).toBe(1);
  });
});

describe('Dong Zhuo — Garden of Lust', () => {
  const shaAt = (attacker: string, target: string, generals: TableOptions['generals'], targetCards: ReturnType<typeof card>[]) =>
    h.play(
      table({ [`${attacker}:hand`]: [card('s1', 'sha')], [`${target}:hand`]: targetCards }, { owner: attacker, generals }),
      's1',
      target
    );
  const shans = [card('d1', 'shan', 'heart', 2), card('d2', 'shan', 'heart', 3)];

  it('his Sha at a female needs two Shan', () => {
    let s = shaAt('seat-a', 'seat-b', { ...at('seat-a', 'dong-zhuo'), ...at('seat-b', 'diao-chan') }, shans);
    s = h.respond(s, 'd1');
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-b' });
    s = h.respond(s, 'd2');
    expect(s.pendingResponse).toBeNull();
    expect(hp(s, 'seat-b')).toBe(4);
  });

  it("a female's Sha at him needs two too", () => {
    let s = shaAt('seat-b', 'seat-a', { ...at('seat-a', 'dong-zhuo'), ...at('seat-b', 'diao-chan') }, shans);
    s = h.respond(s, 'd1');
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-a' });
  });

  it('a male, or a hidden Dong Zhuo, needs one', () => {
    expect(shaAt('seat-a', 'seat-b', at('seat-a', 'dong-zhuo'), shans).pendingResponse).not.toBeNull();
    expect(h.respond(shaAt('seat-a', 'seat-b', at('seat-a', 'dong-zhuo'), shans), 'd1').pendingResponse).toBeNull();
    const hidden = h.respond(shaAt('seat-a', 'seat-b', { ...at('seat-a', 'dong-zhuo', 'filler-jiang-wei', false), ...at('seat-b', 'diao-chan') }, shans), 'd1');
    expect(hidden.pendingResponse).toBeNull();
  });
});

describe('Dong Zhuo — Collapse', () => {
  const big = (o: TableOptions = {}) => table({}, { generals: at('seat-a', 'dong-zhuo'), hp: { 'seat-a': 5 }, maxHp: { 'seat-a': 5 }, ...o });
  const ending = (s: GameState) => h.act(s, { kind: 'EndPhaseAction', seatId: 'seat-a' });

  it('at the end of his turn, with strictly the most HP, he loses 1 HP or reduces his max HP by 1', () => {
    let s = ending(big());
    expect(askedAbout(s)).toBe('collapse');
    expect(s.pendingChoice!.options.map((o) => o.id)).toEqual(['lose-hp', 'reduce-max-hp']);
    expect(hp(h.choose(s, 'lose-hp'), 'seat-a')).toBe(4);
    s = h.choose(s, 'reduce-max-hp');
    expect(s.seats[0]).toMatchObject({ combinedHp: 4, maxCombinedHp: 4 });
  });

  it('a tie in HP, or a hidden Dong Zhuo, does nothing', () => {
    expect(askedAbout(ending(big({ hp: { 'seat-a': 5, 'seat-b': 5 } })))).toBeNull();
    expect(askedAbout(ending(big({ generals: at('seat-a', 'dong-zhuo', 'filler-jiang-wei', false) })))).toBeNull();
  });
});

describe('Jia Xu — Complete Kill', () => {
  const dyingB = (cards: Record<string, ReturnType<typeof card>[]>, o: TableOptions = {}) =>
    kw.run(table(cards, { generals: at('seat-a', 'jia-xu'), hp: { 'seat-b': 1 }, ...o }), [hit('seat-b', 1)]);

  it("in his turn only he and the dying seat can use Peach", () => {
    let s = dyingB({ 'seat-c:hand': [card('p', 'peach', 'heart', 4)] });
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-b' });
    s = kw.pass(s);
    expect(s.seats[1].eliminated).toBe(true);
  });

  it('he may still use a Peach himself', () => {
    const s = dyingB({ 'seat-a:hand': [card('p', 'peach', 'heart', 4)] });
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-a' });
  });

  it('a hidden Jia Xu leaves the dying round alone', () => {
    const s = kw.pass(dyingB({ 'seat-c:hand': [card('p', 'peach', 'heart', 4)] }, { generals: at('seat-a', 'jia-xu', 'filler-jiang-wei', false) }));
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-c' });
  });
});

describe('Jia Xu — Curtain', () => {
  it('black Tools are not offered at him; red ones are', () => {
    const s = table({ 'seat-b:hand': [card('bl', 'duel', 'spade', 5), card('rd', 'duel', 'heart', 5)] }, { owner: 'seat-b', generals: at('seat-a', 'jia-xu') });
    const plays = h.legal(s, 'seat-b').filter((a) => a.kind === 'PlayCardAction' && a.targets[0]?.seatId === 'seat-a').map((a) => (a.kind === 'PlayCardAction' ? a.cardInstanceId : ''));
    expect(plays).toEqual(['rd']);
  });

  it('a black area Tool skips him', () => {
    let s = h.play(table({ 'seat-b:hand': [card('bb', 'barbarians', 'spade', 7)] }, { owner: 'seat-b', generals: at('seat-a', 'jia-xu') }), 'bb');
    const asked: string[] = [];
    while (s.pendingResponse) {
      asked.push(s.pendingResponse.respondingSeatId);
      s = h.pass(s);
    }
    expect(asked).toEqual(['seat-c', 'seat-d']);
    expect(hp(s, 'seat-a')).toBe(4);
  });

  it('a hidden Jia Xu is hit', () => {
    let s = h.play(table({ 'seat-b:hand': [card('bb', 'barbarians', 'spade', 7)] }, { owner: 'seat-b', generals: at('seat-a', 'jia-xu', 'filler-jiang-wei', false) }), 'bb');
    const asked: string[] = [];
    while (s.pendingResponse) {
      asked.push(s.pendingResponse.respondingSeatId);
      s = h.pass(s);
    }
    expect(asked).toEqual(['seat-c', 'seat-d', 'seat-a']);
  });
});

describe('Jia Xu — Upheaval', () => {
  const upheaval = (cards: Record<string, ReturnType<typeof card>[]> = {}, o: TableOptions = {}) => h.useSkill(table(cards, { generals: at('seat-a', 'jia-xu'), ...o }), 'seat-a', 'upheaval');

  it('each other seat in turn picks a seat in its range, or passes', () => {
    const s = upheaval();
    expect(s.pendingChoice).toMatchObject({ seatId: 'seat-b' });
    expect(s.pendingChoice!.options.map((o) => o.id)).toEqual(['seat-c', 'seat-a', 'pass']); // turn order after seat-b
    expect(s.seats[0].marks).toEqual({ 'upheaval-used': 1 });
  });

  it('a seat that plays a Sha at the seat it picked: answered like any Sha, then the next seat is asked', () => {
    let s = upheaval({ 'seat-b:hand': [card('s1', 'sha')] });
    s = h.choose(s, 'seat-c');
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-b', allowedCardIds: ['sha'], reason: { kind: 'ability', abilityId: 'upheaval', targetSeatId: 'seat-c' } });
    s = h.respond(s, 's1');
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-c', allowedCardIds: ['shan'] });
    s = h.pass(s);
    expect(hp(s, 'seat-c')).toBe(3);
    expect(hp(s, 'seat-b')).toBe(4);
    expect(s.pendingChoice).toMatchObject({ seatId: 'seat-c' });
  });

  it('passing, at the pick or at the Sha window, loses 1 HP and moves on', () => {
    const picked = h.choose(upheaval(), 'pass');
    expect(hp(picked, 'seat-b')).toBe(3);
    expect(picked.pendingChoice).toMatchObject({ seatId: 'seat-c' });
    const windowed = h.pass(h.choose(upheaval({ 'seat-b:hand': [card('s1', 'sha')] }), 'seat-c'));
    expect(hp(windowed, 'seat-b')).toBe(3);
    expect(windowed.pendingChoice).toMatchObject({ seatId: 'seat-c' });
  });

  it('a seat that died before its turn is skipped (Review Focus 5)', () => {
    const t = table({}, { generals: at('seat-a', 'jia-xu') });
    const s = h.run({ ...t, seats: t.seats.map((x) => (x.id === 'seat-c' ? { ...x, eliminated: true } : x)) }, [
      { kind: 'SkillStepEffect', owner: { kind: 'general', seatId: 'seat-a', slot: 'main', skillId: 'upheaval' }, step: 'next', data: { left: ['seat-c', 'seat-d'] } },
    ]);
    expect(s.pendingChoice).toMatchObject({ seatId: 'seat-d' });
  });

  it('once per game', () => {
    const t = table({}, { generals: at('seat-a', 'jia-xu') });
    const used = { ...t, seats: t.seats.map((x) => (x.id === 'seat-a' ? { ...x, marks: { 'upheaval-used': 1 } } : x)) };
    expect(offered(t, 'seat-a', 'upheaval')).toBe(true);
    expect(offered(used, 'seat-a', 'upheaval')).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest projects/content/src/lib/generals/forest-qun.spec.ts`
Expected: FAIL (skills missing).

- [ ] **Step 3: Implement**

In `projects/content/src/lib/generals/forest.ts`, insert before `export const FOREST_GENERALS`:

```ts
// Accepts spade hand cards (as the holder's suits count).
const spade = (card: CardInstance, state: GameState, seatId: string, registry: ContentRegistry) => suitOf(state, seatId, card, registry) === 'spade';

// Wine: a spade hand card may be used as Wine, in the Play Phase or to rescue yourself.
export const wine: SkillDefinition = { id: 'wine', conversions: [{ id: 'wine', as: 'wine', cards: 1, accepts: spade, when: 'both' }] };

// Garden of Lust (compulsory): a Sha between you and a female seat needs two
// Shan (read by the Sha's steps).
export const gardenOfLust: SkillDefinition = { id: 'garden-of-lust', compulsory: true, modifiers: { doubleAnswersWithFemale: true } };

// Collapse (compulsory): at the end of your turn, with strictly more HP than
// every other living seat, lose 1 HP or reduce your max HP by 1.
export const collapse: SkillDefinition = {
  id: 'collapse',
  compulsory: true,
  triggers: [
    on<PhaseChangedEvent>('after:PhaseChangedEvent', {
      condition: (state, event, owner) => {
        if (event.phase !== 'End' || event.seatId !== owner.seatId || !isLiving(state, owner.seatId)) return false;
        const others = otherLivingSeatIds(state, owner.seatId);
        return others.length > 0 && others.every((id) => hpOf(state, id) < hpOf(state, owner.seatId));
      },
      effect: (state, _event, owner) => [
        choiceOf(state, owner, {
          verb: 'pick',
          options: [
            { id: 'lose-hp', shows: { kind: 'label', text: 'Lose 1 HP' }, effects: [used(owner, 'collapsed'), { kind: 'LoseHpEffect', seatId: owner.seatId, amount: 1, abilityId: owner.skillId }] },
            { id: 'reduce-max-hp', shows: { kind: 'label', text: 'Reduce Max HP by 1' }, effects: [used(owner, 'collapsed-max'), { kind: 'ReduceMaxHpEffect', seatId: owner.seatId, amount: 1 }] },
          ],
        }),
      ],
    }),
  ],
};

// Complete Kill (compulsory): in your turn only you and the dying seat can use
// Peach. Kingdom War's dying round reads this when it lists who is asked.
export const completeKill: SkillDefinition = { id: 'complete-kill', compulsory: true, modifiers: { peachOnlyOwnerAndDying: true } };

// Curtain (compulsory): black Tools can't target you. The modifier keeps them
// off the seat lists; this trigger cancels any that still name you (an area
// Tool, a conversion). Your own delayed Tools, judged on you, are not "aimed".
export const curtain: SkillDefinition = {
  id: 'curtain',
  compulsory: true,
  modifiers: { untargetableByBlackTools: true },
  triggers: [
    on<ToolOnTarget>('before:ToolOnTargetEffect', {
      condition: (_state, effect, owner) => effect.target.kind === 'seat' && effect.target.seatId === owner.seatId && effect.userSeatId !== owner.seatId && effect.tool.colour === 'black',
      effect: () => [],
    }),
  ],
};

// The seat mark that records Upheaval's one use.
const UPHEAVAL_MARK = 'upheaval-used';

// Other living seats within `seatId`'s attack range that a Sha may target.
const shaReach = (state: GameState, seatId: string, registry: ContentRegistry) =>
  otherLivingSeatIds(state, seatId).filter((id) => seatDistance(state, seatId, id, registry) <= attackRange(state, seatId, registry) && !untargetableBy(state, id, 'sha', registry));

// Upheaval (active, Play Phase, once per game): every other living seat, in turn
// order, picks a seat in its attack range and plays a Sha at it, or loses 1 HP.
export const upheaval: SkillDefinition = {
  id: 'upheaval',
  active: {
    canUse: (state, { seatId }) =>
      isLiving(state, seatId) && !state.seats.find((s) => s.id === seatId)?.marks?.[UPHEAVAL_MARK] && otherLivingSeatIds(state, seatId).length > 0,
    start: (state, { seatId, owner }) => [
      { kind: 'IncrementEffect', scope: 'seat', seatId, key: UPHEAVAL_MARK, by: 1 },
      used(owner, 'used'),
      skillStep(owner, 'next', { left: otherLivingSeatIds(state, seatId) }),
    ],
  },
  onStep: (state, step, registry) => {
    const { owner } = step;
    const left = ((step.data?.['left'] as string[] | undefined) ?? []).filter((id) => isLiving(state, id));
    const loseHp = (seatId: string, rest: string[]): Effect[] => [
      { kind: 'LoseHpEffect', seatId, amount: 1, abilityId: owner.skillId },
      skillStep(owner, 'next', { left: rest }),
    ];
    if (step.step === 'next') {
      const [seatId, ...rest] = left;
      if (!seatId) return [];
      const reach = shaReach(state, seatId, registry);
      if (reach.length === 0) return loseHp(seatId, rest);
      return [
        choiceOf(state, owner, {
          verb: 'pick',
          seatId,
          options: [
            ...seatOptions(reach, (victim) => [skillStep(owner, 'ask', { seatId, victim, left: rest })]),
            { id: 'pass', shows: { kind: 'label', text: 'Pass (Lose 1 HP)' }, effects: loseHp(seatId, rest) },
          ],
        }),
      ];
    }
    const seatId = step.data?.['seatId'] as string;
    if (step.step === 'penalty') return isLiving(state, seatId) ? loseHp(seatId, left) : [skillStep(owner, 'next', { left })];
    if (step.step === 'ask') {
      const victim = step.data?.['victim'] as string;
      if (!isLiving(state, seatId)) return [skillStep(owner, 'next', { left })];
      return [
        {
          kind: 'OpenResponseEffect',
          pendingResponse: {
            id: `upheaval-${seatId}-${state.log.length}`,
            respondingSeatId: seatId,
            allowedActionKinds: ['RespondAction', 'PassAction'],
            allowedCardIds: ['sha'],
            reason: { kind: 'ability', owner, abilityId: owner.skillId, targetSeatId: victim },
            // No Sha: the seat loses 1 HP, then the next seat is asked.
            context: { effect: skillStep(owner, 'penalty', { seatId, left }) },
            sourceSkill: { owner, step: 'sha', data: { victim, left } },
          },
        },
      ];
    }
    // 'sha': the seat answered with a Sha (a real card or a conversion's).
    const answeredBy = step.data?.['answeredBy'] as string;
    const card = step.data?.['answeredCard'] as UsedCard;
    const victim = step.data?.['victim'] as string;
    const sha: Effect[] = isLiving(state, answeredBy) && isLiving(state, victim) ? shaAt(state, card, answeredBy, [{ kind: 'seat', seatId: victim }]) : [];
    return [...sha, skillStep(owner, 'next', { left })];
  },
};

export const FOREST_GENERALS: GeneralSkillSet[] = [
  { id: 'xu-huang', skills: [blockade] },
  { id: 'cao-pi', skills: [unnaturalDeath, exile, exaltation] },
  { id: 'meng-huo', skills: [culprit, resurgence] },
  { id: 'zhu-rong', skills: [giantElephant, intenseEdge] },
  { id: 'sun-jian', skills: [braveSpirit] },
  { id: 'lu-su', skills: [charity, alliance] },
  { id: 'dong-zhuo', skills: [wine, gardenOfLust, collapse, violentTyrant] },
  { id: 'jia-xu', skills: [completeKill, upheaval, curtain] },
];
```

Add `import { colourFor, suitOf } from '../shared/suits';` (replacing the `colourFor`-only import) at the top of the file. Delete the previous six-entry `FOREST_GENERALS` block.

Two checks while implementing:
- The Upheaval window's `skillStep(owner, 'penalty', { seatId, left })` is the `PassAction`'s `context.effect`; the step list in `onStep` handles `'penalty'` above.
- `shaAt` queues the Sha's steps at the victim; `skillStep(…, 'next')` follows them in the same list, so the next seat is asked only after the Sha is fully answered.

- [ ] **Step 4: Run the new spec**

Run: `npx jest projects/content/src/lib/generals/forest-qun.spec.ts`
Expected: PASS.

- [ ] **Step 5: Run the whole content project, then everything**

Run: `npx jest --selectProjects content`
Expected: PASS; switch real `dong-zhuo` / `jia-xu` vanilla uses in older specs to their fillers.
Run: `npx jest`
Expected: PASS (bots and sim now see real Forest skills; the rule-based bot has no Forest rules yet, so Task 7 fixes anything that stalls — if a sim spec fails here only because a bot can't answer a Forest prompt, go straight to Task 7 and re-run).

- [ ] **Step 6: Commit**

```bash
git add projects/content
git commit -m "feat(content): Dong Zhuo's Wine, Garden of Lust and Collapse, Jia Xu's Complete Kill, Upheaval and Curtain" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Bots — the Forest skills

**Files:**
- Create: `projects/bots/src/lib/forest.ts`, `projects/bots/src/lib/forest.spec.ts`
- Modify: `projects/bots/src/lib/skills.ts`, `projects/bots/src/lib/rule-based.ts`

**Interfaces:**
- Produces (`bots/src/lib/forest.ts`):
  - `wantsForest(view, me, choice): boolean | null`;
  - `wantsForestActive(view, me, skillId): boolean | null`;
  - `forestChoice(view, me, choice, registry): string | null`;
  - `forestSelection(view, me, selection, registry): string[] | 'cancel' | null`.
- The rule-based bot, in a window whose reason is `{ kind: 'ability', abilityId: 'upheaval' }`, answers with a Sha when it holds one (the seat was already picked by `forestChoice`), else passes.

- [ ] **Step 1: Write the failing tests**

Create `projects/bots/src/lib/forest.spec.ts`:

```ts
import { getLegalActions } from 'engine';
import type { GameState } from 'engine';
import { act, asking, card, decide, picked, registry, table, useSkill } from './testing';

// The Forest Generals' bot rules (stage 10 spec, "Bots").

const generals = (a: string, extra: Record<string, [string, string]> = {}) => ({ 'seat-a': [a, 'filler-jiang-wei'] as [string, string], ...extra });
const choiceOf = (s: GameState, ids: string[], verb: 'pick' | 'give' = 'pick', abilityId = 'x', ownerSeatId = 'seat-a') => ({
  ...s,
  pendingChoice: {
    id: 'c', seatId: 'seat-a', verb,
    reason: { kind: 'ability' as const, owner: { kind: 'general' as const, seatId: ownerSeatId, slot: 'main' as const, skillId: abilityId }, abilityId },
    options: ids.map((id) => ({ id, shows: id.startsWith('seat') ? { kind: 'seat' as const, seatId: id } : { kind: 'label' as const, text: id }, effects: [] })),
  },
});

describe('asks', () => {
  it('Unnatural Death and Brave Spirit: always; Exile: always', () => {
    for (const skill of ['unnatural-death', 'brave-spirit', 'exile']) {
      expect(picked(decide(asking(table({}, { generals: generals('cao-pi') }), skill)))).toBe('use');
    }
  });

  it('Resurgence: only when missing 2 or more HP', () => {
    const s = (hp: number) => asking(table({}, { generals: generals('meng-huo'), hp: { 'seat-a': hp } }), 'resurgence');
    expect(picked(decide(s(2)))).toBe('use');
    expect(picked(decide(s(3)))).toBe('decline');
  });

  it('Intense Edge: with a card ranked 9 or higher', () => {
    const s = (rank: number) => asking(table({ 'seat-a:hand': [card('c', 'sha', 'heart', rank)] }, { generals: generals('zhu-rong') }), 'intense-edge', 'seat-b');
    expect(picked(decide(s(9)))).toBe('use');
    expect(picked(decide(s(8)))).toBe('decline');
  });

  it('Charity: with 3 or fewer cards', () => {
    const hand = (n: number) => Array.from({ length: n }, (_, i) => card(`h${i}`, 'shan', 'heart', i + 1));
    expect(picked(decide(asking(table({ 'seat-a:hand': hand(3) }, { generals: generals('lu-su') }), 'charity')))).toBe('use');
    expect(picked(decide(asking(table({ 'seat-a:hand': hand(4) }, { generals: generals('lu-su') }), 'charity')))).toBe('decline');
  });
});

describe('choices', () => {
  it('Exile: the non-ally with the fewest hand cards', () => {
    const s = choiceOf(table({ 'seat-b:hand': [card('x', 'sha'), card('y', 'sha')], 'seat-c:hand': [card('z', 'sha')], 'seat-d:hand': [card('w', 'sha'), card('v', 'sha')] }, { generals: generals('cao-pi') }), ['seat-b', 'seat-c', 'seat-d'], 'pick', 'exile');
    expect(picked(decide(s))).toBe('seat-c');
  });

  it('Collapse: loses HP at 3 or more, else reduces max HP', () => {
    const s = (hp: number) => choiceOf(table({}, { generals: generals('dong-zhuo'), hp: { 'seat-a': hp } }), ['lose-hp', 'reduce-max-hp'], 'pick', 'collapse');
    expect(picked(decide(s(3)))).toBe('lose-hp');
    expect(picked(decide(s(2)))).toBe('reduce-max-hp');
  });

  it('Upheaval: the weakest non-ally in range, never an ally, else pass', () => {
    const t = (o: Parameters<typeof table>[1] = {}) => choiceOf(table({}, { generals: generals('filler-xu-huang'), ...o }), ['seat-b', 'seat-d', 'pass'], 'pick', 'upheaval');
    expect(picked(decide(t({ hp: { 'seat-b': 3, 'seat-d': 2 } })))).toBe('seat-d');
    expect(picked(decide(t({ kingdoms: { 'seat-a': 'Wei', 'seat-b': 'Wei', 'seat-d': 'Wei' } })))).toBe('pass');
  });

  it('Charity: gives to an ally among the tied seats', () => {
    const s = choiceOf(table({}, { generals: generals('lu-su'), kingdoms: { 'seat-a': 'Wu', 'seat-b': 'Wei', 'seat-c': 'Wu', 'seat-d': 'Shu' } }), ['seat-b', 'seat-c', 'seat-d'], 'give', 'charity');
    expect(picked(decide(s))).toBe('seat-c');
  });

  it("Brave Spirit's seat: an ally short of cards, else himself; the target's own pick: draw X for X of 2 or less", () => {
    const seats = choiceOf(table({ 'seat-c:hand': [] }, { generals: generals('sun-jian'), kingdoms: { 'seat-a': 'Wu', 'seat-b': 'Wei', 'seat-c': 'Wu', 'seat-d': 'Qun' }, hp: { 'seat-a': 2 } }), ['seat-a', 'seat-b', 'seat-c', 'seat-d'], 'pick', 'brave-spirit');
    expect(picked(decide(seats))).toBe('seat-c');
    // The target's own pick, X = Sun Jian's missing HP (seat-b: 4 max, 2 HP, so X = 2).
    const forced = (hp: number, hand: ReturnType<typeof card>[] = []) =>
      choiceOf(table({ 'seat-a:hand': hand }, { generals: { 'seat-b': ['sun-jian', 'filler-jiang-wei'] }, hp: { 'seat-b': hp } }), ['draw-x', 'draw-1'], 'pick', 'brave-spirit', 'seat-b');
    expect(picked(decide(forced(2)))).toBe('draw-x');
    // X = 3 with 4 spare cards: draw 1, discard 3.
    const spare = Array.from({ length: 4 }, (_, i) => card(`p${i}`, 'sha', 'club', i + 1));
    expect(picked(decide(forced(1, spare)))).toBe('draw-1');
    expect(picked(decide(forced(1)))).toBe('draw-x'); // nothing spare to discard
  });
});

describe('active skills', () => {
  it('Alliance: swaps a non-ally’s larger hand into a short ally at a cost it can pay', () => {
    const cards = (p: string, n: number) => Array.from({ length: n }, (_, i) => card(`${p}${i}`, 'shan', 'heart', i + 1));
    const t = (aHand: number) =>
      table({ 'seat-a:hand': cards('a', aHand), 'seat-b:hand': cards('b', 4), 'seat-c:hand': cards('c', 2) }, { generals: generals('lu-su'), kingdoms: { 'seat-a': 'Wu', 'seat-b': 'Wei', 'seat-c': 'Wu', 'seat-d': 'Qun' } });
    const offered = (s: GameState) => getLegalActions(s, 'seat-a', registry).some((a) => a.kind === 'UseSkillAction');
    expect(offered(t(3))).toBe(true);
    const s = decide(t(3));
    expect(s.kind).toBe('UseSkillAction');
  });

  it('Upheaval: only with 3 or more non-allies', () => {
    const t = (kingdoms: Record<string, 'Wei' | 'Shu' | 'Wu' | 'Qun'>) => table({}, { generals: generals('jia-xu'), kingdoms });
    expect(decide(t({ 'seat-a': 'Qun' })).kind).toBe('UseSkillAction');
    expect(decide(t({ 'seat-a': 'Wei', 'seat-b': 'Wei', 'seat-c': 'Wei' })).kind).not.toBe('UseSkillAction');
  });
});

describe('the Upheaval window', () => {
  it('answers with a Sha when it holds one, at a non-ally; else passes', () => {
    // Built directly: seat-b is asked to Sha seat-c.
    const open = (hasSha: boolean, ally: boolean) => {
      const t = table({ 'seat-b:hand': hasSha ? [card('s1', 'sha')] : [] }, { kingdoms: { 'seat-a': 'Qun', 'seat-b': 'Wei', 'seat-c': ally ? 'Wei' : 'Shu', 'seat-d': 'Wu' } });
      return {
        ...t,
        pendingResponse: {
          id: 'w', respondingSeatId: 'seat-b', allowedActionKinds: ['RespondAction', 'PassAction'], allowedCardIds: ['sha'],
          reason: { kind: 'ability' as const, owner: { kind: 'general' as const, seatId: 'seat-a', slot: 'main' as const, skillId: 'upheaval' }, abilityId: 'upheaval', targetSeatId: 'seat-c' },
          context: { effect: { kind: 'LoseHpEffect' as const, seatId: 'seat-b', amount: 1 } },
        },
      };
    };
    expect(decide(open(true, false)).kind).toBe('RespondAction');
    expect(decide(open(false, false)).kind).toBe('PassAction');
    expect(decide(open(true, true)).kind).toBe('PassAction'); // never a Sha at an ally
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest projects/bots/src/lib/forest.spec.ts`
Expected: FAIL (no Forest bot rules; unknown asks default to decline and unknown choices to the first option).

- [ ] **Step 3: Implement**

Create `projects/bots/src/lib/forest.ts`:

```ts
import type { ContentRegistry, GameState, PendingChoice, PendingSelection, Seat } from 'engine';
import { livingSeatOrderFrom } from 'engine';
import { handCards, isAlly, keepRank } from './helpers';

// The stage 10 spec's bot rules for the Forest skills.

const others = (view: GameState, me: Seat) => view.seats.filter((s) => !s.eliminated && s.id !== me.id);
const handSize = (view: GameState, seat: Seat) => view.zones.find((z) => z.id === seat.hand.zoneId)?.cards.length ?? 0;
const cardCount = (view: GameState, seat: Seat) => handSize(view, seat) + (view.zones.find((z) => z.id === seat.equipped.zoneId)?.cards.length ?? 0);
const byWeakest = (seats: Seat[]) => [...seats].sort((a, b) => a.combinedHp - b.combinedHp || a.index - b.index);
const seatsOf = (view: GameState, choice: PendingChoice) =>
  choice.options.flatMap((o) => (o.shows.kind === 'seat' ? [view.seats.find((s) => s.id === (o.shows as { seatId: string }).seatId)!] : []));

// Alliance: a pair worth swapping is a short ally and a larger non-ally hand, at a cost the bot can pay with 2 or fewer cards.
const alliancePairs = (view: GameState, me: Seat) =>
  others(view, me).flatMap((ally) =>
    others(view, me)
      .filter((foe) => foe.id !== ally.id && isAlly(me, ally) && !isAlly(me, foe))
      .map((foe) => ({ ally, foe, cost: handSize(view, foe) - handSize(view, ally) }))
      .filter((p) => p.cost > 0 && p.cost <= 2 && p.cost <= cardCount(view, me))
  );

export function wantsForest(view: GameState, me: Seat, choice: PendingChoice): boolean | null {
  if (choice.reason.kind !== 'ability') return null;
  switch (choice.reason.abilityId) {
    case 'unnatural-death':
    case 'brave-spirit':
    case 'exile':
      return true;
    case 'resurgence':
      return me.maxCombinedHp - me.combinedHp >= 2;
    case 'intense-edge':
      return handCards(view, me).some((c) => c.rank >= 9);
    case 'charity':
      return handSize(view, me) <= 3;
    default:
      return null;
  }
}

export function wantsForestActive(view: GameState, me: Seat, skillId: string): boolean | null {
  switch (skillId) {
    case 'alliance':
      return alliancePairs(view, me).length > 0;
    case 'upheaval':
      return others(view, me).filter((s) => !isAlly(me, s)).length >= 3;
    default:
      return null;
  }
}

export function forestChoice(view: GameState, me: Seat, choice: PendingChoice, registry: ContentRegistry): string | null {
  if (choice.reason.kind !== 'ability') return null;
  const seats = seatsOf(view, choice);
  const nonAllies = seats.filter((s) => s.id !== me.id && !isAlly(me, s));
  switch (choice.reason.abilityId) {
    case 'exile': {
      // A non-ally with the fewest hand cards; else a face-down ally; else the first.
      const foe = [...nonAllies].sort((a, b) => handSize(view, a) - handSize(view, b) || a.index - b.index)[0];
      const down = seats.find((s) => s.id !== me.id && isAlly(me, s) && s.faceDown);
      return (foe ?? down ?? seats[0])?.id ?? null;
    }
    case 'collapse':
      return me.combinedHp >= 3 ? 'lose-hp' : 'reduce-max-hp';
    case 'upheaval': {
      const foe = byWeakest(seats.filter((s) => s.id !== me.id && !isAlly(me, s)))[0];
      return foe?.id ?? 'pass';
    }
    case 'charity': {
      const ally = seats.find((s) => s.id !== me.id && isAlly(me, s));
      return (ally ?? seats[0])?.id ?? null;
    }
    case 'brave-spirit': {
      // The skill's user picks an ally short of cards, else himself.
      if (seats.length > 0) {
        const ally = [...seats].filter((s) => s.id !== me.id && isAlly(me, s)).sort((a, b) => handSize(view, a) - handSize(view, b) || a.index - b.index)[0];
        return (ally ?? seats.find((s) => s.id === me.id) ?? seats[0]).id;
      }
      // The target's pick: draw X and discard 1 for X of 2 or less, else draw 1 and discard X only with spare cards.
      const owner = view.seats.find((s) => s.id === (choice.reason as { owner: { seatId: string } }).owner.seatId);
      const x = owner ? owner.maxCombinedHp - owner.combinedHp : 1;
      const spare = handCards(view, me).filter((c) => keepRank(view, registry, c.instanceId) < 3).length;
      return x <= 2 || spare < x ? 'draw-x' : 'draw-1';
    }
    case 'alliance': {
      // The partner: the non-ally with the largest hand among those offered.
      const foe = [...nonAllies].sort((a, b) => handSize(view, b) - handSize(view, a) || a.index - b.index)[0];
      return (foe ?? seats[0])?.id ?? null;
    }
    default:
      return null;
  }
}

export function forestSelection(view: GameState, me: Seat, selection: PendingSelection, _registry: ContentRegistry): string[] | 'cancel' | null {
  if (selection.reason.kind !== 'ability') return null;
  if (selection.reason.abilityId === 'alliance' && selection.of === 'seats') {
    // The first seat: an ally that has a larger-handed non-ally to swap with.
    const ally = alliancePairs(view, me).map((p) => p.ally.id).find((id) => selection.eligibleIds.includes(id));
    return ally ? [ally] : 'cancel';
  }
  return null;
}

// Whether the Upheaval window's seat (the bot) is being asked to Sha a non-ally.
export const upheavalVictimIsFoe = (view: GameState, me: Seat, victimSeatId: string | undefined): boolean => {
  const victim = view.seats.find((s) => s.id === victimSeatId);
  return !!victim && !isAlly(me, victim) && livingSeatOrderFrom(view, me.id).includes(victim.id);
};
```

In `projects/bots/src/lib/skills.ts`:

1. `import { forestChoice, forestSelection, wantsForest, wantsForestActive } from './forest';`
2. In `wantsSkill`'s `default`: `return wantsWind(view, me, choice, registry) ?? wantsFire(view, me, choice) ?? wantsForest(view, me, choice);`
3. In `skillSelection`'s `default`: `return windSelection(view, me, selection, registry) ?? forestSelection(view, me, selection, registry);`
4. In `skillChoice`'s `default`: `return windChoice(view, me, choice) ?? fireChoice(view, me, choice, registry) ?? forestChoice(view, me, choice, registry);`
5. In `wantsActive`'s `default`: `return wantsFireActive(view, me, skillId, registry) ?? wantsForestActive(view, me, skillId) ?? false;`
6. `ACTIVE_ORDER`: add `'alliance'` to `early` (after `'rouse-the-tiger'`) and `'upheaval'` to `late` (after `'assault'`).
7. `CONVERSION_SKILLS`: add `'blockade'` and `'wine'`.

In `projects/bots/src/lib/rule-based.ts`:

1. `import { upheavalVictimIsFoe } from './forest';`
2. Chain the selection hook: `const skillPick = fireSelection(view, me, selection, registry) ?? skillSelection(view, me, selection, registry);` already reaches `forestSelection` through `skillSelection`; no change.
3. In the response branch, extend `worthAnswering`:

```ts
    const worthAnswering =
      !reason || reason.kind === 'card-effect'
        ? true
        : reason.kind === 'dying'
          ? !!self && !!dying && (dying.id === seatId || isAlly(self, dying))
          : reason.kind === 'wuxie'
            ? reason.target.kind === 'seat' && reason.target.seatId === seatId && HARMFUL_TOOLS.has(reason.tool.as)
            : reason.kind === 'ability' && reason.abilityId === 'upheaval'
              ? !!self && upheavalVictimIsFoe(view, self, reason.targetSeatId)
              : false; // never counter a Wuxie Kongjie
```

4. Conversions into Starvation (Blockade): after the Capture conversion line, add

```ts
    const [starvationVia] = conversionsAs('starvation').sort((x, y) => handCountOf(targetSeat(y)) - handCountOf(targetSeat(x)));
    if (starvationVia) return take(starvationVia);
```

with, next to `conversionsAs`, `const handCountOf = (seat: Seat) => view.zones.find((z) => z.id === seat.hand.zoneId)?.cards.length ?? 0;`.

5. Wine through Dong Zhuo's conversion: just before the `const shaPlays` line's `wine` check, add:

```ts
    const wineVia = legal.find((a): a is UseConversion => a.kind === 'UseConversionAction' && !a.pendingResponseId && a.targets.length === 0 && conversionAs(a, view, registry) === 'wine' && conversionSpare(view, self, a, registry));
    if (wineVia && shaPlays.length > 0 && !wine) return take(wineVia);
```

placed after `const wine = untargetedOf('wine');` so it only runs when the bot holds no real Wine.

- [ ] **Step 4: Run the new spec**

Run: `npx jest projects/bots/src/lib/forest.spec.ts`
Expected: PASS.

- [ ] **Step 5: Run the whole bots project and the sim**

Run: `npx jest --selectProjects bots sim`
Expected: PASS. If a seeded game stalls on a Forest prompt the bot doesn't know (a pending selection or choice that falls to "cancel" with no cancel offered), add the missing case to `forest.ts` rather than loosening the sim.

- [ ] **Step 6: Commit**

```bash
git add projects/bots
git commit -m "feat(bots): rule-based play for the Forest skills" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Sim — Forest batch and forced pairings

**Files:**
- Create: `projects/sim/src/forest.spec.ts`

- [ ] **Step 1: Write the spec**

Create `projects/sim/src/forest.spec.ts`:

```ts
import { createGame } from 'engine';
import type { GameState } from 'engine';
import { BASE_GENERAL_IDS, FIRE_GENERAL_IDS, FOREST_GENERAL_IDS, WIND_GENERAL_IDS, buildContentRegistry, kingdomWarMode } from 'content';
import { runGame } from './runGame';
import { checkInvariants, checkRestingState } from './invariants';
import { firedSkills, partnerOf, registryWith, withForcedPairing } from './forcedPairing';

const POOL = [...BASE_GENERAL_IDS, ...WIND_GENERAL_IDS, ...FIRE_GENERAL_IDS, ...FOREST_GENERAL_IDS];
const registry = registryWith(buildContentRegistry(), POOL);
const ctx = { registry, mode: kingdomWarMode };
// Skills with no trace of their own in the log: modifiers read by queries.
const MODIFIERS_ONLY = new Set(['garden-of-lust', 'complete-kill', 'curtain']);

function checked(state: GameState, label: string, failures: string[]) {
  const violations = checkInvariants(state, registry);
  if (violations.length > 0) failures.push(`${label}: ${violations.join('; ')}`);
  if (!state.result) failures.push(`${label}: did not terminate`);
  if (JSON.stringify(JSON.parse(JSON.stringify(state))) !== JSON.stringify(state)) failures.push(`${label}: not serialisable`);
}

describe('simulated games with the base, Wind, Fire and Forest Generals (49)', () => {
  it('2, 5 and 8 seats, random and rule-based bots: they finish, with no invariant broken', () => {
    const failures: string[] = [];
    let seed = 4000;
    for (const seats of [2, 5, 8]) {
      for (let i = 0; i < 10; i++) {
        seed++;
        const initial = createGame(kingdomWarMode, registry, Array.from({ length: seats }, (_, n) => `seat-${n}`), seed);
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

  it('each Forest General, dealt to seat-0 with a same-kingdom partner, fires every skill that leaves a trace', () => {
    const missing: string[] = [];
    const failures: string[] = [];
    for (const generalId of FOREST_GENERAL_IDS) {
      const expected = (registry.generals.get(generalId)?.skills ?? []).filter((s) => !s.lord).map((s) => s.id).filter((id) => !MODIFIERS_ONLY.has(id));
      const fired = new Set<string>();
      for (let seed = 1; seed <= 80 && expected.some((id) => !fired.has(id)); seed++) {
        const initial = withForcedPairing(createGame(kingdomWarMode, registry, ['seat-0', 'seat-1', 'seat-2', 'seat-3', 'seat-4'], seed), 'seat-0', [generalId, partnerOf(generalId, registry, POOL)]);
        const { finalState } = runGame(initial, ctx, seed * 13 + 5, 20000, 'rule-based');
        checked(finalState, `${generalId} seed ${seed}`, failures);
        firedSkills(finalState, 'seat-0').forEach((id) => fired.add(id));
      }
      const unfired = expected.filter((id) => !fired.has(id));
      if (unfired.length > 0) missing.push(`${generalId}: ${unfired.join(', ')}`);
    }
    expect(failures).toEqual([]);
    expect(missing).toEqual([]);
  }, 900000);
});
```

- [ ] **Step 2: Run it**

Run: `npx jest projects/sim/src/forest.spec.ts`
Expected: PASS. A real failure means a bug: read the label (seed, bot), reproduce with `runGame`, and fix the skill or the bot. For a skill listed in `missing`, first raise the seed count only if the skill is genuinely rare (Upheaval needs 3 non-allies; Giant Elephant and Culprit need a Barbarians; Intense Edge needs a competing win); if it still never fires, a bot rule is too strict, so loosen the rule in `bots/src/lib/forest.ts`, not the sim.

- [ ] **Step 3: Run the older sim specs**

Run: `npx jest --selectProjects sim`
Expected: PASS (the base, Wind and Fire batches are unchanged).

- [ ] **Step 4: Commit**

```bash
git add projects/sim
git commit -m "test(sim): the Forest batch and forced pairings" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 9: App — the Upheaval window, the new prompts and history lines

**Files:**
- Modify: `projects/content/src/lib/display.ts`, `projects/app/src/app/game-board/response-description.ts`, `projects/app/src/app/game-board/choice-description.ts`, `projects/app/src/app/game-board/action-history.ts`
- Test: `projects/app/src/app/game-board/response-description.spec.ts`, `choice-description.spec.ts`, `action-history.spec.ts`

- [ ] **Step 1: Write the failing tests**

Append to `response-description.spec.ts` (inside the file's top-level, after the existing `describe`s):

```ts
describe('the Upheaval window', () => {
  const window: PendingResponse = {
    id: 'u', respondingSeatId: 'seat-1', allowedActionKinds: ['RespondAction', 'PassAction'], allowedCardIds: ['sha'],
    reason: { kind: 'ability', owner: { kind: 'general', seatId: 'seat-0', slot: 'main', skillId: 'upheaval' }, abilityId: 'upheaval', targetSeatId: 'seat-2' },
    context: { effect: { kind: 'SkillStepEffect', owner: { kind: 'general', seatId: 'seat-0', slot: 'main', skillId: 'upheaval' }, step: 'penalty', data: {} } },
  };

  it('asks for a Sha at the seat picked, or 1 HP', () => {
    expect(describeResponse(state([], window), 'seat-1')).toMatchObject({
      source: 'Hing used Upheaval',
      prompt: 'Play a Sha at Seat 2, or lose 1 HP?',
      outcome: 'You lose 1 HP',
    });
  });

  it('says who is waited on', () => {
    expect(waitingLine(state([], window))).toBe('Waiting on Seat 1 to play a Sha for Upheaval');
  });
});
```

Append to `choice-description.spec.ts` inside `describe('describeChoice', …)`:

```ts
  it('Upheaval: a seat to Sha, or pass', () => {
    const options: ChoiceOption[] = [
      { id: 'seat-1', shows: { kind: 'seat', seatId: 'seat-1' }, effects: [] },
      { id: 'pass', shows: { kind: 'label', text: 'Pass (Lose 1 HP)' }, effects: [] },
    ];
    expect(describeChoice(state(skill('upheaval', 'pick', undefined, options)), 'seat-0')).toEqual({ title: 'Upheaval', prompt: 'Choose a seat to play a Sha at, or pass', confirmLabel: 'Choose' });
  });

  it('Collapse and Brave Spirit: their own words', () => {
    const labels: ChoiceOption[] = [{ id: 'a', shows: { kind: 'label', text: 'A' }, effects: [] }, { id: 'b', shows: { kind: 'label', text: 'B' }, effects: [] }];
    expect(describeChoice(state(skill('collapse', 'pick', undefined, labels)), 'seat-0')).toEqual({ title: 'Collapse', prompt: 'Choose how Collapse costs you', confirmLabel: 'Choose' });
    expect(describeChoice(state(skill('brave-spirit', 'pick', 'seat-1', labels)), 'seat-0')).toEqual({ title: 'Brave Spirit', prompt: 'Choose how to draw and discard', confirmLabel: 'Choose' });
  });

  it('Exile, Brave Spirit and Alliance seat picks name what the seat does', () => {
    const seats: ChoiceOption[] = [{ id: 'seat-1', shows: { kind: 'seat', seatId: 'seat-1' }, effects: [] }];
    expect(describeChoice(state(skill('exile', 'pick', undefined, seats)), 'seat-0')!.prompt).toBe('Choose a seat to turn over');
    expect(describeChoice(state(skill('brave-spirit', 'pick', undefined, seats)), 'seat-0')!.prompt).toBe('Choose a seat to draw and discard cards');
    expect(describeChoice(state(skill('alliance', 'pick', 'seat-1', seats)), 'seat-0')!.prompt).toBe('Choose a seat to swap hands with Seat 1');
  });
```

Append to `action-history.spec.ts`, inside the `describe` that holds the Fire skills' line test (after `'Nirvana, Assault, …'`):

```ts
    it('the Forest skills', () => {
      const line = (skillId: string, outcome: string, targetSeatId?: string) =>
        texts([{ kind: 'AbilityUsedEvent', owner: general('seat-0', skillId), abilityId: skillId, outcome, ...(targetSeatId ? { targetSeatId } : {}) }]);
      expect(line('unnatural-death', 'took-cards', 'seat-1')).toEqual(["Seat 0 took all of Seat 1's cards (Unnatural Death)"]);
      expect(line('exile', 'exiled', 'seat-1')).toEqual(["Seat 0's Exile: Seat 1 turns over and draws cards"]);
      expect(line('resurgence', 'revealed')).toEqual(['Seat 0 used Resurgence']);
      expect(line('culprit', 'culprit', 'seat-1')).toEqual(["Seat 0's Culprit: the damage to Seat 1 counts as theirs"]);
      expect(line('giant-elephant', 'took-card')).toEqual(["Seat 0's Giant Elephant: took the Tool card"]);
      expect(line('brave-spirit', 'drew', 'seat-1')).toEqual(["Seat 0's Brave Spirit: Seat 1 draws and discards"]);
      expect(line('charity', 'gave', 'seat-1')).toEqual(['Seat 0 gave half of their hand to Seat 1 (Charity)']);
      expect(line('collapse', 'collapsed')).toEqual(['Seat 0 lost 1 HP to Collapse']);
      expect(line('collapse', 'collapsed-max')).toEqual(["Seat 0 reduced their max HP with Collapse"]);
      expect(line('upheaval', 'used')).toEqual(['Seat 0 used Upheaval: every other seat plays a Sha or loses 1 HP']);
      expect(texts([
        { kind: 'AbilityUsedEvent', owner: general('seat-0', 'alliance'), abilityId: 'alliance', outcome: 'swap-first', targetSeatId: 'seat-1' },
        { kind: 'AbilityUsedEvent', owner: general('seat-0', 'alliance'), abilityId: 'alliance', outcome: 'swapped', targetSeatId: 'seat-2' },
      ])).toEqual(['Seat 1 and Seat 2 swapped hands (Alliance)']);
    });

    it('max HP reduced', () => {
      expect(texts([{ kind: 'MaxHpReducedEvent', seatId: 'seat-0', amount: 1, maxHp: 3 }])).toEqual(['Seat 0 now has a max HP of 3']);
    });
```

(The `general(...)` helper and `texts` already exist in that file from the Fire tests; the `Seat 1`/`Seat 2` names come from the file's player list — if the spec's zones list only `seat-0` and `seat-1`, add `'seat-2'` to its seat list the same way `'seat-1'` is declared.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest projects/app/src/app/game-board/response-description.spec.ts projects/app/src/app/game-board/choice-description.spec.ts projects/app/src/app/game-board/action-history.spec.ts`
Expected: FAIL (no Upheaval window text, prompts or lines).

- [ ] **Step 3: Implement**

In `projects/content/src/lib/display.ts`:

1. Add hints to `ABILITY_HINTS`:

```ts
  'unnatural-death': "Take all of {target}'s cards into your hand",
  exile: 'A seat of your choice turns over and draws cards',
  resurgence: 'Instead of drawing, reveal cards: each heart recovers 1 HP, the rest go to your hand',
  'intense-edge': 'Compete with {target}; if you win, take one of its cards',
  'brave-spirit': 'A seat of your choice draws and discards cards',
  charity: 'Draw 2 more cards; with more than 5, give half to the seat with the fewest',
```

2. Add selection text to `SELECTION_TEXT`:

```ts
  alliance: { prompt: 'Choose a seat to swap hands', confirm: 'Choose' },
  'brave-spirit': { prompt: 'Choose cards to discard', confirm: 'Discard' },
  charity: { prompt: 'Choose half of your hand to give away', confirm: 'Give' },
```

(`alliance` is used for its first seat pick and then for its card payment, so the card payment gets its own text through `STEP_SELECTION_TEXT` below.)

3. Add to `SEAT_PICK_TEXT`:

```ts
  exile: 'Choose a seat to turn over',
  'brave-spirit': 'Choose a seat to draw and discard cards',
  alliance: 'Choose a seat to swap hands with {target}',
```

4. Add after `seatPickText`:

```ts
// What a skill's pick says when it mixes seats and labels, or is all labels.
const CHOICE_PROMPT_TEXT: Record<string, string> = {
  upheaval: 'Choose a seat to play a Sha at, or pass',
  collapse: 'Choose how Collapse costs you',
  'brave-spirit': 'Choose how to draw and discard',
};

export function choicePromptText(abilityId: string): string | null {
  return CHOICE_PROMPT_TEXT[abilityId] ?? null;
}
```

5. Add to `STEP_SELECTION_TEXT`:

```ts
  pay: { prompt: 'Choose cards to discard for Alliance', confirm: 'Discard' },
```

In `projects/app/src/app/game-board/choice-description.ts`, import `choicePromptText` from `content`, and in the `'pick' | 'give'` branch, before `const kinds = …`, add:

```ts
    const fixed = choicePromptText(choice.reason.abilityId);
    // A seat pick keeps the seat wording (Exile, Alliance); a mixed or label pick uses its own prompt.
    const onlySeats = choice.options.every((o) => o.shows.kind === 'seat');
    if (fixed && !(onlySeats && seatPickText(choice.reason.abilityId))) return { title, prompt: fixed, confirmLabel: 'Choose' };
```

(Exile, Alliance and Brave Spirit's seat pick are all-seat options with `seatPickText`, so they keep the seat wording; Upheaval mixes seats and a Pass label, and Collapse and Brave Spirit's own pick are all labels, so they use the fixed prompt.)

Also in that function, let a seat-pick text work without a named target (Exile, Brave Spirit): replace

```ts
    const seatPrompt = own && target ? own.replace('{target}', seatName(state.players, target)) : 'Choose a seat';
```

with

```ts
    const seatPrompt = own ? own.replace('{target}', target ? seatName(state.players, target) : 'a seat') : 'Choose a seat';
```

In `projects/app/src/app/game-board/response-description.ts`:

1. In `describeResponse`, before `const causeId = causeInstanceId(state);`, add:

```ts
  // Upheaval: play a Sha at the seat this seat picked, or lose 1 HP.
  if (pending.reason?.kind === 'ability' && pending.reason.abilityId === 'upheaval') {
    const { owner, targetSeatId } = pending.reason;
    const you = pending.respondingSeatId === viewerSeatId;
    return {
      source: `${name(owner.seatId)} used ${abilityName('upheaval')}`,
      latest: null,
      prompt: `Play a Sha at ${targetSeatId ? (targetSeatId === viewerSeatId ? 'you' : name(targetSeatId)) : 'the seat you picked'}, or lose 1 HP?`,
      outcome: you ? 'You lose 1 HP' : `${name(pending.respondingSeatId)} loses 1 HP`,
      outcomeForce: forceOf(state.seats.find((s) => s.id === pending.respondingSeatId)?.kingdom),
    };
  }
```

(import `abilityName` from `content` if it is not already imported in this file).

2. In `waitingLine`, before `return who;`:

```ts
  if (reason?.kind === 'ability' && reason.abilityId === 'upheaval') return `${who} to play a Sha for ${abilityName('upheaval')}`;
```

In `projects/app/src/app/game-board/action-history.ts`:

1. Declare `let swapFirst: string | null = null;` next to the other per-pass variables (`lastPicked`, `lastShown`).
2. In the `AbilityUsedEvent` branch, before the final `}` of the else-if chain, add:

```ts
        } else if (event.outcome === 'took-cards' && event.targetSeatId) {
          action(`${owner} took all of ${name(event.targetSeatId)}'s cards (${ability})`);
        } else if (event.outcome === 'exiled' && event.targetSeatId) {
          action(`${owner}'s ${ability}: ${name(event.targetSeatId)} turns over and draws cards`);
        } else if (event.outcome === 'revealed') {
          action(`${owner} used ${ability}`);
        } else if (event.outcome === 'culprit' && event.targetSeatId) {
          action(`${owner}'s ${ability}: the damage to ${name(event.targetSeatId)} counts as theirs`);
        } else if (event.outcome === 'took-card') {
          action(`${owner}'s ${ability}: took the Tool card`);
        } else if (event.outcome === 'drew' && event.targetSeatId) {
          action(`${owner}'s ${ability}: ${name(event.targetSeatId)} draws and discards`);
        } else if (event.outcome === 'gave' && event.targetSeatId) {
          action(`${owner} gave half of their hand to ${name(event.targetSeatId)} (${ability})`);
        } else if (event.outcome === 'collapsed') {
          action(`${owner} lost 1 HP to ${ability}`);
        } else if (event.outcome === 'collapsed-max') {
          action(`${owner} reduced their max HP with ${ability}`);
        } else if (event.outcome === 'swap-first' && event.targetSeatId) {
          swapFirst = event.targetSeatId;
        } else if (event.outcome === 'swapped' && event.targetSeatId) {
          action(`${swapFirst ? name(swapFirst) : 'A seat'} and ${name(event.targetSeatId)} swapped hands (${ability})`);
          swapFirst = null;
```

3. The generic `outcome === 'used'` branch already prints "Seat 0 used Upheaval"; extend it so Upheaval says what it does. Replace

```ts
        if (event.outcome === 'used') {
          action(`${owner} used ${ability}`);
```

with

```ts
        if (event.outcome === 'used') {
          action(event.abilityId === 'upheaval' ? `${owner} used ${ability}: every other seat plays a Sha or loses 1 HP` : `${owner} used ${ability}`);
```

4. Add a case to the event switch:

```ts
      case 'MaxHpReducedEvent':
        status(event.seatId, `${name(event.seatId)} now has a max HP of ${event.maxHp}`);
        break;
```

- [ ] **Step 4: Run the three specs**

Run: `npx jest projects/app/src/app/game-board/response-description.spec.ts projects/app/src/app/game-board/choice-description.spec.ts projects/app/src/app/game-board/action-history.spec.ts`
Expected: PASS. If the history spec's players list lacks `seat-2`, add it to the file's player and zone fixtures as the existing `seat-1` entries are declared.

- [ ] **Step 5: Run the whole app project**

Run: `npx jest --selectProjects app`
Expected: PASS. (A spec asserting the exact set of ability hints or selection texts may need the new keys added.)

- [ ] **Step 6: Commit**

```bash
git add projects/content projects/app
git commit -m "feat(app): the Upheaval window, Forest prompts and history lines" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Docs and the final check

**Files:**
- Modify: `docs/superpowers/specs/2026-10-09-stage-10-forest-generals-design.md`, `docs/superpowers/specs/2026-10-05-all-cards-and-skills-roadmap-design.md`, `docs/architecture/event-chain.md`

- [ ] **Step 1: Append the rulings to the Stage 10 spec**

Append a `## Rulings made while building` section to the spec, with one bullet per departure listed at the top of this plan (Upheaval's window, Unnatural Death's trigger point, Giant Elephant's marker, Complete Kill's order, Curtain's backstop, Blockade's revealed-only range bonus, Resurgence's printed suit), plus any decision made during the build. Change the spec's `Status:` line to `Built`.

- [ ] **Step 2: Mark the stage in the roadmap**

In the roadmap spec's stage table, change row 10 to `| 10 | The Forest Generals' skills (done 2026-10-09) | [Stage 10 spec](2026-10-09-stage-10-forest-generals-design.md) |`.

- [ ] **Step 3: Document the new engine pieces**

In `docs/architecture/event-chain.md`, add short entries (match the file's existing headings) for:
- `ToolResolvedEffect`: queued behind a played, non-delayed Tool; trigger point `before:ToolResolvedEffect`;
- `PendingResponse.sourceSkill`: a skill's own window and the step it queues;
- `DiscardZoneEffect.acted` and the elimination discard as the place to act on a dead seat's cards;
- `ReduceMaxHpEffect` and `MaxHpReducedEvent`.

- [ ] **Step 4: Run everything**

Run: `npx jest`
Expected: PASS, every project (engine, content, bots, sim, app).
Run: `npm run build`
Expected: PASS (engine and content build as packages).

- [ ] **Step 5: Commit**

```bash
git add docs
git commit -m "docs: stage 10 rulings, roadmap status and event chain" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 6: Hand over**

Report the final test count, anything deferred, and the stage's deferred minors, for the memory note. The branch is then merged locally to `main` per the project workflow (superpowers:finishing-a-development-branch).
