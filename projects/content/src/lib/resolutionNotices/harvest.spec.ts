import type { CardInstance, EngineEvent } from 'engine';
import { harvestNotice, harvestSeconds } from './harvest';
import { played, span, view } from './helpers.testing';

const card = (id: string, definitionId: string): CardInstance => ({ instanceId: id, definitionId, suit: 'heart', rank: 3 });
const picks = (seatId: string, c: CardInstance): EngineEvent => ({ kind: 'ChoiceMadeEvent', seatId, reason: { kind: 'choice' }, verb: 'take', shows: { kind: 'card', card: c } }) as unknown as EngineEvent;

describe('Harvest notice', () => {
  it('lists what each seat took, in order, and is neutral', () => {
    const peach = card('p', 'peach');
    const sha = card('s', 'sha');
    const n = harvestNotice.describe(span('harvest', 'a', ['a', 'b'], [played('harvest', 'a', ['a', 'b']), picks('a', peach), picks('b', sha)]), view())!;
    expect(n.seatIds).toEqual(['a', 'b']);
    expect(n.seatCards).toEqual([{ seatId: 'a', card: peach }, { seatId: 'b', card: sha }]);
    expect(n.seconds).toBe(3);
    expect(n.steps).toEqual([]);
    expect(n.cards).toEqual([]);
    expect(n.outcome).toMatchObject({ tone: 'neutral', headline: { key: 'notice.harvest.done' }, text: { key: 'notice.harvest.text' } });
  });
  it('lasts 1.5 seconds per participant in whole seconds, at least 3 and at most 7', () => {
    const seats = ['a', 'b', 'c', 'd', 'e', 'f'];
    const lasts = (n: number) =>
      harvestNotice.describe(span('harvest', 'a', seats.slice(0, n), [played('harvest', 'a', seats.slice(0, n)), ...seats.slice(0, n).map((id) => picks(id, card(`c-${id}`, 'peach')))]), view())!.seconds;
    expect([lasts(1), lasts(2), lasts(3), lasts(4), lasts(5), lasts(6)]).toEqual([3, 3, 5, 6, 7, 7]);
    expect(harvestSeconds(9)).toBe(7);
  });
  it('has nothing to show when no seat took a card', () => {
    expect(harvestNotice.describe(span('harvest', 'a', ['a'], [played('harvest', 'a', ['a'])]), view())).toBeNull();
  });
});
