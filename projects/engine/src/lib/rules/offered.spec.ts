import { Action } from '../pipeline/actions';
import { isOfferedAction } from './offered';

type PlayCard = Extract<Action, { kind: 'PlayCardAction' }>;

const endPhase: Action = { kind: 'EndPhaseAction', seatId: 'seat-0' };
const discard = (cardInstanceId: string): Action => ({ kind: 'DiscardCardAction', seatId: 'seat-0', cardInstanceId });
const sha: Action = { kind: 'PlayCardAction', seatId: 'seat-0', cardInstanceId: 'card-3', targets: [{ kind: 'seat', seatId: 'seat-1' }] };
const template: PlayCard = {
  kind: 'PlayCardAction',
  seatId: 'seat-0',
  cardInstanceId: 'card-4',
  targets: [],
  pickTargets: { eligibleIds: ['seat-1', 'seat-2'], min: 1, max: 2 },
};
const select: Action = { kind: 'SelectAction', seatId: 'seat-0', selectionId: 'sel-1', ids: [] };
const arrange: Action = { kind: 'ArrangeCardsAction', seatId: 'seat-0', arrangementId: 'arr-1', top: [], bottom: [] };

describe('isOfferedAction', () => {
  it('accepts an offered action exactly as offered, in any key order', () => {
    expect(isOfferedAction({ seatId: 'seat-0', kind: 'EndPhaseAction' }, [discard('card-1'), endPhase])).toBe(true);
    const reordered = { targets: [{ seatId: 'seat-1', kind: 'seat' }], cardInstanceId: 'card-3', seatId: 'seat-0', kind: 'PlayCardAction' } as Action;
    expect(isOfferedAction(reordered, [sha])).toBe(true);
  });

  it('refuses a kind the engine did not offer, such as drawing cards', () => {
    expect(isOfferedAction({ kind: 'DrawCardsAction', seatId: 'seat-0', count: 5 }, [endPhase, discard('card-1')])).toBe(false);
    expect(isOfferedAction(endPhase, [])).toBe(false);
  });

  it('refuses an offered kind with other values', () => {
    expect(isOfferedAction(discard('card-9'), [discard('card-1')])).toBe(false);
    expect(isOfferedAction({ ...sha, targets: [{ kind: 'seat', seatId: 'seat-2' }] } as Action, [sha])).toBe(false);
    expect(isOfferedAction({ kind: 'EndPhaseAction', seatId: 'seat-1' }, [endPhase])).toBe(false);
  });

  it('refuses an offered action with an extra field', () => {
    expect(isOfferedAction({ ...endPhase, count: 3 } as Action, [endPhase])).toBe(false);
  });

  it('lets the player fill in a selection and an arrangement, and nothing else on them', () => {
    expect(isOfferedAction({ ...select, ids: ['card-1'] } as Action, [select])).toBe(true);
    expect(isOfferedAction({ ...select, selectionId: 'sel-2', ids: ['card-1'] } as Action, [select])).toBe(false);
    expect(isOfferedAction({ ...arrange, top: ['card-2'], bottom: ['card-1'] } as Action, [arrange])).toBe(true);
    expect(isOfferedAction({ ...arrange, arrangementId: 'arr-2' } as Action, [arrange])).toBe(false);
  });

  it('lets the player pick targets on a template that offers a pick, with or without the pick itself', () => {
    const { pickTargets: _pick, ...use } = template;
    expect(isOfferedAction({ ...use, targets: [{ kind: 'seat', seatId: 'seat-2' }] }, [template])).toBe(true);
    expect(isOfferedAction({ ...template, targets: [{ kind: 'seat', seatId: 'seat-1' }] }, [template])).toBe(true);
    expect(isOfferedAction({ ...use, cardInstanceId: 'card-5', targets: [{ kind: 'seat', seatId: 'seat-2' }] }, [template])).toBe(false);
  });

  describe('an acknowledgement of a settled judgment', () => {
    const acknowledge: Action = { kind: 'AcknowledgeJudgmentAction', seatId: 'seat-a' };

    it('may carry by, the seat whose player pressed Close', () => {
      expect(isOfferedAction({ ...acknowledge, by: 'seat-b' } as Action, [acknowledge])).toBe(true);
    });

    it('is refused for another seat than the offered one', () => {
      expect(isOfferedAction({ kind: 'AcknowledgeJudgmentAction', seatId: 'seat-b' }, [acknowledge])).toBe(false);
    });

    it('is the only action where by is free', () => {
      expect(isOfferedAction({ ...endPhase, by: 'seat-1' } as Action, [endPhase])).toBe(false);
    });
  });
});
