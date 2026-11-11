import type { CardInstance, EngineEvent, GameState } from 'engine';
import type { ResolutionSpan } from '../resolutionNotice';
import { coerceNotice } from './take-cards';

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
const moved = (over: object) => ({ kind: 'CardMovedEvent', cardInstanceId: 'h1', fromZoneId: 'b:hand', toZoneId: 'a:hand', ...over }) as unknown as EngineEvent;
const span = (id: string, targets: string[], events: EngineEvent[]): ResolutionSpan => ({ sourceId: id, userSeatId: 'a', targetSeatIds: targets, startIndex: 0, endIndex: events.length - 1, events });

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
