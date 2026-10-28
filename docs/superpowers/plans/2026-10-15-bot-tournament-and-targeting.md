# Bot Tournament Harness and Smarter Targeting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Measure bot policies against each other over many seeded games, then use that to prove a smarter target-scoring rule beats the current "weakest non-ally" rule.

**Architecture:** `bots` gains a policy factory that takes a target ranker, so the old ordering (`rule-based-v1`) and the new score (`rule-based`) share every other rule. `sim` gains a per-seat policy option on `runGame`, a pure tournament module that pairs and scores games, and a CLI command. Nothing in `engine`, `app` or `server` changes.

**Tech Stack:** TypeScript (strict), Jest via ts-jest (`npx jest --selectProjects <name>`), `tsx` for the CLI.

**Spec:** `docs/superpowers/specs/2026-10-15-bot-tournament-and-targeting-design.md`

## Global Constraints

- `bots` and `sim` are plain TypeScript: no Angular, DOM or timers. Dependencies stay `engine ← content ← bots ← sim`.
- Bots only ever return one of the engine's legal actions; this plan does not change that.
- Strict TS with `noPropertyAccessFromIndexSignature`: read `Record<string, T>` entries with brackets (`map['key']`), never dot access.
- Existing `ruleBasedPolicy` must stay an object with a `decide` method: app specs use `jest.spyOn(ruleBasedPolicy, 'decide')`.
- The new `rule-based` is what the app and server use; `rule-based-v1` is only for comparison.
- Commit only the files named in each task (the working tree holds unrelated uncommitted changes from the user; never `git add -A`).
- Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Work on branch `feat/bot-tournament-targeting`.

## Review Focus

- An odd seat count cannot be paired fairly: `runTournament` throws (Task 3).
- A game that hits the action cap has no result: counted as unfinished, excluded from rates, never a crash or NaN (Task 3).
- `games: 0` or one finished game: the report has no NaN or Infinity (Task 3).
- A hand-built view with no `log` (older specs and some callers): `targetScore` treats it as empty (Task 5).
- Allies are never targets, whatever their score: the filter runs before ranking (Task 1 and Task 5).

## File Structure

| File | Responsibility |
|---|---|
| `projects/bots/src/lib/helpers.ts` (modify) | `TargetRanker` type, `weakestFirst` ranker, `fillPick` takes a ranker |
| `projects/bots/src/lib/rule-based.ts` (modify) | `createRuleBasedPolicy(id, rank)`; all target sorts use `rank` |
| `projects/bots/src/lib/policies.ts` (create) | registry of policies by id, `policyById` |
| `projects/bots/src/lib/targeting.ts` (create) | `targetScore` and its weights |
| `projects/bots/src/public-api.ts` (modify) | export `policies`, `targeting` |
| `projects/sim/src/runGame.ts` (modify) | `BOT_KINDS`, `parseBotKind`, per-seat `policyFor` |
| `projects/sim/src/tournament.ts` (create) | pairing, scoring, statistics, report text |
| `projects/sim/src/cli.ts` (modify) | `tournament` command |
| `package.json` (modify) | `sim` script |
| `docs/architecture/bots-and-simulation.md` (modify) | document the tournament |

---

### Task 1: Policy factory, ranker injection and `rule-based-v1`

A pure refactor: behaviour does not change, but target ordering becomes injectable and both policy ids exist.

**Files:**
- Modify: `projects/bots/src/lib/helpers.ts` (the `fillPick` function, end of file)
- Modify: `projects/bots/src/lib/rule-based.ts`
- Create: `projects/bots/src/lib/policies.ts`
- Create: `projects/bots/src/lib/policies.spec.ts`
- Modify: `projects/bots/src/public-api.ts`

**Interfaces:**
- Produces (helpers.ts):
  ```ts
  export type TargetRanker = (view: GameState, me: Seat, target: Seat) => number; // higher = better target
  export const weakestFirst: TargetRanker;
  export function fillPick<A extends { targets: Target[]; pickTargets?: TargetPick }>(view: GameState, me: Seat, action: A, rank: TargetRanker): A | null;
  ```
- Produces (rule-based.ts):
  ```ts
  export function createRuleBasedPolicy(id: string, rank: TargetRanker): BotPolicy;
  export const ruleBasedPolicy: BotPolicy;    // id 'rule-based'
  export const ruleBasedV1Policy: BotPolicy;  // id 'rule-based-v1'
  ```
- Produces (policies.ts):
  ```ts
  export const POLICY_IDS: readonly string[];
  export function policyById(id: string): BotPolicy; // throws naming the valid ids
  ```

- [ ] **Step 1: Write the failing test** — create `projects/bots/src/lib/policies.spec.ts`:

```ts
import { policyById, POLICY_IDS } from './policies';
import { ruleBasedPolicy, ruleBasedV1Policy } from './rule-based';
import { act, card, decide, table } from './testing';

describe('policy registry', () => {
  it('lists rule-based and rule-based-v1', () => {
    expect([...POLICY_IDS].sort()).toEqual(['rule-based', 'rule-based-v1']);
  });

  it('looks a policy up by id', () => {
    expect(policyById('rule-based')).toBe(ruleBasedPolicy);
    expect(policyById('rule-based-v1')).toBe(ruleBasedV1Policy);
  });

  it('names the valid ids when the id is unknown', () => {
    expect(() => policyById('nope')).toThrow(/Unknown bot policy "nope".*rule-based, rule-based-v1/);
  });
});

describe('rule-based-v1', () => {
  it('has the id "rule-based-v1" and aims a Sha at the weakest non-ally in reach', () => {
    expect(ruleBasedV1Policy.id).toBe('rule-based-v1');
    // seat-a (Wei) reaches seat-b and seat-d (adjacent); seat-d has the lower HP.
    const state = table({ 'seat-a:hand': [card('s1', 'sha')] }, { hp: { 'seat-b': 3, 'seat-d': 2 } });
    const action = decide(state);
    expect(action).toMatchObject({ kind: 'PlayCardAction', cardInstanceId: 's1', targets: [{ kind: 'seat', seatId: 'seat-d' }] });
    expect(act(state, action)).toBeDefined();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest --selectProjects bots policies.spec`
Expected: FAIL — `Cannot find module './policies'`.

- [ ] **Step 3: Implement.**

In `helpers.ts`, replace the whole `fillPick` function (and its comment) with:

```ts
// How good a target is for a play: higher is better. The rule-based bot picks
// the highest-ranked non-ally; which ranker it uses is the one difference
// between 'rule-based' and 'rule-based-v1'.
export type TargetRanker = (view: GameState, me: Seat, target: Seat) => number;

// The original ordering: the weakest first, then seat order.
export const weakestFirst: TargetRanker = (_view, _me, target) => -(target.combinedHp * 100 + target.index);

// A target template filled for the bot: non-allies, best first by `rank`, up to
// the maximum; null when none qualifies. Any other action comes back as it is.
export function fillPick<A extends { targets: Target[]; pickTargets?: TargetPick }>(view: GameState, me: Seat, action: A, rank: TargetRanker): A | null {
  const pick = action.pickTargets;
  if (!pick) return action;
  const seats = pick.eligibleIds
    .map((id) => view.seats.find((s) => s.id === id))
    .filter((s): s is Seat => !!s && !isAlly(me, s))
    .sort((a, b) => rank(view, me, b) - rank(view, me, a) || a.index - b.index)
    .slice(0, pick.max);
  if (seats.length < Math.max(1, pick.min)) return null;
  const { pickTargets: _pick, ...rest } = action;
  return { ...rest, targets: seats.map((s) => ({ kind: 'seat' as const, seatId: s.id })) } as A;
}
```

In `rule-based.ts` make these edits:

1. Import: change `import { definitionIdOf, fillPick, fillSelection, isAlly, keepRank, leastUseful, mayReveal } from './helpers';` to
   `import { definitionIdOf, fillPick, fillSelection, isAlly, keepRank, leastUseful, mayReveal, TargetRanker, weakestFirst } from './helpers';`
2. Replace `targetedPlays` with:
   ```ts
   // Plays of `definitionId` aimed at a living non-ally, best target first.
   function targetedPlays(view: GameState, self: Seat, plays: PlayCard[], definitionId: string, rank: TargetRanker): PlayCard[] {
     return plays
       .filter((p) => p.targets.length >= 1 && p.targets[0].kind === 'seat' && definitionIdOf(view, p.cardInstanceId) === definitionId)
       .map((p) => ({ play: p, target: view.seats.find((s) => p.targets[0].kind === 'seat' && s.id === p.targets[0].seatId) }))
       .filter((t): t is { play: PlayCard; target: Seat } => !!t.target && !t.target.eliminated && !isAlly(self, t.target))
       .sort((a, b) => rank(view, self, b.target) - rank(view, self, a.target) || a.target.index - b.target.index)
       .map((t) => t.play);
   }
   ```
3. Change the `decide` signature to take the ranker first:
   ```ts
   function decide(
     rank: TargetRanker,
     view: GameState,
     seatId: string,
     offered: Action[],
     registry: ContentRegistry,
     memory: BotTurnMemory | null
   ): BotDecision {
   ```
4. In `decide`: `fillPick(view, mine, a)` → `fillPick(view, mine, a, rank)`.
5. In `decide`: add `, rank` as a last argument to every `targetedPlays(view, self, plays, '<id>')` call (steal, break, capture, starvation, sha, duel — six calls).
6. Replace the line `const byWeakest = (x: UseConversion, y: UseConversion) => targetSeat(x).combinedHp - targetSeat(y).combinedHp || targetSeat(x).index - targetSeat(y).index;` with:
   ```ts
   const byWeakest = (x: UseConversion, y: UseConversion) => rank(view, self, targetSeat(y)) - rank(view, self, targetSeat(x)) || targetSeat(x).index - targetSeat(y).index;
   ```
   (the name stays; the comment above it says "weakest", which is still the v1 meaning).
7. In the Sha-conversion block replace `.sort((x, y) => x.target.combinedHp - y.target.combinedHp || x.target.index - y.target.index)` with
   `.sort((x, y) => rank(view, self, y.target) - rank(view, self, x.target) || x.target.index - y.target.index)`.
8. Leave the Capture sorts (`targetSeat(y).combinedHp - targetSeat(x).combinedHp` and `best(... targetOf(p)?.combinedHp ...)`) as they are: Capture picks the highest HP on purpose.
9. Replace the last two lines of the file (the comment and `export const ruleBasedPolicy`) with:
   ```ts
   // Simple, explainable opponent; see the bot-opponents design spec for its rules.
   // The ranker decides which non-ally a targeted play goes to.
   export function createRuleBasedPolicy(id: string, rank: TargetRanker): BotPolicy {
     return { id, decide: (view, seatId, legal, registry, memory) => decide(rank, view, seatId, legal, registry, memory) };
   }

   export const ruleBasedPolicy: BotPolicy = createRuleBasedPolicy('rule-based', weakestFirst);

   // The behaviour before smarter targeting, kept as a fixed opponent for the tournament harness.
   export const ruleBasedV1Policy: BotPolicy = createRuleBasedPolicy('rule-based-v1', weakestFirst);
   ```

Create `policies.ts`:

```ts
import type { BotPolicy } from './policy';
import { ruleBasedPolicy, ruleBasedV1Policy } from './rule-based';

const POLICIES: ReadonlyMap<string, BotPolicy> = new Map([ruleBasedPolicy, ruleBasedV1Policy].map((p) => [p.id, p]));

// The ids of every registered policy (the random picker is not a BotPolicy).
export const POLICY_IDS: readonly string[] = [...POLICIES.keys()];

export function policyById(id: string): BotPolicy {
  const policy = POLICIES.get(id);
  if (!policy) throw new Error(`Unknown bot policy "${id}". Valid ids: ${POLICY_IDS.join(', ')}`);
  return policy;
}
```

In `public-api.ts` add `export * from './lib/policies';` after the `rule-based` export.

- [ ] **Step 4: Run the whole bots suite**

Run: `npx jest --selectProjects bots`
Expected: PASS, including every existing `rule-based.spec.ts` test (the refactor changes no behaviour). If the new `v1` test fails on the target, the Sha may be offered with a `pickTargets` template or out of reach; print `getLegalActions(state, 'seat-a', registry)` and adjust the seat HPs so the intended seat is a legal target, keeping the assertion "weakest in reach".

- [ ] **Step 5: Typecheck consumers**

Run: `npx jest --selectProjects sim app` then `npm run typecheck:server`
Expected: PASS (nothing outside `bots` imports `fillPick`).

- [ ] **Step 6: Commit**

```bash
git add projects/bots/src/lib/helpers.ts projects/bots/src/lib/rule-based.ts projects/bots/src/lib/policies.ts projects/bots/src/lib/policies.spec.ts projects/bots/src/public-api.ts
git commit -m "refactor(bots): inject the target ranker; register rule-based and rule-based-v1

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `runGame` takes a policy per seat

**Files:**
- Modify: `projects/sim/src/runGame.ts`
- Modify: `projects/sim/src/runGame.spec.ts` (append)

**Interfaces:**
- Consumes: `policyById` from `bots` (Task 1).
- Produces:
  ```ts
  export const BOT_KINDS: readonly ['random', 'rule-based', 'rule-based-v1'];
  export type BotKind = (typeof BOT_KINDS)[number];
  export function parseBotKind(text: string): BotKind; // throws naming the valid kinds
  export function runGame(initialState, ctx, botRngSeed, maxActions?, botKind?, onStep?, policyFor?: (seatId: string) => BotKind): RunGameResult;
  ```
  When `policyFor` is given it decides each seat's kind; otherwise `botKind` applies to every seat, as today.

- [ ] **Step 1: Write the failing tests** — append to `runGame.spec.ts` (add `parseBotKind` and `BotKind` to the import from `./runGame`):

```ts
describe('runGame with a policy per seat', () => {
  it('asks policyFor for each acting seat and finishes the game', () => {
    const registry = buildContentRegistry();
    const seatIds = ['seat-0', 'seat-1', 'seat-2', 'seat-3'];
    const initialState = createGame(guozhanMode, registry, seatIds, 123);
    const used = new Set<BotKind>();
    const policyFor = (seatId: string): BotKind => {
      const kind: BotKind = seatIds.indexOf(seatId) % 2 === 0 ? 'rule-based' : 'rule-based-v1';
      used.add(kind);
      return kind;
    };
    const { finalState } = runGame(initialState, { registry, mode: guozhanMode }, 456, 20000, 'random', undefined, policyFor);
    expect(finalState.result).not.toBeNull();
    expect([...used].sort()).toEqual(['rule-based', 'rule-based-v1']);
  });

  it('can mix the random picker with a rule-based policy', () => {
    const registry = buildContentRegistry();
    const initialState = createGame(guozhanMode, registry, ['seat-0', 'seat-1'], 7);
    const policyFor = (seatId: string): BotKind => (seatId === 'seat-0' ? 'random' : 'rule-based');
    const { actionsSubmitted } = runGame(initialState, { registry, mode: guozhanMode }, 7, 20000, 'random', undefined, policyFor);
    expect(actionsSubmitted).toBeGreaterThan(0);
  });
});

describe('parseBotKind', () => {
  it('accepts every bot kind', () => {
    expect(parseBotKind('random')).toBe('random');
    expect(parseBotKind('rule-based')).toBe('rule-based');
    expect(parseBotKind('rule-based-v1')).toBe('rule-based-v1');
  });

  it('names the valid kinds when the text is unknown', () => {
    expect(() => parseBotKind('smart')).toThrow(/Unknown bot "smart".*random, rule-based, rule-based-v1/);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest --selectProjects sim runGame.spec`
Expected: FAIL — `parseBotKind` is not exported / `BotKind` has no `rule-based-v1`.

- [ ] **Step 3: Implement** — replace the contents of `runGame.ts` with:

```ts
import { resolve, createRng, getActiveSeatId, getLegalActions, redactStateForSeat } from 'engine';
import type { Action, GameState, EngineContext } from 'engine';
import { pickRandomAction, policyById } from 'bots';
import type { BotTurnMemory } from 'bots';

export const BOT_KINDS = ['random', 'rule-based', 'rule-based-v1'] as const;
export type BotKind = (typeof BOT_KINDS)[number];

export function parseBotKind(text: string): BotKind {
  const kind = BOT_KINDS.find((k) => k === text);
  if (!kind) throw new Error(`Unknown bot "${text}". Valid bots: ${BOT_KINDS.join(', ')}`);
  return kind;
}

export interface RunGameResult {
  finalState: GameState;
  actionsSubmitted: number;
}

// `policyFor`, when given, picks each acting seat's bot; otherwise `botKind` plays every seat.
export function runGame(
  initialState: GameState,
  ctx: EngineContext,
  botRngSeed: number,
  maxActions = 2000,
  botKind: BotKind = 'random',
  onStep?: (state: GameState) => void,
  policyFor?: (seatId: string) => BotKind
): RunGameResult {
  let state = initialState;
  let botRng = createRng(botRngSeed);
  const memories = new Map<string, BotTurnMemory>();
  let actionsSubmitted = 0;
  while (!state.result && actionsSubmitted < maxActions) {
    let action: Action;
    const seatId = getActiveSeatId(state);
    const kind = seatId !== null && policyFor ? policyFor(seatId) : botKind;
    if (kind === 'random') {
      const picked = pickRandomAction(state, botRng, ctx.registry);
      botRng = picked.rng;
      action = picked.action;
    } else {
      if (seatId === null) throw new Error('No seat is able to act');
      const legal = getLegalActions(state, seatId, ctx.registry);
      const decision = policyById(kind).decide(redactStateForSeat(state, seatId), seatId, legal, ctx.registry, memories.get(seatId) ?? null);
      memories.set(seatId, decision.memory);
      action = decision.action;
    }
    state = resolve(state, action, ctx).state;
    onStep?.(state);
    actionsSubmitted++;
  }
  return { finalState: state, actionsSubmitted };
}
```

- [ ] **Step 4: Run the sim suite**

Run: `npx jest --selectProjects sim`
Expected: PASS (existing specs call `runGame` with the old arguments, which still work).

- [ ] **Step 5: Commit**

```bash
git add projects/sim/src/runGame.ts projects/sim/src/runGame.spec.ts
git commit -m "feat(sim): runGame takes a bot per seat; parseBotKind

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Tournament module

Pairing, scoring and statistics are pure functions, tested without running games; `runTournament` strings them together.

**Files:**
- Create: `projects/sim/src/tournament.ts`
- Create: `projects/sim/src/tournament.spec.ts`

**Interfaces:**
- Consumes: `runGame`, `BotKind` (Task 2).
- Produces:
  ```ts
  export type Side = 'challenger' | 'baseline';
  export const sideOf: (game: number, seatIndex: number) => Side;
  export interface GameScore { finished: boolean; seats: Record<Side, number>; wins: Record<Side, number>; byKingdom: Record<Side, Record<string, { seats: number; wins: number }>> }
  export function scoreGame(finalState: GameState, sideOfSeat: (seatId: string) => Side): GameScore;
  export interface Interval { mean: number; low: number; high: number; games: number }
  export function interval(differences: number[]): Interval;
  export interface TournamentConfig { games: number; seats: number; challenger: BotKind; baseline: BotKind; firstSeed?: number; maxActions?: number }
  export interface SideTally { bot: BotKind; seats: number; wins: number; byKingdom: Record<string, { seats: number; wins: number }> }
  export interface TournamentReport { config: TournamentConfig; finished: number; unfinished: number; challenger: SideTally; baseline: SideTally; difference: Interval }
  export function runTournament(config: TournamentConfig): TournamentReport;
  export function formatReport(report: TournamentReport): string;
  ```

- [ ] **Step 1: Write the failing tests** — create `tournament.spec.ts`:

```ts
import type { GameState } from 'engine';
import { formatReport, interval, runTournament, scoreGame, sideOf, Side } from './tournament';

// Just enough of a finished game for scoring: seats with kingdoms, and a result.
const finished = (winners: string[]): GameState =>
  ({
    seats: [
      { id: 'seat-0', kingdom: 'Wei' }, { id: 'seat-1', kingdom: 'Shu' },
      { id: 'seat-2', kingdom: 'Wei' }, { id: 'seat-3', kingdom: 'Wu' },
    ],
    result: { endedAt: 0, winningSeatIds: winners, losingSeatIds: [] },
  }) as unknown as GameState;
const unfinished = { seats: [], result: null } as unknown as GameState;
const evenSeatsChallenge = (seatId: string): Side => (Number(seatId.slice(-1)) % 2 === 0 ? 'challenger' : 'baseline');

describe('sideOf', () => {
  it('alternates by seat and flips every game', () => {
    expect([0, 1, 2, 3].map((k) => sideOf(0, k))).toEqual(['challenger', 'baseline', 'challenger', 'baseline']);
    expect([0, 1, 2, 3].map((k) => sideOf(1, k))).toEqual(['baseline', 'challenger', 'baseline', 'challenger']);
  });

  it('gives each side each seat equally often over two games', () => {
    for (let k = 0; k < 4; k++) {
      const sides = [sideOf(0, k), sideOf(1, k)];
      expect(sides).toContain('challenger');
      expect(sides).toContain('baseline');
    }
  });
});

describe('scoreGame', () => {
  it('counts a win for each winning seat on the side that played it', () => {
    const score = scoreGame(finished(['seat-0', 'seat-1']), evenSeatsChallenge);
    expect(score.finished).toBe(true);
    expect(score.seats).toEqual({ challenger: 2, baseline: 2 });
    expect(score.wins).toEqual({ challenger: 1, baseline: 1 });
    expect(score.byKingdom.challenger['Wei']).toEqual({ seats: 2, wins: 1 });
    expect(score.byKingdom.baseline['Shu']).toEqual({ seats: 1, wins: 1 });
  });

  it('reports a game with no result as unfinished, with no wins', () => {
    const score = scoreGame(unfinished, evenSeatsChallenge);
    expect(score.finished).toBe(false);
    expect(score.wins).toEqual({ challenger: 0, baseline: 0 });
  });
});

describe('interval', () => {
  it('is the mean with a 95% margin of 1.96 standard errors', () => {
    const r = interval([1, 0, 1, 0]);
    expect(r.mean).toBeCloseTo(0.5);
    expect(r.games).toBe(4);
    const se = Math.sqrt(((0.5 ** 2) * 4) / 3) / 2; // sample sd / sqrt(n)
    expect(r.low).toBeCloseTo(0.5 - 1.96 * se);
    expect(r.high).toBeCloseTo(0.5 + 1.96 * se);
  });

  it('has no NaN for no games or one game', () => {
    expect(interval([])).toEqual({ mean: 0, low: 0, high: 0, games: 0 });
    expect(interval([0.5])).toEqual({ mean: 0.5, low: 0.5, high: 0.5, games: 1 });
  });
});

describe('runTournament', () => {
  const config = { games: 4, seats: 4, challenger: 'rule-based', baseline: 'rule-based-v1', firstSeed: 1 } as const;

  it('is deterministic for the same configuration', () => {
    expect(runTournament(config)).toEqual(runTournament(config));
  });

  it('rejects an odd seat count, which cannot be paired fairly', () => {
    expect(() => runTournament({ ...config, seats: 3 })).toThrow(/even number of seats/);
  });

  it('counts a game cut off by the action cap as unfinished, not as a win or loss', () => {
    const report = runTournament({ ...config, games: 2, maxActions: 1 });
    expect(report.unfinished).toBe(2);
    expect(report.finished).toBe(0);
    expect(report.challenger.wins + report.baseline.wins).toBe(0);
    expect(formatReport(report)).not.toMatch(/NaN|Infinity/);
  });

  it('works with no games and with two seats', () => {
    expect(formatReport(runTournament({ ...config, games: 0 }))).not.toMatch(/NaN|Infinity/);
    const duel = runTournament({ ...config, games: 2, seats: 2 });
    expect(duel.finished + duel.unfinished).toBe(2);
    expect(duel.challenger.seats + duel.baseline.seats).toBe(duel.finished * 2);
  });

  it('plays equal numbers of challenger and baseline seats', () => {
    const report = runTournament(config);
    expect(report.challenger.seats).toBe(report.baseline.seats);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest --selectProjects sim tournament.spec`
Expected: FAIL — `Cannot find module './tournament'`.

- [ ] **Step 3: Implement** — create `tournament.ts`:

```ts
import { createGame } from 'engine';
import type { GameState } from 'engine';
import { buildContentRegistry, guozhanMode } from 'content';
import { BotKind, runGame } from './runGame';

export type Side = 'challenger' | 'baseline';

// Seat k plays the challenger when (k + game) is even, so the pattern flips every game.
export const sideOf = (game: number, seatIndex: number): Side => ((seatIndex + game) % 2 === 0 ? 'challenger' : 'baseline');

type KingdomTally = Record<string, { seats: number; wins: number }>;

export interface GameScore {
  finished: boolean;
  seats: Record<Side, number>;
  wins: Record<Side, number>;
  byKingdom: Record<Side, KingdomTally>;
}

// A seat counts as a win for the side that played it; an unfinished game scores nothing.
export function scoreGame(finalState: GameState, sideOfSeat: (seatId: string) => Side): GameScore {
  const score: GameScore = {
    finished: !!finalState.result,
    seats: { challenger: 0, baseline: 0 },
    wins: { challenger: 0, baseline: 0 },
    byKingdom: { challenger: {}, baseline: {} },
  };
  if (!finalState.result) return score;
  const winners = new Set(finalState.result.winningSeatIds);
  for (const seat of finalState.seats) {
    const side = sideOfSeat(seat.id);
    const won = winners.has(seat.id);
    score.seats[side] += 1;
    if (won) score.wins[side] += 1;
    const tally = (score.byKingdom[side][seat.kingdom] ??= { seats: 0, wins: 0 });
    tally.seats += 1;
    if (won) tally.wins += 1;
  }
  return score;
}

export interface Interval {
  mean: number;
  low: number;
  high: number;
  games: number;
}

// Mean with a 95% normal interval (1.96 standard errors); no spread with fewer than two games.
export function interval(values: number[]): Interval {
  const games = values.length;
  if (games === 0) return { mean: 0, low: 0, high: 0, games };
  const mean = values.reduce((sum, v) => sum + v, 0) / games;
  if (games === 1) return { mean, low: mean, high: mean, games };
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (games - 1);
  const margin = 1.96 * Math.sqrt(variance / games);
  return { mean, low: mean - margin, high: mean + margin, games };
}

export interface TournamentConfig {
  games: number;
  seats: number;
  challenger: BotKind;
  baseline: BotKind;
  firstSeed?: number;
  maxActions?: number;
}

export interface SideTally {
  bot: BotKind;
  seats: number;
  wins: number;
  byKingdom: KingdomTally;
}

export interface TournamentReport {
  config: TournamentConfig;
  finished: number;
  unfinished: number;
  challenger: SideTally;
  baseline: SideTally;
  // Per finished game: challenger share of seats won minus baseline share.
  difference: Interval;
}

const DEFAULT_MAX_ACTIONS = 20000;

export function runTournament(config: TournamentConfig): TournamentReport {
  if (config.seats < 2 || config.seats % 2 !== 0) throw new Error('A tournament needs an even number of seats, at least 2');
  const registry = buildContentRegistry();
  const seatIds = Array.from({ length: config.seats }, (_, i) => `seat-${i}`);
  const firstSeed = config.firstSeed ?? 0;
  const half = config.seats / 2;
  const tallies: Record<Side, SideTally> = {
    challenger: { bot: config.challenger, seats: 0, wins: 0, byKingdom: {} },
    baseline: { bot: config.baseline, seats: 0, wins: 0, byKingdom: {} },
  };
  const differences: number[] = [];
  let unfinished = 0;
  for (let game = 0; game < config.games; game++) {
    const seed = firstSeed + game;
    const sideOfSeat = (seatId: string): Side => sideOf(game, seatIds.indexOf(seatId));
    const initialState = createGame(guozhanMode, registry, seatIds, seed);
    const { finalState } = runGame(
      initialState,
      { registry, mode: guozhanMode },
      seed,
      config.maxActions ?? DEFAULT_MAX_ACTIONS,
      config.baseline,
      undefined,
      (seatId) => (sideOfSeat(seatId) === 'challenger' ? config.challenger : config.baseline)
    );
    const score = scoreGame(finalState, sideOfSeat);
    if (!score.finished) {
      unfinished += 1;
      continue;
    }
    differences.push(score.wins.challenger / half - score.wins.baseline / half);
    for (const side of ['challenger', 'baseline'] as const) {
      tallies[side].seats += score.seats[side];
      tallies[side].wins += score.wins[side];
      for (const [kingdom, k] of Object.entries(score.byKingdom[side])) {
        const into = (tallies[side].byKingdom[kingdom] ??= { seats: 0, wins: 0 });
        into.seats += k.seats;
        into.wins += k.wins;
      }
    }
  }
  return { config, finished: differences.length, unfinished, challenger: tallies.challenger, baseline: tallies.baseline, difference: interval(differences) };
}

const percent = (wins: number, seats: number): string => (seats === 0 ? '-' : `${((100 * wins) / seats).toFixed(1)}%`);

function formatSide(label: string, tally: SideTally): string {
  const kingdoms = Object.entries(tally.byKingdom)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([kingdom, k]) => `${kingdom} ${percent(k.wins, k.seats)}`)
    .join(', ');
  return `${label.padEnd(10)} ${tally.bot.padEnd(14)} seats ${String(tally.seats).padStart(5)}  wins ${String(tally.wins).padStart(5)}  rate ${percent(tally.wins, tally.seats).padStart(6)}  [${kingdoms}]`;
}

export function formatReport(report: TournamentReport): string {
  const { config, difference: d } = report;
  const pp = (v: number) => `${(100 * v).toFixed(1)} pp`;
  const verdict = d.games < 2 ? 'too few games to judge' : d.low > 0 ? 'challenger is better' : d.high < 0 ? 'baseline is better' : 'no clear difference';
  return [
    `Games ${config.games} (${report.finished} finished, ${report.unfinished} unfinished), seats ${config.seats}, first seed ${config.firstSeed ?? 0}`,
    formatSide('challenger', report.challenger),
    formatSide('baseline', report.baseline),
    `Difference per game (challenger minus baseline): ${pp(d.mean)}, 95% interval ${pp(d.low)} to ${pp(d.high)} over ${d.games} games: ${verdict}`,
  ].join('\n');
}
```

- [ ] **Step 4: Run the tests**

Run: `npx jest --selectProjects sim tournament.spec`
Expected: PASS. If the `maxActions: 1` test finds a game that finishes in one action, it cannot (a game needs many actions); if it reports a different `unfinished`, print the report and investigate before changing the test.

- [ ] **Step 5: Commit**

```bash
git add projects/sim/src/tournament.ts projects/sim/src/tournament.spec.ts
git commit -m "feat(sim): tournament harness with paired seats and per-game intervals

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: `sim tournament` command

**Files:**
- Modify: `projects/sim/src/cli.ts`
- Modify: `package.json` (scripts)
- Modify: `docs/architecture/bots-and-simulation.md` (the paragraph after the `runGame` diagram)

**Interfaces:**
- Consumes: `runTournament`, `formatReport` (Task 3); `parseBotKind` (Task 2).

- [ ] **Step 1: Implement.** In `cli.ts` add imports:

```ts
import { parseBotKind } from './runGame';
import { formatReport, runTournament } from './tournament';
```

(`runGame` is already imported from `./runGame`; merge into one import line.) Add this function above the `const [, , mode...` line:

```ts
function runTournamentCommand(games: number, numSeats: number, challenger: string, baseline: string, firstSeed: number): void {
  const report = runTournament({ games, seats: numSeats, challenger: parseBotKind(challenger), baseline: parseBotKind(baseline), firstSeed });
  console.log(formatReport(report));
}
```

Change the argument destructuring and dispatch to:

```ts
const [, , mode, arg1, arg2, arg3, arg4, arg5] = process.argv;
if (mode === 'single') {
  runSingle(Number(arg1 ?? 1), Number(arg2 ?? 4));
} else if (mode === 'batch') {
  runBatch(Number(arg1 ?? 100), Number(arg2 ?? 4));
} else if (mode === 'tournament') {
  try {
    runTournamentCommand(Number(arg1 ?? 100), Number(arg2 ?? 4), arg3 ?? 'rule-based', arg4 ?? 'rule-based-v1', Number(arg5 ?? 0));
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  }
} else {
  console.error(
    'Usage: sim single <seed> <numSeats> | sim batch <numGames> <numSeats> | sim tournament <games> <numSeats> <challenger> <baseline> [firstSeed]'
  );
  process.exitCode = 1;
}
```

In `package.json` `scripts`, add after `"server"`:
`"sim": "tsx --tsconfig projects/sim/tsconfig.json projects/sim/src/cli.ts",`

In `docs/architecture/bots-and-simulation.md`, after the sentence ending "…reports how many pass). The same functions are what the Jest specs call." add this paragraph:

```md
`tournament <games> <seats> <challenger> <baseline> [firstSeed]` compares two
bots ([tournament.ts](../../projects/sim/src/tournament.ts)). Seats alternate
between the two bots and the pattern flips every game, so each bot sits in each
seat equally often. Each finished game gives the challenger's share of winning
seats minus the baseline's; the report shows the mean of that difference with a
95% interval and says which bot is better only when the interval excludes 0.
Bots are `random`, `rule-based` and `rule-based-v1` (the rule-based bot before
smarter targeting, kept as a fixed opponent). Run it with `npm run sim -- tournament 200 4 rule-based rule-based-v1`.
```

- [ ] **Step 2: Run it**

Run: `npm run sim -- tournament 10 4 rule-based rule-based-v1`
Expected: a four-line report and exit code 0.

Run: `npm run sim -- tournament 10 3 rule-based rule-based-v1`
Expected: `A tournament needs an even number of seats, at least 2`, exit code 1.

Run: `npm run sim -- tournament 10 4 smart rule-based`
Expected: `Unknown bot "smart". Valid bots: random, rule-based, rule-based-v1`, exit code 1.

- [ ] **Step 3: Harness sanity checks** (these validate the harness itself before it judges anything)

Run: `npm run sim -- tournament 200 4 rule-based-v1 rule-based-v1`
Expected: difference near 0 pp, with an interval containing 0, verdict "no clear difference".

Run: `npm run sim -- tournament 100 4 rule-based random`
Expected: a large positive difference, verdict "challenger is better". If either result is wrong the harness is broken; fix it (Task 3) before continuing.

- [ ] **Step 4: Commit**

```bash
git add projects/sim/src/cli.ts package.json docs/architecture/bots-and-simulation.md
git commit -m "feat(sim): sim tournament command and docs

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: `targetScore`, wired into `rule-based`

**Files:**
- Create: `projects/bots/src/lib/targeting.ts`
- Create: `projects/bots/src/lib/targeting.spec.ts`
- Modify: `projects/bots/src/lib/rule-based.ts` (the `ruleBasedPolicy` line)
- Modify: `projects/bots/src/lib/rule-based.spec.ts` (only if an existing expectation changes on purpose)
- Modify: `projects/bots/src/public-api.ts`

**Interfaces:**
- Consumes: `TargetRanker`, `handCards`, `isAlly` (helpers.ts); `createRuleBasedPolicy` (Task 1).
- Produces:
  ```ts
  export const TARGET_WEIGHTS: { kill: number; trigrams: number; perHandCard: number; handCap: number; emptyHand: number; threat: number; threatCap: number; perHp: number; seatOrder: number };
  export const targetScore: TargetRanker;
  ```

- [ ] **Step 1: Write the failing tests** — create `targeting.spec.ts`:

```ts
import type { GameState } from 'engine';
import { targetScore } from './targeting';
import { card, table } from './testing';

const seatOf = (s: GameState, id: string) => s.seats.find((x) => x.id === id)!;
const score = (s: GameState, targetId: string) => targetScore(s, seatOf(s, 'seat-a'), seatOf(s, targetId));

const damage = (from: string, to: string) =>
  ({ kind: 'DamageDealtEvent', damage: { source: { kind: 'seat', seatId: from }, target: { kind: 'seat', seatId: to }, amount: 1, nature: 'normal' } });
const playedAt = (from: string, as: string, to: string) =>
  ({ kind: 'CardPlayedEvent', seatId: from, card: { as, colour: 'black', physical: [] }, targets: [{ kind: 'seat', seatId: to }] });

describe('targetScore', () => {
  it('prefers a target one hit from death', () => {
    const s = table({}, { hp: { 'seat-b': 1, 'seat-c': 3 } });
    expect(score(s, 'seat-b')).toBeGreaterThan(score(s, 'seat-c'));
  });

  it('prefers the weaker of two targets neither of which dies', () => {
    const s = table({}, { hp: { 'seat-b': 2, 'seat-c': 4 } });
    expect(score(s, 'seat-b')).toBeGreaterThan(score(s, 'seat-c'));
  });

  it('lowers the score of a target wearing Eight Trigrams', () => {
    const s = table({ 'seat-b:equip': [card('t1', 'eight-trigrams', 'spade')] });
    expect(score(s, 'seat-b')).toBeLessThan(score(s, 'seat-d'));
  });

  it('lowers the score as a target holds more cards, and raises it for an empty hand', () => {
    const hand = (n: number) => Array.from({ length: n }, (_, i) => card(`h${n}-${i}`, 'sha'));
    const s = table({ 'seat-b:hand': hand(4), 'seat-c:hand': hand(1) });
    expect(score(s, 'seat-c')).toBeGreaterThan(score(s, 'seat-b'));
    expect(score(s, 'seat-d')).toBeGreaterThan(score(s, 'seat-c')); // seat-d holds nothing
  });

  it('prefers a seat that damaged us over an otherwise equal one', () => {
    const s = { ...table(), log: [damage('seat-d', 'seat-a')] };
    expect(score(s, 'seat-d')).toBeGreaterThan(score(s, 'seat-b'));
  });

  it('counts a Sha or Tool aimed at a revealed ally as hostile, but not a response card', () => {
    const base = table({}, { kingdoms: { 'seat-b': 'Wei' } }); // seat-b is seat-a's ally
    const aimedAtAlly = { ...base, log: [playedAt('seat-c', 'sha', 'seat-b')] };
    expect(score(aimedAtAlly, 'seat-c')).toBeGreaterThan(score(aimedAtAlly, 'seat-d'));
    const response = { ...base, log: [{ ...playedAt('seat-c', 'sha', 'seat-b'), inResponseTo: { seatId: 'seat-b' } }] };
    expect(score(response, 'seat-c')).toBe(score({ ...base, log: [] }, 'seat-c'));
  });

  it('ignores peaceful cards played at us', () => {
    const s = { ...table(), log: [playedAt('seat-d', 'peach', 'seat-a')] };
    expect(score(s, 'seat-d')).toBeLessThan(score(s, 'seat-b')); // only seat order separates them
  });

  it('breaks ties by seat order', () => {
    const s = table();
    expect(score(s, 'seat-b')).toBeGreaterThan(score(s, 'seat-c'));
  });

  it('reads a view with no log as having no history', () => {
    const { log: _log, ...noLog } = table();
    expect(() => score(noLog as GameState, 'seat-b')).not.toThrow();
  });
});
```

Add to `rule-based.spec.ts`, inside `describe('ruleBasedPolicy', ...)` at the end, a test showing the new choice and that allies stay excluded (use that file's `view`, `seat`, `play`, `decide` helpers; two seats in reach, a revealed ally with the lowest HP, and a killable non-ally):

```ts
  it('aims a Sha at a target one hit from death over a weaker-looking one, and never at an ally', () => {
    const seats = [seat('seat-0', 0, 'Wei', 4), seat('seat-1', 1, 'Wei', 1), seat('seat-2', 2, 'Shu', 4), seat('seat-3', 3, 'Wu', 1)];
    const v = view({ seats, hand: [{ instanceId: 'c-sha', definitionId: 'sha' }] });
    // Offered Sha plays at every seat; seat-1 is a revealed Wei ally at 1 HP, seat-3 a non-ally at 1 HP, seat-2 a non-ally at 4 HP.
    const legal = [play('c-sha', 'seat-1'), play('c-sha', 'seat-2'), play('c-sha', 'seat-3'), end];
    expect(decide(v, legal).action).toEqual(play('c-sha', 'seat-3'));
  });
```

(If `view()`'s default seats already make seat-1 an ally this still holds; if the helper requires other options for the Sha to be played, mirror an existing Sha test in that file.)

- [ ] **Step 2: Run to verify failure**

Run: `npx jest --selectProjects bots targeting.spec`
Expected: FAIL — `Cannot find module './targeting'`.

- [ ] **Step 3: Implement** — create `targeting.ts`:

```ts
import type { CardPlayedEvent, DamageDealtEvent, GameState, Seat } from 'engine';
import { handCards, isAlly, TargetRanker } from './helpers';

// Tuned against the tournament harness (sim tournament); higher score = better target.
export const TARGET_WEIGHTS = {
  kill: 1000, // the hit would take the target to 0 HP
  trigrams: -60, // wears Eight Trigrams, so a Shan may come for free
  perHandCard: -8, // each card is a chance of a Shan...
  handCap: 5, // ...up to this many
  emptyHand: 30, // nothing to defend with
  threat: 60, // per hostile act aimed at us or an ally...
  threatCap: 3, // ...counting up to this many
  perHp: -10, // weaker is better: the tiebreaker
  seatOrder: -0.01, // then the nearer seat
};

// Damage is taken as 1: a Sha or Duel (Wine's extra point is ignored).
const DAMAGE = 1;

// Cards that, played at us or an ally outside a response, are an attack.
const HOSTILE_CARDS = new Set(['sha', 'duel', 'steal', 'break', 'capture', 'starvation', 'barbarians', 'hail-of-arrows', 'lightning']);

const seatTarget = (target: { kind: string; seatId?: string }): string | undefined => (target.kind === 'seat' ? target.seatId : undefined);

// How many hostile acts `attacker` has made against `me` or one of my revealed allies.
function hostileActs(view: GameState, me: Seat, attacker: Seat): number {
  const mine = (seatId: string | undefined): boolean => {
    if (!seatId) return false;
    if (seatId === me.id) return true;
    const other = view.seats.find((s) => s.id === seatId);
    return !!other && isAlly(me, other);
  };
  let acts = 0;
  for (const event of view.log ?? []) {
    if (event.kind === 'DamageDealtEvent') {
      const { damage } = event as DamageDealtEvent;
      if (damage.source && seatTarget(damage.source) === attacker.id && mine(seatTarget(damage.target))) acts += 1;
    } else if (event.kind === 'CardPlayedEvent') {
      const played = event as CardPlayedEvent;
      if (played.seatId === attacker.id && !played.inResponseTo && HOSTILE_CARDS.has(played.card.as) && played.targets.some((t) => mine(seatTarget(t)))) acts += 1;
    }
  }
  return acts;
}

export const targetScore: TargetRanker = (view, me, target) => {
  const w = TARGET_WEIGHTS;
  const wornCards = view.zones.find((z) => z.id === target.equipped.zoneId)?.cards ?? [];
  const held = handCards(view, target).length;
  let score = target.combinedHp * w.perHp + target.index * w.seatOrder;
  if (target.combinedHp <= DAMAGE) score += w.kill;
  if (wornCards.some((c) => c.definitionId === 'eight-trigrams')) score += w.trigrams;
  score += held === 0 ? w.emptyHand : Math.min(held, w.handCap) * w.perHandCard;
  score += Math.min(hostileActs(view, me, target), w.threatCap) * w.threat;
  return score;
};
```

In `public-api.ts` add `export * from './lib/targeting';`.

In `rule-based.ts` change the import to include `targetScore`: add `import { targetScore } from './targeting';` and replace
`export const ruleBasedPolicy: BotPolicy = createRuleBasedPolicy('rule-based', weakestFirst);`
with
`export const ruleBasedPolicy: BotPolicy = createRuleBasedPolicy('rule-based', targetScore);`
(`rule-based-v1` keeps `weakestFirst`.)

- [ ] **Step 4: Run the bots suite**

Run: `npx jest --selectProjects bots`
Expected: PASS. If an existing `rule-based.spec.ts` expectation fails, read it: when it asserted "weakest target" and the new score legitimately prefers a different seat (for example because the weaker seat holds a full hand while the other is empty), update that expectation and state in the commit message which test and why. If a failure is anything else (a crash, an ally targeted), fix the code, not the test.

- [ ] **Step 5: Run everything that uses the bot**

Run: `npx jest --selectProjects sim app && npm run typecheck:server`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add projects/bots/src/lib/targeting.ts projects/bots/src/lib/targeting.spec.ts projects/bots/src/lib/rule-based.ts projects/bots/src/lib/rule-based.spec.ts projects/bots/src/public-api.ts
git commit -m "feat(bots): score targets by kill chance, defence, threat and weakness

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Judge the change and record the result

**Files:**
- Modify: `docs/superpowers/specs/2026-10-15-bot-tournament-and-targeting-design.md` (append `## Results`)

- [ ] **Step 1: Run the comparison** (about 500 games; run in the background and wait)

Run: `npm run sim -- tournament 500 4 rule-based rule-based-v1 1000`
Expected: a report. Record the whole output.

- [ ] **Step 2: Decide**
  - Verdict "challenger is better": go to Step 4.
  - Anything else: tune. Change only the constants in `TARGET_WEIGHTS` (one idea at a time, for example weaker threat or stronger kill), rerun Step 1 with a **different** first seed (for example 2000, then 3000) so the weights are not fitted to one seed range, and record every run in the Results section, including the failures. After three tuning attempts without a "challenger is better" on a fresh seed range, stop: record that the targeting score did not beat v1, set `rule-based` back to `weakestFirst` (keep `targetScore` and its specs for later), and tell the user.

- [ ] **Step 3: Confirm on fresh seeds.** If a tuned weight set won, confirm it on a seed range it was not tuned on:

Run: `npm run sim -- tournament 500 4 rule-based rule-based-v1 5000`
Expected: verdict "challenger is better" again. If not, treat as a failed attempt in Step 2.

- [ ] **Step 4: Record the result.** Append to the spec file:

```md

## Results

Date: <date>. Command and output for each run (seed ranges, game counts, the report text), the final `TARGET_WEIGHTS`, and one sentence on the conclusion: whether `rule-based` now beats `rule-based-v1`, by how much (percentage points, interval), and any run that did not.
```

(Fill in the real numbers; no placeholders may remain.)

- [ ] **Step 5: Final checks and commit**

Run: `npx jest --selectProjects bots sim app` and `npm run typecheck:server`
Expected: PASS.

```bash
git add docs/superpowers/specs/2026-10-15-bot-tournament-and-targeting-design.md projects/bots/src/lib/targeting.ts projects/bots/src/lib/rule-based.ts
git commit -m "docs: tournament results for smarter targeting

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

(Include `targeting.ts` / `rule-based.ts` only if Step 2 changed them.)
