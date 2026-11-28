import { Action, CardInstance, PendingResponse, usedCardOf } from 'engine';
import { AUTO_PASS_WINDOWS, AutoPassWindow, autoPassWindowOf, autoPassAction } from './auto-pass-window';

const card = (id: string): CardInstance => ({ instanceId: `${id}-1`, definitionId: id, suit: 'spade', rank: 7 });
const used = (as: string) => ({ ...usedCardOf(card(as)), as });
const cardWindow = (as: string, allowed: string[]): PendingResponse =>
  ({
    id: 'w1', respondingSeatId: 'seat-0', allowedActionKinds: ['RespondAction', 'PassAction'], allowedCardIds: allowed,
    reason: { kind: 'card-effect', card: used(as), userSeatId: 'seat-1' },
    context: { effect: { kind: 'DamageEffect' } },
  }) as unknown as PendingResponse;
// A real Duel window: it names its card by sourceCard and carries no reason (content/src/lib/cards/duel.ts).
const duelStep = (): PendingResponse =>
  ({ id: 'duel-response-d1', respondingSeatId: 'seat-0', allowedActionKinds: ['RespondAction', 'PassAction'], announcePass: true, allowedCardIds: ['sha'], sourceCard: { instanceId: 'd1', definitionId: 'duel' }, context: { effect: { kind: 'DamageEffect' } } }) as unknown as PendingResponse;
const skillWindow = (abilityId: string): PendingResponse =>
  ({
    id: 'w2', respondingSeatId: 'seat-0', allowedActionKinds: ['RespondAction', 'PassAction'], allowedCardIds: ['sha'],
    reason: { kind: 'ability', owner: { kind: 'general', seatId: 'seat-1', slot: 'main', skillId: abilityId }, abilityId, targetSeatId: 'seat-1' },
    context: { effect: { kind: 'DamageEffect' } },
  }) as unknown as PendingResponse;

const pass: Action = { kind: 'PassAction', seatId: 'seat-0', pendingResponseId: 'w1' };
const respond: Action = { kind: 'RespondAction', seatId: 'seat-0', pendingResponseId: 'w1', cardInstanceId: 'shan-1' } as Action;
const convert = { kind: 'UseConversionAction' } as unknown as Action;

describe('autoPassWindowOf', () => {
  it.each<[string, PendingResponse, AutoPassWindow]>([
    ['sha', cardWindow('sha', ['shan']), 'sha'],
    ['hail-of-arrows', cardWindow('hail-of-arrows', ['shan']), 'hail-of-arrows'],
    ['barbarians', cardWindow('barbarians', ['sha']), 'barbarians'],
    ['duel', cardWindow('duel', ['sha']), 'duel'],
    ['a real duel window with no reason', duelStep(), 'duel'],
    ['kingdom wars descend into chaos', skillWindow('kingdomWars:descend-into-chaos'), 'upheaval'],
    ['coerce', cardWindow('coerce', ['sha']), 'coerce'],
    ['upheaval', skillWindow('upheaval'), 'upheaval'],
    ['kingdom wars upheaval', skillWindow('kingdomWars:upheaval'), 'upheaval'],
    ['instigate', skillWindow('instigate'), 'instigate'],
  ])('names the %s window', (_name, pending, expected) => {
    expect(autoPassWindowOf(pending)).toBe(expected);
  });

  it('has no name for a Wuxie window or another skill', () => {
    expect(autoPassWindowOf({ ...cardWindow('wuxie', ['wuxie']), reason: { kind: 'wuxie' } } as unknown as PendingResponse)).toBeNull();
    expect(autoPassWindowOf(skillWindow('bewilder'))).toBeNull();
  });
});

describe('autoPassAction', () => {
  it('returns the Pass to submit for a listed window with only Pass legal', () => {
    expect(autoPassAction(cardWindow('sha', ['shan']), [pass], AUTO_PASS_WINDOWS, false)).toBe(pass);
    expect(autoPassAction(cardWindow('duel', ['sha']), [pass], AUTO_PASS_WINDOWS, false)).toBe(pass);
  });

  it('skips nothing while the list is empty', () => {
    expect(autoPassAction(cardWindow('sha', ['shan']), [pass], [], false)).toBeNull();
  });

  it('skips a real Duel window, which has no reason', () => {
    expect(autoPassAction(duelStep(), [pass], AUTO_PASS_WINDOWS, false)).toBe(pass);
  });

  it('keeps the popup for Coerce, Upheaval and Instigate, which work as notices', () => {
    expect(AUTO_PASS_WINDOWS).toEqual(['sha', 'hail-of-arrows', 'barbarians', 'duel']);
    expect(autoPassAction(cardWindow('coerce', ['sha']), [pass], AUTO_PASS_WINDOWS, false)).toBeNull();
    expect(autoPassAction(skillWindow('upheaval'), [pass], AUTO_PASS_WINDOWS, false)).toBeNull();
    expect(autoPassAction(skillWindow('instigate'), [pass], AUTO_PASS_WINDOWS, false)).toBeNull();
  });

  it('keeps the popup when the seat can answer: a card to play or a conversion to use', () => {
    expect(autoPassAction(cardWindow('sha', ['shan']), [pass, respond], AUTO_PASS_WINDOWS, false)).toBeNull();
    expect(autoPassAction(cardWindow('sha', ['shan']), [pass, convert], AUTO_PASS_WINDOWS, false)).toBeNull();
  });

  it('never skips in a Tutorial lesson', () => {
    expect(autoPassAction(cardWindow('sha', ['shan']), [pass], AUTO_PASS_WINDOWS, true)).toBeNull();
  });

  it('skips nothing when Pass is not offered', () => {
    expect(autoPassAction(cardWindow('sha', ['shan']), [], AUTO_PASS_WINDOWS, false)).toBeNull();
  });
});
