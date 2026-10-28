# Card Playability and Larger Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cards are playable only as their own rules allow: Sha once per turn within attack range, mounts and weapon reach counted, all on the Play phase only. The seat tiles are about twice as large.

**Architecture:**
- **Engine:** `CardDefinition.legalPlayTargets` (a per-card hook) and `CardDefinition.weaponRange`. `Turn.cardPlays` counts proactive plays.
- **Legality:** `getLegalActions` offers exactly the hook's target lists, in the Play phase only, and `resolve` re-validates and counts.
- **Content:** each card implements its rule using the shared `seatDistance` / `attackRange` / `shaLimit` helpers.
- **UI:** CSS and size changes only.

**Tech Stack:** TypeScript 6, Angular 22 + Material 22, Jest 30.

**Spec:** `docs/superpowers/specs/2026-10-01-card-playability-design.md`

## Global Constraints

- The engine stays framework-free and content-agnostic. No card ids in the engine.
- Hook semantics:
  - `[]` means not playable.
  - `[[]]` means untargeted.
  - `[[t1], [t2]]` means one target from that set.
  - Absent hook, or no registry, means legacy offers.
- Error messages, verbatim:
  - `Cards can only be played during your Play phase`
  - `Card <id> cannot be played with those targets`
- `RespondAction` plays never count toward `cardPlays`.
- Green Dragon Blade's `weaponRange` is 3, read from card data. The Sha limit is 1, from `shaLimit()`.
- Work on branch `feature/card-playability`. Commits end with the trailer `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- Verify with `npx jest`, the 5 type checks, and `npx ng build app` with no warnings.

## Review Focus

1. **Answering a Duel with Sha after already playing a Sha this turn:** it must still be allowed. Task 1's counting test plays a response and asserts the count is unchanged. Task 2 asserts Sha is still a legal `RespondAction` when `cardPlays.sha` is 1.
2. **A seat that is the only other living seat, at distance 1:** Sha is offered. With a 5-seat table and no weapon, the seat opposite (distance 2) is not offered. Task 2.
3. **An eliminated seat between attacker and target:** distance shrinks, because the ring counts living seats only, as in the existing `getSeatDistance`. Task 2 covers this.
4. **The human (or a bot) trying to play cards in the Draw or Discard phase:** nothing is offered, and resolve rejects it. Task 1.
5. **Equipping Green Dragon Blade mid-turn:** range 3 applies immediately to the next legal-action computation. Task 2 recomputes after equipping.

---

### Task 1: Engine play hook, Play-phase enforcement, and per-turn counts

**Files:** `projects/engine/src/lib/registry/types.ts`, `projects/engine/src/lib/domain/types.ts`, `projects/engine/src/lib/rules/legality.ts`, `projects/engine/src/lib/pipeline/resolve.ts`; test `projects/engine/src/lib/rules/playability.spec.ts` (new). Fix any spec fixtures that play cards outside the Play phase.

**Interfaces (produces):**
- `PlayOptionsContext { seatId; cardInstanceId }`
- `CardDefinition.legalPlayTargets?(state, ctx, registry): Target[][]`
- `CardDefinition.weaponRange?: number`
- `Turn.cardPlays?: Record<string, number>`

- [ ] **Step 1: Write the failing tests**

Create `projects/engine/src/lib/rules/playability.spec.ts`:

```ts
import { getLegalActions } from './legality';
import { resolve } from '../pipeline/resolve';
import { CardDefinition, ContentRegistry, GameModeDefinition } from '../registry/types';
import { GameState, Phase, Seat, Target } from '../domain/types';
import { createRng } from '../rng/rng';

const seatT = (seatId: string): Target => ({ kind: 'seat', seatId });

// 'aim' may target seat-b only; 'self' is untargeted; 'never' is not playable.
const aim: CardDefinition = { id: 'aim', name: 'Aim', category: 'basic', play: () => [], legalPlayTargets: () => [[seatT('seat-b')]] };
const self: CardDefinition = { id: 'self', name: 'Self', category: 'basic', play: () => [], legalPlayTargets: () => [[]] };
const never: CardDefinition = { id: 'never', name: 'Never', category: 'basic', play: () => [], legalPlayTargets: () => [] };
const legacy: CardDefinition = { id: 'legacy', name: 'Legacy', category: 'basic', play: () => [] };
const registry: ContentRegistry = { cards: new Map([aim, self, never, legacy].map((c) => [c.id, c])), generals: new Map() };
const mode: GameModeDefinition = { id: 'm', setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'], checkWinCondition: () => null, triggers: [] };

function seat(id: string, index: number): Seat {
  return {
    id, index, kingdom: 'Wei', combinedHp: 4, maxCombinedHp: 4, eliminated: false,
    generals: { main: { generalDefinitionId: 'g1', revealed: false }, deputy: { generalDefinitionId: 'g2', revealed: false } },
    hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` },
  };
}

function state(phase: Phase, hand: string[]): GameState {
  return {
    seats: [seat('seat-a', 0), seat('seat-b', 1), seat('seat-c', 2)],
    players: [], turn: { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [] }, phase,
    zones: [
      { id: 'discardPile', kind: 'discardPile', cards: [] },
      { id: 'seat-a:hand', kind: 'hand', ownerSeatId: 'seat-a', cards: hand.map((d) => ({ instanceId: `${d}-1`, definitionId: d, suit: 'spade' as const, rank: 1 })) },
      { id: 'seat-a:equip', kind: 'equip', ownerSeatId: 'seat-a', cards: [] },
    ],
    pendingResponse: null, log: [], rng: createRng(1), result: null, generalSelection: null,
  };
}

const plays = (s: GameState) => getLegalActions(s, 'seat-a', registry).filter((a) => a.kind === 'PlayCardAction');

describe('card playability', () => {
  it('offers exactly the target lists the card returns', () => {
    expect(plays(state('Play', ['aim']))).toEqual([{ kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'aim-1', targets: [seatT('seat-b')] }]);
    expect(plays(state('Play', ['self']))).toEqual([{ kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'self-1', targets: [] }]);
    expect(plays(state('Play', ['never']))).toEqual([]);
  });

  it('keeps legacy offers for a card without a hook, and for callers without a registry', () => {
    expect(plays(state('Play', ['legacy']))).toHaveLength(3); // untargeted + seat-b + seat-c
    expect(getLegalActions(state('Play', ['aim']), 'seat-a').filter((a) => a.kind === 'PlayCardAction')).toHaveLength(3);
  });

  it('offers no card plays outside the Play phase, but still End phase (Review Focus 4)', () => {
    for (const phase of ['Judgment', 'Draw', 'Discard', 'End'] as const) {
      const legal = getLegalActions(state(phase, ['self', 'aim']), 'seat-a', registry);
      expect(legal).toEqual([{ kind: 'EndPhaseAction', seatId: 'seat-a' }]);
    }
  });

  it('rejects a card play outside the Play phase', () => {
    expect(() =>
      resolve(state('Draw', ['self']), { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'self-1', targets: [] }, { registry, mode })
    ).toThrow('Cards can only be played during your Play phase');
  });

  it('rejects a target list the card does not allow', () => {
    expect(() =>
      resolve(state('Play', ['aim']), { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'aim-1', targets: [seatT('seat-c')] }, { registry, mode })
    ).toThrow('Card aim cannot be played with those targets');
  });

  it('counts proactive plays per definition this turn', () => {
    const once = resolve(state('Play', ['self', 'self']), { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'self-1', targets: [] }, { registry, mode }).state;
    expect(once.turn.cardPlays).toEqual({ self: 1 });
  });

  it('starts a new turn with no play counts', () => {
    const s = { ...state('End', []), turn: { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [], cardPlays: { self: 2 } } };
    const next = resolve(s, { kind: 'EndPhaseAction', seatId: 'seat-a' }, { registry, mode }).state;
    expect(next.turn.turnNumber).toBe(2);
    expect(next.turn.cardPlays).toBeUndefined();
  });

  it('does not count a card played as a response (Review Focus 1)', () => {
    const s: GameState = {
      ...state('Play', []),
      turn: { turnNumber: 1, ownerSeatId: 'seat-b', extraTurnStack: [], cardPlays: { self: 1 } },
      pendingResponse: {
        id: 'r1', respondingSeatId: 'seat-a', allowedActionKinds: ['RespondAction', 'PassAction'], allowedCardIds: ['self'],
        context: { effect: { kind: 'HealEffect', target: seatT('seat-a'), amount: 1 } },
      },
    };
    const withCard = { ...s, zones: state('Play', ['self']).zones };
    const next = resolve(withCard, { kind: 'RespondAction', seatId: 'seat-a', pendingResponseId: 'r1', cardInstanceId: 'self-1' }, { registry, mode }).state;
    expect(next.turn.cardPlays).toEqual({ self: 1 });
  });
});
```

Run: `npx jest projects/engine/src/lib/rules/playability.spec.ts`
Expected: FAIL. The legacy offers are returned, and there is no phase check, no validation and no counts.

- [ ] **Step 2: Implement**

`projects/engine/src/lib/registry/types.ts`: add this before `CardDefinition`:

```ts
export interface PlayOptionsContext {
  seatId: string;
  cardInstanceId: string;
}
```

Add these fields to `CardDefinition`:

```ts
  // Reach of a weapon (attack range while equipped); set only for weapons.
  weaponRange?: number;
  // Every legal target list for proactively playing this card in the owner's
  // Play phase: [] = not playable now, [[]] = no target, [[t1], [t2]] = one of
  // these targets. Absent = legacy offers (untargeted + each living other seat).
  legalPlayTargets?(state: GameState, ctx: PlayOptionsContext, registry: ContentRegistry): Target[][];
```

`projects/engine/src/lib/domain/types.ts`: add this to `Turn`:

```ts
  // Proactive card plays this turn, by card definition id (responses excluded).
  cardPlays?: Record<string, number>;
```

`projects/engine/src/lib/rules/legality.ts`: replace the tail of `getLegalActions`, from `if (state.turn.ownerSeatId !== seatId) return [];` to the end, with:

```ts
  if (state.turn.ownerSeatId !== seatId) return [];

  const actions: Action[] = [{ kind: 'EndPhaseAction', seatId }];
  // Cards are played only in the owner's Play phase.
  if (state.phase !== 'Play') return actions;
  const handZone = state.zones.find((z) => z.id === actingSeat.hand.zoneId);
  for (const card of handZone?.cards ?? []) {
    for (const targets of legalTargetListsFor(state, seatId, card.instanceId, card.definitionId, registry)) {
      actions.push({ kind: 'PlayCardAction', seatId, cardInstanceId: card.instanceId, targets });
    }
  }
  return actions;
}

// The card's own rule when it has one; legacy offers otherwise.
export function legalTargetListsFor(
  state: GameState,
  seatId: string,
  cardInstanceId: string,
  definitionId: string,
  registry?: ContentRegistry
): Target[][] {
  const definition = registry?.cards.get(definitionId);
  if (registry && definition?.legalPlayTargets) {
    return definition.legalPlayTargets(state, { seatId, cardInstanceId }, registry);
  }
  return [[], ...getLegalTargets(state, seatId).map((t) => [t])];
}
```

`projects/engine/src/lib/pipeline/resolve.ts`:
- Add `import { legalTargetListsFor } from '../rules/legality';`.
- In `case 'PlayCardAction'`, directly after the `cardInHand` check, add:

```ts
      if (state.phase !== 'Play' || state.turn.ownerSeatId !== action.seatId) {
        throw new Error('Cards can only be played during your Play phase');
      }
      const allowed = legalTargetListsFor(state, action.seatId, action.cardInstanceId, cardInHand.definitionId, ctx.registry);
      if (!allowed.some((targets) => JSON.stringify(targets) === JSON.stringify(action.targets))) {
        throw new Error(`Card ${cardInHand.definitionId} cannot be played with those targets`);
      }
```

- Before `return { state: currentState, events: allEvents };` in that case, add:

```ts
      // Count this proactive play for per-turn limits (only if still the same turn).
      if (currentState.turn.turnNumber === state.turn.turnNumber) {
        const plays = currentState.turn.cardPlays ?? {};
        currentState = {
          ...currentState,
          turn: { ...currentState.turn, cardPlays: { ...plays, [cardInHand.definitionId]: (plays[cardInHand.definitionId] ?? 0) + 1 } },
        };
      }
```

`advanceTurn` in `phaseSequence.ts` already builds a fresh `Turn` without `cardPlays`, so nothing changes there.

- [ ] **Step 3: Run and fix fixtures**

Run: `npx jest > .superpowers/sdd/2026-10-01-card-playability/t1.log 2>&1; tail -40 .superpowers/sdd/2026-10-01-card-playability/t1.log`

Expected: `playability.spec.ts` PASSES. Existing tests that play cards outside the Play phase now fail with `Cards can only be played during your Play phase`. The known one is `guozhan.spec.ts`'s `seated()` helper, which sets `phase: 'Judgment'`: change the lethal-damage test's state to `phase: 'Play'`, and leave the draw tests, which need Judgment, alone.

For each other failure of that kind, set the fixture's phase to `'Play'`. Do NOT change engine code to accommodate a test. A failure for any other reason is a real regression: debug it.

Then run: `npx jest && npx tsc -p projects/engine/tsconfig.spec.json --noEmit && npx tsc -p projects/content/tsconfig.spec.json --noEmit`
Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add projects
git commit -m "feat(engine): cards declare their legal plays; plays only in the Play phase; per-turn play counts

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Content rules — distance, attack range, Sha limit, and each card's play rule

**Files:**
- Modify: `projects/content/src/lib/shared/queries.ts`
- Modify the cards: `sha.ts`, `shan.ts`, `peach.ts`, `duel.ts`, `wuxie.ts`, `equipment.ts`
- Test: `projects/content/src/lib/cards/playability.spec.ts` (new)

**Interfaces (produces, from `shared/queries`):**
- `seatDistance(state, from, to, registry): number`
- `attackRange(state, seatId, registry): number`
- `shaLimit(state, seatId, registry): number`

- [ ] **Step 1: Write the failing tests**

Create `projects/content/src/lib/cards/playability.spec.ts`:

```ts
import { getLegalActions, resolve } from 'engine';
import type { CardDefinition, ContentRegistry, GameState, Seat, Target } from 'engine';
import { buildContentRegistry } from '../registry';
import { guozhanMode } from '../modes/guozhan';
import { attackRange, seatDistance } from '../shared/queries';

const t = (seatId: string): Target => ({ kind: 'seat', seatId });
const stubMount = (id: string, equipSlot: 'plusMount' | 'minusMount'): CardDefinition => ({ id, name: id, category: 'equipment', equipSlot, play: () => [] });

function registry(): ContentRegistry {
  const r = buildContentRegistry();
  r.cards.set('plus-horse', stubMount('plus-horse', 'plusMount'));
  r.cards.set('minus-horse', stubMount('minus-horse', 'minusMount'));
  return r;
}

function seat(id: string, index: number, combinedHp = 4, eliminated = false): Seat {
  return {
    id, index, kingdom: 'Wei', combinedHp, maxCombinedHp: 4, eliminated,
    generals: { main: { generalDefinitionId: 'cao-cao', revealed: false }, deputy: { generalDefinitionId: 'xu-chu', revealed: false } },
    hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` },
  };
}

// 5 seats; seat-0 acts. Ring distances from seat-0: seat-1 1, seat-2 2, seat-3 2, seat-4 1.
function table(opts: { hand?: string[]; equip?: Record<string, string[]>; hp?: number; eliminated?: string[]; cardPlays?: Record<string, number> } = {}): GameState {
  const ids = ['seat-0', 'seat-1', 'seat-2', 'seat-3', 'seat-4'];
  const card = (d: string, i: number) => ({ instanceId: `${d}-${i}`, definitionId: d, suit: 'spade' as const, rank: 1 });
  return {
    seats: ids.map((id, i) => seat(id, i, id === 'seat-0' ? opts.hp ?? 4 : 4, (opts.eliminated ?? []).includes(id))),
    players: [], phase: 'Play',
    turn: { turnNumber: 1, ownerSeatId: 'seat-0', extraTurnStack: [], cardPlays: opts.cardPlays },
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: [] },
      { id: 'discardPile', kind: 'discardPile', cards: [] },
      ...ids.flatMap((id) => [
        { id: `${id}:hand`, kind: 'hand' as const, ownerSeatId: id, cards: id === 'seat-0' ? (opts.hand ?? []).map(card) : [] },
        { id: `${id}:equip`, kind: 'equip' as const, ownerSeatId: id, cards: (opts.equip?.[id] ?? []).map(card) },
      ]),
    ],
    pendingResponse: null, log: [], rng: { seed: 1, counter: 0 }, result: null, generalSelection: null,
  };
}

const playsOf = (s: GameState, r: ContentRegistry, definitionId: string) =>
  getLegalActions(s, 'seat-0', r)
    .filter((a): a is Extract<typeof a, { kind: 'PlayCardAction' }> => a.kind === 'PlayCardAction' && a.cardInstanceId.startsWith(`${definitionId}-`))
    .map((a) => a.targets);

describe('distance and attack range', () => {
  it('is the living-seat ring distance, adjusted by mounts and never below 1', () => {
    const r = registry();
    expect(seatDistance(table(), 'seat-0', 'seat-2', r)).toBe(2);
    expect(seatDistance(table({ equip: { 'seat-2': ['plus-horse'] } }), 'seat-0', 'seat-2', r)).toBe(3);
    expect(seatDistance(table({ equip: { 'seat-0': ['minus-horse'] } }), 'seat-0', 'seat-2', r)).toBe(1);
    expect(seatDistance(table({ equip: { 'seat-0': ['minus-horse'] } }), 'seat-0', 'seat-1', r)).toBe(1);
  });

  it('skips eliminated seats (Review Focus 3)', () => {
    expect(seatDistance(table({ eliminated: ['seat-1'] }), 'seat-0', 'seat-2', registry())).toBe(1);
  });

  it('is 1 without a weapon and the weapon range with one', () => {
    const r = registry();
    expect(attackRange(table(), 'seat-0', r)).toBe(1);
    expect(attackRange(table({ equip: { 'seat-0': ['green-dragon-blade'] } }), 'seat-0', r)).toBe(3);
  });
});

describe('each card’s play rule', () => {
  it('Sha targets only living seats within attack range, never untargeted (Review Focus 2)', () => {
    const r = registry();
    expect(playsOf(table({ hand: ['sha'] }), r, 'sha')).toEqual([[t('seat-1')], [t('seat-4')]]);
    expect(playsOf(table({ hand: ['sha'], equip: { 'seat-0': ['green-dragon-blade'] } }), r, 'sha')).toEqual([
      [t('seat-1')], [t('seat-2')], [t('seat-3')], [t('seat-4')],
    ]);
  });

  it('Sha is not playable once this turn’s limit is used, but still answers a Duel (Review Focus 1)', () => {
    const r = registry();
    expect(playsOf(table({ hand: ['sha'], cardPlays: { sha: 1 } }), r, 'sha')).toEqual([]);
    const s: GameState = {
      ...table({ hand: ['sha'], cardPlays: { sha: 1 } }),
      turn: { turnNumber: 1, ownerSeatId: 'seat-1', extraTurnStack: [], cardPlays: { sha: 1 } },
      pendingResponse: {
        id: 'duel-1', respondingSeatId: 'seat-0', allowedActionKinds: ['RespondAction', 'PassAction'], allowedCardIds: ['sha', 'wuxie'],
        context: { effect: { kind: 'DamageEffect', damage: { source: t('seat-1'), target: t('seat-0'), amount: 2, nature: 'normal' } } },
      },
    };
    expect(getLegalActions(s, 'seat-0', r).some((a) => a.kind === 'RespondAction')).toBe(true);
  });

  it('a second Sha in the same turn is no longer legal after the first resolves', () => {
    const r = registry();
    const first = resolve(
      table({ hand: ['sha', 'sha'] }),
      { kind: 'PlayCardAction', seatId: 'seat-0', cardInstanceId: 'sha-0', targets: [t('seat-1')] },
      { registry: r, mode: guozhanMode }
    ).state;
    // seat-1 has no Shan, so it passes and takes the damage; afterwards it is seat-0's Play phase again.
    const afterPass = resolve(first, { kind: 'PassAction', seatId: 'seat-1', pendingResponseId: first.pendingResponse!.id }, { registry: r, mode: guozhanMode }).state;
    expect(playsOf(afterPass, r, 'sha')).toEqual([]);
  });

  it('Shan and Wuxie are never played proactively', () => {
    const r = registry();
    expect(playsOf(table({ hand: ['shan'] }), r, 'shan')).toEqual([]);
    expect(playsOf(table({ hand: ['wuxie'] }), r, 'wuxie')).toEqual([]);
  });

  it('Peach is playable untargeted only when hurt', () => {
    const r = registry();
    expect(playsOf(table({ hand: ['peach'], hp: 4 }), r, 'peach')).toEqual([]);
    expect(playsOf(table({ hand: ['peach'], hp: 3 }), r, 'peach')).toEqual([[]]);
  });

  it('Duel targets any living other seat at any distance', () => {
    expect(playsOf(table({ hand: ['duel'], eliminated: ['seat-3'] }), registry(), 'duel')).toEqual([[t('seat-1')], [t('seat-2')], [t('seat-4')]]);
  });

  it('equipment is played untargeted, and a weapon’s range applies at once (Review Focus 5)', () => {
    const r = registry();
    const s = table({ hand: ['green-dragon-blade', 'sha'] });
    expect(playsOf(s, r, 'green-dragon-blade')).toEqual([[]]);
    expect(playsOf(table({ hand: ['silver-lion'] }), r, 'silver-lion')).toEqual([[]]);
    const equipped = resolve(s, { kind: 'PlayCardAction', seatId: 'seat-0', cardInstanceId: 'green-dragon-blade-0', targets: [] }, { registry: r, mode: guozhanMode }).state;
    expect(playsOf(equipped, r, 'sha')).toHaveLength(4);
  });
});
```

Run: `npx jest projects/content/src/lib/cards/playability.spec.ts`
Expected: FAIL (no `seatDistance` / `attackRange` exports; the legacy offers are returned).

- [ ] **Step 2: Implement the shared helpers**

Append to `projects/content/src/lib/shared/queries.ts`:

```ts
import type { ContentRegistry, EquipSlot, Target } from 'engine';

function equippedSlot(state: GameState, seatId: string, slot: EquipSlot, registry: ContentRegistry) {
  const seat = state.seats.find((s) => s.id === seatId);
  const zone = seat && state.zones.find((z) => z.id === seat.equipped.zoneId);
  return zone?.cards.map((c) => registry.cards.get(c.definitionId)).find((d) => d?.equipSlot === slot);
}

// Distance for targeting: living-seat ring distance, +1 if the target rides a
// +1 mount, −1 if the attacker rides a −1 mount, never below 1.
export function seatDistance(state: GameState, fromSeatId: string, toSeatId: string, registry: ContentRegistry): number {
  const base = getSeatDistance(state, fromSeatId, toSeatId);
  if (!Number.isFinite(base)) return base;
  const plus = equippedSlot(state, toSeatId, 'plusMount', registry) ? 1 : 0;
  const minus = equippedSlot(state, fromSeatId, 'minusMount', registry) ? 1 : 0;
  return Math.max(1, base + plus - minus);
}

// How far the seat can attack: its weapon's reach, or 1 unarmed.
export function attackRange(state: GameState, seatId: string, registry: ContentRegistry): number {
  return equippedSlot(state, seatId, 'weapon', registry)?.weaponRange ?? 1;
}

// Sha plays allowed per turn. The single place a future effect (e.g. Crossbow) raises it.
export function shaLimit(_state: GameState, _seatId: string, _registry: ContentRegistry): number {
  return 1;
}

// Every living seat other than `seatId`, as single-target lists, in seat order.
export function otherLivingSeatTargets(state: GameState, seatId: string): Target[][] {
  return [...state.seats]
    .sort((a, b) => a.index - b.index)
    .filter((s) => s.id !== seatId && !s.eliminated)
    .map((s) => [{ kind: 'seat' as const, seatId: s.id }]);
}
```

Merge the new type import with the file's existing `import type { GameState } from 'engine';`.

- [ ] **Step 3: Implement each card's rule**

- `sha.ts`: add the import `import { attackRange, otherLivingSeatTargets, seatDistance, shaLimit } from '../shared/queries';`, and add to `shaCard`:

```ts
  legalPlayTargets: (state, ctx, registry) => {
    if ((state.turn.cardPlays?.['sha'] ?? 0) >= shaLimit(state, ctx.seatId, registry)) return [];
    const range = attackRange(state, ctx.seatId, registry);
    return otherLivingSeatTargets(state, ctx.seatId).filter(
      ([target]) => target.kind === 'seat' && seatDistance(state, ctx.seatId, target.seatId, registry) <= range
    );
  },
```

- `shan.ts` and `wuxie.ts`: add `legalPlayTargets: () => [], // response only`.
- `peach.ts`: add:

```ts
  legalPlayTargets: (state, ctx) => {
    const seat = state.seats.find((s) => s.id === ctx.seatId);
    return seat && seat.combinedHp < seat.maxCombinedHp ? [[]] : [];
  },
```

- `duel.ts`: add the import `import { otherLivingSeatTargets } from '../shared/queries';`, and add `legalPlayTargets: (state, ctx) => otherLivingSeatTargets(state, ctx.seatId),`.
- `equipment.ts`:
  - In `makeEquipmentCard`, add `legalPlayTargets: () => [[]],`.
  - Set `weaponRange` for weapons from card data: add a `weaponRange?: number` parameter, set the property when defined, and pass `cardsData['green-dragon-blade'].range` for the blade. Import `cardsData` from `'../../../data/cards'`.

- [ ] **Step 4: Run tests and type checks**

Run: `npx jest > .superpowers/sdd/2026-10-01-card-playability/t2.log 2>&1; tail -30 .superpowers/sdd/2026-10-01-card-playability/t2.log; npx tsc -p projects/content/tsconfig.spec.json --noEmit && npx tsc -p projects/sim/tsconfig.json --noEmit && npx tsc -p projects/bots/tsconfig.json --noEmit`

Expected: all PASS. Existing tests that play a card the new rules forbid now fail with "cannot be played with those targets": an untargeted Sha, a Sha out of range, or a Peach at full HP. For each, fix the fixture to a legal play, for example by hurting the seat or putting the target at distance 1. Do not loosen a rule. The sim property tests must stay green with both bot kinds.

- [ ] **Step 5: Commit**

```bash
git add projects
git commit -m "feat(content): Sha once per turn within attack range (mounts and weapon reach); per-card play rules

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: A seat tile and table about twice as large

**Files:** `projects/app/src/app/game-board/seat-tile.ts` (+ spec), `projects/app/src/app/game-board/round-table.ts`

- [ ] **Step 1: Write the failing test**

Append to `seat-tile.spec.ts`:

```ts
  it('draws general portraits at normal size and equipment slots at small size', () => {
    const el = render(
      makeSeat({ generals: { main: { generalDefinitionId: 'cao-cao', revealed: true }, deputy: { generalDefinitionId: 'hidden', revealed: false } } }),
      { equipment: [eq('e1', 'green-dragon-blade')] }
    );
    expect(el.querySelector('.generals app-card-art img')!.classList).not.toContain('small');
    expect(el.querySelector('.equip .slot app-card-art img')!.classList).toContain('small');
  });
```

Also change the earlier slot assertion from `toContain('tiny')` to `toContain('small')`.

Run: `npx jest projects/app/src/app/game-board/seat-tile.spec.ts`
Expected: FAIL. The portraits are `small` and the slots are `tiny`.

- [ ] **Step 2: Implement the sizes**

In `seat-tile.ts`:
- Remove `size="small"` from both general `<app-card-art>`s (`normal` is the default, 70×96).
- Change the slot art to `size="small"`.
- Change these styles:
  - `.tile`: `font-size: 1.1em; min-width: 200px; padding: 8px 10px; border-radius: 14px;`
  - `.generals`: `gap: 6px; min-height: 96px;`
  - `.equip`: `grid-template-columns: repeat(4, 44px); gap: 5px;`
  - `.slot`: `width: 44px; height: 60px;`
  - `.slot.empty mat-icon`: `font-size: 22px; width: 22px; height: 22px;`
  - `.bot-icon`: `font-size: 18px; width: 18px; height: 18px;`

In `round-table.ts`:
- Change the `.table` `max-width: 960px` to `max-width: 1280px`.
- Change `.centre` `font-size: 0.85em` to `1.05em`.
- In the `@media (max-width: 600px)` block, change the `.seat` scale from `0.8` to `0.55`.

- [ ] **Step 3: Run tests and build**

Run: `npx jest --selectProjects app && npx tsc -p projects/app/tsconfig.spec.json --noEmit && npx ng build app`
Expected: all PASS, and the build has no warnings. If the component style budget warns, move the larger tile styles into a separate `seat-tile.css` via `styleUrl`.

- [ ] **Step 4: Commit**

```bash
git add projects/app/src/app/game-board
git commit -m "feat(app): seat tiles and table about twice as large

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

The controller then runs a browser check at 1280px and 400px.
