import type { Action, GameState, GeneralOwner, PendingChoice, PendingSelection } from 'engine';
import { englishTranslator } from '../i18n/translator';
import { judgmentDecision } from './judgment-decision';
import { card, cardReader, table, view } from './judgment-description.testing';

const devil = (seatId: string): GeneralOwner => ({ kind: 'general', seatId, slot: 'main', skillId: 'devil' });
const ask = (seatId: string, flagged = true): PendingChoice => ({
  id: 'ask-1', seatId, reason: { kind: 'ability', owner: devil(seatId), abilityId: 'devil', targetSeatId: 'seat-0' }, verb: 'use',
  options: [{ id: 'use', shows: { kind: 'use' }, effects: [] }, { id: 'decline', shows: { kind: 'decline' }, effects: [] }],
  ...(flagged ? { judgmentChange: true as const } : {}),
});
const askLegal = (seatId: string): Action[] => [
  { kind: 'ChooseOptionAction', seatId, choiceId: 'ask-1', optionId: 'use' },
  { kind: 'ChooseOptionAction', seatId, choiceId: 'ask-1', optionId: 'decline' },
];
const pick = (seatId: string, flagged = true): PendingSelection => ({
  id: 'sel-1', seatId, reason: { kind: 'ability', owner: devil(seatId), abilityId: 'devil', targetSeatId: 'seat-0' }, of: 'cards',
  eligibleIds: [`${seatId}-h0`, `${seatId}-h1`], min: 1, max: 1,
  then: { kind: 'replace-judgment', judgment: { seatId: 'seat-0', reader: cardReader('lightning'), card: card('j', 'spade', 5) }, owner: devil(seatId), abilityId: 'devil' },
  onCancel: [], ...(flagged ? { judgmentChange: true as const } : {}),
});
const pickLegal = (seatId: string): Action[] => [
  { kind: 'SelectAction', seatId, selectionId: 'sel-1', ids: [] },
  { kind: 'CancelSelectionAction', seatId, selectionId: 'sel-1' },
];

const open = (pending: Partial<GameState>, settled = false) => table(view(cardReader('lightning'), 'seat-0', card('j', 'spade', 5), { settled }), { pending });
const decide = (state: GameState, viewer: string, legal: Action[], shown = true) => judgmentDecision(state, viewer, legal, englishTranslator, shown);

describe('judgmentDecision', () => {
  it('is the ask for the seat that is asked, with the engine’s Use and Don’t', () => {
    const result = decide(open({ pendingChoice: ask('seat-1') }), 'seat-1', askLegal('seat-1'));
    expect(result).toMatchObject({ kind: 'mine', deciderName: 'Bo', step: { kind: 'ask', description: { use: askLegal('seat-1')[0], decline: askLegal('seat-1')[1] } } });
  });

  it('is the card pick that follows the ask, as the next step of the same decision', () => {
    const result = decide(open({ pendingSelection: pick('seat-1') }), 'seat-1', pickLegal('seat-1'));
    expect(result).toMatchObject({ kind: 'mine', step: { kind: 'select', description: { min: 1, max: 1, template: { selectionId: 'sel-1' } } } });
    expect(result?.kind === 'mine' && result.step.kind === 'select' && result.step.description.items.map((i) => i.id)).toEqual(['seat-1-h0', 'seat-1-h1']);
  });

  it('is only a waiting line, with the deciding seat’s name, for every other seat', () => {
    expect(decide(open({ pendingChoice: ask('seat-1') }), 'seat-0', [])).toEqual({ kind: 'watching', deciderName: 'Bo' });
    expect(decide(open({ pendingSelection: pick('seat-1') }), 'seat-0', [])).toEqual({ kind: 'watching', deciderName: 'Bo' });
  });

  it('is a gate, not the private choices, while that seat’s own view is not on screen (Pass and Play)', () => {
    expect(decide(open({ pendingChoice: ask('seat-1') }), 'seat-1', askLegal('seat-1'), false)).toEqual({ kind: 'gate', seatId: 'seat-1', deciderName: 'Bo' });
  });

  it('is not a judgment decision when the ask is not a changer’s', () => {
    expect(decide(open({ pendingChoice: ask('seat-1', false) }), 'seat-1', askLegal('seat-1'))).toBeNull();
    expect(decide(open({ pendingSelection: pick('seat-1', false) }), 'seat-1', pickLegal('seat-1'))).toBeNull();
  });

  it('is nothing once the judgment has settled, or without a judgment', () => {
    expect(decide(open({ pendingChoice: ask('seat-1') }, true), 'seat-1', askLegal('seat-1'))).toBeNull();
    expect(decide(table(undefined, { pending: { pendingChoice: ask('seat-1') } }), 'seat-1', askLegal('seat-1'))).toBeNull();
  });

  it('is only watching when the engine offers the asked seat nothing it could pick', () => {
    expect(decide(open({ pendingChoice: ask('seat-1') }), 'seat-1', [])).toEqual({ kind: 'watching', deciderName: 'Bo' });
  });
});
