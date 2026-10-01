# Equipment Slots and Discard Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every seat has four equipment slots (weapon, armor, +1 mount, −1 mount) under the real one-card-per-slot rule, and the table centre shows the most recently discarded card.

**Architecture:**
- Cards declare `equipSlot` (an optional engine type field).
- Content's equipment helper builds each card's `play()` so that it first discards any same-slot card from the player's equip zone, then equips the new one. It also exports `equipSlotOf` for bots and the UI.
- Bots equip only into empty slots, and the sim invariant checks one card per slot.
- The seat tile renders 4 slot boxes, and the round table shows the discard pile's last card.

**Tech Stack:** TypeScript 6, Angular 22 + Material 22, Jest 30.

**Spec:** `docs/superpowers/specs/2026-10-01-equipment-slots-design.md`

## Global Constraints

- `EquipSlot = 'weapon' | 'armor' | 'plusMount' | 'minusMount'`. The display order is Weapon, Armor, +1 Horse, −1 Horse.
- Green Dragon Blade is `weapon` and Silver Lion is `armor`. No other equipment joins the deck.
- The engine pipeline is unchanged. Only the type gains `equipSlot?` and `EQUIP_SLOTS`.
- The UI never decides legality. Slot display reads `equipSlotOf` from `content`.
- The most recent discard is the **last** card of the discard zone.
- Work on branch `feature/equipment-slots`. Commits end with the trailer `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- Verify with `npx jest`, the 5 `tsc --noEmit` checks (engine, content, sim, bots and app configs, as in earlier plans), and `npx ng build app` with no warnings.

## Review Focus

1. **Equipping the same card id twice** (two Green Dragon Blades in a row): the old one is discarded and the new one equipped. Task 1's filled-slot test uses two blade instances.
2. **A seat that is equipped and then eliminated:** the tiles still render its slots, greyed out with the rest of the tile, without crashing. Task 3's tile test renders an eliminated seat with equipment.
3. **The discard pile reshuffled into the draw pile:** the centre shows the empty placeholder and "Discard 0" without crashing. Task 3 covers the empty pile.
4. **A bot holding an armor and a weapon:** it equips both, each into its own slot. Task 2 covers this.
5. **An equipment card in the equip zone whose slot is unknown** (corrupt state): the tile ignores it rather than crashing. Task 3's test includes an unknown id.

---

### Task 1: Slot type, equipment slot rule, and `equipSlotOf`

**Files:**
- Modify: `projects/engine/src/lib/registry/types.ts`, `projects/content/src/lib/cards/equipment.ts`, `projects/content/src/public-api.ts`, `projects/content/src/lib/registry.spec.ts`
- Create: `projects/content/src/lib/cards/equipment.spec.ts`

**Interfaces:**
- Produces:
  - in `engine`: `type EquipSlot`, `const EQUIP_SLOTS: readonly EquipSlot[]`, and `CardDefinition.equipSlot?: EquipSlot`
  - in `content`: `equipSlotOf(definitionId: string): EquipSlot | null`, plus `greenDragonBladeCard` and `silverLionCard` carrying their slots

- [ ] **Step 1: Write the failing tests**

Create `projects/content/src/lib/cards/equipment.spec.ts`:

```ts
import { resolve } from 'engine';
import type { CardInstance, ContentRegistry, GameModeDefinition, GameState } from 'engine';
import { equipSlotOf, greenDragonBladeCard, silverLionCard } from './equipment';

const registry: ContentRegistry = {
  cards: new Map([[greenDragonBladeCard.id, greenDragonBladeCard], [silverLionCard.id, silverLionCard]]),
  generals: new Map(),
};
const mode: GameModeDefinition = {
  id: 'stub', setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'], checkWinCondition: () => null, triggers: [],
};
const blade = (n: number): CardInstance => ({ instanceId: `blade-${n}`, definitionId: 'green-dragon-blade', suit: 'spade', rank: 5 });
const lion: CardInstance = { instanceId: 'lion-1', definitionId: 'silver-lion', suit: 'club', rank: 1 };

function state(hand: CardInstance[], equipped: CardInstance[]): GameState {
  return {
    seats: [{
      id: 'seat-a', index: 0, kingdom: 'Wei',
      generals: { main: { generalDefinitionId: 'g1', revealed: false }, deputy: { generalDefinitionId: 'g2', revealed: false } },
      combinedHp: 6, maxCombinedHp: 6, hand: { zoneId: 'seat-a:hand' }, equipped: { zoneId: 'seat-a:equip' }, eliminated: false,
    }],
    players: [], turn: { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [] }, phase: 'Play',
    zones: [
      { id: 'discardPile', kind: 'discardPile', cards: [] },
      { id: 'seat-a:hand', kind: 'hand', ownerSeatId: 'seat-a', cards: hand },
      { id: 'seat-a:equip', kind: 'equip', ownerSeatId: 'seat-a', cards: equipped },
    ],
    pendingResponse: null, log: [], rng: { seed: 1, counter: 0 }, result: null, generalSelection: null,
  };
}

const zone = (s: GameState, id: string) => s.zones.find((z) => z.id === id)!.cards.map((c) => c.instanceId);
const equip = (s: GameState, instanceId: string) =>
  resolve(s, { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: instanceId, targets: [] }, { registry, mode }).state;

describe('equipment slots', () => {
  it('declares a slot for each equipment card', () => {
    expect(greenDragonBladeCard.equipSlot).toBe('weapon');
    expect(silverLionCard.equipSlot).toBe('armor');
    expect(equipSlotOf('green-dragon-blade')).toBe('weapon');
    expect(equipSlotOf('silver-lion')).toBe('armor');
    expect(equipSlotOf('sha')).toBeNull();
  });

  it('equips into an empty slot without discarding anything', () => {
    const next = equip(state([blade(1)], []), 'blade-1');
    expect(zone(next, 'seat-a:equip')).toEqual(['blade-1']);
    expect(zone(next, 'discardPile')).toEqual([]);
  });

  it('discards the card already in the same slot, then equips the new one (Review Focus 1)', () => {
    const next = equip(state([blade(2)], [blade(1)]), 'blade-2');
    expect(zone(next, 'seat-a:equip')).toEqual(['blade-2']);
    expect(zone(next, 'discardPile')).toEqual(['blade-1']);
    expect(zone(next, 'seat-a:hand')).toEqual([]);
  });

  it('keeps cards in other slots: a weapon and an armor coexist', () => {
    const next = equip(state([lion], [blade(1)]), 'lion-1');
    expect(zone(next, 'seat-a:equip')).toEqual(['blade-1', 'lion-1']);
    expect(zone(next, 'discardPile')).toEqual([]);
  });

  it('logs the replaced card’s move to the discard pile before the equip', () => {
    const next = equip(state([blade(2)], [blade(1)]), 'blade-2');
    const moves = next.log.filter((e) => e.kind === 'CardMovedEvent');
    expect(moves).toEqual([
      { kind: 'CardMovedEvent', cardInstanceId: 'blade-1', toZoneId: 'discardPile' },
      { kind: 'CardMovedEvent', cardInstanceId: 'blade-2', toZoneId: 'seat-a:equip' },
    ]);
  });
});
```

Append to `projects/content/src/lib/registry.spec.ts`, inside its `describe`:

```ts
  it('gives every equipment card a slot and no other card one', () => {
    const registry = buildContentRegistry();
    for (const card of registry.cards.values()) {
      if (card.category === 'equipment') expect(card.equipSlot).toBeDefined();
      else expect(card.equipSlot).toBeUndefined();
    }
  });
```

Run: `npx jest --selectProjects content`
Expected: FAIL. The equipment spec can't import `equipSlotOf`, and the registry slot test fails on `equipSlot` being undefined.

- [ ] **Step 2: Add the engine type**

In `projects/engine/src/lib/registry/types.ts`, add this before `CardDefinition`:

```ts
// The four equipment slots a seat has. One card per slot.
export type EquipSlot = 'weapon' | 'armor' | 'plusMount' | 'minusMount';
export const EQUIP_SLOTS: readonly EquipSlot[] = ['weapon', 'armor', 'plusMount', 'minusMount'];
```

Add this field to `CardDefinition`, after `category`:

```ts
  // Which equipment slot the card occupies; set exactly when category is 'equipment'.
  equipSlot?: EquipSlot;
```

- [ ] **Step 3: Implement the slot rule in content**

Replace `projects/content/src/lib/cards/equipment.ts` with:

```ts
import type { CardDefinition, Effect, EquipSlot, GameState } from 'engine';
import { requireZoneOfKind } from 'engine';

// Every equipment card's slot, keyed by definition id. play() has no registry
// access, so this is how an equip finds the slot of the card already worn.
const EQUIP_SLOT_BY_ID = new Map<string, EquipSlot>();

export function equipSlotOf(definitionId: string): EquipSlot | null {
  return EQUIP_SLOT_BY_ID.get(definitionId) ?? null;
}

function makeEquipmentCard(id: string, name: string, equipSlot: EquipSlot): CardDefinition {
  EQUIP_SLOT_BY_ID.set(id, equipSlot);
  return {
    id,
    name,
    category: 'equipment',
    equipSlot,
    // One card per slot: whatever already fills this slot goes to the discard
    // pile first, then the played card is equipped.
    play: (state: GameState, ctx) => {
      const equipZoneId = `${ctx.seatId}:equip`;
      const worn = state.zones.find((z) => z.id === equipZoneId)?.cards ?? [];
      const replaced = worn.filter((c) => equipSlotOf(c.definitionId) === equipSlot);
      const discardPile = requireZoneOfKind(state.zones, 'discardPile');
      const effects: Effect[] = replaced.map((c) => ({ kind: 'MoveCardEffect', cardInstanceId: c.instanceId, toZoneId: discardPile.id }));
      effects.push({ kind: 'MoveCardEffect', cardInstanceId: ctx.cardInstanceId, toZoneId: equipZoneId });
      return effects;
    },
  };
}

export const silverLionCard = makeEquipmentCard('silver-lion', 'Silver Lion', 'armor');
export const greenDragonBladeCard = makeEquipmentCard('green-dragon-blade', 'Green Dragon Blade', 'weapon');
```

In `projects/content/src/public-api.ts`, add:

```ts
export { equipSlotOf } from './lib/cards/equipment';
```

- [ ] **Step 4: Run tests and type checks**

Run: `npx jest --selectProjects engine content sim && npx tsc -p projects/engine/tsconfig.spec.json --noEmit && npx tsc -p projects/content/tsconfig.spec.json --noEmit`
Expected: all PASS (the sim property tests now exercise replacement with random bots), no type errors.

- [ ] **Step 5: Commit**

```bash
git add projects/engine/src/lib/registry/types.ts projects/content/src
git commit -m "feat(content): one equipment card per slot — equipping replaces the card in that slot

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Bots fill only empty slots; sim checks one card per slot

**Files:**
- Modify: `projects/bots/src/lib/rule-based.ts`, `projects/bots/src/lib/rule-based.spec.ts`, `projects/sim/src/invariants.ts`, `projects/sim/src/invariants.spec.ts`

**Interfaces:**
- Consumes: `CardDefinition.equipSlot` (Task 1).
- Produces: no new exports.

- [ ] **Step 1: Write the failing tests**

In `projects/bots/src/lib/rule-based.spec.ts`:
- Change the registry card list. Replace `card('blade', 'equipment')` with `card('blade', 'equipment', 'weapon'), card('blade-2', 'equipment', 'weapon'), card('lion', 'equipment', 'armor')`.
- Change the helper to `function card(id: string, category: CardDefinition['category'], equipSlot?: EquipSlot): [string, CardDefinition] { return [id, { id, name: id, category, equipSlot, play: () => [] }]; }`, and add `EquipSlot` to the type import from `'engine'`.
- Append inside the `describe`:

```ts
  it('does not equip a second weapon over the one it holds', () => {
    const hand = [{ instanceId: 'c-blade2', definitionId: 'blade-2' }];
    const legal = [play('c-blade2'), end];
    expect(decide(view({ hand, equip: ['blade'] }), legal).action).toBe(end);
  });

  it('equips armor while already holding a weapon (Review Focus 4)', () => {
    const hand = [{ instanceId: 'c-lion', definitionId: 'lion' }];
    const legal = [play('c-lion'), end];
    expect(decide(view({ hand, equip: ['blade'] }), legal).action).toBe(legal[0]);
  });
```

Append to `projects/sim/src/invariants.spec.ts`:

```ts
describe('equipment slot invariant', () => {
  const registry = {
    generals: new Map([
      ['g1', { id: 'g1', kingdom: 'Wei' as const, maxHp: 4, skills: [] }],
      ['g2', { id: 'g2', kingdom: 'Wei' as const, maxHp: 4, skills: [] }],
    ]),
    cards: new Map([
      ['blade', { id: 'blade', name: 'Blade', category: 'equipment' as const, equipSlot: 'weapon' as const, play: () => [] }],
      ['lion', { id: 'lion', name: 'Lion', category: 'equipment' as const, equipSlot: 'armor' as const, play: () => [] }],
    ]),
  };
  const equipZone = (ids: string[]) => ({
    id: 'seat-a:equip', kind: 'equip' as const, ownerSeatId: 'seat-a',
    cards: ids.map((d, i) => ({ instanceId: `${d}-${i}`, definitionId: d, suit: 'spade' as const, rank: 1 })),
  });

  it('flags two cards in the same slot', () => {
    expect(checkInvariants(baseState({ zones: [equipZone(['blade', 'blade'])] }), registry)).toEqual([
      expect.stringContaining('two weapon cards'),
    ]);
  });

  it('accepts one card in each of two slots', () => {
    expect(checkInvariants(baseState({ zones: [equipZone(['blade', 'lion'])] }), registry)).toEqual([]);
  });
});
```

Run: `npx jest --selectProjects bots sim`
Expected: FAIL. The bot equips the second weapon, and the invariant reports nothing.

- [ ] **Step 2: Implement**

In `projects/bots/src/lib/rule-based.ts`, replace the `equipped` line and the `equipment` lookup with:

```ts
    const equippedSlots = new Set(
      (view.zones.find((z) => z.id === self.equipped.zoneId)?.cards ?? []).map(
        (c) => registry.cards.get(c.definitionId)?.equipSlot
      )
    );

    const peach = plays.find((p) => untargeted(p) && definitionIdOf(view, p.cardInstanceId) === 'peach');
    if (peach && self.combinedHp < self.maxCombinedHp) return take(peach);

    // Equip only into an empty slot; never swap one weapon for another.
    const equipment = plays.find((p) => {
      const definitionId = definitionIdOf(view, p.cardInstanceId);
      const slot = definitionId ? registry.cards.get(definitionId)?.equipSlot : undefined;
      return untargeted(p) && !!slot && !equippedSlots.has(slot);
    });
    if (equipment) return take(equipment);
```

(The existing `peach` lines move up with this block, so that they come before the equipment check, as before.)

In `projects/sim/src/invariants.ts`, add this before the `if (state.result)` block:

```ts
  if (registry) {
    for (const zone of state.zones.filter((z) => z.kind === 'equip')) {
      const seen = new Set<string>();
      for (const card of zone.cards) {
        const slot = registry.cards.get(card.definitionId)?.equipSlot;
        if (!slot) continue;
        if (seen.has(slot)) violations.push(`Equip zone ${zone.id} holds two ${slot} cards`);
        seen.add(slot);
      }
    }
  }
```

- [ ] **Step 3: Run tests and type checks**

Run: `npx jest --selectProjects bots sim && npx tsc -p projects/bots/tsconfig.json --noEmit && npx tsc -p projects/sim/tsconfig.json --noEmit`
Expected: all PASS, no type errors.

- [ ] **Step 4: Commit**

```bash
git add projects/bots/src projects/sim/src
git commit -m "feat(bots): equip only into empty slots; sim checks one card per slot

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Seat tile equipment slots and the discard pile display

**Files:**
- Modify: `projects/app/src/app/game-board/seat-tile.ts` (+ spec), `projects/app/src/app/game-board/round-table.ts` (+ spec)

**Interfaces:**
- Consumes: `equipSlotOf` (content), and `EQUIP_SLOTS` and `EquipSlot` (engine).
- Produces: a `SeatTile` input `equipment: CardInstance[]` (default `[]`).

- [ ] **Step 1: Write the failing tests**

In `projects/app/src/app/game-board/seat-tile.spec.ts`:
- Add `equipment?: CardInstance[]` to the `render` options, with `fixture.componentRef.setInput('equipment', opts.equipment ?? []);`.
- Add `CardInstance` to the engine import.
- Append:

```ts
  const eq = (instanceId: string, definitionId: string): CardInstance => ({ instanceId, definitionId, suit: 'spade', rank: 1 });

  it('renders four equipment slots in order, filled or empty', () => {
    const el = render(makeSeat(), { equipment: [eq('e1', 'silver-lion'), eq('e2', 'green-dragon-blade')] });
    const slots = [...el.querySelectorAll('.equip .slot')] as HTMLElement[];
    expect(slots.map((s) => s.dataset['slot'])).toEqual(['weapon', 'armor', 'plusMount', 'minusMount']);
    expect(slots[0].querySelector('app-card-art')).not.toBeNull();
    expect(slots[1].querySelector('app-card-art')).not.toBeNull();
    expect(slots[2].classList).toContain('empty');
    expect(slots[3].getAttribute('title')).toBe('−1 Horse (empty)');
  });

  it('ignores an equipped card with no known slot (Review Focus 5)', () => {
    const el = render(makeSeat(), { equipment: [eq('e1', 'mystery-thing')] });
    expect(el.querySelectorAll('.equip .slot.empty')).toHaveLength(4);
  });

  it('still renders slots for an eliminated seat (Review Focus 2)', () => {
    const el = render(makeSeat({ eliminated: true }), { equipment: [eq('e1', 'green-dragon-blade')] });
    expect(el.querySelectorAll('.equip .slot')).toHaveLength(4);
  });
```

In `projects/app/src/app/game-board/round-table.spec.ts`, append inside the `describe`:

```ts
  it('shows the most recently discarded card face-up with its name and the pile count', () => {
    const s = state();
    const withDiscards = {
      ...s,
      zones: s.zones.map((z) =>
        z.kind === 'discardPile'
          ? { ...z, cards: [
              { instanceId: 'd1', definitionId: 'shan', suit: 'heart' as const, rank: 2 },
              { instanceId: 'd2', definitionId: 'sha', suit: 'spade' as const, rank: 7 },
            ] }
          : z
      ),
    };
    const el = render(withDiscards);
    const discard = el.querySelector('.centre .discard')!;
    expect(discard.querySelector('app-card-art img')!.getAttribute('src')).toBe('/card-art/cards/basic/sha.jpg');
    expect(discard.textContent).toContain('Last discarded: Sha');
    expect(discard.textContent).toContain('Discard 2');
  });

  it('shows an empty discard placeholder when the pile is empty (Review Focus 3)', () => {
    const s = state();
    const empty = { ...s, zones: s.zones.map((z) => (z.kind === 'discardPile' ? { ...z, cards: [] } : z)) };
    const discard = render(empty).querySelector('.centre .discard')!;
    expect(discard.querySelector('.discard-empty')).not.toBeNull();
    expect(discard.textContent).toContain('Discard 0');
  });

  it('passes each seat’s equipment to its tile', () => {
    const s = state();
    const equipped = {
      ...s,
      zones: [...s.zones, { id: 'seat-0:equip', kind: 'equip' as const, ownerSeatId: 'seat-0', cards: [
        { instanceId: 'e1', definitionId: 'green-dragon-blade', suit: 'spade' as const, rank: 5 },
      ] }],
    };
    const el = render(equipped, 'seat-0');
    expect(tile(el, 'seat-0').querySelector('.equip .slot[data-slot="weapon"] app-card-art')).not.toBeNull();
  });
```

Run: `npx jest projects/app/src/app/game-board/seat-tile.spec.ts projects/app/src/app/game-board/round-table.spec.ts`
Expected: FAIL. There is no `equipment` input, no `.equip` slots and no `.discard` block.

- [ ] **Step 2: Implement the seat tile slots**

In `projects/app/src/app/game-board/seat-tile.ts`:
- Imports: `import { computed } from '@angular/core'` (merge it into the existing import), plus `CardInstance`, `EQUIP_SLOTS` and `EquipSlot` from `'engine'`, and `equipSlotOf` from `'content'`. Import `cardIdDisplayName` from `'../labels'` as well.
- Add:

```ts
const SLOT_LABELS: Record<EquipSlot, { label: string; icon: string }> = {
  weapon: { label: 'Weapon', icon: 'gavel' },
  armor: { label: 'Armor', icon: 'shield' },
  plusMount: { label: '+1 Horse', icon: 'add' },
  minusMount: { label: '−1 Horse', icon: 'remove' },
};
```

- Add the input `readonly equipment = input<CardInstance[]>([]);`, and add:

```ts
  protected readonly slots = computed(() =>
    EQUIP_SLOTS.map((slot) => ({
      slot,
      ...SLOT_LABELS[slot],
      card: this.equipment().find((c) => equipSlotOf(c.definitionId) === slot) ?? null,
    }))
  );
  protected readonly cardIdDisplayName = cardIdDisplayName;
```

- In the template, after the `.stats` div, add:

```html
      <div class="equip">
        @for (s of slots(); track s.slot) {
          <div
            class="slot"
            [class.empty]="!s.card"
            [attr.data-slot]="s.slot"
            [attr.title]="s.card ? s.label + ': ' + cardIdDisplayName(s.card.definitionId) : s.label + ' (empty)'"
          >
            @if (s.card; as card) {
              <app-card-art size="small" [id]="card.definitionId" [label]="cardIdDisplayName(card.definitionId)" />
            } @else {
              <mat-icon>{{ s.icon }}</mat-icon>
            }
          </div>
        }
      </div>
```

- Add the styles:

```css
    .equip { display: grid; grid-template-columns: repeat(4, 26px); gap: 3px; justify-content: center; margin-top: 4px; }
    .slot { width: 26px; height: 36px; border-radius: 3px; overflow: hidden; display: grid; place-items: center; background: #f1ece2; border: 1px solid #d5c8ad; }
    .slot.empty mat-icon { font-size: 14px; width: 14px; height: 14px; color: #b9a37a; }
    .slot app-card-art { transform: scale(0.6); transform-origin: center; }
```

- [ ] **Step 3: Implement the round table discard display and pass equipment**

In `projects/app/src/app/game-board/round-table.ts`:
- Import `CardArt` from `'./card-art'` and `cardIdDisplayName` from `'../labels'`, and add `CardArt` to `imports`.
- Replace the `<div class="piles">…</div>` line with:

```html
        <div class="piles">Draw pile {{ pileCount('drawPile') }}</div>
        <div class="discard">
          @if (lastDiscard(); as card) {
            <app-card-art size="small" [id]="card.definitionId" [label]="cardIdDisplayName(card.definitionId)" />
            <div class="discard-text">
              <div>Last discarded: {{ cardIdDisplayName(card.definitionId) }}</div>
              <div>Discard {{ pileCount('discardPile') }}</div>
            </div>
          } @else {
            <div class="discard-empty" aria-hidden="true"></div>
            <div class="discard-text"><div>Discard 0</div></div>
          }
        </div>
```

- Pass `[equipment]="equipmentOf(p.seat.equipped.zoneId)"` to `<app-seat-tile>`.
- Add the class members:

```ts
  // moveCard appends, so the discard pile's last card is the most recent discard.
  protected readonly lastDiscard = computed(() => {
    const cards = this.state().zones.find((z) => z.kind === 'discardPile')?.cards ?? [];
    return cards.length > 0 ? cards[cards.length - 1] : null;
  });

  protected readonly cardIdDisplayName = cardIdDisplayName;

  protected equipmentOf(zoneId: string) {
    return this.state().zones.find((z) => z.id === zoneId)?.cards ?? [];
  }
```

- Add the styles:

```css
    .discard { display: flex; align-items: center; justify-content: center; gap: 8px; margin: 4px 0; }
    .discard-text { text-align: left; }
    .discard-empty { width: 44px; height: 60px; border: 1px dashed rgb(255 255 255 / 50%); border-radius: 4px; }
```

The existing centre test asserted `'Discard 2'` from the old piles line. It still passes, because the new block prints "Discard 2" for a non-empty pile.

- [ ] **Step 4: Run tests, type check and build**

Run: `npx jest --selectProjects app && npx tsc -p projects/app/tsconfig.spec.json --noEmit && npx ng build app`
Expected: all PASS, no type errors, no build warnings.

- [ ] **Step 5: Commit**

```bash
git add projects/app/src/app/game-board
git commit -m "feat(app): equipment slots on every seat tile and the last discarded card on the table

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```
