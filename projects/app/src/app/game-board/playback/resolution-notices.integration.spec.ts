import { buildContentRegistry, describeResolution, RESOLUTION_NOTICES } from 'content';
import { Action, CardInstance, GameState, getActiveSeatId, getLegalActions, moveCard, redactStateForSeat } from 'engine';
import { act, emptyHand, playCard, setGenerals } from '../../dev/recipe';
import { labTable } from '../../dev/lab/lab-animation';
import { resolutionSpans } from './resolution-spans';

// A real Blaze through the real engine, so the notice is checked against the events the engine truly logs.
const registry = buildContentRegistry();

const fromPile = (state: GameState, ok: (c: CardInstance) => boolean): CardInstance => state.zones.find((z) => z.kind === 'drawPile')!.cards.find(ok)!;
const toHand = (state: GameState, seatId: string, card: CardInstance): GameState => ({
  ...state,
  zones: moveCard(state.zones, card.instanceId, state.seats.find((s) => s.id === seatId)!.hand.zoneId),
});

// Answers every window with the first sensible action: pick the first eligible card, pass the rest.
function settle(start: GameState): GameState {
  let state = start;
  for (let i = 0; i < 30 && (state.pendingSelection || state.pendingChoice || state.pendingResponse || state.resolutionQueue); i++) {
    const seatId = getActiveSeatId(state)!;
    const legal = getLegalActions(state, seatId, registry);
    const select = legal.find((a): a is Extract<Action, { kind: 'SelectAction' }> => a.kind === 'SelectAction');
    const action = select ? { ...select, ids: [state.pendingSelection!.eligibleIds[0]] } : (legal.find((a) => a.kind === 'PassAction') ?? legal[0]);
    state = act(state, registry, action);
  }
  return state;
}

function blazeOn(userSuit: CardInstance['suit']): { state: GameState; from: number } {
  // Seat-1's Generals are fixed (Ji Ling and Yuan Shao, whose skills do not touch Blaze), so the bots' General picks cannot change it.
  let state = emptyHand(emptyHand(setGenerals(labTable(registry), registry, 'seat-1', 'kingdomWars:ji-ling', 'kingdomWars:yuan-shao'), 'seat-0'), 'seat-1');
  const shown = fromPile(state, (c) => c.suit === 'heart' && c.definitionId !== 'blaze');
  state = toHand(state, 'seat-1', shown);
  state = toHand(state, 'seat-0', fromPile(state, (c) => c.definitionId === 'blaze'));
  state = toHand(state, 'seat-0', fromPile(state, (c) => c.suit === userSuit && c.definitionId !== 'blaze' && c.instanceId !== shown.instanceId));
  const from = state.log.length;
  return { state: settle(playCard(state, registry, 'seat-0', 'blaze', ['seat-1'])), from };
}

function noticeOf(state: GameState, from: number) {
  const { spans } = resolutionSpans(state.log, from, true, (id) => id in RESOLUTION_NOTICES);
  expect(spans).toHaveLength(1);
  return describeResolution(spans[0].span, redactStateForSeat(state, 'seat-0'));
}

describe('a real Blaze, described', () => {
  it('a matching suit discards and hits', () => {
    const { state, from } = blazeOn('heart');
    const notice = noticeOf(state, from)!;
    expect(notice.outcome.headline.key).toBe('notice.blaze.hit');
    expect(notice.outcome.hp).toEqual({ seatId: 'seat-1' });
    expect(notice.cards).toHaveLength(2);
  });

  it('no matching suit misses', () => {
    const { state, from } = blazeOn('spade');
    const notice = noticeOf(state, from)!;
    expect(notice.outcome.headline.key).toBe('notice.blaze.missed');
    expect(notice.cards).toHaveLength(1);
  });
});

// Any other card: seat-0 holds it, seat-1 holds one known card, the rest are emptied so no one can answer.
function played(definitionId: string, targets: string[]): { state: GameState; from: number; held: CardInstance } {
  let state = ['seat-0', 'seat-1', 'seat-2', 'seat-3'].reduce((s, id) => emptyHand(s, id), labTable(registry));
  const held = fromPile(state, (c) => c.suit === 'heart' && !['blaze', definitionId].includes(c.definitionId));
  state = toHand(state, 'seat-1', held);
  state = toHand(state, 'seat-0', fromPile(state, (c) => c.definitionId === definitionId));
  const from = state.log.length;
  return { state: settle(playCard(state, registry, 'seat-0', definitionId, targets)), from, held };
}

describe('other real cards, described', () => {
  it('Harvest lists a pick for every living seat', () => {
    const { state, from } = played('harvest', []);
    const notice = noticeOf(state, from)!;
    expect(notice.seatCards).toHaveLength(state.seats.filter((s) => !s.eliminated).length);
  });
});
