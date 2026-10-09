# Stage 9: The Fire Generals — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
- Give the 8 Fire Generals their real skills: Dian Wei, Xun Yu, Pang Tong, Fire Zhuge Liang, Taishi Ci, Pang De, Yan Liang and Wen Chou, Yuan Shao.
- Add one "Choose Targets" window for effects with several equal targets.
- Move the specs onto test-only filler Generals.

**Architecture:**
- **Engine (generic):**
  - `CardDefinition.targetPick` lets a card take 1 to N targets. Legal actions then offer one play template with `pickTargets` (cards and conversions alike), and `resolve` checks the submitted targets.
  - `Conversion.sameSuit` plus a `sameSuit` selection rule;
  - `CardDefinition.outOfDeck`;
  - `TurnFaceUpEffect`.
- **Content:**
  - Sha's `targetPick`: Sky Scorcher becomes a modifier, not an ask; the turn-long Sha flags.
  - `shared/compete.ts`;
  - Eight Trigrams' ability shared with Eight Arrays;
  - the Blaze card (out of the deck);
  - `generals/fire.ts`.
- **Around it:**
  - bots fill target templates, compete and use the Fire skills;
  - the sim adds base + Wind + Fire batches and Fire forced pairings;
  - the app gains the Choose Targets window, competing and Blaze prompts, and history lines.

**Tech Stack:** TypeScript, Jest (ts-jest), Angular 22 (app task).

**Spec:** `docs/superpowers/specs/2026-10-09-stage-9-fire-generals-design.md` (binding). Stages 7–8 common rules still hold.

**Where this plan departs from the spec, and why:**
- **Godspeed's Sha keeps its one-seat choice.** Its maximum is always 1: Xiahou Yuan (Wei) can't pair with Taishi Ci (Wu), and a Sha with no physical card can't be a last hand card for Sky Scorcher. So the window has nothing to offer there; the spec's line is satisfied trivially.
- **For a conversion, Sky Scorcher's +2 applies only to a conversion taken from the hand alone** (not `hand-and-equipment`), when the hand holds exactly the cards it takes. The targets are picked before the cards, so a conversion that may use a worn card can't be known to empty the hand.
- **Competing is a content helper run as the owning skill's steps** (`compete-user`, `compete-target`, then the skill's result step). Each competing skill's `onStep` hands those two steps to `competeStep` first.
- **Test fillers are named for the General they replace** (`filler-xu-huang`: Wei, male, 4 HP, no skills). This is a one-to-one swap, so a table never ends up holding the same filler twice. They are added by a test helper, never by the real registry.
- **Blaze's two picks are card steps** (`blaze-shown`, `blaze-hit`). Their prompts come from a new content lookup by step name, `stepSelectionText`.

## Global Constraints

- **The engine names no card or skill.** Content supplies everything specific (CLAUDE.md, "Extensibility").
- **Game state stays plain serialisable data.** Absent optional state is left out.
- **Several equal targets:** "An effect whose targets are all equal … has all its targets chosen in one window. An effect whose seats play different roles (Coerce) keeps its two-step menu" (spec).
- **Competing:** "The user wins only with a strictly higher rank (A is 1, K is 13). A tie loses." (spec)
- **No elemental damage:** Blaze deals plain damage; Chains isn't added (spec).
- **"May" always asks;** hidden Generals' optional skills are offered as "Reveal X to use Y"; compulsory skills and modifiers of a hidden General don't apply; Lord skills are inactive.
- **Every skill acts for its `owner`.**
- **UI text** follows CLAUDE.md's UI text style. Buttons in Title Case ("Choose Targets", "Confirm", "Show", "Pay"); prompts and history lines in sentence case with keywords capitalised.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A Sha with 4 targets.** Taishi Ci wins Heaven's Justice and wears Sky Scorcher, and his last hand card is a Sha. The template offers up to 4 seats at any distance. He picks 4: one Sha counted, and each target answers on its own. Submitting a 5th seat, a repeated seat or an unlisted seat is rejected. (Tests in Tasks 2 and 3.)
2. **A conversion Sha with several targets.** Taishi Ci's Fighting Saint isn't possible, so this uses Serpent Spear's 2 hand cards as his last cards after a win. Targets are chosen first, then the cards. The Sha resolves at each target. (Test in Task 3.)
3. **A competing tie.** Both cards are 7s: the user loses. Rouse the Tiger then damages Xun Yu, and Heaven's Justice bars his Sha for the turn. (Tests in Tasks 4 and 6.)
4. **Nirvana twice.** The second dying round doesn't ask: the dying round goes ahead. (Test in Task 5.)
5. **Eight Arrays with armour worn.** Not asked. With no armour but against Black Pommel's Sha: not asked. (Test in Task 5.)

---

## File Structure

**Engine (`projects/engine/src/lib/`):**
- Modify: `registry/types.ts`, `pipeline/actions.ts`, `pipeline/effects.ts`, `pipeline/resolve.ts`, `rules/legality.ts`, `rules/selection.ts`, `domain/types.ts`.
- Create: `pipeline/targetPick.spec.ts`, `pipeline/sameSuit.spec.ts`.

**Content (`projects/content/`):**
- Create:
  - `src/lib/generals/fillers.testing.ts`;
  - `src/lib/generals/fire.ts`, with specs `fire-wei.spec.ts`, `fire-shu.spec.ts`, `fire-wu-qun.spec.ts`;
  - `src/lib/shared/compete.ts`, `src/lib/shared/shaRules.ts`, `src/lib/shared/groundwork9.spec.ts`;
  - `src/lib/cards/blaze.ts`.
- Modify:
  - `src/lib/cards/sha.ts`, `src/lib/cards/equipment/sky-scorcher.ts`, `src/lib/cards/equipment/eight-trigrams.ts`;
  - `src/lib/shared/queries.ts`;
  - `src/lib/modes/kingdomWar.ts`, `src/lib/registry.ts`;
  - `src/lib/generals/index.ts`, `src/lib/display.ts`, `src/public-api.ts`;
  - specs using real Generals as fillers.

**Bots / sim:** `bots/src/lib/fire.ts` (new), `bots/src/lib/skills.ts`, `bots/src/lib/rule-based.ts`, `bots/src/lib/random.ts`, `bots/src/lib/testing.ts`, specs; `sim/src/fire.spec.ts` (new).

**App (`projects/app/src/app/`):** `game-board/targets-dialog.ts` (new), `game-board/hand-view.ts`, `game-board/action-list.ts`, `game-board/game-board.ts`, `game-board/ability-description.ts`, `game-board/action-history.ts`, `labels.ts`, specs.

**Docs:** `docs/architecture/event-chain.md`; the stage 9 spec's rulings.

---

### Task 1: Test-only fillers, and the Fire file

The specs use real expansion Generals as skill-less fillers, and each stage has had to swap them out. This task replaces every such filler with a test-only General of the same kingdom, gender and max HP, named for the General it replaces.

**Files:**
- Create: `projects/content/src/lib/generals/fillers.testing.ts`, `projects/content/src/lib/generals/fire.ts`
- Modify:
  - `projects/content/src/lib/generals/index.ts`, `index.spec.ts`, `base.spec.ts`, `skills.testing.ts`, `projects/content/src/public-api.ts`;
  - every content spec and the bots' `testing.ts` / specs that name an expansion General as a filler.

**Interfaces:**
- Produces:
  - `FILLER_IDS` (the real Generals replaced) and `withFillers(registry: ContentRegistry): ContentRegistry`. It adds `filler-<id>` for each, with the original's kingdom, gender and max HP and no skills, and returns the same registry.
  - `FIRE_GENERALS: GeneralSkillSet[]` (empty now); `FIRE_GENERAL_IDS` exported from `content`.

- [ ] **Step 1: Write the failing tests**

In `projects/content/src/lib/generals/index.spec.ts` add:

```ts
import { FIRE_GENERAL_IDS } from './index';
import { buildContentRegistry } from '../registry';

describe('FIRE_GENERAL_IDS', () => {
  it('is every Fire General in the data', () => {
    const fire = Object.entries(generalsData).filter(([, g]) => g.source.expansion === 'Fire').map(([id]) => id);
    expect([...FIRE_GENERAL_IDS].sort()).toEqual(fire.sort());
  });
});

describe('test fillers', () => {
  it('never reach the real registry', () => {
    expect([...buildContentRegistry().generals.keys()].filter((id) => id.startsWith('filler-'))).toEqual([]);
  });
});
```

(merge imports with the file's existing ones).

- [ ] **Step 2: Run it**

Run: `npx jest projects/content/src/lib/generals/index.spec.ts`
Expected: FAIL — `FIRE_GENERAL_IDS` is not exported.

- [ ] **Step 3: The fillers**

Create `projects/content/src/lib/generals/fillers.testing.ts`:

```ts
import type { ContentRegistry } from 'engine';

// Test-only stand-ins for real Generals the specs once used as skill-less
// fillers: `filler-<id>` has the original's kingdom, gender and max HP, and no
// skills, so a later stage giving the original skills changes no spec. Never
// part of the real registry.
export const FILLER_IDS: readonly string[] = [
  'xu-huang', 'zhang-he', 'cao-pi', 'xun-yu', 'dian-wei', 'deng-ai',
  'jiang-wei', 'meng-huo', 'liu-shan', 'zhu-rong', 'pang-tong',
  'sun-jian', 'sun-ce', 'lu-su', 'taishi-ci', 'zhang-zhao-and-zhang-hong',
  'dong-zhuo', 'jia-xu', 'zuo-ci', 'yuan-shao', 'cai-wenji', 'pang-de',
];

export function withFillers(registry: ContentRegistry): ContentRegistry {
  for (const id of FILLER_IDS) {
    const real = registry.generals.get(id);
    if (!real) throw new Error(`No General ${id} to make a filler from`);
    registry.generals.set(`filler-${id}`, { id: `filler-${id}`, kingdom: real.kingdom, maxHp: real.maxHp, gender: real.gender, skills: [] });
  }
  return registry;
}
```

(Before writing the list, grep the specs for every non-base, non-Wind General id used as a filler and include each.)

- [ ] **Step 4: The Fire file and list**

Create `projects/content/src/lib/generals/fire.ts` (the same header comment as `wind.ts`) with `export const FIRE_GENERALS: GeneralSkillSet[] = [];`. In `index.ts` add `...FIRE_GENERALS` to `HAND_CODED` and:

```ts
// The 8 Fire Generals (stage 9).
export const FIRE_GENERAL_IDS: readonly string[] = ['dian-wei', 'xun-yu', 'pang-tong', 'fire-zhuge-liang', 'taishi-ci', 'pang-de', 'yan-liang-and-wen-chou', 'yuan-shao'];
```

Export it from `public-api.ts`.

In `base.spec.ts`:
- "only base and Wind Generals have skills" also allows `FIRE_GENERAL_IDS`;
- add an `it.todo` for the Fire skills' data check (made real in Task 6).

- [ ] **Step 5: Move the specs to the fillers**

- `skills.testing.ts`: `export const registry = withFillers(buildContentRegistry());`. The default seat becomes `['filler-xu-huang', 'filler-dong-zhuo']`, with its comment updated.
- Every other spec that builds a registry with `buildContentRegistry()` and seats an expansion General as a filler wraps it in `withFillers(...)`, and renames each filler id `x` to `filler-x`. The specs are `sha-equipment.spec.ts`, `playability.spec.ts`, `kingdomWar.spec.ts` and the generals specs.
- Leave real ids that a test is *about* (display, wiki, gender, registry data checks) unchanged.
- Bots: `projects/bots/src/lib/testing.ts` cannot import a content test file, so it adds the same fillers itself. Copy `withFillers`'s loop into it with the same `FILLER_IDS` list, then rename filler ids in `skills.spec.ts` and `wind.spec.ts`.

- [ ] **Step 6: Run the whole suite and commit**

Run: `npx jest`
Expected: PASS.

```bash
git add -A projects
git commit -m "test: test-only filler Generals instead of real expansion ones; the Fire Generals' file

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Engine — several targets in one pick, same-suit pairs, cards out of the deck, turning face up

**Files:**
- Create: `projects/engine/src/lib/pipeline/targetPick.spec.ts`, `projects/engine/src/lib/pipeline/sameSuit.spec.ts`
- Modify: `projects/engine/src/lib/registry/types.ts`, `projects/engine/src/lib/pipeline/actions.ts`, `projects/engine/src/lib/pipeline/effects.ts`, `projects/engine/src/lib/pipeline/resolve.ts`, `projects/engine/src/lib/rules/legality.ts`, `projects/engine/src/lib/rules/selection.ts`, `projects/engine/src/lib/domain/types.ts`

**Interfaces:**
- Produces:
  - `TargetPick { eligibleIds: string[]; min: number; max: number }`.
  - `CardDefinition.targetPick?(state, ctx: PlayOptionsContext, registry): TargetPick | null`.
  - `PlayOptionsContext` gains `via?: { cards: number; fromHandOnly: boolean }`, set when asked for a conversion.
  - `PlayCardAction.pickTargets?: TargetPick` and `UseConversionAction.pickTargets?: TargetPick`, carried only by the offered templates.
  - When `targetPick` returns `max > 1`, `getLegalActions` offers that card (or conversion) once, as a template with `targets: []` and `pickTargets`. Otherwise it offers one action per target list as today.
  - `resolve` accepts targets for a card with such a pick when they are distinct, listed, and between `min` and `max`.
  - `Conversion.sameSuit?: true`; `PendingSelection.sameSuit?: true`; `validateSelection` rejects mixed suits; a `sameSuit` conversion is usable only with enough cards of one suit.
  - `CardDefinition.outOfDeck?: true` (read by content's deck builder).
  - `{ kind: 'TurnFaceUpEffect'; seatId: string }` (logs `SeatTurnedEvent` with `faceDown: false`).

- [ ] **Step 1: Write the failing tests**

Create `projects/engine/src/lib/pipeline/targetPick.spec.ts`:

```ts
import { advanceToDecision, resolve } from './resolve';
import { getLegalActions } from '../rules/legality';
import { CardDefinition, ContentRegistry, GameModeDefinition, SkillDefinition } from '../registry/types';
import { Action } from './actions';
import { CardInstance, GameState } from '../domain/types';

const mode: GameModeDefinition = { id: 'stub', setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'], checkWinCondition: () => null, triggers: [] };
// 'volley' heals each target 1; it may take 1 to 3 of the other seats.
const volley: CardDefinition = {
  id: 'volley', name: 'Volley', category: 'basic',
  legalPlayTargets: (state, ctx) => state.seats.filter((s) => s.id !== ctx.seatId).map((s) => [{ kind: 'seat' as const, seatId: s.id }]),
  targetPick: (state, ctx) => ({ eligibleIds: state.seats.filter((s) => s.id !== ctx.seatId).map((s) => s.id), min: 1, max: ctx.via ? 2 : 3 }),
  play: (_s, ctx) => ctx.targets.map((t) => ({ kind: 'HealEffect' as const, target: t, amount: 1 })),
};
const plain: CardDefinition = { id: 'plain', name: 'Plain', category: 'basic', play: () => [] };
const asVolley: SkillDefinition = { id: 'as-volley', conversions: [{ id: 'as-volley', as: 'volley', cards: 1, when: 'play' }] };
const registry: ContentRegistry = {
  cards: new Map([['volley', volley], ['plain', plain]]),
  generals: new Map([['g', { id: 'g', kingdom: 'Wei', maxHp: 4, skills: [asVolley] }]]),
};
const ctx = { registry, mode };
const card = (instanceId: string, definitionId: string): CardInstance => ({ instanceId, definitionId, suit: 'spade', rank: 3 });

function table(): GameState {
  const ids = ['a', 'b', 'c', 'd', 'e'];
  return {
    seats: ids.map((id, index) => ({
      id, index, kingdom: 'Wei' as const, eliminated: false, combinedHp: 2, maxCombinedHp: 4,
      generals: { main: { generalDefinitionId: 'g', revealed: true }, deputy: { generalDefinitionId: 'g', revealed: true } },
      hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` },
    })),
    players: [], turn: { turnNumber: 1, ownerSeatId: 'a', extraTurnStack: [] }, phase: 'Play',
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: [] }, { id: 'discardPile', kind: 'discardPile', cards: [] }, { id: 'processing', kind: 'processing', cards: [] },
      ...ids.flatMap((id) => [
        { id: `${id}:hand`, kind: 'hand' as const, ownerSeatId: id, cards: id === 'a' ? [card('v', 'volley'), card('p', 'plain')] : [] },
        { id: `${id}:equip`, kind: 'equip' as const, ownerSeatId: id, cards: [] },
        { id: `${id}:judgment`, kind: 'judgment' as const, ownerSeatId: id, cards: [] },
      ]),
    ],
    pendingResponse: null, log: [], rng: { seed: 1, counter: 0 }, result: null, generalSelection: null,
  };
}
const seats = (...ids: string[]) => ids.map((seatId) => ({ kind: 'seat' as const, seatId }));
const play = (s: GameState, ...targets: string[]) => resolve(s, { kind: 'PlayCardAction', seatId: 'a', cardInstanceId: 'v', targets: seats(...targets) }, ctx).state;

describe('a card that may take several targets', () => {
  it('is offered once, as a template carrying its pick', () => {
    const plays = getLegalActions(table(), 'a', registry).filter((a) => a.kind === 'PlayCardAction' && a.cardInstanceId === 'v');
    expect(plays).toEqual([{ kind: 'PlayCardAction', seatId: 'a', cardInstanceId: 'v', targets: [], pickTargets: { eligibleIds: ['b', 'c', 'd', 'e'], min: 1, max: 3 } }]);
  });

  it('plays at the targets given, when they are listed, distinct and within the count', () => {
    const s = play(table(), 'b', 'd', 'e');
    expect(s.seats.filter((x) => x.combinedHp === 3).map((x) => x.id)).toEqual(['b', 'd', 'e']);
  });

  it('rejects too many, a repeat, an unlisted seat, or none', () => {
    expect(() => play(table(), 'b', 'c', 'd', 'e')).toThrow();
    expect(() => play(table(), 'b', 'b')).toThrow();
    expect(() => play(table(), 'a')).toThrow();
    expect(() => play(table())).toThrow();
  });

  it('a conversion is offered as a template too, with its own pick', () => {
    const conv = getLegalActions(table(), 'a', registry).filter((a): a is Extract<Action, { kind: 'UseConversionAction' }> => a.kind === 'UseConversionAction');
    expect(conv).toEqual([expect.objectContaining({ targets: [], pickTargets: { eligibleIds: ['b', 'c', 'd', 'e'], min: 1, max: 2 } })]);
    const selecting = resolve(table(), { ...conv[0], pickTargets: undefined, targets: seats('c', 'e') }, ctx).state;
    const done = resolve(selecting, { kind: 'SelectAction', seatId: 'a', selectionId: selecting.pendingSelection!.id, ids: ['p'] }, ctx).state;
    expect(done.seats.filter((x) => x.combinedHp === 3).map((x) => x.id)).toEqual(['c', 'e']);
  });
});

describe('TurnFaceUpEffect', () => {
  it('turns a face-down seat face up, and does nothing to one already up', () => {
    const t = table();
    const down = { ...t, seats: t.seats.map((s) => (s.id === 'a' ? { ...s, faceDown: true as const } : s)) };
    const s = advanceToDecision({ ...down, resolutionQueue: [{ kind: 'TurnFaceUpEffect', seatId: 'a' }, { kind: 'TurnFaceUpEffect', seatId: 'b' }] }, ctx).state;
    expect(s.seats[0].faceDown).toBeUndefined();
    expect(s.log.filter((e) => e.kind === 'SeatTurnedEvent')).toEqual([{ kind: 'SeatTurnedEvent', seatId: 'a', faceDown: false }]);
  });
});
```

Create `projects/engine/src/lib/pipeline/sameSuit.spec.ts`:

```ts
import { resolve } from './resolve';
import { getLegalActions } from '../rules/legality';
import { CardDefinition, ContentRegistry, GameModeDefinition, SkillDefinition } from '../registry/types';
import { CardInstance, GameState } from '../domain/types';

const mode: GameModeDefinition = { id: 'stub', setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'], checkWinCondition: () => null, triggers: [] };
const rain: CardDefinition = { id: 'rain', name: 'Rain', category: 'tool', legalPlayTargets: () => [[]], play: () => [] };
const pairs: SkillDefinition = { id: 'pairs', conversions: [{ id: 'pairs', as: 'rain', cards: 2, sameSuit: true, when: 'play' }] };
const registry: ContentRegistry = { cards: new Map([['rain', rain]]), generals: new Map([['g', { id: 'g', kingdom: 'Qun', maxHp: 4, skills: [pairs] }]]) };
const ctx = { registry, mode };
const card = (instanceId: string, suit: CardInstance['suit']): CardInstance => ({ instanceId, definitionId: 'x', suit, rank: 2 });

const table = (hand: CardInstance[]): GameState => ({
  seats: [{ id: 'a', index: 0, kingdom: 'Qun', eliminated: false, combinedHp: 4, maxCombinedHp: 4, generals: { main: { generalDefinitionId: 'g', revealed: true }, deputy: { generalDefinitionId: 'g', revealed: true } }, hand: { zoneId: 'a:hand' }, equipped: { zoneId: 'a:equip' }, judgment: { zoneId: 'a:judgment' } }],
  players: [], turn: { turnNumber: 1, ownerSeatId: 'a', extraTurnStack: [] }, phase: 'Play',
  zones: [{ id: 'discardPile', kind: 'discardPile', cards: [] }, { id: 'a:hand', kind: 'hand', ownerSeatId: 'a', cards: hand }, { id: 'a:equip', kind: 'equip', ownerSeatId: 'a', cards: [] }],
  pendingResponse: null, log: [], rng: { seed: 1, counter: 0 }, result: null, generalSelection: null,
});

describe('a same-suit pair conversion', () => {
  it('is offered only with 2 cards of one suit; its selection rejects mixed suits', () => {
    expect(getLegalActions(table([card('h1', 'heart'), card('s1', 'spade')]), 'a', registry).some((a) => a.kind === 'UseConversionAction')).toBe(false);
    const s = table([card('h1', 'heart'), card('s1', 'spade'), card('h2', 'heart')]);
    const action = getLegalActions(s, 'a', registry).find((a) => a.kind === 'UseConversionAction')!;
    const selecting = resolve(s, action, ctx).state;
    expect(selecting.pendingSelection?.sameSuit).toBe(true);
    expect(() => resolve(selecting, { kind: 'SelectAction', seatId: 'a', selectionId: selecting.pendingSelection!.id, ids: ['h1', 's1'] }, ctx)).toThrow('same suit');
    expect(() => resolve(selecting, { kind: 'SelectAction', seatId: 'a', selectionId: selecting.pendingSelection!.id, ids: ['h1', 'h2'] }, ctx)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx jest projects/engine/src/lib/pipeline/targetPick.spec.ts projects/engine/src/lib/pipeline/sameSuit.spec.ts`
Expected: FAIL. Volley is offered once per target with no template. The pair conversion is offered with mixed suits. `TurnFaceUpEffect` is unknown.

- [ ] **Step 3: Types**

`projects/engine/src/lib/registry/types.ts`:

```ts
// A card's targets picked in one go: between `min` and `max` of `eligibleIds`
// (several equal targets: a Sha at several seats).
export interface TargetPick {
  eligibleIds: string[];
  min: number;
  max: number;
}
```

- `PlayOptionsContext` gains `// Set when asked for a conversion: how many cards it takes, and whether only from the hand.` `via?: { cards: number; fromHandOnly: boolean };`.
- `CardDefinition` gains:
  - `// When it may take more than one target now: the pick (legal actions then offer one template). Null or max 1: legalPlayTargets as usual.` `targetPick?(state: GameState, ctx: PlayOptionsContext, registry: ContentRegistry): TargetPick | null;`
  - `// Never dealt (Blaze: made only by a skill).` `outOfDeck?: true;`
- `Conversion` gains `// Its cards must share a suit (Random Strike).` `sameSuit?: true;`.

`projects/engine/src/lib/pipeline/actions.ts`: `PlayCardAction` and `UseConversionAction` each gain `pickTargets?: TargetPick` ("on an offered template: pick the targets, then submit with them"). Import the type from `../registry/types`.

`projects/engine/src/lib/domain/types.ts`: `PendingSelection` gains `// Picks must share a suit.` `sameSuit?: true;`.

`projects/engine/src/lib/pipeline/effects.ts`: add `| { kind: 'TurnFaceUpEffect'; seatId: string }` and

```ts
    case 'TurnFaceUpEffect': {
      const seat = state.seats.find((s) => s.id === effect.seatId);
      if (!seat) throw new Error(`Unknown seat: ${effect.seatId}`);
      if (!seat.faceDown) return { state, events: [] };
      const { faceDown: _up, ...faceUp } = seat;
      const seats = state.seats.map((s) => (s.id === seat.id ? faceUp : s));
      const event: EngineEvent = { kind: 'SeatTurnedEvent', seatId: seat.id, faceDown: false };
      return { state: { ...state, seats, log: [...state.log, event] }, events: [event] };
    }
```

- [ ] **Step 4: Legality**

`projects/engine/src/lib/rules/legality.ts`:

```ts
// The card's pick of several targets, when it may take more than one now.
export function targetPickFor(state: GameState, seatId: string, cardInstanceId: string, definitionId: string, registry?: ContentRegistry, via?: PlayOptionsContext['via']): TargetPick | null {
  const pick = registry?.cards.get(definitionId)?.targetPick?.(state, { seatId, cardInstanceId, ...(via ? { via } : {}) }, registry);
  return pick && pick.max > 1 ? pick : null;
}

// Whether `targets` fit `pick`: distinct, listed, and between min and max.
export function fitsPick(pick: TargetPick, targets: Target[]): boolean {
  const ids = targets.map((t) => t.seatId);
  return new Set(ids).size === ids.length && ids.length >= pick.min && ids.length <= pick.max && ids.every((id) => pick.eligibleIds.includes(id));
}
```

- In `getLegalActions`' Play loop, per hand card: `const pick = targetPickFor(state, seatId, card.instanceId, card.definitionId, registry);`. If set, push the single template `{ kind: 'PlayCardAction', seatId, cardInstanceId: card.instanceId, targets: [], pickTargets: pick }`. Otherwise push the current per-list actions.
- In `conversionActions`' Play branch, per usable conversion:
  - Compute `const via = { cards: o.conversion.cards, fromHandOnly: o.conversion.from !== 'hand-and-equipment' };` and `const pick = targetPickFor(state, seatId, '', o.conversion.as, registry, via);`.
  - If set, offer one template `{ kind: 'UseConversionAction', seatId, via: via(o), targets: [], pickTargets: pick }`, provided `playConversionCards(...)` with the pick's first eligible seat as targets leaves enough cards.
  - Otherwise offer as today.
- `usableNow` for a `sameSuit` conversion: some suit has at least `cards` accepted cards.
- `playConversionCards` and `conversionCards` are unchanged.

- [ ] **Step 5: Resolve**

`projects/engine/src/lib/pipeline/resolve.ts`:
- `PlayCardAction`:

```ts
      const pick = targetPickFor(state, action.seatId, action.cardInstanceId, cardInHand.definitionId, ctx.registry);
      const allowed = pick ? fitsPick(pick, action.targets) : legalTargetListsFor(state, action.seatId, action.cardInstanceId, cardInHand.definitionId, ctx.registry).some((targets) => JSON.stringify(targets) === JSON.stringify(action.targets));
      if (!allowed) throw new Error(`Card ${cardInHand.definitionId} cannot be played with those targets`);
```

  (replacing the current `allowed` check).
- `UseConversionAction`'s `offered` check: a play (no `pendingResponseId`) whose offered action carries `pickTargets` is accepted when `fitsPick(offered.pickTargets, action.targets)`; the others compare targets as today.
- `validateSelection` (`rules/selection.ts`): after the count check,

```ts
  if (selection.sameSuit) {
    const suits = new Set(action.ids.map((id) => state.zones.flatMap((z) => z.cards).find((c) => c.instanceId === id)?.suit));
    if (suits.size > 1) return 'The cards must share the same suit';
  }
```

- `UseConversionAction` builds its selection with `...(owned.conversion.sameSuit ? { sameSuit: true as const } : {})`, and its eligible ids are the accepted cards of suits that have at least `cards` of them.

- [ ] **Step 6: Run the tests, the suite, and commit**

Run: `npx jest projects/engine`, then `npx jest`.
Expected: PASS. No content card has a `targetPick` yet, so nothing else changes.

```bash
git add projects/engine
git commit -m "feat(engine): several targets in one pick, same-suit pairs, cards out of the deck, turning face up

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Content — Sha's targets in one window, Sky Scorcher without an ask, the turn-long Sha rules, Blaze, competing, Eight Trigrams' shared ability

**Files:**
- Create: `projects/content/src/lib/shared/shaRules.ts`, `projects/content/src/lib/shared/compete.ts`, `projects/content/src/lib/cards/blaze.ts`, `projects/content/src/lib/shared/groundwork9.spec.ts`
- Modify:
  - `projects/engine/src/lib/registry/types.ts` (`AbilityModifiers.extraShaTargetsWhenLastCard`);
  - `projects/content/src/lib/cards/sha.ts`, `projects/content/src/lib/cards/equipment/sky-scorcher.ts`, `projects/content/src/lib/cards/equipment/eight-trigrams.ts`;
  - `projects/content/src/lib/shared/queries.ts`;
  - `projects/content/src/lib/modes/kingdomWar.ts`, `projects/content/src/lib/registry.ts`;
  - `projects/content/src/lib/cards/equipment/sha-equipment.spec.ts` (Sky Scorcher's cases).

**Interfaces:**
- Produces:
  - `SHA_FLAGS = { extraPlay: 'sha-extra-play', anyDistance: 'sha-any-distance', extraTarget: 'sha-extra-target', none: 'sha-none' }` (`shaRules.ts`).
    - `shaLimit` adds 1 with `extraPlay`.
    - Sha's targets ignore range with `anyDistance`.
    - `none` makes Sha unplayable.
    - All of them apply only to the turn owner.
  - `shaTargetIds(state, seatId, registry): string[]`: the seats the seat's Sha may target now.
  - `shaCard.targetPick`: `max = 1 + (last card and the seat wears an extraShaTargetsWhenLastCard modifier ? that : 0) + (extraTarget ? 1 : 0)`.
    - "Last card": for a real card, the hand is exactly that card. For a conversion, `via.fromHandOnly` and the hand size equals `via.cards`.
    - `eligibleIds = shaTargetIds`.
  - Sha's `play` with several targets starts `sha-use` with `picked` = the rest of the targets.
  - `AbilityModifiers.extraShaTargetsWhenLastCard?: number`. Sky Scorcher sets it to 2 and loses its ask.
  - `competeStart(state, owner, targetSeatId, resultStep, data?)` and `competeStep(state, step): Effect[] | null` (`compete.ts`).
    - The result step's data gains `won: boolean`, `target: string`, `userCard`, `targetCard`.
    - The helper logs `used(owner, 'compete-won' | 'compete-lost', target)` after showing both cards.
  - `eightTrigramsTrigger(abilityId, reader: (state, owner) => JudgmentReader | null, applies?: (state, owner, registry) => boolean)` and `eightTrigramsJudged(owner: AbilityOwner, abilityId)` (`eight-trigrams.ts`), used by the armour and by Eight Arrays.
  - `blazeCard` (`outOfDeck: true`), with card steps `blaze-shown` and `blaze-hit`; registered in `buildContentRegistry`; Kingdom War's deck skips `outOfDeck` cards.

- [ ] **Step 1: Write the failing tests**

Create `projects/content/src/lib/shared/groundwork9.spec.ts`:

```ts
import type { GameState } from 'engine';
import { buildContentRegistry, kingdomWarMode } from '../../public-api';
import { card, harness, hp, ids, registry, table } from '../generals/skills.testing';
import { SHA_FLAGS } from './shaRules';

const h = harness();
const shaPick = (s: GameState, cardId = 's1') =>
  h.legal(s, 'seat-a').find((a) => a.kind === 'PlayCardAction' && a.cardInstanceId === cardId);

describe("Sha's targets in one window", () => {
  it('one target allowed: one action per seat, as before', () => {
    const plays = h.legal(table({ 'seat-a:hand': [card('s1', 'sha'), card('x', 'shan')] }), 'seat-a').filter((a) => a.kind === 'PlayCardAction' && a.cardInstanceId === 's1');
    expect(plays.map((a) => a.kind === 'PlayCardAction' && a.targets[0]?.seatId)).toEqual(['seat-b', 'seat-d']);
  });

  it('Sky Scorcher with the last hand card: up to 3 targets in range, no ask', () => {
    const s = table({ 'seat-a:hand': [card('s1', 'sha')], 'seat-a:equip': [card('sk', 'sky-scorcher', 'diamond', 12)] }, { seats: 6 });
    expect(shaPick(s)).toMatchObject({ targets: [], pickTargets: { min: 1, max: 3 } });
    const played = h.act(s, { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 's1', targets: ['seat-b', 'seat-f'].map((seatId) => ({ kind: 'seat' as const, seatId })) });
    expect(played.pendingChoice).toBeUndefined();
    expect(played.pendingResponse?.respondingSeatId).toBe('seat-b');
    expect(played.turn.cardPlays).toEqual({ sha: 1 });
  });

  it('the turn-long flags: one more Sha, any distance, one extra target, or none', () => {
    const won = table({ 'seat-a:hand': [card('s1', 'sha'), card('x', 'shan')] }, { flags: { [SHA_FLAGS.extraPlay]: true, [SHA_FLAGS.anyDistance]: true, [SHA_FLAGS.extraTarget]: true } });
    expect(shaPick(won)).toMatchObject({ pickTargets: { eligibleIds: ['seat-b', 'seat-c', 'seat-d'], max: 2 } });
    const lost = table({ 'seat-a:hand': [card('s1', 'sha')] }, { flags: { [SHA_FLAGS.none]: true } });
    expect(shaPick(lost)).toBeUndefined();
  });

  it('Sky Scorcher and an extra target stack to 4', () => {
    const s = table({ 'seat-a:hand': [card('s1', 'sha')], 'seat-a:equip': [card('sk', 'sky-scorcher', 'diamond', 12)] }, { seats: 6, flags: { [SHA_FLAGS.anyDistance]: true, [SHA_FLAGS.extraTarget]: true } });
    expect(shaPick(s)).toMatchObject({ pickTargets: { max: 4 } });
  });

  it('each target answers on its own, and the Sha is counted once', () => {
    const s = table({ 'seat-a:hand': [card('s1', 'sha')], 'seat-a:equip': [card('sk', 'sky-scorcher', 'diamond', 12)], 'seat-b:hand': [card('n1', 'shan')] }, { seats: 6 });
    let t = h.act(s, { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 's1', targets: [{ kind: 'seat', seatId: 'seat-b' }, { kind: 'seat', seatId: 'seat-f' }] });
    t = h.respond(t, 'n1');
    expect(t.pendingResponse?.respondingSeatId).toBe('seat-f');
    t = h.pass(t);
    expect([hp(t, 'seat-b'), hp(t, 'seat-f')]).toEqual([4, 3]);
  });

  it('a conversion Sha (Serpent Spear, the last 2 hand cards) after a won compete: targets first, then cards', () => {
    const s = table({ 'seat-a:hand': [card('x1', 'shan'), card('x2', 'peach', 'heart')], 'seat-a:equip': [card('sp', 'serpent-spear', 'spade', 12)] }, { flags: { [SHA_FLAGS.anyDistance]: true, [SHA_FLAGS.extraTarget]: true } });
    const action = h.legal(s, 'seat-a').find((a) => a.kind === 'UseConversionAction')!;
    expect(action).toMatchObject({ targets: [], pickTargets: { max: 2 } });
    const selecting = h.act(s, { ...action, pickTargets: undefined, targets: [{ kind: 'seat', seatId: 'seat-b' }, { kind: 'seat', seatId: 'seat-c' }] });
    const played = h.select(selecting, 'x1', 'x2');
    expect(played.pendingResponse?.respondingSeatId).toBe('seat-b');
  });
});

describe('Blaze', () => {
  it('is in the registry but never in the deck', () => {
    const reg = buildContentRegistry();
    expect(reg.cards.get('blaze')?.outOfDeck).toBe(true);
    const { state } = kingdomWarMode.setup(['s0', 's1'], reg, { seed: 1, counter: 0 });
    expect(state.zones.flatMap((z) => z.cards).some((c) => c.definitionId === 'blaze')).toBe(false);
  });

  it('the target shows a hand card; a matching discard deals 1 plain damage; Cancel deals none', () => {
    const blaze = { as: 'blaze', colour: 'red' as const, suit: 'heart' as const, rank: 4, physical: [] };
    let s = h.run(table({ 'seat-a:hand': [card('m', 'shan', 'spade', 2), card('o', 'shan', 'club', 3)], 'seat-b:hand': [card('t', 'sha', 'spade', 9)] }), [
      { kind: 'ToolRuleEffect', tool: blaze, userSeatId: 'seat-a', target: { kind: 'seat', seatId: 'seat-b' } },
    ]);
    expect(s.pendingSelection).toMatchObject({ seatId: 'seat-b', eligibleIds: ['t'] });
    s = h.select(s, 't');
    expect(s.log.find((e) => e.kind === 'CardShownEvent')).toMatchObject({ card: { instanceId: 't' } });
    expect(s.pendingSelection).toMatchObject({ seatId: 'seat-a', eligibleIds: ['m'] });
    expect(hp(h.select(s, 'm'), 'seat-b')).toBe(3);
    expect(hp(h.cancel(s), 'seat-b')).toBe(4);
  });
});

describe('Eight Trigrams', () => {
  it('still works as before for the armour', () => {
    let s = h.play(table({ 'seat-a:hand': [card('s1', 'sha')], 'seat-b:equip': [card('et', 'eight-trigrams', 'spade', 2)], drawPile: [card('j', 'peach', 'heart')] }), 's1', 'seat-b');
    s = h.use(s);
    expect(hp(s, 'seat-b')).toBe(4);
    expect(ids(s, 'discardPile')).toContain('j');
  });
});
```

Also, in `sha-equipment.spec.ts`, rewrite the Sky Scorcher cases for the window:
- with the last hand card, the play template allows up to 3 targets within range;
- no ask is ever opened;
- a non-last Sha still has one target per action.

- [ ] **Step 2: Run them to see them fail**

Run: `npx jest projects/content/src/lib/shared/groundwork9.spec.ts`
Expected: FAIL.

- [ ] **Step 3: The Sha rules**

Create `projects/content/src/lib/shared/shaRules.ts`:

```ts
import type { ContentRegistry, GameState } from 'engine';
import { otherLivingSeatIds } from './skills';
import { attackRange, seatDistance } from './queries';
import { untargetableBy } from './abilities';

// Turn flags that change the turn owner's Sha for the rest of the turn (set by
// skills: Heaven's Justice). Named for what they do, so any skill may set them.
export const SHA_FLAGS = {
  extraPlay: 'sha-extra-play',
  anyDistance: 'sha-any-distance',
  extraTarget: 'sha-extra-target',
  none: 'sha-none',
} as const;

// Whether `flag` holds for `seatId`'s Sha now (only in its own turn).
export function shaFlag(state: GameState, seatId: string, flag: string): boolean {
  return state.turn.ownerSeatId === seatId && !!state.turn.flags?.[flag];
}

// The seats `seatId`'s Sha may target now: other living seats a Sha may target,
// within attack range unless its Sha ignore distance this turn.
export function shaTargetIds(state: GameState, seatId: string, registry: ContentRegistry): string[] {
  const range = attackRange(state, seatId, registry);
  const anyDistance = shaFlag(state, seatId, SHA_FLAGS.anyDistance);
  return otherLivingSeatIds(state, seatId)
    .sort((a, b) => state.seats.find((s) => s.id === a)!.index - state.seats.find((s) => s.id === b)!.index)
    .filter((id) => !untargetableBy(state, id, 'sha', registry) && (anyDistance || seatDistance(state, seatId, id, registry) <= range));
}
```

(`queries.ts`' `shaLimit` adds `+1` when `shaFlag(state, seatId, SHA_FLAGS.extraPlay)`. Import from `./shaRules` there. If that makes an import cycle, move `shaFlag`/`SHA_FLAGS` into `queries.ts` and re-export them from `shaRules.ts`.)

In `projects/content/src/lib/cards/sha.ts`:
- `legalPlayTargets`: return `[]` when `shaFlag(state, ctx.seatId, SHA_FLAGS.none)` or over the limit; otherwise `shaTargetIds(...).map((seatId) => [{ kind: 'seat', seatId }])`.
- Add:

```ts
  // Several targets at once (stage 9 spec, "Several equal targets"): Sky
  // Scorcher's +2 when it is the user's last hand card, +1 after a won
  // Heaven's Justice. Null when only one target is allowed.
  targetPick: (state, ctx, registry) => {
    if (shaFlag(state, ctx.seatId, SHA_FLAGS.none) || (state.turn.cardPlays?.['sha'] ?? 0) >= shaLimit(state, ctx.seatId, registry)) return null;
    const hand = handOf(state, ctx.seatId);
    const lastCard = ctx.via ? ctx.via.fromHandOnly && hand.length === ctx.via.cards : hand.length === 1 && hand[0].instanceId === ctx.cardInstanceId;
    const scorcher = lastCard ? Math.max(0, ...activeAbilities(state, ctx.seatId, registry).map((a) => a.modifiers?.extraShaTargetsWhenLastCard ?? 0)) : 0;
    const extra = shaFlag(state, ctx.seatId, SHA_FLAGS.extraTarget) ? 1 : 0;
    const eligibleIds = shaTargetIds(state, ctx.seatId, registry);
    const max = Math.min(1 + scorcher + extra, eligibleIds.length);
    return max > 1 ? { eligibleIds, min: 1, max } : null;
  },
```

- `play`: `cardStep('sha-use', ctx.card, ctx.seatId, ctx.targets[0], { extra: …, ...(ctx.targets.length > 1 ? { picked: ctx.targets.slice(1).map((t) => t.seatId) } : {}), ...(lastHandCard ? { lastHandCard: true } : {}) })`.

`projects/engine/src/lib/registry/types.ts`, `AbilityModifiers` gains `// More targets for the wearer's Sha when it is its last hand card (Sky Scorcher: 2).` `extraShaTargetsWhenLastCard?: number;`.

`projects/content/src/lib/cards/equipment/sky-scorcher.ts` becomes:

```ts
import { cardsData } from '../../../../data/cards';
import { makeEquipmentCard } from './index';

// Sky Scorcher: when its wearer's Sha is their last hand card, it may take up
// to 2 more targets within attack range, picked with the first (Sha's
// targetPick). Each target then goes through the steps on its own.
export const skyScorcherCard = makeEquipmentCard('sky-scorcher', 'Sky Scorcher', 'weapon', cardsData['sky-scorcher'].range, {
  abilities: { modifiers: { extraShaTargetsWhenLastCard: 2 } },
});
```

- [ ] **Step 4: Competing**

Create `projects/content/src/lib/shared/compete.ts`:

```ts
import type { CardInstance, Effect, GameState, GeneralOwner } from 'engine';
import { handOf } from './queries';
import { discardMoves, isLiving, selectionOf, skillStep, type SkillStep, used } from './skills';

// Competing (stage 9 spec): the user picks a hand card face down, then the
// target does; both are shown and discarded; the user wins only with a
// strictly higher rank. Run as the owning skill's steps: its onStep hands
// 'compete-user' and 'compete-target' to competeStep, and gets `resultStep`
// with { ...data, target, won, userCard, targetCard }.
export function competeStart(state: GameState, owner: GeneralOwner, targetSeatId: string, resultStep: string, data: Record<string, unknown> = {}): Effect[] {
  const hand = handOf(state, owner.seatId).map((c) => c.instanceId);
  return [
    selectionOf(state, owner, {
      of: 'cards', eligibleIds: hand, min: 1, max: 1, targetSeatId,
      then: { kind: 'skill-step', step: skillStep(owner, 'compete-user', { ...data, target: targetSeatId, resultStep }) },
    }),
  ];
}

const findCard = (state: GameState, id: string): CardInstance | undefined => state.zones.flatMap((z) => z.cards).find((c) => c.instanceId === id);

// The competing steps; null for any other step (the skill handles it).
export function competeStep(state: GameState, step: SkillStep): Effect[] | null {
  const { owner } = step;
  const data = step.data ?? {};
  const target = data['target'] as string;
  if (step.step === 'compete-user') {
    const userCard = (data['picked'] as string[])[0];
    if (!isLiving(state, target) || handOf(state, target).length === 0) return discardMoves(state, []);
    return [
      selectionOf(state, owner, {
        seatId: target, targetSeatId: target, of: 'cards', eligibleIds: handOf(state, target).map((c) => c.instanceId), min: 1, max: 1,
        then: { kind: 'skill-step', step: skillStep(owner, 'compete-target', { ...data, userCard, picked: undefined }) },
      }),
    ];
  }
  if (step.step === 'compete-target') {
    const userCard = findCard(state, data['userCard'] as string);
    const targetCard = findCard(state, (data['picked'] as string[])[0]);
    if (!userCard || !targetCard) return [];
    const won = userCard.rank > targetCard.rank;
    return [
      { kind: 'ShowCardEffect', seatId: owner.seatId, cardInstanceId: userCard.instanceId, abilityId: owner.skillId },
      { kind: 'ShowCardEffect', seatId: target, cardInstanceId: targetCard.instanceId, abilityId: owner.skillId },
      ...discardMoves(state, [userCard.instanceId, targetCard.instanceId]),
      used(owner, won ? 'compete-won' : 'compete-lost', target),
      skillStep(owner, data['resultStep'] as string, { ...data, picked: undefined, won, userCard: userCard.instanceId, targetCard: targetCard.instanceId }),
    ];
  }
  return null;
}
```

(Drop the `undefined` keys from data before queuing if serialisation round-trips complain: build the object without them.)

- [ ] **Step 5: Eight Trigrams' shared ability**

Rework `projects/content/src/lib/cards/equipment/eight-trigrams.ts` so its trigger and judgment reading are exported factories:

```ts
// Eight Trigrams' ability, for the armour and for skills that grant it (Eight
// Arrays): whenever its owner needs a Shan ('sha-shan', 'hail-shan') and
// `applies`, it may judge (read by `reader`). Red counts as one Shan.
export function eightTrigramsTrigger(
  abilityId: string,
  reader: (state: GameState, owner: AbilityOwner) => JudgmentReader | null,
  applies: (state: GameState, owner: AbilityOwner, registry: ContentRegistry) => boolean = () => true
): SkillTrigger {
  return atStep(['sha-shan', 'hail-shan'], {
    condition: (state, step, owner, registry) => {
      const { needed = 1, provided = 0 } = (step.data ?? {}) as ShanData;
      return step.target.seatId === owner.seatId && provided < needed && !(step.step === 'sha-shan' && shaIgnoresArmor(state, step, registry)) && applies(state, owner, registry);
    },
    effect: (state, step, owner) => {
      const judgeWith = reader(state, owner);
      if (!judgeWith) return [actedOn(step, owner)];
      const judge: Effect = { kind: 'JudgeEffect', seatId: owner.seatId, reader: judgeWith, data: { step: actedOn(step, owner) }, otherwise: [actedOn(step, owner)] };
      return [askAtStep(owner, abilityId, step, [judge])];
    },
  });
}

// Reading its judgment: the card to the discard pile first; then, on red, one
// more Shan provided at the step.
export function eightTrigramsJudged(state: GameState, owner: AbilityOwner, abilityId: string, seatId: string, judged: CardInstance, data: Record<string, unknown> | undefined, done: Effect, registry: ContentRegistry): Effect[] {
  const step = data?.['step'] as CardStep;
  if (colourFor(state, seatId, judged, registry) === 'black') return [done, step];
  const { provided = 0 } = (step.data ?? {}) as ShanData;
  return [done, { kind: 'AbilityUsedEffect', owner, abilityId, outcome: 'counts-as-shan' }, { ...step, data: { ...step.data, provided: provided + 1 } }];
}
```

and the card uses them:
- `triggers: [eightTrigramsTrigger('eight-trigrams', (state, owner) => { const worn = ownerCard(state, owner); return worn ? { kind: 'card', card: usedCardOf(worn) } : null; })]`;
- `onJudged: (state, { judged, data, seatId, tool, done }, registry) => eightTrigramsJudged(state, { kind: 'equipment', seatId, cardInstanceId: tool.physical[0].instanceId }, 'eight-trigrams', seatId, judged, data, done, registry)`.

- [ ] **Step 6: Blaze**

Create `projects/content/src/lib/cards/blaze.ts`:

```ts
import type { CardDefinition, Effect } from 'engine';
import { usedCardKey } from 'engine';
import { toolOnTargets } from '../shared/tools';
import { handOf } from '../shared/queries';
import { suitOf } from '../shared/suits';
import { cardStep } from '../shared/steps';
import { discardMoves, isLiving } from '../shared/skills';

// Blaze (a Tool made only by Fire Strategy; never dealt): any living seat
// holding a hand card, you included. Once its Wuxie check passes, the target
// shows a hand card of its choice; you may then discard a hand card of the same
// suit to deal it 1 plain damage (no elemental damage).
export const blazeCard: CardDefinition = {
  id: 'blaze',
  name: 'Blaze',
  category: 'tool',
  outOfDeck: true,
  legalPlayTargets: (state) =>
    state.seats.filter((s) => !s.eliminated && handOf(state, s.id).length > 0).sort((a, b) => a.index - b.index).map((s) => [{ kind: 'seat' as const, seatId: s.id }]),
  play: (_state, ctx) => (ctx.respondingTo || ctx.targets.length === 0 ? [] : toolOnTargets(ctx.card, ctx.seatId, [ctx.targets[0]])),
  onTarget: (state, { tool, userSeatId, target }) => {
    const hand = handOf(state, target.seatId);
    if (hand.length === 0) return [];
    return [{
      kind: 'OpenSelectionEffect',
      selection: {
        id: `blaze-show-${usedCardKey(tool)}-${target.seatId}-${state.log.length}`,
        seatId: target.seatId,
        reason: { kind: 'choice', card: tool, userSeatId, targetSeatId: target.seatId },
        of: 'cards', eligibleIds: hand.map((c) => c.instanceId), min: 1, max: 1,
        then: { kind: 'card-step', step: cardStep('blaze-shown', tool, userSeatId, target) },
      },
    }];
  },
  onStep: (state, step, registry) => {
    const target = step.target.seatId;
    if (step.step === 'blaze-shown') {
      const shownId = (step.data?.['picked'] as string[])[0];
      const shown = handOf(state, target).find((c) => c.instanceId === shownId);
      if (!shown) return [];
      const suit = suitOf(state, target, shown, registry);
      const matches = handOf(state, step.userSeatId).filter((c) => suitOf(state, step.userSeatId, c, registry) === suit);
      const show: Effect = { kind: 'ShowCardEffect', seatId: target, cardInstanceId: shown.instanceId, abilityId: 'blaze' };
      if (matches.length === 0) return [show];
      return [show, {
        kind: 'OpenSelectionEffect',
        selection: {
          id: `blaze-hit-${usedCardKey(step.card)}-${target}-${state.log.length}`,
          seatId: step.userSeatId,
          reason: { kind: 'choice', card: step.card, userSeatId: step.userSeatId, targetSeatId: target },
          of: 'cards', eligibleIds: matches.map((c) => c.instanceId), min: 1, max: 1,
          then: { kind: 'card-step', step: cardStep('blaze-hit', step.card, step.userSeatId, step.target) },
          onCancel: [],
        },
      }];
    }
    // 'blaze-hit': discard the matching card, then 1 plain damage.
    const picked = (step.data?.['picked'] as string[]) ?? [];
    const first = step.card.physical[0]?.instanceId;
    return [
      ...discardMoves(state, picked),
      ...(isLiving(state, target) ? [{
        kind: 'DamageEffect' as const,
        damage: { source: { kind: 'seat' as const, seatId: step.userSeatId }, target: step.target, amount: 1, nature: 'normal' as const, cause: { ...(first ? { cardInstanceId: first } : {}), card: step.card } },
      }] : []),
    ];
  },
};
```

- Register `blazeCard` in `buildContentRegistry`'s card list.
- `kingdomWar.ts` `buildDeckSpec`: skip cards whose definition has `outOfDeck`. It takes `registry`, so use `registry.cards.get(cardId)?.outOfDeck`.

- [ ] **Step 7: Run the tests, the suite, and commit**

Run: `npx jest projects/content`, then `npx jest`.
Expected: PASS once the Sky Scorcher specs and the bots' Sha handling read templates. If rule-based or random bots now hit a template they can't fill (a `PlayCardAction` with `targets: []` and `pickTargets`), pull Task 7's template filling forward and ledger it.

```bash
git add projects/engine projects/content projects/bots
git commit -m "feat(content): Sha's targets in one window, Sky Scorcher as a modifier, turn-long Sha rules, competing, Blaze, Eight Trigrams' shared ability

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Wei — Dian Wei (Assault), Xun Yu (Rouse the Tiger, Eternal Loyalty)

**Files:**
- Modify: `projects/content/src/lib/generals/fire.ts`
- Create: `projects/content/src/lib/generals/fire-wei.spec.ts`

**Interfaces:**
- Consumes: `competeStart` / `competeStep` (Task 3), `skills.ts` helpers.
- Produces: `assault`, `rouseTheTiger`, `eternalLoyalty`. `FIRE_GENERALS` gains `dian-wei` and `xun-yu`.
- Outcomes logged:
  - `used(owner, 'paid-weapon' | 'paid-hp')` and `used(owner, 'struck', target)` for Assault;
  - `compete-won` / `compete-lost` from the helper;
  - `used(owner, 'drew-up', seatId)` for Eternal Loyalty.

- [ ] **Step 1: Write the failing tests**

Create `fire-wei.spec.ts` on `skills.testing`'s `table`, with the General under test at `seat-a` and fillers elsewhere. One `it` per rule bullet:

```ts
import { card, harness, hp, ids, table, abilityLog } from './skills.testing';

const h = harness();
const dianWei = { 'seat-a': ['dian-wei', 'filler-xu-huang'] };
const xunYu = { 'seat-a': ['xun-yu', 'filler-xu-huang'] };

describe('Assault', () => {
  it('discards a worn weapon, then deals 1 damage within the range left after it', () => {
    // seat-d is 2 away; the worn Qinggang (range 2) would reach it, but is the payment.
    let s = table({ 'seat-a:equip': [card('w', 'qinggang-sword', 'spade', 6)] }, { generals: dianWei });
    s = h.useSkill(s, 'seat-a', 'assault');
    s = h.choose(s, 'discard-weapon');
    s = h.select(s, 'w');
    expect(h.choiceSeatIds(s)).toEqual(['seat-b']); // seat-d is out of range once the sword is gone
    s = h.choose(s, 'seat-b');
    expect(hp(s, 'seat-b')).toBe(3);
    expect(ids(s, 'discardPile')).toContain('w');
  });

  it('or loses 1 HP; dying comes first and a dead Dian Wei deals nothing', () => {
    let s = table({}, { generals: dianWei, hp: { 'seat-a': 1 } });
    s = h.useSkill(s, 'seat-a', 'assault');
    s = h.choose(s, 'lose-hp');
    expect(s.pendingResponse?.kind).toBe('dying');
  });

  it('once per turn', () => {
    let s = table({}, { generals: dianWei });
    s = h.choose(h.useSkill(s, 'seat-a', 'assault'), 'lose-hp');
    s = h.choose(s, 'seat-b');
    expect(h.skillOffered(s, 'seat-a', 'assault')).toBe(false);
  });
});

describe('Rouse the Tiger', () => {
  it('only at a seat with more HP and a hand card', () => {
    const s = table({ 'seat-a:hand': [card('k', 'sha', 'spade', 13)], 'seat-b:hand': [card('b', 'shan', 'heart', 2)] }, { generals: xunYu, hp: { 'seat-a': 3 } });
    expect(h.selectionFor(h.useSkill(s, 'seat-a', 'rouse-the-tiger')).eligibleIds).toEqual(['seat-b']);
  });

  it('a win: the target damages a seat in its range that Xun Yu picks', () => {
    let s = table({ 'seat-a:hand': [card('k', 'sha', 'spade', 13)], 'seat-b:hand': [card('b', 'shan', 'heart', 2)] }, { generals: xunYu, hp: { 'seat-a': 3 } });
    s = h.select(h.useSkill(s, 'seat-a', 'rouse-the-tiger'), 'seat-b');
    s = h.select(s, 'k');
    s = h.select(s, 'b');
    expect(abilityLog(s)).toContainEqual(expect.objectContaining({ abilityId: 'rouse-the-tiger', outcome: 'compete-won', targetSeatId: 'seat-b' }));
    expect(h.choiceSeatIds(s)).not.toContain('seat-b');
    s = h.choose(s, 'seat-c');
    expect(hp(s, 'seat-c')).toBe(3);
    expect(s.log.find((e) => e.kind === 'DamageDealtEvent')).toMatchObject({ damage: { source: { seatId: 'seat-b' } } });
  });

  it('a tie loses: the target damages Xun Yu', () => {
    let s = table({ 'seat-a:hand': [card('k', 'sha', 'spade', 7)], 'seat-b:hand': [card('b', 'shan', 'heart', 7)] }, { generals: xunYu, hp: { 'seat-a': 3 } });
    s = h.select(h.select(h.select(h.useSkill(s, 'seat-a', 'rouse-the-tiger'), 'seat-b'), 'k'), 'b');
    expect(hp(s, 'seat-a')).toBe(2);
  });
});

describe('Eternal Loyalty', () => {
  it('per point of damage, a living seat (self included) draws up to its max HP', () => {
    let s = table({ 'seat-a:hand': [card('x', 'shan')], drawPile: Array.from({ length: 12 }, (_, i) => card(`d${i}`, 'shan')) }, { generals: xunYu });
    s = h.run(s, [{ kind: 'DamageEffect', damage: { source: null, target: { kind: 'seat', seatId: 'seat-a' }, amount: 2, nature: 'normal', cause: {} } }]);
    s = h.use(s);
    s = h.choose(s, 'seat-a');
    expect(ids(s, 'seat-a:hand')).toHaveLength(4); // max HP 4 (the fixture's)
    s = h.use(s); // asked again for the second point
    s = h.choose(s, 'seat-c');
    expect(ids(s, 'seat-c:hand')).toHaveLength(4);
  });
});
```

Adapt the helper names to what `skills.testing.ts` exports (`useSkill`, `choose`, `select`, `use`, `choiceSeatIds`, `selectionFor`, `skillOffered`, `abilityLog`). Add any missing one there, as small wrappers over `resolve`. The fixture's `generals` and `hp` overrides already exist from stage 8; extend `table`'s options if not.

- [ ] **Step 2: Run them to see them fail**

Run: `npx jest projects/content/src/lib/generals/fire-wei.spec.ts`
Expected: FAIL — the skills don't exist.

- [ ] **Step 3: The skills**

In `fire.ts`:

```ts
const weaponsOf = (state: GameState, seatId: string, registry: ContentRegistry) =>
  ownCards(state, seatId, true).filter((c) => registry.cards.get(c.definitionId)?.equipSlot === 'weapon');
const inRangeOf = (state: GameState, seatId: string, registry: ContentRegistry) =>
  otherLivingSeatIds(state, seatId).filter((id) => seatDistance(state, seatId, id, registry) <= attackRange(state, seatId, registry));
const damageFrom = (sourceSeatId: string, targetSeatId: string, skillId: string): Effect => ({
  kind: 'DamageEffect',
  damage: { source: { kind: 'seat', seatId: sourceSeatId }, target: { kind: 'seat', seatId: targetSeatId }, amount: 1, nature: 'normal', cause: { skillId } },
});

// Assault (active, once per turn): discard a Weapon (hand or worn) or lose 1
// HP; then deal 1 damage to a seat within your attack range, measured after
// the discard. Losing HP to dying: the dying round comes first.
export const assault: SkillDefinition = {
  id: 'assault',
  active: {
    usesPerTurn: 1,
    canUse: (state, { seatId }) => isLiving(state, seatId) && otherLivingSeatIds(state, seatId).length > 0,
    start: (state, { seatId, owner }, registry) => {
      const weapons = weaponsOf(state, seatId, registry).map((c) => c.instanceId);
      const payWeapon = selectionOf(state, owner, { of: 'cards', eligibleIds: weapons, min: 1, max: 1, then: { kind: 'skill-step', step: skillStep(owner, 'paid-weapon') } });
      return [
        choiceOf(state, owner, {
          verb: 'pick',
          options: [
            ...(weapons.length > 0 ? [{ id: 'discard-weapon', shows: { kind: 'label' as const, text: 'Discard a Weapon' }, effects: [payWeapon] }] : []),
            { id: 'lose-hp', shows: { kind: 'label' as const, text: 'Lose 1 HP' }, effects: [{ kind: 'LoseHpEffect', seatId, amount: 1, abilityId: owner.skillId }, used(owner, 'paid-hp'), skillStep(owner, 'strike')] },
          ],
        }),
      ];
    },
  },
  onStep: (state, step, registry) => {
    const { owner } = step;
    if (step.step === 'paid-weapon') return [...discardMoves(state, (step.data?.['picked'] as string[]) ?? []), used(owner, 'paid-weapon'), skillStep(owner, 'strike')];
    const seats = inRangeOf(state, owner.seatId, registry);
    if (!isLiving(state, owner.seatId) || seats.length === 0) return [];
    return [choiceOf(state, owner, { verb: 'pick', options: seatOptions(seats, (id) => [used(owner, 'struck', id), skillDamage(owner, id)]) })];
  },
};

// Rouse the Tiger (active, once per turn): compete with a seat with more HP
// than you. Win: pick a seat within its attack range (not itself); it deals 1
// damage to that seat. Lose: it deals 1 damage to you.
export const rouseTheTiger: SkillDefinition = {
  id: 'rouse-the-tiger',
  active: {
    usesPerTurn: 1,
    canUse: (state, { seatId }) => handOf(state, seatId).length > 0 && stronger(state, seatId).length > 0,
    start: (state, { seatId, owner }) => [
      selectionOf(state, owner, { of: 'seats', eligibleIds: stronger(state, seatId), min: 1, max: 1, then: { kind: 'skill-step', step: skillStep(owner, 'chosen') }, onCancel: [] }),
    ],
  },
  onStep: (state, step, registry) => {
    const competing = competeStep(state, step);
    if (competing) return competing;
    const { owner } = step;
    const data = step.data ?? {};
    if (step.step === 'chosen') return competeStart(state, owner, (data['picked'] as string[])[0], 'judged');
    const target = data['target'] as string;
    if (!isLiving(state, target)) return [];
    if (!data['won']) return isLiving(state, owner.seatId) ? [damageFrom(target, owner.seatId, owner.skillId)] : [];
    const victims = inRangeOf(state, target, registry);
    return victims.length > 0 ? [choiceOf(state, owner, { verb: 'pick', targetSeatId: target, options: seatOptions(victims, (id) => [damageFrom(target, id, owner.skillId)]) })] : [];
  },
};
// Seats with more HP than `seatId` and a hand card to compete with.
const stronger = (state: GameState, seatId: string) =>
  otherLivingSeatIds(state, seatId).filter((id) => hpOf(state, id) > hpOf(state, seatId) && handOf(state, id).length > 0);

// Eternal Loyalty (may, per point of damage you take): pick any living seat,
// you included; it draws until its hand holds as many cards as its max HP.
export const eternalLoyalty: SkillDefinition = {
  id: 'eternal-loyalty',
  triggers: [
    on<DamageDealtEvent>('after:DamageDealtEvent', {
      condition: (state, event, owner) => event.damage.target.kind === 'seat' && event.damage.target.seatId === owner.seatId && event.damage.amount > 0 && isLiving(state, owner.seatId),
      effect: (_state, event, owner) => [loyaltyAsk(owner, event.damage.amount)],
    }),
  ],
  onStep: (state, step) => {
    const { owner } = step;
    const left = step.data?.['left'] as number;
    const living = state.seats.filter((s) => !s.eliminated).sort((a, b) => a.index - b.index);
    const drawUp = (id: string): Effect[] => {
      const seat = state.seats.find((s) => s.id === id)!;
      const short = Math.max(0, seat.maxCombinedHp - handOf(state, id).length);
      return [used(owner, 'drew-up', id), ...(short > 0 ? [draw(id, short)] : []), ...(left > 1 ? [loyaltyAsk(owner, left - 1)] : [])];
    };
    return [choiceOf(state, owner, { verb: 'pick', options: seatOptions(living.map((s) => s.id), drawUp) })];
  },
};
const loyaltyAsk = (owner: GeneralOwner, left: number): Effect => ask(owner, [skillStep(owner, 'pick', { left })]);
```

(`hpOf` is the same as `wind.ts`' one: move it to `shared/skills.ts` as an export and import it in both files.)

- Add `{ id: 'dian-wei', skills: [assault] }` and `{ id: 'xun-yu', skills: [rouseTheTiger, eternalLoyalty] }` to `FIRE_GENERALS`.
- Remove `dian-wei` and `xun-yu` from `FILLER_IDS` only if no spec uses their fillers. The fillers stay valid either way: a filler copies kingdom, gender and HP only.

- [ ] **Step 4: Run them, the suite, tsc, and commit**

Run: `npx jest projects/content` and `npx tsc --noEmit -p projects/content/tsconfig.lib.json`.
Expected: PASS, no type errors.

```bash
git add projects/content
git commit -m "feat(content): Dian Wei's Assault; Xun Yu's Rouse the Tiger and Eternal Loyalty

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Shu — Pang Tong (Shackle, Nirvana), Fire Zhuge Liang (Eight Arrays, Fire Strategy, See Through)

**Files:**
- Modify: `projects/content/src/lib/generals/fire.ts`
- Create: `projects/content/src/lib/generals/fire-shu.spec.ts`

**Interfaces:**
- Consumes: `eightTrigramsTrigger` / `eightTrigramsJudged`, `blazeCard` (Task 3); `TurnFaceUpEffect` (Task 2).
- Produces: `shackle`, `nirvana`, `eightArrays`, `fireStrategy`, `seeThrough`.
- Outcomes logged:
  - `used(owner, 'recast')` (Shackle);
  - `used(owner, 'reborn')` (Nirvana);
  - `counts-as-shan` (Eight Arrays, through the shared ability).
- Nirvana's once-per-game mark: `nirvana-used`.

- [ ] **Step 1: Write the failing tests**

`fire-shu.spec.ts`, one `it` per bullet:
- **Shackle:**
  - offered with a club hand card;
  - discards the picked club and draws 1;
  - may be used again in the same turn;
  - not offered with no club.
- **Nirvana:**
  - Pang Tong at 1 HP, with hand, equipment and a delayed Tool, takes 2 damage and is asked.
  - Use: every card of his is in the discard pile, he holds 3 new cards, has 3 HP and is face up (start him face down). No dying round opens.
  - At max HP 2 (`maxHp` override), he recovers only to 2.
  - A second dying round in the same game isn't asked, and the dying round goes ahead (Review Focus 4).
  - Don't: the dying round goes ahead.
- **Eight Arrays:**
  - Fire Zhuge Liang, no armour, Sha'd with no Shan: asked; a red judgment counts as a Shan; logs `counts-as-shan` for `eight-arrays`.
  - With Silver Lion worn: not asked.
  - Against a Sha from a Black Pommel wearer: not asked (Review Focus 5).
  - Hidden (unrevealed General): not asked; compulsory skills of a hidden General don't apply.
- **Fire Strategy:**
  - In the Play Phase a red hand card is offered as Blaze, at any living seat with a hand card, himself included. A black card is not offered.
  - Played at `seat-b`: a Wuxie window opens if someone holds one. Otherwise the Blaze steps run as in Task 3's test.
- **See Through:**
  - A black hand card is offered as Wuxie in a Wuxie check, and cancels the Tool. A red one isn't.
  - Hidden: offered as "reveal to use" (answering conversions' existing behaviour).

Write each with `table`/`harness`, in the same style as Task 4.

- [ ] **Step 2: Run them to see them fail**

Run: `npx jest projects/content/src/lib/generals/fire-shu.spec.ts`
Expected: FAIL.

- [ ] **Step 3: The skills**

```ts
const clubsIn = (state: GameState, seatId: string, registry: ContentRegistry) => handOf(state, seatId).filter((c) => suitOf(state, seatId, c, registry) === 'club');

// Shackle (active, any number of times): discard a club hand card, then draw 1
// (Chains isn't in Kingdom War here: the club is recast).
export const shackle: SkillDefinition = {
  id: 'shackle',
  active: {
    canUse: (state, { seatId }, registry) => clubsIn(state, seatId, registry).length > 0,
    start: (state, { seatId, owner }, registry) => [
      selectionOf(state, owner, { of: 'cards', eligibleIds: clubsIn(state, seatId, registry).map((c) => c.instanceId), min: 1, max: 1, then: { kind: 'skill-step', step: skillStep(owner, 'recast') }, onCancel: [] }),
    ],
  },
  onStep: (state, step) => [...discardMoves(state, (step.data?.['picked'] as string[]) ?? []), used(step.owner, 'recast'), draw(step.owner.seatId, 1)],
};

const NIRVANA_MARK = 'nirvana-used';

// Nirvana (may, once per game): when you would enter the dying round, discard
// every card you have (hand, equipment, judgment area), draw 3, recover to 3 HP
// (at most your max HP) and turn face up. You don't enter the dying round.
export const nirvana: SkillDefinition = {
  id: 'nirvana',
  triggers: [
    on<Dying>('before:DyingEffect', {
      condition: (state, dying, owner) =>
        dying.entering === true && dying.seatId === owner.seatId && !(dying.acted ?? []).includes(abilityKey(owner)) &&
        !state.seats.find((s) => s.id === owner.seatId)?.marks?.[NIRVANA_MARK],
      effect: (_state, dying, owner) => {
        const passed: Dying = { ...dying, acted: [...(dying.acted ?? []), abilityKey(owner)] };
        return [ask(owner, [{ kind: 'IncrementEffect', scope: 'seat', seatId: owner.seatId, key: NIRVANA_MARK, by: 1 }, skillStep(owner, 'reborn')], [passed])];
      },
    }),
  ],
  onStep: (state, step) => {
    const { owner } = step;
    const seat = state.seats.find((s) => s.id === owner.seatId)!;
    const all = state.zones.filter((z) => z.ownerSeatId === owner.seatId && ['hand', 'equip', 'judgment'].includes(z.kind)).flatMap((z) => z.cards.map((c) => c.instanceId));
    const target = Math.min(3, seat.maxCombinedHp);
    return [
      used(owner, 'reborn'),
      ...discardMoves(state, all),
      draw(owner.seatId, 3),
      ...(target > seat.combinedHp ? [{ kind: 'HealEffect' as const, target: { kind: 'seat' as const, seatId: owner.seatId }, amount: target - seat.combinedHp }] : []),
      { kind: 'TurnFaceUpEffect', seatId: owner.seatId },
    ];
  },
};
```

(If `HealEffect` caps at max HP from 0 or less in a way that misses the target, check `effects.ts`' `HealEffect` and adjust the amount. The test pins the result to 3 HP.)

```ts
const wearsArmour = (state: GameState, seatId: string, registry: ContentRegistry) =>
  (state.zones.find((z) => z.id === equipZoneId(state, seatId))?.cards ?? []).some((c) => registry.cards.get(c.definitionId)?.equipSlot === 'armor');

// Eight Arrays (compulsory): while you wear no armour, you have Eight Trigrams'
// ability (shared with the card). Ignored as armour is (Black Pommel).
export const eightArrays: SkillDefinition = {
  id: 'eight-arrays',
  compulsory: true,
  triggers: [eightTrigramsTrigger('eight-arrays', (_state, owner) => ({ kind: 'skill', owner: owner as GeneralOwner }), (state, owner, registry) => !wearsArmour(state, owner.seatId, registry))],
  onJudged: (state, { owner, seatId, judged, data, done }, registry) => eightTrigramsJudged(state, owner, 'eight-arrays', seatId, judged, data, done, registry),
};

const ofColour = (colour: 'red' | 'black') => (card: CardInstance, state: GameState, seatId: string, registry: ContentRegistry) => colourFor(state, seatId, card, registry) === colour;

// Fire Strategy: a red hand card may be played as Blaze.
export const fireStrategy: SkillDefinition = { id: 'fire-strategy', conversions: [{ id: 'fire-strategy', as: 'blaze', cards: 1, accepts: ofColour('red'), when: 'play' }] };

// See Through: a black hand card may be used as Wuxie.
export const seeThrough: SkillDefinition = { id: 'see-through', conversions: [{ id: 'see-through', as: 'wuxie', cards: 1, accepts: ofColour('black'), when: 'respond' }] };
```

Eight Trigrams' armour check (`shaIgnoresArmor`) already covers Black Pommel inside the shared trigger, so Eight Arrays gets it for free.

- Add `{ id: 'pang-tong', skills: [shackle, nirvana] }` and `{ id: 'fire-zhuge-liang', skills: [eightArrays, fireStrategy, seeThrough] }` to `FIRE_GENERALS`.
- `JudgmentReader` for skills: check `onJudged`'s context carries `owner` (it does: Lightning Strike).
- The bots' `goodForJudged` gains `'eight-arrays'` next to `'eight-trigrams'` in Task 7.

- [ ] **Step 4: Run them, the suite, tsc, and commit**

Run: `npx jest projects/content` and `npx tsc --noEmit -p projects/content/tsconfig.lib.json`.
Expected: PASS.

```bash
git add projects/content
git commit -m "feat(content): Pang Tong's Shackle and Nirvana; Fire Zhuge Liang's Eight Arrays, Fire Strategy and See Through

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Wu and Qun — Taishi Ci, Pang De, Yan Liang and Wen Chou, Yuan Shao

**Files:**
- Modify: `projects/content/src/lib/generals/fire.ts`, `projects/content/src/lib/generals/base.spec.ts` (the Task 1 `it.todo` becomes real)
- Create: `projects/content/src/lib/generals/fire-wu-qun.spec.ts`

**Interfaces:**
- Consumes: `SHA_FLAGS` (Task 3), `compete*` (Task 3), `horsemanship` (`shu.ts`), `Conversion.sameSuit` (Task 2).
- Produces: `heavensJustice`, `suddenAttack`, `duelingHeroes`, `randomStrike`, `bloodline`.
- Flags: `dueling-heroes-red` / `dueling-heroes-black` (the judged colour).
- Outcomes logged: `compete-won` / `compete-lost` (Heaven's Justice); `used(owner, 'discarded', target)` (Sudden Attack); `used(owner, 'judged-red' | 'judged-black')` (Dueling Heroes).

- [ ] **Step 1: Write the failing tests**

`fire-wu-qun.spec.ts`, one `it` per bullet:
- **Heaven's Justice:**
  - May compete with any seat holding a hand card, distance aside.
  - A win sets the three Sha flags. A second Sha is then playable, its template offers seats at any distance and up to 2 targets (`max: 2`), and the turn's flags are gone next turn.
  - A tie (7 against 7) loses: Taishi Ci's Sha isn't offered at all this turn (Review Focus 3).
  - Once per turn.
- **Review Focus 1, end to end:**
  - Taishi Ci with Sky Scorcher wins, then plays his last hand card, a Sha, at 4 seats (5- or 6-seat table).
  - `cardPlays.sha` is 1; each target answers in seat order; damage lands per target.
- **Horsemanship:** Pang De's distance to others is 1 less (reuse the Ma Chao assertion).
- **Sudden Attack:**
  - After `seat-b` dodges Pang De's Sha with a Shan: asked. Use → a choice with the hidden hand and each equipped card (no judgment cards). The picked card goes to the discard pile, and `used(... 'discarded', 'seat-b')` is logged.
  - The same after an Eight Trigrams dodge.
  - Not asked when the dodger holds and wears nothing.
- **Dueling Heroes:**
  - At the Draw Phase: asked. Use → judge; the judged card goes to his hand; nothing else is drawn.
  - With a red judgment, a black hand card is offered as Duel this turn and a red one isn't; the reverse for black.
  - Gone next turn.
  - Don't → the draw happens as usual.
- **Random Strike:**
  - Two same-suit hand cards are offered as Hail of Arrows.
  - Two of different suits are not offered.
  - The selection rejects a mixed pair.
- **Bloodline:** never offered (a Lord skill).
- **`base.spec.ts`:** every Fire General in `FIRE_GENERAL_IDS` has the skills its data lists (by name), as the Wind check does.

- [ ] **Step 2: Run them to see them fail**

Run: `npx jest projects/content/src/lib/generals/fire-wu-qun.spec.ts`
Expected: FAIL.

- [ ] **Step 3: The skills**

```ts
const competable = (state: GameState, seatId: string) => otherLivingSeatIds(state, seatId).filter((id) => handOf(state, id).length > 0);

// Heaven's Justice (active, once per turn): compete with any seat. Win: this
// turn, one more Sha, Sha ignore distance and may take one more target. Lose:
// no Sha this turn.
export const heavensJustice: SkillDefinition = {
  id: 'heavens-justice',
  active: {
    usesPerTurn: 1,
    canUse: (state, { seatId }) => handOf(state, seatId).length > 0 && competable(state, seatId).length > 0,
    start: (state, { seatId, owner }) => [
      selectionOf(state, owner, { of: 'seats', eligibleIds: competable(state, seatId), min: 1, max: 1, then: { kind: 'skill-step', step: skillStep(owner, 'chosen') }, onCancel: [] }),
    ],
  },
  onStep: (state, step) => {
    const competing = competeStep(state, step);
    if (competing) return competing;
    const { owner } = step;
    if (step.step === 'chosen') return competeStart(state, owner, (step.data?.['picked'] as string[])[0], 'judged');
    const flags = step.data?.['won'] ? [SHA_FLAGS.extraPlay, SHA_FLAGS.anyDistance, SHA_FLAGS.extraTarget] : [SHA_FLAGS.none];
    return flags.map((flag): Effect => ({ kind: 'SetTurnFlagEffect', flag }));
  },
};

// Sudden Attack (may): after a seat dodges your Sha (Shan or Eight Trigrams),
// you may discard one of its cards: a face-down hand card or a worn one.
export const suddenAttack: SkillDefinition = {
  id: 'sudden-attack',
  triggers: [
    atStep(['sha-dodged'], {
      condition: (state, step, owner) => step.userSeatId === owner.seatId && isLiving(state, step.target.seatId) && ownCards(state, step.target.seatId, true).length > 0,
      effect: (state, step, owner) => {
        const options = seatCardOptions(state, step.target.seatId, requireZoneOfKind(state.zones, 'discardPile').id, { judgment: false });
        return [askAtStep(owner, 'sudden-attack', step, [choiceOf(state, owner as GeneralOwner, { verb: 'discard', targetSeatId: step.target.seatId, options }), used(owner as GeneralOwner, 'discarded', step.target.seatId), actedOn(step, owner)])];
      },
    }),
  ],
};

const DUEL_FLAG = { red: 'dueling-heroes-red', black: 'dueling-heroes-black' } as const;
const judgedColour = (state: GameState, seatId: string) =>
  state.turn.ownerSeatId !== seatId ? null : state.turn.flags?.[DUEL_FLAG.red] ? 'red' : state.turn.flags?.[DUEL_FLAG.black] ? 'black' : null;

// Dueling Heroes (may): at your Draw Phase, instead of drawing, judge and take
// the judgment card. For the rest of the turn, a hand card of the other colour
// may be played as Duel.
export const duelingHeroes: SkillDefinition = {
  id: 'dueling-heroes',
  triggers: [
    atDrawPhase({
      condition: (_state, draw) => draw.count > 0,
      use: (_state, _passed, owner) => [{ kind: 'JudgeEffect', seatId: owner.seatId, reader: { kind: 'skill', owner } }],
    }),
  ],
  onJudged: (state, { owner, judged, done }, registry) => {
    const colour = colourFor(state, owner.seatId, judged, registry) === 'red' ? 'red' : 'black';
    const keep: Effect = { kind: 'MoveCardEffect', cardInstanceId: judged.instanceId, toZoneId: handZoneId(state, owner.seatId), onlyFrom: requireZoneOfKind(state.zones, 'processing').id };
    return [keep, done, used(owner, `judged-${colour}`), { kind: 'SetTurnFlagEffect', flag: DUEL_FLAG[colour] }];
  },
  conversions: [
    {
      id: 'dueling-heroes', as: 'duel', cards: 1, when: 'play',
      accepts: (card, state, seatId, registry) => {
        const judged = judgedColour(state, seatId);
        return !!judged && colourFor(state, seatId, card, registry) !== judged && colourFor(state, seatId, card, registry) !== 'none';
      },
    },
  ],
};

// Random Strike: 2 hand cards of one suit may be played as Hail of Arrows.
export const randomStrike: SkillDefinition = { id: 'random-strike', conversions: [{ id: 'random-strike', as: 'hail-of-arrows', cards: 2, sameSuit: true, when: 'play' }] };

// Bloodline: a Lord skill, inactive in Kingdom War.
export const bloodline: SkillDefinition = { id: 'bloodline', lord: true };
```

- Check `choiceOf`'s spec has `verb: 'discard'` (Break uses it). If not, use the verb Break's choice uses.
- If the judged card's `done` moves it to the discard pile before `keep` runs, order the moves as River Goddess does (`keep` first, as above).
- Add to `FIRE_GENERALS`:
  - `{ id: 'taishi-ci', skills: [heavensJustice] }`;
  - `{ id: 'pang-de', skills: [horsemanship, suddenAttack] }`;
  - `{ id: 'yan-liang-and-wen-chou', skills: [duelingHeroes] }`;
  - `{ id: 'yuan-shao', skills: [randomStrike, bloodline] }`.

- [ ] **Step 4: Run them, the suite, tsc, and commit**

Run: `npx jest projects/content` and `npx tsc --noEmit -p projects/content/tsconfig.lib.json`.
Expected: PASS.

```bash
git add projects/content
git commit -m "feat(content): Taishi Ci's Heaven's Justice; Pang De's Sudden Attack; Dueling Heroes; Random Strike

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Bots — target templates, competing, and the Fire skills

**Files:**
- Create: `projects/bots/src/lib/fire.ts`, `projects/bots/src/lib/fire.spec.ts`
- Modify: `projects/bots/src/lib/random.ts`, `projects/bots/src/lib/rule-based.ts`, `projects/bots/src/lib/skills.ts`, `projects/bots/src/lib/random.spec.ts`

**Interfaces:**
- `fillPick(view, me, action, pick: (ids, min, max) => string[]): Action | null` (`helpers.ts`): the template with its targets filled in, and no `pickTargets`.
- `pickRandomAction` fills a template with a random count in min..max of random eligible seats (seeded rng, as it does for selections).
- The rule-based bot replaces each template before choosing: non-allies, weakest first, up to max. A template with no non-ally eligible is dropped. Its Sha/conversion filters accept `targets.length >= 1`, reading the first target.
- `wantsFire`, `fireSelection`, `fireChoice` (`fire.ts`), wired into `skills.ts` beside the Wind ones.
- `ACTIVE_ORDER` gains:
  - `early`: `'shackle'`;
  - `late`: `'heavens-justice'` (before Sha plays: it is `late` only if `late` runs before the play loop; otherwise add a `beforeSha` group), `'assault'`, `'rouse-the-tiger'`.
- Each active is gated by a `canUseFire(view, me, skillId, registry)` rule check.

- [ ] **Step 1: Write the failing tests**

`fire.spec.ts`, built on `bots/testing.ts` tables. One test per spec bot rule:
1. Assault pays with a spare weapon if it has one, else HP only at 3 or more; aims at the weakest non-ally in range.
2. Rouse the Tiger only with a card ranked 10 or higher, and a stronger non-ally with another non-ally in its range.
3. Heaven's Justice only with 2 or more Sha and a card ranked 10 or higher.
4. Templates: non-allies, weakest first, up to max; a template naming only allies is skipped.
5. Competing: the user's highest card; a target plays its highest against a non-ally and its lowest against an ally.
6. Eternal Loyalty picks itself unless an ally is further short of its max HP in cards.
7. Shackle recasts clubs ranked below Shan's usefulness and never a Peach.
8. Nirvana and Eight Arrays: Use. Sudden Attack: Use on a non-ally only.
9. Fire Strategy: Blaze at the weakest non-ally holding 3 or more hand cards; discards a matching card when it has one; as a target, shows its least useful card.
10. See Through: only against harmful Tools aimed at itself; never a Peach.
11. Dueling Heroes: when a non-ally exists and it holds 3 or more hand cards.
12. Random Strike: as Hail of Arrows' rule, with the two least useful same-suit cards, never a Peach.

`random.spec.ts`: a template is filled with distinct listed seats within min..max, and `resolve` accepts the action.

- [ ] **Step 2: Run them to see them fail**

Run: `npx jest projects/bots`
Expected: FAIL.

- [ ] **Step 3: Implement**

`random.ts`, inside `pickRandomAction` after the action is drawn:

```ts
  if ((action.kind === 'PlayCardAction' || action.kind === 'UseConversionAction') && action.pickTargets) {
    const { eligibleIds, min, max } = action.pickTargets;
    const count = min + Math.floor(rand() * (max - min + 1));
    const shuffled = [...eligibleIds].sort(() => rand() - 0.5); // seeded rand, like the selection fill
    const { pickTargets: _pick, ...rest } = action;
    return { ...rest, targets: shuffled.slice(0, count).map((seatId) => ({ kind: 'seat' as const, seatId })) };
  }
```

(Use the file's own seeded `rand`. If it shuffles elsewhere with a helper, reuse it.)

`helpers.ts`:

```ts
// A target template filled for the bot: non-allies, weakest first, up to the maximum; null when none qualifies.
export function fillPick<A extends { pickTargets?: TargetPick; targets: Target[] }>(view: GameState, me: Seat, action: A): A | null {
  if (!action.pickTargets) return action;
  const picks = action.pickTargets.eligibleIds
    .map((id) => view.seats.find((s) => s.id === id)!)
    .filter((s) => !isAlly(me, s))
    .sort((a, b) => a.combinedHp - b.combinedHp || a.index - b.index)
    .slice(0, action.pickTargets.max);
  if (picks.length < Math.max(1, action.pickTargets.min)) return null;
  const { pickTargets: _pick, ...rest } = action;
  return { ...rest, targets: picks.map((s) => ({ kind: 'seat' as const, seatId: s.id })) } as A;
}
```

- `rule-based.ts`: at the top of the turn decision, `legal = legal.flatMap((a) => (a.kind === 'PlayCardAction' || a.kind === 'UseConversionAction') && a.pickTargets ? [fillPick(view, self, a)].filter(Boolean) : [a])`.
- `targetedPlays` and the conversion Sha filter accept `targets.length >= 1` for `'sha'` and read `targets[0]` for the ally check.
- Competing selections: `fireSelection` handles a selection whose `then.step.step` is `'compete-user'` (highest rank) or `'compete-target'` (the target's bot: highest if `owner.seatId` is a non-ally, else lowest).
- The rest follows each rule literally in `fire.ts`, with the same shape as `wind.ts` (`wantsFire` for asks, `fireSelection`, `fireChoice`).
- `skills.ts`' `goodForJudged`: `'eight-arrays'` reads like `'eight-trigrams'`, and `'dueling-heroes'` returns null.
- Add the conversion skills `fire-strategy`, `random-strike`, `dueling-heroes` and `see-through` to `SELECTS_FOR` (stage 7 lesson: a bot that opens a conversion must fill its card selection).

- [ ] **Step 4: Run, tsc, and commit**

Run: `npx jest projects/bots`, then `npx jest`, and `npx tsc --noEmit -p projects/bots/tsconfig.json`.
Expected: PASS.

```bash
git add projects/bots
git commit -m "feat(bots): fill target templates; compete; the Fire Generals' bot rules

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Sim — base + Wind + Fire batches and forced pairings

**Files:**
- Create: `projects/sim/src/fire.spec.ts`
- Modify: `projects/sim/src/invariants.ts` (only if a new invariant break turns up)

- [ ] **Step 1: Write the spec**

Model it on `wind.spec.ts`:
- Batches of seeded rule-based games at 2, 5 and 8 seats, with the General pool = base + Wind + Fire (41). Each game finishes within the turn cap, and every invariant holds (including `checkCompulsoryWhileHidden`).
- One forced pairing per Fire General (`withForcedPairing`, `partnerOf`). Over its batch, `firedSkills` includes each of its skills except Bloodline:
  - Assault; Rouse the Tiger; Eternal Loyalty;
  - Shackle; Nirvana;
  - Eight Arrays; Fire Strategy; See Through;
  - Heaven's Justice;
  - Sudden Attack (and Horsemanship, a modifier: excluded like Ma Chao's);
  - Dueling Heroes; Random Strike.
- Raise the batch size or seeds for a rare skill (Nirvana, See Through) rather than weakening the check. Record any skill exempted in the spec with the reason.
- A random-bot batch too: templates filled at random must never be rejected by `resolve`.

- [ ] **Step 2: Run it and fix what it finds**

Run: `npx jest projects/sim/src/fire.spec.ts`
Expected: PASS. For a loop or an invariant break, find the root cause (superpowers:systematic-debugging), add a failing unit test in the right project, fix it, and note it in the ledger.

- [ ] **Step 3: Commit**

```bash
git add projects/sim projects/bots projects/content projects/engine
git commit -m "test(sim): base + Wind + Fire batches and the Fire forced pairings

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: App — the Choose Targets window, competing and Blaze prompts, history lines

**Files:**
- Create: `projects/app/src/app/game-board/targets-dialog.ts`, `targets-dialog.spec.ts`
- Modify:
  - `projects/app/src/app/game-board/hand-view.ts`, `action-list.ts`, `game-board.ts`;
  - `selection-description.ts` (or wherever selection prompts live), `action-history.ts`, `labels.ts`;
  - their specs.

**Interfaces:**
- `TargetsDialog` (standalone, `MatDialog`):
  - data `{ title: string; pick: TargetPick; state: GameState }`;
  - closes with the picked seat ids, or `undefined` on Cancel.
- `hand-view.ts`: a card whose play is a template shows one Play button. It opens the dialog and emits the action with `targets` filled and `pickTargets` dropped.
- `action-list.ts`: a conversion template does the same, then the engine's card selection follows as today.

- [ ] **Step 1: Write the failing tests**

- **`targets-dialog.spec.ts`:**
  - It shows "Choose up to 3 targets" (title "Choose Targets") and one toggle button per eligible seat, named as in `targetLabel` ("Seat 1").
  - Confirm is disabled below `min`, and once `max` are picked the other seats are disabled.
  - Confirm closes with the ids in seat order; Cancel closes with nothing.
- **`hand-view.spec.ts`:** a template play opens `TargetsDialog`, stubbed with `MatDialog` returning `['seat-1', 'seat-2']`, and emits `{ ...template, targets: [seat-1, seat-2] }` without `pickTargets`. Cancel emits nothing.
- **`action-list.spec.ts`:** the same for a conversion template.
- **Prompts:**
  - a `compete-user` / `compete-target` selection reads "Choose a hand card to compete with";
  - a `blaze-shown` selection reads "Choose a hand card to show";
  - a `blaze-hit` selection reads "Discard a card of the same suit to deal 1 damage".
- **History:**
  - "Seat 1 competed with Seat 2: 9 ♠ against 7 ♥, Seat 1 won" (or "…, Seat 2 won" on a loss or tie). Build it from the two `CardShownEvent`s before the `compete-won`/`compete-lost` outcome.
  - "Pang Tong rose from the ashes" for `reborn`.
  - "Dian Wei paid with a Weapon" / "Dian Wei lost 1 HP to Assault" and "Dian Wei struck Seat 2".
  - "Taishi Ci won Heaven's Justice" / "Taishi Ci lost Heaven's Justice and can't use Sha this turn".
  - "Yan Liang and Wen Chou judged red" / "judged black".
  - "Xun Yu's Eternal Loyalty let Seat 2 draw up to its max HP".
  - "Pang De discarded a card of Seat 2".
  - Exact wording per CLAUDE.md casing; adapt to how existing outcome lines name the actor (General or seat).
- **Wiki:** the Fire Generals show as in play (the wiki reads `FIRE_GENERAL_IDS` like `WIND_GENERAL_IDS`).

- [ ] **Step 2: Run them to see them fail**

Run: `npx jest projects/app`
Expected: FAIL.

- [ ] **Step 3: Implement**

`targets-dialog.ts`:

```ts
import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { GameState, TargetPick } from 'engine';
import { targetLabel } from '../labels';

export interface TargetsDialogData {
  title: string;
  pick: TargetPick;
  state: GameState;
}

// Several equal targets chosen in one window (stage 9 spec): toggle up to
// `max` seats, then Confirm. The engine checks the picks again on submit.
@Component({
  selector: 'app-targets-dialog',
  imports: [MatButtonModule, MatDialogModule],
  template: `
    <h2 mat-dialog-title>Choose Targets</h2>
    <mat-dialog-content>
      <p>{{ prompt() }}</p>
      <div class="seats">
        @for (seat of seats(); track seat.id) {
          <button mat-stroked-button type="button" [class.picked]="picked().includes(seat.id)" [disabled]="!picked().includes(seat.id) && full()" (click)="toggle(seat.id)">
            {{ seat.label }}
          </button>
        }
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="ref.close()">Cancel</button>
      <button mat-flat-button type="button" [disabled]="picked().length < data.pick.min" (click)="confirm()">Confirm</button>
    </mat-dialog-actions>
  `,
  styles: `
    .seats { display: flex; flex-wrap: wrap; gap: 8px; }
    .picked { background: var(--mat-sys-primary-container); }
  `,
})
export class TargetsDialog {
  protected readonly data = inject<TargetsDialogData>(MAT_DIALOG_DATA);
  protected readonly ref = inject(MatDialogRef<TargetsDialog, string[]>);
  protected readonly picked = signal<string[]>([]);
  protected readonly full = computed(() => this.picked().length >= this.data.pick.max);
  protected readonly prompt = computed(() => `Choose up to ${this.data.pick.max} targets`);
  protected readonly seats = computed(() =>
    this.data.pick.eligibleIds.map((id) => ({ id, label: targetLabel({ kind: 'seat', seatId: id }, this.data.state.players) }))
  );

  protected toggle(id: string): void {
    this.picked.update((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  protected confirm(): void {
    const order = this.data.pick.eligibleIds;
    this.ref.close([...this.picked()].sort((a, b) => order.indexOf(a) - order.indexOf(b)));
  }
}
```

`hand-view.ts`:
- `HandCardViewModel` gains `template: PlayCard | null` (the play carrying `pickTargets`).
- The template's first branch is `@if (vm.template) { <button … (click)="pickTargets(vm)">Play</button> }`, then the existing branches.

```ts
  protected pickTargets(vm: HandCardViewModel): void {
    const template = vm.template!;
    this.dialog
      .open<TargetsDialog, TargetsDialogData, string[]>(TargetsDialog, { data: { title: vm.name, pick: template.pickTargets!, state: this.state() } })
      .afterClosed()
      .subscribe((ids) => {
        if (!ids?.length) return;
        const { pickTargets: _pick, ...rest } = template;
        this.play.emit({ ...rest, targets: ids.map((seatId) => ({ kind: 'seat' as const, seatId })) });
      });
  }
```

`action-list.ts`: the conversion entry for a template opens the same dialog and emits its filled action.

`labels.ts`' `actionLabel` for a template: "Play Sha (choose targets)". Wording stays sentence case after the card name, per the existing labels.

Prompts and history lines go into the existing describers (`choice-description.ts`, the selection prompt function, `action-history.ts`), keyed by step name and outcome.

- [ ] **Step 4: Run, build, and check in the browser**

Run: `npx jest projects/app` and `npx ng build app`.
Expected: PASS, builds.

Headless check with Playwright, as in stage 8:
- A state where seat 0 (Taishi Ci, after a won Heaven's Justice, wearing Sky Scorcher) holds 1 Sha. Hover it → Play → the Choose Targets window lists the eligible seats; pick 3 → Confirm → the first target's Shan window opens.
- A Rouse the Tiger compete: the prompt and the history line show.

Screenshot both into the scratchpad and look at them.

- [ ] **Step 5: Commit**

```bash
git add projects/app
git commit -m "feat(app): the Choose Targets window; competing and Blaze prompts; Fire history lines

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Docs and the final check

**Files:**
- Modify: `docs/architecture/event-chain.md`, `docs/superpowers/specs/2026-10-09-stage-9-fire-generals-design.md` (rulings), `docs/superpowers/specs/2026-10-05-all-cards-and-skills-roadmap-design.md` (stage 9 status)

- [ ] **Step 1: Docs**

- **`event-chain.md`:**
  - target templates (`targetPick` → `pickTargets` → `fitsPick` on resolve);
  - competing as skill steps;
  - Blaze's steps;
  - Nirvana before the dying round;
  - Sudden Attack at `sha-dodged`.
- **The spec:** a "Rulings made while building" list (this plan's departures, plus any found in Tasks 4–9).
- **The roadmap:** stage 9 marked done.

- [ ] **Step 2: Everything green**

Run:
- `npx jest`;
- `npx tsc --noEmit -p projects/content/tsconfig.lib.json`;
- `npx tsc --noEmit -p projects/engine/tsconfig.lib.json` (only the 2 known pre-existing spec errors);
- `npx tsc --noEmit -p projects/bots/tsconfig.json`;
- `npx tsc --noEmit -p projects/sim/tsconfig.json`;
- `npx ng build app`.

Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add docs
git commit -m "docs: stage 9 event chain, rulings and roadmap status

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
