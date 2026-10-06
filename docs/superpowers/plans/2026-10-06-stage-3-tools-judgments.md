# Tools Stage 3: Judgments — Capture, Lightning, Starvation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
- Give the engine **judgments** (turn up the draw pile's top card and let a card read it), **delayed Tools** (cards that sit in a seat's judgment area until its Judgment Phase), and **turn flags** that skip a phase.
- Make Capture, Lightning and Starvation playable at their printed counts. The deck goes from 85 to 91 cards (Capture 3, Lightning 1, Starvation 2).
- Give every seat a **Judgment slot** (`Seat.judgment`, beside `hand` and `equipped`). Delayed Tools are placed there rather than going to the discard pile, and several Tools on one seat resolve last in, first out.
- Show each seat's Judgment slot (empty or not), judgments, skipped phases and Lightning moving on, at the table and in the Action History.

**Architecture:**
- **The engine.**
  - `Seat.judgment: CardZoneRef` names the seat's judgment zone (`${seatId}:judgment`), like `hand` and `equipped`. `judgmentZoneOf(state, seatId)` finds it.
  - `CardDefinition.delayed` makes `PlayCardAction` leave the card where `play()` puts it (a judgment area), as it already does for Equipment.
  - `JudgeEffect` turns up one card into `processing`, logs `JudgmentEvent`, queues the delayed Tool's `onJudged` results, then discards the judged card.
  - `DelayedCleanupEffect` ends a delayed Tool's turn in the Judgment Phase: the card's `onCleanup`, or by default a discard if it is still in its owner's judgment area.
  - `Turn.flags` and `SetTurnFlagEffect`. `advancePhaseOrTurn` passes over a phase whose skip flag (`skipFlagOf(phase)`, e.g. `skipPlay`) is set, and `enterNextPhase` logs a `PhaseSkippedEvent` for it.
- **Content.**
  - `shared/delayed.ts`: `skipPhaseTool` builds Capture and Starvation, plus helpers and Kingdom War's `judgmentPhaseTrigger`.
  - The trigger queues, for each card in the turn owner's Judgment slot, last in, first out, a `ToolOnTargetEffect` (so the existing Wuxie check guards the judgment) then a `DelayedCleanupEffect` (which always runs).
  - `cards/lightning.ts` has its own `onJudged` and `onCleanup`.
  - Kingdom War sets up each seat's judgment zone (Task 1).
- **Around the engine.** Bots place Capture, Starvation and Lightning by the spec's rules, and cancel Starvation aimed at them. The sim checks judgment areas. The app shows judgment cards on each seat tile, explains the Wuxie question about a judgment, and gets new Action History lines.

**Tech Stack:** TypeScript, Jest (ts-jest), Angular 22 (app tasks).

**Spec:**
- `docs/superpowers/specs/2026-10-05-tools-design.md`: "Stage 3", "Engine design → Judgments (stage 3)", Bots, UI, Testing.
- `docs/superpowers/specs/2026-10-05-all-cards-and-skills-roadmap-design.md`, "Amendments to the Tools spec (stage 3)": Lightning deals plain damage, and Starvation joins this stage.

**Where this plan departs from the spec's sketch, and why:**
- **`Seat.judgment` is required**, as the spec sketches it (user decision, 2026-10-06: every seat has a Judgment slot). Every hand-written `Seat` fixture gains the field. Task 1 does that with one scripted rewrite.
- **`JudgmentEvent` carries `tool: UsedCard`**, not `forCardInstanceId`. The Action History needs the Tool's name ("Hing's Lightning judgment: 5 ♠"), and a `UsedCard` is what the rest of the lifecycle carries.
- **Cleanup is a card hook (`onCleanup`), with a default.** The spec gives each delayed Tool its own cleanup, and the engine names no card. The default (discard the card if it's still in the owner's judgment area) covers Capture and Starvation. Lightning overrides it.
- **Skip flags are named by phase.** `skipFlagOf('Play')` is `'skipPlay'`, as the spec names it. Any phase can be skipped the same way, so the General Skills spec's `skipDiscard` needs no engine change.
- **A skipped phase is logged** (`PhaseSkippedEvent`), so the table can say why a seat had no Play Phase.
- **The Wuxie check on a judgment starts with the judged seat.** The trigger passes the owner as the Tool's user, because the zone doesn't remember who placed the card. The app recognises a judgment by the Tool still lying in a judgment area, and words its question to match.
- **A judgment with no card left anywhere** (empty draw pile and discard pile) does nothing: nothing is logged, and `onJudged` isn't called. The delayed Tool's cleanup still runs.
- **The judgment step isn't split yet.** The General Skills spec later splits `JudgeEffect` into three steps for judgment-changing skills. Stage 3 keeps one step, as the Tools spec says.

## Global Constraints

- **The engine names no card or skill.** Content supplies everything card-specific (CLAUDE.md, "Extensibility").
- **Game state stays plain serialisable data.** `Turn.flags` is absent (never `{}`) until a flag is set, and a new turn starts without flags.
- **Printed counts (own printings only):** Capture 3 (6 ♠, 6 ♣, 6 ♥), Lightning 1 (A ♠; the EX Q ♥ stays out), Starvation 2 (10 ♠, 4 ♣). The deck goes from 85 to 91.
- **Rule text (Tools spec, Stage 3, with the roadmap's amendments):**
  - **Judgment:** the top card of the draw pile is turned face-up, read, and then put in the discard pile.
  - **Capture** (delayed): placed in another living seat's judgment area. A seat can't hold two Captures. In that seat's next Judgment Phase it is judged. Anything but a heart means the seat skips that turn's Play Phase. Capture is then discarded. If a Wuxie Kongjie cancels it, it is discarded without a judgment.
  - **Starvation** (delayed): placed in the judgment area of another living seat at distance 1 (`seatDistance`, so horses count). A seat can't hold two Starvations. Judged in that seat's next Judgment Phase: anything but a club means the seat skips that turn's Draw Phase. Starvation is then discarded. If a Wuxie Kongjie cancels it, it is discarded without a judgment.
  - **Lightning** (delayed): placed in the user's own judgment area. A seat can't hold two Lightnings. Judged in the holder's next Judgment Phase.
    - A **spade from 2 to 9** deals 3 **plain** damage (`nature: 'normal'`) to the holder, with no source. Lightning is then discarded.
    - Anything else moves Lightning to the next living seat in seat order that doesn't already hold a Lightning, face-up into its judgment area. If no such seat exists, it stays.
    - If a Wuxie Kongjie cancels it, there is no judgment, and it moves on as above.
  - **Order:** a seat's delayed Tools are judged one at a time, **last in, first out** (the newest first).
  - **Placement:** a delayed Tool never goes straight to the discard pile when played. It is placed in the target's Judgment slot, and it leaves only when judged, cancelled, moved on (Lightning), or taken by Steal or Break.
  - **Wuxie:** a delayed Tool's Wuxie check happens when it is judged, not when it is placed.
- **Bots (spec, plus the roadmap):**
  - **Capture:** on the highest-HP non-ally.
  - **Lightning:** when the bot's HP is at least 3.
  - **Starvation:** on the non-ally in reach with the most hand cards.
  - **Wuxie:** cancel a harmful Tool aimed at the bot itself. Capture and Lightning are already on the harmful list; Starvation joins it.
- **The seat tile always shows a Judgment slot**, with a placeholder while it's empty, as the equipment slots do.
- **UI text** follows CLAUDE.md's UI text style. Labels are Title Case ("Judgment Area"). Prompts and Action History lines are sentence case. Card names, seat names and phase names keep their capitals ("Hing skipped the Play Phase").
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Lightning kills its holder in their own Judgment Phase.** Nobody saves them, so the seat is eliminated. Lightning is discarded, and any other delayed Tool the seat held is discarded without a judgment. The turn passes to the next seat, and nothing crashes. (Test in Task 5.)
2. **No card left to judge with** (empty draw pile and discard pile). Nothing is logged, the delayed Tool reads nothing, its cleanup still runs, and play goes on. (Test in Task 3.)
3. **Two delayed Tools on one seat.** They are judged last in, first out, each with its own judgment. Capture and Starvation both landing skips Draw and Play, and the next turn starts with no flags. (Test in Task 4.)
4. **Lightning with nowhere to go.** Every other living seat already holds a Lightning, so it stays where it is. (Test in Task 5.)
5. **A delayed Tool taken out of a judgment area before it is judged** (Break picks it). It is never judged, and the seat plays its turn as usual. (Test in Task 4.)

---

## File Structure

**Engine (`projects/engine/src/lib/`)**
- Modify:
  - `domain/types.ts` (`Seat.judgment`, `Turn.flags`), `domain/factories.ts` (`createSeat`)
  - `registry/types.ts` (`delayed`, `onJudged`, `onCleanup`, `JudgedContext`, `DelayedToolContext`)
  - `cards/zones.ts` (`judgmentZoneOf`)
  - `rules/phaseSequence.ts` (`skipFlagOf`, skipping in `advancePhaseOrTurn`)
  - `pipeline/effects.ts` (`SetTurnFlagEffect`, `JudgeEffect`, `DelayedCleanupEffect`)
  - `pipeline/events.ts` (`PhaseSkippedEvent`, `JudgmentEvent`)
  - `pipeline/resolve.ts` (log skipped phases, route judgment effects, leave delayed cards where `play()` puts them)
  - `public-api.ts`
- Create: `pipeline/judgment.ts`, `pipeline/judgment.spec.ts`.
- Modify tests: `rules/phaseSequence.spec.ts`, `cards/zones.spec.ts`, `domain/factories.spec.ts`. Every `Seat` fixture across the projects gains `judgment` (Task 1).

**Content (`projects/content/src/lib/`)**
- Create: `shared/delayed.ts`, `cards/capture.ts`, `cards/starvation.ts`, `cards/lightning.ts`, `cards/delayed.spec.ts`.
- Modify: `modes/kingdomWar.ts`, `registry.ts`, `registry.spec.ts`, `wiki.spec.ts`, `modes/kingdomWar.spec.ts`.

**Bots:** modify `projects/bots/src/lib/rule-based.ts` and `rule-based.spec.ts`.

**Sim:** modify `projects/sim/src/invariants.ts` and `invariants.spec.ts`.

**App (`projects/app/src/app/`)**
- Modify:
  - `game-board/seat-tile.ts` (+spec), `game-board/round-table.ts` (+spec)
  - `game-board/response-description.ts` (+spec), `game-board/action-history.ts` (+spec)
  - `wiki/wiki-pages.spec.ts`

**Docs:** modify `docs/architecture/event-chain.md`.

---

### Task 1: Every seat gets a Judgment slot

**Files:**
- Modify: `projects/engine/src/lib/domain/types.ts`, `domain/factories.ts`, `cards/zones.ts`
- Modify: `projects/content/src/lib/modes/kingdomWar.ts`
- Test: `projects/engine/src/lib/domain/factories.spec.ts`, `projects/engine/src/lib/cards/zones.spec.ts`, `projects/content/src/lib/modes/kingdomWar.spec.ts`
- Modify: every spec file with a hand-written `Seat` (the scripted rewrite in Step 4)

**Interfaces:**
- Produces:
  - `Seat.judgment: CardZoneRef`, whose zone id is `` `${seatId}:judgment` `` by convention.
  - `judgmentZoneOf(state: GameState, seatId: string): CardZone | undefined`, from `cards/zones.ts`.
  - Kingdom War's setup creates `{ id: '<seat>:judgment', kind: 'judgment', ownerSeatId: '<seat>', cards: [] }` for every seat.

- [ ] **Step 1: Write the failing tests**

In `projects/engine/src/lib/domain/factories.spec.ts`, add (adjust the `createSeat` call to the file's existing style):

```ts
  it('gives a seat a Judgment slot next to its hand and equipment', () => {
    const seat = createSeat('seat-a', 0, 'Wei', 'g1', 'g2', () => 4);
    expect(seat.judgment).toEqual({ zoneId: 'seat-a:judgment' });
  });
```

In `projects/engine/src/lib/cards/zones.spec.ts`, add `judgmentZoneOf` to the import from `./zones`, add `GameState` from `'../domain/types'`, then:

```ts
describe('judgmentZoneOf', () => {
  const seat = (id: string) => ({ id, judgment: { zoneId: `${id}:judgment` } });
  const state = {
    seats: [seat('a'), seat('b')],
    zones: [
      { id: 'a:judgment', kind: 'judgment', ownerSeatId: 'a', cards: [] },
      { id: 'b:judgment', kind: 'judgment', ownerSeatId: 'b', cards: [] },
    ],
  } as unknown as GameState;
  it('finds a seat’s Judgment slot through Seat.judgment', () => {
    expect(judgmentZoneOf(state, 'b')?.id).toBe('b:judgment');
  });
  it('is undefined for an unknown seat', () => {
    expect(judgmentZoneOf(state, 'ghost')).toBeUndefined();
  });
});
```

In `projects/content/src/lib/modes/kingdomWar.spec.ts`, next to the processing-zone test:

```ts
  it('gives each seat an empty Judgment slot', () => {
    const state = createGame(kingdomWarMode, buildContentRegistry(), ['seat-0', 'seat-1'], 1);
    expect(state.seats.map((s) => s.judgment)).toEqual([{ zoneId: 'seat-0:judgment' }, { zoneId: 'seat-1:judgment' }]);
    expect(state.zones.filter((z) => z.kind === 'judgment')).toEqual([
      { id: 'seat-0:judgment', kind: 'judgment', ownerSeatId: 'seat-0', cards: [] },
      { id: 'seat-1:judgment', kind: 'judgment', ownerSeatId: 'seat-1', cards: [] },
    ]);
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx jest projects/engine/src/lib/domain/factories.spec.ts projects/engine/src/lib/cards/zones.spec.ts projects/content/src/lib/modes/kingdomWar.spec.ts`
Expected: FAIL. `judgment` and `judgmentZoneOf` don't exist.

- [ ] **Step 3: Add the slot**

In `projects/engine/src/lib/domain/types.ts`, in `Seat`, after `equipped`:

```ts
  // Where delayed Tools wait to be judged (Capture, Lightning, Starvation).
  judgment: CardZoneRef;
```

In `projects/engine/src/lib/domain/factories.ts` `createSeat`, add ``const judgment: CardZoneRef = { zoneId: `${id}:judgment` };`` after `equipped`, and `judgment,` after `equipped,` in the returned object.

In `projects/engine/src/lib/cards/zones.ts`, change the import to `import { CardZone, CardInstance, GameState } from '../domain/types';` and add after `requireZoneOfKind`:

```ts
// A seat's Judgment slot (Seat.judgment), where its delayed Tools wait.
export function judgmentZoneOf(state: GameState, seatId: string): CardZone | undefined {
  const seat = state.seats.find((s) => s.id === seatId);
  return seat && state.zones.find((z) => z.id === seat.judgment.zoneId);
}
```

In `projects/content/src/lib/modes/kingdomWar.ts` `setup`, give each seat a judgment zone. The seat literal itself gets its ``judgment: { zoneId: `${id}:judgment` }`` from Step 4's script, so don't add it by hand.

```ts
      ...seats.flatMap((s) => [
        { id: s.hand.zoneId, kind: 'hand' as const, ownerSeatId: s.id, cards: [] },
        { id: s.equipped.zoneId, kind: 'equip' as const, ownerSeatId: s.id, cards: [] },
        { id: s.judgment.zoneId, kind: 'judgment' as const, ownerSeatId: s.id, cards: [] },
      ]),
```

- [ ] **Step 4: Give every hand-written `Seat` fixture the field**

Every fixture that writes `equipped: { zoneId: '<x>:equip' }` (or a template literal) gets a matching `judgment` right after it:

```bash
grep -rlE "equipped: \{ zoneId: ['\`]" --include='*.ts' projects | xargs perl -pi -e "s/equipped: \{ zoneId: (['\`])(.*?):equip\1 \}/\$&, judgment: { zoneId: \$1\$2:judgment\$1 }/g"
```

One fixture doesn't follow the `:equip` pattern: `projects/app/src/app/game-board/seat-tile.spec.ts` (`equipped: { zoneId: 'equip-1' }`). Add `judgment: { zoneId: 'judgment-1' },` there by hand.

The script also fills in the seat literal in `kingdomWar.ts`. It leaves `types.ts` and `factories.ts` alone, because their `equipped` lines don't match its pattern, and Step 3 covers them. Then find anything left:

```bash
npx tsc --noEmit -p projects/engine/tsconfig.spec.json && npx tsc --noEmit -p projects/content/tsconfig.spec.json && npx tsc --noEmit -p projects/app/tsconfig.spec.json
```

Expected: no errors. Fix any remaining "Property 'judgment' is missing" by hand the same way. The bots and sim specs are covered by `npx jest` below.

- [ ] **Step 5: Run everything**

Run: `npx jest`
Expected: PASS, every project.

- [ ] **Step 6: Commit**

```bash
git add projects
git commit -m "feat(engine): every seat has a Judgment slot

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Turn flags and skipped phases

**Files:**
- Modify: `projects/engine/src/lib/domain/types.ts`, `rules/phaseSequence.ts`, `pipeline/effects.ts`, `pipeline/events.ts`, `pipeline/resolve.ts`
- Test: `projects/engine/src/lib/rules/phaseSequence.spec.ts`, `projects/engine/src/lib/pipeline/judgment.spec.ts` (new)

**Interfaces:**
- Produces:
  - `Turn.flags?: Record<string, boolean>`.
  - `skipFlagOf(phase: Phase): string`, which returns `` `skip${phase}` ``.
  - `advancePhaseOrTurn(state): { phase: Phase; turn: Turn; skipped: Phase[] }`.
  - The effect `{ kind: 'SetTurnFlagEffect'; flag: string }`.
  - The event `PhaseSkippedEvent { kind: 'PhaseSkippedEvent'; seatId: string; phase: Phase }`.

- [ ] **Step 1: Write the failing phase-sequence tests**

Add to `projects/engine/src/lib/rules/phaseSequence.spec.ts`. Change the import to `import { advancePhaseOrTurn, PHASE_ORDER, skipFlagOf } from './phaseSequence';`, then append inside `describe('advancePhaseOrTurn', …)`:

```ts
  it('names a phase’s skip flag after the phase', () => {
    expect(skipFlagOf('Play')).toBe('skipPlay');
    expect(skipFlagOf('Draw')).toBe('skipDraw');
  });

  it('passes over every phase flagged to skip this turn, and says which', () => {
    const turn = { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [], flags: { skipDraw: true, skipPlay: true } };
    const result = advancePhaseOrTurn(state('Judgment', turn, [seat('seat-a', 0), seat('seat-b', 1)]));
    expect(result.phase).toBe('Discard');
    expect(result.skipped).toEqual(['Draw', 'Play']);
    expect(result.turn).toBe(turn);
  });

  it('skips nothing without flags', () => {
    const turn = { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [] };
    expect(advancePhaseOrTurn(state('Draw', turn, [seat('seat-a', 0)])).skipped).toEqual([]);
  });

  it('starts the next turn without the last turn’s flags', () => {
    const turn = { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [], flags: { skipPlay: true } };
    const result = advancePhaseOrTurn(state('End', turn, [seat('seat-a', 0), seat('seat-b', 1)]));
    expect(result.phase).toBe('Start');
    expect(result.turn.flags).toBeUndefined();
    expect(result.skipped).toEqual([]);
  });
```

- [ ] **Step 2: Write the failing resolve-level tests**

Create `projects/engine/src/lib/pipeline/judgment.spec.ts`. Task 3 adds fixture cards and more tests here, so the fixture already has judgment and processing zones.

```ts
import { advanceToDecision } from './resolve';
import { applyEffect } from './effects';
import { createRng } from '../rng/rng';
import { CardInstance, GameState, Phase, QueueItem } from '../domain/types';
import { ContentRegistry, GameModeDefinition } from '../registry/types';
import { EngineEvent } from './events';

const mode: GameModeDefinition = {
  id: 'stub',
  setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'],
  checkWinCondition: () => null,
  triggers: [],
};

// Task 3 puts fixture delayed Tools here.
const registry: ContentRegistry = { cards: new Map(), generals: new Map() };
const ctx = { registry, mode };

const card = (instanceId: string, definitionId = 'x', suit: CardInstance['suit'] = 'spade', rank = 5): CardInstance => ({ instanceId, definitionId, suit, rank });

interface TableOptions {
  phase?: Phase;
  flags?: Record<string, boolean>;
  queue?: QueueItem[];
  // Cards by zone id, e.g. { drawPile: [...], 'seat-a:judgment': [...] }.
  cards?: Record<string, CardInstance[]>;
}

// Seats a (turn owner) and b at 4 HP, each with a hand, equipment and judgment zone.
function table(o: TableOptions = {}): GameState {
  const seat = (id: string, index: number) => ({
    id, index, kingdom: 'Wei' as const,
    generals: { main: { generalDefinitionId: 'g1', revealed: false }, deputy: { generalDefinitionId: 'g2', revealed: false } },
    combinedHp: 4, maxCombinedHp: 4,
    hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` }, eliminated: false,
  });
  const cardsOf = (id: string) => o.cards?.[id] ?? [];
  return {
    seats: [seat('seat-a', 0), seat('seat-b', 1)],
    players: [],
    turn: { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [], ...(o.flags ? { flags: o.flags } : {}) },
    phase: o.phase ?? 'Play',
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: cardsOf('drawPile') },
      { id: 'discardPile', kind: 'discardPile', cards: cardsOf('discardPile') },
      { id: 'processing', kind: 'processing', cards: [] },
      ...['seat-a', 'seat-b'].flatMap((id) => [
        { id: `${id}:hand`, kind: 'hand' as const, ownerSeatId: id, cards: cardsOf(`${id}:hand`) },
        { id: `${id}:equip`, kind: 'equip' as const, ownerSeatId: id, cards: [] },
        { id: `${id}:judgment`, kind: 'judgment' as const, ownerSeatId: id, cards: cardsOf(`${id}:judgment`) },
      ]),
    ],
    pendingResponse: null,
    ...(o.queue ? { resolutionQueue: o.queue } : {}),
    log: [], rng: createRng(1), result: null, generalSelection: null,
  };
}

// Drains the queue and moves on to the next decision.
const settle = (s: GameState) => advanceToDecision(s, ctx).state;
const idsIn = (s: GameState, zoneId: string) => s.zones.find((z) => z.id === zoneId)!.cards.map((c) => c.instanceId);
const phasesOf = (log: EngineEvent[]) =>
  log.flatMap((e) => (e.kind === 'PhaseChangedEvent' ? [`${e.seatId}:${e.phase}`] : e.kind === 'TurnAdvancedEvent' ? [`turn ${e.turnNumber}`] : []));

describe('turn flags', () => {
  it('SetTurnFlagEffect sets a flag for the rest of the turn', () => {
    expect(applyEffect(table(), { kind: 'SetTurnFlagEffect', flag: 'skipPlay' }).state.turn.flags).toEqual({ skipPlay: true });
  });

  it('a phase flagged to skip is logged as skipped and never entered', () => {
    const next = settle(table({ phase: 'Judgment', flags: { skipDraw: true, skipPlay: true } }));
    expect(next.log.filter((e) => e.kind === 'PhaseSkippedEvent')).toEqual([
      { kind: 'PhaseSkippedEvent', seatId: 'seat-a', phase: 'Draw' },
      { kind: 'PhaseSkippedEvent', seatId: 'seat-a', phase: 'Play' },
    ]);
    expect(phasesOf(next.log)).toEqual(['seat-a:Discard', 'seat-a:End', 'turn 2', 'seat-b:Start', 'seat-b:Judgment', 'seat-b:Draw', 'seat-b:Play']);
    expect(next.turn.flags).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx jest projects/engine/src/lib/rules/phaseSequence.spec.ts projects/engine/src/lib/pipeline/judgment.spec.ts`
Expected: FAIL. `skipFlagOf` isn't exported, and TypeScript rejects `flags` and `SetTurnFlagEffect`.

- [ ] **Step 4: Add `Turn.flags` and the effect**

In `projects/engine/src/lib/domain/types.ts`, extend `Turn`:

```ts
export interface Turn {
  turnNumber: number;
  ownerSeatId: string;
  extraTurnStack: string[];
  // Proactive card plays this turn, by card definition id (responses excluded).
  cardPlays?: Record<string, number>;
  // Flags that last until the turn ends, e.g. skipPlay (see skipFlagOf).
  // Absent until one is set.
  flags?: Record<string, boolean>;
}
```

In `projects/engine/src/lib/pipeline/effects.ts`, add to the `Effect` union, after `DiscardZoneEffect`:

```ts
  // Turns a flag of the current turn on (e.g. skipFlagOf('Play')). Flags end with the turn.
  | { kind: 'SetTurnFlagEffect'; flag: string }
```

and to `applyEffect`'s switch, before `case 'DyingEffect'`:

```ts
    case 'SetTurnFlagEffect':
      return { state: { ...state, turn: { ...state.turn, flags: { ...(state.turn.flags ?? {}), [effect.flag]: true } } }, events: [] };
```

- [ ] **Step 5: Skip flagged phases**

Replace `advancePhaseOrTurn` in `projects/engine/src/lib/rules/phaseSequence.ts` and add `skipFlagOf`:

```ts
// The turn flag that makes the turn owner skip `phase` (e.g. 'skipPlay').
export function skipFlagOf(phase: Phase): string {
  return `skip${phase}`;
}

// The next phase, passing over any phase flagged to skip this turn (`skipped`,
// in order). After End, the next turn's Start: a new turn has no flags.
export function advancePhaseOrTurn(state: GameState): { phase: Phase; turn: Turn; skipped: Phase[] } {
  const currentIndex = PHASE_ORDER.indexOf(state.phase);
  // An unrecognized phase means a real bug upstream, not a case to paper over
  // by silently restarting the phase sequence.
  if (currentIndex === -1) {
    throw new Error(`Unrecognized phase: ${state.phase}`);
  }
  if (currentIndex === PHASE_ORDER.length - 1) {
    return { phase: PHASE_ORDER[0], turn: advanceTurn(state.turn, state.seats), skipped: [] };
  }
  const skipped: Phase[] = [];
  let next = currentIndex + 1;
  // End is never skipped, so a turn always ends.
  while (next < PHASE_ORDER.length - 1 && state.turn.flags?.[skipFlagOf(PHASE_ORDER[next])]) {
    skipped.push(PHASE_ORDER[next]);
    next++;
  }
  return { phase: PHASE_ORDER[next], turn: state.turn, skipped };
}
```

`advanceTurn` already builds a fresh `Turn` without `cardPlays`, so it also drops `flags`.

- [ ] **Step 6: Log skipped phases**

In `projects/engine/src/lib/pipeline/events.ts`, add after `PhaseChangedEvent`:

```ts
// The turn owner passed over a phase (a skip flag, e.g. Capture's skipPlay).
export interface PhaseSkippedEvent {
  kind: 'PhaseSkippedEvent';
  seatId: string;
  phase: Phase;
}
```

and add `| PhaseSkippedEvent` to `EngineEvent`.

In `projects/engine/src/lib/pipeline/resolve.ts`, import `PhaseSkippedEvent` alongside `PhaseChangedEvent`. Then replace `enterNextPhase`:

```ts
// Moves to the next phase (or the next turn's Start) and enters it. Phases
// flagged to skip are logged as skipped and never entered.
function enterNextPhase(state: GameState, ctx: EngineContext): ResolveResult {
  const { phase, turn, skipped } = advancePhaseOrTurn(state);
  const events: GameEvent[] = [];
  if (turn.turnNumber !== state.turn.turnNumber) {
    const turnEvent: TurnAdvancedEvent = { kind: 'TurnAdvancedEvent', seatId: turn.ownerSeatId, turnNumber: turn.turnNumber };
    events.push(turnEvent);
  }
  for (const skippedPhase of skipped) {
    const skipEvent: PhaseSkippedEvent = { kind: 'PhaseSkippedEvent', seatId: turn.ownerSeatId, phase: skippedPhase };
    events.push(skipEvent);
  }
  const phaseEvent: PhaseChangedEvent = { kind: 'PhaseChangedEvent', seatId: turn.ownerSeatId, phase };
  events.push(phaseEvent);
  return logWithTriggers({ ...state, phase, turn }, events, ctx);
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx jest projects/engine/src/lib/rules/phaseSequence.spec.ts projects/engine/src/lib/pipeline/judgment.spec.ts`
Expected: PASS.

Then run: `npx jest projects/engine`
Expected: PASS. Existing tests read `.phase` and `.turn` only.

- [ ] **Step 8: Commit**

```bash
git add projects/engine/src/lib/domain/types.ts projects/engine/src/lib/rules/phaseSequence.ts projects/engine/src/lib/rules/phaseSequence.spec.ts projects/engine/src/lib/pipeline/effects.ts projects/engine/src/lib/pipeline/events.ts projects/engine/src/lib/pipeline/resolve.ts projects/engine/src/lib/pipeline/judgment.spec.ts
git commit -m "feat(engine): turn flags that skip a phase, logged as skipped

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Delayed cards, judgments and cleanup in the engine

**Files:**
- Create: `projects/engine/src/lib/pipeline/judgment.ts`
- Modify: `projects/engine/src/lib/registry/types.ts`, `pipeline/effects.ts`, `pipeline/events.ts`, `pipeline/resolve.ts`, `public-api.ts`
- Test: `projects/engine/src/lib/pipeline/judgment.spec.ts`

**Interfaces:**
- Consumes: `SetTurnFlagEffect` and `skipFlagOf` (Task 2), and `Seat.judgment` and `judgmentZoneOf` (Task 1).
- Produces:
  - On `CardDefinition`:
    - `delayed?: boolean`
    - `onJudged?(state: GameState, ctx: JudgedContext): unknown[]`
    - `onCleanup?(state: GameState, ctx: DelayedToolContext): unknown[]`
  - The contexts `JudgedContext { tool: UsedCard; seatId: string; judged: CardInstance }` and `DelayedToolContext { tool: UsedCard; ownerSeatId: string }`.
  - The effects `{ kind: 'JudgeEffect'; seatId: string; tool: UsedCard }` and `{ kind: 'DelayedCleanupEffect'; tool: UsedCard; ownerSeatId: string }`.
  - The event `JudgmentEvent { kind: 'JudgmentEvent'; seatId: string; tool: UsedCard; card: CardInstance }`.

- [ ] **Step 1: Write the failing judgment tests**

In `projects/engine/src/lib/pipeline/judgment.spec.ts`:
- Change the imports to:

```ts
import { advanceToDecision, resolve } from './resolve';
import { applyEffect } from './effects';
import { createRng } from '../rng/rng';
import { CardInstance, GameState, Phase, QueueItem } from '../domain/types';
import { CardDefinition, ContentRegistry, GameModeDefinition } from '../registry/types';
import { skipFlagOf } from '../rules/phaseSequence';
import { usedCardOf } from '../domain/usedCard';
import { EngineEvent } from './events';
```

- Replace the `// Task 3 puts fixture delayed Tools here.` comment and the `registry` line with:

```ts
// A fixture delayed Tool: goes on another seat; anything but a heart skips that seat's Play phase.
const omen: CardDefinition = {
  id: 'omen', name: 'Omen', category: 'tool', delayed: true,
  legalPlayTargets: (state, ctx) => state.seats.filter((s) => s.id !== ctx.seatId).map((s) => [{ kind: 'seat', seatId: s.id }]),
  play: (_state, ctx) => [{ kind: 'MoveCardEffect', cardInstanceId: ctx.cardInstanceId, toZoneId: `${ctx.targets[0].seatId}:judgment` }],
  onJudged: (_state, ctx) => (ctx.judged.suit === 'heart' ? [] : [{ kind: 'SetTurnFlagEffect', flag: skipFlagOf('Play') }]),
};
// A fixture delayed Tool with its own cleanup: it goes back to its owner's hand.
const beacon: CardDefinition = {
  id: 'beacon', name: 'Beacon', category: 'tool', delayed: true,
  play: () => [],
  onCleanup: (_state, ctx) => [{ kind: 'MoveCardEffect', cardInstanceId: ctx.tool.physical[0].instanceId, toZoneId: `${ctx.ownerSeatId}:hand` }],
};
const registry: ContentRegistry = { cards: new Map([[omen.id, omen], [beacon.id, beacon]]), generals: new Map() };
```

- Append:

```ts
describe('delayed cards', () => {
  it('a delayed card leaves the hand for where play() puts it, not the discard pile', () => {
    const next = resolve(
      table({ cards: { 'seat-a:hand': [card('o1', 'omen')] } }),
      { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'o1', targets: [{ kind: 'seat', seatId: 'seat-b' }] },
      ctx
    ).state;
    expect(idsIn(next, 'seat-b:judgment')).toEqual(['o1']);
    expect(idsIn(next, 'discardPile')).toEqual([]);
    expect(next.log.map((e) => e.kind)).toEqual(['CardPlayedEvent', 'CardMovedEvent']);
  });
});

describe('JudgeEffect', () => {
  const tool = usedCardOf(card('o1', 'omen'));
  const judge = { kind: 'JudgeEffect' as const, seatId: 'seat-a', tool };

  it('turns up the top card, logs it, lets the delayed Tool read it, then discards it', () => {
    const judged = card('j1', 'x', 'club', 3);
    const next = settle(table({ queue: [judge], cards: { drawPile: [judged, card('j2')] } }));
    expect(next.log).toEqual([
      { kind: 'JudgmentEvent', seatId: 'seat-a', tool, card: judged },
      { kind: 'CardMovedEvent', cardInstanceId: 'j1', fromZoneId: 'processing', toZoneId: 'discardPile', card: judged },
    ]);
    expect(next.turn.flags).toEqual({ skipPlay: true });
    expect(idsIn(next, 'processing')).toEqual([]);
    expect(idsIn(next, 'drawPile')).toEqual(['j2']);
  });

  it('a card the delayed Tool reads as harmless does nothing', () => {
    const next = settle(table({ queue: [judge], cards: { drawPile: [card('j1', 'x', 'heart', 3)] } }));
    expect(next.turn.flags).toBeUndefined();
    expect(idsIn(next, 'discardPile')).toEqual(['j1']);
  });

  it('shuffles the discard pile in when the draw pile is empty', () => {
    const next = settle(table({ queue: [judge], cards: { discardPile: [card('j1')] } }));
    expect(next.log.map((e) => e.kind)).toEqual(['DiscardPileReshuffledEvent', 'JudgmentEvent', 'CardMovedEvent']);
    expect(next.log[1]).toMatchObject({ kind: 'JudgmentEvent', card: { instanceId: 'j1' } });
  });

  it('with no card left anywhere, judges nothing and reads nothing (Review Focus 2)', () => {
    const next = settle(table({ queue: [judge, { kind: 'DelayedCleanupEffect', tool, ownerSeatId: 'seat-a' }], cards: { 'seat-a:judgment': [card('o1', 'omen')] } }));
    expect(next.log.map((e) => e.kind)).toEqual(['CardMovedEvent']); // only the cleanup's discard
    expect(next.turn.flags).toBeUndefined();
    expect(idsIn(next, 'discardPile')).toEqual(['o1']);
    expect(next.resolutionQueue).toBeUndefined();
  });

  it('survives a JSON round trip while queued', () => {
    const queued = table({ queue: [judge], cards: { drawPile: [card('j1')] } });
    expect(settle(JSON.parse(JSON.stringify(queued)))).toEqual(settle(queued));
  });
});

describe('DelayedCleanupEffect', () => {
  it('discards a delayed Tool still in its owner’s judgment area', () => {
    const o1 = card('o1', 'omen');
    const next = settle(table({ queue: [{ kind: 'DelayedCleanupEffect', tool: usedCardOf(o1), ownerSeatId: 'seat-a' }], cards: { 'seat-a:judgment': [o1] } }));
    expect(idsIn(next, 'seat-a:judgment')).toEqual([]);
    expect(idsIn(next, 'discardPile')).toEqual(['o1']);
  });

  it('leaves alone a delayed Tool that has already left the judgment area', () => {
    const o1 = card('o1', 'omen');
    const next = settle(table({ queue: [{ kind: 'DelayedCleanupEffect', tool: usedCardOf(o1), ownerSeatId: 'seat-a' }], cards: { 'seat-b:hand': [o1] } }));
    expect(idsIn(next, 'seat-b:hand')).toEqual(['o1']);
    expect(next.log).toEqual([]);
  });

  it('runs the card’s own onCleanup instead when it has one', () => {
    const b1 = card('b1', 'beacon');
    const next = settle(table({ queue: [{ kind: 'DelayedCleanupEffect', tool: usedCardOf(b1), ownerSeatId: 'seat-a' }], cards: { 'seat-a:judgment': [b1] } }));
    expect(idsIn(next, 'seat-a:hand')).toEqual(['b1']);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest projects/engine/src/lib/pipeline/judgment.spec.ts`
Expected: FAIL. TypeScript rejects `delayed`, `onJudged`, `onCleanup`, `JudgeEffect` and `DelayedCleanupEffect`.

- [ ] **Step 3: Add the card hooks**

In `projects/engine/src/lib/registry/types.ts`, change the first import to `import { CardInstance, GameState, Target, Kingdom, GameResult, PendingResponse, UsedCard } from '../domain/types';`. Then add to `CardDefinition`, after `onTarget`:

```ts
  // A delayed Tool: play() puts it in a judgment area, so playing it doesn't
  // send it to the discard pile (like Equipment).
  delayed?: boolean;
  // A delayed Tool reading its judgment card (JudgeEffect). Its effects go to
  // the front of the queue, ahead of the judged card's move to the discard pile.
  onJudged?(state: GameState, ctx: JudgedContext): unknown[];
  // What becomes of a delayed Tool once it has had its turn in the Judgment
  // phase (DelayedCleanupEffect). Absent = discarded, if it is still in its
  // owner's judgment area.
  onCleanup?(state: GameState, ctx: DelayedToolContext): unknown[];
```

and after `ToolTargetContext`:

```ts
export interface JudgedContext {
  tool: UsedCard;
  // The seat being judged, and the card turned up for it.
  seatId: string;
  judged: CardInstance;
}

export interface DelayedToolContext {
  tool: UsedCard;
  // The seat whose judgment area the delayed Tool was judged in.
  ownerSeatId: string;
}
```

- [ ] **Step 4: Add the effects and the event**

In `projects/engine/src/lib/pipeline/effects.ts`, add to the `Effect` union after `SetTurnFlagEffect`:

```ts
  // A judgment for `seatId`, read by the delayed Tool `tool` (CardDefinition.onJudged).
  | { kind: 'JudgeEffect'; seatId: string; tool: UsedCard }
  // A delayed Tool's turn in the Judgment phase is over (CardDefinition.onCleanup).
  | { kind: 'DelayedCleanupEffect'; tool: UsedCard; ownerSeatId: string }
```

`applyEffect` doesn't handle them. `resolveEffect` routes them to `judgment.ts` (Step 8), because they need the registry.

In `projects/engine/src/lib/pipeline/events.ts`, change the import to `import { CardInstance, ChoiceOption, Damage, DecisionReason, Phase, Target, UsedCard } from '../domain/types';`. Then add:

```ts
// A card turned up for `seatId`'s judgment, read by the delayed Tool `tool`.
export interface JudgmentEvent {
  kind: 'JudgmentEvent';
  seatId: string;
  tool: UsedCard;
  card: CardInstance;
}
```

and add `| JudgmentEvent` to `EngineEvent`.

- [ ] **Step 5: Write `judgment.ts`**

Create `projects/engine/src/lib/pipeline/judgment.ts`:

```ts
import { GameState } from '../domain/types';
import { ContentRegistry } from '../registry/types';
import { lookupCard } from '../registry/lookup';
import { drawTop, judgmentZoneOf, requireZoneOfKind } from '../cards/zones';
import { ApplyResult, Effect } from './effects';
import { EngineEvent } from './events';
import { queueFront } from './queue';

type JudgmentStepEffect = Extract<Effect, { kind: 'JudgeEffect' | 'DelayedCleanupEffect' }>;

export function isJudgmentStepEffect(effect: Effect): effect is JudgmentStepEffect {
  return effect.kind === 'JudgeEffect' || effect.kind === 'DelayedCleanupEffect';
}

// Judgments and delayed Tools' cleanup. Both ask the card's definition what
// happens, so they need the registry, as the Tool lifecycle does.
export function applyJudgmentStepEffect(state: GameState, effect: JudgmentStepEffect, registry: ContentRegistry): ApplyResult {
  const discardPile = requireZoneOfKind(state.zones, 'discardPile');
  switch (effect.kind) {
    case 'JudgeEffect': {
      const drawPile = requireZoneOfKind(state.zones, 'drawPile');
      const processing = requireZoneOfKind(state.zones, 'processing');
      const { zones, drawn, rng, reshuffled } = drawTop(state.zones, drawPile.id, processing.id, 1, state.rng);
      const [judged] = drawn;
      // No card left anywhere to judge with: nothing is judged.
      if (!judged) return { state, events: [] };
      const events: EngineEvent[] = [
        ...(reshuffled > 0 ? [{ kind: 'DiscardPileReshuffledEvent' as const, cardCount: reshuffled }] : []),
        { kind: 'JudgmentEvent', seatId: effect.seatId, tool: effect.tool, card: judged },
      ];
      const turnedUp: GameState = { ...state, zones, rng, log: [...state.log, ...events] };
      const readings = (lookupCard(registry, effect.tool.as).onJudged?.(turnedUp, { tool: effect.tool, seatId: effect.seatId, judged }) ?? []) as Effect[];
      const done: Effect = { kind: 'MoveCardEffect', cardInstanceId: judged.instanceId, toZoneId: discardPile.id };
      return { state: queueFront(turnedUp, [...readings, done]), events };
    }
    case 'DelayedCleanupEffect': {
      const definition = lookupCard(registry, effect.tool.as);
      if (definition.onCleanup) {
        return { state: queueFront(state, definition.onCleanup(state, { tool: effect.tool, ownerSeatId: effect.ownerSeatId }) as Effect[]), events: [] };
      }
      const card = effect.tool.physical[0];
      const stillThere = !!card && !!judgmentZoneOf(state, effect.ownerSeatId)?.cards.some((c) => c.instanceId === card.instanceId);
      if (!stillThere) return { state, events: [] };
      return { state: queueFront(state, [{ kind: 'MoveCardEffect', cardInstanceId: card.instanceId, toZoneId: discardPile.id }]), events: [] };
    }
  }
}
```

- [ ] **Step 6: Route the effects, and leave delayed cards where `play()` puts them**

In `projects/engine/src/lib/pipeline/resolve.ts`:

- Add `import { applyJudgmentStepEffect, isJudgmentStepEffect } from './judgment';`.
- In `resolveEffect`, replace the `applied` line with:

```ts
  const applied = isLifecycleEffect(current)
    ? applyLifecycleEffect(state, current, ctx.registry)
    : isJudgmentStepEffect(current)
      ? applyJudgmentStepEffect(state, current, ctx.registry)
      : applyEffect(state, current);
```

- In `PlayCardAction`, replace the `leaveHand` block with:

```ts
      // A used card leaves the hand at once, so it can't be reused mid-resolution.
      // Equipment and delayed Tools are placed by their own play() instead.
      const leaveHand: Effect[] =
        cardDefinition.category === 'equipment' || cardDefinition.delayed
          ? []
          : [{ kind: 'MoveCardEffect', cardInstanceId: action.cardInstanceId, toZoneId: requireZoneOfKind(state.zones, 'discardPile').id }];
```

In `projects/engine/src/public-api.ts`, add `export * from './lib/pipeline/judgment';` after the `toolLifecycle` line.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx jest projects/engine/src/lib/pipeline/judgment.spec.ts`
Expected: PASS.

Run: `npx jest projects/engine`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add projects/engine
git commit -m "feat(engine): delayed cards, judgments and their cleanup

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Capture, Starvation and the Judgment Phase

**Files:**
- Create: `projects/content/src/lib/shared/delayed.ts`, `cards/capture.ts`, `cards/starvation.ts`, `cards/delayed.spec.ts`
- Modify: `projects/content/src/lib/modes/kingdomWar.ts`, `registry.ts`, `registry.spec.ts`, `wiki.spec.ts`, `modes/kingdomWar.spec.ts`, `projects/app/src/app/wiki/wiki-pages.spec.ts`

**Interfaces:**
- Consumes:
  - From Task 3: `JudgeEffect`, `DelayedCleanupEffect`, `onJudged`, `delayed`.
  - From Task 2: `skipFlagOf`, `SetTurnFlagEffect`.
  - From Task 1: `judgmentZoneOf` and every seat's judgment zone.
  - Already in content: `COUNTER_CARD_IDS` (`shared/tools.ts`), and `otherLivingSeatTargets` and `seatDistance` (`shared/queries.ts`).
- Produces (from `shared/delayed.ts`):
  - `holdsDelayed(state: GameState, seatId: string, definitionId: string): boolean`
  - `placeInJudgmentArea(state: GameState, cardInstanceId: string, seatId: string): Effect[]`
  - `judgeTarget: NonNullable<CardDefinition['onTarget']>`
  - `skipPhaseTool(spec: { id: string; name: string; skips: Phase; spares: CardInstance['suit']; maxDistance?: number }): CardDefinition`
  - `judgmentPhaseTrigger: SkillTrigger`
- Also produces: `captureCard` and `starvationCard`.

- [ ] **Step 1: Write the failing content tests**

Create `projects/content/src/lib/cards/delayed.spec.ts`. Task 5 appends Lightning tests to it.

```ts
import { advanceToDecision, getLegalActions, resolve } from 'engine';
import type { CardDefinition, CardInstance, ContentRegistry, EngineEvent, GameState, Phase } from 'engine';
import { kingdomWarMode } from '../modes/kingdomWar';
import { captureCard } from './capture';
import { starvationCard } from './starvation';
import { wuxieCard } from './wuxie';
import { breakCard } from './break';

const plain = (id: string): CardDefinition => ({ id, name: id, category: 'basic', play: () => [] });
const diLu: CardDefinition = { id: 'di-lu', name: 'Di Lu', category: 'equipment', equipSlot: 'defensiveMount', play: () => [] };

// Task 5 adds Lightning here.
const cards: CardDefinition[] = [captureCard, starvationCard, wuxieCard, breakCard, diLu, plain('sha'), plain('shan'), plain('peach')];
const registry: ContentRegistry = { cards: new Map(cards.map((c) => [c.id, c])), generals: new Map() };
// Kingdom War's own triggers: the Judgment Phase, the Draw Phase's 2 cards, and dying.
const ctx = { registry, mode: kingdomWarMode };

const card = (instanceId: string, definitionId: string, suit: CardInstance['suit'] = 'spade', rank = 5): CardInstance => ({ instanceId, definitionId, suit, rank });
const filler = (n: number) => Array.from({ length: n }, (_, i) => card(`f${i}`, 'shan', 'diamond', 13));

// Seats a (Wei), b (Shu), c (Wu), all at 4 HP, each with a hand, equipment and
// judgment zone. `cards` fills zones by id; the draw pile defaults to 10 fillers.
function table(cards: Record<string, CardInstance[]> = {}, o: { owner?: string; phase?: Phase; hp?: Record<string, number> } = {}): GameState {
  const seat = (id: string, index: number, kingdom: 'Wei' | 'Shu' | 'Wu') => ({
    id, index, kingdom,
    generals: { main: { generalDefinitionId: `${id}-main`, revealed: true }, deputy: { generalDefinitionId: `${id}-deputy`, revealed: true } },
    combinedHp: o.hp?.[id] ?? 4, maxCombinedHp: 4,
    hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` }, eliminated: false,
  });
  const ids = ['seat-a', 'seat-b', 'seat-c'];
  return {
    seats: [seat('seat-a', 0, 'Wei'), seat('seat-b', 1, 'Shu'), seat('seat-c', 2, 'Wu')],
    players: [],
    turn: { turnNumber: 1, ownerSeatId: o.owner ?? 'seat-b', extraTurnStack: [] },
    phase: o.phase ?? 'Start',
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: cards['drawPile'] ?? filler(10) },
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

// From the Start phase (seat-b's by default) on to the next decision.
const run = (s: GameState) => advanceToDecision(s, ctx).state;
const respond = (s: GameState, seatId: string, cardInstanceId: string) =>
  resolve(s, { kind: 'RespondAction', seatId, pendingResponseId: s.pendingResponse!.id, cardInstanceId }, ctx).state;
const pass = (s: GameState, seatId: string) => resolve(s, { kind: 'PassAction', seatId, pendingResponseId: s.pendingResponse!.id }, ctx).state;
const idsIn = (s: GameState, zoneId: string) => s.zones.find((z) => z.id === zoneId)!.cards.map((c) => c.instanceId);
const judgments = (log: EngineEvent[]) => log.flatMap((e) => (e.kind === 'JudgmentEvent' ? [`${e.tool.as}:${e.card.instanceId}`] : []));
const skips = (log: EngineEvent[]) => log.flatMap((e) => (e.kind === 'PhaseSkippedEvent' ? [`${e.seatId}:${e.phase}`] : []));
const targetsFor = (s: GameState, cardInstanceId: string) =>
  getLegalActions(s, 'seat-a', registry).flatMap((a) => (a.kind === 'PlayCardAction' && a.cardInstanceId === cardInstanceId ? [a.targets] : []));

describe('Capture', () => {
  it('goes on another living seat that holds no Capture yet', () => {
    const s = table({ 'seat-a:hand': [card('cap', 'capture')], 'seat-c:judgment': [card('cap-2', 'capture')] }, { owner: 'seat-a', phase: 'Play' });
    expect(targetsFor(s, 'cap')).toEqual([[{ kind: 'seat', seatId: 'seat-b' }]]);
    const next = resolve(s, { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'cap', targets: [{ kind: 'seat', seatId: 'seat-b' }] }, ctx).state;
    expect(idsIn(next, 'seat-b:judgment')).toEqual(['cap']);
    expect(idsIn(next, 'discardPile')).toEqual([]);
  });

  it('anything but a heart: the seat skips its Play Phase, and Capture is discarded', () => {
    const next = run(table({ 'seat-b:judgment': [card('cap', 'capture')], drawPile: [card('j1', 'shan', 'spade', 5), ...filler(6)] }));
    expect(judgments(next.log)).toEqual(['capture:j1']);
    expect(skips(next.log)).toEqual(['seat-b:Play']);
    expect(next.turn.ownerSeatId).toBe('seat-c');
    expect(next.phase).toBe('Play');
    expect(idsIn(next, 'discardPile')).toEqual(expect.arrayContaining(['cap', 'j1']));
    expect(idsIn(next, 'seat-b:judgment')).toEqual([]);
  });

  it('a heart: the seat plays as usual, and Capture is still discarded', () => {
    const next = run(table({ 'seat-b:judgment': [card('cap', 'capture')], drawPile: [card('j1', 'shan', 'heart', 5), ...filler(6)] }));
    expect(skips(next.log)).toEqual([]);
    expect(next.turn.ownerSeatId).toBe('seat-b');
    expect(next.phase).toBe('Play');
    expect(idsIn(next, 'discardPile').sort()).toEqual(['cap', 'j1']);
  });

  it('a Wuxie Kongjie cancels it: no judgment, and Capture is discarded', () => {
    const asked = run(table({ 'seat-b:judgment': [card('cap', 'capture')], 'seat-c:hand': [card('wx', 'wuxie')] }));
    expect(asked.pendingResponse).toMatchObject({ respondingSeatId: 'seat-c', reason: { kind: 'wuxie', toolUserSeatId: 'seat-b', target: { kind: 'seat', seatId: 'seat-b' } } });
    const next = respond(asked, 'seat-c', 'wx');
    expect(judgments(next.log)).toEqual([]);
    expect(next.turn.ownerSeatId).toBe('seat-b');
    expect(next.phase).toBe('Play');
    expect(idsIn(next, 'discardPile')).toEqual(expect.arrayContaining(['cap', 'wx']));
  });

  it('a game paused on a judgment’s Wuxie check survives a JSON round trip', () => {
    const asked = run(table({ 'seat-b:judgment': [card('cap', 'capture')], 'seat-c:hand': [card('wx', 'wuxie')] }));
    const copy = JSON.parse(JSON.stringify(asked)) as GameState;
    expect(pass(copy, 'seat-c')).toEqual(pass(asked, 'seat-c'));
  });

  it('a Capture broken out of the judgment area is never judged (Review Focus 5)', () => {
    const s = table({ 'seat-a:hand': [card('br', 'break')], 'seat-b:judgment': [card('cap', 'capture')] }, { owner: 'seat-a', phase: 'Play' });
    const choosing = resolve(s, { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'br', targets: [{ kind: 'seat', seatId: 'seat-b' }] }, ctx).state;
    const broken = resolve(choosing, { kind: 'ChooseOptionAction', seatId: 'seat-a', choiceId: choosing.pendingChoice!.id, optionId: 'cap' }, ctx).state;
    expect(idsIn(broken, 'discardPile')).toEqual(expect.arrayContaining(['cap']));
    const next = resolve(broken, { kind: 'EndPhaseAction', seatId: 'seat-a' }, ctx).state;
    expect(judgments(next.log)).toEqual([]);
    expect(next.turn.ownerSeatId).toBe('seat-b');
    expect(next.phase).toBe('Play');
  });
});

describe('Starvation', () => {
  it('goes on another seat at distance 1 (horses count) that holds no Starvation yet', () => {
    const horse = table({ 'seat-a:hand': [card('st', 'starvation')], 'seat-c:equip': [card('dl', 'di-lu')] }, { owner: 'seat-a', phase: 'Play' });
    expect(targetsFor(horse, 'st')).toEqual([[{ kind: 'seat', seatId: 'seat-b' }]]);
    const held = table({ 'seat-a:hand': [card('st', 'starvation')], 'seat-b:judgment': [card('st-2', 'starvation')] }, { owner: 'seat-a', phase: 'Play' });
    expect(targetsFor(held, 'st')).toEqual([[{ kind: 'seat', seatId: 'seat-c' }]]);
  });

  it('anything but a club: the seat skips its Draw Phase', () => {
    const next = run(table({ 'seat-b:judgment': [card('st', 'starvation')], drawPile: [card('j1', 'shan', 'heart', 5), ...filler(6)] }));
    expect(skips(next.log)).toEqual(['seat-b:Draw']);
    expect(next.log.some((e) => e.kind === 'CardsDrawnEvent' && e.seatId === 'seat-b')).toBe(false);
    expect(next.turn.ownerSeatId).toBe('seat-b');
    expect(next.phase).toBe('Play');
    expect(idsIn(next, 'discardPile').sort()).toEqual(['j1', 'st']);
  });

  it('a club: the seat draws as usual', () => {
    const next = run(table({ 'seat-b:judgment': [card('st', 'starvation')], drawPile: [card('j1', 'shan', 'club', 5), ...filler(6)] }));
    expect(skips(next.log)).toEqual([]);
    expect(idsIn(next, 'seat-b:hand')).toHaveLength(2);
  });
});

describe('the Judgment Phase', () => {
  it('judges a seat’s delayed Tools last in, first out; both landing skip Draw and Play, and the next turn has no flags (Review Focus 3)', () => {
    const next = run(table({
      'seat-b:judgment': [card('st', 'starvation'), card('cap', 'capture')],
      drawPile: [card('j1', 'shan', 'spade', 5), card('j2', 'shan', 'spade', 6), ...filler(6)],
    }));
    expect(judgments(next.log)).toEqual(['capture:j1', 'starvation:j2']);
    expect(skips(next.log)).toEqual(['seat-b:Draw', 'seat-b:Play']);
    expect(next.turn.ownerSeatId).toBe('seat-c');
    expect(next.turn.flags).toBeUndefined();
    expect(idsIn(next, 'seat-c:hand')).toHaveLength(2);
  });

  it('does nothing for a seat with an empty judgment area', () => {
    const next = run(table());
    expect(judgments(next.log)).toEqual([]);
    expect(next.turn.ownerSeatId).toBe('seat-b');
    expect(next.phase).toBe('Play');
  });
});
```

Update the counts Capture and Starvation change (Task 5 adds Lightning to each):
- `projects/content/src/lib/registry.spec.ts` line 7: add `'capture'` and `'starvation'` to the list.
- `projects/content/src/lib/wiki.spec.ts` line 145: the expected list becomes `['barbarians', 'break', 'capture', 'coerce', 'draw-two', 'duel', 'hail-of-arrows', 'harvest', 'peach-garden', 'starvation', 'steal', 'wuxie']`.
- `projects/content/src/lib/modes/kingdomWar.spec.ts` line 116: `toHaveLength(90)`.
- `projects/app/src/app/wiki/wiki-pages.spec.ts`: `'15 cards · 12 in the game'`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest projects/content/src/lib/cards/delayed.spec.ts`
Expected: FAIL. `./capture` and `./starvation` don't exist.

- [ ] **Step 3: Write `shared/delayed.ts`**

```ts
import type { CardDefinition, CardInstance, Effect, GameState, Phase, PhaseChangedEvent, SkillTrigger } from 'engine';
import { judgmentZoneOf, skipFlagOf, usedCardOf } from 'engine';
import { otherLivingSeatTargets, seatDistance } from './queries';
import { COUNTER_CARD_IDS } from './tools';

// Whether `seatId`'s judgment area already holds a `definitionId`.
export function holdsDelayed(state: GameState, seatId: string, definitionId: string): boolean {
  return !!judgmentZoneOf(state, seatId)?.cards.some((c) => c.definitionId === definitionId);
}

// The move that puts a delayed Tool face up into `seatId`'s judgment area.
export function placeInJudgmentArea(state: GameState, cardInstanceId: string, seatId: string): Effect[] {
  const zone = judgmentZoneOf(state, seatId);
  if (!zone) throw new Error(`Seat ${seatId} has no judgment area`);
  return [{ kind: 'MoveCardEffect', cardInstanceId, toZoneId: zone.id }];
}

// A delayed Tool's rule once its Wuxie check has passed: judge its seat.
export const judgeTarget: NonNullable<CardDefinition['onTarget']> = (_state, { tool, target }) =>
  target.kind === 'seat' ? [{ kind: 'JudgeEffect', seatId: target.seatId, tool }] : [];

interface SkipPhaseToolSpec {
  id: string;
  name: string;
  // The phase a landed judgment skips, and the suit that spares it.
  skips: Phase;
  spares: CardInstance['suit'];
  // Reach (horses counted); absent = any distance.
  maxDistance?: number;
}

// Capture and Starvation: placed on another living seat (within `maxDistance`
// when set) that doesn't already hold one. Judged in that seat's Judgment
// Phase: anything but a `spares` card skips `skips` this turn. Then discarded
// (the engine's default cleanup), judged or cancelled.
export function skipPhaseTool({ id, name, skips, spares, maxDistance }: SkipPhaseToolSpec): CardDefinition {
  return {
    id,
    name,
    category: 'tool',
    delayed: true,
    legalPlayTargets: (state, ctx, registry) =>
      otherLivingSeatTargets(state, ctx.seatId).filter(
        ([target]) =>
          target.kind === 'seat' &&
          !holdsDelayed(state, target.seatId, id) &&
          (maxDistance === undefined || seatDistance(state, ctx.seatId, target.seatId, registry) <= maxDistance)
      ),
    play: (state, ctx) => {
      const [target] = ctx.targets;
      return ctx.respondingTo || target?.kind !== 'seat' ? [] : placeInJudgmentArea(state, ctx.cardInstanceId, target.seatId);
    },
    onTarget: judgeTarget,
    onJudged: (_state, { judged }) => (judged.suit === spares ? [] : [{ kind: 'SetTurnFlagEffect', flag: skipFlagOf(skips) }]),
  };
}

// Kingdom War's Judgment Phase: the turn owner's delayed Tools are judged one
// at a time, last in, first out. Each gets the usual Wuxie check (asked from the
// judged seat, which stands in as the Tool's user), which guards only the
// judgment. Its cleanup always runs.
export const judgmentPhaseTrigger: SkillTrigger = {
  point: 'after:PhaseChangedEvent',
  condition: (state, subject) => {
    const event = subject as PhaseChangedEvent;
    return event.phase === 'Judgment' && (judgmentZoneOf(state, event.seatId)?.cards.length ?? 0) > 0;
  },
  effect: (state, subject) => {
    const { seatId } = subject as PhaseChangedEvent;
    const lastInFirstOut = [...judgmentZoneOf(state, seatId)!.cards].reverse();
    return lastInFirstOut.flatMap((card): Effect[] => {
      const tool = usedCardOf(card);
      return [
        { kind: 'ToolOnTargetEffect', tool, userSeatId: seatId, target: { kind: 'seat', seatId }, counterCardIds: COUNTER_CARD_IDS },
        { kind: 'DelayedCleanupEffect', tool, ownerSeatId: seatId },
      ];
    });
  },
};
```

- [ ] **Step 4: Write the two cards**

`projects/content/src/lib/cards/capture.ts`:

```ts
import { skipPhaseTool } from '../shared/delayed';

// Capture: on another seat; judged in its Judgment Phase, anything but a heart skips its Play Phase.
export const captureCard = skipPhaseTool({ id: 'capture', name: 'Capture', skips: 'Play', spares: 'heart' });
```

`projects/content/src/lib/cards/starvation.ts`:

```ts
import { skipPhaseTool } from '../shared/delayed';

// Starvation: on another seat at distance 1; judged in its Judgment Phase, anything but a club skips its Draw Phase.
export const starvationCard = skipPhaseTool({ id: 'starvation', name: 'Starvation', skips: 'Draw', spares: 'club', maxDistance: 1 });
```

- [ ] **Step 5: Kingdom War's Judgment Phase trigger; the registry**

In `projects/content/src/lib/modes/kingdomWar.ts`, add `import { judgmentPhaseTrigger } from '../shared/delayed';` and make `judgmentPhaseTrigger` the first entry of `triggers`. It fires on entering Judgment and the Draw trigger on entering Draw, so their order doesn't matter, but this keeps phase order.

In `projects/content/src/lib/registry.ts`, import `captureCard` and `starvationCard`, and add them to `cards` after `coerceCard`.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx jest projects/content projects/app/src/app/wiki`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add projects/content projects/app/src/app/wiki/wiki-pages.spec.ts
git commit -m "feat(content): Capture and Starvation, judged last in, first out in the Judgment Phase

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Lightning

**Files:**
- Create: `projects/content/src/lib/cards/lightning.ts`
- Modify: `projects/content/src/lib/registry.ts`, `registry.spec.ts`, `wiki.spec.ts`, `modes/kingdomWar.spec.ts`, `cards/delayed.spec.ts`, `projects/app/src/app/wiki/wiki-pages.spec.ts`

**Interfaces:**
- Consumes: `holdsDelayed`, `placeInJudgmentArea` and `judgeTarget` (Task 4), plus `livingSeatOrderFrom`, `judgmentZoneOf` and `requireZoneOfKind` from `engine`.
- Produces: `lightningCard`.

- [ ] **Step 1: Write the failing tests**

In `projects/content/src/lib/cards/delayed.spec.ts`, add `import { lightningCard } from './lightning';` and put `lightningCard` in the `cards` list. Then append:

```ts
describe('Lightning', () => {
  const hp = (s: GameState, seatId: string) => s.seats.find((x) => x.id === seatId)!.combinedHp;

  it('goes in the user’s own judgment area, one per seat', () => {
    const s = table({ 'seat-a:hand': [card('L', 'lightning')] }, { owner: 'seat-a', phase: 'Play' });
    expect(targetsFor(s, 'L')).toEqual([[]]);
    const next = resolve(s, { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'L', targets: [] }, ctx).state;
    expect(idsIn(next, 'seat-a:judgment')).toEqual(['L']);
    const held = table({ 'seat-a:hand': [card('L', 'lightning')], 'seat-a:judgment': [card('L2', 'lightning')] }, { owner: 'seat-a', phase: 'Play' });
    expect(targetsFor(held, 'L')).toEqual([]);
  });

  it('a spade from 2 to 9 deals 3 damage to its holder, with no source, and Lightning is discarded', () => {
    for (const rank of [2, 9]) {
      const next = run(table({ 'seat-b:judgment': [card('L', 'lightning', 'spade', 1)], drawPile: [card('j1', 'shan', 'spade', rank), ...filler(6)] }));
      expect(hp(next, 'seat-b')).toBe(1);
      expect(next.log.find((e) => e.kind === 'DamageDealtEvent')).toMatchObject({
        damage: { source: null, target: { kind: 'seat', seatId: 'seat-b' }, amount: 3, nature: 'normal' },
      });
      expect(idsIn(next, 'discardPile')).toEqual(expect.arrayContaining(['L', 'j1']));
    }
  });

  it('anything else moves it on to the next living seat that holds no Lightning', () => {
    for (const judged of [card('j1', 'shan', 'spade', 10), card('j1', 'shan', 'spade', 1), card('j1', 'shan', 'heart', 5)]) {
      const next = run(table({ 'seat-b:judgment': [card('L', 'lightning')], drawPile: [judged, ...filler(6)] }));
      expect(hp(next, 'seat-b')).toBe(4);
      expect(idsIn(next, 'seat-c:judgment')).toEqual(['L']);
      expect(next.log).toContainEqual(expect.objectContaining({ kind: 'CardMovedEvent', cardInstanceId: 'L', fromZoneId: 'seat-b:judgment', toZoneId: 'seat-c:judgment' }));
    }
  });

  it('passes over a seat that already holds a Lightning', () => {
    const next = run(table({ 'seat-b:judgment': [card('L', 'lightning')], 'seat-c:judgment': [card('L2', 'lightning')], drawPile: [card('j1', 'shan', 'heart', 5), ...filler(6)] }));
    expect(idsIn(next, 'seat-a:judgment')).toEqual(['L']);
  });

  it('stays put when every other living seat holds a Lightning (Review Focus 4)', () => {
    const next = run(table({
      'seat-a:judgment': [card('L1', 'lightning')], 'seat-b:judgment': [card('L', 'lightning')], 'seat-c:judgment': [card('L2', 'lightning')],
      drawPile: [card('j1', 'shan', 'heart', 5), ...filler(6)],
    }));
    expect(idsIn(next, 'seat-b:judgment')).toEqual(['L']);
    expect(next.turn.ownerSeatId).toBe('seat-b');
    expect(next.phase).toBe('Play');
  });

  it('a Wuxie Kongjie cancels it: no judgment, and it moves on', () => {
    const asked = run(table({ 'seat-b:judgment': [card('L', 'lightning')], 'seat-a:hand': [card('wx', 'wuxie')] }));
    const next = respond(asked, 'seat-a', 'wx');
    expect(judgments(next.log)).toEqual([]);
    expect(idsIn(next, 'seat-c:judgment')).toEqual(['L']);
  });

  it('kills its holder: eliminated, Lightning and the seat’s other delayed Tool discarded, and the next seat plays (Review Focus 1)', () => {
    const dying = run(table(
      { 'seat-b:judgment': [card('cap', 'capture'), card('L', 'lightning')], drawPile: [card('j1', 'shan', 'spade', 5), ...filler(6)] },
      { hp: { 'seat-b': 3 } }
    ));
    expect(dying.pendingResponse?.reason).toEqual({ kind: 'dying', seatId: 'seat-b' });
    const next = pass(dying, 'seat-b');
    expect(next.seats.find((s) => s.id === 'seat-b')!.eliminated).toBe(true);
    expect(judgments(next.log)).toEqual(['lightning:j1']); // Capture is never judged
    expect(idsIn(next, 'seat-b:judgment')).toEqual([]);
    expect(idsIn(next, 'discardPile')).toEqual(expect.arrayContaining(['L', 'cap', 'j1']));
    expect(next.result).toBeNull();
    expect(next.turn.ownerSeatId).toBe('seat-c');
    expect(next.phase).toBe('Play');
  });
});
```

Update the counts to include Lightning:
- `registry.spec.ts`: add `'lightning'`.
- `wiki.spec.ts`: `['barbarians', 'break', 'capture', 'coerce', 'draw-two', 'duel', 'hail-of-arrows', 'harvest', 'lightning', 'peach-garden', 'starvation', 'steal', 'wuxie']`.
- `kingdomWar.spec.ts`: `toHaveLength(91)`.
- `wiki-pages.spec.ts`: `'15 cards · 13 in the game'`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest projects/content/src/lib/cards/delayed.spec.ts`
Expected: FAIL. `./lightning` doesn't exist.

- [ ] **Step 3: Write `cards/lightning.ts`**

```ts
import type { CardDefinition, Effect } from 'engine';
import { judgmentZoneOf, livingSeatOrderFrom, requireZoneOfKind } from 'engine';
import { holdsDelayed, judgeTarget, placeInJudgmentArea } from '../shared/delayed';

const isStruck = (suit: string, rank: number) => suit === 'spade' && rank >= 2 && rank <= 9;

// Lightning: placed in the user's own judgment area (one per seat). Judged in
// the holder's Judgment Phase: a spade from 2 to 9 deals 3 damage to the
// holder, with no source, and Lightning is discarded. Anything else, or a
// Wuxie Kongjie, moves it on to the next living seat in seat order that holds
// no Lightning; with none, it stays.
export const lightningCard: CardDefinition = {
  id: 'lightning',
  name: 'Lightning',
  category: 'tool',
  delayed: true,
  legalPlayTargets: (state, ctx) => (holdsDelayed(state, ctx.seatId, 'lightning') ? [] : [[]]),
  play: (state, ctx) => (ctx.respondingTo ? [] : placeInJudgmentArea(state, ctx.cardInstanceId, ctx.seatId)),
  onTarget: judgeTarget,
  onJudged: (state, { tool, seatId, judged }) => {
    if (!isStruck(judged.suit, judged.rank)) return [];
    const card = tool.physical[0];
    const effects: Effect[] = [
      { kind: 'DamageEffect', damage: { source: null, target: { kind: 'seat', seatId }, amount: 3, nature: 'normal', ...(card ? { cause: { cardInstanceId: card.instanceId } } : {}) } },
    ];
    if (card) effects.push({ kind: 'MoveCardEffect', cardInstanceId: card.instanceId, toZoneId: requireZoneOfKind(state.zones, 'discardPile').id });
    return effects;
  },
  // Still in the holder's judgment area (it didn't strike): on to the next seat.
  onCleanup: (state, { tool, ownerSeatId }) => {
    const card = tool.physical[0];
    if (!card || !judgmentZoneOf(state, ownerSeatId)?.cards.some((c) => c.instanceId === card.instanceId)) return [];
    // Filtered rather than sliced: an eliminated holder isn't at the front.
    const next = livingSeatOrderFrom(state, ownerSeatId)
      .filter((id) => id !== ownerSeatId)
      .find((id) => !holdsDelayed(state, id, 'lightning'));
    return next ? placeInJudgmentArea(state, card.instanceId, next) : [];
  },
};
```

In `projects/content/src/lib/registry.ts`, import `lightningCard` and add it after `starvationCard`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest projects/content projects/app/src/app/wiki`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add projects/content projects/app/src/app/wiki/wiki-pages.spec.ts
git commit -m "feat(content): Lightning — 3 damage on a spade 2–9, otherwise on to the next seat

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Bots and the simulator

**Files:**
- Modify: `projects/bots/src/lib/rule-based.ts`, `rule-based.spec.ts`
- Modify: `projects/sim/src/invariants.ts`, `invariants.spec.ts`

**Interfaces:**
- Consumes: the card ids `capture`, `starvation` and `lightning` (Tasks 4 and 5).
- Produces: no new exports.

- [ ] **Step 1: Write the failing bot tests**

In `projects/bots/src/lib/rule-based.spec.ts`, add `card('capture', 'tool'), card('starvation', 'tool'), card('lightning', 'tool')` to the registry's card list. Then append:

```ts
describe('ruleBasedPolicy: delayed Tools', () => {
  const hand = (n: number, seatId: string) => ({
    id: `${seatId}:hand`, kind: 'hand' as const, ownerSeatId: seatId,
    cards: Array.from({ length: n }, (_, i) => ({ instanceId: `${seatId}-h${i}`, definitionId: 'hidden', suit: 'spade' as const, rank: 0 })),
  });

  it('places Capture on the highest-HP non-ally', () => {
    // seat-1 has 6 HP, seat-2 has 3.
    const v = view({ hand: [{ instanceId: 'cap', definitionId: 'capture' }] });
    expect(decide(v, [play('cap', 'seat-1'), play('cap', 'seat-2'), end]).action).toEqual(play('cap', 'seat-1'));
  });

  it('places Starvation on the non-ally in reach with the most hand cards', () => {
    const v = view({ hand: [{ instanceId: 'st', definitionId: 'starvation' }], zones: [hand(1, 'seat-1'), hand(3, 'seat-2')] });
    expect(decide(v, [play('st', 'seat-1'), play('st', 'seat-2'), end]).action).toEqual(play('st', 'seat-2'));
  });

  it('plays Lightning only at 3 HP or more', () => {
    const at = (hp: number) => view({ seats: [seat('seat-0', 0, 'Wei', hp), seat('seat-1', 1, 'hidden', 6)], hand: [{ instanceId: 'L', definitionId: 'lightning' }] });
    expect(decide(at(3), [play('L'), end]).action).toEqual(play('L'));
    expect(decide(at(2), [play('L'), end]).action).toEqual(end);
  });

  it('cancels a Starvation judged on itself', () => {
    const v = view({
      pendingFor: 'seat-0', hand: [{ instanceId: 'wx', definitionId: 'wuxie' }],
      pendingReason: { kind: 'wuxie', tool: { as: 'starvation', colour: 'black', physical: [] }, toolUserSeatId: 'seat-0', target: { kind: 'seat', seatId: 'seat-0' } },
    });
    const respond: Action = { kind: 'RespondAction', seatId: 'seat-0', pendingResponseId: 'r1', cardInstanceId: 'wx' };
    const passIt: Action = { kind: 'PassAction', seatId: 'seat-0', pendingResponseId: 'r1' };
    expect(decide(v, [respond, passIt]).action).toEqual(respond);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx jest projects/bots/src/lib/rule-based.spec.ts`
Expected: FAIL. The Capture, Starvation and Lightning plays fall through to End Phase, and the Starvation Wuxie passes.

- [ ] **Step 3: Implement**

In `projects/bots/src/lib/rule-based.ts`:
- Add `'starvation'` to `HARMFUL_TOOLS`.
- Insert this right after the Steal/Break block (`if (grab) return take(grab);`):

```ts
    // Delayed Tools. Capture: the highest-HP non-ally. Starvation: the
    // non-ally in reach with the most hand cards. Lightning: at 3 HP or more.
    const targetOf = (p: PlayCard) => view.seats.find((s) => s.id === p.targets[0]?.seatId);
    const handSize = (p: PlayCard) => {
      const target = targetOf(p);
      return target ? (view.zones.find((z) => z.id === target.hand.zoneId)?.cards.length ?? 0) : 0;
    };
    const best = (candidates: PlayCard[], score: (p: PlayCard) => number) =>
      candidates.reduce<PlayCard | undefined>((top, p) => (!top || score(p) > score(top) ? p : top), undefined);
    const capture = best(targetedPlays(view, self, plays, 'capture'), (p) => targetOf(p)?.combinedHp ?? 0);
    if (capture) return take(capture);
    const starvation = best(targetedPlays(view, self, plays, 'starvation'), handSize);
    if (starvation) return take(starvation);
    const lightning = untargetedOf('lightning');
    if (lightning && self.combinedHp >= 3) return take(lightning);
```

`targetedPlays` already drops allies and sorts by HP then seat index, so `best` keeps the earliest seat on ties.

- [ ] **Step 4: Write the failing sim invariant test**

Append to `projects/sim/src/invariants.spec.ts`, inside `describe('checkInvariants', …)`:

```ts
  it('flags a judgment area holding two of the same delayed Tool', () => {
    const delayed = (instanceId: string, definitionId: string): CardInstance => ({ instanceId, definitionId, suit: 'spade', rank: 1 });
    const state = baseState({
      zones: [{ id: 'seat-a:judgment', kind: 'judgment', ownerSeatId: 'seat-a', cards: [delayed('c1', 'capture'), delayed('l1', 'lightning'), delayed('c2', 'capture')] }],
    });
    expect(checkInvariants(state)).toEqual(['Judgment zone seat-a:judgment holds two capture cards']);
  });
```

- [ ] **Step 5: Run it to verify it fails, then implement**

Run: `npx jest projects/sim/src/invariants.spec.ts`
Expected: FAIL. The result is `[]`.

In `projects/sim/src/invariants.ts`, after the `if (registry) { … equip … }` block, add:

```ts
  // A seat never holds two of the same delayed Tool (Capture, Lightning, Starvation).
  for (const zone of state.zones.filter((z) => z.kind === 'judgment')) {
    const seen = new Set<string>();
    for (const card of zone.cards) {
      if (seen.has(card.definitionId)) violations.push(`Judgment zone ${zone.id} holds two ${card.definitionId} cards`);
      seen.add(card.definitionId);
    }
  }
```

- [ ] **Step 6: Run the bots, the sim and the property batches**

Run: `npx jest projects/bots projects/sim`
Expected: PASS. `property.spec.ts` plays seeded games at every seat count with the full registry, so delayed Tools, judgments, skipped phases and Lightning moving on are now exercised under every invariant.

- [ ] **Step 7: Commit**

```bash
git add projects/bots projects/sim
git commit -m "feat(bots): place Capture, Starvation and Lightning; sim checks judgment areas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: App — Judgment slots, the judgment's Wuxie question, and Action History lines

**Files:**
- Modify: `projects/app/src/app/game-board/seat-tile.ts` (+spec), `round-table.ts` (+spec)
- Modify: `projects/app/src/app/game-board/response-description.ts` (+spec)
- Modify: `projects/app/src/app/game-board/action-history.ts` (+spec)

**Interfaces:**
- Consumes: `JudgmentEvent` and `PhaseSkippedEvent` (Tasks 2 and 3), and `Seat.judgment` (Task 1).
- Produces: `SeatTile.judgment = input<CardInstance[]>([])`.

- [ ] **Step 1: Write the failing seat-tile and round-table tests**

In `projects/app/src/app/game-board/seat-tile.spec.ts`, extend `render`'s options with `judgment?: CardInstance[]`, and add `fixture.componentRef.setInput('judgment', opts.judgment ?? []);` next to `equipment`. Then add:

```ts
  it('always has a Judgment slot, with a placeholder while it is empty', () => {
    const area = render(makeSeat()).querySelector('.judgment')!;
    expect(area.getAttribute('aria-label')).toBe('Judgment Area');
    expect(area.querySelectorAll('.slot')).toHaveLength(1);
    expect(area.querySelector('.slot')!.classList).toContain('empty');
    expect(area.querySelector('.slot')!.getAttribute('title')).toBe('Judgment Area (empty)');
  });

  it('shows each card in the Judgment slot, small and face up, oldest first, with its Info', () => {
    const el = render(makeSeat(), {
      judgment: [
        { instanceId: 'j1', definitionId: 'capture', suit: 'spade', rank: 6 },
        { instanceId: 'j2', definitionId: 'lightning', suit: 'spade', rank: 1 },
      ],
    });
    const slots = [...el.querySelectorAll('.judgment .slot')] as HTMLElement[];
    expect(slots).toHaveLength(2);
    expect(slots.some((x) => x.classList.contains('empty'))).toBe(false);
    expect(slots[0].querySelector('app-card-art img')!.classList).toContain('small');
    expect(slots.map((x) => x.querySelector('button.slot-card')!.getAttribute('aria-label'))).toEqual(['Info: Capture', 'Info: Lightning']);
  });

  it('still shows the Judgment slot for an eliminated seat', () => {
    expect(render(makeSeat({ eliminated: true })).querySelector('.judgment .slot')).not.toBeNull();
  });
```

In `projects/app/src/app/game-board/round-table.spec.ts`, add:

```ts
  it('passes each seat the cards in its Judgment slot', () => {
    const lightning = { instanceId: 'L', definitionId: 'lightning', suit: 'spade' as const, rank: 1 };
    const zones: CardZone[] = [...state().zones, { id: 'seat-0:judgment', kind: 'judgment', ownerSeatId: 'seat-0', cards: [lightning] }];
    const el = render(state({ zones }));
    expect(tile(el, 'seat-0').querySelectorAll('.judgment app-playing-card')).toHaveLength(1);
    expect(tile(el, 'seat-1').querySelectorAll('.judgment app-playing-card')).toHaveLength(0);
    expect(tile(el, 'seat-1').querySelector('.judgment .slot.empty')).not.toBeNull();
  });
```

- [ ] **Step 2: Write the failing text tests**

Append to `projects/app/src/app/game-board/response-description.spec.ts`:

```ts
describe('describeResponse: a judgment’s Wuxie Kongjie check', () => {
  const capture: CardInstance = { instanceId: 'cap-1', definitionId: 'capture', suit: 'spade', rank: 6 };
  const judging = (owner: string): GameState => ({
    ...state([], wuxieWindow('seat-0', { kind: 'wuxie', tool: used(capture), toolUserSeatId: owner, target: seat(owner) })),
    zones: [{ id: `${owner}:judgment`, kind: 'judgment', ownerSeatId: owner, cards: [capture] }],
  });

  it('says whose judgment is coming, not who used the card', () => {
    expect(describeResponse(judging('seat-1'), 'seat-0')).toMatchObject({
      source: 'Seat 1 is about to judge Capture',
      prompt: 'Play Wuxie to cancel it?',
      outcome: 'Seat 1 judges Capture',
    });
  });

  it('speaks to the viewer about their own judgment', () => {
    expect(describeResponse(judging('seat-0'), 'seat-0')).toMatchObject({ source: 'You are about to judge Capture', outcome: 'You judge Capture' });
  });
});
```

Append to `projects/app/src/app/game-board/action-history.spec.ts`:

```ts
describe('actionHistory: judgments', () => {
  const judgmentZones: CardZone[] = [
    ...zones,
    { id: 'processing', kind: 'processing', cards: [] },
    { id: 'seat-0:judgment', kind: 'judgment', ownerSeatId: 'seat-0', cards: [] },
    { id: 'seat-1:judgment', kind: 'judgment', ownerSeatId: 'seat-1', cards: [] },
  ];
  const lines = (log: EngineEvent[]) => actionHistory(log, judgmentZones).flatMap((e) => (e.kind === 'action' ? [e.text] : []));
  const lightning: CardInstance = { instanceId: 'L', definitionId: 'lightning', suit: 'spade', rank: 1 };
  const capture: CardInstance = { instanceId: 'cap', definitionId: 'capture', suit: 'heart', rank: 6 };
  const judged: CardInstance = { instanceId: 'j1', definitionId: 'shan', suit: 'heart', rank: 5 };
  const used = (card: CardInstance) => ({ as: card.definitionId, colour: 'black' as const, suit: card.suit, rank: card.rank, physical: [card] });

  it('tells the judgment, the skipped phase, and the delayed Tool discarded', () => {
    const log: EngineEvent[] = [
      { kind: 'CardPlayedEvent', seatId: 'seat-1', card: capture, targets: [seat('seat-0')] },
      move(capture, 'seat-1:hand', 'seat-0:judgment'),
      { kind: 'JudgmentEvent', seatId: 'seat-0', tool: used(capture), card: judged },
      move(judged, 'processing', 'discardPile'),
      move(capture, 'seat-0:judgment', 'discardPile'),
      { kind: 'PhaseSkippedEvent', seatId: 'seat-0', phase: 'Play' },
    ];
    expect(lines(log)).toEqual([
      'Seat 0 skipped the Play Phase',
      "Seat 0's Capture was discarded",
      "Seat 0's Capture judgment: 5 ♥",
      'Seat 1 used Capture (6 ♥) on Seat 0',
    ]);
  });

  it('says where Lightning moved on to', () => {
    expect(lines([move(lightning, 'seat-0:judgment', 'seat-1:judgment')])).toEqual(['Lightning (A ♠) moved on from Seat 0 to Seat 1']);
  });
});
```

Add `CardZone` to that spec file's `engine` import if it isn't there.

- [ ] **Step 3: Run them to verify they fail**

Run: `npx jest projects/app/src/app/game-board/seat-tile.spec.ts projects/app/src/app/game-board/round-table.spec.ts projects/app/src/app/game-board/response-description.spec.ts projects/app/src/app/game-board/action-history.spec.ts`
Expected: FAIL. There is no Judgment slot yet, the Wuxie source reads "Seat 1 used Capture", and the history has no judgment lines.

- [ ] **Step 4: The Judgment slot on the seat tile**

In `projects/app/src/app/game-board/seat-tile.ts`:
- Add `readonly judgment = input<CardInstance[]>([]);` after `equipment`.
- In the template, right after the closing `</div>` of `.equip`, add a row that is always there. It shows one slot per card, oldest first, or one empty slot when there are none (the same slot look as the equipment):

```html
      <div class="judgment" aria-label="Judgment Area">
        @for (card of judgment(); track card.instanceId) {
          <div class="slot" [attr.title]="'Judgment Area: ' + cardIdDisplayName(card.definitionId)">
            <button type="button" class="slot-card" [attr.aria-label]="'Info: ' + cardIdDisplayName(card.definitionId)" (click)="openInfo(card)">
              <app-playing-card size="small" [card]="card" />
            </button>
          </div>
        } @empty {
          <div class="slot empty" title="Judgment Area (empty)"><mat-icon>balance</mat-icon></div>
        }
      </div>
```

- In `styles`, add: `.judgment { display: flex; gap: 5px; justify-content: center; margin-top: 4px; }`. The `.slot` rules already apply.

In `projects/app/src/app/game-board/round-table.ts`:
- Add `[judgment]="judgmentOf(p.seat.judgment.zoneId)"` to `<app-seat-tile>`.
- Add this method next to `equipmentOf`:

```ts
  protected judgmentOf(zoneId: string) {
    return this.state().zones.find((z) => z.id === zoneId)?.cards ?? [];
  }
```

- [ ] **Step 5: The judgment's Wuxie question**

In `projects/app/src/app/game-board/response-description.ts`, at the top of the `if (pending.reason?.kind === 'wuxie') {` block, right after `const toolName = …`, add:

```ts
    // A delayed Tool still lying in a judgment area is being judged there.
    const toolCardId = tool.physical[0]?.instanceId;
    const judgedOwner = state.zones.find((z) => z.kind === 'judgment' && z.cards.some((c) => c.instanceId === toolCardId))?.ownerSeatId;
    if (judgedOwner) {
      const you = judgedOwner === viewerSeatId;
      return {
        source: `${you ? 'You are' : `${name(judgedOwner)} is`} about to judge ${toolName}`,
        latest: null,
        prompt: `Play ${askedCardName(state)} to cancel it?`,
        outcome: `${you ? 'You judge' : `${name(judgedOwner)} judges`} ${toolName}`,
        outcomeForce: forceOf(state.seats.find((s) => s.id === judgedOwner)?.kingdom),
      };
    }
```

- [ ] **Step 6: The Action History lines**

In `projects/app/src/app/game-board/action-history.ts`:

- In the `CardMovedEvent` case, replace the tail (from `if (!event.card || to?.kind !== 'discardPile' …` to the end of the case) with:

```ts
        // Lightning moving on to the next seat's judgment area.
        if (event.card && from?.kind === 'judgment' && to?.kind === 'judgment' && from.ownerSeatId && to.ownerSeatId) {
          action(`${named(event.card)} moved on from ${name(from.ownerSeatId)} to ${name(to.ownerSeatId)}`, event.card);
          break;
        }
        if (!event.card || to?.kind !== 'discardPile' || !from?.ownerSeatId) break;
        if (from.kind === 'hand') action(`${name(from.ownerSeatId)} discarded ${named(event.card)}`, event.card);
        if (from.kind === 'equip' || from.kind === 'judgment') action(`${name(from.ownerSeatId)}'s ${cardName(event.card.definitionId)} was discarded`, event.card);
        break;
```

- Add two cases before `case 'DiscardPileReshuffledEvent':`:

```ts
      case 'JudgmentEvent':
        action(`${name(event.seatId)}'s ${cardName(event.tool.as)} judgment: ${cardFaceLabel(event.card)}`, event.card);
        break;
      case 'PhaseSkippedEvent':
        action(`${name(event.seatId)} skipped the ${event.phase} Phase`);
        break;
```

The judged card's own move (processing → discard pile) has no owner, so it adds no line. The delayed Tool's move from the hand into a judgment area is its play's own move, so it adds no line either.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx jest projects/app`
Expected: PASS.

Run: `npm run build && npx ng build app`
Expected: both builds succeed.

- [ ] **Step 8: Commit**

```bash
git add projects/app
git commit -m "feat(app): judgment areas on seat tiles, the judgment's Wuxie question, and Action History lines for judgments

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: The event chain doc, and the full check

**Files:**
- Modify: `docs/architecture/event-chain.md`

- [ ] **Step 1: Add a "Judgments" section, and drop the duplicate heading**

In `docs/architecture/event-chain.md`, delete one of the two consecutive `## Plugging into the chain` lines. Then insert this section after the "Choices" section, before `## Plugging into the chain`:

```markdown
## Judgments

A **delayed Tool** (Capture, Lightning, Starvation) doesn't take effect when it
is played. Its `play()` puts it face up in a seat's Judgment slot
(`Seat.judgment`; `CardDefinition.delayed` stops `PlayCardAction` from
discarding it).

In Kingdom War, entering the Judgment Phase queues two steps for each card in
the turn owner's Judgment slot, last in, first out:

1. `ToolOnTargetEffect` on the owner. It runs the usual Wuxie check, asked from
   the owner. If nobody cancels, the Tool's `onTarget` queues a `JudgeEffect`.
2. `DelayedCleanupEffect`. It always runs, cancelled or not. It runs the card's
   `onCleanup` (Lightning moves on). Without one, it discards the card if it is
   still in the judgment area.

`JudgeEffect` turns up the draw pile's top card into `processing` and logs
`JudgmentEvent`. It then queues the Tool's `onJudged` reading of that card,
followed by the judged card's move to the discard pile. With no card left
anywhere, nothing is judged.

A reading usually sets a **turn flag** (`SetTurnFlagEffect`). `advancePhaseOrTurn`
passes over any phase whose skip flag (`skipFlagOf(phase)`, e.g. `skipPlay`) is
set, and `PhaseSkippedEvent` records it. Flags end with the turn.
```

- [ ] **Step 2: Run everything**

Run: `npx jest`
Expected: PASS, every project.

Run: `npm run build && npx ng build app`
Expected: both builds succeed.

- [ ] **Step 3: Commit**

```bash
git add docs/architecture/event-chain.md
git commit -m "docs: judgments, delayed Tools and turn flags in the event chain

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: HP images on the seat tile and the General Selection preview

Added 2026-10-06 at the user's request: alongside the HP number, show the `hp_<x>.jpg` image for the current HP. The images live in `projects/content/assets/misc/` and are served under `/card-art/misc/`.

**Rule (display only):**
- HP 1–4 show `hp_1.jpg` to `hp_4.jpg`.
- Above 4, the image is `hp_4.jpg`, since there is no `hp_5`. A seat with Dong Zhuo (8 HP) can reach 6.
- At 0 HP or below (a dying seat), no image is shown. The HP text and the "Dying…" status stay.
- The image is decorative (`alt=""`), because the HP text next to it already says the number.

**Files:**
- Modify: `projects/content/src/lib/assets.ts`, `assets.spec.ts`
- Modify: `projects/app/src/app/game-board/seat-tile.ts` (+spec), `general-selection.ts` (+spec)

**Interfaces:**
- Produces: `hpImageUrl(hp: number): string | null`, from `content`.

- [ ] **Step 1: Write the failing tests**

Append to `projects/content/src/lib/assets.spec.ts`. Add `hpImageUrl` to its import.

```ts
describe('hpImageUrl', () => {
  it('shows the image for HP 1 to 4', () => {
    expect([1, 2, 3, 4].map(hpImageUrl)).toEqual([1, 2, 3, 4].map((n) => `/card-art/misc/hp_${n}.jpg`));
  });
  it('uses the 4 HP image above 4', () => {
    expect(hpImageUrl(6)).toBe('/card-art/misc/hp_4.jpg');
  });
  it('shows none at 0 HP or below', () => {
    expect(hpImageUrl(0)).toBeNull();
    expect(hpImageUrl(-2)).toBeNull();
  });
});
```

In `projects/app/src/app/game-board/seat-tile.spec.ts`:

```ts
  it('shows the image for the seat’s current HP next to its HP text', () => {
    const img = render(makeSeat({ combinedHp: 3 })).querySelector('.stats img.hp-image') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('/card-art/misc/hp_3.jpg');
    expect(img.getAttribute('alt')).toBe('');
  });

  it('shows no HP image for a dying seat', () => {
    expect(render(makeSeat({ combinedHp: 0 })).querySelector('img.hp-image')).toBeNull();
  });
```

In `projects/app/src/app/game-board/general-selection.spec.ts`, extend the summary test:

```ts
    expect(el.querySelector('.summary img.hp-image')!.getAttribute('src')).toBe('/card-art/misc/hp_3.jpg');
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx jest projects/content/src/lib/assets.spec.ts projects/app/src/app/game-board/seat-tile.spec.ts projects/app/src/app/game-board/general-selection.spec.ts`
Expected: FAIL. `hpImageUrl` isn't exported, and there is no `img.hp-image`.

- [ ] **Step 3: Implement**

In `projects/content/src/lib/assets.ts`:

```ts
// The highest HP with its own image (misc/hp_1.jpg … hp_4.jpg).
const MAX_HP_IMAGE = 4;

// The image for a seat's current HP, alongside its number. Above 4 it shows
// the 4 HP image; at 0 or below (dying) there is none.
export function hpImageUrl(hp: number): string | null {
  if (hp <= 0) return null;
  return `/card-art/misc/hp_${Math.min(hp, MAX_HP_IMAGE)}.jpg`;
}
```

In `seat-tile.ts`:
- Import `hpImageUrl` from `content`.
- Add `protected readonly hpImage = computed(() => hpImageUrl(this.seat().combinedHp));`.
- In `.stats`, put this before the `HP` span:

```html
        @if (hpImage(); as src) {
          <img class="hp-image" [src]="src" alt="" />
        }
```

- Add the style: `.hp-image { height: 22px; width: auto; border-radius: 4px; vertical-align: middle; }`, and `align-items: center` on `.stats`.

In `general-selection.ts`:
- Import `hpImageUrl` from `content`, and add `hpImage: hpImageUrl(hp)` to `summary()`'s result. Bind the computed `hp` value first.
- In the summary template:

```html
        @if (summary(); as s) {
          Kingdom: {{ s.kingdom }} · Combined HP: {{ s.hp }}
          @if (s.hpImage; as src) {
            <img class="hp-image" [src]="src" alt="" />
          }
        }
```

- Add the style: `.hp-image { height: 28px; width: auto; border-radius: 4px; vertical-align: middle; margin-left: 6px; }`.

- [ ] **Step 4: Run them to verify they pass**

Run: `npx jest projects/content projects/app`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add projects/content/src/lib/assets.ts projects/content/src/lib/assets.spec.ts projects/app/src/app/game-board
git commit -m "feat(app): HP images beside the HP number on seat tiles and in the General Selection preview

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
