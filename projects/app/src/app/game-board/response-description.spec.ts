import { CardInstance, EngineEvent, GameState, PendingResponse } from 'engine';
import { describeResponse, startsOnNoResponse, waitingLine } from './response-description';

const duel: CardInstance = { instanceId: 'duel-1', definitionId: 'duel', suit: 'spade', rank: 1 };
const sha: CardInstance = { instanceId: 'sha-1', definitionId: 'sha', suit: 'spade', rank: 7 };
const seat = (seatId: string) => ({ kind: 'seat' as const, seatId });

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

describe('describeResponse', () => {
  it('names the card that asks for a response, who played it on whom, and what No Response costs', () => {
    const log: EngineEvent[] = [{ kind: 'CardPlayedEvent', seatId: 'seat-1', card: sha, targets: [seat('seat-0')] }];
    expect(describeResponse(state(log, damageWindow('w1', 'seat-0', 'seat-1', 'sha-1')), 'seat-0')).toEqual({
      source: 'Seat 1 played Sha against Hing',
      latest: null,
      prompt: 'Your turn to respond to Sha',
      outcome: 'You lose 1 HP (1 damage from Seat 1)',
      outcomeForce: 'none', // seat-0 isn't seated in this fixture, so no known force
    });
  });

  it('follows a Duel’s back-and-forth: the latest answer, and the damage now coming from the other side', () => {
    const log: EngineEvent[] = [
      { kind: 'CardPlayedEvent', seatId: 'seat-0', card: duel, targets: [seat('seat-1')] },
      { kind: 'CardPlayedEvent', seatId: 'seat-1', card: sha, targets: [], inResponseTo: { seatId: 'seat-0', cardInstanceId: 'duel-1' } },
    ];
    expect(describeResponse(state(log, damageWindow('w2', 'seat-0', 'seat-1', 'duel-1', duel)), 'seat-0')).toEqual({
      source: 'Hing played Duel against Seat 1',
      latest: 'Seat 1 answered with Sha',
      prompt: 'Your turn to respond to Duel',
      outcome: 'You lose 1 HP (1 damage from Seat 1)',
      outcomeForce: 'none',
    });
  });

  it('asks to save a dying seat, saying how many Peaches it still needs', () => {
    const dyingWindow = (seatId: string): PendingResponse => ({
      id: 'd1', respondingSeatId: 'seat-0', allowedActionKinds: ['RespondAction', 'PassAction'], allowedCardIds: ['peach'],
      reason: { kind: 'dying', seatId },
      context: { effect: { kind: 'DyingEffect', seatId, order: [], rescueCardIds: ['peach'] } },
    });
    const withHp = (s: GameState, seatId: string, hp: number): GameState => ({
      ...s,
      seats: [seatId === 'seat-0' ? 'seat-0' : 'seat-1'].map((id, index) => ({
        id, index, kingdom: 'Wei' as const, eliminated: false, combinedHp: hp, maxCombinedHp: 4, generals: null,
        hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` },
      })),
    });
    expect(describeResponse(withHp(state([], dyingWindow('seat-1')), 'seat-1', 0), 'seat-0')).toEqual({
      source: 'Seat 1 is dying (HP 0)', latest: null, prompt: 'Play a Peach to save Seat 1?', outcome: 'Seat 1 is eliminated', outcomeForce: 'Wei',
    });
    expect(describeResponse(withHp(state([], dyingWindow('seat-0')), 'seat-0', -2), 'seat-0')).toEqual({
      source: 'You are dying (HP -2)', latest: null, prompt: 'Play a Peach to save yourself? (needs 3 Peaches)', outcome: 'You are eliminated', outcomeForce: 'Wei',
    });
  });

  it('is null when nothing is pending', () => {
    expect(describeResponse(state([], null), 'seat-0')).toBeNull();
  });
});

const barbarians: CardInstance = { instanceId: 'barb-1', definitionId: 'barbarians', suit: 'spade', rank: 7 };
const drawTwo: CardInstance = { instanceId: 'dt-1', definitionId: 'draw-two', suit: 'heart', rank: 7 };
const used = (card: CardInstance) => ({ as: card.definitionId, colour: 'black' as const, suit: card.suit, rank: card.rank, physical: [card] });
const noop = { kind: 'SkipNextEffect' as const };
const wuxieWindow = (responder: string, reason: PendingResponse['reason']): PendingResponse => ({
  id: 'x1', respondingSeatId: responder, allowedActionKinds: ['RespondAction', 'PassAction'], allowedCardIds: ['wuxie'], reason, context: { effect: noop },
});

describe('describeResponse: Wuxie Kongjie checks', () => {
  it('asks whether to cancel a Tool aimed at the viewer', () => {
    const log: EngineEvent[] = [{ kind: 'CardPlayedEvent', seatId: 'seat-1', card: barbarians, targets: [] }];
    const pending = wuxieWindow('seat-0', { kind: 'wuxie', tool: used(barbarians), toolUserSeatId: 'seat-1', target: seat('seat-0') });
    expect(describeResponse(state(log, pending), 'seat-0')).toMatchObject({
      source: 'Seat 1 used Barbarians on you',
      prompt: 'Play Wuxie to cancel it?',
      outcome: 'Barbarians takes effect on you',
    });
  });

  it('leaves out the target when the Tool is aimed at its own user', () => {
    const log: EngineEvent[] = [{ kind: 'CardPlayedEvent', seatId: 'seat-1', card: drawTwo, targets: [] }];
    const pending = wuxieWindow('seat-0', { kind: 'wuxie', tool: used(drawTwo), toolUserSeatId: 'seat-1', target: seat('seat-1') });
    expect(describeResponse(state(log, pending), 'seat-0')).toMatchObject({ source: 'Seat 1 used Draw Two', outcome: 'Draw Two takes effect' });
  });

  it('asks whether to cancel another seat’s Wuxie Kongjie', () => {
    const pending = wuxieWindow('seat-0', { kind: 'counter-wuxie', wuxieSeatId: 'seat-2' });
    expect(describeResponse(state([], pending), 'seat-0')).toMatchObject({
      source: 'Seat 2 played Wuxie',
      prompt: 'Play Wuxie to cancel it?',
      outcome: "Seat 2's Wuxie stands",
    });
  });
});

describe('waitingLine', () => {
  it('is null when nothing is pending', () => {
    expect(waitingLine(state([], null))).toBeNull();
  });

  it('says who is asked, and what for', () => {
    const dying: PendingResponse = {
      id: 'd1', respondingSeatId: 'seat-0', allowedActionKinds: ['RespondAction', 'PassAction'], allowedCardIds: ['peach'],
      reason: { kind: 'dying', seatId: 'seat-2' }, context: { effect: noop },
    };
    expect(waitingLine(state([], dying))).toBe('Waiting on Hing to save Seat 2');
    const wuxie = wuxieWindow('seat-0', { kind: 'wuxie', tool: used(barbarians), toolUserSeatId: 'seat-1', target: seat('seat-0') });
    expect(waitingLine(state([], wuxie))).toBe('Waiting on Hing: Wuxie?');
    const barbariansWindow: PendingResponse = {
      id: 'b1', respondingSeatId: 'seat-1', allowedActionKinds: ['RespondAction', 'PassAction'], allowedCardIds: ['sha'],
      reason: { kind: 'card-effect', card: used(barbarians), userSeatId: 'seat-0' }, context: { effect: noop },
    };
    expect(waitingLine(state([], barbariansWindow))).toBe('Waiting on Seat 1 to answer Barbarians');
    expect(waitingLine(state([], damageWindow('s1', 'seat-1', 'seat-0', 'sha-1')))).toBe('Waiting on Seat 1');
  });
});

describe('startsOnNoResponse', () => {
  it('is true for Wuxie questions only, so one click never cancels a Tool by accident', () => {
    expect(startsOnNoResponse(state([], wuxieWindow('seat-0', { kind: 'wuxie', tool: used(barbarians), toolUserSeatId: 'seat-0', target: seat('seat-1') })))).toBe(true);
    expect(startsOnNoResponse(state([], wuxieWindow('seat-0', { kind: 'counter-wuxie', wuxieSeatId: 'seat-2' })))).toBe(true);
    expect(startsOnNoResponse(state([], damageWindow('s1', 'seat-0', 'seat-1', 'sha-1')))).toBe(false);
    expect(startsOnNoResponse(state([], null))).toBe(false);
  });
});
