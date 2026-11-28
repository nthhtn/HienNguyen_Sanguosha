import { Action, CardInstance, PendingResponse, usedCardOf } from 'engine';
import { BEGINNER_SKIP_WINDOWS, NoAnswerWindow, noAnswerWindowOf, skipsNoAnswerWindow } from './no-answer-window';

const card = (id: string): CardInstance => ({ instanceId: `${id}-1`, definitionId: id, suit: 'spade', rank: 7 });
const used = (as: string) => ({ ...usedCardOf(card(as)), as });
const cardWindow = (as: string, allowed: string[]): PendingResponse =>
  ({
    id: 'w1', respondingSeatId: 'seat-0', allowedActionKinds: ['RespondAction', 'PassAction'], allowedCardIds: allowed,
    reason: { kind: 'card-effect', card: used(as), userSeatId: 'seat-1' },
    context: { effect: { kind: 'DamageEffect' } },
  }) as unknown as PendingResponse;
const skillWindow = (abilityId: string): PendingResponse =>
  ({
    id: 'w2', respondingSeatId: 'seat-0', allowedActionKinds: ['RespondAction', 'PassAction'], allowedCardIds: ['sha'],
    reason: { kind: 'ability', owner: { kind: 'general', seatId: 'seat-1', slot: 'main', skillId: abilityId }, abilityId, targetSeatId: 'seat-1' },
    context: { effect: { kind: 'DamageEffect' } },
  }) as unknown as PendingResponse;

const pass: Action = { kind: 'PassAction', seatId: 'seat-0', pendingResponseId: 'w1' };
const respond: Action = { kind: 'RespondAction', seatId: 'seat-0', pendingResponseId: 'w1', cardInstanceId: 'shan-1' } as Action;
const convert = { kind: 'UseConversionAction' } as unknown as Action;

describe('noAnswerWindowOf', () => {
  it.each<[string, PendingResponse, NoAnswerWindow]>([
    ['sha', cardWindow('sha', ['shan']), 'sha'],
    ['hail-of-arrows', cardWindow('hail-of-arrows', ['shan']), 'hail-of-arrows'],
    ['barbarians', cardWindow('barbarians', ['sha']), 'barbarians'],
    ['duel', cardWindow('duel', ['sha']), 'duel'],
    ['coerce', cardWindow('coerce', ['sha']), 'coerce'],
    ['upheaval', skillWindow('upheaval'), 'upheaval'],
    ['kingdom wars upheaval', skillWindow('kingdomWars:upheaval'), 'upheaval'],
    ['instigate', skillWindow('instigate'), 'instigate'],
  ])('names the %s window', (_name, pending, expected) => {
    expect(noAnswerWindowOf(pending)).toBe(expected);
  });

  it('has no name for a Wuxie window or another skill', () => {
    expect(noAnswerWindowOf({ ...cardWindow('wuxie', ['wuxie']), reason: { kind: 'wuxie' } } as unknown as PendingResponse)).toBeNull();
    expect(noAnswerWindowOf(skillWindow('bewilder'))).toBeNull();
  });
});

describe('skipsNoAnswerWindow', () => {
  it('returns the Pass to submit for a listed window with only Pass legal', () => {
    expect(skipsNoAnswerWindow(cardWindow('sha', ['shan']), [pass], BEGINNER_SKIP_WINDOWS, false)).toBe(pass);
    expect(skipsNoAnswerWindow(cardWindow('duel', ['sha']), [pass], BEGINNER_SKIP_WINDOWS, false)).toBe(pass);
  });

  it('skips nothing while the list is empty', () => {
    expect(skipsNoAnswerWindow(cardWindow('sha', ['shan']), [pass], [], false)).toBeNull();
  });

  it('keeps the popup for Coerce, Upheaval and Instigate, which work as notices', () => {
    expect(BEGINNER_SKIP_WINDOWS).toEqual(['sha', 'hail-of-arrows', 'barbarians', 'duel']);
    expect(skipsNoAnswerWindow(cardWindow('coerce', ['sha']), [pass], BEGINNER_SKIP_WINDOWS, false)).toBeNull();
    expect(skipsNoAnswerWindow(skillWindow('upheaval'), [pass], BEGINNER_SKIP_WINDOWS, false)).toBeNull();
    expect(skipsNoAnswerWindow(skillWindow('instigate'), [pass], BEGINNER_SKIP_WINDOWS, false)).toBeNull();
  });

  it('keeps the popup when the seat can answer: a card to play or a conversion to use', () => {
    expect(skipsNoAnswerWindow(cardWindow('sha', ['shan']), [pass, respond], BEGINNER_SKIP_WINDOWS, false)).toBeNull();
    expect(skipsNoAnswerWindow(cardWindow('sha', ['shan']), [pass, convert], BEGINNER_SKIP_WINDOWS, false)).toBeNull();
  });

  it('never skips in a Tutorial lesson', () => {
    expect(skipsNoAnswerWindow(cardWindow('sha', ['shan']), [pass], BEGINNER_SKIP_WINDOWS, true)).toBeNull();
  });

  it('skips nothing when Pass is not offered', () => {
    expect(skipsNoAnswerWindow(cardWindow('sha', ['shan']), [], BEGINNER_SKIP_WINDOWS, false)).toBeNull();
  });
});
