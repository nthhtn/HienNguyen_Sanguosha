import type { CardInstance, GameState } from 'engine';
import { dangerOf } from './danger';
import { duelOutlook, expectedSha, exposure, playableSha } from './exposure';
import { card, registry, table } from './testing';

const danger = dangerOf(registry);
const hidden = (id: string): CardInstance => card(id, 'hidden');
const hand = (seat: string, ...defs: string[]) => ({ [`${seat}:hand`]: defs.map((d, i) => card(`${seat}-${i}`, d)) });
const hiddenHand = (seat: string, n: number) => ({ [`${seat}:hand`]: Array.from({ length: n }, (_, i) => hidden(`${seat}-h${i}`)) });
const seat = (s: GameState, id: string) => s.seats.find((x) => x.id === id)!;

describe('exposure: duel outlook', () => {
  it('outlasts an opponent with hidden cards when it has more rounds', () => {
    const s = table({ ...hand('seat-a', 'sha', 'sha'), ...hiddenHand('seat-b', 3) });
    expect(duelOutlook(s, seat(s, 'seat-a'), seat(s, 'seat-b'), registry)).toBe('outlast');
  });
  it('loses with fewer rounds than the expected Sha', () => {
    const s = table({ ...hand('seat-a', 'sha'), ...hiddenHand('seat-b', 4) });
    expect(duelOutlook(s, seat(s, 'seat-a'), seat(s, 'seat-b'), registry)).toBe('lose');
  });
  it('halves rounds against a revealed Matchless General', () => {
    const generals = { 'seat-b': ['lu-bu', 'filler-dong-zhuo'] as [string, string] };
    const none = table({ ...hand('seat-a', 'sha', 'sha') }, { generals });
    expect(duelOutlook(none, seat(none, 'seat-a'), seat(none, 'seat-b'), registry)).toBe('outlast');
    const four = table({ ...hand('seat-a', 'sha', 'sha'), ...hiddenHand('seat-b', 4) }, { generals });
    expect(duelOutlook(four, seat(four, 'seat-a'), seat(four, 'seat-b'), registry)).toBe('lose');
  });
  it('loses with no Sha without throwing', () => {
    const s = table({});
    expect(duelOutlook(s, seat(s, 'seat-a'), seat(s, 'seat-b'), registry)).toBe('lose');
  });
  it('counts a face-shown Sha as one and playable Sha from the hand', () => {
    const s = table({ ...hand('seat-a', 'sha', 'shan'), ...hand('seat-b', 'sha') });
    expect(expectedSha(s, seat(s, 'seat-b'), registry)).toBe(1);
    expect(playableSha(s, seat(s, 'seat-a'), registry)).toBe(1);
  });
});

describe('exposure: until the next turn', () => {
  it('counts an enemy that acts before the bot', () => {
    const s = table({ ...hiddenHand('seat-a', 5) }, { seats: 2, owner: 'seat-a' });
    expect(exposure(s, seat(s, 'seat-b'), registry, danger, { shanUsed: 0 }).threat).toBeGreaterThan(0);
  });
  it('on its own turn counts every other living enemy in reach', () => {
    const s = table({ ...hiddenHand('seat-b', 5) }, { seats: 2, owner: 'seat-a' });
    expect(exposure(s, seat(s, 'seat-a'), registry, danger, { shanUsed: 0 }).threatSeats).toBe(1);
  });
  it('on its own turn counts nobody when every other seat is a revealed ally', () => {
    const s = table({ ...hiddenHand('seat-b', 5) }, { seats: 2, owner: 'seat-a', kingdoms: { 'seat-a': 'Wei', 'seat-b': 'Wei' } });
    expect(exposure(s, seat(s, 'seat-a'), registry, danger, { shanUsed: 0 }).threat).toBe(0);
  });
  const hit = (s: GameState): GameState => ({
    ...s,
    pendingResponse: {
      id: 'r', respondingSeatId: 'seat-c', allowedActionKinds: ['PassAction'],
      context: { effect: { kind: 'DamageEffect', damage: { source: { kind: 'seat', seatId: 'seat-a' }, target: { kind: 'seat', seatId: 'seat-c' }, amount: 1, nature: 'normal' } } },
    } as GameState['pendingResponse'],
  });
  it('is exposed at 2 HP with one Shan against two enemies with 5 cards acting next, not when they are allies', () => {
    const cards = { ...hand('seat-c', 'shan'), ...hiddenHand('seat-a', 5), ...hiddenHand('seat-b', 5) };
    const hp = { 'seat-c': 2 };
    const foes = hit(table(cards, { owner: 'seat-a', seats: 3, hp, kingdoms: { 'seat-a': 'Wei', 'seat-b': 'Shu', 'seat-c': 'Qun' } }));
    const e = exposure(foes, seat(foes, 'seat-c'), registry, danger, { shanUsed: 0 });
    expect(e.threatSeats).toBe(2);
    expect(e.exposed).toBe(true);
    const allies = hit(table(cards, { owner: 'seat-a', seats: 3, hp, kingdoms: { 'seat-a': 'Qun', 'seat-b': 'Qun', 'seat-c': 'Qun' } }));
    expect(exposure(allies, seat(allies, 'seat-c'), registry, danger, { shanUsed: 0 }).exposed).toBe(false);
  });
});
