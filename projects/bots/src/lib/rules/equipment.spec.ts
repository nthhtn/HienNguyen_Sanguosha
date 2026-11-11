import type { GameState, PendingChoice, PendingSelection } from 'engine';
import { ruleBasedKwPolicy } from '../rule-based';
import { asking, card, decideWith, general, picked, registry, table } from '../testing';

const decide = (s: GameState) => decideWith(ruleBasedKwPolicy, s);
const chain = (s: GameState, ...ids: string[]): GameState => ({ ...s, seats: s.seats.map((seat) => (ids.includes(seat.id) ? { ...seat, chained: true as const } : seat)) });

describe('rules/equipment: Fire Fan', () => {
  it('fire fan: used at a foe', () => {
    expect(picked(decide(asking(table(), 'fire-fan', 'seat-b')))).toBe('use');
  });

  it('fire fan: declined at an ally', () => {
    expect(picked(decide(asking(table({}, { kingdoms: { 'seat-b': 'Wei' } }), 'fire-fan', 'seat-b')))).toBe('decline');
  });

  it('fire fan: declined when the foe and the bot are both chained', () => {
    expect(picked(decide(asking(chain(table(), 'seat-a', 'seat-b'), 'fire-fan', 'seat-b')))).toBe('decline');
  });

  it('fire fan: used at a chained foe when nobody on the bot\'s side is chained', () => {
    expect(picked(decide(asking(chain(table(), 'seat-b'), 'fire-fan', 'seat-b')))).toBe('use');
  });
});

describe('rules/equipment: Trident Glaive', () => {
  // seat-b was hit; its neighbours are seat-a (the bot) and seat-c (a foe).
  it('trident glaive: used with a foe next door and a spare card', () => {
    const s = table({ 'seat-a:hand': [card('h', 'steal')] });
    expect(picked(decide(asking(s, 'trident-glaive', 'seat-b')))).toBe('use');
  });

  it('trident glaive: declined with only Peach and Shan in hand', () => {
    const s = table({ 'seat-a:hand': [card('p', 'peach'), card('sh', 'shan')] });
    expect(picked(decide(asking(s, 'trident-glaive', 'seat-b')))).toBe('decline');
  });

  it('trident glaive: declined with no foe next door', () => {
    // seat-c was hit: its neighbours seat-b and seat-d are both Wei allies.
    const s = table({ 'seat-a:hand': [card('h', 'steal')] }, { kingdoms: { 'seat-b': 'Wei', 'seat-d': 'Wei' } });
    expect(picked(decide(asking(s, 'trident-glaive', 'seat-c')))).toBe('decline');
  });

  it('trident glaive: declined when the only foe next door wears a defensive mount', () => {
    registry.cards.set('test-defensive-horse', { id: 'test-defensive-horse', name: 'Test Horse', category: 'equipment', equipSlot: 'defensiveMount', play: () => [] });
    // seat-b was hit: seat-a is the bot, seat-c a foe riding a defensive horse (distance 2, no longer next door).
    const s = table({ 'seat-a:hand': [card('h', 'steal')], 'seat-c:equip': [card('hs', 'test-defensive-horse')] });
    expect(picked(decide(asking(s, 'trident-glaive', 'seat-b')))).toBe('decline');
  });

  it('trident glaive: discards the least useful card', () => {
    const s = table({ 'seat-a:hand': [card('p', 'peach'), card('sh', 'shan'), card('st', 'steal'), card('sa', 'sha')] });
    const selection: PendingSelection = {
      id: 'sel', seatId: 'seat-a', reason: { kind: 'ability', owner: general('seat-a', 'trident-glaive'), abilityId: 'trident-glaive', targetSeatId: 'seat-b' },
      of: 'cards', eligibleIds: ['p', 'sh', 'sa', 'st'], min: 1, max: 1, then: { kind: 'discard', then: [] }, onCancel: [],
    };
    expect(picked(decide({ ...s, pendingSelection: selection }))).toEqual(['st']);
  });

  it('trident glaive: hits the foe, not the ally, among the neighbours', () => {
    // seat-c was hit; seat-b is a Shu foe, seat-d a Wei ally (listed first).
    const s = table({}, { kingdoms: { 'seat-d': 'Wei' } });
    const choice: PendingChoice = {
      id: 'pick', seatId: 'seat-a', verb: 'pick',
      reason: { kind: 'ability', owner: general('seat-a', 'trident-glaive'), abilityId: 'trident-glaive', targetSeatId: 'seat-c' },
      options: ['seat-d', 'seat-b'].map((id) => ({ id, shows: { kind: 'seat' as const, seatId: id }, effects: [] })),
    };
    expect(picked(decide({ ...s, pendingChoice: choice }))).toBe('seat-b');
  });
});
