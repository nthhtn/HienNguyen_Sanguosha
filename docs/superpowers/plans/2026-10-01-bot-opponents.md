# Bot Opponents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One person plays Kingdom War as `seat-0` against rule-based computer opponents. Pass-and-play stays available.

**Architecture:**
- A new framework-free `projects/bots` library holds the rule-based policy, plus the sim's random picker moved there unchanged. Both the sim and the app depend on it.
- The app's `GameService` gains a game mode. In vs-bots mode it marks seats human or bot, and runs bot moves on a timer through the same `resolve` path as human moves.
- The board drops the reveal gate in vs-bots mode and shows a "thinking…" state.

**Tech Stack:** TypeScript 6, Angular 22 (standalone components, signals, Material 22), Jest 30 (ts-jest for engine/content/sim/bots, jest-preset-angular for app).

**Spec:** `docs/superpowers/specs/2026-10-01-bot-opponents-design.md`

## Global Constraints

- `projects/bots` MUST NOT import Angular, DOM APIs or timers. It may import only `engine` and `content`.
- A bot only ever returns an action that is one of the `legal` array it was given (identity, not just equality). It sees only `redactStateForSeat(state, seatId)`.
- `MAX_BOT_ACTIONS_PER_TURN = 30`. In vs-bots mode the human is `seat-0`. The default bot delay is `700` ms.
- Pass-and-play behaviour is unchanged: reveal gate, no timers.
- Ruling (refines the spec): `GameService.startGame`'s `mode` parameter defaults to `'pass-and-play'`, so existing callers and tests keep today's behaviour. The **Setup screen** defaults its toggle to `'vs-bots'`, and that is the default a user sees.
- Ruling (refines the spec): the delay is a public writable `GameService.botDelayMs` field (default 700), not an `InjectionToken`, because the existing `GameService` tests construct the service with `new GameService()` outside an injection context.
- Ruling (from a prototype run before planning): with no hand limit in the engine, rule-based bot-vs-bot games can run past 2,000 actions. All 60 property-test seeds finish within 20,000. The rule-based sim runs therefore use `maxActions = 20000`.
- Commits end with the trailer `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- Type checks:
  - `npx tsc -p projects/engine/tsconfig.spec.json --noEmit`
  - `npx tsc -p projects/content/tsconfig.spec.json --noEmit`
  - `npx tsc -p projects/sim/tsconfig.json --noEmit`
  - `npx tsc -p projects/bots/tsconfig.json --noEmit`
  - `npx tsc -p projects/app/tsconfig.spec.json --noEmit`
  - App build: `npx ng build app`, which must report no warnings.

## Review Focus

1. **The human is eliminated while bots remain.** The user expects the bots to keep playing to a result, followed by the Game over screen, with no hang. Task 4's "plays on to a result" test drives a game where the human only ends phases or passes, and asserts that a result is reached with no pending timers.
2. **The user starts a new game (or switches mode) while a bot timer is pending.** The user expects the old bot never to act on the new game. Task 4 asserts that `startGame` leaves `jest.getTimerCount() === 0` and `botThinkingSeatId() === null`.
3. **A bot's move throws (engine bug).** The user expects an error banner, and that the bots stop rather than spin. Task 4 mocks `ruleBasedPolicy.decide` to throw, and asserts `lastError` is set with no timer pending.
4. **The user clicks a card while a bot is acting.** The user expects nothing to be playable. Task 4 asserts that `legalActions()` is empty while a bot is due to act. Task 5 checks the hand renders Play disabled in that state.
5. **The user picks Pass-and-play.** The user expects exactly today's flow. Task 5's Setup test asserts that all players are human, and the existing GameBoard reveal-gate tests stay green unchanged.

---

## File Structure

| File | Responsibility |
|---|---|
| `projects/bots/tsconfig.json` (new) | TS config for the bots lib (like sim's) |
| `projects/bots/src/public-api.ts` (new) | Exports `random`, `policy`, `rule-based` |
| `projects/bots/src/lib/random.ts` (moved from `projects/sim/src/bot.ts`) | `seatToAct`, `pickRandomAction` |
| `projects/bots/src/lib/random.spec.ts` (moved from `projects/sim/src/bot.spec.ts`) | Its tests |
| `projects/bots/src/lib/policy.ts` (new) | `BotPolicy`, `BotTurnMemory`, `BotDecision`, `MAX_BOT_ACTIONS_PER_TURN` |
| `projects/bots/src/lib/rule-based.ts` (+ spec) (new) | `ruleBasedPolicy` |
| `tsconfig.json`, `jest.config.js` | `bots` path alias and Jest project/mappers |
| `projects/sim/src/runGame.ts`, `property.spec.ts` | Use `bots`; a rule-based run |
| `projects/app/src/app/game.service.ts` (+ spec) | Mode, human/bot players, bot loop |
| `projects/app/src/app/setup/setup.ts` (+ spec) | Mode toggle |
| `projects/app/src/app/game-board/game-board.ts` (+ spec) | No gate in vs-bots, choosing card, viewer = human |
| `projects/app/src/app/game-board/round-table.ts` (+ spec), `seat-tile.ts` (+ spec) | Thinking indicator, bot icon |

---

### Task 1: `bots` library with the random picker moved from sim

**Files:**
- Create: `projects/bots/tsconfig.json`, `projects/bots/src/public-api.ts`
- Move: `projects/sim/src/bot.ts` → `projects/bots/src/lib/random.ts`; `projects/sim/src/bot.spec.ts` → `projects/bots/src/lib/random.spec.ts`
- Modify: `tsconfig.json`, `jest.config.js`, `projects/sim/src/runGame.ts`

**Interfaces:**
- Produces: package alias `bots`, exporting `seatToAct(state): string | null` and `pickRandomAction(state, rng, registry): { action; rng }` (unchanged signatures).

- [ ] **Step 1: Move the files with history**

```bash
mkdir -p projects/bots/src/lib
git mv projects/sim/src/bot.ts projects/bots/src/lib/random.ts
git mv projects/sim/src/bot.spec.ts projects/bots/src/lib/random.spec.ts
```

In `projects/bots/src/lib/random.spec.ts`, change the first line to `import { seatToAct, pickRandomAction } from './random';`.

- [ ] **Step 2: Add the project config and public API**

Create `projects/bots/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "types": ["node", "jest"]
  },
  "include": ["src/**/*.ts"]
}
```

Create `projects/bots/src/public-api.ts`:

```ts
/*
 * Public API Surface of bots — framework-free computer opponents.
 */
export * from './lib/random';
```

In `tsconfig.json` `compilerOptions.paths`, add `"bots": ["./projects/bots/src/public-api.ts"]`.

In `jest.config.js`, add this project after `sim`:

```js
    {
      displayName: 'bots',
      preset: 'ts-jest',
      testEnvironment: 'node',
      rootDir: 'projects/bots/src',
      testMatch: ['**/*.spec.ts'],
      moduleNameMapper: {
        '^engine$': '<rootDir>/../../engine/src/public-api.ts',
        '^content$': '<rootDir>/../../content/src/public-api.ts',
      },
    },
```

Also add `'^bots$': '<rootDir>/../../bots/src/public-api.ts'` to the `sim` project's `moduleNameMapper`, and `'^bots$': '<rootDir>/../bots/src/public-api.ts'` to the `app` project's.

- [ ] **Step 3: Point the sim at the library**

In `projects/sim/src/runGame.ts`, change `import { pickRandomAction } from './bot';` to `import { pickRandomAction } from 'bots';`.

- [ ] **Step 4: Run the bots and sim suites and their type checks**

Run: `npx jest --selectProjects bots sim && npx tsc -p projects/bots/tsconfig.json --noEmit && npx tsc -p projects/sim/tsconfig.json --noEmit`
Expected: bots has 1 suite (the moved random tests) and sim has the remaining suites, all PASS, with no type errors.

- [ ] **Step 5: Commit**

```bash
git add projects/bots projects/sim/src tsconfig.json jest.config.js
git commit -m "refactor(bots): move the random-legal-move bot into a new bots library

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Rule-based policy

**Files:**
- Create: `projects/bots/src/lib/policy.ts`, `projects/bots/src/lib/rule-based.ts`, `projects/bots/src/lib/rule-based.spec.ts`
- Modify: `projects/bots/src/public-api.ts`

**Interfaces:**
- Consumes: `Action`, `ContentRegistry`, `GameState`, `Seat` from `engine`.
- Produces:
  - `interface BotTurnMemory { turnNumber: number; shaPlayed: number; actionsThisTurn: number }`
  - `interface BotDecision { action: Action; memory: BotTurnMemory }`
  - `interface BotPolicy { readonly id: string; decide(view, seatId, legal, registry, memory: BotTurnMemory | null): BotDecision }`
  - `const MAX_BOT_ACTIONS_PER_TURN = 30`
  - `const ruleBasedPolicy: BotPolicy` (with id `'rule-based'`)

- [ ] **Step 1: Write the failing tests**

Create `projects/bots/src/lib/rule-based.spec.ts`:

```ts
import type { Action, CardDefinition, ContentRegistry, GameState, GeneralDefinition, Kingdom, Seat } from 'engine';
import { ruleBasedPolicy } from './rule-based';
import { MAX_BOT_ACTIONS_PER_TURN } from './policy';

function general(id: string, kingdom: Kingdom, maxHp: number): [string, GeneralDefinition] {
  return [id, { id, kingdom, maxHp, skills: [] }];
}
function card(id: string, category: CardDefinition['category']): [string, CardDefinition] {
  return [id, { id, name: id, category, play: () => [] }];
}

const registry: ContentRegistry = {
  generals: new Map([general('w1', 'Wei', 4), general('w2', 'Wei', 3), general('s1', 'Shu', 4), general('s2', 'Shu', 5)]),
  cards: new Map([
    card('sha', 'basic'), card('shan', 'basic'), card('peach', 'basic'),
    card('duel', 'trick'), card('wuxie', 'trick'), card('blade', 'equipment'),
  ]),
};

function seat(id: string, index: number, kingdom: Kingdom, combinedHp = 4, eliminated = false): Seat {
  return {
    id, index, kingdom, combinedHp, maxCombinedHp: 8, eliminated,
    generals: { main: { generalDefinitionId: 'w1', revealed: false }, deputy: { generalDefinitionId: 'w2', revealed: false } },
    hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` },
  };
}

interface ViewOptions {
  phase?: GameState['phase'];
  seats?: Seat[];
  hand?: { instanceId: string; definitionId: string }[];
  equip?: string[];
  pendingFor?: string;
  turnNumber?: number;
}

// seat-0 is the bot. Its own hand and equipment are visible; the rest is redacted.
function view(o: ViewOptions = {}): GameState {
  const seats = o.seats ?? [seat('seat-0', 0, 'Wei', 8), seat('seat-1', 1, 'hidden', 6), seat('seat-2', 2, 'hidden', 3)];
  return {
    seats,
    players: [],
    turn: { turnNumber: o.turnNumber ?? 1, ownerSeatId: 'seat-0', extraTurnStack: [] },
    phase: o.phase ?? 'Play',
    zones: [
      { id: 'seat-0:hand', kind: 'hand', ownerSeatId: 'seat-0', cards: (o.hand ?? []).map((c) => ({ ...c, suit: 'spade' as const, rank: 1 })) },
      { id: 'seat-0:equip', kind: 'equip', ownerSeatId: 'seat-0', cards: (o.equip ?? []).map((d, i) => ({ instanceId: `eq-${i}`, definitionId: d, suit: 'club' as const, rank: 2 })) },
    ],
    pendingResponse: o.pendingFor
      ? { id: 'r1', respondingSeatId: o.pendingFor, allowedActionKinds: ['RespondAction', 'PassAction'], context: { effect: { kind: 'HealEffect', target: { kind: 'seat', seatId: 'seat-0' }, amount: 1 } } }
      : null,
    log: [],
    rng: { seed: 1, counter: 0 },
    result: null,
    generalSelection: null,
  };
}

const end: Action = { kind: 'EndPhaseAction', seatId: 'seat-0' };
const play = (instanceId: string, target?: string): Action => ({
  kind: 'PlayCardAction', seatId: 'seat-0', cardInstanceId: instanceId, targets: target ? [{ kind: 'seat', seatId: target }] : [],
});
const decide = (v: GameState, legal: Action[], memory = null as Parameters<typeof ruleBasedPolicy.decide>[4]) =>
  ruleBasedPolicy.decide(v, 'seat-0', legal, registry, memory);

describe('ruleBasedPolicy', () => {
  it('has the id "rule-based"', () => {
    expect(ruleBasedPolicy.id).toBe('rule-based');
  });

  it('throws when there is no legal action', () => {
    expect(() => decide(view(), [])).toThrow(/no legal action/);
  });

  it('picks the same-kingdom pair with the highest combined max HP, first on ties', () => {
    const choose = (mainId: string, deputyId: string): Action => ({ kind: 'ChooseGeneralsAction', seatId: 'seat-0', mainId, deputyId });
    const legal = [choose('w1', 'w2'), choose('s1', 's2'), choose('s2', 's1')];
    expect(decide(view({ phase: 'GeneralSelection' }), legal).action).toBe(legal[1]);
  });

  it('responds when a response card is legal, and passes otherwise', () => {
    const respond: Action = { kind: 'RespondAction', seatId: 'seat-0', pendingResponseId: 'r1', cardInstanceId: 'c-shan' };
    const pass: Action = { kind: 'PassAction', seatId: 'seat-0', pendingResponseId: 'r1' };
    expect(decide(view({ pendingFor: 'seat-0' }), [pass, respond]).action).toBe(respond);
    expect(decide(view({ pendingFor: 'seat-0' }), [pass]).action).toBe(pass);
  });

  it('ends the phase outside the Play phase', () => {
    const legal = [play('c-sha', 'seat-1'), end];
    expect(decide(view({ phase: 'Draw', hand: [{ instanceId: 'c-sha', definitionId: 'sha' }] }), legal).action).toBe(end);
  });

  it('ends the phase once the per-turn safety cap is reached', () => {
    const legal = [play('c-sha', 'seat-1'), end];
    const memory = { turnNumber: 1, shaPlayed: 0, actionsThisTurn: MAX_BOT_ACTIONS_PER_TURN };
    expect(decide(view({ hand: [{ instanceId: 'c-sha', definitionId: 'sha' }] }), legal, memory).action).toBe(end);
  });

  it('plays Peach only when hurt', () => {
    const hand = [{ instanceId: 'c-peach', definitionId: 'peach' }];
    const legal = [play('c-peach'), end];
    const hurt = view({ hand, seats: [seat('seat-0', 0, 'Wei', 5), seat('seat-1', 1, 'hidden')] });
    const full = view({ hand, seats: [seat('seat-0', 0, 'Wei', 8), seat('seat-1', 1, 'hidden')] });
    expect(decide(hurt, legal).action).toBe(legal[0]);
    expect(decide(full, legal).action).toBe(end);
  });

  it('equips equipment it does not already have', () => {
    const hand = [{ instanceId: 'c-blade', definitionId: 'blade' }];
    const legal = [play('c-blade'), end];
    expect(decide(view({ hand }), legal).action).toBe(legal[0]);
    expect(decide(view({ hand, equip: ['blade'] }), legal).action).toBe(end);
  });

  it('plays one Sha per turn, at the lowest-HP non-ally, never untargeted', () => {
    const hand = [{ instanceId: 'c-sha', definitionId: 'sha' }];
    const legal = [play('c-sha'), play('c-sha', 'seat-1'), play('c-sha', 'seat-2'), end];
    const first = decide(view({ hand }), legal);
    expect(first.action).toBe(legal[2]); // seat-2 has 3 HP, seat-1 has 6
    expect(first.memory.shaPlayed).toBe(1);
    expect(decide(view({ hand }), legal, first.memory).action).toBe(end);
  });

  it('never targets a seat with the same revealed kingdom, but Qun has no allies', () => {
    const hand = [{ instanceId: 'c-sha', definitionId: 'sha' }];
    const legal = [play('c-sha', 'seat-1'), end];
    const allies = [seat('seat-0', 0, 'Wei', 8), seat('seat-1', 1, 'Wei', 2)];
    expect(decide(view({ hand, seats: allies }), legal).action).toBe(end);
    const qun = [seat('seat-0', 0, 'Qun', 8), seat('seat-1', 1, 'Qun', 2)];
    expect(decide(view({ hand, seats: qun }), legal).action).toBe(legal[0]);
  });

  it('ignores eliminated seats as targets', () => {
    const hand = [{ instanceId: 'c-sha', definitionId: 'sha' }];
    const legal = [play('c-sha', 'seat-1'), play('c-sha', 'seat-2'), end];
    const seats = [seat('seat-0', 0, 'Wei', 8), seat('seat-1', 1, 'hidden', 6), seat('seat-2', 2, 'hidden', 1, true)];
    expect(decide(view({ hand, seats }), legal).action).toBe(legal[0]);
  });

  it('duels a non-ally once its Sha is spent', () => {
    const hand = [{ instanceId: 'c-sha', definitionId: 'sha' }, { instanceId: 'c-duel', definitionId: 'duel' }];
    const legal = [play('c-sha', 'seat-1'), play('c-duel', 'seat-1'), end];
    const memory = { turnNumber: 1, shaPlayed: 1, actionsThisTurn: 1 };
    expect(decide(view({ hand }), legal, memory).action).toBe(legal[1]);
  });

  it('resets its turn memory on a new turn', () => {
    const hand = [{ instanceId: 'c-sha', definitionId: 'sha' }];
    const legal = [play('c-sha', 'seat-1'), end];
    const stale = { turnNumber: 1, shaPlayed: 1, actionsThisTurn: MAX_BOT_ACTIONS_PER_TURN };
    const next = decide(view({ hand, turnNumber: 2 }), legal, stale);
    expect(next.action).toBe(legal[0]);
    expect(next.memory).toEqual({ turnNumber: 2, shaPlayed: 1, actionsThisTurn: 1 });
  });

  it('falls back to the first legal action for an action shape it does not know', () => {
    const reveal: Action = { kind: 'RevealGeneralAction', seatId: 'seat-0', slot: 'main' };
    expect(decide(view(), [reveal]).action).toBe(reveal);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx jest projects/bots/src/lib/rule-based.spec.ts`
Expected: FAIL with `Cannot find module './rule-based'`.

- [ ] **Step 3: Implement the policy**

Create `projects/bots/src/lib/policy.ts`:

```ts
import type { Action, ContentRegistry, GameState } from 'engine';

// A bot may take at most this many actions in one turn before it ends its phase.
export const MAX_BOT_ACTIONS_PER_TURN = 30;

export interface BotTurnMemory {
  turnNumber: number;
  shaPlayed: number;
  actionsThisTurn: number;
}

export interface BotDecision {
  action: Action;
  memory: BotTurnMemory;
}

export interface BotPolicy {
  readonly id: string;
  // `view` is the bot seat's redacted view; `legal` is the engine's legal
  // actions for that seat. The returned action is always one of `legal`.
  decide(view: GameState, seatId: string, legal: Action[], registry: ContentRegistry, memory: BotTurnMemory | null): BotDecision;
}
```

Create `projects/bots/src/lib/rule-based.ts`:

```ts
import type { Action, ContentRegistry, GameState, Seat } from 'engine';
import { BotDecision, BotPolicy, BotTurnMemory, MAX_BOT_ACTIONS_PER_TURN } from './policy';

type ChooseGenerals = Extract<Action, { kind: 'ChooseGeneralsAction' }>;
type PlayCard = Extract<Action, { kind: 'PlayCardAction' }>;

function definitionIdOf(view: GameState, cardInstanceId: string): string | undefined {
  for (const zone of view.zones) {
    const found = zone.cards.find((c) => c.instanceId === cardInstanceId);
    if (found) return found.definitionId;
  }
  return undefined;
}

// An ally shares the bot's own (known) kingdom and has revealed it. Qun is
// allied with no one; a hidden kingdom could be anyone, so it is not an ally.
function isAlly(self: Seat, other: Seat): boolean {
  return self.kingdom !== 'Qun' && self.kingdom !== 'hidden' && other.kingdom === self.kingdom;
}

// Plays of `definitionId` aimed at a living non-ally, weakest target first.
function targetedPlays(view: GameState, self: Seat, plays: PlayCard[], definitionId: string): PlayCard[] {
  return plays
    .filter((p) => p.targets.length === 1 && p.targets[0].kind === 'seat' && definitionIdOf(view, p.cardInstanceId) === definitionId)
    .map((p) => ({ play: p, target: view.seats.find((s) => p.targets[0].kind === 'seat' && s.id === p.targets[0].seatId) }))
    .filter((t): t is { play: PlayCard; target: Seat } => !!t.target && !t.target.eliminated && !isAlly(self, t.target))
    .sort((a, b) => a.target.combinedHp - b.target.combinedHp || a.target.index - b.target.index)
    .map((t) => t.play);
}

function decide(
  view: GameState,
  seatId: string,
  legal: Action[],
  registry: ContentRegistry,
  memory: BotTurnMemory | null
): BotDecision {
  if (legal.length === 0) throw new Error(`Bot ${seatId} has no legal action`);
  const mem: BotTurnMemory =
    memory && memory.turnNumber === view.turn.turnNumber
      ? memory
      : { turnNumber: view.turn.turnNumber, shaPlayed: 0, actionsThisTurn: 0 };
  const take = (action: Action, shaPlayed = 0): BotDecision => ({
    action,
    memory: { ...mem, shaPlayed: mem.shaPlayed + shaPlayed, actionsThisTurn: mem.actionsThisTurn + 1 },
  });

  // 1. General selection: highest combined max HP, first on ties.
  if (view.phase === 'GeneralSelection') {
    const choices = legal.filter((a): a is ChooseGenerals => a.kind === 'ChooseGeneralsAction');
    const hp = (a: ChooseGenerals) =>
      (registry.generals.get(a.mainId)?.maxHp ?? 0) + (registry.generals.get(a.deputyId)?.maxHp ?? 0);
    if (choices.length > 0) return take(choices.reduce((best, a) => (hp(a) > hp(best) ? a : best)));
  }

  // 2. Responding: every response the engine offers cancels damage to us.
  if (view.pendingResponse?.respondingSeatId === seatId) {
    const answer = legal.find((a) => a.kind === 'RespondAction') ?? legal.find((a) => a.kind === 'PassAction');
    if (answer) return take(answer);
  }

  const endPhase = legal.find((a) => a.kind === 'EndPhaseAction');
  // 3. Safety cap.
  if (endPhase && mem.actionsThisTurn >= MAX_BOT_ACTIONS_PER_TURN) return take(endPhase);
  // 4. Nothing to do outside the Play phase.
  if (view.phase !== 'Play' && endPhase) return take(endPhase);

  // 5. Play phase.
  const self = view.seats.find((s) => s.id === seatId);
  if (view.phase === 'Play' && self) {
    const plays = legal.filter((a): a is PlayCard => a.kind === 'PlayCardAction');
    const untargeted = (p: PlayCard) => p.targets.length === 0;
    const equipped = view.zones.find((z) => z.id === self.equipped.zoneId)?.cards.map((c) => c.definitionId) ?? [];

    const peach = plays.find((p) => untargeted(p) && definitionIdOf(view, p.cardInstanceId) === 'peach');
    if (peach && self.combinedHp < self.maxCombinedHp) return take(peach);

    const equipment = plays.find((p) => {
      const definitionId = definitionIdOf(view, p.cardInstanceId);
      return untargeted(p) && !!definitionId && registry.cards.get(definitionId)?.category === 'equipment' && !equipped.includes(definitionId);
    });
    if (equipment) return take(equipment);

    if (mem.shaPlayed === 0) {
      const [sha] = targetedPlays(view, self, plays, 'sha');
      if (sha) return take(sha, 1);
    }
    const [duel] = targetedPlays(view, self, plays, 'duel');
    if (duel) return take(duel);
    if (endPhase) return take(endPhase);
  }

  // 6. Fallback: never stall.
  return take(endPhase ?? legal.find((a) => a.kind === 'PassAction') ?? legal[0]);
}

// Simple, explainable opponent; see the bot-opponents design spec for its rules.
export const ruleBasedPolicy: BotPolicy = { id: 'rule-based', decide };
```

Add these lines to `projects/bots/src/public-api.ts`:

```ts
export * from './lib/policy';
export * from './lib/rule-based';
```

- [ ] **Step 4: Run the tests and the type check**

Run: `npx jest --selectProjects bots && npx tsc -p projects/bots/tsconfig.json --noEmit`
Expected: all PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add projects/bots/src
git commit -m "feat(bots): add a rule-based bot policy

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Sim runs rule-based bots too

**Files:**
- Modify: `projects/sim/src/runGame.ts`, `projects/sim/src/property.spec.ts`, `projects/sim/src/runGame.spec.ts`

**Interfaces:**
- Consumes: `pickRandomAction` and `ruleBasedPolicy` / `BotTurnMemory` from `bots`.
- Produces: `type BotKind = 'random' | 'rule-based'`, and `runGame(initialState, ctx, botRngSeed, maxActions = 2000, botKind: BotKind = 'random'): RunGameResult`.

- [ ] **Step 1: Write the failing test**

Append to `projects/sim/src/runGame.spec.ts`:

```ts
describe('runGame with rule-based bots', () => {
  it('drives a game to a result using the rule-based policy for every seat', () => {
    const registry = buildContentRegistry();
    const initialState = createGame(kingdomWarMode, registry, ['seat-a', 'seat-b', 'seat-c'], 123);
    const { finalState } = runGame(initialState, { registry, mode: kingdomWarMode }, 456, 20000, 'rule-based');
    expect(finalState.result).not.toBeNull();
  });
});
```

Run: `npx jest projects/sim/src/runGame.spec.ts`
Expected: FAIL. ts-jest reports `Expected 3-4 arguments, but got 5`, or the game plays with random bots and the assertion still passes. If it passes, confirm the failure in Step 3's property test instead.

- [ ] **Step 2: Implement the bot kind in `runGame`**

Replace `projects/sim/src/runGame.ts` with:

```ts
import { resolve, createRng, getActiveSeatId, getLegalActions, redactStateForSeat } from 'engine';
import type { Action, GameState, EngineContext } from 'engine';
import { pickRandomAction, ruleBasedPolicy } from 'bots';
import type { BotTurnMemory } from 'bots';

export type BotKind = 'random' | 'rule-based';

export interface RunGameResult {
  finalState: GameState;
  actionsSubmitted: number;
}

export function runGame(
  initialState: GameState,
  ctx: EngineContext,
  botRngSeed: number,
  maxActions = 2000,
  botKind: BotKind = 'random'
): RunGameResult {
  let state = initialState;
  let botRng = createRng(botRngSeed);
  const memories = new Map<string, BotTurnMemory>();
  let actionsSubmitted = 0;
  while (!state.result && actionsSubmitted < maxActions) {
    let action: Action;
    if (botKind === 'random') {
      const picked = pickRandomAction(state, botRng, ctx.registry);
      botRng = picked.rng;
      action = picked.action;
    } else {
      const seatId = getActiveSeatId(state);
      if (seatId === null) throw new Error('No seat is able to act');
      const legal = getLegalActions(state, seatId, ctx.registry);
      const decision = ruleBasedPolicy.decide(redactStateForSeat(state, seatId), seatId, legal, ctx.registry, memories.get(seatId) ?? null);
      memories.set(seatId, decision.memory);
      action = decision.action;
    }
    state = resolve(state, action, ctx).state;
    actionsSubmitted++;
  }
  return { finalState: state, actionsSubmitted };
}
```

- [ ] **Step 3: Add the rule-based property run**

In `projects/sim/src/property.spec.ts`, wrap the existing game loop body so that each seed runs twice: once with `runGame(initialState, ctx, seed * 7 + 1, 2000)` (random, as today), and once with `runGame(initialState, ctx, seed * 7 + 1, 20000, 'rule-based')`. Use a label suffix ` [random]` / ` [rule-based]` in the failure messages. Keep the same assertions for both (invariants with registry, termination, no dangling pendingResponse, JSON round-trip). The concrete edit replaces the single `runGame(...)` call and the checks after it with:

```ts
        for (const [botKind, maxActions] of [['random', 2000], ['rule-based', 20000]] as const) {
          const { finalState, actionsSubmitted } = runGame(
            initialState,
            { registry, mode: kingdomWarMode },
            seed * 7 + 1,
            maxActions,
            botKind
          );
          const label = `seed ${seed} (${numSeats} seats) [${botKind}]`;
          const violations = checkInvariants(finalState, registry);
          if (violations.length > 0) failures.push(`${label}: ${violations.join('; ')}`);
          if (!finalState.result) failures.push(`${label}: did not terminate within ${actionsSubmitted} actions`);
          if (finalState.result && finalState.pendingResponse) {
            failures.push(`${label}: game ended with a dangling pendingResponse`);
          }
          const roundTripped = JSON.parse(JSON.stringify(finalState));
          if (JSON.stringify(roundTripped) !== JSON.stringify(finalState)) {
            failures.push(`${label}: final GameState did not survive a JSON round-trip (Serializability invariant broken)`);
          }
        }
```

Raise the test timeout from `60000` to `180000`, and update its comment to say it now drives about 120 games.

- [ ] **Step 4: Run the sim suite and its type check**

Run: `npx jest --selectProjects sim && npx tsc -p projects/sim/tsconfig.json --noEmit`
Expected: all PASS. If any rule-based seed reports "did not terminate", do NOT raise the cap further or weaken the test. Report it as BLOCKED with the seed and seat count.

- [ ] **Step 5: Commit**

```bash
git add projects/sim/src
git commit -m "test(sim): run every property seed with rule-based bots as well as random ones

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: `GameService` vs-bots orchestration

**Files:**
- Modify: `projects/app/src/app/game.service.ts`, `projects/app/src/app/game.service.spec.ts`

**Interfaces:**
- Consumes: `ruleBasedPolicy` and `BotTurnMemory` from `bots`.
- Produces (on `GameService`):
  - `export type GameMode = 'vs-bots' | 'pass-and-play'`
  - `export const HUMAN_SEAT_ID = 'seat-0'`
  - `mode: Signal<GameMode>`
  - `humanSeatId: Signal<string | null>`
  - `botThinkingSeatId: Signal<string | null>`
  - `botSeatIds: Signal<string[]>`
  - `botDelayMs: number` (default 700)
  - `startGame(seatCount: number, seed?: number, mode: GameMode = 'pass-and-play'): void`

- [ ] **Step 1: Write the failing tests**

Append to `projects/app/src/app/game.service.spec.ts`:

```ts
describe('GameService in vs-bots mode', () => {
  let service: GameService;

  beforeEach(() => {
    jest.useFakeTimers();
    service = new GameService();
    service.botDelayMs = 0;
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  // Run pending bot moves until a human is to act (or the game ends).
  function flushBots(): void {
    for (let guard = 0; service.botThinkingSeatId() && guard < 50000; guard++) jest.runOnlyPendingTimers();
  }

  it('marks seat-0 human and every other seat a bot, and shows seat-0’s view without a gate', () => {
    service.startGame(3, 1, 'vs-bots');
    expect(service.mode()).toBe('vs-bots');
    expect(service.state()!.players.map((p) => p.kind)).toEqual(['human', 'bot', 'bot']);
    expect(service.humanSeatId()).toBe('seat-0');
    expect(service.botSeatIds()).toEqual(['seat-1', 'seat-2']);
    expect(service.revealedSeatId()).toBe('seat-0');
    expect(service.visibleState()).not.toBeNull();
  });

  it('lets the human choose first, then the bots choose and play until the human must act', () => {
    service.startGame(3, 1, 'vs-bots');
    expect(service.activeSeatId()).toBe('seat-0');
    expect(service.botThinkingSeatId()).toBeNull();
    service.submit(service.legalActions()[0]);
    expect(service.botThinkingSeatId()).toBe('seat-1');
    expect(service.legalActions()).toEqual([]); // Review Focus 4
    flushBots();
    const state = service.state()!;
    expect(state.phase).not.toBe('GeneralSelection');
    expect(state.seats.every((s) => s.generals !== null)).toBe(true);
    expect(state.result !== null || service.activeSeatId() === 'seat-0').toBe(true);
  });

  it('waits botDelayMs before each bot move', () => {
    service.botDelayMs = 700;
    service.startGame(3, 1, 'vs-bots');
    service.submit(service.legalActions()[0]);
    jest.advanceTimersByTime(699);
    expect(service.state()!.seats[1].generals).toBeNull();
    jest.advanceTimersByTime(1);
    expect(service.state()!.seats[1].generals).not.toBeNull();
  });

  it('hands a bot’s Sha to the human to answer', () => {
    service.startGame(2, 1, 'vs-bots');
    let answered = false;
    for (let step = 0; step < 5000 && !service.state()!.result && !answered; step++) {
      if (service.botThinkingSeatId()) { jest.runOnlyPendingTimers(); continue; }
      const pending = service.state()!.pendingResponse;
      if (pending?.respondingSeatId === 'seat-0') {
        expect(service.legalActions().some((a) => a.kind === 'PassAction')).toBe(true);
        answered = true;
        break;
      }
      const legal = service.legalActions();
      service.submit(legal.find((a) => a.kind === 'EndPhaseAction') ?? legal[0]);
    }
    expect(answered).toBe(true);
  });

  it('plays on to a result even if the human only ends phases and passes, then stops (Review Focus 1)', () => {
    service.startGame(3, 2, 'vs-bots');
    for (let step = 0; step < 200000 && !service.state()!.result; step++) {
      if (service.botThinkingSeatId()) { jest.runOnlyPendingTimers(); continue; }
      const legal = service.legalActions();
      service.submit(legal.find((a) => a.kind === 'EndPhaseAction' || a.kind === 'PassAction') ?? legal[0]);
    }
    expect(service.state()!.result).not.toBeNull();
    expect(service.botThinkingSeatId()).toBeNull();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('cancels a pending bot move when a new game starts (Review Focus 2)', () => {
    service.startGame(3, 1, 'vs-bots');
    service.submit(service.legalActions()[0]);
    expect(jest.getTimerCount()).toBe(1);
    service.startGame(2, 5, 'pass-and-play');
    expect(jest.getTimerCount()).toBe(0);
    expect(service.botThinkingSeatId()).toBeNull();
  });

  it('stops the bots and reports the error when a bot move throws (Review Focus 3)', () => {
    service.startGame(3, 1, 'vs-bots');
    jest.spyOn(ruleBasedPolicy, 'decide').mockImplementation(() => {
      throw new Error('bot exploded');
    });
    service.submit(service.legalActions()[0]);
    jest.runOnlyPendingTimers();
    expect(service.lastError()).toContain('bot exploded');
    expect(service.botThinkingSeatId()).toBeNull();
    expect(jest.getTimerCount()).toBe(0);
  });
});

describe('GameService in pass-and-play mode', () => {
  it('is the default: every player is human and no bot timer runs', () => {
    jest.useFakeTimers();
    const service = new GameService();
    service.startGame(2, 1);
    expect(service.mode()).toBe('pass-and-play');
    expect(service.state()!.players.every((p) => p.kind === 'human')).toBe(true);
    expect(service.humanSeatId()).toBeNull();
    expect(service.revealedSeatId()).toBeNull();
    service.submit(service.legalActions()[0]);
    expect(jest.getTimerCount()).toBe(0);
    jest.useRealTimers();
  });
});
```

Add `import { ruleBasedPolicy } from 'bots';` at the top of the file.

Run: `npx jest projects/app/src/app/game.service.spec.ts`
Expected: FAIL. `startGame` ignores the third argument, and `mode` / `humanSeatId` / `botSeatIds` / `botThinkingSeatId` / `botDelayMs` are undefined.

- [ ] **Step 2: Implement the orchestration**

Replace `projects/app/src/app/game.service.ts` with:

```ts
import { Injectable, Signal, WritableSignal, computed, signal } from '@angular/core';
import {
  Action,
  ContentRegistry,
  EngineContext,
  GameState,
  createGame,
  getActiveSeatId,
  getLegalActions,
  redactStateForSeat,
  resolve,
} from 'engine';
import { buildContentRegistry, kingdomWarMaxSeats, kingdomWarMode } from 'content';
import { BotTurnMemory, ruleBasedPolicy } from 'bots';

export type GameMode = 'vs-bots' | 'pass-and-play';

// In vs-bots mode the one human always plays this seat.
export const HUMAN_SEAT_ID = 'seat-0';

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

@Injectable({ providedIn: 'root' })
export class GameService {
  readonly registry: ContentRegistry = buildContentRegistry();
  private readonly ctx: EngineContext = { registry: this.registry, mode: kingdomWarMode };

  readonly maxSeats: number = kingdomWarMaxSeats(this.registry);

  // Delay before each bot move, so a human can follow along. Tests set 0.
  botDelayMs = 700;

  private readonly _state: WritableSignal<GameState | null> = signal(null);
  private readonly _revealedSeatId: WritableSignal<string | null> = signal(null);
  private readonly _lastError: WritableSignal<string | null> = signal(null);
  private readonly _mode: WritableSignal<GameMode> = signal('pass-and-play');
  private readonly _botThinkingSeatId: WritableSignal<string | null> = signal(null);

  private botTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly botMemories = new Map<string, BotTurnMemory>();

  readonly state: Signal<GameState | null> = this._state.asReadonly();
  readonly revealedSeatId: Signal<string | null> = this._revealedSeatId.asReadonly();
  readonly lastError: Signal<string | null> = this._lastError.asReadonly();
  readonly mode: Signal<GameMode> = this._mode.asReadonly();
  readonly botThinkingSeatId: Signal<string | null> = this._botThinkingSeatId.asReadonly();

  readonly humanSeatId: Signal<string | null> = computed(() => (this._mode() === 'vs-bots' ? HUMAN_SEAT_ID : null));

  readonly botSeatIds: Signal<string[]> = computed(
    () => this._state()?.players.filter((p) => p.kind === 'bot').map((p) => p.seatId) ?? []
  );

  readonly activeSeatId: Signal<string | null> = computed(() => {
    const state = this._state();
    return state ? getActiveSeatId(state) : null;
  });

  // Only the human's moves are offered to the UI; bots decide for themselves.
  readonly legalActions: Signal<Action[]> = computed(() => {
    const state = this._state();
    const seatId = this.activeSeatId();
    if (!state || !seatId || this.botSeatIds().includes(seatId)) return [];
    return getLegalActions(state, seatId, this.registry);
  });

  readonly visibleState: Signal<GameState | null> = computed(() => {
    const state = this._state();
    const seatId = this._revealedSeatId();
    if (!state || !seatId) return null;
    return redactStateForSeat(state, seatId);
  });

  startGame(seatCount: number, seed?: number, mode: GameMode = 'pass-and-play'): void {
    this.cancelBotTimer();
    this.botMemories.clear();
    this._mode.set(mode);
    const seatIds = Array.from({ length: seatCount }, (_, i) => `seat-${i}`);
    const rngSeed = seed ?? Math.floor(Math.random() * 2 ** 31);
    try {
      const created = createGame(kingdomWarMode, this.registry, seatIds, rngSeed);
      const players = created.players.map((p) => ({
        ...p,
        kind: mode === 'vs-bots' && p.seatId !== HUMAN_SEAT_ID ? ('bot' as const) : ('human' as const),
      }));
      this._state.set({ ...created, players });
      this._revealedSeatId.set(this.humanSeatId());
      this._lastError.set(null);
    } catch (err) {
      this._state.set(null);
      this._revealedSeatId.set(null);
      this._lastError.set(errorMessage(err));
    }
    this.scheduleBotIfDue();
  }

  reveal(seatId: string): void {
    this._revealedSeatId.set(seatId);
  }

  submit(action: Action): void {
    if (this.apply(action)) this.scheduleBotIfDue();
  }

  clearError(): void {
    this._lastError.set(null);
  }

  // Resolves one action; on success the next view is gated again in
  // pass-and-play, and stays on the human's seat in vs-bots.
  private apply(action: Action): boolean {
    const state = this._state();
    if (!state) return false;
    try {
      this._state.set(resolve(state, action, this.ctx).state);
      this._revealedSeatId.set(this.humanSeatId());
      this._lastError.set(null);
      return true;
    } catch (err) {
      this._lastError.set(errorMessage(err));
      return false;
    }
  }

  private scheduleBotIfDue(): void {
    this.cancelBotTimer();
    const state = this._state();
    const seatId = state && !state.result ? getActiveSeatId(state) : null;
    if (!seatId || !this.botSeatIds().includes(seatId)) {
      this._botThinkingSeatId.set(null);
      return;
    }
    this._botThinkingSeatId.set(seatId);
    this.botTimer = setTimeout(() => {
      this.botTimer = null;
      this.runBot(seatId);
    }, this.botDelayMs);
  }

  private runBot(seatId: string): void {
    const state = this._state();
    if (!state) return;
    let action: Action;
    try {
      const legal = getLegalActions(state, seatId, this.registry);
      const decision = ruleBasedPolicy.decide(
        redactStateForSeat(state, seatId),
        seatId,
        legal,
        this.registry,
        this.botMemories.get(seatId) ?? null
      );
      this.botMemories.set(seatId, decision.memory);
      action = decision.action;
    } catch (err) {
      this._lastError.set(errorMessage(err));
      this._botThinkingSeatId.set(null);
      return;
    }
    if (this.apply(action)) this.scheduleBotIfDue();
    else this._botThinkingSeatId.set(null);
  }

  private cancelBotTimer(): void {
    if (this.botTimer !== null) {
      clearTimeout(this.botTimer);
      this.botTimer = null;
    }
  }
}
```

- [ ] **Step 3: Run the app service tests and the type check**

Run: `npx jest projects/app/src/app/game.service.spec.ts && npx tsc -p projects/app/tsconfig.spec.json --noEmit`
Expected: all PASS (old and new tests), no type errors.

- [ ] **Step 4: Run the whole app suite**

Run: `npx jest --selectProjects app`
Expected: all PASS. Existing callers use the `'pass-and-play'` default, so their behaviour is unchanged.

- [ ] **Step 5: Commit**

```bash
git add projects/app/src/app/game.service.ts projects/app/src/app/game.service.spec.ts
git commit -m "feat(app): run rule-based bots for every non-human seat in vs-bots mode

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Setup mode toggle and board states for bots

**Files:**
- Modify: `projects/app/src/app/setup/setup.ts` (+ spec)
- Modify: `projects/app/src/app/game-board/game-board.ts` (+ spec)
- Modify: `projects/app/src/app/game-board/round-table.ts` (+ spec)
- Modify: `projects/app/src/app/game-board/seat-tile.ts` (+ spec)

**Interfaces:**
- Consumes: `GameMode`, `GameService.mode`, `humanSeatId`, `botThinkingSeatId`, `botSeatIds` and `botDelayMs` (Task 4).
- Produces:
  - `RoundTable` inputs `thinkingSeatId: string | null` (default `null`) and `botSeatIds: string[]` (default `[]`).
  - `SeatTile` input `isBot: boolean` (default `false`).
  - `Setup.mode: WritableSignal<GameMode>` (default `'vs-bots'`).

- [ ] **Step 1: Write the failing tests**

`projects/app/src/app/game-board/seat-tile.spec.ts`: add `isBot` to the `render` helper's options, setting `fixture.componentRef.setInput('isBot', opts.isBot ?? false);`. Then append:

```ts
  it('marks a bot seat with a robot icon', () => {
    expect(render(makeSeat(), { isBot: true }).querySelector('.bot-icon')).not.toBeNull();
    expect(render(makeSeat()).querySelector('.bot-icon')).toBeNull();
  });
```

`projects/app/src/app/game-board/round-table.spec.ts`: give the `render` helper two optional parameters, `thinkingSeatId: string | null = null` and `botSeatIds: string[] = []`, and set them as inputs. Then append:

```ts
  it('shows which seat is thinking, and marks bot seats', () => {
    const el = render(state(), 'seat-0', 'seat-1', ['seat-1', 'seat-2']);
    expect(el.querySelector('.centre .thinking')!.textContent).toContain('seat-1 is thinking');
    expect(tile(el, 'seat-1').querySelector('.bot-icon')).not.toBeNull();
    expect(tile(el, 'seat-0').querySelector('.bot-icon')).toBeNull();
  });

  it('shows no thinking line when nobody is thinking', () => {
    expect(render(state(), 'seat-0').querySelector('.centre .thinking')).toBeNull();
  });
```

The new `render` signature is `render(s: GameState, viewerSeatId = 'seat-1', thinkingSeatId: string | null = null, botSeatIds: string[] = [])`.

`projects/app/src/app/setup/setup.spec.ts`:
- At the top of the outer `describe('Setup', …)` add:

```ts
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });
```

- In "offers one seat toggle per legal table size", change the selector to `'.seats mat-button-toggle'`.
- Inside `describe('home screen controls', …)` append:

```ts
    it('defaults to playing against bots', async () => {
      const { el, gameService } = await create();
      (el.querySelector('button.start') as HTMLButtonElement).click();
      expect(gameService.mode()).toBe('vs-bots');
      expect(gameService.state()!.players[0].kind).toBe('human');
      expect(gameService.state()!.players.slice(1).every((p) => p.kind === 'bot')).toBe(true);
    });

    it('starts a pass-and-play game when that mode is picked (Review Focus 5)', async () => {
      const { fixture, el, gameService } = await create();
      const passAndPlay = [...el.querySelectorAll('.mode mat-button-toggle button')].find((b) =>
        b.textContent!.includes('Pass-and-play')
      ) as HTMLButtonElement;
      passAndPlay.click();
      fixture.detectChanges();
      expect(el.querySelector('.mode-hint')!.textContent).toContain('passing it between turns');
      (el.querySelector('button.start') as HTMLButtonElement).click();
      expect(gameService.mode()).toBe('pass-and-play');
      expect(gameService.state()!.players.every((p) => p.kind === 'human')).toBe(true);
    });
```

`projects/app/src/app/game-board/game-board.spec.ts`: append a new describe after the existing one (the existing tests use the pass-and-play default and stay unchanged):

```ts
describe('GameBoard in vs-bots mode', () => {
  let gameService: GameService;

  beforeEach(async () => {
    jest.useFakeTimers();
    await TestBed.configureTestingModule({
      imports: [GameBoard],
      providers: [provideRouter([{ path: 'setup', children: [] }])],
    }).compileComponents();
    gameService = TestBed.inject(GameService);
    gameService.botDelayMs = 0;
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  function flushBots(): void {
    for (let guard = 0; gameService.botThinkingSeatId() && guard < 50000; guard++) jest.runOnlyPendingTimers();
  }

  it('shows the human’s general selection straight away, with no reveal gate', () => {
    gameService.startGame(3, 1, 'vs-bots');
    const fixture = TestBed.createComponent(GameBoard);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-reveal-gate-overlay')).toBeNull();
    expect(el.querySelector('app-general-selection')).not.toBeNull();
  });

  it('shows a waiting card while the bots choose their generals', () => {
    gameService.startGame(3, 1, 'vs-bots');
    gameService.submit(gameService.legalActions()[0]);
    const fixture = TestBed.createComponent(GameBoard);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-general-selection')).toBeNull();
    expect(el.querySelector('.bots-choosing')!.textContent).toContain('Bots are choosing their generals');
  });

  it('keeps the table on seat-0 and shows the thinking bot during a bot turn', () => {
    gameService.startGame(3, 1, 'vs-bots');
    gameService.submit(gameService.legalActions()[0]);
    flushBots(); // through selection and any bot turns, to the human's first move
    const humanMove = gameService.legalActions().find((a) => a.kind === 'EndPhaseAction');
    expect(humanMove).toBeDefined();
    // Advance the human to the end of their turn, so a bot is next.
    for (let i = 0; i < 10 && !gameService.botThinkingSeatId() && !gameService.state()!.result; i++) {
      const legal = gameService.legalActions();
      gameService.submit(legal.find((a) => a.kind === 'EndPhaseAction' || a.kind === 'PassAction') ?? legal[0]);
    }
    expect(gameService.botThinkingSeatId()).not.toBeNull();
    const fixture = TestBed.createComponent(GameBoard);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-reveal-gate-overlay')).toBeNull();
    expect(el.querySelector('app-round-table [data-seat-id="seat-0"]')!.textContent).toContain('(you)');
    expect(el.querySelector('app-round-table .thinking')!.textContent).toContain('is thinking');
    // Nothing is playable while a bot acts (Review Focus 4).
    const playButtons = [...el.querySelectorAll('app-hand-view button.play')] as HTMLButtonElement[];
    expect(playButtons.every((b) => b.disabled)).toBe(true);
  });
});
```

Seeds in these tests (and in Task 4's) are arbitrary. If a seed happens to end the game during general selection, because every seat picked the same kingdom (a known engine rule), switch to another seed rather than changing assertions.

Run: `npx jest projects/app/src/app/setup projects/app/src/app/game-board`
Expected: FAIL on the new cases. There is no `.mode` toggle, no `.bots-choosing` card, no `.thinking` line and no `.bot-icon`, and the reveal gate still appears in vs-bots mode.

- [ ] **Step 2: Seat tile robot icon**

In `projects/app/src/app/game-board/seat-tile.ts`:
- Add `import { MatIconModule } from '@angular/material/icon';` and put `MatIconModule` in `imports`.
- Add the input `readonly isBot = input(false);`.
- In the header, after `<strong>{{ seat().id }}</strong>`, add:

```html
        @if (isBot()) {
          <mat-icon class="bot-icon" aria-label="Computer player">smart_toy</mat-icon>
        }
```

- Add the style `.bot-icon { font-size: 14px; width: 14px; height: 14px; vertical-align: middle; margin-left: 3px; color: #666; }`.

- [ ] **Step 3: Round table thinking line and bot inputs**

In `projects/app/src/app/game-board/round-table.ts`:
- Add `import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';` and put it in `imports`.
- Add the inputs `readonly thinkingSeatId = input<string | null>(null);` and `readonly botSeatIds = input<string[]>([]);`.
- In `.centre`, after the `@if (state().pendingResponse; …)` block, add:

```html
        @if (thinkingSeatId(); as thinking) {
          <div class="thinking"><mat-progress-spinner mode="indeterminate" diameter="14" /> {{ thinking }} is thinking…</div>
        }
```

- Pass `[isBot]="botSeatIds().includes(p.seat.id)"` to `<app-seat-tile>`.
- Add the style `.thinking { display: flex; align-items: center; justify-content: center; gap: 6px; color: #b1c5ff; --mdc-circular-progress-active-indicator-color: #b1c5ff; --mat-progress-spinner-active-indicator-color: #b1c5ff; }`.

- [ ] **Step 4: Setup mode toggle**

In `projects/app/src/app/setup/setup.ts`:
- Import `GameMode` from `'../game.service'`.
- Add the field `readonly mode = signal<GameMode>('vs-bots');`.
- Make `startGame` call `this.gameService.startGame(clamped, this.seed(), this.mode());`.
- Add `class="seats"` to the existing seat `mat-button-toggle-group`.
- Insert this before the seats `<div class="field">`:

```html
          <div class="field">
            <span class="label" id="mode-label">Mode</span>
            <mat-button-toggle-group
              class="mode"
              aria-labelledby="mode-label"
              [hideSingleSelectionIndicator]="true"
              [value]="mode()"
              (change)="mode.set($event.value)"
            >
              <mat-button-toggle value="vs-bots"><mat-icon>smart_toy</mat-icon> Play vs bots</mat-button-toggle>
              <mat-button-toggle value="pass-and-play"><mat-icon>groups</mat-icon> Pass-and-play</mat-button-toggle>
            </mat-button-toggle-group>
          </div>
          <p class="mode-hint">
            {{ mode() === 'vs-bots'
              ? 'You play seat-0; every other seat is a computer opponent.'
              : 'Everyone plays on this device, passing it between turns.' }}
          </p>
```

- Add the styles `.mode-hint { margin: -12px 0 16px; color: var(--mat-sys-on-surface-variant); font: var(--mat-sys-body-small); }` and `.mode mat-icon { margin-right: 4px; font-size: 18px; width: 18px; height: 18px; vertical-align: middle; }`.

- [ ] **Step 5: GameBoard: no gate in vs-bots, a waiting card, and the viewer is the human**

In `projects/app/src/app/game-board/game-board.ts`:
- Add `import { MatCardModule } from '@angular/material/card';` and `import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';`, and put both in `imports`.
- Add this computed member:

```ts
  // Whose chair the table is seen from: the human in vs-bots, else the revealed active seat.
  protected readonly viewerSeatId = computed(() => this.gameService.humanSeatId() ?? this.activeSeatId());
```

- In `ownHand`, replace `const seatId = this.activeSeatId();` with `const seatId = this.viewerSeatId();`.
- Replace the template block from `@if (gameService.revealedSeatId() !== activeSeatId) {` through the general-selection `@if`/`@else` opening with:

```html
        @if (gameService.humanSeatId() === null && gameService.revealedSeatId() !== activeSeatId) {
          <app-reveal-gate-overlay [seatId]="activeSeatId" (revealed)="gameService.reveal(activeSeatId)" />
        } @else if (visibleState(); as visible) {
          @if (visible.phase === 'GeneralSelection' && activeSeatId !== viewerSeatId()) {
            <mat-card appearance="outlined" class="bots-choosing">
              <mat-progress-spinner mode="indeterminate" diameter="28" />
              <span>Bots are choosing their generals…</span>
            </mat-card>
          } @else if (visible.phase === 'GeneralSelection') {
```

  The existing `<app-general-selection …/>` follows unchanged, then the existing `} @else {` board branch.
- In the board branch, change `[viewerSeatId]="activeSeatId"` to:

```html
[viewerSeatId]="viewerSeatId()!" [thinkingSeatId]="gameService.botThinkingSeatId()" [botSeatIds]="gameService.botSeatIds()"
```

- Add the style `.bots-choosing { display: flex; align-items: center; gap: 16px; padding: 24px; margin: 24px auto; max-width: 420px; }`.

- [ ] **Step 6: Run the app suite, the type check and the build**

Run: `npx jest --selectProjects app && npx tsc -p projects/app/tsconfig.spec.json --noEmit && npx ng build app`
Expected: all PASS, no type errors, and the build reports no warnings.

- [ ] **Step 7: Commit**

```bash
git add projects/app/src/app/setup projects/app/src/app/game-board
git commit -m "feat(app): play against bots from Setup, with a thinking indicator on the table

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 8: Run the full verification**

Run: `npx jest && npx tsc -p projects/engine/tsconfig.spec.json --noEmit && npx tsc -p projects/content/tsconfig.spec.json --noEmit && npx tsc -p projects/sim/tsconfig.json --noEmit && npx tsc -p projects/bots/tsconfig.json --noEmit && npx tsc -p projects/app/tsconfig.spec.json --noEmit && npx ng build app`
Expected: every Jest project passes, there are no type errors, and the build has no warnings. The controller does the browser click-through afterwards.
