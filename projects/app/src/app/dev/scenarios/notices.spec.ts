import { buildContentRegistry, describeResolution, RESOLUTION_NOTICES } from 'content';
import { Action, GameState, getActiveSeatId, getLegalActions, redactStateForSeat } from 'engine';
import { act, playCard } from '../recipe';
import { resolutionSpans } from '../../game-board/playback/resolution-spans';
import { findScenario } from './index';
import { BoardScenario } from '../scenario';

const registry = buildContentRegistry();
const scenario = (id: string) => findScenario(id) as BoardScenario;

// Answers every window the way a player would: picks the first card, says Use to an ask, passes the rest.
function settle(start: GameState): GameState {
  let state = start;
  for (let i = 0; i < 40 && (state.pendingSelection || state.pendingChoice || state.pendingResponse || state.resolutionQueue); i++) {
    const seatId = getActiveSeatId(state)!;
    const legal = getLegalActions(state, seatId, registry);
    const select = legal.find((a): a is Extract<Action, { kind: 'SelectAction' }> => a.kind === 'SelectAction');
    const use = legal.find((a) => a.kind === 'ChooseOptionAction' && a.optionId === 'use');
    state = act(state, registry, select ? { ...select, ids: [state.pendingSelection!.eligibleIds[0]] } : (use ?? legal.find((a) => a.kind === 'PassAction') ?? legal[0]));
  }
  return state;
}

function noticeAfter(state: GameState, from: number) {
  const { spans } = resolutionSpans(state.log, from, true, (id) => id in RESOLUTION_NOTICES);
  expect(spans).toHaveLength(1);
  return describeResolution(spans[0].span, redactStateForSeat(state, 'seat-0'));
}

describe('the Resolution Notice scenarios, played through', () => {
  it('Blaze hit: playing Blaze and discarding the heart hits', () => {
    const start = scenario('notice-blaze-hit').build(registry);
    const done = settle(playCard(start, registry, 'seat-0', 'blaze', ['seat-1']));
    expect(noticeAfter(done, start.log.length)!.outcome.headline.key).toBe('notice.blaze.hit');
  });

  it('Blaze missed: with no matching suit it misses', () => {
    const start = scenario('notice-blaze-miss').build(registry);
    const done = settle(playCard(start, registry, 'seat-0', 'blaze', ['seat-1']));
    expect(noticeAfter(done, start.log.length)!.outcome.headline.key).toBe('notice.blaze.missed');
  });

  it('Harvest: every seat takes a card', () => {
    const start = scenario('notice-harvest').build(registry);
    const done = settle(playCard(start, registry, 'seat-0', 'harvest', []));
    expect(noticeAfter(done, start.log.length)!.steps).toHaveLength(4);
  });

  it('Coerce: the weapon comes to you', () => {
    const start = scenario('notice-coerce').build(registry);
    const done = settle(playCard(start, registry, 'seat-0', 'coerce', ['seat-1', 'seat-2']));
    expect(noticeAfter(done, start.log.length)!.outcome.headline.key).toBe('notice.coerce.taken');
  });

  it('Resurgence: using it turns up cards and the notice follows', () => {
    const start = scenario('notice-resurgence').build(registry);
    const done = settle(start);
    const notice = noticeAfter(done, start.log.length - 4)!;
    expect(notice.source).toEqual({ kind: 'skill', id: 'resurgence', seatId: 'seat-0' });
    expect(notice.cards.length).toBeGreaterThan(0);
  });
});
