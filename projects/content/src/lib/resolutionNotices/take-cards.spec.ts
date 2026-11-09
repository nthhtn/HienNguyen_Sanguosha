import type { CardInstance, EngineEvent, GameState } from 'engine';
import type { ResolutionSpan } from '../resolutionNotice';
import { breakNotice, coerceNotice, stealNotice } from './take-cards';

const stolen: CardInstance = { instanceId: 'h1', definitionId: 'peach', suit: 'heart', rank: 4 };
const crossbow: CardInstance = { instanceId: 'w1', definitionId: 'zhuge-crossbow', suit: 'club', rank: 1 };

// The viewer is seat a, who now holds `stolen` in their hand.
const viewOf = (viewerSeesCard: boolean) => ({
  seats: ['a', 'b'].map((id) => ({ id, hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` } })),
  zones: [
    { id: 'discardPile', kind: 'discardPile', cards: [] },
    { id: 'a:hand', kind: 'hand', ownerSeatId: 'a', cards: [viewerSeesCard ? stolen : { instanceId: 'h1', definitionId: 'hidden', suit: 'spade', rank: 0 }, ...(viewerSeesCard ? [crossbow] : [])] },
  ],
  log: [],
}) as unknown as GameState;

const play = (as: string, targets: string[]) => ({ kind: 'CardPlayedEvent', seatId: 'a', card: { as, colour: 'red', physical: [{ instanceId: `${as}-1` }] }, targets: targets.map((seatId) => ({ kind: 'seat', seatId })) }) as unknown as EngineEvent;
const chose = (shows: object) => ({ kind: 'ChoiceMadeEvent', seatId: 'a', reason: { kind: 'choice' }, verb: 'take', shows }) as unknown as EngineEvent;
const moved = (over: object) => ({ kind: 'CardMovedEvent', cardInstanceId: 'h1', fromZoneId: 'b:hand', toZoneId: 'a:hand', ...over }) as unknown as EngineEvent;
const span = (id: string, targets: string[], events: EngineEvent[]): ResolutionSpan => ({ sourceId: id, userSeatId: 'a', targetSeatIds: targets, startIndex: 0, endIndex: events.length - 1, events });

describe('Steal notice', () => {
  const hand = [play('steal', ['b']), chose({ kind: 'hidden-hand', seatId: 'b', count: 2 }), moved({})];

  it('a card from a hand: shown to the seat that can see it, a card back to the rest', () => {
    const seen = stealNotice.describe(span('steal', ['b'], hand), viewOf(true))!;
    expect(seen.cards).toEqual([{ card: stolen }]);
    expect(seen.outcome).toMatchObject({ tone: 'good', headline: { key: 'notice.steal.hand' }, text: { key: 'notice.steal.handText', params: { userSeat: 'a', targetSeat: 'b' } } });
    expect(stealNotice.describe(span('steal', ['b'], hand), viewOf(false))!.cards).toEqual([{ card: null }]);
  });

  it('a worn card is named, and shown face up to everyone', () => {
    const n = stealNotice.describe(span('steal', ['b'], [play('steal', ['b']), chose({ kind: 'card', card: crossbow }), moved({ cardInstanceId: 'w1', fromZoneId: 'b:equip' })]), viewOf(false))!;
    expect(n.cards).toEqual([{ card: crossbow }]);
    expect(n.outcome).toMatchObject({ headline: { key: 'notice.steal.equipment' }, text: { key: 'notice.steal.equipmentText', params: { userSeat: 'a', targetSeat: 'b', card: 'zhuge-crossbow' } } });
  });

  it('has nothing to show when no card was picked (a Wuxie cancelled it)', () => {
    expect(stealNotice.describe(span('steal', ['b'], [play('steal', ['b'])]), viewOf(true))).toBeNull();
  });
});

describe('Break notice', () => {
  it('shows the card that was discarded, named', () => {
    const discarded: CardInstance = { instanceId: 'h1', definitionId: 'peach', suit: 'diamond', rank: 5 };
    const n = breakNotice.describe(span('break', ['b'], [play('break', ['b']), chose({ kind: 'hidden-hand', seatId: 'b', count: 1 }), moved({ toZoneId: 'discardPile', card: discarded })]), viewOf(false))!;
    expect(n.cards).toEqual([{ card: discarded }]);
    expect(n.outcome).toMatchObject({ tone: 'good', headline: { key: 'notice.break.discarded' }, text: { key: 'notice.break.discardedText', params: { targetSeat: 'b', card: 'peach' } } });
  });

  it('does not mistake the Break card itself, which also lands in the discard pile, for the picked card', () => {
    const own = moved({ cardInstanceId: 'break-1', fromZoneId: 'a:hand', toZoneId: 'discardPile', card: { instanceId: 'break-1', definitionId: 'break', suit: 'spade', rank: 3 } });
    const picked: CardInstance = { instanceId: 'h1', definitionId: 'peach', suit: 'diamond', rank: 5 };
    const n = breakNotice.describe(span('break', ['b'], [play('break', ['b']), own, chose({ kind: 'hidden-hand', seatId: 'b', count: 1 }), moved({ toZoneId: 'discardPile', card: picked })]), viewOf(false))!;
    expect(n.cards).toEqual([{ card: picked }]);
  });

  it('after a countered Wuxie, shows the picked card and not a Wuxie that also went to the discard pile', () => {
    const wuxie: CardInstance = { instanceId: 'wx1', definitionId: 'wuxie', suit: 'spade', rank: 11 };
    const picked: CardInstance = { instanceId: 'h1', definitionId: 'peach', suit: 'diamond', rank: 5 };
    const wuxiePlayed = { kind: 'CardPlayedEvent', seatId: 'c', card: { as: 'wuxie', colour: 'black', physical: [{ instanceId: 'wx1' }] }, targets: [], inResponseTo: { targetSeatId: 'b' } } as unknown as EngineEvent;
    const wuxieMoved = moved({ cardInstanceId: 'wx1', fromZoneId: 'c:hand', toZoneId: 'discardPile', card: wuxie });
    const n = breakNotice.describe(span('break', ['b'], [play('break', ['b']), wuxiePlayed, wuxieMoved, chose({ kind: 'hidden-hand', seatId: 'b', count: 1 }), moved({ toZoneId: 'discardPile', card: picked })]), viewOf(false))!;
    expect(n.cards).toEqual([{ card: picked }]);
    expect(n.outcome.text.params).toMatchObject({ card: 'peach' });
  });

  it('has nothing to show when nothing was discarded', () => {
    expect(breakNotice.describe(span('break', ['b'], [play('break', ['b'])]), viewOf(false))).toBeNull();
  });
});

describe('Coerce notice', () => {
  it('the weapon moves to the user when the holder does not use Sha', () => {
    const n = coerceNotice.describe(span('coerce', ['b', 'c'], [play('coerce', ['b', 'c']), moved({ cardInstanceId: 'w1', fromZoneId: 'b:equip' })]), viewOf(true))!;
    expect(n.seatIds).toEqual(['a', 'b', 'c']);
    expect(n.steps.map((s) => s.key)).toEqual(['notice.coerce.mustSha', 'notice.coerce.noSha']);
    expect(n.cards).toEqual([{ card: crossbow }]);
    expect(n.outcome).toMatchObject({ tone: 'good', headline: { key: 'notice.coerce.taken' }, text: { key: 'notice.coerce.takenText', params: { userSeat: 'a', holderSeat: 'b' } } });
  });

  it('has nothing to show when the holder used Sha (Sha has its own response)', () => {
    expect(coerceNotice.describe(span('coerce', ['b', 'c'], [play('coerce', ['b', 'c'])]), viewOf(true))).toBeNull();
  });
});
