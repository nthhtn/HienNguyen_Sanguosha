# Bot Stage 1: Card Play Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four card-play rules (Peach, Wine, equipment upgrades, discard ranking) as switchable options on the rule-based bot, register the all-on variant as `rule-based-cards`, and judge it against the shipped bot with the mirrored tournament.

**Architecture:** A new `card-play.ts` holds the pure rule predicates and `discardRank`. `createRuleBasedPolicy` takes a `CardPlayRules` object (all off by default, so `rule-based` is unchanged). `policies.ts` becomes a mutable registry with `registerPolicy`, so experiments can add single-rule variants. `sim`'s bot kinds follow the registry.

**Tech Stack:** TypeScript (strict), Jest via ts-jest (`npx jest --selectProjects bots sim app`), `tsx` for the CLI (`npm run sim`).

**Spec:** `docs/superpowers/specs/2026-10-15-bot-stage-1-card-play-design.md`. Judging rule: `docs/superpowers/specs/2026-10-15-bot-improvement-roadmap-design.md`.

## Global Constraints

- `bots` and `sim` stay framework-free; no engine, content, app or server changes. Dependencies stay `engine ← content ← bots ← sim`.
- With every rule switch off, `rule-based` must behave exactly as today; `keepRank` is not changed (skills use it).
- Strict TS with `noPropertyAccessFromIndexSignature`: read `Record<string, T>` entries with brackets.
- Commit only the files named in each task, with explicit paths (the working tree holds unrelated uncommitted changes from the user; never `git add -A` or `git commit -a`).
- Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Work on branch `feat/bot-stage-1-card-play`.
- Tournament commands that may take over two minutes run in the background and are awaited with Monitor.

## Review Focus

- With all switches off the policy is unchanged: `rule-based` against `rule-based-v1` still reads exactly 0.0 pp mirrored (Task 2).
- The Peach veto: one Peach and a revealed ally at 2 HP or less keeps it; two Peaches play one (Task 1 and Task 2).
- Equipment: a mount is never replaced, equal range is not an upgrade, an unknown armor is not an upgrade, and an empty slot still equips (Task 1 and Task 2).
- Wine with no legal Sha target, or with only an eliminated or allied target, is never played (Task 2).
- A card whose definition cannot be found gets discard rank 0 and never crashes (Task 1).

## File Structure

| File | Responsibility |
|---|---|
| `projects/bots/src/lib/card-play.ts` (create) | `CardPlayRules`, `peachWorthPlaying`, `wineWorthPlaying`, `isEquipUpgrade`, `discardRank` |
| `projects/bots/src/lib/card-play.spec.ts` (create) | specs for the above |
| `projects/bots/src/lib/rule-based.ts` (modify) | take `rules`, apply them in the Play and Discard phases |
| `projects/bots/src/lib/rule-based.spec.ts` (modify) | specs: rules off = old behaviour, rules on = new actions |
| `projects/bots/src/lib/policies.ts` (modify) | mutable registry, `registerPolicy`, `policyIds`, `rule-based-cards` |
| `projects/bots/src/lib/policies.spec.ts` (modify) | follow the registry change |
| `projects/bots/src/public-api.ts` (modify) | export `card-play` |
| `projects/sim/src/runGame.ts` (modify) | bot kinds follow the registry |
| `docs/superpowers/specs/2026-10-15-bot-stage-1-card-play-design.md` (modify) | Results |

---

### Task 1: Rule predicates in `card-play.ts`

**Files:**
- Create: `projects/bots/src/lib/card-play.ts`
- Create: `projects/bots/src/lib/card-play.spec.ts`

**Interfaces:**
- Consumes: `definitionIdOf`, `handCards`, `isAlly` from `./helpers`.
- Produces:
  ```ts
  export interface CardPlayRules { peach: boolean; wine: boolean; equipment: boolean; discard: boolean }
  export const NO_CARD_PLAY_RULES: CardPlayRules;
  export const ALL_CARD_PLAY_RULES: CardPlayRules;
  export function peachWorthPlaying(view: GameState, self: Seat): boolean;
  export function wineWorthPlaying(shaTarget: Seat | undefined): boolean;
  export function isEquipUpgrade(registry: ContentRegistry, newDefinitionId: string, wornDefinitionIds: string[]): boolean;
  export function discardRank(view: GameState, registry: ContentRegistry, cardInstanceId: string): number;
  ```

- [ ] **Step 1: Write the failing tests** — create `card-play.spec.ts`:

```ts
import type { CardDefinition, GameState } from 'engine';
import { discardRank, isEquipUpgrade, peachWorthPlaying, wineWorthPlaying } from './card-play';
import { card, registry, table } from './testing';

const seatOf = (s: GameState, id: string) => s.seats.find((x) => x.id === id)!;
const hand = (n: number, definitionId = 'shan') => Array.from({ length: n }, (_, i) => card(`${definitionId}${i}`, definitionId));

describe('peachWorthPlaying', () => {
  it('plays at 2 HP or less', () => {
    const s = table({ 'seat-a:hand': [card('p', 'peach')] }, { hp: { 'seat-a': 2 }, maxHp: { 'seat-a': 4 } });
    expect(peachWorthPlaying(s, seatOf(s, 'seat-a'))).toBe(true);
  });

  it('plays when holding more cards than its HP, and keeps it otherwise', () => {
    const over = table({ 'seat-a:hand': [card('p', 'peach'), ...hand(3)] }, { hp: { 'seat-a': 3 }, maxHp: { 'seat-a': 4 } });
    expect(peachWorthPlaying(over, seatOf(over, 'seat-a'))).toBe(true); // 4 cards, 3 HP
    const light = table({ 'seat-a:hand': [card('p', 'peach'), ...hand(2)] }, { hp: { 'seat-a': 3 }, maxHp: { 'seat-a': 4 } });
    expect(peachWorthPlaying(light, seatOf(light, 'seat-a'))).toBe(false); // 3 cards, 3 HP
  });

  it('keeps its last Peach while a revealed ally is at 2 HP or less, but plays one of two', () => {
    const opts = { hp: { 'seat-a': 2, 'seat-b': 2 }, maxHp: { 'seat-a': 4 }, kingdoms: { 'seat-b': 'Wei' as const } };
    const one = table({ 'seat-a:hand': [card('p', 'peach')] }, opts);
    expect(peachWorthPlaying(one, seatOf(one, 'seat-a'))).toBe(false);
    const two = table({ 'seat-a:hand': [card('p', 'peach'), card('q', 'peach')] }, opts);
    expect(peachWorthPlaying(two, seatOf(two, 'seat-a'))).toBe(true);
  });

  it('ignores a hurt seat that is not a revealed ally', () => {
    const s = table({ 'seat-a:hand': [card('p', 'peach')] }, { hp: { 'seat-a': 2, 'seat-b': 1 }, maxHp: { 'seat-a': 4 } });
    expect(peachWorthPlaying(s, seatOf(s, 'seat-a'))).toBe(true); // seat-b is Shu, a different kingdom
  });
});

describe('wineWorthPlaying', () => {
  const s = table({}, { hp: { 'seat-b': 2, 'seat-c': 3 } });
  it('is for a target at 2 HP or less', () => {
    expect(wineWorthPlaying(seatOf(s, 'seat-b'))).toBe(true);
    expect(wineWorthPlaying(seatOf(s, 'seat-c'))).toBe(false);
  });

  it('is never for no target', () => {
    expect(wineWorthPlaying(undefined)).toBe(false);
  });
});

describe('isEquipUpgrade', () => {
  const weapons = [...registry.cards.values()].filter((c): c is CardDefinition & { weaponRange: number } => c.equipSlot === 'weapon' && c.id !== 'crossbow' && c.weaponRange !== undefined).sort((a, b) => a.weaponRange - b.weaponRange);
  const shortest = weapons[0];
  const longest = weapons[weapons.length - 1];

  it('replaces a weapon with a longer-range one, never the reverse or an equal one', () => {
    expect(longest.weaponRange).toBeGreaterThan(shortest.weaponRange);
    expect(isEquipUpgrade(registry, longest.id, [shortest.id])).toBe(true);
    expect(isEquipUpgrade(registry, shortest.id, [longest.id])).toBe(false);
    expect(isEquipUpgrade(registry, shortest.id, [shortest.id])).toBe(false);
  });

  it('counts Crossbow as range 4', () => {
    const range3 = weapons.find((w) => w.weaponRange === 3)!;
    expect(isEquipUpgrade(registry, 'crossbow', [range3.id])).toBe(true);
    expect(isEquipUpgrade(registry, 'crossbow', ['crossbow'])).toBe(false);
  });

  it('orders armor: Eight Trigrams, Silver Lion, Black Shield, Wood Armor', () => {
    expect(isEquipUpgrade(registry, 'eight-trigrams', ['wood-armor'])).toBe(true);
    expect(isEquipUpgrade(registry, 'silver-lion', ['black-shield'])).toBe(true);
    expect(isEquipUpgrade(registry, 'wood-armor', ['eight-trigrams'])).toBe(false);
  });

  it('never replaces a mount, and has nothing to upgrade in an empty slot', () => {
    expect(isEquipUpgrade(registry, 'red-hare', ['da-yuan'])).toBe(false);
    expect(isEquipUpgrade(registry, longest.id, [])).toBe(false);
    expect(isEquipUpgrade(registry, longest.id, ['eight-trigrams'])).toBe(false); // a different slot
  });

  it('does not treat an unknown card as an upgrade', () => {
    expect(isEquipUpgrade(registry, 'no-such-card', [shortest.id])).toBe(false);
  });
});

describe('discardRank', () => {
  const rankOf = (definitionId: string) => {
    const s = table({ 'seat-a:hand': [card('x', definitionId)] });
    return discardRank(s, registry, 'x');
  };

  it('orders Peach, Shan and Wuxie, Sha, Wine, other Tools, equipment, the rest', () => {
    expect(rankOf('peach')).toBe(6);
    expect(rankOf('shan')).toBe(5);
    expect(rankOf('wuxie')).toBe(5);
    expect(rankOf('sha')).toBe(4);
    expect(rankOf('wine')).toBe(3);
    expect(rankOf('duel')).toBe(2);
    expect(rankOf('axe')).toBe(1);
  });

  it('is 0 for a card it cannot find, and for an unknown definition', () => {
    const s = table({ 'seat-a:hand': [card('x', 'no-such-card')] });
    expect(discardRank(s, registry, 'x')).toBe(0);
    expect(discardRank(s, registry, 'missing-instance')).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest --selectProjects bots --runTestsByPath projects/bots/src/lib/card-play.spec.ts`
Expected: FAIL — `Cannot find module './card-play'`.

- [ ] **Step 3: Implement** — create `card-play.ts`:

```ts
import type { ContentRegistry, GameState, Seat } from 'engine';
import { definitionIdOf, handCards, isAlly } from './helpers';

// The Stage 1 card-play rules, each a switch (see the stage 1 spec). All off is the original bot.
export interface CardPlayRules {
  peach: boolean;
  wine: boolean;
  equipment: boolean;
  discard: boolean;
}

export const NO_CARD_PLAY_RULES: CardPlayRules = { peach: false, wine: false, equipment: false, discard: false };
export const ALL_CARD_PLAY_RULES: CardPlayRules = { peach: true, wine: true, equipment: true, discard: true };

// R1: whether a Peach is worth playing now, for a bot below max HP. At 2 HP or less, or holding more
// hand cards than its HP; but its last Peach stays while a revealed ally is at 2 HP or less.
export function peachWorthPlaying(view: GameState, self: Seat): boolean {
  const held = handCards(view, self);
  const peaches = held.filter((c) => c.definitionId === 'peach').length;
  const allyInDanger = view.seats.some((s) => s.id !== self.id && !s.eliminated && isAlly(self, s) && s.combinedHp <= 2);
  if (peaches <= 1 && allyInDanger) return false;
  return self.combinedHp <= 2 || held.length > self.combinedHp;
}

// R2: Wine only when the Sha it boosts goes to a target at 2 HP or less, so the extra point is lethal.
export function wineWorthPlaying(shaTarget: Seat | undefined): boolean {
  return !!shaTarget && shaTarget.combinedHp <= 2;
}

// R3: worth of a weapon or armor within its slot (higher is better). Crossbow lifts the Sha limit, which this bot uses.
const ARMOR_ORDER = ['eight-trigrams', 'silver-lion', 'black-shield', 'wood-armor'];
const CROSSBOW_VALUE = 4;

function equipValue(registry: ContentRegistry, definitionId: string): number {
  const definition = registry.cards.get(definitionId);
  if (definition?.equipSlot === 'weapon') return definitionId === 'crossbow' ? CROSSBOW_VALUE : (definition.weaponRange ?? 1);
  if (definition?.equipSlot === 'armor') {
    const index = ARMOR_ORDER.indexOf(definitionId);
    return index < 0 ? 0 : ARMOR_ORDER.length - index;
  }
  return 0;
}

// Whether the card is better than the one worn in its slot. Mounts are never replaced, and an empty
// slot is not an upgrade (the bot already fills those).
export function isEquipUpgrade(registry: ContentRegistry, newDefinitionId: string, wornDefinitionIds: string[]): boolean {
  const slot = registry.cards.get(newDefinitionId)?.equipSlot;
  if (slot !== 'weapon' && slot !== 'armor') return false;
  const worn = wornDefinitionIds.find((id) => registry.cards.get(id)?.equipSlot === slot);
  return worn !== undefined && equipValue(registry, newDefinitionId) > equipValue(registry, worn);
}

// R4: higher = discard later. Used only at the Discard phase; `keepRank` stays for the skills.
export function discardRank(view: GameState, registry: ContentRegistry, cardInstanceId: string): number {
  const definitionId = definitionIdOf(view, cardInstanceId);
  if (!definitionId) return 0;
  switch (definitionId) {
    case 'peach':
      return 6;
    case 'shan':
    case 'wuxie':
      return 5;
    case 'sha':
      return 4;
    case 'wine':
      return 3;
  }
  const category = registry.cards.get(definitionId)?.category;
  return category === 'tool' ? 2 : category === 'equipment' ? 1 : 0;
}
```

- [ ] **Step 4: Run the tests**

Run: `npx jest --selectProjects bots --runTestsByPath projects/bots/src/lib/card-play.spec.ts`
Expected: PASS. If a real-data assumption fails (for example no weapon has `weaponRange` 3, or `red-hare`/`da-yuan`/`axe` is not a known id), print `[...registry.cards.values()].map((c) => [c.id, c.equipSlot, c.weaponRange])` and adjust the test's data, not the rule.

- [ ] **Step 5: Commit**

```bash
git add projects/bots/src/lib/card-play.ts projects/bots/src/lib/card-play.spec.ts
git commit -m "feat(bots): card-play rule predicates (Peach, Wine, equipment upgrade, discard rank)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Wire the rules into the policy; registry; `rule-based-cards`

**Files:**
- Modify: `projects/bots/src/lib/rule-based.ts`
- Modify: `projects/bots/src/lib/rule-based.spec.ts`
- Modify: `projects/bots/src/lib/policies.ts`
- Modify: `projects/bots/src/lib/policies.spec.ts`
- Modify: `projects/bots/src/public-api.ts`
- Modify: `projects/sim/src/runGame.ts`

**Interfaces:**
- Consumes: everything from Task 1; `createRuleBasedPolicy(id, rank)` from the targeting stage.
- Produces:
  ```ts
  export function createRuleBasedPolicy(id: string, rank: TargetRanker, rules?: CardPlayRules): BotPolicy; // rules default NO_CARD_PLAY_RULES
  export function registerPolicy(policy: BotPolicy): void;
  export function policyIds(): string[];
  // 'rule-based-cards' is registered: createRuleBasedPolicy('rule-based-cards', weakestFirst, ALL_CARD_PLAY_RULES)
  // sim: export type BotKind = string; export function botKinds(): string[]; parseBotKind validates against ['random', ...policyIds()]
  ```

- [ ] **Step 1: Write the failing tests.**

In `rule-based.spec.ts`: add to the imports `import { NO_CARD_PLAY_RULES } from './card-play';` and `import { weakestFirst } from './helpers';`. Extend the registry's card list (the `cards: new Map([...])` literal) with these entries before its closing `])`:

```ts
    ['long-blade', { id: 'long-blade', name: 'long-blade', category: 'equipment', equipSlot: 'weapon', weaponRange: 4, play: () => [] }],
    ['short-blade', { id: 'short-blade', name: 'short-blade', category: 'equipment', equipSlot: 'weapon', weaponRange: 1, play: () => [] }],
    ['horse-a', { id: 'horse-a', name: 'horse-a', category: 'equipment', equipSlot: 'defensiveMount', play: () => [] }],
    ['horse-b', { id: 'horse-b', name: 'horse-b', category: 'equipment', equipSlot: 'defensiveMount', play: () => [] }],
```

Append a new `describe` block at the end of the file:

```ts
describe('card-play rules', () => {
  const off = createRuleBasedPolicy('off', weakestFirst, NO_CARD_PLAY_RULES);
  const only = (rule: 'peach' | 'wine' | 'equipment' | 'discard') => createRuleBasedPolicy(rule, weakestFirst, { ...NO_CARD_PLAY_RULES, [rule]: true });
  const run = (policy: typeof ruleBasedPolicy, v: GameState, legal: Action[]) => policy.decide(v, 'seat-0', legal, registry, null).action;
  const cards = (...pairs: [string, string][]) => pairs.map(([instanceId, definitionId]) => ({ instanceId, definitionId }));

  describe('Peach', () => {
    const seats = (hp: number, allyHp = 8) => [seat('seat-0', 0, 'Wei', hp), seat('seat-1', 1, 'Wei', allyHp), seat('seat-2', 2, 'Shu', 8), seat('seat-3', 3, 'Wu', 8)];
    const legal = [play('c-peach'), end];

    it('keeps a Peach at 6 of 8 HP with a light hand when the rule is on; the old bot plays it', () => {
      const v = view({ seats: seats(6), hand: cards(['c-peach', 'peach']) });
      expect(run(off, v, legal)).toEqual(play('c-peach'));
      expect(run(only('peach'), v, legal)).toEqual(end);
    });

    it('plays it at 2 HP', () => {
      expect(run(only('peach'), view({ seats: seats(2), hand: cards(['c-peach', 'peach']) }), legal)).toEqual(play('c-peach'));
    });

    it('plays it holding more cards than HP', () => {
      const v = view({ seats: seats(3), hand: cards(['c-peach', 'peach'], ['a', 'shan'], ['b', 'shan'], ['c', 'shan']) });
      expect(run(only('peach'), v, legal)).toEqual(play('c-peach'));
    });

    it('keeps its last Peach for an ally at 2 HP, but plays one of two', () => {
      const one = view({ seats: seats(2, 2), hand: cards(['c-peach', 'peach']) });
      expect(run(only('peach'), one, legal)).toEqual(end);
      const two = view({ seats: seats(2, 2), hand: cards(['c-peach', 'peach'], ['c-peach2', 'peach']) });
      expect(run(only('peach'), two, legal)).toEqual(play('c-peach'));
    });
  });

  describe('Wine', () => {
    const hand = cards(['c-wine', 'wine'], ['c-sha', 'sha']);
    const seatsWith = (targetHp: number) => [seat('seat-0', 0, 'Wei', 4), seat('seat-1', 1, 'Shu', targetHp), seat('seat-2', 2, 'Wu', 8), seat('seat-3', 3, 'Qun', 8)];

    it('plays Wine before a Sha at a target at 2 HP or less', () => {
      const legal = [play('c-wine'), play('c-sha', 'seat-1'), end];
      expect(run(only('wine'), view({ seats: seatsWith(2), hand }), legal)).toEqual(play('c-wine'));
    });

    it('goes straight to the Sha at a healthier target; the old bot drinks first', () => {
      const legal = [play('c-wine'), play('c-sha', 'seat-1'), end];
      const v = view({ seats: seatsWith(4), hand });
      expect(run(off, v, legal)).toEqual(play('c-wine'));
      expect(run(only('wine'), v, legal)).toEqual(play('c-sha', 'seat-1'));
    });

    it('never drinks with no Sha to play', () => {
      expect(run(only('wine'), view({ seats: seatsWith(1), hand: cards(['c-wine', 'wine']) }), [play('c-wine'), end])).toEqual(end);
    });

    it('never drinks when the only Sha target is a revealed ally', () => {
      const seats = [seat('seat-0', 0, 'Wei', 4), seat('seat-1', 1, 'Wei', 1), seat('seat-2', 2, 'Wu', 8), seat('seat-3', 3, 'Qun', 8)];
      expect(run(only('wine'), view({ seats, hand }), [play('c-wine'), play('c-sha', 'seat-1'), end])).toEqual(end);
    });
  });

  describe('equipment', () => {
    it('replaces a shorter weapon with a longer one when the rule is on; the old bot does not', () => {
      const v = view({ hand: cards(['c-new', 'long-blade']), equip: ['short-blade'] });
      expect(run(off, v, [play('c-new'), end])).toEqual(end);
      expect(run(only('equipment'), v, [play('c-new'), end])).toEqual(play('c-new'));
    });

    it('does not replace a longer weapon with a shorter one, nor a mount with a mount', () => {
      expect(run(only('equipment'), view({ hand: cards(['c-new', 'short-blade']), equip: ['long-blade'] }), [play('c-new'), end])).toEqual(end);
      expect(run(only('equipment'), view({ hand: cards(['c-new', 'horse-a']), equip: ['horse-b'] }), [play('c-new'), end])).toEqual(end);
    });

    it('still fills an empty slot whatever the rule', () => {
      const v = view({ hand: cards(['c-new', 'short-blade']) });
      expect(run(off, v, [play('c-new'), end])).toEqual(play('c-new'));
      expect(run(only('equipment'), v, [play('c-new'), end])).toEqual(play('c-new'));
    });
  });

  describe('discarding', () => {
    const h = cards(['e', 'blade'], ['w', 'wuxie'], ['d', 'duel']);
    const legal = h.map((c) => discard(c.instanceId));

    it('loses spare equipment before a Wuxie or Duel when the rule is on; the old bot loses the Wuxie', () => {
      const v = view({ phase: 'Discard', hand: h });
      expect(run(off, v, legal)).toEqual(discard('w'));
      expect(run(only('discard'), v, legal)).toEqual(discard('e'));
    });

    it('keeps a Peach to the end', () => {
      const withPeach = cards(['p', 'peach'], ['s', 'sha'], ['x', 'wine']);
      const l = withPeach.map((c) => discard(c.instanceId));
      expect(run(only('discard'), view({ phase: 'Discard', hand: withPeach }), l)).toEqual(discard('x'));
    });
  });

  it('rule-based, with every rule off, is the policy it always was', () => {
    const v = view({ seats: [seat('seat-0', 0, 'Wei', 6), seat('seat-1', 1, 'Shu', 8)], hand: cards(['c-peach', 'peach']) });
    expect(run(ruleBasedPolicy, v, [play('c-peach'), end])).toEqual(play('c-peach'));
  });
});
```

Note on the imports at the top of `rule-based.spec.ts`: add `createRuleBasedPolicy` to the existing `import { createRuleBasedPolicy, ruleBasedPolicy, ruleBasedV1Policy } from './rule-based';` if it is not already there (it is, from the targeting stage).

In `policies.spec.ts`: replace the `POLICY_IDS` import with `policyIds, registerPolicy`, and replace the first two tests of the `policy registry` describe block with:

```ts
  it('lists the registered policies', () => {
    expect(policyIds().sort()).toEqual(['rule-based', 'rule-based-cards', 'rule-based-v1']);
  });

  it('looks a policy up by id', () => {
    expect(policyById('rule-based')).toBe(ruleBasedPolicy);
    expect(policyById('rule-based-v1')).toBe(ruleBasedV1Policy);
    expect(policyById('rule-based-cards').id).toBe('rule-based-cards');
  });

  it('registers a new policy under its id, and a later registration replaces it', () => {
    registerPolicy({ id: 'test-only', decide: ruleBasedPolicy.decide });
    expect(policyIds()).toContain('test-only');
    const replacement = { id: 'test-only', decide: ruleBasedV1Policy.decide };
    registerPolicy(replacement);
    expect(policyById('test-only')).toBe(replacement);
  });
```

and change the unknown-id test's regex to `/Unknown bot policy "nope".*rule-based, rule-based-v1, rule-based-cards/`.

In `projects/sim/src/runGame.spec.ts`, in the `parseBotKind` describe add inside `accepts every bot kind`: `expect(parseBotKind('rule-based-cards')).toBe('rule-based-cards');`.

- [ ] **Step 2: Run to verify failure**

Run: `npx jest --selectProjects bots sim`
Expected: FAIL — `registerPolicy` / `policyIds` not exported; `createRuleBasedPolicy` ignores a third argument so the rule-on tests fail.

- [ ] **Step 3: Implement.**

`rule-based.ts`:

1. Add the import `import { CardPlayRules, NO_CARD_PLAY_RULES, discardRank, isEquipUpgrade, peachWorthPlaying, wineWorthPlaying } from './card-play';`.
2. Change the `decide` signature to take the rules after the ranker:
   ```ts
   function decide(
     rank: TargetRanker,
     rules: CardPlayRules,
     view: GameState,
   ```
   (the remaining parameters unchanged).
3. Discard phase: replace the `if (discards.length > 0) { return take(discards.reduce(...)) }` block with:
   ```ts
     if (discards.length > 0) {
       const worth = rules.discard ? discardRank : keepRank;
       return take(discards.reduce((best, a) => (worth(view, registry, a.cardInstanceId) < worth(view, registry, best.cardInstanceId) ? a : best)));
     }
   ```
4. Peach: replace `if (peach && self.combinedHp < self.maxCombinedHp) return take(peach);` with
   `if (peach && self.combinedHp < self.maxCombinedHp && (!rules.peach || peachWorthPlaying(view, self))) return take(peach);`
5. Equipment: replace the `const equipment = plays.find(...)` block with:
   ```ts
       const wornIds = (view.zones.find((z) => z.id === self.equipped.zoneId)?.cards ?? []).map((c) => c.definitionId);
       const equipment = plays.find((p) => {
         const definitionId = definitionIdOf(view, p.cardInstanceId);
         const slot = definitionId ? registry.cards.get(definitionId)?.equipSlot : undefined;
         const better = rules.equipment && !!definitionId && isEquipUpgrade(registry, definitionId, wornIds);
         return untargeted(p) && !!slot && (!equippedSlots.has(slot) || better);
       });
   ```
   Update the comment above it to `// Equip into an empty slot; with the equipment rule, also swap a worn weapon or armor for a better one.`
6. Wine: replace
   ```ts
       const shaPlays = targetedPlays(view, self, plays, 'sha', rank);
       const wine = untargetedOf('wine');
       if (wine && shaPlays.length > 0) return take(wine);
   ```
   with
   ```ts
       const shaPlays = targetedPlays(view, self, plays, 'sha', rank);
       const shaTarget = view.seats.find((s) => s.id === shaPlays[0]?.targets[0]?.seatId);
       const wineOk = shaPlays.length > 0 && (!rules.wine || wineWorthPlaying(shaTarget));
       const wine = untargetedOf('wine');
       if (wine && wineOk) return take(wine);
   ```
   and `if (wineVia && shaPlays.length > 0) return take(wineVia);` with `if (wineVia && wineOk) return take(wineVia);`.
7. Replace the exported factory and the two policies with:
   ```ts
   export function createRuleBasedPolicy(id: string, rank: TargetRanker, rules: CardPlayRules = NO_CARD_PLAY_RULES): BotPolicy {
     return { id, decide: (view, seatId, legal, registry, memory) => decide(rank, rules, view, seatId, legal, registry, memory) };
   }
   ```
   (`ruleBasedPolicy` and `ruleBasedV1Policy` lines stay as they are; they pass no rules.)

`policies.ts` — replace the whole file with:

```ts
import type { BotPolicy } from './policy';
import { ALL_CARD_PLAY_RULES } from './card-play';
import { weakestFirst } from './helpers';
import { createRuleBasedPolicy, ruleBasedPolicy, ruleBasedV1Policy } from './rule-based';

const POLICIES = new Map<string, BotPolicy>();

// Adds a policy under its id, replacing any earlier one with that id. Experiments use this to try variants.
export function registerPolicy(policy: BotPolicy): void {
  POLICIES.set(policy.id, policy);
}

// The ids of every registered policy (the random picker is not a BotPolicy).
export function policyIds(): string[] {
  return [...POLICIES.keys()];
}

export function policyById(id: string): BotPolicy {
  const policy = POLICIES.get(id);
  if (!policy) throw new Error(`Unknown bot policy "${id}". Valid ids: ${policyIds().join(', ')}`);
  return policy;
}

registerPolicy(ruleBasedPolicy);
registerPolicy(ruleBasedV1Policy);
// Stage 1 (card play): every card-play rule on; judged against 'rule-based' by the tournament.
registerPolicy(createRuleBasedPolicy('rule-based-cards', weakestFirst, ALL_CARD_PLAY_RULES));
```

`public-api.ts`: add `export * from './lib/card-play';` after the `policies` export.

`projects/sim/src/runGame.ts`: replace the `BOT_KINDS`/`BotKind`/`parseBotKind` block with:

```ts
// 'random', or the id of any registered policy.
export type BotKind = string;

export function botKinds(): string[] {
  return ['random', ...policyIds()];
}

export function parseBotKind(text: string): BotKind {
  if (!botKinds().includes(text)) throw new Error(`Unknown bot "${text}". Valid bots: ${botKinds().join(', ')}`);
  return text;
}
```

and change the import to `import { pickRandomAction, policyById, policyIds } from 'bots';`. Run `grep -rn "BOT_KINDS" projects` and fix any other user (expected: none).

- [ ] **Step 4: Run the suites**

Run: `npx jest --selectProjects bots sim app` then `npm run typecheck:server`
Expected: PASS, no type errors. Every pre-existing `rule-based.spec.ts` test passes unchanged (the rules default off).

- [ ] **Step 5: Confirm nothing changed with the rules off**

Run: `npm run sim -- tournament 200 4 rule-based rule-based-v1 0`
Expected: `0.0 pp, 95% interval 0.0 pp to 0.0 pp over 100 pairs`.

Run: `npm run sim -- tournament 20 4 rule-based-cards rule-based 0`
Expected: a normal report (the variant plays without crashing; any difference is fine).

- [ ] **Step 6: Commit**

```bash
git add projects/bots/src/lib/rule-based.ts projects/bots/src/lib/rule-based.spec.ts projects/bots/src/lib/policies.ts projects/bots/src/lib/policies.spec.ts projects/bots/src/public-api.ts projects/sim/src/runGame.ts projects/sim/src/runGame.spec.ts
git commit -m "feat(bots): card-play rules as switches; rule-based-cards variant; policy registry

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Experiment, decision and results

**Files:**
- Modify: `docs/superpowers/specs/2026-10-15-bot-stage-1-card-play-design.md` (Results)
- If a rule ships: modify `projects/bots/src/lib/rule-based.ts`, `projects/bots/src/lib/policies.ts`, `projects/bots/src/lib/rule-based.spec.ts`, `docs/architecture/bots-and-simulation.md`.

- [ ] **Step 1: Run 1 (all rules).** In the background, then await with Monitor:

Run: `npm run sim -- tournament 4000 4 rule-based-cards rule-based 100000 mirrored`
Expected: a report; record the difference line verbatim. The outcome is "clear" only when the whole interval is above 0.

- [ ] **Step 2: Branch on the result.**
  - Interval above 0: go to Step 3 (confirm).
  - Otherwise: go to Step 4 (diagnose). Nothing ships from run 1.

- [ ] **Step 3: Confirmation range.**

Run: `npm run sim -- tournament 4000 4 rule-based-cards rule-based 200000 mirrored`
Expected: record it. Above 0 again: go to Step 5 (ship the all-on variant). Otherwise it does not ship; go to Step 4.

- [ ] **Step 4: Diagnose (nothing ships from this unless it clears twice).** Create a scratch script in the scratchpad directory (never in the repo) that registers the four single-rule variants and runs each against `rule-based` on seed 100000:

```ts
import { createRuleBasedPolicy, registerPolicy, weakestFirst, NO_CARD_PLAY_RULES } from '/Users/hing/Workspace/my_sanguosha/projects/bots/src/public-api';
import { runTournament, formatReport } from '/Users/hing/Workspace/my_sanguosha/projects/sim/src/tournament';

const rule = process.argv[2] as 'peach' | 'wine' | 'equipment' | 'discard';
const id = `only-${rule}`;
registerPolicy(createRuleBasedPolicy(id, weakestFirst, { ...NO_CARD_PLAY_RULES, [rule]: true }));
console.log(rule, formatReport(runTournament({ games: 4000, seats: 4, challenger: id, baseline: 'rule-based', firstSeed: Number(process.argv[3]), mirrored: true })));
```

Run with `npx tsx --tsconfig projects/sim/tsconfig.json <scratch>/stage1.ts <rule> 100000` for each of the four rules, in the background. A rule whose interval is above 0 alone is a candidate: run it again with first seed `200000`. Only a rule that is above 0 on both can ship, alone (set only that switch in Step 5). No other tuning.

- [ ] **Step 5: Ship (only if Step 3, or a Step 4 candidate, cleared on both ranges).**
  1. In `rule-based.ts` replace the shipped line with the winning rules, freezing the old behaviour:
     ```ts
     export const ruleBasedPolicy: BotPolicy = createRuleBasedPolicy('rule-based', weakestFirst, ALL_CARD_PLAY_RULES); // or only the winning switches
     // The behaviour before Stage 1 (card play), a fixed opponent for the tournament harness.
     export const ruleBasedV2Policy: BotPolicy = createRuleBasedPolicy('rule-based-v2', weakestFirst);
     ```
     Keep `ruleBasedV1Policy`. Import `ALL_CARD_PLAY_RULES` (or build the winning subset with `{ ...NO_CARD_PLAY_RULES, <rule>: true }`).
  2. In `policies.ts` register `ruleBasedV2Policy` and remove the `rule-based-cards` registration (and its imports) if the variant shipped whole.
  3. In `policies.spec.ts` update the expected ids; in `rule-based.spec.ts` update any pre-existing expectation the new behaviour changes, saying in the commit message which test and why. Do not weaken a test to make it pass.
  4. In `docs/architecture/bots-and-simulation.md` update the sentence listing the bots.
  5. Run `npx jest --selectProjects bots sim app`, `npm run typecheck:server`, then `npm run sim -- tournament 200 4 rule-based rule-based-v2 0` (expected: positive, interval above 0 is likely but not required here; it is a sanity check that the two differ).

- [ ] **Step 6: Record the results.** Replace the `(Filled in after the experiment.)` line in the spec's `Results` section with a table of every run (command, first seed, the difference line) and one paragraph: which rules ran, what cleared, what shipped or that nothing did, and the size of the effect against its interval. No placeholders may remain. If nothing shipped, say that `rule-based` is unchanged.

- [ ] **Step 7: Final checks and commit**

Run: `npx jest --selectProjects bots sim app` and `npm run typecheck:server`
Expected: PASS, no type errors.

```bash
git add docs/superpowers/specs/2026-10-15-bot-stage-1-card-play-design.md
# plus, only if a rule shipped: the files edited in Step 5, by explicit path
git commit -m "docs: bot stage 1 (card play) results

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```
