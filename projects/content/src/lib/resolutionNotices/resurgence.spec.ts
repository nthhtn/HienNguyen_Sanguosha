import type { CardInstance, EngineEvent } from 'engine';
import { resurgenceNotice } from './resurgence';
import { span, view } from './helpers.testing';

const c = (id: string, suit: CardInstance['suit']): CardInstance => ({ instanceId: id, definitionId: 'sha', suit, rank: 5 });
const turnedUp = (cards: CardInstance[]): EngineEvent => ({ kind: 'CardsTurnedUpEvent', zoneId: 'processing', cards }) as unknown as EngineEvent;
const used: EngineEvent = { kind: 'AbilityUsedEvent', owner: { kind: 'general', seatId: 'a', slot: 'main', skillId: 'resurgence' }, abilityId: 'resurgence', outcome: 'revealed' } as unknown as EngineEvent;
const heal = (n: number): EngineEvent => ({ kind: 'HealEvent', target: { kind: 'seat', seatId: 'a' }, amount: n }) as unknown as EngineEvent;

function run(cards: CardInstance[], heals: EngineEvent[]) {
  const log = [turnedUp(cards), used, ...heals];
  return resurgenceNotice.describe(span('resurgence', 'a', [], log.slice(1), 1), view(log))!;
}

describe('Resurgence notice', () => {
  it('each heart recovers 1 HP and the rest go to the hand: the cards are shown and HP is marked', () => {
    const hearts = [c('1', 'heart'), c('2', 'heart')];
    const rest = c('3', 'spade');
    const n = run([...hearts, rest], [heal(1), heal(1)]);
    expect(n.source).toEqual({ kind: 'skill', id: 'resurgence', seatId: 'a' });
    expect(n.cards).toEqual([...hearts, rest].map((card) => ({ card })));
    expect(n.outcome).toMatchObject({ tone: 'good', hp: { seatId: 'a' }, text: { key: 'notice.resurgence.recovered.one', params: { userSeat: 'a', amount: 2, rest: 1 } } });
  });
  it('a reveal with no heart recovers nothing and says so', () => {
    const n = run([c('1', 'spade'), c('2', 'club')], []);
    expect(n.outcome).toMatchObject({ tone: 'neutral', text: { key: 'notice.resurgence.noHeart.other', params: { userSeat: 'a', rest: 2 } } });
    expect(n.outcome.hp).toBeUndefined();
  });
  it('with only hearts, nothing goes to the hand', () => {
    const n = run([c('1', 'heart'), c('2', 'heart')], [heal(1), heal(1)]);
    expect(n.outcome.text).toEqual({ key: 'notice.resurgence.recoveredAll', params: { userSeat: 'a', amount: 2 } });
  });
});
