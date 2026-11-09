import type { CardInstance, EngineEvent, GameState } from 'engine';
import type { ResolutionSpan } from '../resolutionNotice';
import { blazeNotice } from './blaze';

const view = {
  seats: ['a', 'b'].map((id) => ({ id, hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` } })),
  zones: [],
  log: [],
} as unknown as GameState;

const card = (instanceId: string, suit: CardInstance['suit'], rank: number): CardInstance => ({ instanceId, definitionId: 'sha', suit, rank });
const shownCard = card('x', 'heart', 7);
const discardedCard = card('k', 'heart', 13);

const play = { kind: 'CardPlayedEvent', seatId: 'a', card: { as: 'blaze', colour: 'red', physical: [] }, targets: [{ kind: 'seat', seatId: 'b' }] } as unknown as EngineEvent;
const toolMoved = { kind: 'CardMovedEvent', cardInstanceId: 'bl1', fromZoneId: 'a:hand', toZoneId: 'discardPile', card: { instanceId: 'bl1', definitionId: 'blaze', suit: 'heart', rank: 2 } } as unknown as EngineEvent;
const shown = { kind: 'CardShownEvent', seatId: 'b', card: shownCard, abilityId: 'blaze' } as unknown as EngineEvent;
const discarded = { kind: 'CardMovedEvent', cardInstanceId: 'k', fromZoneId: 'a:hand', toZoneId: 'discardPile', card: discardedCard } as unknown as EngineEvent;
const damage = { kind: 'DamageDealtEvent', damage: { target: { kind: 'seat', seatId: 'b' }, amount: 1, nature: 'fire' } } as unknown as EngineEvent;

const span = (events: EngineEvent[]): ResolutionSpan => ({ sourceId: 'blaze', userSeatId: 'a', targetSeatIds: ['b'], startIndex: 0, endIndex: events.length - 1, events });

describe('Blaze notice', () => {
  it('a hit shows the shown card, the matching discard and the damage', () => {
    const n = blazeNotice.describe(span([play, toolMoved, shown, discarded, damage]), view)!;
    expect(n.source).toEqual({ kind: 'card', id: 'blaze' });
    expect(n.seatIds).toEqual(['a', 'b']);
    expect(n.steps.map((s) => s.key)).toEqual(['notice.blaze.shown', 'notice.blaze.discarded']);
    expect(n.cards).toEqual([{ card: shownCard }, { card: discardedCard }]);
    expect(n.outcome).toMatchObject({ tone: 'good', headline: { key: 'notice.blaze.hit', params: { card: 'blaze' } }, text: { key: 'notice.blaze.hitText', params: { targetSeat: 'b', amount: 1 } }, hp: { seatId: 'b' } });
  });

  it('with no matching discard it missed: bad for the user, no HP change', () => {
    const n = blazeNotice.describe(span([play, toolMoved, shown]), view)!;
    expect(n.steps.map((s) => s.key)).toEqual(['notice.blaze.shown', 'notice.blaze.noDiscard']);
    expect(n.cards).toEqual([{ card: shownCard }]);
    expect(n.outcome.tone).toBe('bad');
    expect(n.outcome.headline.key).toBe('notice.blaze.missed');
    expect(n.outcome.hp).toBeUndefined();
  });

  it('has nothing to show when no card was shown (a Wuxie cancelled it)', () => {
    expect(blazeNotice.describe(span([play, toolMoved]), view)).toBeNull();
  });
});
