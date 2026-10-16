import { CardInstance, Effect, EngineEvent, GameState, PendingResponse, usedCardOf } from 'engine';
import { makeTranslator } from '../i18n/translator';
import { vi } from '../i18n/vi';
import { describeResponse, waitingLine } from './response-description';

const tr = makeTranslator(vi);
const both = <T>(build: (translator?: typeof tr) => T): { en: T; vi: T } => ({ en: build(), vi: build(tr) });

const duel: CardInstance = { instanceId: 'duel-1', definitionId: 'duel', suit: 'spade', rank: 1 };
const sha: CardInstance = { instanceId: 'sha-1', definitionId: 'sha', suit: 'spade', rank: 7 };
const seat = (seatId: string) => ({ kind: 'seat' as const, seatId });
const used = (card: CardInstance) => ({ as: card.definitionId, colour: 'black' as const, suit: card.suit, rank: card.rank, physical: [card] });
const noop = { kind: 'SkipNextEffect' as const };

function state(log: EngineEvent[], pendingResponse: PendingResponse | null): GameState {
  return {
    seats: [], zones: [], log, pendingResponse, result: null, generalSelection: null, phase: 'Play',
    players: [
      { id: 'p0', seatId: 'seat-0', kind: 'human', name: 'Hing' },
      { id: 'p1', seatId: 'seat-1', kind: 'bot', name: 'Seat 1' },
      { id: 'p2', seatId: 'seat-2', kind: 'bot', name: 'Seat 2' },
    ],
    turn: { turnNumber: 1, ownerSeatId: 'seat-1', extraTurnStack: [] }, rng: { seed: 1, counter: 0 },
  };
}
const damageWindow = (id: string, responder: string, from: string, cause: string, sourceCard?: CardInstance): PendingResponse => ({
  id, respondingSeatId: responder, allowedActionKinds: ['RespondAction', 'PassAction'],
  context: { effect: { kind: 'DamageEffect', damage: { source: seat(from), target: seat(responder), amount: 1, nature: 'normal', cause: { cardInstanceId: cause } } } },
  ...(sourceCard ? { sourceCard: { instanceId: sourceCard.instanceId, definitionId: sourceCard.definitionId } } : {}),
});
const wuxieWindow = (responder: string, reason: PendingResponse['reason']): PendingResponse => ({
  id: 'x1', respondingSeatId: responder, allowedActionKinds: ['RespondAction', 'PassAction'], allowedCardIds: ['wuxie'], reason, context: { effect: noop },
});

describe('what started the window, in English and Vietnamese', () => {
  const playLog = (targets: ReturnType<typeof seat>[]): EngineEvent[] => [{ kind: 'CardPlayedEvent', seatId: 'seat-1', card: usedCardOf(sha), targets }];

  it('a Sha played at the viewer', () => {
    const s = state(playLog([seat('seat-0')]), damageWindow('w1', 'seat-0', 'seat-1', 'sha-1'));
    expect(both((t) => describeResponse(s, 'seat-0', undefined, t))).toEqual({
      en: { source: 'Seat 1 played Sha against Hing', latest: null, prompt: 'Your turn to respond to Sha', outcome: 'You lose 1 HP (1 damage from Seat 1)', outcomeForce: 'none' },
      vi: { source: 'Người chơi 1 đánh Sha nhắm vào Hing', latest: null, prompt: 'Đến lượt bạn phản hồi Sha', outcome: 'Bạn mất 1 Sinh lực (1 sát thương từ Người chơi 1)', outcomeForce: 'none' },
    });
  });

  it('a card with no target, and a window whose card was never seen played', () => {
    const none = state(playLog([]), damageWindow('w1', 'seat-0', 'seat-1', 'sha-1'));
    expect(both((t) => describeResponse(none, 'seat-0', undefined, t)!.source)).toEqual({ en: 'Seat 1 played Sha', vi: 'Người chơi 1 đánh Sha' });
    const unseen = state([], damageWindow('w1', 'seat-0', 'seat-1', 'sha-1'));
    expect(both((t) => { const d = describeResponse(unseen, 'seat-0', undefined, t)!; return [d.source, d.prompt]; })).toEqual({
      en: ['A response is needed', 'Your turn to respond'],
      vi: ['Cần một phản hồi', 'Đến lượt bạn phản hồi'],
    });
  });

  it('a Duel’s latest answer', () => {
    const log: EngineEvent[] = [
      { kind: 'CardPlayedEvent', seatId: 'seat-0', card: usedCardOf(duel), targets: [seat('seat-1')] },
      { kind: 'CardPlayedEvent', seatId: 'seat-1', card: usedCardOf(sha), targets: [], inResponseTo: { seatId: 'seat-0', cardInstanceId: 'duel-1' } },
    ];
    const s = state(log, damageWindow('w2', 'seat-0', 'seat-1', 'duel-1', duel));
    expect(both((t) => describeResponse(s, 'seat-0', undefined, t)!.latest)).toEqual({ en: 'Seat 1 answered with Sha', vi: 'Người chơi 1 phản hồi bằng Sha' });
  });

  it('an armour’s judgment as the latest, for the viewer and for another seat', () => {
    const et = usedCardOf({ instanceId: 'et', definitionId: 'eight-trigrams', suit: 'spade', rank: 2 });
    const judged: CardInstance = { instanceId: 'j', definitionId: 'peach', suit: 'club', rank: 3 };
    const log: EngineEvent[] = [
      { kind: 'CardPlayedEvent', seatId: 'seat-1', card: usedCardOf(sha), targets: [seat('seat-0')] },
      { kind: 'JudgmentEvent', seatId: 'seat-0', reader: { kind: 'card', card: et }, card: judged },
      { kind: 'CardMovedEvent', cardInstanceId: 'j', fromZoneId: 'processing', toZoneId: 'discardPile', card: judged },
    ];
    const s = state(log, damageWindow('w1', 'seat-0', 'seat-1', 'sha-1'));
    expect(both((t) => describeResponse(s, 'seat-0', undefined, t)!.latest)).toEqual({ en: 'Your Eight Trigrams judgment: 3 ♣', vi: 'Phán xét Eight Trigrams của bạn: 3 ♣' });
    expect(both((t) => describeResponse(s, 'seat-2', undefined, t)!.latest)).toEqual({ en: "Hing's Eight Trigrams judgment: 3 ♣", vi: 'Phán xét Eight Trigrams của Hing: 3 ♣' });
  });

  it('is null when nothing is pending', () => {
    expect(describeResponse(state([], null), 'seat-0', undefined, tr)).toBeNull();
  });
});

describe('what No Response costs, in English and Vietnamese', () => {
  const base = state([{ kind: 'CardPlayedEvent', seatId: 'seat-1', card: usedCardOf(sha), targets: [seat('seat-0')] }], damageWindow('w1', 'seat-0', 'seat-1', 'sha-1'));
  const withZones: GameState = {
    ...base,
    zones: [
      { id: 'seat-0:hand', kind: 'hand', ownerSeatId: 'seat-0', cards: [sha] },
      { id: 'seat-1:hand', kind: 'hand', ownerSeatId: 'seat-1', cards: [] },
      { id: 'discardPile', kind: 'discardPile', cards: [] },
    ],
  };
  const outcome = (viewer: string, effect: Effect) => both((t) => describeResponse(withZones, viewer, () => effect, t)!.outcome);

  it('damage to another seat, from nowhere, with a nature word', () => {
    const hit = { kind: 'DamageEffect', damage: { source: null, target: seat('seat-1'), amount: 3, nature: 'thunder' } } as Effect;
    expect(outcome('seat-0', hit)).toEqual({ en: 'Seat 1 loses 3 HP (3 thunder damage)', vi: 'Người chơi 1 mất 3 Sinh lực (3 sát thương sét)' });
  });

  it('damage to a Main General is never "You"', () => {
    const hit = { kind: 'DamageEffect', damage: { source: seat('seat-2'), target: { kind: 'general', seatId: 'seat-0', generalSlot: 'main' }, amount: 1, nature: 'normal' } } as Effect;
    expect(outcome('seat-0', hit)).toEqual({
      en: "Hing's Main General loses 1 HP (1 damage from Seat 2)",
      vi: 'Chủ tướng của Hing mất 1 Sinh lực (1 sát thương từ Người chơi 2)',
    });
  });

  it('healing and drawing, one card and several', () => {
    expect(outcome('seat-0', { kind: 'HealEffect', target: seat('seat-1'), amount: 2 } as Effect)).toEqual({ en: 'Seat 1 recovers 2 HP', vi: 'Người chơi 1 hồi 2 Sinh lực' });
    expect(outcome('seat-0', { kind: 'DrawCardsEffect', seatId: 'seat-1', count: 1 } as Effect)).toEqual({ en: 'Seat 1 draws 1 card', vi: 'Người chơi 1 rút 1 lá bài' });
    expect(outcome('seat-0', { kind: 'DrawCardsEffect', seatId: 'seat-1', count: 2 } as Effect)).toEqual({ en: 'Seat 1 draws 2 cards', vi: 'Người chơi 1 rút 2 lá bài' });
  });

  it('a card moving to another seat or to the viewer, an unknown card, no owner, another effect', () => {
    expect(outcome('seat-0', { kind: 'MoveCardEffect', cardInstanceId: 'sha-1', toZoneId: 'seat-1:hand' } as Effect)).toEqual({ en: 'Sha goes to Seat 1', vi: 'Sha chuyển cho Người chơi 1' });
    expect(outcome('seat-0', { kind: 'MoveCardEffect', cardInstanceId: 'sha-1', toZoneId: 'seat-0:hand' } as Effect)).toEqual({ en: 'Sha goes to you', vi: 'Sha chuyển cho bạn' });
    expect(outcome('seat-0', { kind: 'MoveCardEffect', cardInstanceId: 'nobody', toZoneId: 'seat-1:hand' } as Effect)).toEqual({ en: 'A card goes to Seat 1', vi: 'Một lá bài chuyển cho Người chơi 1' });
    expect(outcome('seat-0', { kind: 'MoveCardEffect', cardInstanceId: 'sha-1', toZoneId: 'discardPile' } as Effect)).toEqual({ en: 'The effect goes ahead', vi: 'Hiệu ứng được thực hiện' });
    expect(outcome('seat-0', noop as Effect)).toEqual({ en: 'The effect goes ahead', vi: 'Hiệu ứng được thực hiện' });
  });
});

describe('the dying round, in English and Vietnamese', () => {
  const dyingWindow = (seatId: string, allowedCardIds = ['peach']): PendingResponse => ({
    id: 'd1', respondingSeatId: 'seat-0', allowedActionKinds: ['RespondAction', 'PassAction'], allowedCardIds,
    reason: { kind: 'dying', seatId },
    context: { effect: { kind: 'DyingEffect', seatId, order: [], rescueCardIds: { any: ['peach'], self: ['wine'] } } },
  });
  const seated = (s: GameState, hp: number, hand: CardInstance[] = []): GameState => ({
    ...s,
    seats: ['seat-0', 'seat-1'].map((id, index) => ({
      id, index, kingdom: 'Wei' as const, eliminated: false, combinedHp: hp, maxCombinedHp: 4, generals: null,
      hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` },
    })),
    zones: [{ id: 'seat-0:hand', kind: 'hand', ownerSeatId: 'seat-0', cards: hand }],
  });
  const wine: CardInstance = { instanceId: 'w1', definitionId: 'wine', suit: 'spade', rank: 9 };

  it('another seat is dying', () => {
    expect(both((t) => describeResponse(seated(state([], dyingWindow('seat-1')), 0), 'seat-0', undefined, t))).toEqual({
      en: { source: 'Seat 1 is dying (HP 0)', latest: null, prompt: 'Play a Peach to save Seat 1?', outcome: 'Seat 1 is eliminated', outcomeForce: 'Wei' },
      vi: { source: 'Người chơi 1 cận kề cái chết (Sinh lực 0)', latest: null, prompt: 'Đánh Peach để cứu Người chơi 1?', outcome: 'Người chơi 1 bị loại', outcomeForce: 'Wei' },
    });
  });

  it('the viewer is dying and needs three Peaches', () => {
    expect(both((t) => describeResponse(seated(state([], dyingWindow('seat-0')), -2), 'seat-0', undefined, t))).toEqual({
      en: { source: 'You are dying (HP -2)', latest: null, prompt: 'Play a Peach to save yourself? (needs 3 Peaches)', outcome: 'You are eliminated', outcomeForce: 'Wei' },
      vi: { source: 'Bạn cận kề cái chết (Sinh lực -2)', latest: null, prompt: 'Đánh Peach để cứu chính bạn? (cần 3 Peach)', outcome: 'Bạn bị loại', outcomeForce: 'Wei' },
    });
  });

  it('one Peach needed prints no suffix, and Wine is offered only when held', () => {
    const holding = seated(state([], dyingWindow('seat-0', ['peach', 'wine'])), 0, [wine]);
    const empty = seated(state([], dyingWindow('seat-0', ['peach', 'wine'])), 0);
    expect(both((t) => describeResponse(holding, 'seat-0', undefined, t)!.prompt)).toEqual({ en: 'Play a Peach or Wine to save yourself?', vi: 'Đánh Peach hoặc Wine để cứu chính bạn?' });
    expect(both((t) => describeResponse(empty, 'seat-0', undefined, t)!.prompt)).toEqual({ en: 'Play a Peach to save yourself?', vi: 'Đánh Peach để cứu chính bạn?' });
  });
});

describe('Wuxie and Coerce windows, in English and Vietnamese', () => {
  const barbarians: CardInstance = { instanceId: 'barb-1', definitionId: 'barbarians', suit: 'spade', rank: 7 };
  const drawTwo: CardInstance = { instanceId: 'dt-1', definitionId: 'draw-two', suit: 'heart', rank: 7 };
  const capture: CardInstance = { instanceId: 'cap-1', definitionId: 'capture', suit: 'spade', rank: 6 };
  const cancel = { en: 'Play Wuxie to cancel it?', vi: 'Đánh Wuxie để hủy?' };

  it('a Tool aimed at the viewer, at another seat, and at its own user', () => {
    const aimed = (target: string) => state([], wuxieWindow('seat-0', { kind: 'wuxie', tool: used(barbarians), toolUserSeatId: 'seat-1', target: seat(target) }));
    expect(both((t) => describeResponse(aimed('seat-0'), 'seat-0', undefined, t))).toMatchObject({
      en: { source: 'Seat 1 used Barbarians on you', prompt: cancel.en, outcome: 'Barbarians takes effect on you' },
      vi: { source: 'Người chơi 1 dùng Barbarians lên bạn', prompt: cancel.vi, outcome: 'Barbarians có hiệu lực lên bạn' },
    });
    expect(both((t) => describeResponse(aimed('seat-2'), 'seat-0', undefined, t))).toMatchObject({
      en: { source: 'Seat 1 used Barbarians on Seat 2', outcome: 'Barbarians takes effect on Seat 2' },
      vi: { source: 'Người chơi 1 dùng Barbarians lên Người chơi 2', outcome: 'Barbarians có hiệu lực lên Người chơi 2' },
    });
    const own = state([], wuxieWindow('seat-0', { kind: 'wuxie', tool: used(drawTwo), toolUserSeatId: 'seat-1', target: seat('seat-1') }));
    expect(both((t) => describeResponse(own, 'seat-0', undefined, t))).toMatchObject({
      en: { source: 'Seat 1 used Draw Two', outcome: 'Draw Two takes effect' },
      vi: { source: 'Người chơi 1 dùng Draw Two', outcome: 'Draw Two có hiệu lực' },
    });
  });

  it('another seat’s counter Wuxie', () => {
    const counter = state([], wuxieWindow('seat-0', { kind: 'counter-wuxie', wuxieSeatId: 'seat-2' }));
    expect(both((t) => describeResponse(counter, 'seat-0', undefined, t))).toMatchObject({
      en: { source: 'Seat 2 played Wuxie', prompt: cancel.en, outcome: "Seat 2's Wuxie stands" },
      vi: { source: 'Người chơi 2 đánh Wuxie', prompt: cancel.vi, outcome: 'Wuxie của Người chơi 2 có hiệu lực' },
    });
  });

  it('a delayed Tool in a judgment area, for another seat and for the viewer', () => {
    const judging = (owner: string): GameState => ({
      ...state([], wuxieWindow('seat-0', { kind: 'wuxie', tool: used(capture), toolUserSeatId: owner, target: seat(owner) })),
      zones: [{ id: `${owner}:judgment`, kind: 'judgment', ownerSeatId: owner, cards: [capture] }],
    });
    expect(both((t) => describeResponse(judging('seat-1'), 'seat-0', undefined, t))).toMatchObject({
      en: { source: 'Seat 1 is about to judge Capture', outcome: 'Seat 1 judges Capture' },
      vi: { source: 'Người chơi 1 sắp phán xét Capture', outcome: 'Người chơi 1 phán xét Capture' },
    });
    expect(both((t) => describeResponse(judging('seat-0'), 'seat-0', undefined, t))).toMatchObject({
      en: { source: 'You are about to judge Capture', outcome: 'You judge Capture' },
      vi: { source: 'Bạn sắp phán xét Capture', outcome: 'Bạn phán xét Capture' },
    });
  });

  it('Coerce: play a Sha at the victim, or hand over the weapon', () => {
    const coerce: CardInstance = { instanceId: 'co-1', definitionId: 'coerce', suit: 'club', rank: 12 };
    const blade: CardInstance = { instanceId: 'blade-1', definitionId: 'green-dragon-blade', suit: 'spade', rank: 5 };
    const pending = (victimSeatId: string): PendingResponse => ({
      id: 'k1', respondingSeatId: 'seat-0', allowedActionKinds: ['RespondAction', 'PassAction'], allowedCardIds: ['sha'],
      reason: { kind: 'card-effect', card: used(coerce), userSeatId: 'seat-1', victimSeatId },
      sourceCard: { instanceId: 'co-1', definitionId: 'coerce' },
      context: { effect: { kind: 'MoveCardEffect', cardInstanceId: 'blade-1', toZoneId: 'seat-1:hand' } },
    });
    const zones: GameState['zones'] = [
      { id: 'seat-0:equip', kind: 'equip', ownerSeatId: 'seat-0', cards: [blade] },
      { id: 'seat-1:hand', kind: 'hand', ownerSeatId: 'seat-1', cards: [] },
    ];
    expect(both((t) => describeResponse({ ...state([], pending('seat-2')), zones }, 'seat-0', undefined, t))).toMatchObject({
      en: { source: 'Seat 1 used Coerce on you', prompt: 'Play Sha at Seat 2?', outcome: 'Green Dragon Blade goes to Seat 1' },
      vi: { source: 'Người chơi 1 dùng Coerce lên bạn', prompt: 'Đánh Sha vào Người chơi 2?', outcome: 'Green Dragon Blade chuyển cho Người chơi 1' },
    });
    expect(both((t) => describeResponse({ ...state([], pending('seat-0')), zones }, 'seat-0', undefined, t)!.prompt)).toEqual({ en: 'Play Sha at you?', vi: 'Đánh Sha vào bạn?' });
  });
});

describe('the Upheaval and Instigate windows, in English and Vietnamese', () => {
  const upheavalOwner = { kind: 'general' as const, seatId: 'seat-0', slot: 'main' as const, skillId: 'upheaval' };
  const upheaval = (targetSeatId?: string): PendingResponse => ({
    id: 'u', respondingSeatId: 'seat-1', allowedActionKinds: ['RespondAction', 'PassAction'], allowedCardIds: ['sha'],
    reason: { kind: 'ability', owner: upheavalOwner, abilityId: 'upheaval', ...(targetSeatId ? { targetSeatId } : {}) },
    context: { effect: { kind: 'SkillStepEffect', owner: upheavalOwner, step: 'penalty', data: {} } },
  });
  const instigateOwner = { kind: 'general' as const, seatId: 'seat-0', slot: 'main' as const, skillId: 'instigate' };
  const instigate: PendingResponse = {
    id: 'i', respondingSeatId: 'seat-1', allowedActionKinds: ['RespondAction', 'PassAction'], allowedCardIds: ['sha'],
    reason: { kind: 'ability', owner: instigateOwner, abilityId: 'instigate', targetSeatId: 'seat-0' },
    context: { effect: { kind: 'SkillStepEffect', owner: instigateOwner, step: 'penalty', data: { seatId: 'seat-1' } } },
  };

  it('Upheaval: the seat picked, the viewer, and no seat picked yet', () => {
    expect(both((t) => describeResponse(state([], upheaval('seat-2')), 'seat-1', undefined, t))).toMatchObject({
      en: { source: 'Hing used Upheaval', prompt: 'Play a Sha at Seat 2, or lose 1 HP?', outcome: 'You lose 1 HP' },
      vi: { source: 'Hing dùng Upheaval', prompt: 'Đánh Sha vào Người chơi 2, hoặc mất 1 Sinh lực?', outcome: 'Bạn mất 1 Sinh lực' },
    });
    expect(both((t) => describeResponse(state([], upheaval('seat-1')), 'seat-1', undefined, t)!.prompt)).toEqual({ en: 'Play a Sha at you, or lose 1 HP?', vi: 'Đánh Sha vào bạn, hoặc mất 1 Sinh lực?' });
    expect(both((t) => describeResponse(state([], upheaval()), 'seat-1', undefined, t)!.prompt)).toEqual({
      en: 'Play a Sha at the seat you picked, or lose 1 HP?',
      vi: 'Đánh Sha vào người chơi bạn đã chọn, hoặc mất 1 Sinh lực?',
    });
    expect(both((t) => describeResponse(state([], upheaval('seat-2')), 'seat-0', undefined, t)!.outcome)).toEqual({ en: 'Seat 1 loses 1 HP', vi: 'Người chơi 1 mất 1 Sinh lực' });
  });

  it('Instigate: to the responder, to the instigator, and to a bystander', () => {
    expect(both((t) => describeResponse(state([], instigate), 'seat-1', undefined, t))).toMatchObject({
      en: { source: 'Hing used Instigate', prompt: 'Use a Sha on Hing', outcome: 'Hing discards one of your cards', passLabel: 'Pass (Discard 1 Card)' },
      vi: { source: 'Hing dùng Instigate', prompt: 'Đánh Sha vào Hing', outcome: 'Hing bỏ một lá bài của bạn', passLabel: 'Bỏ qua (bỏ 1 lá bài)' },
    });
    expect(both((t) => describeResponse(state([], instigate), 'seat-0', undefined, t)!.prompt)).toEqual({ en: 'Use a Sha on you', vi: 'Đánh Sha vào bạn' });
    expect(both((t) => describeResponse(state([], instigate), 'seat-2', undefined, t)!.outcome)).toEqual({ en: "Hing discards one of Seat 1's cards", vi: 'Hing bỏ một lá bài của Người chơi 1' });
  });
});

describe('waitingLine, in English and Vietnamese', () => {
  const owner = { kind: 'equipment' as const, seatId: 'seat-1', cardInstanceId: 'ax' };

  it('a selection, an ability ask and a card choice', () => {
    const selecting: GameState = {
      ...state([], null),
      pendingSelection: { id: 's1', seatId: 'seat-1', reason: { kind: 'ability', owner, abilityId: 'axe' }, of: 'cards', eligibleIds: [], min: 2, max: 2, then: { kind: 'discard' } },
    };
    expect(both((t) => waitingLine(selecting, t))).toEqual({ en: 'Waiting on Seat 1 to choose', vi: 'Đang chờ Người chơi 1 chọn' });
    const asking: GameState = {
      ...state([], null),
      pendingChoice: { id: 'ask', seatId: 'seat-1', verb: 'use', reason: { kind: 'ability', owner, abilityId: 'axe' }, options: [] },
    };
    expect(both((t) => waitingLine(asking, t))).toEqual({ en: 'Waiting on Seat 1: Axe?', vi: 'Đang chờ Người chơi 1: Axe?' });
    const choosing: GameState = {
      ...state([], null),
      pendingChoice: { id: 'c', seatId: 'seat-0', verb: 'take', options: [], reason: { kind: 'choice', card: { as: 'steal', colour: 'black', physical: [] }, userSeatId: 'seat-0' } },
    };
    expect(both((t) => waitingLine(choosing, t))).toEqual({ en: 'Waiting on Hing to choose a card', vi: 'Đang chờ Hing chọn một lá bài' });
  });

  it('nothing pending is null', () => {
    expect(waitingLine(state([], null), tr)).toBeNull();
  });

  it('a response window for each reason', () => {
    const barbarians: CardInstance = { instanceId: 'barb-1', definitionId: 'barbarians', suit: 'spade', rank: 7 };
    const dying: PendingResponse = {
      id: 'd1', respondingSeatId: 'seat-0', allowedActionKinds: ['RespondAction', 'PassAction'], allowedCardIds: ['peach'],
      reason: { kind: 'dying', seatId: 'seat-2' }, context: { effect: noop },
    };
    expect(both((t) => waitingLine(state([], dying), t))).toEqual({ en: 'Waiting on Hing to save Seat 2', vi: 'Đang chờ Hing cứu Người chơi 2' });
    const wuxie = wuxieWindow('seat-0', { kind: 'wuxie', tool: used(barbarians), toolUserSeatId: 'seat-1', target: seat('seat-0') });
    expect(both((t) => waitingLine(state([], wuxie), t))).toEqual({ en: 'Waiting on Hing: Wuxie?', vi: 'Đang chờ Hing: Wuxie?' });
    const answer: PendingResponse = {
      id: 'b1', respondingSeatId: 'seat-1', allowedActionKinds: ['RespondAction', 'PassAction'], allowedCardIds: ['sha'],
      reason: { kind: 'card-effect', card: used(barbarians), userSeatId: 'seat-0' }, context: { effect: noop },
    };
    expect(both((t) => waitingLine(state([], answer), t))).toEqual({ en: 'Waiting on Seat 1 to answer Barbarians', vi: 'Đang chờ Người chơi 1 phản hồi Barbarians' });
    expect(both((t) => waitingLine(state([], damageWindow('s1', 'seat-1', 'seat-0', 'sha-1')), t))).toEqual({ en: 'Waiting on Seat 1', vi: 'Đang chờ Người chơi 1' });
    const abilityWindow = (skillId: string, abilityOwner: ReturnType<typeof upheavalOwnerFor>): PendingResponse => ({
      id: skillId, respondingSeatId: 'seat-1', allowedActionKinds: ['RespondAction', 'PassAction'], allowedCardIds: ['sha'],
      reason: { kind: 'ability', owner: abilityOwner, abilityId: skillId, targetSeatId: 'seat-2' },
      context: { effect: { kind: 'SkillStepEffect', owner: abilityOwner, step: 'penalty', data: {} } },
    });
    expect(both((t) => waitingLine(state([], abilityWindow('upheaval', upheavalOwnerFor('upheaval'))), t))).toEqual({
      en: 'Waiting on Seat 1 to play a Sha for Upheaval',
      vi: 'Đang chờ Người chơi 1 đánh Sha cho Upheaval',
    });
    expect(both((t) => waitingLine(state([], abilityWindow('instigate', upheavalOwnerFor('instigate'))), t))).toEqual({
      en: 'Waiting on Seat 1 to play a Sha for Instigate',
      vi: 'Đang chờ Người chơi 1 đánh Sha cho Instigate',
    });
  });
});

function upheavalOwnerFor(skillId: string) {
  return { kind: 'general' as const, seatId: 'seat-0', slot: 'main' as const, skillId };
}
