# Stage 11: The Mountain Generals — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
- Give the 8 Mountain Generals their real skills: Zhang He, Deng Ai, Liu Shan, Jiang Wei, Sun Ce, Zhang Zhao and Zhang Hong, Cai Wenji and Zuo Ci.
- Add the generic engine pieces those skills need (gained skills, silenced seats, spare Generals, a second pile, extra turns, a death-time skill hook).

**Architecture:**
- **Engine (generic, names no card, skill or General):**
  - `Seat.gainedSkills`, `Seat.silenced`, `Seat.forms` (spare Generals), `Seat.stash` (a second face-up pile), `GameState.spareGenerals`, `PendingChoice.secret`, `Turn.resumeAfterSeatId`;
  - effects `GainSkillEffect`, `SilenceSeatEffect`, `DealSpareGeneralsEffect` (logs nothing: the log is public), `ChooseFormSkillEffect`, `GrantExtraTurnEffect`, with their events;
  - `SkillDefinition` flags `awakening`, `limited`, `afterDeath`, `spareGenerals`; `AbilityModifiers.distanceToOthersFrom`; `Conversion.from: 'stash'`;
  - `skillsInPlay` reads gained skills, the chosen Form's skill and silencing; the killer travels with the dying round to `SeatEliminatedEvent`.
- **Content:** `generals/mountain.ts`; `shared/awaken.ts`, `shared/farm.ts`, `shared/forms.ts`; Kingdom War deals the spare pool, deals Forms when Generals are chosen, adds the stash zone, and names the killer.
- **Around it:** bots play the Mountain skills, the sim runs all 57 Generals plus forced pairings, the app gains Farm and Form displays, a silenced marker, the Instigate window and new prompts and history lines.

**Tech Stack:** TypeScript, Jest (ts-jest), Angular 22 (app task).

**Spec:** `docs/superpowers/specs/2026-10-09-stage-11-mountain-generals-design.md` (binding; the user approved it on 2026-10-09, with all nine rulings). Stages 7–10 common rules still hold.

**Where this plan departs from the spec, and why:**
- **`Seat.forms` is `{ slot, held, chosen? }`**, not a list of `{ generalId, chosen }`. `slot` records which card (Main or Deputy) holds Zuo Ci, so the borrowed skill has an owner; `chosen` is `{ generalId, skillId }` because a Form may offer several skills. Same behaviour as the spec.
- **The Farm pile is `Seat.stash`**, a second pile beside `pile` (Refusing Death's). Deng Ai and Zhou Tai may share a seat, so the two cannot share one zone. Spec engine item 8 allowed "a sibling field".
- **Clever Change's phases are wired to the engine's existing skip machinery:** Judgment is asked as the turn starts (the Judgment Phase judges on entry, as Godspeed does), Draw is a `before:DrawPhaseEffect` replacement (`atDrawPhase`), Play is asked as it begins and ended with `endFlagOf`, Discard is asked as it begins and skipped with `skipFlagOf`. No new `before:PhaseStartEffect` is added; the spec item 5 allowed re-using what exists. To avoid pointless asks, each phase is offered only when skipping can matter: Judgment with a card in the Judgment slot, Draw always (with a seat to take from), Play with a legal move, Discard when cards are owed.
- **Decentralization's "extra turn" needs one engine piece the spec did not list:** `GrantExtraTurnEffect` plus `Turn.resumeAfterSeatId`, so that the normal order resumes after Liu Shan's seat, not after the extra seat (`extraTurnStack` was never pushed to before).
- **Heartbroken needs `SkillDefinition.afterDeath`:** `skillsInPlay` returns nothing for an eliminated seat, so a skill that acts on its owner's own death is flagged and gathered for that one event.
- **Incarnation's deal is a Kingdom War trigger on `after:GeneralsChosenEvent`**, reading `SkillDefinition.spareGenerals` (a count), so the mode names no General. The leftover pool is `GameState.spareGenerals`, set at setup and hidden from every viewer.
- **`PendingChoice.secret`:** Incarnation's choice lists spare Generals only its owner may see; the redaction empties `options` for other viewers.
- **The wiki gets no "Awakening" label.** The crawled skill text already says "Awakened Ability"; the spec's wiki line is limited to Lord skills ("Not used in Kingdom War"), which the wiki already shows.
- **Awakening conversions:** Strategic Pass's Farm-as-Steal conversion accepts Farms only once Strategic Pass has awakened (an `accepts` check), since conversions are static.
- **First Incarnation choice:** offered when Zuo Ci is revealed (no seat is revealed at game start in Kingdom War, so that is "game start" for it), and at the start and end of each of his turns, as the spec says.
- **Stubborn and Lament choose from face-up cards with a choice**, not a selection: the cards lie in the discard pile and a card selection is built for a hand.

## Global Constraints

- **The engine names no card, skill or General.** Content supplies everything specific (CLAUDE.md, "Extensibility").
- **Game state stays plain serialisable data.** Absent optional state is left out (no `undefined` fields).
- **"May" always asks;** hidden Generals' optional skills are offered as "Reveal X to use Y"; compulsory skills and modifiers of a hidden General don't apply; Lord skills are inactive.
- **Every skill acts for its `owner`.** Never find a seat by General id.
- **Skill ids** are the English name in kebab case: `clever-change`, `military-farm`, `strategic-pass`, `pleasure`, `decentralization`, `seem-foolish`, `instigate`, `follow-the-master`, `passion`, `soul-position`, `takeover`, `direct-instruction`, `stubborn`, `lament`, `heartbroken`, `incarnation`, `new-life`. General ids: `zhang-he`, `deng-ai`, `liu-shan`, `jiang-wei`, `sun-ce`, `zhang-zhao-and-zhang-hong`, `cai-wenji`, `zuo-ci`.
- **No elemental damage.** (Nothing in Mountain deals any.)
- **UI text** follows CLAUDE.md's UI text style. Buttons and labels in Title Case ("Pass (Discard 1 Card)", "Skip Phase"); prompts, hints and history lines in sentence case with keywords capitalised.
- **Tests:** `npx jest <path>` runs one spec; `npx jest` runs everything. ts-jest type-checks, so a type error fails a test run.
- Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Heartbroken.** The killer loses every skill on both Generals, including gained and borrowed ones, for good; nothing happens when Cai Wenji dies with no killer, by her own hand, or when the killer is already out. (Task 6.)
2. **Awakening once, and only when it should.** Each awakening skill fires at most once, only at its owner's turn start, never while its General is hidden, and its gained skills then work like printed ones (a hidden slot still needs a reveal). (Tasks 2, 4, 5.)
3. **Zuo Ci's secrets and edges.** Other seats never see a spare General's id (state, pending choice, log); an empty pool deals nothing; Lord, awakening and limited skills are never offered; his gender follows the chosen Form. (Task 6.)
4. **Decentralization's turn order.** After the extra turn, play resumes with the seat after Liu Shan, also when the extra seat is face down, or Liu Shan has died. (Tasks 1, 4.)
5. **Clever Change and Military Farm loops.** Each phase is skipped once, never run twice; a Farm gained by a judgment never triggers a second judgment, and a card leaving Deng Ai's own turn does not trigger it. (Task 3.)

---

## File Structure

**Engine (`projects/engine/src/lib/`):**
- Modify: `domain/types.ts`, `domain/redact.ts`, `registry/types.ts`, `registry/lookup.ts`, `pipeline/effects.ts`, `pipeline/events.ts`, `rules/phaseSequence.ts`, `rules/legality.ts`, `skills/generalSkills.ts`, `skills/triggers.ts`.
- Create: `pipeline/mountainGroundwork.spec.ts`.

**Content (`projects/content/src/lib/`):**
- Modify: `modes/kingdomWar.ts`, `shared/queries.ts` (distance), `shared/gender.ts`, `generals/index.ts` (`MOUNTAIN_GENERAL_IDS`, `HAND_CODED`), `generals/skills.testing.ts` (stash zone), `generals/base.spec.ts` and `registry.spec.ts` (vanilla check), `display.ts`, `public-api.ts`.
- Create: `shared/awaken.ts`, `shared/farm.ts`, `shared/forms.ts`, `generals/mountain.ts`, `shared/groundwork11.spec.ts`, `generals/mountain-wei.spec.ts`, `mountain-shu.spec.ts`, `mountain-wu.spec.ts`, `mountain-qun.spec.ts`.

**Bots (`projects/bots/src/lib/`):** Create `mountain.ts`, `mountain.spec.ts`; modify `skills.ts`, `rule-based.ts`, `testing.ts`.

**Sim (`projects/sim/src/`):** Create `mountain.spec.ts`; modify `invariants.ts` if it enumerates zone kinds.

**App (`projects/app/src/app/game-board/`):** Modify `seat-tile.ts`, `round-table.ts`, `action-history.ts`, `response-description.ts`, `choice-description.ts` and their specs.

**Docs:** `docs/architecture/event-chain.md` ("Mountain hooks"), the roadmap spec row 11, the Stage 11 spec status.

---

## Task 1: Engine groundwork

**Files:**
- Modify: `projects/engine/src/lib/domain/types.ts`, `domain/redact.ts`, `registry/types.ts`, `registry/lookup.ts`, `pipeline/effects.ts`, `pipeline/events.ts`, `pipeline/resolve.ts` (only if the compiler needs an exhaustive case), `rules/phaseSequence.ts`, `rules/legality.ts`, `skills/generalSkills.ts`, `skills/triggers.ts`, `public-api.ts` (only if a new file is added; none is)
- Test: `projects/engine/src/lib/pipeline/mountainGroundwork.spec.ts`

**Interfaces:**
- Consumes: the stage 6–10 engine (`skillsInPlay`, `applyEffect`, `applyDying`, `advancePhaseOrTurn`, `conversionCards`, `redactStateForSeat`).
- Produces (Tasks 2–6 rely on these exact names):
  - `Seat.stash?: CardZoneRef`, `Seat.silenced?: true`, `Seat.gainedSkills?: { slot: 'main' | 'deputy'; skillId: string }[]`, `Seat.forms?: { slot: 'main' | 'deputy'; held: string[]; chosen?: { generalId: string; skillId: string } }`;
  - `GameState.spareGenerals?: string[]`; `PendingChoice.secret?: true`; `Turn.resumeAfterSeatId?: string`;
  - effects `{ kind: 'GainSkillEffect'; seatId; slot; skillId }`, `{ kind: 'SilenceSeatEffect'; seatId }`, `{ kind: 'DealSpareGeneralsEffect'; seatId; slot; count }`, `{ kind: 'ChooseFormSkillEffect'; seatId; generalId; skillId }`, `{ kind: 'GrantExtraTurnEffect'; seatId; resumeAfterSeatId }`;
  - events `SkillGainedEvent`, `SeatSilencedEvent`, `FormChosenEvent { seatId; generalId; skillId }`, `ExtraTurnGrantedEvent { seatId }`; `SeatEliminatedEvent.killerSeatId?`; `DyingEffect.killerSeatId?`;
  - `SkillDefinition.awakening?`, `.limited?`, `.afterDeath?`, `.spareGenerals?: number`; `AbilityModifiers.distanceToOthersFrom?(state, seatId): number`; `Conversion.from` gains `'stash'`;
  - `findSkill(registry, skillId): SkillDefinition | undefined` and `findGeneralSkill(registry, generalId, skillId)` in `registry/lookup.ts`.

- [ ] **Step 1: Write the failing spec**

Create `projects/engine/src/lib/pipeline/mountainGroundwork.spec.ts`:

```ts
import { advanceToDecision } from './resolve';
import { skillsInPlay } from '../skills/generalSkills';
import { gatherTriggeredSkills } from '../skills/triggers';
import { advancePhaseOrTurn } from '../rules/phaseSequence';
import { conversionCards } from '../rules/legality';
import { redactStateForSeat } from '../domain/redact';
import { findSkill } from '../registry/lookup';
import type { ContentRegistry, GameModeDefinition, SkillDefinition } from '../registry/types';
import type { GameState } from '../domain/types';
import type { Effect } from './effects';

const stub: GameModeDefinition = { id: 'stub', setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'], checkWinCondition: () => null, triggers: [] };
const card = (instanceId: string, definitionId = 'x') => ({ instanceId, definitionId, suit: 'spade' as const, rank: 7 });

const plain: SkillDefinition = { id: 'plain' };
const quiet: SkillDefinition = { id: 'quiet', compulsory: true };
const lordly: SkillDefinition = { id: 'lordly', lord: true };
const parting: SkillDefinition = {
  id: 'parting', compulsory: true, afterDeath: true,
  triggers: [{ point: 'after:SeatEliminatedEvent', condition: () => true, effect: () => [] }],
};
const living: SkillDefinition = { id: 'living', compulsory: true, triggers: [{ point: 'after:SeatEliminatedEvent', condition: () => true, effect: () => [] }] };
const registry: ContentRegistry = {
  cards: new Map([['x', { id: 'x', name: 'X', category: 'basic', legalPlayTargets: () => [[]], play: () => [] }]]),
  generals: new Map([
    ['g', { id: 'g', kingdom: 'Wei', maxHp: 4, skills: [plain] }],
    ['h', { id: 'h', kingdom: 'Shu', maxHp: 3, gender: 'female', skills: [quiet, lordly, parting, living] }],
  ]),
};

function table(over: Partial<GameState> = {}): GameState {
  const seat = (id: string, index: number) => ({
    id, index, kingdom: 'Wei' as const, eliminated: false,
    generals: { main: { generalDefinitionId: 'g', revealed: true }, deputy: { generalDefinitionId: 'g', revealed: true } },
    combinedHp: 4, maxCombinedHp: 4, hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` }, stash: { zoneId: `${id}:stash` },
  });
  return {
    seats: [seat('a', 0), seat('b', 1), seat('c', 2)], players: [], turn: { turnNumber: 1, ownerSeatId: 'a', extraTurnStack: [] }, phase: 'Play',
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: [card('d1'), card('d2')] },
      { id: 'discardPile', kind: 'discardPile', cards: [] },
      { id: 'processing', kind: 'processing', cards: [] },
      ...['a', 'b', 'c'].flatMap((id) => [
        { id: `${id}:hand`, kind: 'hand' as const, ownerSeatId: id, cards: id === 'a' ? [card('h1')] : [] },
        { id: `${id}:equip`, kind: 'equip' as const, ownerSeatId: id, cards: [] },
        { id: `${id}:judgment`, kind: 'judgment' as const, ownerSeatId: id, cards: [] },
        { id: `${id}:stash`, kind: 'pile' as const, ownerSeatId: id, cards: id === 'a' ? [card('f1'), card('f2')] : [] },
      ]),
    ],
    pendingResponse: null, log: [], rng: { seed: 1, counter: 0 }, result: null, generalSelection: null,
    ...over,
  };
}
const withSeat = (s: GameState, id: string, patch: object): GameState => ({ ...s, seats: s.seats.map((x) => (x.id === id ? { ...x, ...patch } : x)) });
const run = (s: GameState, ...effects: Effect[]) => advanceToDecision({ ...s, resolutionQueue: effects }, { registry, mode: stub }).state;
const ids = (s: GameState, owner: string) => skillsInPlay(s, owner, registry).map((x) => `${x.owner.slot}:${x.skill.id}`);

describe('skill lookup', () => {
  it('finds a skill by id across Generals', () => {
    expect(findSkill(registry, 'quiet')).toBe(quiet);
    expect(findSkill(registry, 'nope')).toBeUndefined();
  });
});

describe('gained skills', () => {
  it('GainSkillEffect adds the skill under the gaining slot, once, and logs it', () => {
    let s = run(table(), { kind: 'GainSkillEffect', seatId: 'a', slot: 'deputy', skillId: 'quiet' });
    s = run(s, { kind: 'GainSkillEffect', seatId: 'a', slot: 'deputy', skillId: 'quiet' });
    expect(s.seats[0].gainedSkills).toEqual([{ slot: 'deputy', skillId: 'quiet' }]);
    expect(ids(s, 'a')).toEqual(['main:plain', 'deputy:plain', 'deputy:quiet']);
    expect(s.log.filter((e) => e.kind === 'SkillGainedEvent')).toHaveLength(1);
  });

  it('a gained compulsory skill is off while its slot is hidden; a gained Lord skill is never in play', () => {
    const hidden = withSeat(table(), 'a', { gainedSkills: [{ slot: 'main', skillId: 'quiet' }, { slot: 'main', skillId: 'lordly' }], generals: { main: { generalDefinitionId: 'g', revealed: false }, deputy: { generalDefinitionId: 'g', revealed: true } } });
    expect(ids(hidden, 'a')).toEqual(['main:plain', 'deputy:plain']);
    const shown = withSeat(table(), 'a', { gainedSkills: [{ slot: 'main', skillId: 'quiet' }, { slot: 'main', skillId: 'lordly' }] });
    expect(ids(shown, 'a')).toEqual(['main:plain', 'deputy:plain', 'main:quiet']);
  });
});

describe('silenced seats', () => {
  it('SilenceSeatEffect leaves the seat with no skills at all, gained ones included', () => {
    const s = run(withSeat(table(), 'b', { gainedSkills: [{ slot: 'main', skillId: 'quiet' }] }), { kind: 'SilenceSeatEffect', seatId: 'b' });
    expect(s.seats[1].silenced).toBe(true);
    expect(ids(s, 'b')).toEqual([]);
    expect(ids(s, 'a')).toHaveLength(2);
    expect(s.log).toContainEqual({ kind: 'SeatSilencedEvent', seatId: 'b' });
  });
});

describe('spare Generals (Forms)', () => {
  const pool = (s: GameState, spare: string[]) => ({ ...s, spareGenerals: spare });

  it('DealSpareGeneralsEffect moves the first ids of the pool to the seat, and logs nothing', () => {
    const s = run(pool(table(), ['g', 'h', 'g2']), { kind: 'DealSpareGeneralsEffect', seatId: 'a', slot: 'main', count: 2 });
    expect(s.seats[0].forms).toEqual({ slot: 'main', held: ['g', 'h'] });
    expect(s.spareGenerals).toEqual(['g2']);
    expect(s.log).toEqual([]);
  });

  it('deals only what the pool holds, and nothing from an empty pool', () => {
    let s = run(pool(table(), ['g']), { kind: 'DealSpareGeneralsEffect', seatId: 'a', slot: 'main', count: 3 });
    expect(s.seats[0].forms?.held).toEqual(['g']);
    s = run(s, { kind: 'DealSpareGeneralsEffect', seatId: 'a', slot: 'main', count: 1 });
    expect(s.seats[0].forms?.held).toEqual(['g']);
  });

  it('a Form deals on top of what is held, keeping the chosen skill', () => {
    const base = withSeat(pool(table(), ['h']), 'a', { forms: { slot: 'main', held: ['g'], chosen: { generalId: 'g', skillId: 'plain' } } });
    const s = run(base, { kind: 'DealSpareGeneralsEffect', seatId: 'a', slot: 'main', count: 1 });
    expect(s.seats[0].forms).toEqual({ slot: 'main', held: ['g', 'h'], chosen: { generalId: 'g', skillId: 'plain' } });
  });

  it('ChooseFormSkillEffect picks the skill, logs it, and puts it in play under the holding slot', () => {
    const base = withSeat(table(), 'a', { forms: { slot: 'deputy', held: ['h'] } });
    const s = run(base, { kind: 'ChooseFormSkillEffect', seatId: 'a', generalId: 'h', skillId: 'quiet' });
    expect(s.seats[0].forms?.chosen).toEqual({ generalId: 'h', skillId: 'quiet' });
    expect(ids(s, 'a')).toEqual(['main:plain', 'deputy:plain', 'deputy:quiet']);
    expect(s.log).toContainEqual({ kind: 'FormChosenEvent', seatId: 'a', generalId: 'h', skillId: 'quiet' });
  });
});

describe('afterDeath skills', () => {
  const dead = (s: GameState) => withSeat(s, 'b', { eliminated: true, generals: { main: { generalDefinitionId: 'h', revealed: true }, deputy: { generalDefinitionId: 'g', revealed: true } } });
  const gathered = (s: GameState, seatId: string) =>
    gatherTriggeredSkills(s, registry, stub, 'after:SeatEliminatedEvent', { kind: 'SeatEliminatedEvent', seatId }).map((t) => (t.owner as { seatId: string; skillId: string }).skillId);

  it('an afterDeath skill is gathered for its own seat’s elimination, and only that', () => {
    const s = dead(table());
    expect(gathered(s, 'b')).toEqual(['parting']);
    expect(gathered(s, 'c')).toEqual([]);
  });

  it('a living seat’s ordinary trigger is still gathered, and a dead seat’s ordinary trigger is not', () => {
    const s = withSeat(dead(table()), 'c', { generals: { main: { generalDefinitionId: 'h', revealed: true }, deputy: { generalDefinitionId: 'g', revealed: true } } });
    expect(gathered(s, 'b').sort()).toEqual(['living', 'parting']);
  });
});

describe('the killer', () => {
  it('a dying round carries killerSeatId to the elimination event', () => {
    const s = withSeat(table(), 'b', { combinedHp: 0 });
    const out = run(s, { kind: 'DyingEffect', seatId: 'b', order: ['b'], rescueCardIds: { any: ['peach'], self: [] }, entering: true, killerSeatId: 'a' });
    expect(out.seats[1].eliminated).toBe(true);
    expect(out.log).toContainEqual({ kind: 'SeatEliminatedEvent', seatId: 'b', killerSeatId: 'a' });
  });

  it('with no killer the event names none', () => {
    const out = run(withSeat(table(), 'b', { combinedHp: 0 }), { kind: 'DyingEffect', seatId: 'b', order: ['b'], rescueCardIds: { any: ['peach'], self: [] }, entering: true });
    expect(out.log).toContainEqual({ kind: 'SeatEliminatedEvent', seatId: 'b' });
  });
});

describe('extra turns', () => {
  it('GrantExtraTurnEffect queues the seat; after its turn play resumes after the grantor', () => {
    const s = run(table(), { kind: 'GrantExtraTurnEffect', seatId: 'c', resumeAfterSeatId: 'a' });
    expect(s.turn.extraTurnStack).toEqual(['c']);
    const extra = advancePhaseOrTurn({ ...s, phase: 'End' });
    expect(extra.turn).toMatchObject({ ownerSeatId: 'c', extraTurnStack: [], resumeAfterSeatId: 'a' });
    const after = advancePhaseOrTurn({ ...s, phase: 'End', turn: extra.turn });
    expect(after.turn.ownerSeatId).toBe('b');
    expect(after.turn.resumeAfterSeatId).toBeUndefined();
  });

  it('a granted seat that is out by then is passed over', () => {
    const s = withSeat(run(table(), { kind: 'GrantExtraTurnEffect', seatId: 'c', resumeAfterSeatId: 'a' }), 'c', { eliminated: true });
    expect(advancePhaseOrTurn({ ...s, phase: 'End' }).turn.ownerSeatId).toBe('b');
  });

  it('with no extra turns the order is as before', () => {
    expect(advancePhaseOrTurn({ ...table(), phase: 'End' }).turn.ownerSeatId).toBe('b');
  });
});

describe('Conversion.from stash', () => {
  it('offers only the stash cards, never the hand', () => {
    const conversion = { id: 'c', as: 'x', cards: 1 as const, from: 'stash' as const, when: 'play' as const };
    expect(conversionCards(table(), 'a', conversion, registry).map((c) => c.instanceId)).toEqual(['f1', 'f2']);
  });
});

describe('redaction', () => {
  it('hides other seats’ spare Generals (entirely while the holder is hidden), the pool, and a secret choice’s options; the owner sees its own', () => {
    const s: GameState = {
      ...withSeat(table(), 'a', { forms: { slot: 'main', held: ['g', 'h'], chosen: { generalId: 'h', skillId: 'quiet' } } }),
      spareGenerals: ['g'],
      pendingChoice: { id: 'c', seatId: 'a', verb: 'pick', secret: true, reason: { kind: 'ability', owner: { kind: 'general', seatId: 'a', slot: 'main', skillId: 'quiet' }, abilityId: 'quiet' }, options: [{ id: 'o', shows: { kind: 'label', text: 'Secret' }, effects: [] }] },
    };
    const other = redactStateForSeat(s, 'b');
    expect(other.seats[0].forms).toEqual({ slot: 'main', held: ['hidden', 'hidden'], chosen: { generalId: 'h', skillId: 'quiet' } });
    expect(other.spareGenerals).toEqual([]);
    expect(other.pendingChoice?.options).toEqual([]);
    const hiddenHolder = withSeat(s, 'a', { generals: { main: { generalDefinitionId: 'g', revealed: false }, deputy: { generalDefinitionId: 'g', revealed: true } } });
    expect(redactStateForSeat(hiddenHolder, 'b').seats[0].forms).toBeUndefined();
    const mine = redactStateForSeat(s, 'a');
    expect(mine.seats[0].forms?.held).toEqual(['g', 'h']);
    expect(mine.pendingChoice?.options).toHaveLength(1);
    expect(mine.spareGenerals).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx jest projects/engine/src/lib/pipeline/mountainGroundwork.spec.ts`
Expected: FAIL (type errors: `stash`, `GainSkillEffect`, `findSkill`, `afterDeath` and the rest do not exist).

- [ ] **Step 3: Domain types**

In `projects/engine/src/lib/domain/types.ts`:

1. In `Turn`, after `flags`:
```ts
  // After an extra turn (GrantExtraTurnEffect): the seat whose turn it was
  // granted from. The normal order resumes after it, not after the extra seat.
  resumeAfterSeatId?: string;
```
2. In `Seat`, after `pile?`:
```ts
  // A second face-up pile beside `pile` (Deng Ai's Farms). Absent in tables without one.
  stash?: CardZoneRef;
  // Lost every skill for the rest of the game (Heartbroken).
  silenced?: true;
  // Skills gained for the rest of the game. `slot` is the General that gained
  // them: its reveal state governs their use.
  gainedSkills?: { slot: 'main' | 'deputy'; skillId: string }[];
  // Spare Generals (Forms) the General in `slot` holds, and the one skill
  // chosen from them, which that General then holds too.
  forms?: { slot: 'main' | 'deputy'; held: string[]; chosen?: { generalId: string; skillId: string } };
```
3. In `PendingChoice`, after `options`:
```ts
  // Only the choosing seat sees the options (Incarnation's Forms).
  secret?: true;
```
4. In `GameState`, after `generalSelection`:
```ts
  // General ids nobody was dealt, in order: where spare Generals come from.
  // Hidden from every viewer.
  spareGenerals?: string[];
```
(Open the file, find the exact lines; place each field next to the comment style around it.)

- [ ] **Step 4: Registry types and lookup**

In `projects/engine/src/lib/registry/types.ts`:
- `AbilityModifiers`: add
```ts
  // Added to the owner's distance to every other seat, from the state (Farms:
  // -1 each). Added with `distanceToOthers`; the distance never goes below 1.
  distanceToOthersFrom?(state: GameState, seatId: string): number;
```
- `Conversion.from`: `from?: 'hand' | 'hand-and-equipment' | 'stash';` with the comment "or only from the seat's stash pile".
- `SkillDefinition`: add
```ts
  // Fires once, compulsorily, when its condition holds at its owner's turn
  // start (content marks it awakened). Never borrowed (Incarnation).
  awakening?: true;
  // Usable once per game. Never borrowed (Incarnation).
  limited?: true;
  // Its triggers are also gathered for its own seat's elimination, though an
  // eliminated seat has no skills in play (Heartbroken).
  afterDeath?: true;
  // Spare Generals dealt to its owner's seat when Generals are chosen.
  spareGenerals?: number;
```

In `projects/engine/src/lib/registry/lookup.ts` append:
```ts
// A skill by id, from whichever General has it. Skill ids are unique across Generals.
export function findSkill(registry: ContentRegistry, skillId: string): SkillDefinition | undefined {
  for (const general of registry.generals.values()) {
    const found = general.skills.find((s) => s.id === skillId);
    if (found) return found;
  }
  return undefined;
}
```
and add `SkillDefinition` to its import.

- [ ] **Step 5: Events and effects**

In `pipeline/events.ts`:
- `SeatEliminatedEvent` gets `killerSeatId?: string;`.
- Add (and to the `EngineEvent` union):
```ts
// A seat gained a skill for the rest of the game.
export interface SkillGainedEvent { kind: 'SkillGainedEvent'; seatId: string; slot: 'main' | 'deputy'; skillId: string }
// A seat lost every skill for the rest of the game.
export interface SeatSilencedEvent { kind: 'SeatSilencedEvent'; seatId: string }
// A seat chose a skill of one of its spare Generals, which turns face up.
export interface FormChosenEvent { kind: 'FormChosenEvent'; seatId: string; generalId: string; skillId: string }
// A seat was granted an extra turn.
export interface ExtraTurnGrantedEvent { kind: 'ExtraTurnGrantedEvent'; seatId: string }
```

In `pipeline/effects.ts`:
- `DyingEffect` gets `killerSeatId?: string` (add to the type line).
- Add the five effect kinds to the union with comments, and their cases to `applyEffect`:
```ts
    case 'GainSkillEffect': {
      const seat = state.seats.find((s) => s.id === effect.seatId);
      if (!seat) throw new Error(`Unknown seat: ${effect.seatId}`);
      const held = seat.gainedSkills ?? [];
      if (held.some((g) => g.slot === effect.slot && g.skillId === effect.skillId)) return { state, events: [] };
      const seats = state.seats.map((s) => (s.id === seat.id ? { ...s, gainedSkills: [...held, { slot: effect.slot, skillId: effect.skillId }] } : s));
      const event: EngineEvent = { kind: 'SkillGainedEvent', seatId: seat.id, slot: effect.slot, skillId: effect.skillId };
      return { state: { ...state, seats, log: [...state.log, event] }, events: [event] };
    }
    case 'SilenceSeatEffect': {
      const seat = state.seats.find((s) => s.id === effect.seatId);
      if (!seat) throw new Error(`Unknown seat: ${effect.seatId}`);
      if (seat.silenced) return { state, events: [] };
      const seats = state.seats.map((s) => (s.id === seat.id ? { ...s, silenced: true as const } : s));
      const event: EngineEvent = { kind: 'SeatSilencedEvent', seatId: seat.id };
      return { state: { ...state, seats, log: [...state.log, event] }, events: [event] };
    }
    case 'DealSpareGeneralsEffect': {
      const seat = state.seats.find((s) => s.id === effect.seatId);
      if (!seat) throw new Error(`Unknown seat: ${effect.seatId}`);
      const pool = state.spareGenerals ?? [];
      const taken = pool.slice(0, Math.max(0, effect.count));
      if (taken.length === 0) return { state, events: [] };
      const forms = { slot: effect.slot, held: [...(seat.forms?.held ?? []), ...taken], ...(seat.forms?.chosen ? { chosen: seat.forms.chosen } : {}) };
      const seats = state.seats.map((s) => (s.id === seat.id ? { ...s, forms } : s));
      // Nothing is logged: the log is public, and a seat dealt Forms would give its hidden General away.
      return { state: { ...state, seats, spareGenerals: pool.slice(taken.length) }, events: [] };
    }
    case 'ChooseFormSkillEffect': {
      const seat = state.seats.find((s) => s.id === effect.seatId);
      if (!seat?.forms) throw new Error(`Seat ${effect.seatId} holds no spare Generals`);
      const seats = state.seats.map((s) => (s.id === seat.id ? { ...s, forms: { ...seat.forms!, chosen: { generalId: effect.generalId, skillId: effect.skillId } } } : s));
      const event: EngineEvent = { kind: 'FormChosenEvent', seatId: seat.id, generalId: effect.generalId, skillId: effect.skillId };
      return { state: { ...state, seats, log: [...state.log, event] }, events: [event] };
    }
    case 'GrantExtraTurnEffect': {
      const turn = { ...state.turn, extraTurnStack: [...state.turn.extraTurnStack, effect.seatId], resumeAfterSeatId: state.turn.resumeAfterSeatId ?? effect.resumeAfterSeatId };
      const event: EngineEvent = { kind: 'ExtraTurnGrantedEvent', seatId: effect.seatId };
      return { state: { ...state, turn, log: [...state.log, event] }, events: [event] };
    }
```
- In `applyDying`: when it eliminates (the `index === -1` branch) the event becomes `{ kind: 'SeatEliminatedEvent', seatId: seat.id, ...(effect.killerSeatId ? { killerSeatId: effect.killerSeatId } : {}) }`; and the two re-created `DyingEffect`s (Pass and the answer's `onAnswer`) carry `...(effect.killerSeatId ? { killerSeatId: effect.killerSeatId } : {})`.

(If `resolve.ts` has an exhaustive `switch` over effect kinds that now fails to compile, add the five kinds to the same group as `ReduceMaxHpEffect`.)

- [ ] **Step 6: Phase sequence**

In `rules/phaseSequence.ts` `advanceTurn`:

```ts
function advanceTurn(turn: Turn, seats: Seat[]): Turn {
  // An extra turn waiting for a seat that is out is passed over.
  const waiting = [...turn.extraTurnStack];
  while (waiting.length > 0 && seats.find((s) => s.id === waiting[waiting.length - 1])?.eliminated) waiting.pop();
  const resume = turn.resumeAfterSeatId ?? turn.ownerSeatId;
  if (waiting.length > 0) {
    return {
      turnNumber: turn.turnNumber + 1,
      ownerSeatId: waiting[waiting.length - 1],
      extraTurnStack: waiting.slice(0, -1),
      resumeAfterSeatId: resume,
    };
  }
  const ordered = [...seats].sort((a, b) => a.index - b.index);
  const currentIdx = ordered.findIndex((s) => s.id === resume);
  if (currentIdx === -1) {
    throw new Error(`Cannot advance the turn: unknown current turn owner ${resume}`);
  }
  // (the existing comment and loop follow unchanged)
```
Keep the rest of the function as it is (the loop returns `{ turnNumber: turn.turnNumber + 1, ownerSeatId: candidate.id, extraTurnStack: [] }`, which clears `resumeAfterSeatId`).

- [ ] **Step 7: skillsInPlay, afterDeath**

In `skills/generalSkills.ts` replace `skillsInPlay` with:

```ts
export function skillsInPlay(state: GameState, seatId: string, registry: ContentRegistry): SkillInPlay[] {
  const seat = state.seats.find((s) => s.id === seatId);
  if (!seat || seat.eliminated || !seat.generals || seat.silenced) return [];
  const found: SkillInPlay[] = [];
  const add = (slot: 'main' | 'deputy', skill: SkillDefinition | undefined) => {
    const general = seat.generals![slot];
    if (!skill || skill.lord || (!general.revealed && skill.compulsory)) return;
    if (found.some((f) => f.owner.slot === slot && f.skill.id === skill.id)) return;
    found.push({ owner: { kind: 'general', seatId, slot, skillId: skill.id }, skill, needsReveal: !general.revealed });
  };
  for (const slot of SLOTS) {
    for (const skill of registry.generals.get(seat.generals[slot].generalDefinitionId)?.skills ?? []) add(slot, skill);
  }
  // Skills gained for good, then the chosen spare General's skill.
  for (const { slot, skillId } of seat.gainedSkills ?? []) add(slot, findSkill(registry, skillId));
  if (seat.forms?.chosen) add(seat.forms.slot, registry.generals.get(seat.forms.chosen.generalId)?.skills.find((s) => s.id === seat.forms!.chosen!.skillId));
  return found;
}
```
Update the doc comment (silenced seats have none; gained and borrowed skills follow the printed ones) and import `findSkill`.

In `skills/triggers.ts`, after the loop over `skillsInPlay`, add:

```ts
  // An eliminated seat's afterDeath skills, for its own elimination only.
  const dying = point === 'after:SeatEliminatedEvent' ? (subject as { seatId?: string }).seatId : undefined;
  const gone = dying ? state.seats.find((s) => s.id === dying && s.eliminated && s.generals && !s.silenced) : undefined;
  for (const slot of ['main', 'deputy'] as const) {
    const general = gone?.generals?.[slot];
    for (const skill of general ? (registry.generals.get(general.generalDefinitionId)?.skills ?? []) : []) {
      if (!skill.afterDeath || skill.lord) continue;
      for (const trigger of skill.triggers ?? []) {
        if (trigger.point === point) candidates.push({ trigger, owner: { kind: 'general', seatId: gone!.id, slot, skillId: skill.id } });
      }
    }
  }
```

- [ ] **Step 8: Conversions from the stash**

In `rules/legality.ts`:
- `conversionVia`: `fromHandOnly: conversion.from !== 'hand-and-equipment' && conversion.from !== 'stash'` is wrong for 'stash' semantics ("hand only" means the hand is the source). Use `fromHandOnly: conversion.from === undefined || conversion.from === 'hand'`.
- `conversionCards`: replace `const pool = ...` with
```ts
  const pool =
    conversion.from === 'stash'
      ? cardsIn(seat.stash?.zoneId ?? '')
      : [...cardsIn(seat.hand.zoneId), ...(conversion.from === 'hand-and-equipment' ? cardsIn(seat.equipped.zoneId) : [])];
```
Also update its doc comment.

- [ ] **Step 9: Redaction**

In `domain/redact.ts`:
- `redactSeat` (viewer is not the seat): `forms` is left out while the General in `forms.slot` is hidden (a hidden General must not give itself away), and otherwise shows `held` as `HIDDEN_GENERAL_ID` per entry with `chosen` kept. The own seat is returned as is, so the viewer sees its own Forms. (`redactSeat`'s early `return seat` for the viewer's own seat comes first; build the other seat's view from `{ ...seat, ... }` with `forms` removed through a rest destructure.)
- `redactStateForSeat`: add `spareGenerals: []` when the state has `spareGenerals` (use a conditional spread), and for a pending choice with `secret` whose `seatId !== viewerSeatId`, `options: []` (apply before `maskSkills`):
```ts
const hideSecret = (choice: PendingChoice): PendingChoice => (choice.secret && choice.seatId !== viewerSeatId ? { ...choice, options: [] } : choice);
```
and use `hideSecret(state.pendingChoice)` in the existing `pendingChoice` line. Import `PendingChoice`.

- [ ] **Step 10: Run the engine suite**

Run: `npx jest projects/engine`
Expected: PASS, the new spec included, no other engine spec broken. If an exhaustive switch or a spec's literal table needs `stash`, fix the compile error minimally and ledger it as a ruling.

- [ ] **Step 11: Commit**

```bash
git add projects/engine
git commit -m "feat(engine): gained skills, silenced seats, spare Generals, stash pile, extra turns, afterDeath hook

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Task 2: Content groundwork and Kingdom War

**Files:**
- Modify: `projects/content/src/lib/shared/queries.ts`, `shared/gender.ts`, `modes/kingdomWar.ts`, `generals/skills.testing.ts`, `projects/bots/src/lib/testing.ts`, `projects/app/src/app/game-board/action-history.spec.ts` (table helper: add the stash zone)
- Create: `shared/awaken.ts`, `shared/farm.ts`, `shared/forms.ts`
- Test: `projects/content/src/lib/shared/groundwork11.spec.ts`

**Interfaces:**
- Consumes: Task 1.
- Produces (Tasks 3–6 rely on these exact names):
  - `shared/awaken.ts`: `awakenedKey(skillId): string`, `isAwakened(state, seatId, skillId): boolean`, `awakeningAtTurnStart(rule): SkillTrigger`, where `rule = { skillId; condition(state, owner, registry): boolean; effects(state, owner, registry): Effect[] }`;
  - `shared/farm.ts`: `stashZoneOf(state, seatId): CardZone | undefined`, `farmCount(state, seatId): number`, `stashMove(state, seatId, cardInstanceId, onlyFrom?): Effect`;
  - `shared/forms.ts`: `formSkillOptions(state, seatId, registry): { generalId: string; skillId: string }[]`;
  - `seatGender` reads the chosen Form's gender (see below);
  - `seatDistance` adds `distanceToOthersFrom`;
  - Kingdom War: stash zone per seat, `spareGenerals` at setup, a deal trigger, the killer on `DyingEffect`, the stash discarded on death;
  - test table `table()` seats have a stash zone `${id}:stash`.

- [ ] **Step 1: Write the failing spec**

Create `projects/content/src/lib/shared/groundwork11.spec.ts`:

```ts
import { createGame } from 'engine';
import type { SkillDefinition } from 'engine';
import { buildContentRegistry } from '../registry';
import { kingdomWarMode } from '../modes/kingdomWar';
import { awakenedKey, isAwakened } from './awaken';
import { farmCount, stashZoneOf } from './farm';
import { formSkillOptions } from './forms';
import { seatGender } from './gender';
import { seatDistance } from './queries';
import { card, harness, kwMode, registry, table, ids } from '../generals/skills.testing';

const h = harness();
const hk = harness(kwMode);

describe('awakened marks', () => {
  it('isAwakened reads the seat mark awakenedKey names', () => {
    const s = table();
    expect(isAwakened(s, 'seat-a', 'x')).toBe(false);
    const marked = { ...s, seats: s.seats.map((x) => (x.id === 'seat-a' ? { ...x, marks: { [awakenedKey('x')]: 1 } } : x)) };
    expect(isAwakened(marked, 'seat-a', 'x')).toBe(true);
  });
});

describe('Farms', () => {
  it('count the cards in the stash, and a seat with none counts 0', () => {
    const s = table({ 'seat-a:stash': [card('f1', 'sha'), card('f2', 'shan')] });
    expect(stashZoneOf(s, 'seat-a')?.cards).toHaveLength(2);
    expect(farmCount(s, 'seat-a')).toBe(2);
    expect(farmCount(s, 'seat-b')).toBe(0);
  });
});

describe('distanceToOthersFrom', () => {
  it('a skill’s state-based bonus lowers the owner’s distance, never below 1', () => {
    const probe: SkillDefinition = { id: 'probe', modifiers: { distanceToOthersFrom: () => -1 } };
    const custom = { ...registry, generals: new Map(registry.generals).set('probe-g', { id: 'probe-g', kingdom: 'Wei' as const, maxHp: 4, skills: [probe] }) };
    const s = table({}, { generals: { 'seat-a': ['probe-g', 'filler-xu-huang'] }, seats: 6 });
    const base = seatDistance(table({}, { seats: 6 }), 'seat-a', 'seat-c', registry); // 2
    expect(seatDistance(s, 'seat-a', 'seat-c', custom)).toBe(base - 1);
    expect(seatDistance(s, 'seat-a', 'seat-b', custom)).toBe(1);
  });
});

describe('seatGender and a chosen Form', () => {
  it('follows the Form chosen by the shown General’s slot; a hidden holder keeps its own', () => {
    const base = table({}, { generals: { 'seat-a': ['filler-zuo-ci', 'filler-xu-huang'] } });
    const withForm = (revealed: boolean) => ({
      ...base,
      seats: base.seats.map((x) =>
        x.id === 'seat-a'
          ? { ...x, forms: { slot: 'main' as const, held: ['cai-wenji'], chosen: { generalId: 'cai-wenji', skillId: 'lament' } }, generals: { main: { generalDefinitionId: 'filler-zuo-ci', revealed }, deputy: { generalDefinitionId: 'filler-xu-huang', revealed: !revealed } } }
          : x
      ),
    });
    expect(seatGender(withForm(true), 'seat-a', registry)).toBe('female'); // Cai Wenji's
    expect(seatGender(withForm(false), 'seat-a', registry)).toBe('male'); // the Deputy's
  });
});

describe('formSkillOptions', () => {
  it('lists each held General’s skills, leaving out Lord, awakening and limited skills and the chosen one', () => {
    const lord: SkillDefinition = { id: 'l', lord: true };
    const awake: SkillDefinition = { id: 'a', awakening: true };
    const once: SkillDefinition = { id: 'o', limited: true };
    const free: SkillDefinition = { id: 'f' };
    const generals = new Map(registry.generals).set('multi', { id: 'multi', kingdom: 'Wei' as const, maxHp: 3, skills: [lord, awake, once, free, { id: 'g2' }] });
    const custom = { ...registry, generals };
    const s = { ...table(), seats: table().seats.map((x) => (x.id === 'seat-a' ? { ...x, forms: { slot: 'main' as const, held: ['multi'], chosen: { generalId: 'multi', skillId: 'g2' } } } : x)) };
    expect(formSkillOptions(s, 'seat-a', custom)).toEqual([{ generalId: 'multi', skillId: 'f' }]);
  });
});

describe('Kingdom War setup', () => {
  const real = buildContentRegistry();
  const game = createGame(kingdomWarMode, real, ['seat-0', 'seat-1', 'seat-2'], 7);

  it('every seat has a stash zone, and the spare pool is exactly the Generals nobody was dealt', () => {
    expect(game.seats.every((s) => s.stash?.zoneId === `${s.id}:stash`)).toBe(true);
    expect(game.zones.filter((z) => z.id.endsWith(':stash'))).toHaveLength(3);
    const dealt = Object.values(game.generalSelection!.candidates).flat();
    const undealt = [...real.generals.keys()].filter((id) => !dealt.includes(id)).sort();
    expect([...game.spareGenerals!].sort()).toEqual(undealt);
    expect(new Set(game.spareGenerals).size).toBe(game.spareGenerals!.length);
  });
});

describe('Kingdom War: the killer and the stash', () => {
  it('a seat killed by damage is eliminated with the damage source as its killer', () => {
    let s = table({ 'seat-b:stash': [card('f1', 'sha')] }, { hp: { 'seat-b': 1 }, kingdoms: { 'seat-b': 'Qun' } });
    s = hk.run(s, [{ kind: 'DamageEffect', damage: { source: { kind: 'seat', seatId: 'seat-a' }, target: { kind: 'seat', seatId: 'seat-b' }, amount: 1, nature: 'normal' } }]);
    for (let i = 0; i < 4 && s.pendingResponse; i++) s = hk.pass(s);
    expect(s.seats.find((x) => x.id === 'seat-b')!.eliminated).toBe(true);
    expect(s.log).toContainEqual({ kind: 'SeatEliminatedEvent', seatId: 'seat-b', killerSeatId: 'seat-a' });
    expect(ids(s, 'seat-b:stash')).toEqual([]); // the stash is discarded with the rest
  });
});
```


- [ ] **Step 2: Run it to see it fail**

Run: `npx jest projects/content/src/lib/shared/groundwork11.spec.ts`
Expected: FAIL (missing modules, `stash`, `spareGenerals`).

- [ ] **Step 3: The helpers**

Create `projects/content/src/lib/shared/awaken.ts`:

```ts
import type { ContentRegistry, Effect, GameState, GeneralOwner, PhaseChangedEvent, SkillTrigger } from 'engine';
import { on, used } from './skills';

// The seat mark that records an awakening skill having fired.
export const awakenedKey = (skillId: string) => `awakened:${skillId}`;

export const isAwakened = (state: GameState, seatId: string, skillId: string): boolean =>
  !!state.seats.find((s) => s.id === seatId)?.marks?.[awakenedKey(skillId)];

interface AwakeningRule {
  skillId: string;
  condition(state: GameState, owner: GeneralOwner, registry: ContentRegistry): boolean;
  // What the awakening does, after it is marked and logged.
  effects(state: GameState, owner: GeneralOwner, registry: ContentRegistry): Effect[];
}

// An awakening skill's trigger: at the start of its owner's own turn, once,
// when the condition holds. Mark it awakened first, then do the rest.
export function awakeningAtTurnStart(rule: AwakeningRule): SkillTrigger {
  return on<PhaseChangedEvent>('after:PhaseChangedEvent', {
    condition: (state, event, owner, registry) =>
      event.phase === 'Start' &&
      event.seatId === owner.seatId &&
      !isAwakened(state, owner.seatId, rule.skillId) &&
      state.seats.some((s) => s.id === owner.seatId && !s.eliminated) &&
      rule.condition(state, owner, registry),
    effect: (state, _event, owner, registry) => [
      { kind: 'IncrementEffect', scope: 'seat', seatId: owner.seatId, key: awakenedKey(rule.skillId), by: 1 },
      used(owner, 'awakened'),
      ...rule.effects(state, owner, registry),
    ],
  });
}
```

Create `shared/farm.ts`:

```ts
import type { CardZone, Effect, GameState } from 'engine';

// A seat's stash pile, if its table has one (Deng Ai's Farms lie there).
export function stashZoneOf(state: GameState, seatId: string): CardZone | undefined {
  const seat = state.seats.find((s) => s.id === seatId);
  return seat?.stash && state.zones.find((z) => z.id === seat.stash!.zoneId);
}

// Each card in the stash is one Farm.
export const farmCount = (state: GameState, seatId: string): number => stashZoneOf(state, seatId)?.cards.length ?? 0;

// Moves `cardInstanceId` into the seat's stash (only if it still lies in `onlyFrom`).
export function stashMove(state: GameState, seatId: string, cardInstanceId: string, onlyFrom?: string): Effect {
  const zone = stashZoneOf(state, seatId);
  if (!zone) throw new Error(`Seat ${seatId} has no stash`);
  return { kind: 'MoveCardEffect', cardInstanceId, toZoneId: zone.id, ...(onlyFrom ? { onlyFrom } : {}) };
}
```

Create `shared/forms.ts`:

```ts
import type { ContentRegistry, GameState } from 'engine';

export interface FormSkill { generalId: string; skillId: string }

// The skills Zuo Ci may choose now: those of the Generals he holds, except Lord,
// awakening and limited skills, and the one already chosen.
export function formSkillOptions(state: GameState, seatId: string, registry: ContentRegistry): FormSkill[] {
  const forms = state.seats.find((s) => s.id === seatId)?.forms;
  if (!forms) return [];
  return forms.held.flatMap((generalId) =>
    (registry.generals.get(generalId)?.skills ?? [])
      .filter((s) => !s.lord && !s.awakening && !s.limited && !(forms.chosen?.generalId === generalId && forms.chosen.skillId === s.id))
      .map((s) => ({ generalId, skillId: s.id }))
  );
}
```

- [ ] **Step 4: Distance and gender**

In `shared/queries.ts` `seatDistance`, replace the `skills` line with:
```ts
  const skills = activeAbilities(state, fromSeatId, registry).reduce(
    (sum, a) => sum + (a.modifiers?.distanceToOthers ?? 0) + (a.modifiers?.distanceToOthersFrom?.(state, fromSeatId) ?? 0),
    0
  );
```
In `shared/gender.ts` replace the body after the `generals` guard so a Form's gender replaces its holder's:
```ts
  const seat = state.seats.find((s) => s.id === seatId);
  const generals = seat?.generals;
  if (!seat || !generals) return null;
  const slot = generals.main.revealed ? 'main' : generals.deputy.revealed ? 'deputy' : null;
  if (!slot) return null;
  // A Form chosen by the shown General's slot lends its gender (Incarnation).
  if (seat.forms?.chosen && seat.forms.slot === slot) return registry.generals.get(seat.forms.chosen.generalId)?.gender ?? null;
  return registry.generals.get(generals[slot].generalDefinitionId)?.gender ?? null;
```
and update the comment ("… or, while a Form is chosen by that General, the Form's").

- [ ] **Step 5: Kingdom War**

In `modes/kingdomWar.ts`:
1. `dealCandidates` returns the leftover pool too: after the `forEach`, `const spare = pool.slice(seatIds.length * GENERALS_PER_SEAT).filter((id) => !(registry.generals.get(id)?.skills ?? []).some((s) => s.spareGenerals));` and `return { candidates, spare, rng: afterShuffle };`. Update its comment.
2. In `setup`, destructure `spare`; give each seat `stash: { zoneId: `${id}:stash` }` beside `pile`; add `{ id: `${s.id}:stash`, kind: 'pile' as const, ownerSeatId: s.id, cards: [] }` to the zones; add `spareGenerals: spare` to the state.
3. The elimination discard: `[seat.hand, seat.equipped, seat.judgment, ...(seat.pile ? [seat.pile] : []), ...(seat.stash ? [seat.stash] : [])]`.
4. A new mode trigger after the Draw Phase one:
```ts
    // A seat that chose a General with spare Generals to deal gets them (Incarnation).
    {
      point: 'after:GeneralsChosenEvent',
      condition: (state, subject, _owner, registry) => spareDeals(state, (subject as GeneralsChosenEvent).seatId, registry).length > 0,
      effect: (state, subject, _owner, registry) => spareDeals(state, (subject as GeneralsChosenEvent).seatId, registry),
    },
```
with
```ts
// One DealSpareGeneralsEffect per chosen General that deals spare Generals.
function spareDeals(state: GameState, seatId: string, registry?: ContentRegistry): Effect[] {
  const generals = state.seats.find((s) => s.id === seatId)?.generals;
  if (!generals || !registry) return [];
  return (['main', 'deputy'] as const).flatMap((slot) =>
    (registry.generals.get(generals[slot].generalDefinitionId)?.skills ?? []).flatMap((s) =>
      s.spareGenerals ? [{ kind: 'DealSpareGeneralsEffect' as const, seatId, slot, count: s.spareGenerals }] : []
    )
  );
}
```
(import `GeneralsChosenEvent`, `Effect` as needed).
5. In `hpDropTriggers`' third trigger, set the killer: add to the `DyingEffect` object
```ts
          ...(event.kind === 'DamageDealtEvent' && event.damage.source?.kind === 'seat' && event.damage.source.seatId !== seat.id ? { killerSeatId: event.damage.source.seatId } : {}),
```

- [ ] **Step 6: Test tables get a stash zone**

In `generals/skills.testing.ts`: each seat gets `stash: { zoneId: `${id}:stash` }` and the zones list gets `{ id: `${id}:stash`, kind: 'pile' as const, ownerSeatId: id, cards: cards[`${id}:stash`] ?? [] }`. Make the same two edits in `projects/bots/src/lib/testing.ts` and in `projects/app/src/app/game-board/action-history.spec.ts` (line 10 builds the zones; mirror the `:pile` line).

- [ ] **Step 7: Run**

Run: `npx jest projects/content projects/engine`
Expected: PASS. If an existing spec counts zones or compares whole seats and breaks on `stash`, update it minimally and ledger a ruling.

- [ ] **Step 8: Commit**

```bash
git add projects/content projects/bots projects/app
git commit -m "feat(content): awakening, Farm and Form helpers; Kingdom War deals spare Generals and names the killer

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```


## Task 3: Wei — Zhang He and Deng Ai

**Files:**
- Create: `projects/content/src/lib/generals/mountain.ts`, `mountain-wei.spec.ts`
- Modify: `generals/index.ts` (`MOUNTAIN_GENERAL_IDS`, `HAND_CODED`), `public-api.ts`, `base.spec.ts` and `registry.spec.ts` (their "vanilla General" check), `display.ts` (nothing yet)

**Interfaces:**
- Consumes: Tasks 1–2 (`awakeningAtTurnStart`, `isAwakened`, `farmCount`, `stashMove`, `stashZoneOf`, the `stash` zone, `distanceToOthersFrom`, `Conversion.from: 'stash'`).
- Produces: `generals/mountain.ts` exporting `cleverChange`, `militaryFarm`, `strategicPass` and `MOUNTAIN_GENERALS: GeneralSkillSet[]` (Tasks 4–6 append entries and skills); `MOUNTAIN_GENERAL_IDS`.

- [ ] **Step 1: Write the failing spec** `generals/mountain-wei.spec.ts`

```ts
import { skillsInPlay } from 'engine';
import { askedAbout, card, handIds, harness, ids, registry, table, TableOptions } from './skills.testing';
import { seatDistance } from '../shared/queries';

const h = harness();
const at = (seatId: string, main: string, deputy = 'filler-jiang-wei', revealed = true): TableOptions['generals'] => ({ [seatId]: [main, deputy, revealed] });
const hand = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => card(`${prefix}${i + 1}`, 'shan', 'heart', i + 1));
const flags = (s: ReturnType<typeof table>) => s.turn.flags ?? {};

describe('Zhang He — Clever Change', () => {
  // seat-d's turn ends; seat-a's Start Phase comes.
  const starting = (cards: Record<string, ReturnType<typeof card>[]> = {}, o: TableOptions = {}) =>
    h.settle(table({ 'seat-a:hand': hand('a', 2), ...cards }, { generals: at('seat-a', 'zhang-he'), owner: 'seat-d', phase: 'End', ...o }));
  // Seat-a's Play Phase begins.
  const playing = (cards: Record<string, ReturnType<typeof card>[]> = {}, o: TableOptions = {}) =>
    h.settle(table({ 'seat-a:hand': hand('a', 2), ...cards }, { generals: at('seat-a', 'zhang-he'), phase: 'Draw', ...o }));

  it('Judgment Phase: asked as the turn starts when a card waits in the Judgment slot; Use discards a hand card and skips it', () => {
    let s = starting({ 'seat-a:judgment': [card('cap', 'capture', 'club')] });
    expect(askedAbout(s)).toBe('clever-change');
    s = h.select(h.use(s), 'a1');
    expect(ids(s, 'discardPile')).toEqual(['a1']);
    expect(flags(s)['skipJudgment']).toBe(true);
  });

  it('Judgment Phase: not asked with an empty Judgment slot or an empty hand', () => {
    expect(askedAbout(starting())).toBeNull();
    expect(askedAbout(starting({ 'seat-a:hand': [], 'seat-a:judgment': [card('cap', 'capture', 'club')] }))).toBeNull();
  });

  it('Draw Phase: skipping it takes 1 hand card from each of up to 2 chosen seats, and draws nothing', () => {
    const drawing = (o: TableOptions = {}) =>
      h.run(table({ 'seat-a:hand': hand('a', 2), 'seat-b:hand': hand('b', 2), 'seat-c:hand': hand('c', 1), drawPile: hand('d', 4) }, { generals: at('seat-a', 'zhang-he'), ...o }), [{ kind: 'DrawPhaseEffect', seatId: 'seat-a', count: 2 }]);
    let s = drawing();
    expect(askedAbout(s)).toBe('clever-change');
    s = h.select(h.use(s), 'a1');
    expect(s.pendingSelection).toMatchObject({ of: 'seats', min: 1, max: 2 });
    expect(s.pendingSelection!.eligibleIds).toEqual(['seat-b', 'seat-c']); // seat-d holds nothing
    s = h.select(s, 'seat-b', 'seat-c');
    expect(handIds(s, 'seat-a')).toHaveLength(3); // 2 − 1 discarded + 2 taken
    expect(handIds(s, 'seat-b')).toHaveLength(1);
    expect(handIds(s, 'seat-c')).toHaveLength(0);
    expect(ids(s, 'drawPile')).toHaveLength(4); // nothing drawn
  });

  it('Draw Phase: Don’t draws as usual; cancelling the payment goes back to the draw', () => {
    const drawing = () => h.run(table({ 'seat-a:hand': hand('a', 2), 'seat-b:hand': hand('b', 2), drawPile: hand('d', 4) }, { generals: at('seat-a', 'zhang-he') }), [{ kind: 'DrawPhaseEffect', seatId: 'seat-a', count: 2 }]);
    expect(handIds(h.decline(drawing()), 'seat-a')).toHaveLength(4);
    expect(handIds(h.cancel(h.use(drawing())), 'seat-a')).toHaveLength(4);
  });

  it('Play Phase: skipping it ends the phase and moves an equipment card to a free slot', () => {
    let s = playing({ 'seat-b:equip': [card('cb', 'crossbow', 'club')] });
    expect(askedAbout(s)).toBe('clever-change');
    s = h.select(h.use(s), 'a1');
    expect(flags(s)['endPlay']).toBe(true);
    s = h.select(s, 'seat-b'); // the seat to move a card from
    expect(s.pendingChoice).toMatchObject({ seatId: 'seat-a' });
    s = h.choose(s, 'cb');
    expect(s.pendingChoice!.options.map((o) => o.id)).toEqual(['seat-a', 'seat-c', 'seat-d']);
    s = h.choose(s, 'seat-c');
    expect(ids(s, 'seat-c:equip')).toEqual(['cb']);
    expect(ids(s, 'seat-b:equip')).toEqual([]);
  });

  it('Play Phase: a slot already filled is not a destination, and a duplicate delayed Tool is not either', () => {
    let s = playing({ 'seat-b:equip': [card('cb', 'crossbow', 'club')], 'seat-c:equip': [card('cc', 'crossbow', 'spade')], 'seat-d:equip': [card('cd', 'crossbow', 'heart')] });
    s = h.choose(h.select(h.select(h.use(s), 'a1'), 'seat-b'), 'cb');
    expect(s.pendingChoice!.options.map((o) => o.id)).toEqual(['seat-a']); // seat-c and seat-d already wear a Weapon
    const j = playing({ 'seat-b:judgment': [card('cap1', 'capture', 'club')], 'seat-c:judgment': [card('cap2', 'capture', 'spade')] });
    const picked = h.choose(h.select(h.select(h.use(j), 'a1'), 'seat-b'), 'cap1');
    expect(picked.pendingChoice!.options.map((o) => o.id)).toEqual(['seat-a', 'seat-d']); // seat-c already holds a Capture
  });

  it('Play Phase: not asked when nothing can be moved', () => {
    expect(askedAbout(playing())).toBeNull();
  });

  it('Discard Phase: asked when cards are owed; Use discards one and skips the phase', () => {
    let s = h.act(table({ 'seat-a:hand': hand('a', 6) }, { generals: at('seat-a', 'zhang-he') }), { kind: 'EndPhaseAction', seatId: 'seat-a' });
    expect(askedAbout(s)).toBe('clever-change');
    s = h.select(h.use(s), 'a1');
    expect(handIds(s, 'seat-a')).toHaveLength(5);
    expect(s.turn.ownerSeatId).toBe('seat-b'); // no discards owed any more: the turn moved on
  });

  it('Discard Phase: not asked with nothing owed', () => {
    const s = h.act(table({ 'seat-a:hand': hand('a', 2) }, { generals: at('seat-a', 'zhang-he') }), { kind: 'EndPhaseAction', seatId: 'seat-a' });
    expect(askedAbout(s)).toBeNull();
  });

  it('each phase is skipped once: the Judgment skip does not run the Draw Phase twice (Review Focus 5)', () => {
    let s = starting({ 'seat-a:judgment': [card('cap', 'capture', 'club')], drawPile: hand('d', 4) });
    s = h.select(h.use(s), 'a1');
    expect(s.log.filter((e) => e.kind === 'PhaseSkippedEvent')).toHaveLength(1);
  });
});

describe('Deng Ai — Military Farm and Strategic Pass', () => {
  // seat-b's turn, so seat-a (Deng Ai) is outside its own turn.
  const outside = (cards: Record<string, ReturnType<typeof card>[]> = {}, o: TableOptions = {}) =>
    table({ 'seat-a:hand': hand('a', 2), drawPile: [card('j1', 'shan', 'spade', 5), card('j2', 'shan', 'heart', 6)], ...cards }, { generals: at('seat-a', 'deng-ai'), owner: 'seat-b', ...o });
  const lose = (s: ReturnType<typeof table>, cardId = 'a1') => h.run(s, [{ kind: 'MoveCardEffect', cardInstanceId: cardId, toZoneId: 'discardPile' }]);

  it('loses a card outside his own turn: may judge; a non-heart becomes a Farm in his stash', () => {
    let s = lose(outside());
    expect(askedAbout(s)).toBe('military-farm');
    s = h.use(s);
    expect(ids(s, 'seat-a:stash')).toEqual(['j1']);
    expect(ids(s, 'discardPile')).toEqual(['a1']);
  });

  it('a heart is discarded instead', () => {
    const s = h.use(lose(outside({ drawPile: [card('j2', 'shan', 'heart', 6)] })));
    expect(ids(s, 'seat-a:stash')).toEqual([]);
    expect(ids(s, 'discardPile')).toContain('j2');
  });

  it('is not asked in his own turn, and Don’t does nothing', () => {
    expect(askedAbout(lose(outside({}, { owner: 'seat-a' })))).toBeNull();
    expect(ids(h.decline(lose(outside())), 'seat-a:stash')).toEqual([]);
  });

  it('a card worn counts too; a card that only moves from hand to the equipment slot does not', () => {
    expect(askedAbout(lose(outside({ 'seat-a:equip': [card('w', 'crossbow', 'club')] }), 'w'))).toBe('military-farm');
    expect(askedAbout(h.run(outside({ 'seat-a:hand': [card('w', 'crossbow', 'club')] }), [{ kind: 'MoveCardEffect', cardInstanceId: 'w', toZoneId: 'seat-a:equip' }]))).toBeNull();
  });

  it('the Farm that is gained does not trigger another judgment (Review Focus 5)', () => {
    const s = h.use(lose(outside()));
    expect(s.pendingChoice).toBeUndefined();
  });

  it('each Farm is a −1 horse for his distance to others, while he is revealed', () => {
    const six = (o: TableOptions = {}, c: Record<string, ReturnType<typeof card>[]> = {}) => table(c, { seats: 6, generals: at('seat-a', 'deng-ai'), ...o });
    const dist = (s: ReturnType<typeof table>) => seatDistance(s, 'seat-a', 'seat-d', registry);
    expect(dist(six())).toBe(3);
    expect(dist(six({}, { 'seat-a:stash': [card('f1', 'shan'), card('f2', 'shan')] }))).toBe(1);
    expect(dist(six({ generals: at('seat-a', 'deng-ai', 'filler-jiang-wei', false) }, { 'seat-a:stash': [card('f1', 'shan'), card('f2', 'shan')] }))).toBe(3);
  });

  it('Strategic Pass: at the start of his turn with 3 Farms he reduces his max HP and awakens, once', () => {
    const farms = [card('f1', 'shan'), card('f2', 'shan'), card('f3', 'shan')];
    let s = h.settle(table({ 'seat-a:stash': farms }, { generals: at('seat-a', 'deng-ai'), owner: 'seat-d', phase: 'End' }));
    expect(s.seats[0].maxCombinedHp).toBe(3);
    expect(s.seats[0].marks?.['awakened:strategic-pass']).toBe(1);
    // Next time round it does not fire again.
    s = h.settle({ ...s, turn: { ...s.turn, ownerSeatId: 'seat-d' }, phase: 'End' });
    expect(s.seats[0].maxCombinedHp).toBe(3);
  });

  it('Strategic Pass: not with 2 Farms', () => {
    const s = h.settle(table({ 'seat-a:stash': [card('f1', 'shan'), card('f2', 'shan')] }, { generals: at('seat-a', 'deng-ai'), owner: 'seat-d', phase: 'End' }));
    expect(s.seats[0].maxCombinedHp).toBe(4);
  });

  it('once awakened a Farm may be used as Steal; before that no', () => {
    const farms = [card('f1', 'shan', 'spade', 3)];
    const base = table({ 'seat-a:stash': farms, 'seat-b:hand': [card('x', 'sha')] }, { generals: at('seat-a', 'deng-ai') });
    expect(h.legal(base, 'seat-a').some((a) => a.kind === 'UseConversionAction' && a.via.conversionId === 'strategic-pass')).toBe(false);
    const awake = { ...base, seats: base.seats.map((x) => (x.id === 'seat-a' ? { ...x, marks: { 'awakened:strategic-pass': 1 } } : x)) };
    let s = h.convert(awake, 'seat-a', 'strategic-pass', 'seat-b');
    s = h.choose(s, 'hand');
    expect(handIds(s, 'seat-a')).toEqual(['x']);
    expect(ids(s, 'seat-a:stash')).toEqual([]);
  });

  it('Strategic Pass is off while Deng Ai is hidden', () => {
    const s = table({ 'seat-a:stash': [card('f1', 'shan'), card('f2', 'shan'), card('f3', 'shan')] }, { generals: at('seat-a', 'deng-ai', 'filler-jiang-wei', false) });
    expect(skillsInPlay(s, 'seat-a', registry).map((x) => x.skill.id)).not.toContain('strategic-pass');
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx jest projects/content/src/lib/generals/mountain-wei.spec.ts`
Expected: FAIL (the Generals have no skills yet).

- [ ] **Step 3: Implement** `generals/mountain.ts`

```ts
import type { CardInstance, CardMovedEvent, CardZone, ContentRegistry, Effect, GameState, GeneralOwner, PhaseChangedEvent, SkillDefinition } from 'engine';
import { cardCountsAs, discardOwed, endFlagOf, requireZoneOfKind, skipFlagOf } from 'engine';
import type { GeneralSkillSet } from './types';
import { handOf } from '../shared/queries';
import { equipSlotOf } from '../cards/equipment';
import { suitOf } from '../shared/suits';
import { awakeningAtTurnStart, isAwakened } from '../shared/awaken';
import { farmCount, stashMove } from '../shared/farm';
import {
  ask, atDrawPhase, choiceOf, discardMoves, handZoneId, isLiving, on, otherLivingSeatIds, seatOptions, selectionOf, skillStep, used,
} from '../shared/skills';

// The Mountain Generals' skills (stage 11 spec, "Rule text"). Every skill acts
// for the `owner` the engine passes in: the same General can sit at two seats
// in tests, so a skill must never find "its" seat by searching for its id.

const picked = (step: { data?: Record<string, unknown> }) => (step.data?.['picked'] as string[] | undefined) ?? [];
const zoneOf = (state: GameState, zoneId: string): CardZone | undefined => state.zones.find((z) => z.id === zoneId);
const cardsIn = (state: GameState, zoneId: string): CardInstance[] => zoneOf(state, zoneId)?.cards ?? [];
const seatOf = (state: GameState, seatId: string) => state.seats.find((s) => s.id === seatId);

// ── Zhang He: Clever Change ─────────────────────────────────────────────────

interface Move { from: string; to: string; cardId: string }

// Every move Clever Change's Play Phase version could make: a worn card to a
// seat whose slot of that kind is empty, or a delayed Tool to a seat not
// already holding one of that name.
function movesOf(state: GameState): Move[] {
  const living = state.seats.filter((s) => !s.eliminated);
  const moves: Move[] = [];
  for (const from of living) {
    const worn = cardsIn(state, from.equipped.zoneId);
    const judgedZone = zoneOf(state, from.judgment.zoneId);
    for (const to of living) {
      if (to.id === from.id) continue;
      const toWorn = cardsIn(state, to.equipped.zoneId);
      for (const c of worn) {
        const slot = equipSlotOf(c.definitionId);
        if (slot && !toWorn.some((w) => equipSlotOf(w.definitionId) === slot)) moves.push({ from: from.id, to: to.id, cardId: c.instanceId });
      }
      const toJudged = zoneOf(state, to.judgment.zoneId);
      for (const c of judgedZone?.cards ?? []) {
        const name = cardCountsAs(judgedZone!, c);
        if (!(toJudged?.cards ?? []).some((d) => cardCountsAs(toJudged!, d) === name)) moves.push({ from: from.id, to: to.id, cardId: c.instanceId });
      }
    }
  }
  return moves;
}

// Selects the hand card Clever Change costs; `phase` rides on to the 'paid' step.
const payFor = (state: GameState, owner: GeneralOwner, phase: string, onCancel: Effect[] = []): Effect =>
  selectionOf(state, owner, {
    of: 'cards',
    eligibleIds: handOf(state, owner.seatId).map((c) => c.instanceId),
    min: 1,
    max: 1,
    then: { kind: 'skill-step', step: skillStep(owner, 'paid', { phase }) },
    onCancel,
  });

const takeableSeats = (state: GameState, seatId: string) => otherLivingSeatIds(state, seatId).filter((id) => handOf(state, id).length > 0);

// Clever Change (may; each of four phases): as the Judgment, Draw, Play or
// Discard Phase begins, discard a hand card to skip it. Skipping Draw takes a
// hand card from each of up to 2 seats; skipping Play moves a worn card or a
// delayed Tool to another seat. Each is offered only when it can matter.
export const cleverChange: SkillDefinition = {
  id: 'clever-change',
  triggers: [
    // Judgment: asked as the turn starts (the Judgment Phase judges on entry).
    on<PhaseChangedEvent>('after:PhaseChangedEvent', {
      condition: (state, event, owner) =>
        event.phase === 'Start' && event.seatId === owner.seatId && cardsIn(state, seatOf(state, owner.seatId)!.judgment.zoneId).length > 0 && handOf(state, owner.seatId).length > 0,
      effect: (state, _event, owner) => [ask(owner, [payFor(state, owner, 'Judgment')])],
    }),
    atDrawPhase({
      condition: (state, draw, owner) => draw.count > 0 && handOf(state, owner.seatId).length > 0 && takeableSeats(state, owner.seatId).length > 0,
      // Cancelling the payment goes back to the draw.
      use: (state, passed, owner) => [payFor(state, owner, 'Draw', [passed])],
    }),
    on<PhaseChangedEvent>('after:PhaseChangedEvent', {
      condition: (state, event, owner) =>
        event.phase === 'Play' && event.seatId === owner.seatId && state.turn.ownerSeatId === owner.seatId && handOf(state, owner.seatId).length > 0 && movesOf(state).length > 0,
      effect: (state, _event, owner) => [ask(owner, [payFor(state, owner, 'Play')])],
    }),
    on<PhaseChangedEvent>('after:PhaseChangedEvent', {
      condition: (state, event, owner) =>
        event.phase === 'Discard' && event.seatId === owner.seatId && state.turn.ownerSeatId === owner.seatId && handOf(state, owner.seatId).length > 0 && discardOwed(state, owner.seatId) > 0,
      effect: (state, _event, owner) => [ask(owner, [payFor(state, owner, 'Discard')])],
    }),
  ],
  onStep: (state, step) => {
    const { owner } = step;
    const phase = step.data?.['phase'] as string;
    if (step.step === 'paid') {
      const discards = discardMoves(state, picked(step));
      switch (phase) {
        case 'Judgment':
          return [...discards, used(owner, 'skipped-judgment'), { kind: 'SetTurnFlagEffect', flag: skipFlagOf('Judgment') }];
        case 'Discard':
          return [...discards, used(owner, 'skipped-discard'), { kind: 'SetTurnFlagEffect', flag: skipFlagOf('Discard') }];
        case 'Draw': {
          const eligible = takeableSeats(state, owner.seatId);
          return [
            ...discards,
            used(owner, 'skipped-draw'),
            ...(eligible.length > 0
              ? [selectionOf(state, owner, { of: 'seats', eligibleIds: eligible, min: 1, max: 2, then: { kind: 'skill-step', step: skillStep(owner, 'draw-take') }, onCancel: [] })]
              : []),
          ];
        }
        default:
          return [...discards, used(owner, 'skipped-play'), { kind: 'SetTurnFlagEffect', flag: endFlagOf('Play') }, skillStep(owner, 'move-from')];
      }
    }
    if (step.step === 'draw-take') {
      return picked(step)
        .filter((id) => isLiving(state, id) && handOf(state, id).length > 0)
        .flatMap((id): Effect[] => [used(owner, 'took-hand-card', id), { kind: 'MoveRandomCardEffect', fromZoneId: handZoneId(state, id), toZoneId: handZoneId(state, owner.seatId) }]);
    }
    const moves = movesOf(state);
    if (step.step === 'move-from') {
      const from = [...new Set(moves.map((m) => m.from))];
      return from.length === 0 ? [] : [selectionOf(state, owner, { of: 'seats', eligibleIds: from, min: 1, max: 1, then: { kind: 'skill-step', step: skillStep(owner, 'move-card') }, onCancel: [] })];
    }
    if (step.step === 'move-card') {
      const from = picked(step)[0];
      const seat = seatOf(state, from);
      if (!seat) return [];
      const cards = [...cardsIn(state, seat.equipped.zoneId), ...cardsIn(state, seat.judgment.zoneId)];
      const options = [...new Set(moves.filter((m) => m.from === from).map((m) => m.cardId))].flatMap((cardId) => {
        const card = cards.find((c) => c.instanceId === cardId);
        return card ? [{ id: cardId, shows: { kind: 'card' as const, card }, effects: [skillStep(owner, 'move-to', { from, cardId })] }] : [];
      });
      return options.length === 0 ? [] : [choiceOf(state, owner, { verb: 'pick', targetSeatId: from, options })];
    }
    if (step.step === 'move-to') {
      const from = step.data?.['from'] as string;
      const cardId = step.data?.['cardId'] as string;
      const source = seatOf(state, from);
      const judgedZone = source && zoneOf(state, source.judgment.zoneId);
      const card = judgedZone?.cards.find((c) => c.instanceId === cardId);
      const targets = [...new Set(moves.filter((m) => m.from === from && m.cardId === cardId).map((m) => m.to))];
      if (targets.length === 0) return [];
      return [
        choiceOf(state, owner, {
          verb: 'pick',
          targetSeatId: from,
          options: seatOptions(targets, (to): Effect[] => {
            const dest = seatOf(state, to)!;
            const as = card ? cardCountsAs(judgedZone!, card) : undefined;
            return [
              used(owner, 'moved-card', to, cardId),
              { kind: 'MoveCardEffect', cardInstanceId: cardId, toZoneId: card ? dest.judgment.zoneId : dest.equipped.zoneId, ...(card && as !== card.definitionId ? { countsAs: as } : {}) },
            ];
          }),
        }),
      ];
    }
    return [];
  },
};

// ── Deng Ai: Military Farm, Strategic Pass ─────────────────────────────────

// Military Farm (may): when you lose a card from hand or equipment outside your
// own turn, you may judge. A card that is not a heart becomes a Farm in your
// stash. Each Farm is a −1 horse for your distance to others.
export const militaryFarm: SkillDefinition = {
  id: 'military-farm',
  modifiers: { distanceToOthersFrom: (state, seatId) => -farmCount(state, seatId) },
  triggers: [
    on<CardMovedEvent>('after:CardMovedEvent', {
      condition: (state, event, owner) => {
        const seat = seatOf(state, owner.seatId);
        if (!seat?.stash || seat.eliminated || state.turn.ownerSeatId === owner.seatId) return false;
        const own = [seat.hand.zoneId, seat.equipped.zoneId];
        return own.includes(event.fromZoneId) && !own.includes(event.toZoneId);
      },
      effect: (_state, _event, owner) => [ask(owner, [{ kind: 'JudgeEffect', seatId: owner.seatId, reader: { kind: 'skill', owner } }])],
    }),
  ],
  // A heart is discarded as usual; any other card goes to the stash first.
  onJudged: (state, { owner, judged, done }, registry) => {
    if (!isLiving(state, owner.seatId) || suitOf(state, owner.seatId, judged, registry) === 'heart') return [done];
    return [stashMove(state, owner.seatId, judged.instanceId, requireZoneOfKind(state.zones, 'processing').id), used(owner, 'farmed'), done];
  },
};

// Strategic Pass (awakening): at the start of your turn with 3 or more Farms,
// reduce your max HP by 1 and awaken: from then on a Farm may be used as Steal.
export const strategicPass: SkillDefinition = {
  id: 'strategic-pass',
  compulsory: true,
  awakening: true,
  triggers: [
    awakeningAtTurnStart({
      skillId: 'strategic-pass',
      condition: (state, owner) => farmCount(state, owner.seatId) >= 3,
      effects: (_state, owner) => [{ kind: 'ReduceMaxHpEffect', seatId: owner.seatId, amount: 1 }],
    }),
  ],
  conversions: [{ id: 'strategic-pass', as: 'steal', cards: 1, from: 'stash', when: 'play', accepts: (_card, state, seatId) => isAwakened(state, seatId, 'strategic-pass') }],
};

export const MOUNTAIN_GENERALS: GeneralSkillSet[] = [
  { id: 'zhang-he', skills: [cleverChange] },
  { id: 'deng-ai', skills: [militaryFarm, strategicPass] },
];
```

Unused imports (`ContentRegistry`, `choiceOf` used, `GeneralOwner` used) must be trimmed so the file compiles cleanly: keep only what the code above uses; Tasks 4–6 add theirs.

Register the Generals in `generals/index.ts`: import `MOUNTAIN_GENERALS` from `./mountain`, spread it into `HAND_CODED`, and add
```ts
// The 8 Mountain Generals (stage 11).
export const MOUNTAIN_GENERAL_IDS: readonly string[] = ['zhang-he', 'deng-ai', 'liu-shan', 'jiang-wei', 'sun-ce', 'zhang-zhao-and-zhang-hong', 'cai-wenji', 'zuo-ci'];
```
and export it from `public-api.ts` beside the other pack ids. Until Tasks 4–6 land, `HAND_CODED` holds only two Mountain entries; `MOUNTAIN_GENERAL_IDS` lists all eight.

- [ ] **Step 4: Fix the specs that used Deng Ai or Zhang He as skill-less Generals**

`generals/base.spec.ts` and `registry.spec.ts` use them in their "vanilla General has no skills" checks (Stage 10 put them there). After this stage every General of the four packs has skills; make each check use a synthetic skill-less General (`filler-<id>`, which `withFillers` registers, or a General built in the spec) instead, and update any "which Generals are skilled" expectation to include Zhang He and Deng Ai. Run those two specs and adapt minimally; ledger it as a ruling.

- [ ] **Step 5: Run**

Run: `npx jest projects/content/src/lib/generals/mountain-wei.spec.ts projects/content/src/lib/generals/base.spec.ts projects/content/src/lib/registry.spec.ts`
Expected: PASS. Where a step of the spec disagrees with how the engine really runs (an ask order, a flag name), find the cause; if the plan is wrong, rule and ledger the smallest fix.

- [ ] **Step 6: Commit**

```bash
git add projects/content
git commit -m "feat(content): Zhang He's Clever Change and Deng Ai's Military Farm and Strategic Pass

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Task 4: Shu — Liu Shan and Jiang Wei

**Files:**
- Modify: `projects/content/src/lib/generals/mountain.ts`
- Create: `projects/content/src/lib/generals/mountain-shu.spec.ts`

**Interfaces:**
- Consumes: Tasks 1–3; `atStep`/`actedOn` from `shared/steps.ts`; `shaAt` from `cards/sha.ts`; `seatCardOptions` from `shared/choices.ts`; `seatDistance`, `attackRange` from `shared/queries.ts`; `untargetableBy` from `shared/abilities.ts`.
- Produces: `pleasure`, `decentralization`, `seemFoolish`, `instigate`, `followTheMaster`; entries `liu-shan`, `jiang-wei` in `MOUNTAIN_GENERALS`.

- [ ] **Step 1: Write the failing spec** `generals/mountain-shu.spec.ts`

```ts
import { skillsInPlay } from 'engine';
import { askedAbout, card, handIds, harness, hp, ids, registry, table, TableOptions } from './skills.testing';

const h = harness();
const at = (seatId: string, main: string, deputy = 'filler-xu-huang', revealed = true): TableOptions['generals'] => ({ [seatId]: [main, deputy, revealed] });
const hand = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => card(`${prefix}${i + 1}`, 'shan', 'heart', i + 1));
const inPlay = (s: ReturnType<typeof table>, seatId: string) => skillsInPlay(s, seatId, registry).map((x) => x.skill.id);

describe('Liu Shan — Pleasure', () => {
  const sha = (o: TableOptions = {}, extra: Record<string, ReturnType<typeof card>[]> = {}) =>
    table({ 'seat-a:hand': [card('s1', 'sha', 'spade'), card('k1', 'shan', 'heart', 2), card('t1', 'draw-two', 'club')], ...extra }, { generals: at('seat-b', 'liu-shan'), ...o });

  it('a Sha used on him costs its user another Basic hand card; paying lets the Sha go on', () => {
    let s = h.play(sha(), 's1', 'seat-b');
    expect(s.pendingSelection).toMatchObject({ seatId: 'seat-a', of: 'cards', eligibleIds: ['k1'], min: 1, max: 1 });
    s = h.select(s, 'k1');
    expect(ids(s, 'discardPile')).toContain('k1');
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-b' }); // the Shan window
  });

  it('cancelling the payment means the Sha has no effect', () => {
    const s = h.cancel(h.play(sha(), 's1', 'seat-b'));
    expect(s.pendingResponse).toBeNull();
    expect(hp(s, 'seat-b')).toBe(4);
    expect(s.log.some((e) => e.kind === 'AbilityUsedEvent' && e.outcome === 'no-effect')).toBe(true);
  });

  it('with no other Basic card the Sha has no effect at once; the Sha card itself does not count', () => {
    const s = h.play(sha({}, { 'seat-a:hand': [card('s1', 'sha', 'spade'), card('t1', 'draw-two', 'club')] }), 's1', 'seat-b');
    expect(s.pendingSelection).toBeUndefined();
    expect(s.pendingResponse).toBeNull();
    expect(hp(s, 'seat-b')).toBe(4);
  });

  it('does not touch a Sha at another seat, or a Sha used by Liu Shan', () => {
    expect(h.play(sha(), 's1', 'seat-d').pendingSelection).toBeUndefined();
  });

  it('is off while Liu Shan is hidden', () => {
    expect(h.play(sha({ generals: at('seat-b', 'liu-shan', 'filler-xu-huang', false) }), 's1', 'seat-b').pendingSelection).toBeUndefined();
  });
});

describe('Liu Shan — Decentralization', () => {
  const setup = (cards: Record<string, ReturnType<typeof card>[]> = {}, o: TableOptions = {}) =>
    table({ 'seat-a:hand': hand('a', 3), ...cards }, { generals: at('seat-a', 'liu-shan'), phase: 'Draw', ...o });
  const entering = (cards: Record<string, ReturnType<typeof card>[]> = {}, o: TableOptions = {}) => h.settle(setup(cards, o));

  it('may skip his Play Phase; at the end of his turn he discards a hand card and gives another seat an extra turn', () => {
    let s = entering();
    expect(askedAbout(s)).toBe('decentralization');
    s = h.use(s); // Play ends; Discard and End follow
    expect(s.pendingSelection).toMatchObject({ seatId: 'seat-a', of: 'cards', min: 1, max: 1 });
    s = h.select(s, 'a1');
    expect(s.pendingChoice!.options.map((o) => o.id)).toEqual(['seat-b', 'seat-c', 'seat-d']);
    s = h.choose(s, 'seat-c');
    expect(s.turn.ownerSeatId).toBe('seat-c');
    expect(s.turn.resumeAfterSeatId).toBe('seat-a');
    expect(handIds(s, 'seat-a')).toEqual(['a2', 'a3']);
  });

  it('after the extra turn the order resumes after Liu Shan, not after the extra seat (Review Focus 4)', () => {
    let s = h.choose(h.select(h.use(entering()), 'a1'), 'seat-c');
    expect(s.turn.ownerSeatId).toBe('seat-c');
    s = h.act(s, { kind: 'EndPhaseAction', seatId: 'seat-c' });
    expect(s.turn.ownerSeatId).toBe('seat-b');
  });

  it('a face-down extra seat turns up and passes its turn; the order still resumes after Liu Shan', () => {
    const t = setup();
    const down = { ...t, seats: t.seats.map((x) => (x.id === 'seat-c' ? { ...x, faceDown: true as const } : x)) };
    const s = h.choose(h.select(h.use(h.settle(down)), 'a1'), 'seat-c');
    expect(s.turn.ownerSeatId).toBe('seat-b');
    expect(s.seats.find((x) => x.id === 'seat-c')!.faceDown).toBeUndefined();
  });

  it('with no hand cards he discards nothing but still gives the extra turn', () => {
    let s = h.use(entering({ 'seat-a:hand': [] }));
    expect(s.pendingSelection).toBeUndefined();
    expect(s.pendingChoice).toBeDefined();
    s = h.choose(s, 'seat-b');
    expect(s.turn.ownerSeatId).toBe('seat-b');
  });

  it('Don’t keeps his Play Phase, and nothing happens at his turn end', () => {
    const s = h.decline(entering());
    expect(s.phase).toBe('Play');
    expect(s.turn.flags?.['decentralization']).toBeUndefined();
  });
});

describe('Liu Shan — Seem Foolish', () => {
  it('is a Lord skill, so it is never in play', () => {
    expect(inPlay(table({}, { generals: at('seat-a', 'liu-shan') }), 'seat-a')).not.toContain('seem-foolish');
  });
});

describe('Jiang Wei — Instigate', () => {
  const play = (cards: Record<string, ReturnType<typeof card>[]> = {}, o: TableOptions = {}) =>
    table({ 'seat-a:hand': hand('a', 1), 'seat-b:hand': [card('bs', 'sha', 'spade'), card('bx', 'shan', 'heart', 3)], ...cards }, { generals: at('seat-a', 'jiang-wei'), ...o });

  it('picks a seat with him in its Sha range; it must Sha him', () => {
    let s = h.useSkill(play(), 'seat-a', 'instigate');
    expect(s.pendingSelection).toMatchObject({ of: 'seats', eligibleIds: ['seat-b', 'seat-d'], min: 1, max: 1 });
    s = h.select(s, 'seat-b');
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-b', allowedCardIds: ['sha'] });
    s = h.respond(s, 'bs');
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-a' }); // Jiang Wei's Shan window
  });

  it('if it does not, Jiang Wei discards one of its cards', () => {
    let s = h.pass(h.select(h.useSkill(play({ 'seat-b:equip': [card('w', 'crossbow', 'club')] }), 'seat-a', 'instigate'), 'seat-b'));
    expect(s.pendingChoice).toMatchObject({ seatId: 'seat-a', verb: 'discard' });
    expect(s.pendingChoice!.options.map((o) => o.id)).toEqual(['hand', 'w']);
    s = h.choose(s, 'w');
    expect(ids(s, 'discardPile')).toEqual(['w']);
  });

  it('once per turn, and not offered when no seat has him in range', () => {
    const s = h.pass(h.select(h.useSkill(play(), 'seat-a', 'instigate'), 'seat-b'));
    const done = h.choose(s, 'hand');
    expect(h.legal(done, 'seat-a').some((a) => a.kind === 'UseSkillAction' && a.owner.kind === 'general' && a.owner.skillId === 'instigate')).toBe(false);
    const far = table({}, { generals: at('seat-a', 'jiang-wei'), seats: 6, kingdoms: {} });
    // seat-d is 3 away from seat-a in a 6-seat ring: only its neighbours (seat-b, seat-f) have him in range 1.
    expect(h.useSkill(far, 'seat-a', 'instigate').pendingSelection!.eligibleIds).toEqual(['seat-b', 'seat-f']);
  });
});

describe('Jiang Wei — Follow the Master', () => {
  const turnStart = (o: TableOptions = {}) =>
    h.settle(table({ 'seat-a:hand': [], drawPile: hand('d', 4) }, { generals: at('seat-a', 'jiang-wei'), owner: 'seat-d', phase: 'End', hp: { 'seat-a': 3 }, ...o }));

  it('at the start of his turn with no hand: recover 1 HP or draw 2, then max HP −1 and Astrology is gained', () => {
    let s = turnStart();
    expect(s.pendingChoice!.options.map((o) => o.id)).toEqual(['recover', 'draw']);
    s = h.choose(s, 'recover');
    expect(s.seats[0]).toMatchObject({ combinedHp: 3, maxCombinedHp: 3 });
    expect(inPlay(s, 'seat-a')).toContain('astrology');
    expect(s.seats[0].marks?.['awakened:follow-the-master']).toBe(1);
  });

  it('the draw option draws 2', () => {
    const s = h.choose(turnStart(), 'draw');
    expect(handIds(s, 'seat-a')).toHaveLength(2);
  });

  it('at full HP only the draw is offered, and with a hand he does not awaken', () => {
    expect(turnStart({ hp: { 'seat-a': 4 } }).pendingChoice).toBeUndefined();
    expect(handIds(turnStart({ hp: { 'seat-a': 4 } }), 'seat-a')).toHaveLength(2);
    const held = h.settle(table({ 'seat-a:hand': hand('a', 1) }, { generals: at('seat-a', 'jiang-wei'), owner: 'seat-d', phase: 'End' }));
    expect(held.seats[0].maxCombinedHp).toBe(4);
  });

  it('awakens once: the next turn with an empty hand does nothing', () => {
    let s = h.choose(turnStart(), 'draw');
    s = h.settle({ ...s, seats: s.seats.map((x) => (x.id === 'seat-a' ? { ...x, maxCombinedHp: 3 } : x)), zones: s.zones.map((z) => (z.id === 'seat-a:hand' ? { ...z, cards: [] } : z)), turn: { ...s.turn, ownerSeatId: 'seat-d' }, phase: 'End' });
    expect(s.pendingChoice).toBeUndefined();
    expect(s.seats[0].maxCombinedHp).toBe(3);
  });

  it('is off while Jiang Wei is hidden', () => {
    expect(turnStart({ generals: at('seat-a', 'jiang-wei', 'filler-xu-huang', false) }).seats[0].maxCombinedHp).toBe(4);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx jest projects/content/src/lib/generals/mountain-shu.spec.ts`
Expected: FAIL (no skills yet).

- [ ] **Step 3: Implement** — append to `generals/mountain.ts` (add the imports it needs: `atStep, actedOn` and the type `CardStep` from `../shared/steps`, `shaAt` from `../cards/sha`, `seatCardOptions` from `../shared/choices`, `attackRange, seatDistance` from `../shared/queries`, `untargetableBy` from `../shared/abilities`, `draw, heal` from `../shared/skills`, `requireZoneOfKind` already imported)

```ts
// ── Liu Shan ───────────────────────────────────────────────────────────────

const isBasic = (card: CardInstance, registry: ContentRegistry) => registry.cards.get(card.definitionId)?.category === 'basic';

// Pleasure (compulsory): a Sha used on you costs its user another Basic hand
// card, or it has no effect on you. The user may refuse (Cancel): the same.
export const pleasure: SkillDefinition = {
  id: 'pleasure',
  compulsory: true,
  triggers: [
    atStep(['sha-targeted'], {
      condition: (_state, step, owner) => step.card.as === 'sha' && step.target.seatId === owner.seatId && step.userSeatId !== owner.seatId,
      effect: (state, step, owner, registry) => {
        const basics = handOf(state, step.userSeatId).filter((c) => isBasic(c, registry));
        const noEffect = used(owner as GeneralOwner, 'no-effect', step.userSeatId);
        if (basics.length === 0) return [noEffect];
        return [
          selectionOf(state, owner as GeneralOwner, {
            of: 'cards',
            eligibleIds: basics.map((c) => c.instanceId),
            min: 1,
            max: 1,
            seatId: step.userSeatId,
            then: { kind: 'skill-step', step: skillStep(owner as GeneralOwner, 'paid', { sha: actedOn(step, owner) }) },
            onCancel: [noEffect],
          }),
        ];
      },
    }),
  ],
  // Paid: the card is discarded and the Sha goes on, marked so it is not charged again.
  onStep: (state, step) => {
    const sha = step.data?.['sha'] as CardStep;
    return [...discardMoves(state, picked(step)), used(step.owner, 'paid', sha.userSeatId), sha];
  },
};

// Decentralization (may): skip your Play Phase. At the end of your turn
// discard a hand card (if you hold one), then another living seat takes an
// extra turn; the order resumes after you.
export const decentralization: SkillDefinition = {
  id: 'decentralization',
  triggers: [
    on<PhaseChangedEvent>('after:PhaseChangedEvent', {
      condition: (state, event, owner) => event.phase === 'Play' && event.seatId === owner.seatId && state.turn.ownerSeatId === owner.seatId && otherLivingSeatIds(state, owner.seatId).length > 0,
      effect: (_state, _event, owner) => [ask(owner, [{ kind: 'SetTurnFlagEffect', flag: 'decentralization' }, { kind: 'SetTurnFlagEffect', flag: endFlagOf('Play') }])],
    }),
    on<PhaseChangedEvent>('after:PhaseChangedEvent', {
      condition: (state, event, owner) =>
        event.phase === 'End' && event.seatId === owner.seatId && state.turn.ownerSeatId === owner.seatId && !!state.turn.flags?.['decentralization'] && otherLivingSeatIds(state, owner.seatId).length > 0,
      effect: (state, _event, owner) => {
        const cards = handOf(state, owner.seatId);
        return cards.length === 0
          ? [skillStep(owner, 'pick')]
          : [selectionOf(state, owner, { of: 'cards', eligibleIds: cards.map((c) => c.instanceId), min: 1, max: 1, then: { kind: 'skill-step', step: skillStep(owner, 'discarded') } })];
      },
    }),
  ],
  onStep: (state, step) => {
    const { owner } = step;
    if (step.step === 'discarded') return [...discardMoves(state, picked(step)), skillStep(owner, 'pick')];
    // 'pick': another living seat takes the extra turn.
    const others = otherLivingSeatIds(state, owner.seatId);
    return others.length === 0
      ? []
      : [choiceOf(state, owner, { verb: 'pick', options: seatOptions(others, (id) => [used(owner, 'extra-turn', id), { kind: 'GrantExtraTurnEffect', seatId: id, resumeAfterSeatId: owner.seatId }]) })];
  },
};

// Seem Foolish: a Lord skill, inactive in Kingdom War.
export const seemFoolish: SkillDefinition = { id: 'seem-foolish', lord: true };

// ── Jiang Wei ──────────────────────────────────────────────────────────────

// Seats with `seatId` in their Sha range (a Sha may target him).
const instigateTargets = (state: GameState, seatId: string, registry: ContentRegistry) =>
  otherLivingSeatIds(state, seatId).filter(
    (id) => seatDistance(state, id, seatId, registry) <= attackRange(state, id, registry) && !untargetableBy(state, seatId, 'sha', registry)
  );

// Instigate (active, once per turn): a seat with you in its Sha range must use a
// Sha on you (a window, as Upheaval's); if it does not, you discard one of its
// cards.
export const instigate: SkillDefinition = {
  id: 'instigate',
  active: {
    usesPerTurn: 1,
    canUse: (state, { seatId }, registry) => isLiving(state, seatId) && instigateTargets(state, seatId, registry).length > 0,
    start: (state, { seatId, owner }, registry) => [
      selectionOf(state, owner, {
        of: 'seats',
        eligibleIds: instigateTargets(state, seatId, registry),
        min: 1,
        max: 1,
        then: { kind: 'skill-step', step: skillStep(owner, 'ask') },
        onCancel: [],
      }),
    ],
  },
  onStep: (state, step) => {
    const { owner } = step;
    const target = step.data?.['seatId'] ?? picked(step)[0];
    if (step.step === 'ask') {
      if (typeof target !== 'string' || !isLiving(state, target) || !isLiving(state, owner.seatId)) return [];
      return [
        {
          kind: 'OpenResponseEffect',
          pendingResponse: {
            id: `instigate-${target}-${state.log.length}`,
            respondingSeatId: target,
            allowedActionKinds: ['RespondAction', 'PassAction'],
            allowedCardIds: ['sha'],
            reason: { kind: 'ability', owner, abilityId: owner.skillId, targetSeatId: owner.seatId },
            // No Sha: its user's card is discarded by Jiang Wei.
            context: { effect: skillStep(owner, 'penalty', { seatId: target }) },
            sourceSkill: { owner, step: 'sha', data: { seatId: target } },
          },
        },
      ];
    }
    if (step.step === 'penalty') {
      if (typeof target !== 'string' || !isLiving(state, target) || !isLiving(state, owner.seatId)) return [];
      const options = seatCardOptions(state, target, requireZoneOfKind(state.zones, 'discardPile').id, { judgment: false });
      return options.length === 0 ? [] : [choiceOf(state, owner, { verb: 'discard', targetSeatId: target, options })];
    }
    // 'sha': it answered with a Sha (a real card or a conversion's).
    const answeredBy = step.data?.['answeredBy'] as string;
    const sha = step.data?.['answeredCard'] as UsedCard;
    return isLiving(state, answeredBy) && isLiving(state, owner.seatId) ? shaAt(state, sha, answeredBy, [{ kind: 'seat', seatId: owner.seatId }]) : [];
  },
};

// Follow the Master (awakening): at the start of your turn with no hand cards,
// recover 1 HP (only if hurt) or draw 2, then reduce your max HP by 1 and gain
// Astrology.
export const followTheMaster: SkillDefinition = {
  id: 'follow-the-master',
  compulsory: true,
  awakening: true,
  triggers: [
    awakeningAtTurnStart({
      skillId: 'follow-the-master',
      condition: (state, owner) => handOf(state, owner.seatId).length === 0,
      effects: (state, owner) => {
        const after: Effect[] = [
          { kind: 'ReduceMaxHpEffect', seatId: owner.seatId, amount: 1 },
          { kind: 'GainSkillEffect', seatId: owner.seatId, slot: owner.slot, skillId: 'astrology' },
        ];
        const hurt = isHurt(state, owner.seatId);
        return hurt
          ? [choiceOf(state, owner, { verb: 'pick', options: [
              { id: 'recover', shows: { kind: 'label', text: 'Recover 1 HP' }, effects: [heal(owner.seatId, 1), ...after] },
              { id: 'draw', shows: { kind: 'label', text: 'Draw 2 Cards' }, effects: [draw(owner.seatId, 2), ...after] },
            ] })]
          : [draw(owner.seatId, 2), ...after];
      },
    }),
  ],
};
```

Add to `MOUNTAIN_GENERALS`: `{ id: 'liu-shan', skills: [pleasure, decentralization, seemFoolish] }`, `{ id: 'jiang-wei', skills: [instigate, followTheMaster] }`. Add `UsedCard`, `isHurt` to the imports. Instigate reads `target` from `step.data.seatId` for 'penalty'/'sha' and from `picked` for 'ask' (the selection continuation adds `picked`); the code above handles both through `target`.

- [ ] **Step 4: Run**

Run: `npx jest projects/content/src/lib/generals`
Expected: PASS. Typical adaptations to expect and ledger: the `use` helper's name for the Play Phase skip, the Instigate window's `sourceSkill` data key, a log outcome string.

- [ ] **Step 5: Commit**

```bash
git add projects/content
git commit -m "feat(content): Liu Shan's Pleasure and Decentralization, Jiang Wei's Instigate and Follow the Master

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Task 5: Wu — Sun Ce and Zhang Zhao and Zhang Hong

**Files:**
- Modify: `projects/content/src/lib/generals/mountain.ts`
- Create: `projects/content/src/lib/generals/mountain-wu.spec.ts`

**Interfaces:**
- Consumes: Tasks 1–4; `braveGesture`, `braveSpirit` are gained by id (`'brave-gesture'`, `'brave-spirit'`), found through `findSkill`.
- Produces: `passion`, `soulPosition`, `takeover`, `directInstruction`, `stubborn`; entries `sun-ce`, `zhang-zhao-and-zhang-hong`.

- [ ] **Step 1: Write the failing spec** `generals/mountain-wu.spec.ts`

```ts
import { skillsInPlay } from 'engine';
import { askedAbout, card, handIds, harness, ids, registry, table, TableOptions } from './skills.testing';

const h = harness();
const at = (seatId: string, main: string, deputy = 'filler-xu-huang', revealed = true): TableOptions['generals'] => ({ [seatId]: [main, deputy, revealed] });
const inPlay = (s: ReturnType<typeof table>, seatId: string) => skillsInPlay(s, seatId, registry).map((x) => x.skill.id);
const draws = Array.from({ length: 4 }, (_, i) => card(`d${i + 1}`, 'shan', 'heart', i + 1));

describe('Sun Ce — Passion', () => {
  const sha = (suit: 'heart' | 'spade', o: TableOptions = {}) =>
    table({ 'seat-a:hand': [card('s1', 'sha', suit)], drawPile: draws }, { generals: at('seat-b', 'sun-ce'), ...o });

  it('being targeted by a red Sha draws 1 card', () => {
    const s = h.play(sha('heart'), 's1', 'seat-b');
    expect(handIds(s, 'seat-b')).toEqual(['d1']);
  });

  it('a black Sha draws nothing', () => {
    expect(handIds(h.play(sha('spade'), 's1', 'seat-b'), 'seat-b')).toEqual([]);
  });

  it('using a red Sha draws 1 card for Sun Ce, once per target', () => {
    const s = h.play(table({ 'seat-b:hand': [card('s1', 'sha', 'heart')], drawPile: draws }, { generals: at('seat-b', 'sun-ce'), owner: 'seat-b' }), 's1', 'seat-c');
    expect(handIds(s, 'seat-b')).toEqual(['d1']);
  });

  it('a Duel used on him, or by him, draws 1 card', () => {
    const on = h.play(table({ 'seat-a:hand': [card('du', 'duel', 'spade')], drawPile: draws }, { generals: at('seat-b', 'sun-ce') }), 'du', 'seat-b');
    expect(handIds(on, 'seat-b')).toContain('d1');
    const by = h.play(table({ 'seat-b:hand': [card('du', 'duel', 'spade')], drawPile: draws }, { generals: at('seat-b', 'sun-ce'), owner: 'seat-b' }), 'du', 'seat-a');
    expect(handIds(by, 'seat-b')).toContain('d1');
  });

  it('is off while he is hidden', () => {
    expect(handIds(h.play(sha('heart', { generals: at('seat-b', 'sun-ce', 'filler-xu-huang', false) }), 's1', 'seat-b'), 'seat-b')).toEqual([]);
  });
});

describe('Sun Ce — Soul Position', () => {
  const start = (hp: number) => h.settle(table({}, { generals: at('seat-a', 'sun-ce'), owner: 'seat-d', phase: 'End', hp: { 'seat-a': hp } }));

  it('at the start of his turn with exactly 1 HP: max HP −1, Brave Gesture and Brave Spirit gained', () => {
    const s = start(1);
    expect(s.seats[0]).toMatchObject({ maxCombinedHp: 3, combinedHp: 1 });
    expect(inPlay(s, 'seat-a')).toEqual(expect.arrayContaining(['brave-gesture', 'brave-spirit']));
    expect(s.seats[0].marks?.['awakened:soul-position']).toBe(1);
  });

  it('not at 2 HP', () => {
    const s = start(2);
    expect(s.seats[0].maxCombinedHp).toBe(4);
    expect(inPlay(s, 'seat-a')).not.toContain('brave-gesture');
  });

  it('the gained Brave Gesture is offered at his next Draw Phase', () => {
    const s = h.run(start(1), [{ kind: 'DrawPhaseEffect', seatId: 'seat-a', count: 2 }]);
    expect(askedAbout(s)).toBe('brave-gesture');
  });
});

describe('Sun Ce — Takeover', () => {
  it('is a Lord skill, so it is never in play', () => {
    expect(inPlay(table({}, { generals: at('seat-a', 'sun-ce') }), 'seat-a')).not.toContain('takeover');
  });
});

describe('Zhang Zhao and Zhang Hong — Direct Instruction', () => {
  const play = (cards: Record<string, ReturnType<typeof card>[]> = {}) =>
    table({ 'seat-a:hand': [card('cb', 'crossbow', 'club'), card('x1', 'shan', 'heart', 2)], drawPile: draws, ...cards }, { generals: at('seat-a', 'zhang-zhao-and-zhang-hong') });

  it('places an equipment card from hand in another seat’s empty slot and draws 1', () => {
    let s = h.useSkill(play(), 'seat-a', 'direct-instruction');
    expect(s.pendingSelection).toMatchObject({ of: 'cards', eligibleIds: ['cb'], min: 1, max: 1 });
    s = h.select(s, 'cb');
    expect(s.pendingChoice!.options.map((o) => o.id)).toEqual(['seat-b', 'seat-c', 'seat-d']);
    s = h.choose(s, 'seat-c');
    expect(ids(s, 'seat-c:equip')).toEqual(['cb']);
    expect(handIds(s, 'seat-a')).toEqual(['x1', 'd1']);
  });

  it('a seat with that slot filled is not offered, and with none free the skill is not offered', () => {
    const s = h.select(h.useSkill(play({ 'seat-b:equip': [card('wb', 'crossbow', 'spade')] }), 'seat-a', 'direct-instruction'), 'cb');
    expect(s.pendingChoice!.options.map((o) => o.id)).toEqual(['seat-c', 'seat-d']);
    const blocked = play({ 'seat-b:equip': [card('w1', 'crossbow')], 'seat-c:equip': [card('w2', 'crossbow')], 'seat-d:equip': [card('w3', 'crossbow')] });
    expect(h.legal(blocked, 'seat-a').some((a) => a.kind === 'UseSkillAction')).toBe(false);
  });

  it('may be used any number of times in a turn', () => {
    let s = h.choose(h.select(h.useSkill(play({ 'seat-a:hand': [card('cb', 'crossbow', 'club'), card('wc', 'black-pommel', 'spade')] }), 'seat-a', 'direct-instruction'), 'cb'), 'seat-b');
    expect(h.legal(s, 'seat-a').some((a) => a.kind === 'UseSkillAction')).toBe(true);
  });

  it('cancelling the card pick does not count as a use', () => {
    const s = h.cancel(h.useSkill(play(), 'seat-a', 'direct-instruction'));
    expect(h.legal(s, 'seat-a').some((a) => a.kind === 'UseSkillAction')).toBe(true);
  });
});

describe('Zhang Zhao and Zhang Hong — Stubborn', () => {
  // seat-b's Discard Phase: it holds 6 cards at 4 HP and discards 2.
  const discarding = (extra: Record<string, ReturnType<typeof card>[]> = {}) => {
    const six = Array.from({ length: 6 }, (_, i) => card(`k${i + 1}`, 'shan', 'heart', i + 1));
    return h.act(table({ 'seat-b:hand': six, ...extra }, { generals: at('seat-a', 'zhang-zhao-and-zhang-hong'), owner: 'seat-b' }), { kind: 'EndPhaseAction', seatId: 'seat-b' });
  };
  const discard = (s: ReturnType<typeof table>, ...cardIds: string[]) => cardIds.reduce((acc, id) => h.act(acc, { kind: 'DiscardCardAction', seatId: 'seat-b', cardInstanceId: id }), s);

  it('at the end of another seat’s Discard Phase with 2 or more discarded, he may give one back and take the rest', () => {
    let s = discard(discarding(), 'k1', 'k2');
    expect(askedAbout(s)).toBe('stubborn');
    s = h.use(s);
    expect(s.pendingChoice!.options.map((o) => o.id)).toEqual(['k1', 'k2']);
    s = h.choose(s, 'k1');
    expect(handIds(s, 'seat-b')).toContain('k1');
    expect(handIds(s, 'seat-a')).toEqual(['k2']);
  });

  it('with 3 discarded he takes the other two', () => {
    const six = Array.from({ length: 7 }, (_, i) => card(`k${i + 1}`, 'shan', 'heart', i + 1));
    let s = h.act(table({ 'seat-b:hand': six }, { generals: at('seat-a', 'zhang-zhao-and-zhang-hong'), owner: 'seat-b' }), { kind: 'EndPhaseAction', seatId: 'seat-b' });
    s = h.choose(h.use(discard(s, 'k1', 'k2', 'k3')), 'k2');
    expect(handIds(s, 'seat-a')).toEqual(['k1', 'k3']);
  });

  it('not asked with 1 card discarded, or in his own Discard Phase', () => {
    const five = Array.from({ length: 5 }, (_, i) => card(`k${i + 1}`, 'shan', 'heart', i + 1));
    const one = h.act(table({ 'seat-b:hand': five }, { generals: at('seat-a', 'zhang-zhao-and-zhang-hong'), owner: 'seat-b' }), { kind: 'EndPhaseAction', seatId: 'seat-b' });
    expect(askedAbout(discard(one, 'k1'))).toBeNull();
  });

  it('Don’t leaves the cards in the discard pile', () => {
    const s = h.decline(discard(discarding(), 'k1', 'k2'));
    expect(ids(s, 'discardPile')).toEqual(['k1', 'k2']);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx jest projects/content/src/lib/generals/mountain-wu.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement** — append to `generals/mountain.ts` (imports: `DamageDealtEvent` not needed; add `Target`-free; use `atStep`, `actedOn`, `hasActed` from `../shared/steps`, `lastIndex` helper below, `CardZone`; `GainSkillEffect` is a plain effect object)

```ts
// ── Sun Ce ─────────────────────────────────────────────────────────────────

type ToolOnTarget = Extract<Effect, { kind: 'ToolOnTargetEffect' }>;

// Passion (compulsory): you draw 1 card when you use a Duel or a red Sha, or
// when one is used on you (a Sha: once per target).
export const passion: SkillDefinition = {
  id: 'passion',
  compulsory: true,
  triggers: [
    atStep(['sha-targeted'], {
      condition: (state, step, owner) =>
        step.card.colour === 'red' && (step.userSeatId === owner.seatId || step.target.seatId === owner.seatId) && isLiving(state, (owner as GeneralOwner).seatId),
      // The step goes on, marked so the draw is paid once; the draw follows it.
      effect: (_state, step, owner) => [actedOn(step, owner), used(owner as GeneralOwner, 'drew'), draw((owner as GeneralOwner).seatId, 1)],
    }),
    on<ToolOnTarget>('before:ToolOnTargetEffect', {
      condition: (state, effect, owner) =>
        effect.tool.as === 'duel' && effect.target.kind === 'seat' && (effect.userSeatId === owner.seatId || effect.target.seatId === owner.seatId) && isLiving(state, owner.seatId),
      effect: (_state, effect, owner) => [effect, used(owner, 'drew'), draw(owner.seatId, 1)],
    }),
  ],
};

// Soul Position (awakening): at the start of your turn with exactly 1 HP,
// reduce your max HP by 1 and gain Brave Gesture and Brave Spirit.
export const soulPosition: SkillDefinition = {
  id: 'soul-position',
  compulsory: true,
  awakening: true,
  triggers: [
    awakeningAtTurnStart({
      skillId: 'soul-position',
      condition: (state, owner) => hpOf(state, owner.seatId) === 1,
      effects: (_state, owner) => [
        { kind: 'ReduceMaxHpEffect', seatId: owner.seatId, amount: 1 },
        { kind: 'GainSkillEffect', seatId: owner.seatId, slot: owner.slot, skillId: 'brave-gesture' },
        { kind: 'GainSkillEffect', seatId: owner.seatId, slot: owner.slot, skillId: 'brave-spirit' },
      ],
    }),
  ],
};

// Takeover: a Lord skill, inactive in Kingdom War.
export const takeover: SkillDefinition = { id: 'takeover', lord: true };

// ── Zhang Zhao and Zhang Hong ──────────────────────────────────────────────

// The seats whose slot for `card` is empty, other than `seatId`.
const freeSlotSeats = (state: GameState, seatId: string, card: CardInstance) => {
  const slot = equipSlotOf(card.definitionId);
  return slot ? otherLivingSeatIds(state, seatId).filter((id) => !cardsIn(state, seatOf(state, id)!.equipped.zoneId).some((w) => equipSlotOf(w.definitionId) === slot)) : [];
};
const equipmentInHand = (state: GameState, seatId: string, registry: ContentRegistry) =>
  handOf(state, seatId).filter((c) => registry.cards.get(c.definitionId)?.category === 'equipment' && freeSlotSeats(state, seatId, c).length > 0);

// Direct Instruction (active, any number of times in your Play Phase): place an
// equipment card from your hand in another seat's empty slot, then draw 1.
export const directInstruction: SkillDefinition = {
  id: 'direct-instruction',
  active: {
    canUse: (state, { seatId }, registry) => isLiving(state, seatId) && equipmentInHand(state, seatId, registry).length > 0,
    start: (state, { seatId, owner }, registry) => [
      selectionOf(state, owner, {
        of: 'cards',
        eligibleIds: equipmentInHand(state, seatId, registry).map((c) => c.instanceId),
        min: 1,
        max: 1,
        then: { kind: 'skill-step', step: skillStep(owner, 'to') },
        onCancel: [],
      }),
    ],
  },
  onStep: (state, step) => {
    const { owner } = step;
    const card = handOf(state, owner.seatId).find((c) => c.instanceId === picked(step)[0]);
    if (!card) return [];
    const seats = freeSlotSeats(state, owner.seatId, card);
    return seats.length === 0
      ? []
      : [
          choiceOf(state, owner, {
            verb: 'pick',
            options: seatOptions(seats, (to) => [
              used(owner, 'placed', to, card.instanceId),
              { kind: 'MoveCardEffect', cardInstanceId: card.instanceId, toZoneId: seatOf(state, to)!.equipped.zoneId },
              draw(owner.seatId, 1),
            ]),
          }),
        ];
  },
};

// The cards `seatId` discarded in its latest Discard Phase that still lie in the discard pile.
function discardedInDiscardPhase(state: GameState, seatId: string): string[] {
  let start = -1;
  state.log.forEach((e, i) => {
    if (e.kind === 'PhaseChangedEvent' && e.phase === 'Discard' && e.seatId === seatId) start = i;
  });
  if (start === -1) return [];
  const seat = seatOf(state, seatId);
  const discardPileId = requireZoneOfKind(state.zones, 'discardPile').id;
  const stillThere = new Set(cardsIn(state, discardPileId).map((c) => c.instanceId));
  return state.log
    .slice(start)
    .flatMap((e) => (e.kind === 'CardMovedEvent' && seat && e.fromZoneId === seat.hand.zoneId && e.toZoneId === discardPileId && stillThere.has(e.cardInstanceId) ? [e.cardInstanceId] : []));
}

// Stubborn (may): at the end of another seat's Discard Phase, if it discarded
// 2 or more cards, give one of them back to it and take the others.
export const stubborn: SkillDefinition = {
  id: 'stubborn',
  triggers: [
    on<PhaseChangedEvent>('after:PhaseChangedEvent', {
      condition: (state, event, owner) =>
        event.phase === 'End' && event.seatId !== owner.seatId && state.turn.ownerSeatId === event.seatId && isLiving(state, event.seatId) && isLiving(state, owner.seatId) &&
        discardedInDiscardPhase(state, event.seatId).length >= 2,
      effect: (state, event, owner) => [ask(owner, [skillStep(owner, 'give', { seat: event.seatId, cards: discardedInDiscardPhase(state, event.seatId) })], [], event.seatId)],
    }),
  ],
  onStep: (state, step) => {
    const { owner } = step;
    const seat = step.data?.['seat'] as string;
    const discardPile = requireZoneOfKind(state.zones, 'discardPile');
    const cards = ((step.data?.['cards'] as string[] | undefined) ?? []).flatMap((id) => discardPile.cards.filter((c) => c.instanceId === id));
    if (cards.length < 2 || !isLiving(state, seat) || !isLiving(state, owner.seatId)) return [];
    const move = (id: string, to: string): Effect => ({ kind: 'MoveCardEffect', cardInstanceId: id, toZoneId: handZoneId(state, to), onlyFrom: discardPile.id });
    return [
      choiceOf(state, owner, {
        verb: 'pick',
        targetSeatId: seat,
        options: cards.map((card) => ({
          id: card.instanceId,
          shows: { kind: 'card' as const, card },
          effects: [used(owner, 'gave-back', seat), move(card.instanceId, seat), ...cards.filter((c) => c.instanceId !== card.instanceId).map((c) => move(c.instanceId, owner.seatId))],
        })),
      }),
    ];
  },
};
```

Add `hpOf` to the `../shared/skills` import and `atStep, actedOn` to the `../shared/steps` import. Add to `MOUNTAIN_GENERALS`: `{ id: 'sun-ce', skills: [passion, soulPosition, takeover] }`, `{ id: 'zhang-zhao-and-zhang-hong', skills: [directInstruction, stubborn] }`.

- [ ] **Step 4: Run**

Run: `npx jest projects/content/src/lib/generals`
Expected: PASS. If the Duel's `before:ToolOnTargetEffect` fires twice (the first output equal to the effect re-enters), add an `acted`-style guard by wrapping the effect in a mark: the effect type has no data field, so instead count the draws in the test and, if doubled, move the Duel draw to a `CardPlayedEvent`/`ToolResolved`-free hook and ledger the ruling.

- [ ] **Step 5: Commit**

```bash
git add projects/content
git commit -m "feat(content): Sun Ce's Passion and Soul Position, Zhang Zhao and Zhang Hong's skills

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Task 6: Qun — Cai Wenji and Zuo Ci

**Files:**
- Modify: `projects/content/src/lib/generals/mountain.ts`, `shared/skills.ts` (`choiceOf` gains `secret`), `generals/index.ts` (nothing new), `public-api.ts` (nothing new)
- Create: `projects/content/src/lib/generals/mountain-qun.spec.ts`

**Interfaces:**
- Consumes: Tasks 1–5; `formSkillOptions`; `generalDisplayData`, `abilityName` from `display.ts`; `kwMode` for the dying round.
- Produces: `lament`, `heartbroken`, `incarnation`, `newLife`; entries `cai-wenji`, `zuo-ci`; `ChoiceSpec.secret`.

- [ ] **Step 1: Write the failing spec** `generals/mountain-qun.spec.ts`

```ts
import { createGame, redactStateForSeat, skillsInPlay } from 'engine';
import { askedAbout, card, handIds, harness, hp, ids, kwMode, registry, table, TableOptions } from './skills.testing';
import { seatGender } from '../shared/gender';
import { kingdomWarMode } from '../modes/kingdomWar';
import { buildContentRegistry } from '../registry';

const h = harness();
const hk = harness(kwMode);
const at = (seatId: string, main: string, deputy = 'filler-xu-huang', revealed = true): TableOptions['generals'] => ({ [seatId]: [main, deputy, revealed] });
const inPlay = (s: ReturnType<typeof table>, seatId: string) => skillsInPlay(s, seatId, registry).map((x) => x.skill.id);
const shaDamage = (source: string | null, target: string, amount = 1) => ({
  kind: 'DamageEffect' as const,
  damage: {
    source: source ? { kind: 'seat' as const, seatId: source } : null, target: { kind: 'seat' as const, seatId: target }, amount, nature: 'normal' as const,
    cause: { card: { as: 'sha', colour: 'black' as const, physical: [card('sx', 'sha')] } },
  },
});

describe('Cai Wenji — Lament', () => {
  // seat-a is Cai Wenji and holds k1; seat-c's Sha hurts seat-b; the judgment card is `top`.
  const hurt = (top: 'heart' | 'diamond' | 'club' | 'spade', cards: Record<string, ReturnType<typeof card>[]> = {}, o: TableOptions = {}) =>
    h.run(table({ 'seat-a:hand': [card('k1', 'shan', 'heart', 2)], 'seat-c:hand': [card('c1', 'shan', 'heart', 3), card('c2', 'shan', 'heart', 4), card('c3', 'shan', 'heart', 5)], drawPile: [card('j', 'shan', top, 6), card('d2', 'shan', 'heart', 7), card('d3', 'shan', 'heart', 8)], ...cards }, { generals: at('seat-a', 'cai-wenji'), ...o }), [shaDamage('seat-c', 'seat-b')]);
  const lament = (top: Parameters<typeof hurt>[0], cards?: Parameters<typeof hurt>[1], o?: TableOptions) => h.select(h.use(hurt(top, cards, o)), 'k1');

  it('heart: the victim recovers 1 HP', () => {
    const s = lament('heart');
    expect(askedAbout(hurt('heart'))).toBe('lament');
    expect(hp(s, 'seat-b')).toBe(4);
    expect(ids(s, 'discardPile')).toEqual(expect.arrayContaining(['k1', 'j']));
  });

  it('diamond: the victim draws 2 cards', () => {
    expect(handIds(lament('diamond'), 'seat-b')).toEqual(['d2', 'd3']);
  });

  it('club: the source discards 2 cards of its choice', () => {
    let s = lament('club');
    expect(s.pendingSelection).toMatchObject({ seatId: 'seat-c', min: 2, max: 2 });
    s = h.select(s, 'c1', 'c2');
    expect(handIds(s, 'seat-c')).toEqual(['c3']);
  });

  it('spade: the source turns over', () => {
    expect(lament('spade').seats.find((x) => x.id === 'seat-c')!.faceDown).toBe(true);
  });

  it('works for any seat’s damage by a Sha, but not for damage from anything else; Don’t does nothing', () => {
    const plain = h.run(table({ 'seat-a:hand': [card('k1', 'shan')] }, { generals: at('seat-a', 'cai-wenji') }), [
      { kind: 'DamageEffect', damage: { source: { kind: 'seat', seatId: 'seat-c' }, target: { kind: 'seat', seatId: 'seat-b' }, amount: 1, nature: 'normal' } },
    ]);
    expect(askedAbout(plain)).toBeNull();
    expect(ids(h.decline(hurt('heart')), 'discardPile')).toEqual([]);
  });

  it('with no source the club and spade results do nothing', () => {
    const s = h.select(h.use(h.run(table({ 'seat-a:hand': [card('k1', 'shan')], drawPile: [card('j', 'shan', 'club', 6)] }, { generals: at('seat-a', 'cai-wenji') }), [shaDamage(null, 'seat-b')])), 'k1');
    expect(s.pendingSelection).toBeUndefined();
  });

  it('is not asked with no card to discard', () => {
    expect(askedAbout(hurt('heart', { 'seat-a:hand': [] }))).toBeNull();
  });
});

describe('Cai Wenji — Heartbroken', () => {
  // seat-a is Cai Wenji at 1 HP; seat-c kills her.
  const killed = (o: TableOptions = {}, source: string | null = 'seat-c') => {
    let s = hk.run(table({}, { generals: { 'seat-a': ['cai-wenji', 'filler-xu-huang', true], 'seat-c': ['filler-jiang-wei', 'filler-xu-huang', true] }, hp: { 'seat-a': 1 }, kingdoms: { 'seat-a': 'Qun' }, ...o }), [shaDamage(source, 'seat-a')]);
    for (let i = 0; i < 6 && s.pendingResponse; i++) s = hk.pass(s);
    return s;
  };

  it('the killer loses all its skills for the rest of the game', () => {
    const s = killed({ generals: { 'seat-a': ['cai-wenji', 'filler-xu-huang', true], 'seat-c': ['zhang-he', 'liu-shan', true] } });
    expect(s.seats.find((x) => x.id === 'seat-a')!.eliminated).toBe(true);
    expect(s.seats.find((x) => x.id === 'seat-c')!.silenced).toBe(true);
    expect(inPlay(s, 'seat-c')).toEqual([]);
    // Gained skills too.
    const gained = { ...s, seats: s.seats.map((x) => (x.id === 'seat-c' ? { ...x, gainedSkills: [{ slot: 'main' as const, skillId: 'astrology' }] } : x)) };
    expect(inPlay(gained, 'seat-c')).toEqual([]);
  });

  it('nothing happens when she dies with no killer, or by her own hand', () => {
    expect(killed({}, null).seats.some((x) => x.silenced)).toBe(false);
    expect(killed({}, 'seat-a').seats.some((x) => x.silenced)).toBe(false);
  });

  it('does not silence a killer who is already out', () => {
    const base = table({}, { generals: at('seat-a', 'cai-wenji'), hp: { 'seat-a': 1 }, kingdoms: { 'seat-a': 'Qun' } });
    let s = hk.run({ ...base, seats: base.seats.map((x) => (x.id === 'seat-c' ? { ...x, eliminated: true } : x)) }, [shaDamage('seat-c', 'seat-a')]);
    for (let i = 0; i < 6 && s.pendingResponse; i++) s = hk.pass(s);
    expect(s.seats.find((x) => x.id === 'seat-a')!.eliminated).toBe(true);
    expect(s.seats.find((x) => x.id === 'seat-c')!.silenced).toBeUndefined();
  });
});

describe('Zuo Ci — Incarnation', () => {
  // Zuo Ci holds Zhou Yu and Da Qiao as Forms.
  const withForms = (o: TableOptions = {}, extra: object = {}) => {
    const s = table({ drawPile: Array.from({ length: 4 }, (_, i) => card(`d${i + 1}`, 'shan', 'heart', i + 1)) }, { generals: at('seat-a', 'zuo-ci'), owner: 'seat-d', phase: 'End', ...o });
    return { ...s, seats: s.seats.map((x) => (x.id === 'seat-a' ? { ...x, forms: { slot: 'main' as const, held: ['zhou-yu', 'da-qiao'] }, ...extra } : x)) };
  };

  it('at the start of his turn he may choose a skill of a Form; it turns face up and he holds the skill', () => {
    let s = h.settle(withForms());
    expect(askedAbout(s)).toBe('incarnation');
    s = h.use(s);
    expect(s.pendingChoice).toMatchObject({ secret: true });
    expect(s.pendingChoice!.options.map((o) => o.id)).toEqual(expect.arrayContaining(['zhou-yu/brave-gesture', 'zhou-yu/sow-revolt']));
    s = h.choose(s, 'zhou-yu/brave-gesture');
    expect(s.seats[0].forms?.chosen).toEqual({ generalId: 'zhou-yu', skillId: 'brave-gesture' });
    expect(inPlay(s, 'seat-a')).toContain('brave-gesture');
    expect(s.log).toContainEqual({ kind: 'FormChosenEvent', seatId: 'seat-a', generalId: 'zhou-yu', skillId: 'brave-gesture' });
  });

  it('also at the end of his turn, and the previous Form’s skill is replaced', () => {
    const chosen = { chosen: { generalId: 'zhou-yu', skillId: 'brave-gesture' } };
    const s = h.settle(withForms({ owner: 'seat-a', phase: 'Play' }, { forms: { slot: 'main', held: ['zhou-yu', 'da-qiao'], ...chosen } }));
    const ended = h.act(s, { kind: 'EndPhaseAction', seatId: 'seat-a' });
    expect(askedAbout(ended)).toBe('incarnation');
    expect(h.use(ended).pendingChoice!.options.map((o) => o.id)).not.toContain('zhou-yu/brave-gesture');
  });

  it('the Form’s gender replaces his own', () => {
    const s = h.choose(h.use(h.settle(withForms())), 'da-qiao/displace');
    expect(seatGender(s, 'seat-a', registry)).toBe('female');
  });

  it('Lord, awakening and limited skills are never offered', () => {
    const s = h.use(h.settle({ ...withForms(), seats: withForms().seats.map((x) => (x.id === 'seat-a' ? { ...x, forms: { slot: 'main' as const, held: ['jiang-wei', 'liu-shan', 'jia-xu'] } } : x)) }));
    const offered = s.pendingChoice!.options.map((o) => o.id);
    expect(offered).toEqual(expect.arrayContaining(['jiang-wei/instigate', 'liu-shan/pleasure']));
    for (const banned of ['jiang-wei/follow-the-master', 'liu-shan/seem-foolish', 'jia-xu/upheaval']) expect(offered).not.toContain(banned);
  });

  it('not asked with no Form to choose from', () => {
    expect(askedAbout(h.settle(withForms({}, { forms: undefined })))).toBeNull();
  });

  it('revealing him for any other reason offers the first choice', () => {
    const s = withForms({ generals: at('seat-a', 'zuo-ci', 'filler-xu-huang', false) });
    expect(askedAbout(h.run(s, [{ kind: 'RevealGeneralEffect', seatId: 'seat-a', slot: 'main' }]))).toBe('incarnation');
  });

  it('other seats never see a spare General: not while he is hidden, and only as hidden cards once he is shown (Review Focus 3)', () => {
    const shown = withForms();
    expect(redactStateForSeat(shown, 'seat-b').seats[0].forms?.held).toEqual(['hidden', 'hidden']);
    expect(redactStateForSeat(shown, 'seat-a').seats[0].forms?.held).toEqual(['zhou-yu', 'da-qiao']);
    const hidden = withForms({ generals: at('seat-a', 'zuo-ci', 'filler-xu-huang', false) });
    expect(redactStateForSeat(hidden, 'seat-b').seats[0].forms).toBeUndefined();
  });
});

describe('Zuo Ci — New Life', () => {
  it('each point of damage deals him one more Form from the pool', () => {
    const s = table({}, { generals: at('seat-a', 'zuo-ci') });
    const withPool = { ...s, spareGenerals: ['zhou-yu', 'da-qiao', 'lu-xun'], seats: s.seats.map((x) => (x.id === 'seat-a' ? { ...x, forms: { slot: 'main' as const, held: ['guan-yu'] } } : x)) };
    const out = h.run(withPool, [{ kind: 'DamageEffect', damage: { source: { kind: 'seat', seatId: 'seat-b' }, target: { kind: 'seat', seatId: 'seat-a' }, amount: 2, nature: 'normal' } }]);
    expect(out.seats[0].forms?.held).toEqual(['guan-yu', 'zhou-yu', 'da-qiao']);
    expect(out.spareGenerals).toEqual(['lu-xun']);
  });

  it('an empty pool adds nothing', () => {
    const out = h.run({ ...table({}, { generals: at('seat-a', 'zuo-ci') }), spareGenerals: [] }, [{ kind: 'DamageEffect', damage: { source: null, target: { kind: 'seat', seatId: 'seat-a' }, amount: 1, nature: 'normal' } }]);
    expect(out.seats[0].forms).toBeUndefined();
  });
});

describe('Kingdom War deals Zuo Ci his Forms', () => {
  it('a seat that chose a General with spare Generals to deal is dealt them; others are not', () => {
    const trigger = kingdomWarMode.triggers.find((t) => t.point === 'after:GeneralsChosenEvent')!;
    const chosen = table({}, { generals: at('seat-a', 'zuo-ci') });
    const event = { kind: 'GeneralsChosenEvent', seatId: 'seat-a' };
    expect(trigger.condition(chosen, event, undefined, registry)).toBe(true);
    expect(trigger.effect(chosen, event, undefined, registry)).toEqual([{ kind: 'DealSpareGeneralsEffect', seatId: 'seat-a', slot: 'main', count: 2 }]);
    expect(trigger.condition(chosen, { kind: 'GeneralsChosenEvent', seatId: 'seat-b' }, undefined, registry)).toBe(false);
  });

  it('Zuo Ci is never in the spare pool', () => {
    for (let seed = 1; seed <= 10; seed++) {
      expect(createGame(kingdomWarMode, buildContentRegistry(), ['seat-0', 'seat-1', 'seat-2'], seed).spareGenerals).not.toContain('zuo-ci');
    }
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx jest projects/content/src/lib/generals/mountain-qun.spec.ts`
Expected: FAIL.

- [ ] **Step 3: `choiceOf` gains `secret`**

In `shared/skills.ts`: `ChoiceSpec` gets `// Only the choosing seat sees the options. secret?: true;` and `choiceOf` adds `...(spec.secret ? { secret: true as const } : {})` to the `choice` object.

- [ ] **Step 4: Implement** — append to `generals/mountain.ts` (imports: `DamageDealtEvent`, `GeneralRevealedEvent`, `SeatEliminatedEvent` types from engine; `formSkillOptions` from `../shared/forms`; `abilityName`, `generalDisplayData` from `../display`)

```ts
// ── Cai Wenji ──────────────────────────────────────────────────────────────

const ownedCards = (state: GameState, seatId: string) => [...handOf(state, seatId), ...cardsIn(state, seatOf(state, seatId)!.equipped.zoneId)];

// Lament (may): whenever any seat takes damage from a Sha, discard a card; the
// victim then judges: heart it recovers 1 HP, diamond it draws 2, club the
// source discards 2 cards, spade the source turns over.
export const lament: SkillDefinition = {
  id: 'lament',
  triggers: [
    on<DamageDealtEvent>('after:DamageDealtEvent', {
      condition: (state, event, owner) =>
        event.damage.cause?.card?.as === 'sha' && event.damage.target.kind === 'seat' && event.damage.amount > 0 && isLiving(state, event.damage.target.seatId) && isLiving(state, owner.seatId) && ownedCards(state, owner.seatId).length > 0,
      effect: (_state, event, owner) => {
        const victim = (event.damage.target as { seatId: string }).seatId;
        const source = event.damage.source?.kind === 'seat' ? event.damage.source.seatId : undefined;
        return [ask(owner, [skillStep(owner, 'pay', { victim, ...(source ? { source } : {}) })], [], victim)];
      },
    }),
  ],
  onStep: (state, step) => {
    const { owner } = step;
    const victim = step.data?.['victim'] as string;
    const source = step.data?.['source'] as string | undefined;
    if (step.step === 'pay') {
      return [selectionOf(state, owner, { of: 'cards', eligibleIds: ownedCards(state, owner.seatId).map((c) => c.instanceId), min: 1, max: 1, then: { kind: 'skill-step', step: skillStep(owner, 'judge', { victim, ...(source ? { source } : {}) }) }, onCancel: [] })];
    }
    if (step.step === 'judge') {
      return isLiving(state, victim)
        ? [...discardMoves(state, picked(step)), used(owner, 'lamented', victim), { kind: 'JudgeEffect', seatId: victim, reader: { kind: 'skill', owner }, data: { victim, ...(source ? { source } : {}) } }]
        : discardMoves(state, picked(step));
    }
    if (step.step === 'club') {
      if (!source || !isLiving(state, source)) return [];
      const cards = ownedCards(state, source);
      const count = Math.min(2, cards.length);
      return count === 0 ? [] : [selectionOf(state, owner, { of: 'cards', seatId: source, targetSeatId: source, eligibleIds: cards.map((c) => c.instanceId), min: count, max: count, then: { kind: 'discard' } })];
    }
    return [];
  },
  // The judged card goes to the discard pile first; then what its suit does.
  onJudged: (state, { owner, judged, data, done }, registry) => {
    const victim = data?.['victim'] as string;
    const source = data?.['source'] as string | undefined;
    const suit = suitOf(state, victim, judged, registry);
    if (suit === 'heart') return [done, heal(victim, 1)];
    if (suit === 'diamond') return [done, draw(victim, 2)];
    if (!source || !isLiving(state, source)) return [done];
    if (suit === 'club') return [done, skillStep(owner, 'club', { source })];
    return [done, seatOf(state, source)?.faceDown ? { kind: 'TurnFaceUpEffect', seatId: source } : { kind: 'TurnFaceDownEffect', seatId: source }];
  },
};

// Heartbroken (compulsory): when a seat kills her, that seat loses all its
// skills for the rest of the game. She is out when it acts (afterDeath).
export const heartbroken: SkillDefinition = {
  id: 'heartbroken',
  compulsory: true,
  afterDeath: true,
  triggers: [
    on<SeatEliminatedEvent>('after:SeatEliminatedEvent', {
      condition: (state, event, owner) =>
        event.seatId === owner.seatId && !!event.killerSeatId && event.killerSeatId !== owner.seatId && isLiving(state, event.killerSeatId),
      effect: (_state, event, owner) => [used(owner, 'silenced', event.killerSeatId), { kind: 'SilenceSeatEffect', seatId: event.killerSeatId! }],
    }),
  ],
};

// ── Zuo Ci ─────────────────────────────────────────────────────────────────

// The pick of a Form's skill; secret, since the options name spare Generals.
function chooseForm(state: GameState, owner: GeneralOwner, registry: ContentRegistry): Effect {
  return choiceOf(state, owner, {
    verb: 'pick',
    secret: true,
    options: formSkillOptions(state, owner.seatId, registry).map(({ generalId, skillId }) => ({
      id: `${generalId}/${skillId}`,
      shows: { kind: 'label' as const, text: `${abilityName(skillId)} (${generalDisplayData(generalId)?.name ?? generalId})` },
      effects: [{ kind: 'ChooseFormSkillEffect' as const, seatId: owner.seatId, generalId, skillId }, used(owner, 'incarnated')],
    })),
  });
}

// Incarnation (may): he holds 2 Forms (spare Generals, dealt when Generals are
// chosen) and may choose one skill of one of them when he is revealed and at
// the start and end of each of his turns. That Form turns face up; he holds the
// skill, and its gender. Lord, awakening and limited skills cannot be chosen.
export const incarnation: SkillDefinition = {
  id: 'incarnation',
  spareGenerals: 2,
  triggers: [
    on<PhaseChangedEvent>('after:PhaseChangedEvent', {
      condition: (state, event, owner, registry) =>
        (event.phase === 'Start' || event.phase === 'End') && event.seatId === owner.seatId && state.turn.ownerSeatId === owner.seatId && formSkillOptions(state, owner.seatId, registry).length > 0,
      effect: (state, _event, owner, registry) => [ask(owner, [chooseForm(state, owner, registry)])],
    }),
    // Revealed for any reason but this skill: the first choice.
    on<GeneralRevealedEvent>('after:GeneralRevealedEvent', {
      condition: (state, event, owner, registry) =>
        event.seatId === owner.seatId && event.slot === owner.slot && event.forAbilityId !== 'incarnation' && !seatOf(state, owner.seatId)?.forms?.chosen && formSkillOptions(state, owner.seatId, registry).length > 0,
      effect: (state, _event, owner, registry) => [ask(owner, [chooseForm(state, owner, registry)])],
    }),
  ],
};

// New Life (compulsory): each point of damage you take deals you one more Form.
export const newLife: SkillDefinition = {
  id: 'new-life',
  compulsory: true,
  triggers: [
    on<DamageDealtEvent>('after:DamageDealtEvent', {
      condition: (state, event, owner) =>
        event.damage.target.kind === 'seat' && event.damage.target.seatId === owner.seatId && event.damage.amount > 0 && isLiving(state, owner.seatId) && (state.spareGenerals ?? []).length > 0,
      effect: (_state, event, owner) => [used(owner, 'new-form'), { kind: 'DealSpareGeneralsEffect', seatId: owner.seatId, slot: owner.slot, count: event.damage.amount }],
    }),
  ],
};
```

Add to `MOUNTAIN_GENERALS`: `{ id: 'cai-wenji', skills: [lament, heartbroken] }`, `{ id: 'zuo-ci', skills: [incarnation, newLife] }`. Add `DamageDealtEvent`, `GeneralRevealedEvent`, `SeatEliminatedEvent` to the engine type import.

- [ ] **Step 5: Run the whole content and engine projects**

Run: `npx jest projects/engine projects/content`
Expected: PASS. (Not the whole repo: bots and sim have no Mountain rules yet and may fail until Task 7 — gate this task on engine and content only, and ledger a ruling if a bot or sim spec fails.)

- [ ] **Step 6: Commit**

```bash
git add projects/content
git commit -m "feat(content): Cai Wenji's Lament and Heartbroken, Zuo Ci's Incarnation and New Life

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```


## Task 7: Bots

**Files:**
- Create: `projects/bots/src/lib/mountain.ts`, `projects/bots/src/lib/mountain.spec.ts`
- Modify: `projects/bots/src/lib/skills.ts` (fall-through hooks; `CONVERSION_SKILLS`; `ACTIVE_ORDER`), `projects/bots/src/lib/rule-based.ts` (the Instigate window; Steal through Strategic Pass)

**Interfaces:**
- Consumes: Tasks 1–6; the stage 10 bot structure (`wantsForest`, `forestChoice`, `forestSelection`, `wantsForestActive`, `upheavalVictimIsFoe`); `isAlly`, `keepRank`, `leastUseful`, `handCards` from `helpers.ts`.
- Produces: `wantsMountain(view, me, choice, registry)`, `wantsMountainActive(view, me, skillId, registry)`, `mountainChoice(view, me, choice, registry)`, `mountainSelection(view, me, selection, registry)`, `bestMove(view, me, registry)`.

- [ ] **Step 1: Write the failing spec** `bots/src/lib/mountain.spec.ts`

```ts
import { getLegalActions } from 'engine';
import type { GameState } from 'engine';
import { act, asking, card, decide, general, picked, registry, table } from './testing';

// The Mountain Generals' bot rules (stage 11 spec, "Bots").

const generals = (a: string, extra: Record<string, [string, string]> = {}) => ({ 'seat-a': [a, 'filler-jiang-wei'] as [string, string], ...extra });
const cards = (p: string, n: number) => Array.from({ length: n }, (_, i) => card(`${p}${i}`, 'shan', 'heart', i + 1));
const kingdoms = { 'seat-a': 'Wei', 'seat-b': 'Wei', 'seat-c': 'Shu', 'seat-d': 'Wu' } as const;
const choiceOf = (s: GameState, options: string[], abilityId: string, verb: 'pick' | 'give' | 'discard' = 'pick') => ({
  ...s,
  pendingChoice: {
    id: 'c', seatId: 'seat-a', verb,
    reason: { kind: 'ability' as const, owner: general('seat-a', abilityId), abilityId },
    options: options.map((id) => ({ id, shows: id.startsWith('seat') ? { kind: 'seat' as const, seatId: id } : { kind: 'label' as const, text: id }, effects: [] })),
  },
});
const selecting = (s: GameState, abilityId: string, of: 'cards' | 'seats', eligibleIds: string[], step = 'x', min = 1, max = 1, seatId = 'seat-a') => ({
  ...s,
  pendingSelection: {
    id: 's', seatId, of, eligibleIds, min, max,
    reason: { kind: 'ability' as const, owner: general('seat-a', abilityId), abilityId },
    then: { kind: 'skill-step' as const, step: { kind: 'SkillStepEffect' as const, owner: general('seat-a', abilityId), step, data: {} } },
    onCancel: [],
  },
});

describe('asks', () => {
  it('Military Farm, Incarnation and Stubborn: always', () => {
    for (const skill of ['military-farm', 'incarnation', 'stubborn']) {
      expect(picked(decide(asking(table({}, { generals: generals('deng-ai') }), skill)))).toBe('use');
    }
  });

  it('Decentralization: with more than 3 hand cards', () => {
    const s = (n: number) => asking(table({ 'seat-a:hand': cards('h', n) }, { generals: generals('liu-shan') }), 'decentralization');
    expect(picked(decide(s(4)))).toBe('use');
    expect(picked(decide(s(3)))).toBe('decline');
  });

  it('Lament: for a victim on its side, not otherwise', () => {
    const s = (victim: string) => asking(table({ 'seat-a:hand': cards('h', 2) }, { generals: generals('cai-wenji'), kingdoms: { ...kingdoms, 'seat-a': 'Qun', 'seat-b': 'Qun' } }), 'lament', victim);
    expect(picked(decide(s('seat-a')))).toBe('use');
    expect(picked(decide(s('seat-c')))).toBe('decline');
  });

  it('Clever Change: skips the Draw Phase against two non-allies with 2 or more cards each; never Judgment or Discard', () => {
    const t = (phase: GameState['phase'], hands: number) => ({
      ...asking(table({ 'seat-a:hand': cards('h', 2), 'seat-c:hand': cards('c', hands), 'seat-d:hand': cards('d', hands) }, { generals: generals('zhang-he'), kingdoms }), 'clever-change'),
      phase,
    });
    expect(picked(decide(t('Draw', 2)))).toBe('use');
    expect(picked(decide(t('Draw', 1)))).toBe('decline');
    expect(picked(decide(t('Start', 3)))).toBe('decline');
    expect(picked(decide(t('Discard', 3)))).toBe('decline');
  });
});

describe('choices and selections', () => {
  it('Follow the Master: recovers when it can', () => {
    expect(picked(decide(choiceOf(table({}, { generals: generals('jiang-wei') }), ['recover', 'draw'], 'follow-the-master')))).toBe('recover');
  });

  it('Incarnation: the first skill of its preference list that is offered', () => {
    const s = choiceOf(table({}, { generals: generals('zuo-ci') }), ['da-qiao/displace', 'zhou-yu/brave-gesture', 'zhuge-liang/astrology'], 'incarnation');
    expect(picked(decide(s))).toBe('zhou-yu/brave-gesture');
  });

  it('Decentralization: the extra turn goes to the ally with the most cards, else the non-ally with the fewest', () => {
    const t = (k: typeof kingdoms | Record<string, 'Wei' | 'Shu' | 'Wu' | 'Qun'>) =>
      choiceOf(table({ 'seat-b:hand': cards('b', 3), 'seat-c:hand': cards('c', 1), 'seat-d:hand': cards('d', 5) }, { generals: generals('liu-shan'), kingdoms: k }), ['seat-b', 'seat-c', 'seat-d'], 'decentralization');
    expect(picked(decide(t(kingdoms)))).toBe('seat-b');
    expect(picked(decide(t({ 'seat-a': 'Wei', 'seat-b': 'Shu', 'seat-c': 'Wu', 'seat-d': 'Qun' })))).toBe('seat-c');
  });

  it('Pleasure: pays with a card it can spare, else gives the Sha up', () => {
    const t = (hand: ReturnType<typeof card>[]) => selecting(table({ 'seat-a:hand': hand }), 'pleasure', 'cards', hand.map((c) => c.instanceId), 'paid');
    expect(picked(decide(t([card('p', 'peach', 'heart')])))).toBe('CancelSelectionAction');
    const spare = decide(t([card('x', 'draw-two', 'club'), card('p', 'peach', 'heart')]));
    expect(picked(spare)).toEqual(['x']);
  });

  it('Clever Change: pays its least useful card; takes from the two fullest non-ally hands', () => {
    const base = table({ 'seat-a:hand': [card('p', 'peach', 'heart'), card('x', 'draw-two', 'club')], 'seat-b:hand': cards('b', 4), 'seat-c:hand': cards('c', 3), 'seat-d:hand': cards('d', 2) }, { generals: generals('zhang-he'), kingdoms: { ...kingdoms, 'seat-b': 'Shu', 'seat-d': 'Qun' } });
    expect(picked(decide(selecting(base, 'clever-change', 'cards', ['p', 'x'], 'paid')))).toEqual(['x']);
    expect(picked(decide(selecting(base, 'clever-change', 'seats', ['seat-b', 'seat-c', 'seat-d'], 'draw-take', 1, 2)))).toEqual(['seat-b', 'seat-d']);
  });

  it('Stubborn: gives back the least useful discarded card', () => {
    const s = choiceOf(table({}, { generals: generals('zhang-zhao-and-zhang-hong') }), ['p', 'x'], 'stubborn');
    const withCards = { ...s, zones: s.zones.map((z) => (z.id === 'discardPile' ? { ...z, cards: [card('p', 'peach', 'heart'), card('x', 'draw-two', 'club')] } : z)),
      pendingChoice: { ...s.pendingChoice!, options: [card('p', 'peach', 'heart'), card('x', 'draw-two', 'club')].map((c) => ({ id: c.instanceId, shows: { kind: 'card' as const, card: c }, effects: [] })) } };
    expect(picked(decide(withCards))).toBe('x');
  });

  it('Instigate: the non-ally with the fewest cards', () => {
    const s = selecting(table({ 'seat-b:hand': cards('b', 3), 'seat-d:hand': cards('d', 1) }, { generals: generals('jiang-wei'), kingdoms }), 'instigate', 'seats', ['seat-b', 'seat-d'], 'ask');
    expect(picked(decide(s))).toEqual(['seat-d']);
    const ally = selecting(table({}, { generals: generals('jiang-wei'), kingdoms: { ...kingdoms, 'seat-b': 'Wei', 'seat-d': 'Wei' } }), 'instigate', 'seats', ['seat-b', 'seat-d'], 'ask');
    expect(picked(decide(ally))).toBe('CancelSelectionAction');
  });
});

describe('active skills', () => {
  const offered = (s: GameState, skill: string) => getLegalActions(s, 'seat-a', registry).some((a) => a.kind === 'UseSkillAction' && a.owner.kind === 'general' && a.owner.skillId === skill);

  it('Instigate: against a non-ally holding 1 card or fewer; not when all hold plenty', () => {
    const t = (n: number) => table({ 'seat-b:hand': cards('b', n), 'seat-d:hand': cards('d', n) }, { generals: generals('jiang-wei'), kingdoms });
    expect(offered(t(1), 'instigate')).toBe(true);
    expect(decide(t(0)).kind).toBe('UseSkillAction');
    expect(decide(t(3)).kind).not.toBe('UseSkillAction');
  });

  it('Direct Instruction: places equipment on an ally with the slot free', () => {
    const t = (kd: Record<string, 'Wei' | 'Shu' | 'Wu' | 'Qun'>) => table({ 'seat-a:hand': [card('cb', 'crossbow', 'club')] }, { generals: generals('zhang-zhao-and-zhang-hong'), kingdoms: kd });
    expect(decide(t(kingdoms)).kind).toBe('UseSkillAction');
    expect(decide(t({ 'seat-a': 'Wei', 'seat-b': 'Shu', 'seat-c': 'Wu', 'seat-d': 'Qun' })).kind).not.toBe('UseSkillAction');
  });
});

describe('the Instigate window', () => {
  it('answers with a Sha when it holds one, at Jiang Wei if he is a non-ally; else passes', () => {
    const open = (hasSha: boolean, ally: boolean) => {
      const t = table({ 'seat-b:hand': hasSha ? [card('s1', 'sha')] : [] }, { kingdoms: { 'seat-a': ally ? 'Wei' : 'Qun', 'seat-b': 'Wei', 'seat-c': 'Shu', 'seat-d': 'Wu' } });
      return {
        ...t,
        pendingResponse: {
          id: 'w', respondingSeatId: 'seat-b', allowedActionKinds: ['RespondAction', 'PassAction'], allowedCardIds: ['sha'],
          reason: { kind: 'ability' as const, owner: general('seat-a', 'instigate'), abilityId: 'instigate', targetSeatId: 'seat-a' },
          context: { effect: { kind: 'LoseHpEffect' as const, seatId: 'seat-b', amount: 1 } },
        },
      };
    };
    expect(decide(open(true, false)).kind).toBe('RespondAction');
    expect(decide(open(false, false)).kind).toBe('PassAction');
    expect(decide(open(true, true)).kind).toBe('PassAction');
  });
});

describe('Strategic Pass', () => {
  it('uses a Farm as Steal at a non-ally holding cards', () => {
    const s = table({ 'seat-a:stash': [card('f1', 'shan', 'spade', 3)], 'seat-c:hand': [card('x', 'sha')] }, { generals: generals('deng-ai'), kingdoms });
    const awake = { ...s, seats: s.seats.map((x) => (x.id === 'seat-a' ? { ...x, marks: { 'awakened:strategic-pass': 1 } } : x)) };
    const action = decide(awake);
    expect(action.kind).toBe('UseConversionAction');
    expect(act(awake, action).pendingChoice).toBeDefined();
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx jest projects/bots/src/lib/mountain.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement** `bots/src/lib/mountain.ts`

```ts
import type { ContentRegistry, GameState, PendingChoice, PendingSelection, Seat } from 'engine';
import { cardCountsAs } from 'engine';
import { handCards, isAlly, keepRank, leastUseful } from './helpers';

// The stage 11 spec's bot rules for the Mountain skills.

const others = (view: GameState, me: Seat) => view.seats.filter((s) => !s.eliminated && s.id !== me.id);
const handSize = (view: GameState, seat: Seat) => view.zones.find((z) => z.id === seat.hand.zoneId)?.cards.length ?? 0;
const ours = (me: Seat, seat: Seat) => seat.id === me.id || isAlly(me, seat);
const zoneOf = (view: GameState, zoneId: string) => view.zones.find((z) => z.id === zoneId);
const seatsOf = (view: GameState, choice: PendingChoice) =>
  choice.options.flatMap((o) => (o.shows.kind === 'seat' ? [view.seats.find((s) => s.id === (o.shows as { seatId: string }).seatId)!] : []));

export interface BotMove { from: string; to: string; cardId: string }

// Clever Change's Play Phase move: a delayed Tool off our side onto a non-ally
// not holding one of that name, else a worn card off a non-ally onto our side
// where its slot is free.
export function bestMove(view: GameState, me: Seat, registry: ContentRegistry): BotMove | null {
  const living = view.seats.filter((s) => !s.eliminated);
  for (const from of living.filter((s) => ours(me, s))) {
    const judged = zoneOf(view, from.judgment.zoneId);
    for (const card of judged?.cards ?? []) {
      const name = cardCountsAs(judged!, card);
      const to = living.find((s) => {
        const there = zoneOf(view, s.judgment.zoneId);
        return !ours(me, s) && !(there?.cards ?? []).some((d) => cardCountsAs(there!, d) === name);
      });
      if (to) return { from: from.id, to: to.id, cardId: card.instanceId };
    }
  }
  const slotOf = (definitionId: string) => registry.cards.get(definitionId)?.equipSlot;
  for (const from of living.filter((s) => !ours(me, s))) {
    for (const card of zoneOf(view, from.equipped.zoneId)?.cards ?? []) {
      const slot = slotOf(card.definitionId);
      const to = slot && living.find((s) => ours(me, s) && !(zoneOf(view, s.equipped.zoneId)?.cards ?? []).some((w) => slotOf(w.definitionId) === slot));
      if (to) return { from: from.id, to: to.id, cardId: card.instanceId };
    }
  }
  return null;
}

// Zuo Ci's preference among Form skills: ones the bots can play, best first.
const FORM_PREFERENCE = ['brave-gesture', 'gathering-wisdom', 'astrology', 'kindness', 'reconsider', 'pleasure', 'lament', 'instigate'];

// The Lament's source, read off the ask's Use effects (the step it will queue).
function lamentSource(choice: PendingChoice): string | undefined {
  const step = choice.options.find((o) => o.id === 'use')?.effects[0] as { data?: Record<string, unknown> } | undefined;
  return step?.data?.['source'] as string | undefined;
}

export function wantsMountain(view: GameState, me: Seat, choice: PendingChoice, registry: ContentRegistry): boolean | null {
  if (choice.reason.kind !== 'ability') return null;
  switch (choice.reason.abilityId) {
    case 'military-farm':
    case 'incarnation':
    case 'stubborn':
      return true;
    case 'decentralization':
      return handCards(view, me).length > 3;
    case 'lament': {
      const victim = view.seats.find((s) => s.id === choice.reason.targetSeatId);
      const source = view.seats.find((s) => s.id === lamentSource(choice));
      // Good for its own side; a club or spade must not land on an ally.
      return !!victim && ours(me, victim) && (!source || source.id === victim.id || !ours(me, source));
    }
    case 'clever-change': {
      // Draw: two non-allies with hands worth taking from. Play: a move that helps. Never Judgment or Discard.
      if (view.phase === 'Draw') return others(view, me).filter((s) => !isAlly(me, s) && handSize(view, s) >= 2).length >= 2;
      if (view.phase === 'Play') return bestMove(view, me, registry) !== null;
      return false;
    }
    default:
      return null;
  }
}

export function wantsMountainActive(view: GameState, me: Seat, skillId: string, registry: ContentRegistry): boolean | null {
  switch (skillId) {
    case 'instigate':
      return others(view, me).some((s) => !isAlly(me, s) && handSize(view, s) <= 1);
    case 'direct-instruction': {
      const slotOf = (id: string) => registry.cards.get(id)?.equipSlot;
      const equipment = handCards(view, me).filter((c) => registry.cards.get(c.definitionId)?.category === 'equipment');
      return equipment.some((c) =>
        others(view, me).some((s) => isAlly(me, s) && !(zoneOf(view, s.equipped.zoneId)?.cards ?? []).some((w) => slotOf(w.definitionId) === slotOf(c.definitionId)))
      );
    }
    default:
      return null;
  }
}

export function mountainChoice(view: GameState, me: Seat, choice: PendingChoice, registry: ContentRegistry): string | null {
  if (choice.reason.kind !== 'ability') return null;
  const seats = seatsOf(view, choice);
  const ally = seats.find((s) => s.id !== me.id && isAlly(me, s));
  switch (choice.reason.abilityId) {
    case 'follow-the-master':
      return choice.options.some((o) => o.id === 'recover') ? 'recover' : null;
    case 'incarnation': {
      const skillOf = (id: string) => id.split('/')[1];
      const best = FORM_PREFERENCE.find((skill) => choice.options.some((o) => skillOf(o.id) === skill));
      return (choice.options.find((o) => skillOf(o.id) === best) ?? choice.options[0])?.id ?? null;
    }
    case 'decentralization': {
      const allies = seats.filter((s) => s.id !== me.id && isAlly(me, s)).sort((a, b) => handSize(view, b) - handSize(view, a) || a.index - b.index);
      const foes = seats.filter((s) => !isAlly(me, s)).sort((a, b) => handSize(view, a) - handSize(view, b) || a.index - b.index);
      return (allies[0] ?? foes[0] ?? seats[0])?.id ?? null;
    }
    case 'direct-instruction':
      return (ally ?? seats[0])?.id ?? null;
    case 'clever-change': {
      const move = bestMove(view, me, registry);
      const cardOptions = choice.options.every((o) => o.shows.kind === 'card');
      const want = move ? (cardOptions ? move.cardId : move.to) : null;
      return (choice.options.find((o) => o.id === want) ?? choice.options[0])?.id ?? null;
    }
    case 'stubborn': {
      // Give back the least useful of the discarded cards.
      const ids = choice.options.map((o) => o.id);
      return leastUseful(view, registry, ids)[0] ?? null;
    }
    default:
      return null;
  }
}

export function mountainSelection(view: GameState, me: Seat, selection: PendingSelection, registry: ContentRegistry): string[] | 'cancel' | null {
  if (selection.reason.kind !== 'ability') return null;
  const eligible = selection.eligibleIds;
  const step = selection.then.kind === 'skill-step' ? selection.then.step.step : null;
  // Eligible seats passing `pick`, the fullest hands first (`most`) or the emptiest first.
  const seatsByHand = (pick: (s: Seat) => boolean, order: 'most' | 'fewest') =>
    eligible
      .map((id) => view.seats.find((s) => s.id === id)!)
      .filter((s) => !!s && pick(s))
      .sort((a, b) => (order === 'most' ? handSize(view, b) - handSize(view, a) : handSize(view, a) - handSize(view, b)) || a.index - b.index);
  switch (selection.reason.abilityId) {
    case 'clever-change': {
      if (selection.of === 'cards') return leastUseful(view, registry, eligible).slice(0, 1);
      if (step === 'draw-take') {
        const foes = seatsByHand((s) => !isAlly(me, s), 'most').slice(0, 2).map((s) => s.id);
        return foes.length > 0 ? foes : [eligible[0]];
      }
      const move = bestMove(view, me, registry);
      return [move && eligible.includes(move.from) ? move.from : eligible[0]];
    }
    case 'pleasure': {
      // Pay only with a card it can spare (ranked below Shan).
      const spare = leastUseful(view, registry, eligible).filter((id) => keepRank(view, registry, id) < 3);
      return spare.length > 0 ? [spare[0]] : 'cancel';
    }
    case 'decentralization':
      return leastUseful(view, registry, eligible).slice(0, 1);
    case 'lament': {
      // The payment (cancel when only a Shan or Peach would go) or the club discard (it must pick).
      const least = leastUseful(view, registry, eligible).slice(0, selection.min);
      if (selection.then.kind === 'discard') return least;
      return keepRank(view, registry, least[0]) < 3 ? [least[0]] : 'cancel';
    }
    case 'direct-instruction':
      return eligible.slice(0, 1);
    case 'instigate': {
      const foes = seatsByHand((s) => !isAlly(me, s), 'fewest');
      return foes.length > 0 ? [foes[0].id] : 'cancel';
    }
    default:
      return null;
  }
}
```

- [ ] **Step 4: Wire it in**

In `bots/src/lib/skills.ts`:
- import `{ mountainChoice, mountainSelection, wantsMountain, wantsMountainActive } from './mountain'`;
- `wantsSkill`'s `default:` chain: `... ?? wantsForest(view, me, choice) ?? wantsMountain(view, me, choice, registry)`;
- `skillSelection`'s `default:` chain: `... ?? forestSelection(view, me, selection, registry) ?? mountainSelection(view, me, selection, registry)`;
- `skillChoice`'s `default:` chain: `... ?? forestChoice(view, me, choice, registry) ?? mountainChoice(view, me, choice, registry)`;
- `wantsActive`'s `default:` chain: `... ?? wantsForestActive(view, me, skillId) ?? wantsMountainActive(view, me, skillId, registry) ?? false`;
- `ACTIVE_ORDER.late`: add `'instigate', 'direct-instruction'`;
- `CONVERSION_SKILLS`: add `'strategic-pass'`.

In `bots/src/lib/rule-based.ts`:
- the response branch `reason.kind === 'ability' && reason.abilityId === 'upheaval'` becomes `reason.kind === 'ability' && (reason.abilityId === 'upheaval' || reason.abilityId === 'instigate')` (both name the seat the Sha would hit as `reason.targetSeatId`);
- after `const [breakVia] = conversionsAs('break'); if (breakVia) return take(breakVia);` add `const [stealVia] = conversionsAs('steal'); if (stealVia) return take(stealVia);`.

- [ ] **Step 5: Run the bots, content and engine projects**

Run: `npx jest projects/bots projects/content projects/engine`
Expected: PASS. If the simulator specs (Task 8) fail only for lack of a Mountain batch, that is fine; they are not in this run.

- [ ] **Step 6: Commit**

```bash
git add projects/bots
git commit -m "feat(bots): the Mountain Generals' skills

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Task 8: Simulation

**Files:**
- Create: `projects/sim/src/mountain.spec.ts`
- Modify: `projects/sim/src/forcedPairing.ts` (the spare pool follows a forced pairing), `projects/sim/src/invariants.ts` only if a check needs it

**Interfaces:**
- Consumes: all of Tasks 1–7; `registryWith`, `partnerOf`, `withForcedPairing`, `firedSkills` from `forcedPairing.ts`; `MOUNTAIN_GENERAL_IDS` etc. from `content`.
- Produces: the stage's whole-game proof.

- [ ] **Step 1: The forced pairing keeps the spare pool disjoint**

`withForcedPairing` re-deals the candidates; a General forced into a seat could also lie in the spare pool, which would let it be both played and a Form. In `forcedPairing.ts`, return
```ts
  return {
    ...state,
    generalSelection: { candidates: next },
    ...(state.spareGenerals ? { spareGenerals: state.spareGenerals.filter((id) => !pair.includes(id)) } : {}),
  };
```

- [ ] **Step 2: Write the spec** `sim/src/mountain.spec.ts`

```ts
import { createGame } from 'engine';
import type { GameState } from 'engine';
import { BASE_GENERAL_IDS, FIRE_GENERAL_IDS, FOREST_GENERAL_IDS, MOUNTAIN_GENERAL_IDS, WIND_GENERAL_IDS, buildContentRegistry, kingdomWarMode } from 'content';
import { runGame } from './runGame';
import { checkInvariants, checkRestingState } from './invariants';
import { firedSkills, partnerOf, registryWith, withForcedPairing } from './forcedPairing';

const POOL = [...BASE_GENERAL_IDS, ...WIND_GENERAL_IDS, ...FIRE_GENERAL_IDS, ...FOREST_GENERAL_IDS, ...MOUNTAIN_GENERAL_IDS];
const registry = registryWith(buildContentRegistry(), POOL);
const ctx = { registry, mode: kingdomWarMode };
// Skills with no trace of their own in the log: Lord skills are left out below.
const NO_TRACE = new Set<string>([]);

function checked(state: GameState, label: string, failures: string[]) {
  const violations = checkInvariants(state, registry);
  if (violations.length > 0) failures.push(`${label}: ${violations.join('; ')}`);
  if (!state.result) failures.push(`${label}: did not terminate`);
  if (JSON.stringify(JSON.parse(JSON.stringify(state))) !== JSON.stringify(state)) failures.push(`${label}: not serialisable`);
}

describe('simulated games with the base, Wind, Fire, Forest and Mountain Generals (57)', () => {
  it('2, 5 and 8 seats, random and rule-based bots: they finish, with no invariant broken', () => {
    const failures: string[] = [];
    let seed = 5000;
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

  it('each Mountain General, dealt to seat-0 with a same-kingdom partner, fires every skill that leaves a trace', () => {
    const missing: string[] = [];
    const failures: string[] = [];
    for (const generalId of MOUNTAIN_GENERAL_IDS) {
      const expected = (registry.generals.get(generalId)?.skills ?? []).filter((s) => !s.lord).map((s) => s.id).filter((id) => !NO_TRACE.has(id));
      const fired = new Set<string>();
      for (let seed = 1; seed <= 120 && expected.some((id) => !fired.has(id)); seed++) {
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
  }, 1800000);

  it('Zuo Ci holds Forms from the first turn, and no Form is also a General in play', () => {
    const failures: string[] = [];
    for (let seed = 1; seed <= 20; seed++) {
      const initial = withForcedPairing(createGame(kingdomWarMode, registry, ['seat-0', 'seat-1', 'seat-2', 'seat-3'], seed), 'seat-0', ['zuo-ci', partnerOf('zuo-ci', registry, POOL)]);
      const { finalState } = runGame(initial, ctx, seed, 20000, 'rule-based');
      const forms = finalState.seats[0].forms;
      if (!forms || forms.held.length < 2) failures.push(`seed ${seed}: Zuo Ci holds ${forms?.held.length ?? 0} Forms`);
      const inPlay = finalState.seats.flatMap((s) => (s.generals ? [s.generals.main.generalDefinitionId, s.generals.deputy.generalDefinitionId] : []));
      if (forms?.held.some((id) => inPlay.includes(id))) failures.push(`seed ${seed}: a Form is also in play`);
    }
    expect(failures).toEqual([]);
  }, 600000);
});
```

- [ ] **Step 3: Run**

Run: `npx jest projects/sim/src/mountain.spec.ts`
Expected: PASS. A failure here is a real finding: diagnose with `systematic-debugging`, fix under TDD in the project that owns the fault (a failing spec first), and ledger it. Typical ones: a resting state with a pending decision a bot cannot answer (add the bot rule and a bots spec), an invariant on the new zone (a stash card left with an eliminated seat), a skill that never fires in 120 seeds (check its bot rule fires; a skill that cannot leave a trace goes in `NO_TRACE` with a comment saying why, and a ruling).

- [ ] **Step 4: Run the whole suite**

Run: `npx jest`
Expected: PASS everywhere except any failure that was already there before this stage (say so by name in the report).

- [ ] **Step 5: Commit**

```bash
git add projects/sim
git commit -m "test(sim): the Mountain batch and forced pairings

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Task 9: App

**Files:**
- Modify: `projects/content/src/lib/display.ts` (hints, selection, seat-pick and choice prompts, step texts) and `display.spec.ts`; `projects/app/src/app/game-board/seat-tile.ts`, `round-table.ts`, `game-board.ts`, `action-history.ts`, `response-description.ts` and their specs

**Interfaces:**
- Consumes: Tasks 1–7; the stage 10 text patterns in `display.ts`, `action-history.ts`, `response-description.ts`.
- Produces: the visible stage 11 UI. All text follows CLAUDE.md's UI text style.

- [ ] **Step 1: Write the failing specs**

`content/src/lib/display.spec.ts` — add:
```ts
describe('Mountain texts', () => {
  it('names a hint for each skill the player is asked about', () => {
    for (const id of ['clever-change', 'military-farm', 'decentralization', 'stubborn', 'lament', 'incarnation', 'instigate', 'direct-instruction']) expect(abilityHint(id)).toBeTruthy();
  });

  it('words the skills’ selections, seat picks and choices', () => {
    expect(selectionText('clever-change')?.confirm).toBe('Discard');
    expect(selectionText('pleasure')?.cancel).toBe('Give Up');
    expect(stepSelectionText('draw-take')?.prompt).toBe('Choose up to 2 seats to take a hand card from');
    expect(stepSelectionText('move-card')?.prompt).toBe('Choose a seat to move a card from');
    expect(seatPickText('clever-change')).toBe('Choose a seat to move the card to');
    expect(choicePromptText('incarnation')).toBe('Choose a Form skill');
    expect(choicePromptText('stubborn')).toBe('Choose a card to give back; you take the others');
  });
});
```
`app/src/app/game-board/action-history.spec.ts` — add, next to the Forest skills' test:
```ts
    it('the Mountain skills', () => {
      const line = (skillId: string, outcome: string, targetSeatId?: string) =>
        texts([{ kind: 'AbilityUsedEvent', owner: general('seat-0', skillId), abilityId: skillId, outcome, ...(targetSeatId ? { targetSeatId } : {}) }]);
      expect(line('clever-change', 'skipped-judgment')).toEqual(['Seat 0 skipped their Judgment Phase with Clever Change']);
      expect(line('clever-change', 'skipped-draw')).toEqual(['Seat 0 skipped their Draw Phase with Clever Change']);
      expect(line('clever-change', 'skipped-play')).toEqual(['Seat 0 skipped their Play Phase with Clever Change']);
      expect(line('clever-change', 'skipped-discard')).toEqual(['Seat 0 skipped their Discard Phase with Clever Change']);
      expect(line('clever-change', 'moved-card', 'seat-1')).toEqual(['Seat 0 moved a card to Seat 1 (Clever Change)']);
      expect(line('military-farm', 'farmed')).toEqual(["Seat 0's Military Farm: the judged card becomes a Farm"]);
      expect(line('strategic-pass', 'awakened')).toEqual(['Seat 0 awakened: Strategic Pass']);
      expect(line('pleasure', 'paid', 'seat-1')).toEqual(["Seat 1 discarded a Basic card for Seat 0's Pleasure"]);
      expect(line('decentralization', 'extra-turn', 'seat-1')).toEqual(['Seat 0 gave Seat 1 an extra turn (Decentralization)']);
      expect(line('passion', 'drew')).toEqual(['Seat 0 drew a card (Passion)']);
      expect(line('direct-instruction', 'placed', 'seat-1')).toEqual(["Seat 0 placed an Equipment card in Seat 1's equipment (Direct Instruction)"]);
      expect(line('stubborn', 'gave-back', 'seat-1')).toEqual(['Seat 0 gave a discarded card back to Seat 1 and took the rest (Stubborn)']);
      expect(line('lament', 'lamented', 'seat-1')).toEqual(["Seat 0's Lament: Seat 1 judges"]);
      expect(line('heartbroken', 'silenced', 'seat-1')).toEqual(['Seat 1 loses all skills (Heartbroken)']);
      expect(line('new-life', 'new-form')).toEqual(['Seat 0 gained a Form (New Life)']);
      expect(texts([{ kind: 'SkillGainedEvent', seatId: 'seat-0', slot: 'main', skillId: 'astrology' }])).toEqual(['Seat 0 gained Astrology']);
      expect(texts([{ kind: 'FormChosenEvent', seatId: 'seat-0', generalId: 'zhou-yu', skillId: 'brave-gesture' }])).toEqual(['Seat 0 chose Brave Gesture from Zhou Yu']);
      // The events these lines already say.
      expect(texts([{ kind: 'SeatSilencedEvent', seatId: 'seat-1' }, { kind: 'ExtraTurnGrantedEvent', seatId: 'seat-1' }])).toEqual([]);
    });
```

`app/.../seat-tile.spec.ts` — add:
```ts
  it('shows the Farms under the General, face up', () => {
    const el = render(makeSeat(), { stash: [{ instanceId: 'f1', definitionId: 'shan', suit: 'spade', rank: 3 }] });
    expect(el.querySelectorAll('[aria-label="Farms"] app-playing-card')).toHaveLength(1);
  });

  it('shows the chosen Form and a silenced seat', () => {
    const forms = { slot: 'main' as const, held: ['hidden'], chosen: { generalId: 'zhou-yu', skillId: 'brave-gesture' } };
    expect(render(makeSeat({ forms }), {}).querySelector('.form-badge')?.textContent?.trim()).toBe('Form: Zhou Yu');
    expect(render(makeSeat({ silenced: true }), {}).querySelector('.silenced-badge')?.textContent?.trim()).toBe('No Skills');
    expect(render(makeSeat(), {}).querySelector('.silenced-badge')).toBeNull();
  });
```
(add `stash?: CardInstance[]` to `render`'s options and `fixture.componentRef.setInput('stash', ...)`.)

`app/src/app/game-board/response-description.spec.ts` — add, after the Upheaval window's tests:
```ts
describe('the Instigate window', () => {
  const owner = { kind: 'general' as const, seatId: 'seat-0', slot: 'main' as const, skillId: 'instigate' };
  const window: PendingResponse = {
    id: 'i', respondingSeatId: 'seat-1', allowedActionKinds: ['RespondAction', 'PassAction'], allowedCardIds: ['sha'],
    reason: { kind: 'ability', owner, abilityId: 'instigate', targetSeatId: 'seat-0' },
    context: { effect: { kind: 'SkillStepEffect', owner, step: 'penalty', data: { seatId: 'seat-1' } } },
  };

  it('asks for a Sha at the instigator, or a card', () => {
    expect(describeResponse(state([], window), 'seat-1')).toMatchObject({
      source: 'Hing used Instigate',
      prompt: 'Play a Sha at Hing, or discard a card?',
      outcome: 'Hing discards one of your cards',
    });
  });

  it('says who is waited on', () => {
    expect(waitingLine(state([], window))).toBe('Waiting on Seat 1 to play a Sha for Instigate');
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx jest projects/content/src/lib/display.spec.ts projects/app/src/app/game-board/action-history.spec.ts projects/app/src/app/game-board/seat-tile.spec.ts projects/app/src/app/game-board/response-description.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the texts** in `content/src/lib/display.ts`

- `ABILITY_HINTS`:
```ts
  'clever-change': 'Discard a hand card to skip this phase',
  'military-farm': 'Judge: a card that is not a heart becomes a Farm under your General',
  decentralization: 'Skip your Play Phase; at the end of your turn another seat takes an extra turn',
  stubborn: 'Give one of the discarded cards back and take the rest',
  lament: 'Discard a card: {target} judges, and a heart, diamond, club or spade has its effect',
  incarnation: 'Choose a skill of one of your Forms',
  instigate: 'Choose a seat to play a Sha at you, or you discard one of its cards',
  'direct-instruction': "Place an Equipment card from your hand in another seat's empty slot, then draw 1 card",
```
- `SELECTION_TEXT`:
```ts
  'clever-change': { prompt: 'Choose a hand card to discard to skip the phase', confirm: 'Discard' },
  pleasure: { prompt: 'Choose a Basic card to discard, or the Sha has no effect', confirm: 'Discard', cancel: 'Give Up' },
  decentralization: { prompt: 'Choose a hand card to discard', confirm: 'Discard' },
  lament: { prompt: 'Choose cards to discard', confirm: 'Discard' },
  'direct-instruction': { prompt: 'Choose an Equipment card to place', confirm: 'Place' },
  instigate: { prompt: 'Choose a seat to play a Sha at you', confirm: 'Choose' },
```
- `SEAT_PICK_TEXT`: `'clever-change': 'Choose a seat to move the card to'`, `decentralization: 'Choose a seat to take an extra turn'`, `'direct-instruction': 'Choose a seat to place the card in'`.
- `CHOICE_PROMPT_TEXT`: `'clever-change': 'Choose a card to move'`, `'follow-the-master': 'Choose how Follow the Master helps you'`, `incarnation: 'Choose a Form skill'`, `stubborn: 'Choose a card to give back; you take the others'`.
- `STEP_SELECTION_TEXT`: `'draw-take': { prompt: 'Choose up to 2 seats to take a hand card from', confirm: 'Take' }`, `'move-card': { prompt: 'Choose a seat to move a card from', confirm: 'Choose' }`.

- [ ] **Step 4: Implement the history lines** in `app/.../action-history.ts`

Inside the `AbilityUsedEvent` chain (after the `swapped` branch), add one branch per outcome the new history test expects (use `name(...)` and `abilityName(...)` as the existing branches do; `skipped-*` takes the phase name from the outcome's suffix with the first letter capitalised). Add cases for the events:
```ts
      case 'SkillGainedEvent':
        action(`${name(event.seatId)} gained ${abilityName(event.skillId)}`);
        break;
      case 'FormChosenEvent':
        action(`${name(event.seatId)} chose ${abilityName(event.skillId)} from ${generalDisplayData(event.generalId)?.name ?? 'a Form'}`);
        break;
```
(`SeatSilencedEvent`, `ExtraTurnGrantedEvent` get no case; make sure the `switch` has no exhaustive-check that fails on them.)

- [ ] **Step 5: Implement the seat tile and the Instigate window**

`seat-tile.ts`: add `readonly stash = input<CardInstance[]>([]);`; under the `pile` block add
```html
        @if (stash().length) {
          <div class="pile" aria-label="Farms">
            @for (card of stash(); track card.instanceId) {
              <app-playing-card size="small" [card]="card" />
            }
          </div>
        }
        @if (formName(); as form) {
          <span class="form-badge">Form: {{ form }}</span>
        }
        @if (seat().silenced) {
          <span class="silenced-badge">No Skills</span>
        }
```
with `readonly formName = computed(() => { const g = this.seat().forms?.chosen?.generalId; return g ? (generalDisplayData(g)?.name ?? null) : null; });` and matching small styles beside `.face-down-badge`'s. In `round-table.ts` pass `[stash]="judgmentOf(p.seat.stash?.zoneId ?? '')"` and in `game-board.ts` `[stash]="zoneCards(seat.stash?.zoneId ?? '')"`, next to each `[pile]`.

`response-description.ts`: next to the Upheaval branch add an Instigate one:
```ts
  // Instigate: play a Sha at its user, or have a card discarded.
  if (pending.reason?.kind === 'ability' && pending.reason.abilityId === 'instigate') {
    const { owner } = pending.reason;
    const you = pending.respondingSeatId === viewerSeatId;
    const instigator = owner.seatId === viewerSeatId ? 'you' : name(owner.seatId);
    return {
      source: `${name(owner.seatId)} used ${abilityName('instigate')}`,
      latest: null,
      prompt: `Play a Sha at ${instigator}, or discard a card?`,
      outcome: you ? `${name(owner.seatId)} discards one of your cards` : `${name(owner.seatId)} discards one of ${name(pending.respondingSeatId)}'s cards`,
      outcomeForce: forceOf(state.seats.find((s) => s.id === pending.respondingSeatId)?.kingdom),
    };
  }
```
and in the waiting-line function (where `upheaval` has `${who} to play a Sha for ...`) add `if (reason?.kind === 'ability' && reason.abilityId === 'instigate') return `${who} to play a Sha for ${abilityName('instigate')}`;`.

Also check `choice-description.ts`: a pick with card options and verb `'pick'` takes the `fixed` prompt from `choicePromptText` (Clever Change, Stubborn); no change needed.

- [ ] **Step 6: Run**

Run: `npx jest projects/content projects/app`
Expected: PASS. (`projects/app/src/app/game-board/game-board.spec.ts` has a TypeScript syntax error at line 502 under the app's spec config that is not from this stage; Jest passes. Say so in the report if it still shows.)

- [ ] **Step 7: Commit**

```bash
git add projects/content projects/app
git commit -m "feat(app): Farms, Forms, the silenced marker, the Instigate window and Mountain history lines

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Task 10: Docs

**Files:**
- Modify: `docs/architecture/event-chain.md` (a "Mountain hooks" section), `docs/superpowers/specs/2026-10-05-all-cards-and-skills-roadmap-design.md` (row 11 done), `docs/superpowers/specs/2026-10-09-stage-11-mountain-generals-design.md` (status Built; "Rulings made while building")

**Interfaces:** none.

- [ ] **Step 1: The event-chain note**

Add a "Mountain hooks" section to `docs/architecture/event-chain.md` in the style of the "Forest hooks" one, covering: skills gained for good (`GainSkillEffect`, `Seat.gainedSkills`, read by `skillsInPlay`), awakening (the `awakened:<id>` seat mark, `awakeningAtTurnStart`), silencing (`SilenceSeatEffect`, `skillsInPlay` returns nothing), spare Generals (`DealSpareGeneralsEffect`, `Seat.forms`, `GameState.spareGenerals`, `ChooseFormSkillEffect`, secret choices), the killer (`DyingEffect.killerSeatId` → `SeatEliminatedEvent.killerSeatId`, and the `afterDeath` gather), extra turns (`GrantExtraTurnEffect`, `Turn.resumeAfterSeatId`), the stash pile and `Conversion.from: 'stash'`, `distanceToOthersFrom`, and how Clever Change reaches each phase.

- [ ] **Step 2: The roadmap and the spec**

Roadmap row 11: `| 11 | The Mountain Generals' skills (done 2026-10-09) | [Stage 11 spec](2026-10-09-stage-11-mountain-generals-design.md) |`, and update its closing sentence if it says stages are pending. Stage 11 spec: `Status: Built`, and fill "Rulings made while building" from the ledger's `Ruling:` lines (or say "none" if there are none).

- [ ] **Step 3: Verify and commit**

Run: `npx jest`
Expected: PASS (as in Task 8, naming any pre-existing failure).

```bash
git add docs
git commit -m "docs: stage 11 event chain, roadmap status and rulings

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```
