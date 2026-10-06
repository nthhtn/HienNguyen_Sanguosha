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
