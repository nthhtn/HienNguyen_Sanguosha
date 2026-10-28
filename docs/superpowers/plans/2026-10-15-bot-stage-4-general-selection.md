# Bot Stage 4 — General Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the bot choose its General pair by a measured per-General value table instead of combined max HP, and judge it against `rule-based` by tournament.

**Architecture:** `general-values.ts` (bots) holds a generated `GENERAL_VALUES` table plus `pairScore`; `createRuleBasedPolicy` takes the table as an optional last parameter (absent = today's selection). A committed sim command `fit-generals` plays random-pick games and prints the table.

**Tech Stack:** TypeScript (strict, `noPropertyAccessFromIndexSignature`), Jest per project, `npm run sim`.

**Spec:** `docs/superpowers/specs/2026-10-15-bot-stage-4-general-selection-design.md`

## Global Constraints

- Commit trailer: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Always `git add` explicit paths, never `git commit -a` (14 unrelated modified/untracked user files in app, server and `docs/architecture/frontend.md` stay untouched).
- Shipped policies behave exactly as before until the experiment says otherwise.
- Constants named in one place: `HP_TIEBREAK = 0.0001`, `SHRINK_K = 200`.
- Ship rule: whole 95% interval above 0 on two fresh seed ranges (mirrored, 4 seats, 4000 games); a range used to judge is never used to fit; at most three tuning sets.
- Run one file: `npx jest --selectProjects <bots|sim> --runTestsByPath <file>`.

## Review Focus

- No table (or an id missing from it): selection equals today's (highest combined max HP, first legal choice on ties).
- A fit with unfinished games or a General that was never sampled: no crash, no entry.
- The fitted table never uses a seed range that is later used for judging.
- Generated `general-values.ts` is sorted by id and reproducible from the command in its header.

---

### Task 1: Pair score and policy wiring

**Files:**
- Create: `projects/bots/src/lib/general-values.ts`, `projects/bots/src/lib/general-values.data.ts` (the generated table only), `projects/bots/src/lib/general-values.spec.ts`
- Modify: `projects/bots/src/lib/rule-based.ts` (selection in section 1; `decide` and `createRuleBasedPolicy` signatures), `projects/bots/src/lib/rule-based.spec.ts`, `projects/bots/src/lib/policies.ts`, `projects/bots/src/lib/policies.spec.ts`, `projects/bots/src/public-api.ts`

**Interfaces:**
- Produces: `HP_TIEBREAK`, `GENERAL_VALUES: Readonly<Record<string, number>>` (initially `{}`), `pairScore(values, registry, choice): number`, `bestPair(values, registry, choices): ChooseGeneralsChoice` (first highest score; strict `>`), `createRuleBasedPolicy(id, rank, rules?, responseRules?, generalValues?)`, registered id `rule-based-picks`.

- [ ] **Step 1: Failing specs.** `general-values.spec.ts` (use `registry` and generals from `./testing`'s `registry = buildContentRegistry()`; pick ids by looking up real generals: choose two same-kingdom pairs from the registry at test time, e.g. `[...registry.generals.values()].filter(g => g.kingdom === 'Wei')`):

```ts
import type { Action } from 'engine';
import { bestPair, HP_TIEBREAK, pairScore } from './general-values';
import { registry } from './testing';

type Choice = Extract<Action, { kind: 'ChooseGeneralsAction' }>;
const choose = (mainId: string, deputyId: string): Choice => ({ kind: 'ChooseGeneralsAction', seatId: 's', mainId, deputyId });
const wei = [...registry.generals.values()].filter((g) => g.kingdom === 'Wei').sort((a, b) => b.maxHp - a.maxHp);
const [bigA, bigB, ...rest] = wei;
const small = rest[rest.length - 1];
const smaller = rest[rest.length - 2];

describe('pairScore', () => {
  it('adds the two values and a small max HP term', () => {
    expect(pairScore({ [bigA.id]: 0.1, [bigB.id]: -0.02 }, registry, choose(bigA.id, bigB.id))).toBeCloseTo(0.08 + HP_TIEBREAK * (bigA.maxHp + bigB.maxHp), 10);
  });
  it('counts an absent id as 0', () => {
    expect(pairScore({}, registry, choose(bigA.id, bigB.id))).toBeCloseTo(HP_TIEBREAK * (bigA.maxHp + bigB.maxHp), 10);
  });
});

describe('bestPair', () => {
  it('prefers a higher-valued pair over a higher-HP pair', () => {
    expect(bigA.maxHp + bigB.maxHp).toBeGreaterThan(small.maxHp + smaller.maxHp);
    const values = { [small.id]: 0.05, [smaller.id]: 0.05 };
    expect(bestPair(values, registry, [choose(bigA.id, bigB.id), choose(small.id, smaller.id)])).toEqual(choose(small.id, smaller.id));
  });
  it('falls back to max HP, then to the first legal choice, with no table', () => {
    expect(bestPair({}, registry, [choose(small.id, smaller.id), choose(bigA.id, bigB.id)])).toEqual(choose(bigA.id, bigB.id));
    expect(bestPair({}, registry, [choose(bigA.id, bigB.id), choose(bigB.id, bigA.id)])).toEqual(choose(bigA.id, bigB.id));
  });
});
```
If the Wei roster has fewer than 4 generals or equal max HPs make the HP assertion fail, choose another kingdom's list. In `rule-based.spec.ts` add: with a table `{w1: 0.1...}` hmm — its local test registry has generals `w1`(Wei 4), `w2`(Wei 3), `s1`(Shu 4), `s2`(Shu 5). Add:
```ts
it('with a General value table, takes the highest-valued same-kingdom pair; with none, the highest max HP', () => {
  const choose = (mainId: string, deputyId: string): Action => ({ kind: 'ChooseGeneralsAction', seatId: 'seat-0', mainId, deputyId });
  const legal = [choose('w1', 'w2'), choose('s1', 's2')];
  const valued = createRuleBasedPolicy('t', weakestFirst, NO_CARD_PLAY_RULES, NO_RESPONSE_RULES, { w1: 0.2 });
  expect(valued.decide(view({ phase: 'GeneralSelection' }), 'seat-0', legal, registry, null).action).toBe(legal[0]);
  expect(decide(view({ phase: 'GeneralSelection' }), legal).action).toBe(legal[1]);
});
```
`policies.spec.ts`: id list becomes `['rule-based', 'rule-based-cards', 'rule-based-picks', 'rule-based-responses', 'rule-based-v1']`; error regex ends `rule-based, rule-based-v1, rule-based-cards, rule-based-responses, rule-based-picks/`.

- [ ] **Step 2: Run, expect FAIL** (missing module / 5th argument).

Run: `npx jest --selectProjects bots --runTestsByPath projects/bots/src/lib/general-values.spec.ts projects/bots/src/lib/rule-based.spec.ts projects/bots/src/lib/policies.spec.ts`

- [ ] **Step 3: Implement.** First `general-values.data.ts`, initially `export const GENERAL_VALUES: Readonly<Record<string, number>> = {};`. Then `general-values.ts`:

```ts
import type { Action, ContentRegistry } from 'engine';

type Choice = Extract<Action, { kind: 'ChooseGeneralsAction' }>;

// Max HP only breaks ties between pairs the table rates equally.
export const HP_TIEBREAK = 0.0001;

// The table is generated into its own file so regenerating it never touches this code.
export { GENERAL_VALUES } from './general-values.data';

export function pairScore(values: Readonly<Record<string, number>>, registry: ContentRegistry, choice: Choice): number {
  const hp = (id: string) => registry.generals.get(id)?.maxHp ?? 0;
  return (values[choice.mainId] ?? 0) + (values[choice.deputyId] ?? 0) + HP_TIEBREAK * (hp(choice.mainId) + hp(choice.deputyId));
}

// The highest-scoring choice; the first one on a tie.
export function bestPair(values: Readonly<Record<string, number>>, registry: ContentRegistry, choices: Choice[]): Choice {
  return choices.reduce((best, c) => (pairScore(values, registry, c) > pairScore(values, registry, best) ? c : best));
}
```
In `rule-based.ts`: add `generalValues?: Readonly<Record<string, number>>` as the parameter after `responseRules` in `decide` and as the last parameter of `createRuleBasedPolicy`; in section 1 replace the HP reduce with `take(generalValues ? bestPair(generalValues, registry, choices) : <existing reduce>)` (keep the existing reduce for the no-table path so behaviour is byte-identical). Import `bestPair`. `policies.ts`: 
```ts
// Stage 4 (General selection): the measured value table; judged against 'rule-based' by the tournament.
registerPolicy(createRuleBasedPolicy('rule-based-picks', weakestFirst, NO_CARD_PLAY_RULES, NO_RESPONSE_RULES, GENERAL_VALUES));
```
(import `NO_RESPONSE_RULES` from `./responses`, `GENERAL_VALUES` from `./general-values`). `public-api.ts`: `export * from './lib/general-values';`.

- [ ] **Step 4: Run to pass, then whole suite + typecheck.**

Run: `npx jest --selectProjects bots sim app` and `npm run typecheck:server`. Expected: all green.

- [ ] **Step 5: Commit.**
```bash
git add projects/bots/src/lib/general-values.ts projects/bots/src/lib/general-values.data.ts projects/bots/src/lib/general-values.spec.ts projects/bots/src/lib/rule-based.ts projects/bots/src/lib/rule-based.spec.ts projects/bots/src/lib/policies.ts projects/bots/src/lib/policies.spec.ts projects/bots/src/public-api.ts
git commit -m "feat(bots): General pair score and value-table selection; rule-based-picks variant

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The fit tool

**Files:**
- Create: `projects/sim/src/fitGenerals.ts`, `projects/sim/src/fitGenerals.spec.ts`
- Modify: `projects/sim/src/cli.ts` (new `fit-generals` command and usage text)

**Interfaces:**
- Consumes: `registerPolicy`, `policyById`, `BotPolicy` from `bots`; `runGame` from `./runGame`.
- Produces: `SHRINK_K = 200`, `interface PickSample { generalIds: [string, string]; won: boolean }`, `fitValues(samples, k = SHRINK_K): { values: Record<string, number>; counts: Record<string, number> }`, `collectSamples(games, seats, firstSeed): PickSample[]`, `formatTable(fit, command: string): string` (the full text of `general-values.ts`).

- [ ] **Step 1: Failing spec** `fitGenerals.spec.ts`:

```ts
import { collectSamples, fitValues, formatTable } from './fitGenerals';

const s = (a: string, b: string, won: boolean) => ({ generalIds: [a, b] as [string, string], won });

describe('fitValues', () => {
  const samples = [s('a', 'b', true), s('a', 'c', true), s('b', 'c', false), s('c', 'd', false)];
  it('is each General\'s win-rate lift over the overall mean (no shrinkage at k = 0)', () => {
    const { values, counts } = fitValues(samples, 0);
    expect(values['a']).toBeCloseTo(0.5, 10);
    expect(values['b']).toBeCloseTo(0, 10);
    expect(values['c']).toBeCloseTo(-1 / 6, 10);
    expect(values['d']).toBeCloseTo(-0.5, 10);
    expect(counts).toEqual({ a: 2, b: 2, c: 3, d: 1 });
  });
  it('shrinks by n / (n + k)', () => {
    expect(fitValues(samples, 2).values['a']).toBeCloseTo(0.25, 10);
  });
  it('gives a General that was never sampled no entry, and nothing for no samples', () => {
    expect(fitValues(samples, 0).values['z']).toBeUndefined();
    expect(fitValues([], 200)).toEqual({ values: {}, counts: {} });
  });
});

describe('formatTable', () => {
  it('prints the table sorted by id, with the command that makes it', () => {
    const text = formatTable({ values: { b: 0.1, a: -0.2 }, counts: { a: 10, b: 20 } }, 'npm run sim -- fit-generals 4 4 0');
    expect(text).toContain('npm run sim -- fit-generals 4 4 0');
    expect(text.indexOf("'a'")).toBeLessThan(text.indexOf("'b'"));
    expect(text).toContain("export const GENERAL_VALUES");
  });
});

describe('collectSamples', () => {
  it('records one sample per seat of every finished game, two real Generals each', () => {
    const samples = collectSamples(2, 4, 0);
    expect(samples.length).toBeLessThanOrEqual(8);
    expect(samples.length % 4).toBe(0);
    for (const x of samples) expect(x.generalIds[0]).not.toBe(x.generalIds[1]);
  });
});
```

- [ ] **Step 2: Run, expect FAIL** (module missing): `npx jest --selectProjects sim --runTestsByPath projects/sim/src/fitGenerals.spec.ts`

- [ ] **Step 3: Implement** `fitGenerals.ts`:

```ts
import { createGame } from 'engine';
import { buildContentRegistry, guozhanMode } from 'content';
import { policyById, registerPolicy } from 'bots';
import type { BotPolicy } from 'bots';
import { runGame } from './runGame';

// A General with n samples keeps n / (n + SHRINK_K) of its measured lift.
export const SHRINK_K = 200;
const RANDOM_PICKS_ID = 'fit-random-picks';

export interface PickSample {
  generalIds: [string, string];
  won: boolean;
}

export interface Fit {
  values: Record<string, number>;
  counts: Record<string, number>;
}

export function fitValues(samples: PickSample[], k = SHRINK_K): Fit {
  const overall = samples.length === 0 ? 0 : samples.filter((x) => x.won).length / samples.length;
  const tally: Record<string, { n: number; wins: number }> = {};
  for (const x of samples) {
    for (const id of x.generalIds) {
      const t = (tally[id] ??= { n: 0, wins: 0 });
      t.n += 1;
      if (x.won) t.wins += 1;
    }
  }
  const values: Record<string, number> = {};
  const counts: Record<string, number> = {};
  for (const [id, t] of Object.entries(tally)) {
    values[id] = (t.n / (t.n + k)) * (t.wins / t.n - overall);
    counts[id] = t.n;
  }
  return { values, counts };
}

export function formatTable(fit: Fit, command: string): string {
  const rows = Object.keys(fit.values).sort().map((id) => `  '${id}': ${fit.values[id].toFixed(4)}, // ${fit.counts[id]} samples`);
  return [
    '// How much better (win-rate points) a seat does holding each General; absent ids count 0.',
    '// GENERATED by `' + command + '`; see the Stage 4 spec. Do not edit by hand.',
    'export const GENERAL_VALUES: Readonly<Record<string, number>> = {',
    ...rows,
    '};',
    '',
  ].join('\n');
}
```
`formatTable` emits the whole text of `general-values.data.ts` (the generated table only), so regenerating never touches `general-values.ts`. Continue `fitGenerals.ts`:
```ts
// Plays `rule-based`, but picks a pseudo-random legal pair (from the game seed and the seat), so a General's
// value is not mixed up with its max HP.
function randomPicks(): BotPolicy {
  const base = policyById('rule-based');
  return {
    id: RANDOM_PICKS_ID,
    decide: (view, seatId, legal, registry, memory) => {
      const decision = base.decide(view, seatId, legal, registry, memory);
      if (view.phase !== 'GeneralSelection') return decision;
      const choices = legal.filter((a) => a.kind === 'ChooseGeneralsAction');
      const index = (view.rng.seed + 7919 * view.seats.findIndex((s) => s.id === seatId)) % choices.length;
      return { ...decision, action: choices[index] ?? decision.action };
    },
  };
}

export function collectSamples(games: number, seats: number, firstSeed: number): PickSample[] {
  registerPolicy(randomPicks());
  const registry = buildContentRegistry();
  const seatIds = Array.from({ length: seats }, (_, i) => `seat-${i}`);
  const samples: PickSample[] = [];
  for (let game = 0; game < games; game++) {
    const seed = firstSeed + game;
    const { finalState } = runGame(createGame(guozhanMode, registry, seatIds, seed), { registry, mode: guozhanMode }, seed, 20000, RANDOM_PICKS_ID);
    if (!finalState.result) continue;
    const winners = new Set(finalState.result.winningSeatIds);
    for (const seat of finalState.seats) {
      if (!seat.generals) continue;
      samples.push({ generalIds: [seat.generals.main.generalDefinitionId, seat.generals.deputy.generalDefinitionId], won: winners.has(seat.id) });
    }
  }
  return samples;
}
```
`cli.ts`: add
```ts
} else if (mode === 'fit-generals') {
  try {
    const [games, seats, first] = [Number(arg1 ?? 1000), Number(arg2 ?? 4), Number(arg3 ?? 0)];
    const fit = fitValues(collectSamples(games, seats, first));
    process.stdout.write(formatTable(fit, `npm run sim -- fit-generals ${games} ${seats} ${first}`));
  } catch (err) { console.error(err instanceof Error ? err.message : String(err)); process.exitCode = 1; }
}
```
(import from `./fitGenerals`; extend the usage text with `| sim fit-generals <games> <numSeats> <firstSeed>`.) If `view.phase` or the redacted view's `rng.seed` misbehaves in the policy, read the actual fields from `GameState` and adapt (the view is the redacted state; `rng` is kept).

- [ ] **Step 4: Run to pass, then the full suite.** `npx jest --selectProjects bots sim app`; `npm run typecheck:server`. Expected green.

- [ ] **Step 5: Smoke.** `npm run sim -- fit-generals 20 4 500000 | head -12` — Expected: a header comment, `export const GENERAL_VALUES ... = {`, sorted rows with sample counts.

- [ ] **Step 6: Commit** (explicit paths: the two new sim files and `cli.ts`).
```bash
git commit -m "feat(sim): fit-generals command measures a per-General value table

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Experiment and record results

**Files:**
- Modify: `projects/bots/src/lib/general-values.data.ts` (generated), the spec's Results and status line
- If it ships: `projects/bots/src/lib/rule-based.ts` / `policies.ts` / `policies.spec.ts`, `docs/architecture/bots-and-simulation.md`

- [ ] **Step 1: Fit set 1** (about 3-4 minutes; run in the background, redirect to the scratchpad):
`npm run sim -- fit-generals 20000 4 500000 > <scratchpad>/values-1.ts`. Copy to `projects/bots/src/lib/general-values.data.ts`, run `npx jest --selectProjects bots` (the suite must stay green: the table is empty-equivalent for shipped policies) and commit with the table (`git add` that file only).
- [ ] **Step 2: Judge on fresh ranges.** `npm run sim -- tournament 4000 4 rule-based-picks rule-based 600000`; if the whole interval is above 0, run seed 700000. Ships only if both clear.
- [ ] **Step 3: If set 1 fails,** set 2: fit on 40000 games (`fit-generals 40000 4 500000`, covering 500000-539999), judge on 800000 then 900000. Set 3 only with a concrete reason (e.g. `K`), two further fresh ranges (1000000, 1100000). Nothing else is tuned; each fit is committed with its table before it is judged.
- [ ] **Step 4: Record** every fit and run in the spec's Results (command, seed range, difference, interval, verdict), update the status line, commit the spec.
- [ ] **Step 5: Only if it ships.** Freeze today's bot as `rule-based-v2` (`createRuleBasedPolicy('rule-based-v2', weakestFirst)` registered), make `ruleBasedPolicy` pass `GENERAL_VALUES`, update `policies.spec.ts` and the architecture doc, then verify `rule-based` against `rule-based-v2` on a third fresh range for the record. Full suite and typecheck green. If nothing ships, `rule-based` stays as is and the table stays in the repo as the recorded variant's data.
- [ ] **Step 6: Final review.** One fresh opus reviewer on the whole branch (`review-package` from `git merge-base main HEAD`), with the Review Focus above; Critical and Important fixed RED→GREEN, minors deferred; then ask the user before merging and before deleting the branch.
