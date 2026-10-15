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
