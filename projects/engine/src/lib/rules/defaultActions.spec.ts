import { Action } from '../pipeline/actions';
import { GameState } from '../domain/types';
import { defaultActionsFor } from './defaultActions';

const turn = { turnNumber: 1, ownerSeatId: 'seat-0', extraTurnStack: [] };
const state = (fields: object = {}): GameState => ({ turn, ...fields }) as unknown as GameState;

describe('defaultActionsFor', () => {
  it('an arrangement times out with every card on top, as given', () => {
    const template: Action = { kind: 'ArrangeCardsAction', seatId: 'seat-0', arrangementId: 'arr', top: [], bottom: [] };
    const s = state({ pendingArrangement: { id: 'arr', seatId: 'seat-0', cardInstanceIds: ['t1', 't2'] } });
    expect(defaultActionsFor(s, [template])).toEqual([{ ...template, top: ['t1', 't2'], bottom: [] }]);
  });

  it('cancels a selection that may be cancelled', () => {
    const cancel: Action = { kind: 'CancelSelectionAction', seatId: 'seat-0', selectionId: 's' };
    const select: Action = { kind: 'SelectAction', seatId: 'seat-0', selectionId: 's', ids: [] };
    expect(defaultActionsFor(state({ pendingSelection: { eligibleIds: ['a'], min: 1 } }), [select, cancel])).toEqual([cancel]);
  });

  it('else picks the first eligible ids a selection needs', () => {
    const select: Action = { kind: 'SelectAction', seatId: 'seat-0', selectionId: 's', ids: [] };
    expect(defaultActionsFor(state({ pendingSelection: { eligibleIds: ['a', 'b', 'c'], min: 2 } }), [select])).toEqual([{ ...select, ids: ['a', 'b'] }]);
  });

  it('declines an ask, else takes the first option', () => {
    const opt = (optionId: string): Action => ({ kind: 'ChooseOptionAction', seatId: 'seat-0', choiceId: 'c', optionId });
    expect(defaultActionsFor(state(), [opt('x'), opt('decline')])).toEqual([opt('decline')]);
    expect(defaultActionsFor(state(), [opt('x'), opt('y')])).toEqual([opt('x')]);
  });

  it('answers No Response', () => {
    const pass: Action = { kind: 'PassAction', seatId: 'seat-0', pendingResponseId: 'r' };
    const respond: Action = { kind: 'RespondAction', seatId: 'seat-0', pendingResponseId: 'r', cardInstanceId: 'card-1' };
    expect(defaultActionsFor(state(), [respond, pass])).toEqual([pass]);
  });

  it('takes the first General pair', () => {
    const pair = (mainId: string): Action => ({ kind: 'ChooseGeneralsAction', seatId: 'seat-0', mainId, deputyId: 'd' });
    expect(defaultActionsFor(state(), [pair('a'), pair('b')])).toEqual([pair('a')]);
  });

  it('a timeout at the Start window submits End Phase', () => {
    const end: Action = { kind: 'EndPhaseAction', seatId: 'seat-0' };
    const revealMain: Action = { kind: 'ConfirmRevealsAction', seatId: 'seat-0', slots: ['main'] };
    const revealDeputy: Action = { kind: 'ConfirmRevealsAction', seatId: 'seat-0', slots: ['deputy'] };
    const s = state({ phase: 'Start', turn: { ...turn, startWindow: true } });
    expect(defaultActionsFor(s, [end, revealMain, revealDeputy])).toEqual([end]);
    expect(defaultActionsFor(s, [revealMain, revealDeputy, end])).toEqual([end]);
  });

  it('else ends the phase', () => {
    const end: Action = { kind: 'EndPhaseAction', seatId: 'seat-0' };
    const play: Action = { kind: 'PlayCardAction', seatId: 'seat-0', cardInstanceId: 'card-1', targets: [] };
    expect(defaultActionsFor(state(), [play, end])).toEqual([end]);
  });
});

describe('defaultActionsFor a settled judgment', () => {
  it('is a timeout acknowledgement', () => {
    const ack: Action = { kind: 'AcknowledgeJudgmentAction', seatId: 'seat-0' };
    expect(defaultActionsFor(state({ judgmentView: { settled: true } }), [ack])).toEqual([{ ...ack, timeout: true }]);
  });
});
