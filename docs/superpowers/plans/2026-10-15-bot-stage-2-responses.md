# Bot Stage 2 — Responses Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two response rules (hold a lone Shan against a non-lethal hit; Wuxie for allies and against helpful Tools aimed at foes) as switches, register the all-on variant `rule-based-responses`, and judge it against `rule-based` by tournament.

**Architecture:** Pure predicates in a new `responses.ts`; `createRuleBasedPolicy` gains a `responseRules` parameter that section 2 ("Responding") of `decide` consults. With both switches off behaviour is byte-for-byte today's.

**Tech Stack:** TypeScript (strict, `noPropertyAccessFromIndexSignature`), Jest per project, `npm run sim -- tournament`.

**Spec:** `docs/superpowers/specs/2026-10-15-bot-stage-2-responses-design.md`

## Global Constraints

- Commit trailer: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Always `git add` explicit paths. Never `git commit -a`: the user has 14 unrelated modified/untracked files in `projects/app`, `projects/server` and `docs/architecture/frontend.md` that must stay untouched.
- Shipped policies (`rule-based`, `rule-based-v1`, `rule-based-cards`) must behave exactly as before.
- Ship rule: whole 95% interval above 0 on seed 300000 **and** seed 400000 (mirrored, 4 seats, 4000 games). At most three tuning sets; none planned.
- Run one test file: `npx jest --selectProjects bots --runTestsByPath <file>`.

## Review Focus

- A Shan answer when the pending `outcome` is absent or is not a `DamageEffect` (e.g. Hail of Arrows' window): must answer as today.
- A Wuxie check where the target is not a seat (`reason.target.kind !== 'seat'`): must not crash, must pass unless the baseline rule applies.
- A Wuxie the bot's own seat used (`toolUserSeatId === self.id`) on an ally: must not cancel (extended rule only). The baseline "Starvation judged on itself" cancel must keep working.
- Both switches off: the existing `rule-based.spec.ts` suite passes unchanged.

---

### Task 1: Response predicates

**Files:**
- Create: `projects/bots/src/lib/responses.ts`
- Create: `projects/bots/src/lib/responses.spec.ts`

**Interfaces:**
- Produces:
  - `export const HARMFUL_TOOLS: ReadonlySet<string>`, `export const HELPFUL_TOOLS: ReadonlySet<string>`
  - `export interface ResponseRules { shanHold: boolean; wuxie: boolean }`, `NO_RESPONSE_RULES`, `ALL_RESPONSE_RULES`
  - `export function shouldHoldShan(view: GameState, self: Seat): boolean`
  - `export function wuxieWorthCancelling(view: GameState, self: Seat, reason: WuxieReason, extended: boolean): boolean` where `type WuxieReason = Extract<DecisionReason, { kind: 'wuxie' }>`
- Consumes: `isAlly` from `./helpers`, `table`/`card` from `./testing` (specs).

- [ ] **Step 1: Write the failing spec**

Check `projects/bots/src/lib/testing.ts` `Options` (lines 23-30) for how `hp`, `maxHp`, `kingdoms` are set; the card-play spec shows usage (`hp`, `maxHp`, `kingdoms`). Create `responses.spec.ts`:

```ts
import type { DecisionReason, GameState } from 'engine';
import { HARMFUL_TOOLS, HELPFUL_TOOLS, shouldHoldShan, wuxieWorthCancelling } from './responses';
import { card, table } from './testing';

const seatOf = (s: GameState, id: string) => s.seats.find((x) => x.id === id)!;
const shans = (n: number) => Array.from({ length: n }, (_, i) => card(`sh${i}`, 'shan'));

// A Sha's hit window on `target`: not answering leads to `amount` damage.
function shaWindow(s: GameState, target: string, amount = 1): GameState {
  return {
    ...s,
    pendingResponse: {
      id: 'r1', respondingSeatId: target, allowedActionKinds: ['RespondAction', 'PassAction'], allowedCardIds: ['shan'],
      context: { effect: { kind: 'HealEffect', target: { kind: 'seat', seatId: target }, amount: 0 } },
      outcome: { kind: 'DamageEffect', damage: { source: { kind: 'seat', seatId: 'seat-b' }, target: { kind: 'seat', seatId: target }, amount, nature: 'normal' } },
    },
  };
}

describe('shouldHoldShan', () => {
  const at = (hp: number, n: number, amount = 1) => {
    const s = shaWindow(table({ 'seat-a:hand': shans(n) }, { hp: { 'seat-a': hp }, maxHp: { 'seat-a': 4 } }), 'seat-a', amount);
    return shouldHoldShan(s, seatOf(s, 'seat-a'));
  };
  it('holds a lone Shan against a non-lethal hit at 3+ HP', () => expect(at(3, 1)).toBe(true));
  it('answers when it holds two Shan', () => expect(at(3, 2)).toBe(false));
  it('answers at 2 HP or less', () => expect(at(2, 1)).toBe(false));
  it('answers a lethal hit', () => expect(at(3, 1, 3)).toBe(false));
  it('answers with no DamageEffect outcome', () => {
    const s = shaWindow(table({ 'seat-a:hand': shans(1) }, { hp: { 'seat-a': 4 } }), 'seat-a');
    const bare = { ...s, pendingResponse: { ...s.pendingResponse!, outcome: undefined } };
    expect(shouldHoldShan(bare, seatOf(bare, 'seat-a'))).toBe(false);
  });
  it('answers when the damage lands on another seat', () => {
    const s = shaWindow(table({ 'seat-a:hand': shans(1) }, { hp: { 'seat-a': 4 } }), 'seat-b');
    expect(shouldHoldShan(s, seatOf(s, 'seat-a'))).toBe(false);
  });
});

describe('wuxieWorthCancelling', () => {
  // seat-a is the bot (Wei). seat-b Wei (ally), seat-c Shu (known foe), seat-d hidden.
  const s = table({}, { kingdoms: { 'seat-a': 'Wei', 'seat-b': 'Wei', 'seat-c': 'Shu', 'seat-d': 'hidden' } });
  const reason = (tool: string, user: string, target: string): Extract<DecisionReason, { kind: 'wuxie' }> => ({
    kind: 'wuxie', tool: { as: tool, colour: 'black', physical: [] }, toolUserSeatId: user, target: { kind: 'seat', seatId: target },
  });
  const check = (r: ReturnType<typeof reason>, extended = true) => wuxieWorthCancelling(s, seatOf(s, 'seat-a'), r, extended);

  it('knows the tool lists', () => {
    expect(HARMFUL_TOOLS.has('duel')).toBe(true);
    expect([...HELPFUL_TOOLS].sort()).toEqual(['draw-two', 'harvest', 'peach-garden']);
  });
  it('always cancels a harmful Tool aimed at itself, even its own Starvation judgment', () => {
    expect(check(reason('starvation', 'seat-a', 'seat-a'), false)).toBe(true);
    expect(check(reason('duel', 'seat-c', 'seat-a'), false)).toBe(true);
  });
  it('without the extended rule, ignores allies and helpful Tools', () => {
    expect(check(reason('duel', 'seat-c', 'seat-b'), false)).toBe(false);
    expect(check(reason('peach-garden', 'seat-c', 'seat-c'), false)).toBe(false);
  });
  it('extended: cancels a harmful Tool aimed at a revealed ally', () => {
    expect(check(reason('duel', 'seat-c', 'seat-b'))).toBe(true);
  });
  it('extended: not a harmful Tool on a hidden seat or a foe', () => {
    expect(check(reason('duel', 'seat-c', 'seat-d'))).toBe(false);
    expect(check(reason('duel', 'seat-d', 'seat-c'))).toBe(false);
  });
  it('extended: cancels a helpful Tool aimed at a known foe, not an ally or hidden seat', () => {
    expect(check(reason('peach-garden', 'seat-d', 'seat-c'))).toBe(true);
    expect(check(reason('peach-garden', 'seat-d', 'seat-b'))).toBe(false);
    expect(check(reason('peach-garden', 'seat-c', 'seat-d'))).toBe(false);
  });
  it('extended: never cancels a Tool its own seat or an ally used', () => {
    expect(check(reason('duel', 'seat-a', 'seat-b'))).toBe(false);
    expect(check(reason('duel', 'seat-b', 'seat-b'))).toBe(false);
    expect(check(reason('peach-garden', 'seat-b', 'seat-c'))).toBe(false);
  });
  it('does not crash on a non-seat target', () => {
    const r = { ...reason('duel', 'seat-c', 'seat-a'), target: { kind: 'card' as const, cardInstanceId: 'x' } } as never;
    expect(check(r)).toBe(false);
  });
});
```

If `table`'s `Options` has no `kingdoms`/`hp` key as written, adapt to what `testing.ts` offers (the Stage 1 spec uses exactly `hp`, `maxHp`, `kingdoms`), and fix the `target` literal for a non-seat `Target` to a valid shape from `types.ts`.

- [ ] **Step 2: Run it to see it fail**

Run: `npx jest --selectProjects bots --runTestsByPath projects/bots/src/lib/responses.spec.ts`
Expected: FAIL — cannot find module `./responses`.

- [ ] **Step 3: Implement**

```ts
import type { DecisionReason, GameState, Seat } from 'engine';
import { isAlly } from './helpers';

// Tools worth cancelling when aimed at this bot (or, with the wuxie rule, a revealed ally).
export const HARMFUL_TOOLS: ReadonlySet<string> = new Set(['barbarians', 'hail-of-arrows', 'duel', 'steal', 'break', 'capture', 'lightning', 'starvation']);
// Tools that help whoever they are aimed at: worth cancelling when aimed at a known foe.
export const HELPFUL_TOOLS: ReadonlySet<string> = new Set(['draw-two', 'peach-garden', 'harvest']);

// Stage 2 response rules, each a switch so they can be measured on their own.
export interface ResponseRules {
  shanHold: boolean;
  wuxie: boolean;
}
export const NO_RESPONSE_RULES: ResponseRules = { shanHold: false, wuxie: false };
export const ALL_RESPONSE_RULES: ResponseRules = { shanHold: true, wuxie: true };

const handCount = (view: GameState, self: Seat, definitionId: string): number =>
  (view.zones.find((z) => z.id === self.hand.zoneId)?.cards ?? []).filter((c) => c.definitionId === definitionId).length;

// Take a non-lethal hit and keep the Shan: only at 3+ HP and with fewer than 2 Shan in hand.
export function shouldHoldShan(view: GameState, self: Seat): boolean {
  const outcome = view.pendingResponse?.outcome;
  if (outcome?.kind !== 'DamageEffect') return false;
  const { target, amount } = outcome.damage;
  if (target.kind !== 'seat' || target.seatId !== self.id) return false;
  return amount < self.combinedHp && self.combinedHp > 2 && handCount(view, self, 'shan') < 2;
}

type WuxieReason = Extract<DecisionReason, { kind: 'wuxie' }>;

// Whether to spend a Wuxie on `reason`. Baseline: a harmful Tool aimed at this bot. `extended` adds a
// harmful Tool on a revealed ally and a helpful Tool on a known foe, never for a Tool this seat or an ally used.
export function wuxieWorthCancelling(view: GameState, self: Seat, reason: WuxieReason, extended: boolean): boolean {
  if (reason.target.kind !== 'seat') return false;
  const targetId = reason.target.seatId;
  const harmful = HARMFUL_TOOLS.has(reason.tool.as);
  if (targetId === self.id) return harmful;
  if (!extended) return false;
  const user = view.seats.find((s) => s.id === reason.toolUserSeatId);
  if (reason.toolUserSeatId === self.id || (user && isAlly(self, user))) return false;
  const target = view.seats.find((s) => s.id === targetId);
  if (!target) return false;
  if (harmful) return isAlly(self, target);
  return HELPFUL_TOOLS.has(reason.tool.as) && target.kingdom !== 'hidden' && !isAlly(self, target);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx jest --selectProjects bots --runTestsByPath projects/bots/src/lib/responses.spec.ts`
Expected: PASS (all). Fix test-table option names if setup failed, not the predicates.

- [ ] **Step 5: Commit**

```bash
git add projects/bots/src/lib/responses.ts projects/bots/src/lib/responses.spec.ts
git commit -m "feat(bots): response predicates (hold a Shan, extended Wuxie)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Wire the switches, register the variant

**Files:**
- Modify: `projects/bots/src/lib/rule-based.ts` (lines 20-21, 67-75, 182-204, 359-361)
- Modify: `projects/bots/src/lib/policies.ts`, `projects/bots/src/lib/policies.spec.ts`
- Modify: `projects/bots/src/lib/rule-based.spec.ts`
- Modify: `projects/bots/src/public-api.ts`

**Interfaces:**
- Consumes: everything Task 1 produces.
- Produces: `createRuleBasedPolicy(id, rank, rules = NO_CARD_PLAY_RULES, responseRules = NO_RESPONSE_RULES)`; registered id `rule-based-responses`.

- [ ] **Step 1: Write failing tests**

In `rule-based.spec.ts` add (reuse its `view`, `seat`, `decide`-style helpers; build the policy with `createRuleBasedPolicy('t', weakestFirst, NO_CARD_PLAY_RULES, { shanHold: true, wuxie: false })`, imports `NO_RESPONSE_RULES`/`ALL_RESPONSE_RULES` from `./responses`):

```ts
describe('response rules', () => {
  const respond: Action = { kind: 'RespondAction', seatId: 'seat-0', pendingResponseId: 'r1', cardInstanceId: 'sh' };
  const passIt: Action = { kind: 'PassAction', seatId: 'seat-0', pendingResponseId: 'r1' };
  const hit = (hp: number): GameState => {
    const v = view({ pendingFor: 'seat-0', seats: [seat('seat-0', 0, 'Wei', hp), seat('seat-1', 1, 'hidden', 6)], hand: [{ instanceId: 'sh', definitionId: 'shan' }] });
    return { ...v, pendingResponse: { ...v.pendingResponse!, allowedCardIds: ['shan'], outcome: { kind: 'DamageEffect', damage: { source: { kind: 'seat', seatId: 'seat-1' }, target: { kind: 'seat', seatId: 'seat-0' }, amount: 1, nature: 'normal' } } } };
  };
  const policy = (r: ResponseRules) => createRuleBasedPolicy('t', weakestFirst, NO_CARD_PLAY_RULES, r);
  const run = (p: BotPolicy, v: GameState) => p.decide(v, 'seat-0', [respond, passIt], registry, null).action;

  it('with the switches off, blocks the hit as before', () => {
    expect(run(policy(NO_RESPONSE_RULES), hit(5))).toBe(respond);
    expect(run(ruleBasedPolicy, hit(5))).toBe(respond);
  });
  it('shanHold: passes a non-lethal hit at 5 HP, blocks at 2 HP', () => {
    expect(run(policy({ shanHold: true, wuxie: false }), hit(5))).toBe(passIt);
    expect(run(policy({ shanHold: true, wuxie: false }), hit(2))).toBe(respond);
  });
  it('wuxie: cancels a Duel aimed at a revealed ally only with the switch on', () => {
    const seats = [seat('seat-0', 0, 'Wei', 4), seat('seat-1', 1, 'Wei', 4), seat('seat-2', 2, 'Shu', 4)];
    const v = view({ pendingFor: 'seat-0', seats, hand: [{ instanceId: 'sh', definitionId: 'wuxie' }],
      pendingReason: { kind: 'wuxie', tool: { as: 'duel', colour: 'black', physical: [] }, toolUserSeatId: 'seat-2', target: { kind: 'seat', seatId: 'seat-1' } } });
    expect(run(policy(NO_RESPONSE_RULES), v)).toBe(passIt);
    expect(run(policy({ shanHold: false, wuxie: true }), v)).toBe(respond);
  });
});
```

Add imports as needed (`BotPolicy` from `./policy`, `ResponseRules`/`NO_RESPONSE_RULES` from `./responses`). In `policies.spec.ts` change the id list to include `'rule-based-responses'` (keeps the list sorted: `['rule-based', 'rule-based-cards', 'rule-based-responses', 'rule-based-v1']`) and the error-message regex list to end `rule-based, rule-based-v1, rule-based-cards, rule-based-responses`.

- [ ] **Step 2: Run to see failure**

Run: `npx jest --selectProjects bots --runTestsByPath projects/bots/src/lib/rule-based.spec.ts projects/bots/src/lib/policies.spec.ts`
Expected: FAIL (4th argument not accepted / id not registered).

- [ ] **Step 3: Implement**

In `rule-based.ts`:
1. Delete the local `HARMFUL_TOOLS` constant and its comment (lines 20-21); add `import { HARMFUL_TOOLS, NO_RESPONSE_RULES, ResponseRules, shouldHoldShan, wuxieWorthCancelling } from './responses';` — only import what is used (if `HARMFUL_TOOLS` is no longer used, omit it).
2. `decide(rank, rules, responseRules, view, ...)`: add `responseRules: ResponseRules` after `rules`.
3. In `worthAnswering`, replace the wuxie branch with
   `reason.kind === 'wuxie' ? !!self && wuxieWorthCancelling(view, self, reason, responseRules.wuxie)`.
4. After `best` is computed, hold the Shan:
   ```ts
   const holding = responseRules.shanHold && !!self && !!best && definitionIdOf(view, best.cardInstanceId) === 'shan' && shouldHoldShan(view, self);
   const chosen = holding ? undefined : (best ?? converted);
   ```
   (keep `converted` computed before; with `holding` the bot falls through to the `PassAction`). Note a held Shan also suppresses the Serpent Spear fallback, which is intended.
5. `createRuleBasedPolicy(id, rank, rules = NO_CARD_PLAY_RULES, responseRules: ResponseRules = NO_RESPONSE_RULES)` passes `responseRules` to `decide`.

In `policies.ts` add:
```ts
// Stage 2 (responses): both response rules on; judged against 'rule-based' by the tournament.
registerPolicy(createRuleBasedPolicy('rule-based-responses', weakestFirst, NO_CARD_PLAY_RULES, ALL_RESPONSE_RULES));
```
with imports `NO_CARD_PLAY_RULES` from `./card-play` and `ALL_RESPONSE_RULES` from `./responses`. In `public-api.ts` add `export * from './lib/responses';`.

- [ ] **Step 4: Run to verify pass, then the whole suite**

Run: `npx jest --selectProjects bots sim app` and `npm run typecheck:server`
Expected: all PASS (existing `rule-based.spec.ts` unchanged and green is the "switches off = today" proof).

- [ ] **Step 5: Smoke the variant plays whole games without crashing**

Run: `npm run sim -- tournament 200 4 rule-based-responses rule-based 300000`
Expected: `Games 200 (200 finished, 0 unfinished)` and a report line.

- [ ] **Step 6: Commit**

```bash
git add projects/bots/src/lib/rule-based.ts projects/bots/src/lib/rule-based.spec.ts projects/bots/src/lib/policies.ts projects/bots/src/lib/policies.spec.ts projects/bots/src/public-api.ts
git commit -m "feat(bots): response rules as switches; rule-based-responses variant

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Experiment and record results

**Files:**
- Modify: `docs/superpowers/specs/2026-10-15-bot-stage-2-responses-design.md` (Results, status line)
- Possibly modify: `projects/bots/src/lib/policies.ts`, `rule-based.ts`, `docs/architecture/bots-and-simulation.md` (only if something ships)

**Interfaces:** Consumes the registered `rule-based-responses`. Single-rule diagnoses use a scratch script in the scratchpad dir (like `stage1.ts`: `registerPolicy(createRuleBasedPolicy('x', weakestFirst, NO_CARD_PLAY_RULES, {...}))` importing `weakestFirst` from `projects/bots/src/lib/helpers`), never committed.

- [ ] **Step 1: Run the first range (background, ~50 s)**

Run: `npm run sim -- tournament 4000 4 rule-based-responses rule-based 300000 > <scratchpad>/s2-300000.txt`
Expected: `4000 finished, 0 unfinished` and the difference line.

- [ ] **Step 2: Decide**
  - Interval wholly above 0 → run seed 400000 the same way. Wholly above 0 again → ship (Step 4). Otherwise → nothing ships (Step 3 only if desired by the spec's diagnosis rule below).
  - Not above 0 on 300000 → run the two single-rule diagnoses on 300000 (`shanHold` only, `wuxie` only). A rule may ship alone only if it clears alone on 300000 **and** 400000. No other tuning.

- [ ] **Step 3: Record every run** in the spec's Results section (seed, games, difference, interval, verdict) and change the status line to "Approved; experiment done: <shipped X | nothing shipped>". Commit:

```bash
git add docs/superpowers/specs/2026-10-15-bot-stage-2-responses-design.md
git commit -m "docs: bot stage 2 (responses) results

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 4: Only if something ships.** Freeze the old bot: add `ruleBasedV2Policy = createRuleBasedPolicy('rule-based-v2', weakestFirst)` and register it; make `ruleBasedPolicy` use the winning switches (`ALL_RESPONSE_RULES` or the single rule); update `policies.spec.ts` id list; add a line to `docs/architecture/bots-and-simulation.md`; run the full suite and typecheck; verify `rule-based` vs `rule-based-v2` shows the gain on a third seed range for the record. Commit with explicit paths.

- [ ] **Step 5: Final review.** Dispatch one fresh opus reviewer on the whole branch (`review-package` from `git merge-base main HEAD`), fix Critical/Important by RED→GREEN, then ask the user before merging and again before deleting the branch.
