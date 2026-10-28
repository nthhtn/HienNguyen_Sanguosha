# Stage 4: Cards A — Horses, Crossbow, Black Pommel, Silver Lion, Wine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
- Give worn equipment real **abilities**: triggers active while the card is worn, rule modifiers that content queries read, and an `onUnequip` hook.
- Make seven horses (Hua Liu included), Crossbow, Black Pommel and Wine playable. Give Silver Lion its damage cap and parting heal.
- Let a dying seat save itself with Wine.
- The deck goes from 91 to 106 cards: horses +7, Crossbow +2, Black Pommel +1, Wine +5.

**Architecture:**
- **The engine.**
  - `CardDefinition.abilities = { triggers?, modifiers? }`. The engine gathers a worn card's triggers after the mode's and the Generals'. Their owner is `{ kind: 'equipment', seatId, cardInstanceId }`, and General owners gain `kind: 'general'`.
  - Trigger `condition` and `effect` receive the registry as a 4th argument, so content can read worn cards' modifiers inside a trigger.
  - `CardDefinition.onUnequip` runs for the former wearer whenever a card leaves an equip zone. It runs after the move's own after-triggers.
  - `SetTurnFlagEffect` can also clear a flag (`value: false`).
  - `DyingEffect.rescueCardIds` becomes `{ any, self }`. Cards in `self` save only the dying seat itself.
- **Content.**
  - `shared/abilities.ts` has `activeAbilities` and `armorIgnored`. `shaLimit` reads `modifiers.shaLimit`.
  - Horses, Crossbow and Black Pommel are built with `makeEquipmentCard`. Silver Lion gets a `before:DamageEffect` cap and an `onUnequip` heal.
  - Wine sets a turn flag. The next proactive Sha deals 2 and clears the flag.
  - Guozhan rescues with `{ any: ['peach'], self: ['wine'] }`.
- **Around the engine.**
  - **Bots:** Wine before a Sha, Sha whenever the engine offers one (so Crossbow repeats), Peach before Wine when dying.
  - **App:** the dying prompt mentions Wine when you can use it.

**Tech Stack:** TypeScript, Jest (ts-jest), Angular 22 (app task).

**Spec:**
- `docs/superpowers/specs/2026-10-05-cards-a-equipment-and-simple-cards-design.md` (rule text, engine and content changes, bots, testing).
- `docs/superpowers/specs/2026-10-05-all-cards-and-skills-roadmap-design.md`, "Amendments to the Cards A spec (stage 4)": Hua Liu, manual Army/EX printings, and Wine's self-rescue.
- `docs/superpowers/specs/2026-10-05-sha-equipment-design.md`, "Abilities": the `abilities` field shape. The Cards A spec's `triggers` and `EquipmentAbility` fold into it.

**Already built in earlier stages (not redone here):**
- Draw Two.
- Turn flags, with `SetTurnFlagEffect` setting a flag.
- Building the deck from printings.
- `CardMovedEvent.fromZoneId`.
- The printings of the standard-edition equipment.
- The Silver Lion data file.

**Where this plan departs from the specs, and why:**
- **Distance stays slot-based.** `seatDistance` already reads the mount slots. The Sha-Equipment spec's `distanceToOthers` and `distanceFromOthers` modifiers wait for stage 5, which needs them; no stage 4 card does.
- **Only `shaLimit` and `ignoresArmor` modifiers now.** Conversions and the other modifiers come with stage 5.
- **The owner type keeps its name.** It stays `TriggerOwner`, now a union with `kind`. The rename to `AbilityOwner`, and the General's `skillId`, come with stage 6's skill engine, which defines them. Renaming now would churn every trigger for no behaviour.
- **Triggers get the registry as an optional 4th argument.** The Cards A spec kept a content-side map of abilities because triggers had no registry. The Sha-Equipment spec drops that map in favour of `activeAbilities(state, seatId, registry)`. Passing the registry lets Silver Lion check Black Pommel without the map.
- **A dead seat's Silver Lion doesn't heal it.** When a seat is eliminated, its cards are discarded (stage 3's rule). The parting heal skips an eliminated former wearer.

## Global Constraints

- **The engine names no card or skill.** Content supplies everything card-specific (CLAUDE.md, "Extensibility").
- **Game state stays plain serialisable data.** Clearing the last turn flag leaves `Turn.flags` absent, not `{}`.
- **Printings (own printings only; rows marked † are added by hand):**
  - Di Lu ♣5, Shadow Runner ♠5, Storm Runner ♥K, Hua Liu ♦K †, Red Hare ♥5, Da Yuan ♠K, Zi Xing ♦K
  - Crossbow ♣A ♦A, Black Pommel ♠6
  - Wine ♠3 ♠9 ♣3 ♣9 ♦9
  - † also added now, for stage 5: Ancient Scimitar ♠A, Ice Sword ♠2, Wood Armor ♠2 ♣2, Black Shield ♣2
  - Each † file's `source` gets `"printingsFrom": "army/EX printing list (manual, not crawled)"`.
- **Rule text (Cards A spec, plus the roadmap's amendments):**
  - **Defensive mounts (+1): Di Lu, Shadow Runner, Storm Runner, Hua Liu.** While worn, every other seat's distance to you is 1 greater. **Offensive mounts (−1): Red Hare, Da Yuan, Zi Xing.** While worn, your distance to every other seat is 1 smaller, never below 1. One card per slot: whatever fills the slot is discarded first. The slot comes from the data's `mount` field.
  - **Crossbow** (weapon, range 1): while worn, you may play any number of Sha in your Play Phase. The limit is checked when you play. Equip it after your first Sha and you may play more. Lose it after playing one and the one-per-turn limit applies again.
  - **Black Pommel** (weapon, range 2): while worn, the target's armour has no effect on damage dealt by your Sha.
  - **Silver Lion:**
    - **Damage cap:** when you would take damage greater than 1, you take 1 instead. This doesn't apply to damage from a Sha whose user wears Black Pommel.
    - **Parting heal:** when Silver Lion leaves your equipment for any reason, you recover 1 health, up to your max. This happens after the move.
  - **Wine** (basic):
    - At most one Wine per turn, with no target.
    - The next Sha you play this turn deals 1 extra damage.
    - The boost is spent the moment you play a Sha, even if that Sha is dodged. It lapses unused at the end of your turn.
    - Wine doesn't affect a Sha played as a response.
  - **Wine's self-rescue:** while **you** are dying, you may play a Wine on yourself to recover 1 HP. You can't use Wine to save another seat.
    - A Wine played as a rescue is a response. It sets no turn flag and doesn't count toward the one-Wine-per-turn limit.
    - The dying seat is asked even when it holds neither card.
  - **Interactions:**
    - A Wine-boosted Sha (2) against Silver Lion deals 1. With Black Pommel it deals 2.
    - Black Pommel doesn't help against Silver Lion with non-Sha damage.
    - The Sha limit counts only proactive plays (`turn.cardPlays.sha`).
- **Bots (Cards A spec, plus the roadmap):**
  - **Equip:** only into an empty slot, as today.
  - **Wine:** only when a Sha at a non-ally is legal right now. The Sha follows.
  - **Sha:** the `shaPlayed === 0` check is dropped, so a Sha is played whenever the engine offers one at a non-ally (Crossbow repeats). The safety cap still ends the turn.
  - **Discard ranking:** Wine and Draw Two rank with Sha (2). Equipment stays at 1.
  - **Dying:** a dying bot plays Wine on itself only when it has no Peach.
- **UI text** follows CLAUDE.md's UI text style. The dying prompt for yourself reads "Play a Peach or Wine to save yourself?" when you hold a Wine.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A seat eliminated while wearing Silver Lion.** Its cards are discarded, and the parting heal must not raise a dead seat's HP. (Test in Task 4.)
2. **Crossbow lost mid-turn after one Sha.** No further Sha is legal until the next turn. Crossbow equipped after the first Sha allows more. (Test in Task 3.)
3. **Wine spent on a dodged Sha.** The next Sha that turn (Crossbow) deals 1, not 2. (Test in Task 5.)
4. **A seat holding only Wine while another seat is dying.** It is never asked. The dying seat itself, holding Wine, is asked and saved. (Tests in Tasks 2 and 5.)
5. **Silver Lion taken by Steal into another hand.** The move has no public card face, and the former wearer still heals. (Test in Task 4.)

---

## File Structure

**Engine (`projects/engine/src/lib/`)**
- Modify:
  - `registry/types.ts` (`Abilities`, `AbilityModifiers`, `UnequipContext`, `CardDefinition.abilities` and `onUnequip`, the `TriggerOwner` union, the registry argument on triggers)
  - `skills/triggers.ts` (gathering worn equipment)
  - `pipeline/resolve.ts` (pass the registry to triggers; `onUnequip`)
  - `pipeline/effects.ts` (`SetTurnFlagEffect.value`, `DyingEffect.rescueCardIds`)
- Create: `skills/equipmentAbilities.spec.ts`.
- Modify tests: `skills/triggers.spec.ts`, `pipeline/judgment.spec.ts`, `pipeline/dying.spec.ts`.

**Content (`projects/content/src/lib/`)**
- Create: `shared/abilities.ts`, `cards/wine.ts`, `cards/equipment-abilities.spec.ts`, `cards/wine.spec.ts`.
- Modify: `cards/equipment.ts`, `cards/sha.ts`, `shared/queries.ts`, `modes/guozhan.ts`, `registry.ts`, and the tests `registry.spec.ts`, `wiki.spec.ts`, `modes/guozhan.spec.ts`.
- Data: modify `data/cards/equipment/horse/hua-liu.json`, `weapon/ancient-scimitar.json`, `weapon/ice-sword.json`, `armor/wood-armor.json`, `armor/black-shield.json`.

**Bots:** modify `projects/bots/src/lib/rule-based.ts` and `rule-based.spec.ts`.

**App:** modify `projects/app/src/app/game-board/response-description.ts` (+spec).

**Docs:** modify `docs/architecture/event-chain.md`.

---

### Task 1: Equipment abilities and `onUnequip` in the engine

**Files:**
- Modify: `projects/engine/src/lib/registry/types.ts`, `skills/triggers.ts`, `pipeline/resolve.ts`
- Create: `projects/engine/src/lib/skills/equipmentAbilities.spec.ts`
- Modify: `projects/engine/src/lib/skills/triggers.spec.ts` (owner literals gain `kind: 'general'`)

**Interfaces:**
- Produces:

```ts
export interface AbilityModifiers { shaLimit?: number; ignoresArmor?: boolean }
export interface Abilities { triggers?: SkillTrigger[]; modifiers?: AbilityModifiers }
export interface UnequipContext { seatId: string; cardInstanceId: string }
// CardDefinition gains:
abilities?: Abilities;
onUnequip?(state: GameState, ctx: UnequipContext): unknown[];
export type TriggerOwner =
  | { kind: 'general'; seatId: string; slot: 'main' | 'deputy' }
  | { kind: 'equipment'; seatId: string; cardInstanceId: string };
// SkillTrigger:
condition(state: GameState, subject: unknown, owner?: TriggerOwner, registry?: ContentRegistry): boolean;
effect(state: GameState, subject: unknown, owner?: TriggerOwner, registry?: ContentRegistry): unknown[];
```

- [ ] **Step 1: Write the failing tests**

Create `projects/engine/src/lib/skills/equipmentAbilities.spec.ts`:

```ts
import { gatherTriggeredSkills } from './triggers';
import { advanceToDecision } from '../pipeline/resolve';
import { createRng } from '../rng/rng';
import { CardInstance, GameState, QueueItem } from '../domain/types';
import { CardDefinition, ContentRegistry, GameModeDefinition, SkillTrigger } from '../registry/types';

const point = 'before:DamageEffect' as const;
const always = (tag: string): SkillTrigger => ({ point, condition: () => true, effect: () => [tag] });

// A worn charm: one trigger, and on leaving the equip zone its former wearer draws 1.
const charm: CardDefinition = {
  id: 'charm', name: 'Charm', category: 'equipment', equipSlot: 'armor', play: () => [],
  abilities: {
    triggers: [{ point, condition: (_s, _x, _o, registry) => !!registry?.cards.has('charm'), effect: () => ['charm'] }],
    modifiers: { shaLimit: 3 },
  },
  onUnequip: (_state, ctx) => [{ kind: 'DrawCardsEffect', seatId: ctx.seatId, count: 1 }],
};
const plain: CardDefinition = { id: 'plain', name: 'Plain', category: 'basic', play: () => [] };
const registry: ContentRegistry = {
  cards: new Map([[charm.id, charm], [plain.id, plain]]),
  generals: new Map([['g1', { id: 'g1', kingdom: 'Wei', maxHp: 4, skills: [{ id: 's', activation: 'auto', triggers: [always('general')] }] }]]),
};
const mode = (triggers: SkillTrigger[] = []): GameModeDefinition => ({
  id: 'stub', setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'], checkWinCondition: () => null, triggers,
});

const card = (instanceId: string, definitionId: string): CardInstance => ({ instanceId, definitionId, suit: 'spade', rank: 5 });

function table(o: { equipA?: CardInstance[]; handA?: CardInstance[]; eliminatedA?: boolean; queue?: QueueItem[] } = {}): GameState {
  const seat = (id: string, index: number) => ({
    id, index, kingdom: 'Wei' as const,
    generals: { main: { generalDefinitionId: 'g1', revealed: true }, deputy: { generalDefinitionId: 'none', revealed: true } },
    combinedHp: 4, maxCombinedHp: 4, eliminated: id === 'seat-a' && !!o.eliminatedA,
    hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` },
  });
  return {
    seats: [seat('seat-a', 0), seat('seat-b', 1)],
    players: [], turn: { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [] }, phase: 'Play',
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: [card('d1', 'plain'), card('d2', 'plain')] },
      { id: 'discardPile', kind: 'discardPile', cards: [] },
      { id: 'seat-a:hand', kind: 'hand', ownerSeatId: 'seat-a', cards: o.handA ?? [] },
      { id: 'seat-a:equip', kind: 'equip', ownerSeatId: 'seat-a', cards: o.equipA ?? [] },
      { id: 'seat-b:hand', kind: 'hand', ownerSeatId: 'seat-b', cards: [] },
      { id: 'seat-b:equip', kind: 'equip', ownerSeatId: 'seat-b', cards: [] },
    ],
    pendingResponse: null, ...(o.queue ? { resolutionQueue: o.queue } : {}),
    log: [], rng: createRng(1), result: null, generalSelection: null,
  };
}

describe('equipment abilities', () => {
  it('gathers a worn card’s triggers after the mode’s and the Generals’, with an equipment owner', () => {
    const found = gatherTriggeredSkills(table({ equipA: [card('c1', 'charm')] }), registry, mode([always('mode')]), point, {});
    expect(found.map((g) => g.owner)).toEqual([
      undefined,
      { kind: 'general', seatId: 'seat-a', slot: 'main' },
      { kind: 'general', seatId: 'seat-b', slot: 'main' },
      { kind: 'equipment', seatId: 'seat-a', cardInstanceId: 'c1' },
    ]);
  });

  it('gathers nothing from a card in hand, or from an eliminated wearer', () => {
    const owners = (s: GameState) => gatherTriggeredSkills(s, registry, mode(), point, {}).filter((g) => g.owner?.kind === 'equipment');
    expect(owners(table({ handA: [card('c1', 'charm')] }))).toEqual([]);
    expect(owners(table({ equipA: [card('c1', 'charm')], eliminatedA: true }))).toEqual([]);
  });

  it('passes the registry to a trigger’s condition', () => {
    // The charm's condition is true only when it is given the registry.
    const found = gatherTriggeredSkills(table({ equipA: [card('c1', 'charm')] }), registry, mode(), point, {});
    expect(found.some((g) => g.owner?.kind === 'equipment')).toBe(true);
  });

  it('runs onUnequip for the former wearer after a card leaves an equip zone, after the move’s after-triggers', () => {
    const healOnMove: SkillTrigger = {
      point: 'after:CardMovedEvent', condition: () => true,
      effect: () => [{ kind: 'HealEffect', target: { kind: 'seat', seatId: 'seat-b' }, amount: 1 }],
    };
    const s = table({ equipA: [card('c1', 'charm')], queue: [{ kind: 'MoveCardEffect', cardInstanceId: 'c1', toZoneId: 'seat-b:hand' }] });
    const next = advanceToDecision(s, { registry, mode: mode([healOnMove]) }).state;
    expect(next.log.map((e) => e.kind)).toEqual(['CardMovedEvent', 'HealEvent', 'CardsDrawnEvent']);
    expect(next.log[2]).toMatchObject({ kind: 'CardsDrawnEvent', seatId: 'seat-a' });
  });

  it('runs no onUnequip for a move that doesn’t leave an equip zone', () => {
    const s = table({ handA: [card('c1', 'charm')], queue: [{ kind: 'MoveCardEffect', cardInstanceId: 'c1', toZoneId: 'discardPile' }] });
    const next = advanceToDecision(s, { registry, mode: mode() }).state;
    expect(next.log.map((e) => e.kind)).toEqual(['CardMovedEvent']);
  });

  it('runs onUnequip for every worn card a zone discard moves', () => {
    const s = table({ equipA: [card('c1', 'charm'), card('c2', 'charm')], queue: [{ kind: 'DiscardZoneEffect', zoneId: 'seat-a:equip' }] });
    const next = advanceToDecision(s, { registry, mode: mode() }).state;
    expect(next.log.filter((e) => e.kind === 'CardsDrawnEvent')).toHaveLength(2);
  });
});
```

In `projects/engine/src/lib/skills/triggers.spec.ts`, owners are now tagged. Change the owner literals at the lines that read `{ seatId: 'seat-a', slot: 'main' }` (two places) and `{ seatId: 'seat-b', slot: 'main' }` to include `kind: 'general'` first, e.g. `{ kind: 'general', seatId: 'seat-a', slot: 'main' }`.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx jest projects/engine/src/lib/skills`
Expected: FAIL. No equipment owners are gathered, General owners have no `kind`, and nothing runs on unequip.

- [ ] **Step 3: The types**

In `projects/engine/src/lib/registry/types.ts`:

Replace the `TriggerOwner` interface with:

```ts
// Who a gathered trigger acts for. A General's skill: the seat and slot it was
// gathered for (the same General can be held by more than one seat, so a skill
// must never search GameState for its own id). A worn card: its wearer and the
// card. `owner` is undefined only for a mode's own triggers.
export type TriggerOwner =
  | { kind: 'general'; seatId: string; slot: 'main' | 'deputy' }
  | { kind: 'equipment'; seatId: string; cardInstanceId: string };
```

Change `SkillTrigger` to:

```ts
export interface SkillTrigger {
  point: TriggerPoint;
  // `registry` lets content read worn cards' abilities (e.g. Black Pommel).
  condition(state: GameState, subject: unknown, owner?: TriggerOwner, registry?: ContentRegistry): boolean;
  effect(state: GameState, subject: unknown, owner?: TriggerOwner, registry?: ContentRegistry): unknown[];
}
```

Add after `SkillTrigger`:

```ts
// Rule changes a worn card gives its wearer. Content's queries read them; the
// engine never does.
export interface AbilityModifiers {
  // Sha plays allowed per turn: the highest wins; Infinity = no limit (Crossbow).
  shaLimit?: number;
  // The wearer's Sha ignores the target's armour (Black Pommel).
  ignoresArmor?: boolean;
}

// What a card does while worn.
export interface Abilities {
  triggers?: SkillTrigger[];
  modifiers?: AbilityModifiers;
}

export interface UnequipContext {
  // The former wearer, and the card that left its equipment.
  seatId: string;
  cardInstanceId: string;
}
```

Add to `CardDefinition`, after `onCleanup`:

```ts
  // Active while the card is worn (in an equip zone); the wearer owns them.
  abilities?: Abilities;
  // Resolved for the former wearer right after the card leaves an equip zone,
  // for any reason (Silver Lion's parting heal).
  onUnequip?(state: GameState, ctx: UnequipContext): unknown[];
```

- [ ] **Step 4: Gather worn equipment**

In `projects/engine/src/lib/skills/triggers.ts`, change the General push to tag the owner, add the equipment loop, and pass the registry to conditions:

```ts
            candidates.push({ trigger, owner: { kind: 'general', seatId: seat.id, slot } });
```

and, after the Generals loop:

```ts
  // Worn equipment, after every General: in seat order, then zone order. An
  // eliminated seat's cards are out of the game.
  for (const seat of state.seats) {
    if (seat.eliminated) continue;
    const worn = state.zones.find((z) => z.id === seat.equipped.zoneId)?.cards ?? [];
    for (const card of worn) {
      for (const trigger of registry.cards.get(card.definitionId)?.abilities?.triggers ?? []) {
        if (trigger.point === point) {
          candidates.push({ trigger, owner: { kind: 'equipment', seatId: seat.id, cardInstanceId: card.instanceId } });
        }
      }
    }
  }

  return candidates.filter((candidate) => candidate.trigger.condition(state, subject, candidate.owner, registry));
```

Update the `GatheredTrigger` comment to "the General or worn card it was gathered for".

- [ ] **Step 5: Pass the registry to effects, and run `onUnequip`**

In `projects/engine/src/lib/pipeline/resolve.ts`:
- In `afterTriggerFollowUps`, call `gathered.trigger.effect(state, event, gathered.owner, ctx.registry)`.
- In `resolveEffect`'s before-trigger loop, call `gathered.trigger.effect(state, current, gathered.owner, ctx.registry)`.
- Import `EngineEvent` from `./events` (it is already imported as types there; add it if missing). Add:

```ts
// Cards that just left an equip zone: each one's onUnequip runs for its former
// wearer, after the moves' own after-triggers (Silver Lion's parting heal). A
// trigger can't do this: once the card has left, its triggers aren't gathered.
function unequipFollowUps(before: GameState, after: GameState, events: GameEvent[], registry: ContentRegistry): QueueItem[] {
  const followUps: QueueItem[] = [];
  for (const event of events as EngineEvent[]) {
    if (event.kind !== 'CardMovedEvent') continue;
    const from = before.zones.find((z) => z.id === event.fromZoneId);
    if (from?.kind !== 'equip' || !from.ownerSeatId) continue;
    const card = after.zones.flatMap((z) => z.cards).find((c) => c.instanceId === event.cardInstanceId);
    const definition = card && registry.cards.get(card.definitionId);
    if (definition?.onUnequip) {
      followUps.push(...(definition.onUnequip(after, { seatId: from.ownerSeatId, cardInstanceId: event.cardInstanceId }) as QueueItem[]));
    }
  }
  return followUps;
}
```

- Change the last line of `resolveEffect` to:

```ts
  const followUps = [...afterTriggerFollowUps(applied.state, applied.events, ctx), ...unequipFollowUps(state, applied.state, applied.events, ctx.registry)];
  return { state: queueFront(applied.state, followUps), events: applied.events };
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx jest projects/engine`
Expected: PASS.

Run: `npx jest projects/content`
Expected: PASS. General skills only read `owner.seatId`, which both owner kinds have.

- [ ] **Step 7: Commit**

```bash
git add projects/engine
git commit -m "feat(engine): worn equipment's abilities and onUnequip

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Clearing a turn flag; self-only rescue cards in the dying round

**Files:**
- Modify: `projects/engine/src/lib/pipeline/effects.ts`
- Modify: `projects/content/src/lib/modes/guozhan.ts` (`RESCUE_CARD_IDS` shape only; Wine joins in Task 5)
- Test: `projects/engine/src/lib/pipeline/judgment.spec.ts` (turn-flag tests), `projects/engine/src/lib/pipeline/dying.spec.ts`
- Modify fixtures: `projects/sim/src/invariants.spec.ts`, `projects/app/src/app/game-board/response-description.spec.ts` (`rescueCardIds` literals)

**Interfaces:**
- Produces:
  - `{ kind: 'SetTurnFlagEffect'; flag: string; value?: boolean }`. When `value` is absent or `true`, the flag is set; when `false`, it is cleared.
  - `DyingEffect.rescueCardIds: { any: string[]; self: string[] }`.
  - `RESCUE_CARD_IDS: { any: string[]; self: string[] }` in content.

- [ ] **Step 1: Write the failing tests**

Append to `describe('turn flags', …)` in `projects/engine/src/lib/pipeline/judgment.spec.ts`:

```ts
  it('SetTurnFlagEffect with value false clears a flag, and leaves no empty flags behind', () => {
    const set = applyEffect(table({ flags: { wine: true, skipPlay: true } }), { kind: 'SetTurnFlagEffect', flag: 'wine', value: false }).state;
    expect(set.turn.flags).toEqual({ skipPlay: true });
    const cleared = applyEffect(table({ flags: { wine: true } }), { kind: 'SetTurnFlagEffect', flag: 'wine', value: false }).state;
    expect(cleared.turn).not.toHaveProperty('flags');
    expect(applyEffect(table(), { kind: 'SetTurnFlagEffect', flag: 'wine', value: false }).state.turn).not.toHaveProperty('flags');
  });
```

In `projects/engine/src/lib/pipeline/dying.spec.ts`:
- Add a stand-in Wine to the registry: `['wine', { id: 'wine', name: 'Wine', category: 'basic', play: () => [] }]`.
- Change both `rescueCardIds: ['peach']` to `rescueCardIds: { any: ['peach'], self: ['wine'] }`.
- Append:

```ts
describe('self-only rescue cards', () => {
  const wine = (instanceId: string): CardInstance => ({ instanceId, definitionId: 'wine', suit: 'spade', rank: 9 });

  it('the dying seat may answer with a self-only card; another seat may not', () => {
    // seat-b (turn owner) holds a Peach, so it is asked first, for Peach only.
    const first = dying(state(0, { 'seat-b': [peach('p1')], 'seat-c': [wine('w1')] }));
    expect(first.pendingResponse).toMatchObject({ respondingSeatId: 'seat-b', allowedCardIds: ['peach'] });
    const own = pass(first);
    expect(own.pendingResponse).toMatchObject({ respondingSeatId: 'seat-c', allowedCardIds: ['peach', 'wine'] });
    const saved = givePeach(own, 'w1');
    expect(hpOf(saved)).toBe(1);
    expect(saved.log).toContainEqual({ kind: 'SeatSavedEvent', seatId: 'seat-c' });
  });

  it('never asks a seat that holds only a self-only card (Review Focus 4)', () => {
    const s = dying(state(0, { 'seat-d': [wine('w1')] }));
    // seat-b has nothing; the dying seat-c is asked; seat-d (Wine only) is skipped.
    expect(asked(s)).toBe('seat-c');
    const next = pass(s);
    expect(next.seats.find((x) => x.id === 'seat-c')!.eliminated).toBe(true);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx jest projects/engine/src/lib/pipeline/judgment.spec.ts projects/engine/src/lib/pipeline/dying.spec.ts`
Expected: FAIL. The flag isn't cleared, and the dying round reads `rescueCardIds` as an array.

- [ ] **Step 3: Implement**

In `projects/engine/src/lib/pipeline/effects.ts`:
- Change the union member to:

```ts
  // Sets a flag of the current turn (e.g. skipFlagOf('Play')), or clears it
  // with `value: false`. Flags end with the turn.
  | { kind: 'SetTurnFlagEffect'; flag: string; value?: boolean }
```

- Replace its `applyEffect` case with:

```ts
    case 'SetTurnFlagEffect': {
      const { [effect.flag]: _previous, ...others } = state.turn.flags ?? {};
      const flags = effect.value === false ? others : { ...others, [effect.flag]: true };
      const { flags: _old, ...turn } = state.turn;
      return { state: { ...state, turn: Object.keys(flags).length > 0 ? { ...turn, flags } : turn }, events: [] };
    }
```

- Change the `DyingEffect` member's comment and type:

```ts
  // The dying round for `seatId`: ask the seats in `order` (turn order from the
  // turn owner) one at a time. Any seat may save it with `rescueCardIds.any`
  // (Peach); only the dying seat itself may also use `rescueCardIds.self`
  // (Wine). Content says which. See the Peach and dying spec.
  | { kind: 'DyingEffect'; seatId: string; order: string[]; rescueCardIds: { any: string[]; self: string[] }; entering?: boolean }
```

- In `applyDying`, replace `holdsRescue` and the window's `allowedCardIds`:

```ts
  // Other seats are asked only while they hold a card that may save someone else.
  const holdsRescue = (seatId: string) => {
    const s = state.seats.find((x) => x.id === seatId);
    const hand = s && state.zones.find((z) => z.id === s.hand.zoneId);
    return !!hand?.cards.some((c) => effect.rescueCardIds.any.includes(c.definitionId));
  };
```

```ts
    allowedCardIds: askerId === seat.id ? [...effect.rescueCardIds.any, ...effect.rescueCardIds.self] : effect.rescueCardIds.any,
```

In `projects/content/src/lib/modes/guozhan.ts`, change:

```ts
// Cards that can save a dying seat: any seat's Peach; Wine (Task 5) only on yourself.
export const RESCUE_CARD_IDS = { any: ['peach'], self: [] as string[] };
```

In `projects/sim/src/invariants.spec.ts` and `projects/app/src/app/game-board/response-description.spec.ts`, change `rescueCardIds: ['peach']` to `rescueCardIds: { any: ['peach'], self: [] }`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest`
Expected: PASS, every project.

- [ ] **Step 5: Commit**

```bash
git add projects
git commit -m "feat(engine): clear a turn flag; rescue cards only the dying seat may use

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Horses, Crossbow and Black Pommel; the Sha limit from abilities

**Files:**
- Create: `projects/content/src/lib/shared/abilities.ts`, `projects/content/src/lib/cards/equipment-abilities.spec.ts`
- Modify: `projects/content/src/lib/cards/equipment.ts`, `shared/queries.ts`, `registry.ts`, `registry.spec.ts`, `wiki.spec.ts`, `modes/guozhan.spec.ts`
- Data: `projects/content/data/cards/equipment/horse/hua-liu.json`, `weapon/ancient-scimitar.json`, `weapon/ice-sword.json`, `armor/wood-armor.json`, `armor/black-shield.json`

**Interfaces:**
- Consumes: `Abilities` and `AbilityModifiers` (Task 1).
- Produces:
  - `activeAbilities(state: GameState, seatId: string, registry: ContentRegistry): Abilities[]` (`shared/abilities.ts`).
  - `makeEquipmentCard(id, name, slot, weaponRange?, extras?: { abilities?: Abilities; onUnequip?: CardDefinition['onUnequip'] })`.
  - Exports from `cards/equipment.ts`: `horseCards: CardDefinition[]`, `crossbowCard`, `blackPommelCard`.

- [ ] **Step 1: Add the hand-made printings**

Edit each file's `printings` and `source`. Keep every other field.
- `horse/hua-liu.json`: `"printings": [{ "rank": 13, "suit": "diamond" }]`
- `weapon/ancient-scimitar.json`: `"printings": [{ "rank": 1, "suit": "spade" }]`
- `weapon/ice-sword.json`: `"printings": [{ "rank": 2, "suit": "spade" }]`
- `armor/wood-armor.json`: `"printings": [{ "rank": 2, "suit": "spade" }, { "rank": 2, "suit": "club" }]`
- `armor/black-shield.json`: `"printings": [{ "rank": 2, "suit": "club" }]`

In each one's `source` object, add `"printingsFrom": "army/EX printing list (manual, not crawled)"`.

- [ ] **Step 2: Write the failing tests**

Create `projects/content/src/lib/cards/equipment-abilities.spec.ts`:

```ts
import { getLegalActions, resolve } from 'engine';
import type { CardDefinition, CardInstance, ContentRegistry, GameModeDefinition, GameState } from 'engine';
import { blackPommelCard, crossbowCard, equipSlotOf, horseCards, silverLionCard, greenDragonBladeCard } from './equipment';
import { shaCard } from './sha';
import { attackRange, seatDistance, shaLimit } from '../shared/queries';

const plain = (id: string): CardDefinition => ({ id, name: id, category: 'basic', play: () => [] });
const cards: CardDefinition[] = [...horseCards, crossbowCard, blackPommelCard, silverLionCard, greenDragonBladeCard, shaCard, plain('shan')];
const registry: ContentRegistry = { cards: new Map(cards.map((c) => [c.id, c])), generals: new Map() };
const mode: GameModeDefinition = { id: 'stub', setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'], checkWinCondition: () => null, triggers: [] };
const ctx = { registry, mode };

const card = (instanceId: string, definitionId: string, suit: CardInstance['suit'] = 'spade', rank = 7): CardInstance => ({ instanceId, definitionId, suit, rank });

// Four seats round the table, all at 4/4 HP; seat-a's Play phase. Each seat has
// a hand, equipment and Judgment slot; `cards` fills zones by id.
function table(cards: Record<string, CardInstance[]> = {}, hp: Record<string, number> = {}): GameState {
  const ids = ['seat-a', 'seat-b', 'seat-c', 'seat-d'];
  return {
    seats: ids.map((id, index) => ({
      id, index, kingdom: (['Wei', 'Shu', 'Wu', 'Qun'] as const)[index], eliminated: false,
      generals: { main: { generalDefinitionId: `${id}-m`, revealed: true }, deputy: { generalDefinitionId: `${id}-d`, revealed: true } },
      combinedHp: hp[id] ?? 4, maxCombinedHp: 4,
      hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` },
    })),
    players: [], turn: { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [] }, phase: 'Play',
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: cards['drawPile'] ?? [] },
      { id: 'discardPile', kind: 'discardPile', cards: cards['discardPile'] ?? [] },
      { id: 'processing', kind: 'processing', cards: [] },
      ...ids.flatMap((id) => [
        { id: `${id}:hand`, kind: 'hand' as const, ownerSeatId: id, cards: cards[`${id}:hand`] ?? [] },
        { id: `${id}:equip`, kind: 'equip' as const, ownerSeatId: id, cards: cards[`${id}:equip`] ?? [] },
        { id: `${id}:judgment`, kind: 'judgment' as const, ownerSeatId: id, cards: [] },
      ]),
    ],
    pendingResponse: null, log: [], rng: { seed: 1, counter: 0 }, result: null, generalSelection: null,
  };
}

const playSha = (s: GameState, cardInstanceId: string, target: string) =>
  resolve(s, { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId, targets: [{ kind: 'seat', seatId: target }] }, ctx).state;
const pass = (s: GameState) => resolve(s, { kind: 'PassAction', seatId: s.pendingResponse!.respondingSeatId, pendingResponseId: s.pendingResponse!.id }, ctx).state;
const equip = (s: GameState, cardInstanceId: string) => resolve(s, { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId, targets: [] }, ctx).state;
const shaPlays = (s: GameState) => getLegalActions(s, 'seat-a', registry).filter((a) => a.kind === 'PlayCardAction' && s.zones.some((z) => z.cards.some((c) => c.instanceId === a.cardInstanceId && c.definitionId === 'sha')));

describe('horses', () => {
  it('each equips into the mount slot its data names; Hua Liu is defensive', () => {
    const slots = Object.fromEntries(horseCards.map((h) => [h.id, h.equipSlot]));
    expect(slots).toEqual({
      'di-lu': 'defensiveMount', 'shadow-runner': 'defensiveMount', 'storm-runner': 'defensiveMount', 'hua-liu': 'defensiveMount',
      'red-hare': 'offensiveMount', 'da-yuan': 'offensiveMount', 'zi-xing': 'offensiveMount',
    });
    expect(equipSlotOf('hua-liu')).toBe('defensiveMount');
  });

  it('a defensive mount puts its wearer 1 further from everyone else', () => {
    const s = table({ 'seat-b:equip': [card('h', 'hua-liu')] });
    expect(seatDistance(s, 'seat-a', 'seat-b', registry)).toBe(2);
    expect(seatDistance(s, 'seat-b', 'seat-a', registry)).toBe(1);
  });

  it('an offensive mount brings everyone 1 closer to its wearer, never below 1', () => {
    const s = table({ 'seat-a:equip': [card('h', 'red-hare')] });
    expect(seatDistance(s, 'seat-a', 'seat-c', registry)).toBe(1);
    expect(seatDistance(s, 'seat-a', 'seat-b', registry)).toBe(1);
  });

  it('replaces the mount already in that slot', () => {
    const next = equip(table({ 'seat-a:hand': [card('h2', 'zi-xing')], 'seat-a:equip': [card('h1', 'red-hare')] }), 'h2');
    expect(next.zones.find((z) => z.id === 'seat-a:equip')!.cards.map((c) => c.instanceId)).toEqual(['h2']);
    expect(next.zones.find((z) => z.id === 'discardPile')!.cards.map((c) => c.instanceId)).toEqual(['h1']);
  });
});

describe('Crossbow', () => {
  it('is a range 1 weapon that lifts the Sha limit while worn', () => {
    expect(crossbowCard.equipSlot).toBe('weapon');
    expect(attackRange(table({ 'seat-a:equip': [card('x', 'crossbow')] }), 'seat-a', registry)).toBe(1);
    expect(shaLimit(table({ 'seat-a:equip': [card('x', 'crossbow')] }), 'seat-a', registry)).toBe(Number.POSITIVE_INFINITY);
    expect(shaLimit(table(), 'seat-a', registry)).toBe(1);
  });

  it('lets you keep playing Sha', () => {
    const s = table({ 'seat-a:hand': [card('s1', 'sha'), card('s2', 'sha')], 'seat-a:equip': [card('x', 'crossbow')] });
    const after = pass(playSha(s, 's1', 'seat-b'));
    expect(shaPlays(after).length).toBeGreaterThan(0);
  });

  it('equipped after your first Sha, allows more; lost after it, the one-per-turn limit is back (Review Focus 2)', () => {
    const s = table({ 'seat-a:hand': [card('s1', 'sha'), card('s2', 'sha'), card('x', 'crossbow')] });
    const once = pass(playSha(s, 's1', 'seat-b'));
    expect(shaPlays(once)).toEqual([]);
    const armed = equip(once, 'x');
    expect(shaPlays(armed).length).toBeGreaterThan(0);
    const disarmed: GameState = {
      ...armed,
      zones: armed.zones.map((z) => (z.id === 'seat-a:equip' ? { ...z, cards: [] } : z.id === 'discardPile' ? { ...z, cards: [...z.cards, card('x', 'crossbow')] } : z)),
    };
    expect(shaPlays(disarmed)).toEqual([]);
  });
});

describe('Black Pommel', () => {
  it('is a range 2 weapon whose wearer ignores armour', () => {
    expect(blackPommelCard.equipSlot).toBe('weapon');
    expect(attackRange(table({ 'seat-a:equip': [card('bp', 'black-pommel')] }), 'seat-a', registry)).toBe(2);
    expect(blackPommelCard.abilities?.modifiers?.ignoresArmor).toBe(true);
  });
});
```

Update the counts:
- `projects/content/src/lib/registry.spec.ts`: add `'black-pommel'`, `'crossbow'`, `'da-yuan'`, `'di-lu'`, `'hua-liu'`, `'red-hare'`, `'shadow-runner'`, `'storm-runner'` and `'zi-xing'` to the expected id list.
- `projects/content/src/lib/modes/guozhan.spec.ts`: `toHaveLength(101)`.
- `projects/content/src/lib/wiki.spec.ts`:
  - The in-game equipment list becomes `['black-pommel', 'crossbow', 'da-yuan', 'di-lu', 'green-dragon-blade', 'hua-liu', 'red-hare', 'shadow-runner', 'silver-lion', 'storm-runner', 'zi-xing']`.
  - In 'includes the crawled EX and Army cards, not yet in the game', remove `'hua-liu'` from `ids`.
  - Change `expect(all.find((c) => c.id === 'black-shield')!.printings).toEqual([]);` to `.toEqual([{ suit: 'club', rank: 2 }])`.

- [ ] **Step 3: Run them to verify they fail**

Run: `npx jest projects/content/src/lib/cards/equipment-abilities.spec.ts`
Expected: FAIL. `horseCards`, `crossbowCard` and `blackPommelCard` aren't exported.

- [ ] **Step 4: Write `shared/abilities.ts`**

```ts
import type { Abilities, ContentRegistry, GameState } from 'engine';

// Every ability active for a seat: those of the cards it wears. (Generals'
// skills join in stage 6.) Queries read modifiers through this, never by card id.
export function activeAbilities(state: GameState, seatId: string, registry: ContentRegistry): Abilities[] {
  const seat = state.seats.find((s) => s.id === seatId);
  const worn = seat ? (state.zones.find((z) => z.id === seat.equipped.zoneId)?.cards ?? []) : [];
  return worn.flatMap((card) => {
    const abilities = registry.cards.get(card.definitionId)?.abilities;
    return abilities ? [abilities] : [];
  });
}
```

- [ ] **Step 5: The Sha limit from abilities**

In `projects/content/src/lib/shared/queries.ts`, add `import { activeAbilities } from './abilities';` and replace `shaLimit`:

```ts
// Sha plays allowed per turn: the highest any active ability allows, else 1.
export function shaLimit(state: GameState, seatId: string, registry: ContentRegistry): number {
  return Math.max(1, ...activeAbilities(state, seatId, registry).map((a) => a.modifiers?.shaLimit ?? 1));
}
```

- [ ] **Step 6: The cards**

In `projects/content/src/lib/cards/equipment.ts`:
- Change the import to `import type { Abilities, CardDefinition, Effect, EquipSlot, GameState } from 'engine';`.
- Give `makeEquipmentCard` an `extras` parameter and export it:

```ts
interface EquipmentExtras {
  abilities?: Abilities;
  onUnequip?: CardDefinition['onUnequip'];
}

export function makeEquipmentCard(id: string, name: string, equipSlot: EquipSlot, weaponRange?: number, extras: EquipmentExtras = {}): CardDefinition {
  EQUIP_SLOT_BY_ID.set(id, equipSlot);
  return {
    id,
    name,
    category: 'equipment',
    equipSlot,
    ...(weaponRange !== undefined ? { weaponRange } : {}),
    ...(extras.abilities ? { abilities: extras.abilities } : {}),
    ...(extras.onUnequip ? { onUnequip: extras.onUnequip } : {}),
    legalPlayTargets: () => [[]],
    // …play unchanged…
  };
}
```

- Append:

```ts
const HORSE_IDS = ['di-lu', 'shadow-runner', 'storm-runner', 'hua-liu', 'red-hare', 'da-yuan', 'zi-xing'];

// Horses: the data's `mount` names the slot. Distance is read from the slot (seatDistance).
export const horseCards: CardDefinition[] = HORSE_IDS.map((id) => {
  const data = cardsData[id];
  if (!data?.mount) throw new Error(`Horse "${id}" has no mount in the data`);
  return makeEquipmentCard(id, data.name, data.mount === 'defensive' ? 'defensiveMount' : 'offensiveMount');
});

// Crossbow: any number of Sha a turn while worn.
export const crossbowCard = makeEquipmentCard('crossbow', 'Crossbow', 'weapon', cardsData['crossbow'].range, {
  abilities: { modifiers: { shaLimit: Number.POSITIVE_INFINITY } },
});

// Black Pommel: the target's armour has no effect on your Sha's damage.
export const blackPommelCard = makeEquipmentCard('black-pommel', 'Black Pommel', 'weapon', cardsData['black-pommel'].range, {
  abilities: { modifiers: { ignoresArmor: true } },
});
```

If `cardsData[...].range` is typed `number | undefined`, pass `?? undefined` through. The existing Green Dragon Blade line shows the pattern that compiles.

In `projects/content/src/lib/registry.ts`, import `horseCards`, `crossbowCard` and `blackPommelCard` from `./cards/equipment`, and add `...horseCards, crossbowCard, blackPommelCard` to `cards`.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx jest projects/content projects/app/src/app/wiki`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add projects/content
git commit -m "feat(content): horses (with Hua Liu), Crossbow and Black Pommel; the Sha limit from worn abilities

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Silver Lion — the damage cap and the parting heal

**Files:**
- Modify: `projects/content/src/lib/shared/abilities.ts` (`armorIgnored`), `cards/equipment.ts` (Silver Lion)
- Test: `projects/content/src/lib/cards/equipment-abilities.spec.ts`

**Interfaces:**
- Consumes: `activeAbilities`, `makeEquipmentCard` extras (Task 3), the registry argument on triggers, and `onUnequip` (Task 1).
- Produces: `armorIgnored(state: GameState, damage: Damage, registry: ContentRegistry): boolean`.

- [ ] **Step 1: Write the failing tests**

Append to `projects/content/src/lib/cards/equipment-abilities.spec.ts`. Add `import { advanceToDecision } from 'engine';` and `import type { Damage, QueueItem } from 'engine';` to the imports.

```ts
describe('Silver Lion', () => {
  const lion = (n = 1) => card(`lion-${n}`, 'silver-lion', 'club', 1);
  const run = (s: GameState, queue: QueueItem[]) => advanceToDecision({ ...s, resolutionQueue: queue }, ctx).state;
  const hp = (s: GameState, seatId: string) => s.seats.find((x) => x.id === seatId)!.combinedHp;
  const hit = (amount: number, causeId?: string, from: string | null = 'seat-a'): QueueItem => ({
    kind: 'DamageEffect',
    damage: { source: from ? { kind: 'seat', seatId: from } : null, target: { kind: 'seat', seatId: 'seat-b' }, amount, nature: 'normal', ...(causeId ? { cause: { cardInstanceId: causeId } } : {}) } as Damage,
  });

  it('caps damage over 1 to 1 for its wearer', () => {
    const next = run(table({ 'seat-b:equip': [lion()] }), [hit(3, undefined, null)]);
    expect(hp(next, 'seat-b')).toBe(3);
  });

  it('leaves 1 damage, and other seats’ damage, alone', () => {
    expect(hp(run(table({ 'seat-b:equip': [lion()] }), [hit(1)]), 'seat-b')).toBe(3);
    expect(hp(run(table({ 'seat-c:equip': [lion()] }), [hit(2)]), 'seat-b')).toBe(2);
  });

  it('doesn’t cap damage from a Sha whose user wears Black Pommel', () => {
    const s = table({ 'seat-b:equip': [lion()], 'seat-a:equip': [card('bp', 'black-pommel')], discardPile: [card('s1', 'sha')] });
    expect(hp(run(s, [hit(2, 's1')]), 'seat-b')).toBe(2);
  });

  it('still caps a Black Pommel wearer’s damage that isn’t from a Sha', () => {
    const s = table({ 'seat-b:equip': [lion()], 'seat-a:equip': [card('bp', 'black-pommel')], discardPile: [card('d1', 'shan')] });
    expect(hp(run(s, [hit(2, 'd1')]), 'seat-b')).toBe(3);
  });

  it('heals its wearer by 1 when it is replaced, up to max', () => {
    const hurt = table({ 'seat-a:hand': [lion(2)], 'seat-a:equip': [lion(1)] }, { 'seat-a': 2 });
    const next = equip(hurt, 'lion-2');
    expect(hp(next, 'seat-a')).toBe(3);
    expect(next.log.map((e) => e.kind)).toEqual(['CardPlayedEvent', 'CardMovedEvent', 'HealEvent', 'CardMovedEvent']);
    const full = equip(table({ 'seat-a:hand': [lion(2)], 'seat-a:equip': [lion(1)] }), 'lion-2');
    expect(hp(full, 'seat-a')).toBe(4);
  });

  it('heals its wearer when taken into another hand, where the move shows no face (Review Focus 5)', () => {
    const s = table({ 'seat-b:equip': [lion()] }, { 'seat-b': 2 });
    const next = run(s, [{ kind: 'MoveCardEffect', cardInstanceId: 'lion-1', toZoneId: 'seat-a:hand' }]);
    expect(hp(next, 'seat-b')).toBe(3);
  });

  it('doesn’t heal a seat that is out (Review Focus 1)', () => {
    const s = table({ 'seat-b:equip': [lion()] }, { 'seat-b': 0 });
    const out: GameState = { ...s, seats: s.seats.map((x) => (x.id === 'seat-b' ? { ...x, eliminated: true } : x)) };
    const next = run(out, [{ kind: 'DiscardZoneEffect', zoneId: 'seat-b:equip' }]);
    expect(hp(next, 'seat-b')).toBe(0);
    expect(next.log.some((e) => e.kind === 'HealEvent')).toBe(false);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx jest projects/content/src/lib/cards/equipment-abilities.spec.ts -t "Silver Lion"`
Expected: FAIL. Damage isn't capped and nothing heals.

- [ ] **Step 3: Implement**

Append to `projects/content/src/lib/shared/abilities.ts`. Add `Damage` to its type import.

```ts
// Whether armour has no effect on `damage`: it comes from a Sha whose user has
// an ability that ignores armour (Black Pommel). The Sha is found by instance
// id in any zone; when damage is dealt it is usually in the discard pile.
export function armorIgnored(state: GameState, damage: Damage, registry: ContentRegistry): boolean {
  const causeId = damage.cause?.cardInstanceId;
  if (!causeId || damage.source?.kind !== 'seat') return false;
  const cause = state.zones.flatMap((z) => z.cards).find((c) => c.instanceId === causeId);
  if (cause?.definitionId !== 'sha') return false;
  return activeAbilities(state, damage.source.seatId, registry).some((a) => a.modifiers?.ignoresArmor);
}
```

In `projects/content/src/lib/cards/equipment.ts`, import `armorIgnored` from `'../shared/abilities'` and replace the `silverLionCard` line:

```ts
type DamageStep = Extract<Effect, { kind: 'DamageEffect' }>;

// Silver Lion: damage over 1 to its wearer becomes 1, unless it comes from a
// Sha whose user ignores armour. When it leaves its wearer's equipment for any
// reason, the wearer recovers 1 HP (not once they're out of the game).
export const silverLionCard = makeEquipmentCard('silver-lion', 'Silver Lion', 'armor', undefined, {
  abilities: {
    triggers: [
      {
        point: 'before:DamageEffect',
        condition: (state, subject, owner, registry) => {
          const { damage } = subject as DamageStep;
          return (
            owner?.kind === 'equipment' &&
            damage.target.kind === 'seat' &&
            damage.target.seatId === owner.seatId &&
            damage.amount > 1 &&
            !(registry && armorIgnored(state, damage, registry))
          );
        },
        effect: (_state, subject) => {
          const step = subject as DamageStep;
          return [{ ...step, damage: { ...step.damage, amount: 1 } }];
        },
      },
    ],
  },
  onUnequip: (state, { seatId }) =>
    state.seats.some((s) => s.id === seatId && !s.eliminated) ? [{ kind: 'HealEffect', target: { kind: 'seat', seatId }, amount: 1 }] : [],
});
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest projects/content`
Expected: PASS. The existing Lightning test in `delayed.spec.ts` has no Silver Lion, so it still deals 3.

- [ ] **Step 5: Commit**

```bash
git add projects/content
git commit -m "feat(content): Silver Lion caps damage at 1 and heals its wearer when it leaves

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Wine — the next Sha's boost, and saving yourself

**Files:**
- Create: `projects/content/src/lib/cards/wine.ts`, `projects/content/src/lib/cards/wine.spec.ts`
- Modify: `projects/content/src/lib/cards/sha.ts`, `modes/guozhan.ts`, `registry.ts`, `registry.spec.ts`, `wiki.spec.ts`, `modes/guozhan.spec.ts`

**Interfaces:**
- Consumes: `SetTurnFlagEffect` with `value: false`, and `rescueCardIds.self` (Task 2). Also Silver Lion and Black Pommel (Tasks 3 and 4).
- Produces:
  - `wineCard`, and `WINE_FLAG = 'wine'`.
  - `shaWindow(shaInstanceId, fromSeatId, target, amount = 1)`.
  - `RESCUE_CARD_IDS = { any: ['peach'], self: ['wine'] }`.

- [ ] **Step 1: Write the failing tests**

Create `projects/content/src/lib/cards/wine.spec.ts`:

```ts
import { advanceToDecision, getLegalActions, resolve } from 'engine';
import type { CardDefinition, CardInstance, ContentRegistry, GameState } from 'engine';
import { guozhanMode, RESCUE_CARD_IDS } from '../modes/guozhan';
import { wineCard } from './wine';
import { shaCard } from './sha';
import { peachCard } from './peach';
import { crossbowCard, blackPommelCard, silverLionCard } from './equipment';

const plain = (id: string): CardDefinition => ({ id, name: id, category: 'basic', play: () => [] });
const cards = [wineCard, shaCard, peachCard, crossbowCard, blackPommelCard, silverLionCard, plain('shan')];
const registry: ContentRegistry = { cards: new Map(cards.map((c) => [c.id, c])), generals: new Map() };
const ctx = { registry, mode: guozhanMode };

const card = (instanceId: string, definitionId: string): CardInstance => ({ instanceId, definitionId, suit: 'spade', rank: 9 });

// Three seats (Wei, Shu, Wu) at 4/4 HP; seat-a's Play phase.
function table(cards: Record<string, CardInstance[]> = {}, hp: Record<string, number> = {}): GameState {
  const ids = ['seat-a', 'seat-b', 'seat-c'];
  return {
    seats: ids.map((id, index) => ({
      id, index, kingdom: (['Wei', 'Shu', 'Wu'] as const)[index], eliminated: false,
      generals: { main: { generalDefinitionId: `${id}-m`, revealed: true }, deputy: { generalDefinitionId: `${id}-d`, revealed: true } },
      combinedHp: hp[id] ?? 4, maxCombinedHp: 4,
      hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` },
    })),
    players: [], turn: { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [] }, phase: 'Play',
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: [] },
      { id: 'discardPile', kind: 'discardPile', cards: [] },
      { id: 'processing', kind: 'processing', cards: [] },
      ...ids.flatMap((id) => [
        { id: `${id}:hand`, kind: 'hand' as const, ownerSeatId: id, cards: cards[`${id}:hand`] ?? [] },
        { id: `${id}:equip`, kind: 'equip' as const, ownerSeatId: id, cards: cards[`${id}:equip`] ?? [] },
        { id: `${id}:judgment`, kind: 'judgment' as const, ownerSeatId: id, cards: [] },
      ]),
    ],
    pendingResponse: null, log: [], rng: { seed: 1, counter: 0 }, result: null, generalSelection: null,
  };
}

const play = (s: GameState, cardInstanceId: string, target?: string) =>
  resolve(s, { kind: 'PlayCardAction', seatId: s.turn.ownerSeatId, cardInstanceId, targets: target ? [{ kind: 'seat', seatId: target }] : [] }, ctx).state;
const pass = (s: GameState) => resolve(s, { kind: 'PassAction', seatId: s.pendingResponse!.respondingSeatId, pendingResponseId: s.pendingResponse!.id }, ctx).state;
const respond = (s: GameState, cardInstanceId: string) =>
  resolve(s, { kind: 'RespondAction', seatId: s.pendingResponse!.respondingSeatId, pendingResponseId: s.pendingResponse!.id, cardInstanceId }, ctx).state;
const hp = (s: GameState, seatId: string) => s.seats.find((x) => x.id === seatId)!.combinedHp;
const wineOffered = (s: GameState) => getLegalActions(s, 'seat-a', registry).some((a) => a.kind === 'PlayCardAction' && a.cardInstanceId.startsWith('w'));

describe('Wine', () => {
  it('is played with no target, at most once a turn', () => {
    const s = table({ 'seat-a:hand': [card('w1', 'wine'), card('w2', 'wine')] });
    expect(getLegalActions(s, 'seat-a', registry)).toContainEqual({ kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'w1', targets: [] });
    const once = play(s, 'w1');
    expect(once.turn.flags).toEqual({ wine: true });
    expect(wineOffered(once)).toBe(false);
  });

  it('makes the next Sha deal 2', () => {
    const s = play(table({ 'seat-a:hand': [card('w1', 'wine'), card('s1', 'sha')] }), 'w1');
    expect(hp(pass(play(s, 's1', 'seat-b')), 'seat-b')).toBe(2);
  });

  it('is spent when the Sha is played, even if it is dodged (Review Focus 3)', () => {
    const s = table({ 'seat-a:hand': [card('w1', 'wine'), card('s1', 'sha'), card('s2', 'sha')], 'seat-a:equip': [card('x', 'crossbow')], 'seat-b:hand': [card('d1', 'shan')] });
    const dodged = respond(play(play(s, 'w1'), 's1', 'seat-b'), 'd1');
    expect(hp(dodged, 'seat-b')).toBe(4);
    expect(dodged.turn).not.toHaveProperty('flags');
    expect(hp(pass(play(dodged, 's2', 'seat-b')), 'seat-b')).toBe(3);
  });

  it('doesn’t boost a Sha played as a response, and keeps the boost for later', () => {
    const boosted = { ...table(), turn: { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [], flags: { wine: true } } };
    expect(shaCard.play(boosted, { seatId: 'seat-a', cardInstanceId: 's1', targets: [], respondingTo: 'x' })).toEqual([]);
  });

  it('lapses at the end of the turn', () => {
    const s = play(table({ 'seat-a:hand': [card('w1', 'wine')] }), 'w1');
    const next = resolve(s, { kind: 'EndPhaseAction', seatId: 'seat-a' }, ctx).state;
    expect(next.turn.ownerSeatId).not.toBe('seat-a');
    expect(next.turn).not.toHaveProperty('flags');
  });

  it('a boosted Sha against Silver Lion deals 1; with Black Pommel it deals 2', () => {
    const plainSha = table({ 'seat-a:hand': [card('w1', 'wine'), card('s1', 'sha')], 'seat-b:equip': [card('l', 'silver-lion')] });
    expect(hp(pass(play(play(plainSha, 'w1'), 's1', 'seat-b')), 'seat-b')).toBe(3);
    const pommel = table({ 'seat-a:hand': [card('w1', 'wine'), card('s1', 'sha')], 'seat-a:equip': [card('bp', 'black-pommel')], 'seat-b:equip': [card('l', 'silver-lion')] });
    expect(hp(pass(play(play(pommel, 'w1'), 's1', 'seat-b')), 'seat-b')).toBe(2);
  });
});

describe('Wine saves only yourself', () => {
  // seat-b at 0 HP enters its dying round with Guozhan's rescue cards, asked from the turn owner, seat-a.
  const dying = (cards: Record<string, CardInstance[]>) =>
    advanceToDecision({ ...table(cards, { 'seat-b': 0 }), resolutionQueue: [{ kind: 'DyingEffect', seatId: 'seat-b', order: ['seat-a', 'seat-b', 'seat-c'], rescueCardIds: RESCUE_CARD_IDS, entering: true }] }, ctx).state;

  it('the dying seat may play a Wine on itself to recover 1 HP; no flag, no play counted', () => {
    const asked = dying({ 'seat-b:hand': [card('w1', 'wine')] });
    expect(asked.pendingResponse).toMatchObject({ respondingSeatId: 'seat-b', allowedCardIds: ['peach', 'wine'] });
    const saved = respond(asked, 'w1');
    expect(hp(saved, 'seat-b')).toBe(1);
    expect(saved.turn).not.toHaveProperty('flags');
    expect(saved.turn.cardPlays?.['wine'] ?? 0).toBe(0);
  });

  it('another seat’s Wine can’t save it (Review Focus 4)', () => {
    const asked = dying({ 'seat-c:hand': [card('w1', 'wine')] });
    expect(asked.pendingResponse?.respondingSeatId).toBe('seat-b');
    const next = pass(asked);
    expect(next.seats.find((x) => x.id === 'seat-b')!.eliminated).toBe(true);
  });

  it('Guozhan’s dying round offers Wine to the dying seat only', () => {
    const asked = dying({ 'seat-a:hand': [card('p1', 'peach'), card('w1', 'wine')] });
    expect(asked.pendingResponse).toMatchObject({ respondingSeatId: 'seat-a', allowedCardIds: ['peach'] });
  });
});
```

Update the counts:
- `projects/content/src/lib/registry.spec.ts`: add `'wine'`.
- `projects/content/src/lib/modes/guozhan.spec.ts`: `toHaveLength(106)`.
- `projects/content/src/lib/wiki.spec.ts`: the basic not-in-game list becomes `['fire-attack', 'lightning-attack']`.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx jest projects/content/src/lib/cards/wine.spec.ts`
Expected: FAIL. `./wine` doesn't exist.

- [ ] **Step 3: Implement**

Create `projects/content/src/lib/cards/wine.ts`:

```ts
import type { CardDefinition } from 'engine';

// The turn flag Wine sets: the next proactive Sha this turn deals 1 extra damage.
export const WINE_FLAG = 'wine';

// Wine: once a turn, with no target, boosts the next Sha you play this turn.
// As a rescue (only on yourself, in your own dying round) it does nothing
// itself: the dying window heals you, and no turn flag is set.
export const wineCard: CardDefinition = {
  id: 'wine',
  name: 'Wine',
  category: 'basic',
  legalPlayTargets: (state) => ((state.turn.cardPlays?.['wine'] ?? 0) < 1 ? [[]] : []),
  play: (_state, ctx) => (ctx.respondingTo ? [] : [{ kind: 'SetTurnFlagEffect', flag: WINE_FLAG }]),
};
```

In `projects/content/src/lib/cards/sha.ts`:
- `import { WINE_FLAG } from './wine';`
- Give `shaWindow` an `amount` parameter (default `1`) and use it in the damage.
- Replace `play`:

```ts
  play: (state, ctx) => {
    if (ctx.respondingTo) return []; // played as an answer (a Duel, Barbarians, Coerce) — the window decides what it does
    if (ctx.targets.length === 0) return []; // no target chosen — a no-op rather than a crash
    // Wine's boost is spent the moment the Sha is played, dodged or not.
    const boosted = !!state.turn.flags?.[WINE_FLAG];
    const spend: Effect[] = boosted ? [{ kind: 'SetTurnFlagEffect', flag: WINE_FLAG, value: false }] : [];
    return [...spend, shaWindow(ctx.cardInstanceId, ctx.seatId, ctx.targets[0], boosted ? 2 : 1)];
  },
```

In `projects/content/src/lib/modes/guozhan.ts`:

```ts
// Cards that can save a dying seat: anyone's Peach, and the dying seat's own Wine.
export const RESCUE_CARD_IDS = { any: ['peach'], self: ['wine'] };
```

In `projects/content/src/lib/registry.ts`, import `wineCard` and add it after `peachCard`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest projects/content projects/app/src/app/wiki`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add projects/content
git commit -m "feat(content): Wine — the next Sha deals 2, and a dying seat may drink to save itself

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Bots — Wine, repeated Sha, Peach before Wine

**Files:**
- Modify: `projects/bots/src/lib/rule-based.ts`, `rule-based.spec.ts`

**Interfaces:**
- Consumes: the card ids `wine`, `crossbow` and `draw-two`.
- Produces: no new exports. `BotTurnMemory.shaPlayed` stays as it is, but no longer gates the Sha.

- [ ] **Step 1: Write the failing tests, and update two tests the new rule changes**

In `projects/bots/src/lib/rule-based.spec.ts`:
- Add `card('wine', 'basic')` to the registry.
- Replace the test 'plays one Sha per turn, at the lowest-HP non-ally, never untargeted' with:

```ts
  it('plays a Sha at the lowest-HP non-ally whenever the engine offers one, never untargeted (Crossbow repeats)', () => {
    const hand = [{ instanceId: 'c-sha', definitionId: 'sha' }];
    const legal = [play('c-sha'), play('c-sha', 'seat-1'), play('c-sha', 'seat-2'), end];
    const first = decide(view({ hand }), legal);
    expect(first.action).toBe(legal[2]); // seat-2 has 3 HP, seat-1 has 6
    expect(decide(view({ hand }), legal, first.memory).action).toBe(legal[2]);
  });
```

- Replace 'duels a non-ally once its Sha is spent' with (the engine stops offering Sha, so it isn't in `legal`):

```ts
  it('duels a non-ally once the engine offers no Sha', () => {
    const hand = [{ instanceId: 'c-duel', definitionId: 'duel' }];
    const legal = [play('c-duel', 'seat-1'), end];
    expect(decide(view({ hand }), legal).action).toBe(legal[0]);
  });
```

- Append:

```ts
describe('ruleBasedPolicy: Wine', () => {
  it('drinks Wine first when a Sha at a non-ally is legal, then plays the Sha', () => {
    const hand = [{ instanceId: 'w', definitionId: 'wine' }, { instanceId: 's', definitionId: 'sha' }];
    expect(decide(view({ hand }), [play('w'), play('s', 'seat-1'), end]).action).toEqual(play('w'));
    expect(decide(view({ hand: [hand[1]] }), [play('s', 'seat-1'), end]).action).toEqual(play('s', 'seat-1'));
  });

  it('keeps its Wine when no Sha at a non-ally is legal', () => {
    const hand = [{ instanceId: 'w', definitionId: 'wine' }];
    expect(decide(view({ hand }), [play('w'), end]).action).toEqual(end);
  });

  it('discards equipment before Wine', () => {
    const hand = [{ instanceId: 'w', definitionId: 'wine' }, { instanceId: 'b', definitionId: 'blade' }];
    expect(decide(view({ phase: 'Discard', hand }), [discard('w'), discard('b')]).action).toEqual(discard('b'));
  });

  it('dying, saves itself with a Peach before a Wine', () => {
    const reason = { kind: 'dying' as const, seatId: 'seat-0' };
    const respond = (id: string): Action => ({ kind: 'RespondAction', seatId: 'seat-0', pendingResponseId: 'r1', cardInstanceId: id });
    const passIt: Action = { kind: 'PassAction', seatId: 'seat-0', pendingResponseId: 'r1' };
    const both = view({ pendingFor: 'seat-0', pendingReason: reason, hand: [{ instanceId: 'w', definitionId: 'wine' }, { instanceId: 'p', definitionId: 'peach' }] });
    expect(decide(both, [respond('w'), respond('p'), passIt]).action).toEqual(respond('p'));
    const wineOnly = view({ pendingFor: 'seat-0', pendingReason: reason, hand: [{ instanceId: 'w', definitionId: 'wine' }] });
    expect(decide(wineOnly, [respond('w'), passIt]).action).toEqual(respond('w'));
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx jest projects/bots`
Expected: FAIL:
- The second Sha decision ends the phase.
- Wine is never chosen.
- Wine is discarded before equipment.
- The dying bot answers with the first card (Wine).

- [ ] **Step 3: Implement**

In `projects/bots/src/lib/rule-based.ts`:
- In `keepRank`, change `if (definitionId === 'sha') return 2;` to `if (definitionId === 'sha' || definitionId === 'wine' || definitionId === 'draw-two') return 2;`.
- In the responding block, prefer a Peach among the offered answers:

```ts
    const answers = legal.filter((a): a is Extract<Action, { kind: 'RespondAction' }> => a.kind === 'RespondAction');
    // A Peach before anything else (a dying bot drinks Wine only without one).
    const best = answers.find((a) => definitionIdOf(view, a.cardInstanceId) === 'peach') ?? answers[0];
    const answer = (worthAnswering ? best : undefined) ?? legal.find((a) => a.kind === 'PassAction');
```

- Replace the Sha block (`if (mem.shaPlayed === 0) { … }`) with:

```ts
    // Wine first when a Sha at a non-ally is legal: the Sha follows next.
    const shaPlays = targetedPlays(view, self, plays, 'sha');
    const wine = untargetedOf('wine');
    if (wine && shaPlays.length > 0) return take(wine);
    // Whenever the engine offers a Sha (Crossbow lifts the limit); the safety cap still ends the turn.
    const [sha] = shaPlays;
    if (sha) return take(sha, 1);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest projects/bots projects/sim`
Expected: PASS. The property games now include horses, Crossbow, Black Pommel, Silver Lion and Wine.

- [ ] **Step 5: Commit**

```bash
git add projects/bots
git commit -m "feat(bots): Wine before a Sha, Sha whenever offered, Peach before Wine when dying

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: App — the dying prompt mentions Wine

**Files:**
- Modify: `projects/app/src/app/game-board/response-description.ts` (+spec)

**Interfaces:**
- Consumes: the dying window's `allowedCardIds`, which include `wine` only for the dying seat (Tasks 2 and 5).

- [ ] **Step 1: Write the failing test**

Append to `projects/app/src/app/game-board/response-description.spec.ts`:

```ts
describe('describeResponse: saving yourself with Wine', () => {
  const dyingWindow = (allowedCardIds: string[]): PendingResponse => ({
    id: 'd1', respondingSeatId: 'seat-0', allowedActionKinds: ['RespondAction', 'PassAction'], allowedCardIds,
    reason: { kind: 'dying', seatId: 'seat-0' },
    context: { effect: { kind: 'DyingEffect', seatId: 'seat-0', order: [], rescueCardIds: { any: ['peach'], self: ['wine'] } } },
  });
  const withHand = (pending: PendingResponse, hand: CardInstance[]): GameState => ({
    ...state([], pending),
    seats: [{
      id: 'seat-0', index: 0, kingdom: 'Wei', eliminated: false, combinedHp: 0, maxCombinedHp: 4,
      generals: { main: { generalDefinitionId: 'g1', revealed: true }, deputy: { generalDefinitionId: 'g2', revealed: true } },
      hand: { zoneId: 'seat-0:hand' }, equipped: { zoneId: 'seat-0:equip' }, judgment: { zoneId: 'seat-0:judgment' },
    }],
    zones: [{ id: 'seat-0:hand', kind: 'hand', ownerSeatId: 'seat-0', cards: hand }],
  });
  const wine: CardInstance = { instanceId: 'w1', definitionId: 'wine', suit: 'spade', rank: 9 };

  it('offers Peach or Wine when you are dying and hold a Wine', () => {
    expect(describeResponse(withHand(dyingWindow(['peach', 'wine']), [wine]), 'seat-0')!.prompt).toBe('Play a Peach or Wine to save yourself?');
  });

  it('asks only for a Peach when you hold no Wine', () => {
    expect(describeResponse(withHand(dyingWindow(['peach', 'wine']), []), 'seat-0')!.prompt).toBe('Play a Peach to save yourself?');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest projects/app/src/app/game-board/response-description.spec.ts`
Expected: FAIL. The first case reads "Play a Peach to save yourself?".

- [ ] **Step 3: Implement**

In `projects/app/src/app/game-board/response-description.ts`, inside the dying branch, before `return`:

```ts
    // Wine is offered only to the dying seat itself; name it when you hold one.
    const viewerHand = state.zones.find((z) => z.kind === 'hand' && z.ownerSeatId === viewerSeatId)?.cards ?? [];
    const canDrink = self && !!pending.allowedCardIds?.includes('wine') && viewerHand.some((c) => c.definitionId === 'wine');
```

and change the prompt to:

```ts
      prompt: `Play a Peach${canDrink ? ' or Wine' : ''} to save ${self ? 'yourself' : name(dyingId)}?${needed > 1 ? ` (needs ${needed} Peaches)` : ''}`,
```

- [ ] **Step 4: Run the tests and the builds**

Run: `npx jest projects/app`
Expected: PASS.

Run: `npm run build && npx ng build app`
Expected: both builds succeed.

- [ ] **Step 5: Commit**

```bash
git add projects/app
git commit -m "feat(app): the dying prompt offers Wine when you can save yourself with it

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: The event chain doc, and the full check

**Files:**
- Modify: `docs/architecture/event-chain.md`

- [ ] **Step 1: Add an "Equipment abilities" section**

Insert before `## Plugging into the chain`:

```markdown
## Equipment abilities

A worn card can carry **abilities** (`CardDefinition.abilities`):

- `triggers` join the chain like a General's skill while the card sits in a
  living seat's equip zone. They are gathered after the mode's triggers and
  the Generals' skills, in seat order and then zone order. Their owner is
  `{ kind: 'equipment', seatId, cardInstanceId }`; a General's is
  `{ kind: 'general', seatId, slot }`. Every trigger also receives the
  registry, so it can read other worn cards' modifiers (Silver Lion checks
  Black Pommel).
- `modifiers` (`shaLimit`, `ignoresArmor`) are plain data. The engine never
  reads them; content's queries do, through `activeAbilities`.

When a card leaves an equip zone for any reason, its `onUnequip` runs for the
former wearer, right after the move's own after-triggers (Silver Lion's
parting heal). A trigger can't do this job, because a card that has left is no
longer gathered.

The dying round takes `rescueCardIds: { any, self }`. Any seat may answer
with `any` (Peach); only the dying seat may also use `self` (Wine).
```

- [ ] **Step 2: Run everything**

Run: `npx jest`
Expected: PASS, every project.

Run: `npm run build && npx ng build app`
Expected: both builds succeed.

- [ ] **Step 3: Commit**

```bash
git add docs/architecture/event-chain.md
git commit -m "docs: equipment abilities, onUnequip and self-only rescue cards in the event chain

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
