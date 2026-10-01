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
