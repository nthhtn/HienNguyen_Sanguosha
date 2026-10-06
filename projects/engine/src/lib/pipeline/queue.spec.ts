import { resolve, MAX_RESOLUTION_STEPS } from './resolve';
import { createRng } from '../rng/rng';
import { GameState } from '../domain/types';
import { CardDefinition, ContentRegistry, GameModeDefinition } from '../registry/types';
import { Effect } from './effects';

function mode(overrides: Partial<GameModeDefinition> = {}): GameModeDefinition {
  return {
    id: 'stub',
    setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'],
    checkWinCondition: () => null,
    triggers: [],
    ...overrides,
  };
}

function state(handCardId: string): GameState {
  const seat = (id: string, index: number) => ({
    id, index, kingdom: (index === 0 ? 'Wei' : 'Shu') as 'Wei' | 'Shu',
    generals: { main: { generalDefinitionId: `${id}-m`, revealed: true }, deputy: { generalDefinitionId: `${id}-d`, revealed: true } },
    combinedHp: 4, maxCombinedHp: 6, hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` }, eliminated: false,
  });
  return {
    seats: [seat('seat-a', 0), seat('seat-b', 1)],
    players: [],
    turn: { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [] },
    phase: 'Play',
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: [1, 2, 3].map((n) => ({ instanceId: `d${n}`, definitionId: 'filler', suit: 'club' as const, rank: n })) },
      { id: 'discardPile', kind: 'discardPile', cards: [] },
      { id: 'seat-a:hand', kind: 'hand', ownerSeatId: 'seat-a', cards: [{ instanceId: 'played', definitionId: handCardId, suit: 'spade', rank: 1 }] },
      { id: 'seat-a:equip', kind: 'equip', ownerSeatId: 'seat-a', cards: [] },
      { id: 'seat-b:hand', kind: 'hand', ownerSeatId: 'seat-b', cards: [] },
      { id: 'seat-b:equip', kind: 'equip', ownerSeatId: 'seat-b', cards: [] },
    ],
    pendingResponse: null, log: [], rng: createRng(1), result: null, generalSelection: null,
  };
}

const damageB: Effect = { kind: 'DamageEffect', damage: { source: { kind: 'seat', seatId: 'seat-a' }, target: { kind: 'seat', seatId: 'seat-b' }, amount: 1, nature: 'normal' } };
const healA: Effect = { kind: 'HealEffect', target: { kind: 'seat', seatId: 'seat-a' }, amount: 1 };

function cardThat(id: string, effects: Effect[]): CardDefinition {
  return { id, name: id, category: 'basic', play: () => effects };
}

function registry(...cards: CardDefinition[]): ContentRegistry {
  return { cards: new Map(cards.map((c) => [c.id, c])), generals: new Map() };
}

const play = (s: GameState, ctx: { registry: ContentRegistry; mode: GameModeDefinition }) =>
  resolve(s, { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'played', targets: [] }, ctx).state;
const hp = (s: GameState, id: string) => s.seats.find((x) => x.id === id)!.combinedHp;

describe('resolution queue', () => {
  const window: Effect = {
    kind: 'OpenResponseEffect',
    pendingResponse: { id: 'w1', respondingSeatId: 'seat-b', allowedActionKinds: ['RespondAction', 'PassAction'], context: { effect: damageB } },
  };

  it('pauses at a response window: effects queued after it wait for the answer', () => {
    const ctx = { registry: registry(cardThat('asker', [window, healA])), mode: mode() };
    const paused = play(state('asker'), ctx);
    expect(paused.pendingResponse?.id).toBe('w1');
    expect(hp(paused, 'seat-a')).toBe(4); // the heal has not happened yet
    expect(paused.resolutionQueue).toEqual([healA]);

    const resumed = resolve(paused, { kind: 'PassAction', seatId: 'seat-b', pendingResponseId: 'w1' }, ctx).state;
    expect(hp(resumed, 'seat-b')).toBe(3);
    expect(hp(resumed, 'seat-a')).toBe(5);
    expect(resumed.resolutionQueue).toBeUndefined();
    expect(resumed.log.map((e) => e.kind)).toEqual(['CardPlayedEvent', 'CardMovedEvent', 'DamageDealtEvent', 'HealEvent']);
  });

  it('moves the used card to the discard pile right after it is played, before its effects', () => {
    const ctx = { registry: registry(cardThat('drawer', [{ kind: 'DrawCardsEffect', seatId: 'seat-a', count: 1 }])), mode: mode() };
    const next = play(state('drawer'), ctx);
    expect(next.log.map((e) => e.kind)).toEqual(['CardPlayedEvent', 'CardMovedEvent', 'CardsDrawnEvent']);
  });

  it('keeps trigger follow-ups ahead of the next sibling effect (pin)', () => {
    const drawThenDamage = cardThat('combo', [{ kind: 'DrawCardsEffect', seatId: 'seat-a', count: 1 }, damageB]);
    const healOnDraw = mode({
      triggers: [{ point: 'after:CardsDrawnEvent', condition: () => true, effect: () => [healA] }],
    });
    const next = play(state('combo'), { registry: registry(drawThenDamage), mode: healOnDraw });
    expect(next.log.map((e) => e.kind)).toEqual(['CardPlayedEvent', 'CardMovedEvent', 'CardsDrawnEvent', 'HealEvent', 'DamageDealtEvent']);
  });

  it('stops and drops the rest of the queue once the game has a result', () => {
    const eliminateThenDraw = cardThat('finisher', [
      { kind: 'EliminateSeatEffect', seatId: 'seat-b' },
      { kind: 'DrawCardsEffect', seatId: 'seat-a', count: 1 },
    ]);
    const endsOnElimination = mode({
      checkWinCondition: (s) => (s.seats.some((x) => x.eliminated) ? { endedAt: 1, winningSeatIds: ['seat-a'], losingSeatIds: ['seat-b'] } : null),
    });
    const next = play(state('finisher'), { registry: registry(eliminateThenDraw), mode: endsOnElimination });
    expect(next.result).not.toBeNull();
    expect(next.log.some((e) => e.kind === 'CardsDrawnEvent')).toBe(false);
    expect(next.resolutionQueue).toBeUndefined();
  });

  it('survives a JSON round trip while paused, and resumes identically', () => {
    const ctx = { registry: registry(cardThat('asker', [window, healA])), mode: mode() };
    const paused = play(state('asker'), ctx);
    const copy = JSON.parse(JSON.stringify(paused)) as GameState;
    const pass = { kind: 'PassAction' as const, seatId: 'seat-b', pendingResponseId: 'w1' };
    expect(resolve(copy, pass, ctx).state).toEqual(resolve(paused, pass, ctx).state);
  });

  it('throws, naming the item, when one call resolves more than the step budget', () => {
    // Drawing nothing still logs a draw, so this cycle never ends on its own.
    const drawNone = { kind: 'DrawCardsEffect' as const, seatId: 'seat-a', count: 0 };
    const forever = mode({
      triggers: [{ point: 'after:CardsDrawnEvent', condition: () => true, effect: () => [drawNone] }],
    });
    expect(() => play(state('drawer'), { registry: registry(cardThat('drawer', [drawNone])), mode: forever })).toThrow(
      new RegExp(`Resolution step budget exceeded \\(${MAX_RESOLUTION_STEPS} steps\\) while resolving DrawCardsEffect`)
    );
  });
});

describe('answering a card-effect window', () => {
  it('records the seat and card it answered, from the window’s reason', () => {
    const demand: Effect = {
      kind: 'OpenResponseEffect',
      pendingResponse: {
        id: 'w2', respondingSeatId: 'seat-b', allowedActionKinds: ['RespondAction', 'PassAction'], allowedCardIds: ['answer'],
        reason: {
          kind: 'card-effect', userSeatId: 'seat-a', victimSeatId: 'seat-a',
          card: { as: 'demand', colour: 'black', suit: 'spade', rank: 1, physical: [{ instanceId: 'played', definitionId: 'demand', suit: 'spade', rank: 1 }] },
        },
        context: { effect: { kind: 'MoveCardEffect', cardInstanceId: 'd1', toZoneId: 'seat-a:hand' } },
      },
    };
    const ctx = { registry: registry(cardThat('demand', [demand]), cardThat('answer', [])), mode: mode() };
    const s = state('demand');
    const withAnswer = {
      ...s,
      zones: s.zones.map((z) => (z.id === 'seat-b:hand' ? { ...z, cards: [{ instanceId: 'ans', definitionId: 'answer', suit: 'heart' as const, rank: 2 }] } : z)),
    };
    const answered = resolve(play(withAnswer, ctx), { kind: 'RespondAction', seatId: 'seat-b', pendingResponseId: 'w2', cardInstanceId: 'ans' }, ctx).state;
    expect(answered.log.find((e) => e.kind === 'CardPlayedEvent' && e.seatId === 'seat-b')).toMatchObject({ inResponseTo: { seatId: 'seat-a', cardInstanceId: 'played' } });
    expect(answered.zones.find((z) => z.id === 'seat-a:hand')!.cards).toEqual([]); // the held-back move was cancelled
  });
});
