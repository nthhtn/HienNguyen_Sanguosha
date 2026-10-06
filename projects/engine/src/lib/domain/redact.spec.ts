import { redactStateForSeat } from './redact';
import { createSeat, createPlayer } from './factories';
import { GameState, CardZone } from './types';

function makeZones(): CardZone[] {
  return [
    {
      id: 'hand-a',
      kind: 'hand',
      ownerSeatId: 'seat-a',
      cards: [{ instanceId: 'card-1', definitionId: 'sha', suit: 'spade', rank: 7 }],
    },
    {
      id: 'hand-b',
      kind: 'hand',
      ownerSeatId: 'seat-b',
      cards: [
        { instanceId: 'card-2', definitionId: 'shan', suit: 'heart', rank: 3 },
        { instanceId: 'card-3', definitionId: 'peach', suit: 'club', rank: 9 },
      ],
    },
    {
      id: 'draw-pile',
      kind: 'drawPile',
      cards: [{ instanceId: 'card-4', definitionId: 'duel', suit: 'diamond', rank: 5 }],
    },
    {
      id: 'discard-pile',
      kind: 'discardPile',
      cards: [{ instanceId: 'card-5', definitionId: 'wuxie', suit: 'spade', rank: 2 }],
    },
    {
      id: 'equip-a',
      kind: 'equip',
      ownerSeatId: 'seat-a',
      cards: [{ instanceId: 'card-6', definitionId: 'silver-lion', suit: 'club', rank: 11 }],
    },
    { id: 'judgment-b', kind: 'judgment', ownerSeatId: 'seat-b', cards: [] },
  ];
}

function makeState(): GameState {
  const maxHp = () => 4;
  const seatA = createSeat('seat-a', 0, 'Wei', 'general-x', 'general-y', maxHp);
  const seatB = createSeat('seat-b', 1, 'Shu', 'general-z', 'general-w', maxHp);
  return {
    seats: [seatA, seatB],
    players: [createPlayer('p1', 'seat-a', 'human'), createPlayer('p2', 'seat-b', 'bot')],
    turn: { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [] },
    phase: 'Play',
    zones: makeZones(),
    pendingResponse: null,
    log: [],
    rng: { seed: 1, counter: 0 },
    result: null, generalSelection: null,
  };
}

describe('redactStateForSeat', () => {
  it('hides unrevealed generals from other seats but keeps them visible to the owner', () => {
    const state = makeState();
    const viewFromA = redactStateForSeat(state, 'seat-a');

    const ownSeat = viewFromA.seats.find((s) => s.id === 'seat-a')!;
    expect(ownSeat.generals!.main.generalDefinitionId).toBe('general-x');

    const otherSeat = viewFromA.seats.find((s) => s.id === 'seat-b')!;
    expect(otherSeat.generals!.main.generalDefinitionId).toBe('hidden');
    expect(otherSeat.generals!.deputy.generalDefinitionId).toBe('hidden');
  });

  it('reveals a general to everyone once revealed is true', () => {
    const state = makeState();
    state.seats[1].generals!.main.revealed = true;
    const viewFromA = redactStateForSeat(state, 'seat-a');

    const otherSeat = viewFromA.seats.find((s) => s.id === 'seat-b')!;
    expect(otherSeat.generals!.main.generalDefinitionId).toBe('general-z');
    expect(otherSeat.generals!.deputy.generalDefinitionId).toBe('hidden');
  });

  it("masks another seat's hand contents but preserves card count and instance ids", () => {
    const state = makeState();
    const viewFromA = redactStateForSeat(state, 'seat-a');

    const handB = viewFromA.zones.find((z) => z.id === 'hand-b')!;
    expect(handB.cards).toHaveLength(2);
    expect(handB.cards.map((c) => c.instanceId)).toEqual(['card-2', 'card-3']);
    expect(handB.cards.every((c) => c.definitionId === 'hidden')).toBe(true);
    expect(handB.cards.every((c) => c.suit === 'spade' && c.rank === 0)).toBe(true);
  });

  it('never masks the viewer\'s own hand', () => {
    const state = makeState();
    const viewFromA = redactStateForSeat(state, 'seat-a');

    const handA = viewFromA.zones.find((z) => z.id === 'hand-a')!;
    expect(handA.cards[0].definitionId).toBe('sha');
  });

  it('masks the draw pile for every viewer, including seat-a', () => {
    const state = makeState();

    for (const viewerSeatId of ['seat-a', 'seat-b']) {
      const view = redactStateForSeat(state, viewerSeatId);
      const drawPile = view.zones.find((z) => z.id === 'draw-pile')!;
      expect(drawPile.cards[0].definitionId).toBe('hidden');
    }
  });

  it('leaves discard pile, equip zones, and judgment zones untouched', () => {
    const state = makeState();
    const viewFromA = redactStateForSeat(state, 'seat-a');

    expect(viewFromA.zones.find((z) => z.id === 'discard-pile')!.cards[0].definitionId).toBe('wuxie');
    expect(viewFromA.zones.find((z) => z.id === 'equip-a')!.cards[0].definitionId).toBe('silver-lion');
  });

  it("masks another seat's kingdom while both generals are hidden", () => {
    const state = makeState();
    const viewFromA = redactStateForSeat(state, 'seat-a');

    expect(viewFromA.seats.find((s) => s.id === 'seat-b')!.kingdom).toBe('hidden');
  });

  it('reveals a kingdom once either of that seat\'s generals is revealed', () => {
    const state = makeState();
    state.seats[1].generals!.deputy.revealed = true;
    const viewFromA = redactStateForSeat(state, 'seat-a');

    expect(viewFromA.seats.find((s) => s.id === 'seat-b')!.kingdom).toBe('Shu');
  });

  it("never masks the viewer's own kingdom", () => {
    const state = makeState();
    const viewFromA = redactStateForSeat(state, 'seat-a');

    expect(viewFromA.seats.find((s) => s.id === 'seat-a')!.kingdom).toBe('Wei');
  });
});

describe('redactStateForSeat with seats that have not chosen generals', () => {
  it('passes an unchosen seat through without masking', () => {
    const state = makeState();
    state.seats[1] = { ...state.seats[1], generals: null, kingdom: 'hidden' };
    const redacted = redactStateForSeat(state, 'seat-a');
    expect(redacted.seats[1].generals).toBeNull();
    expect(redacted.seats[1].kingdom).toBe('hidden');
  });
});

describe('redactStateForSeat: hidden cards in the queue and pending decisions (Review Focus 3)', () => {
  const secret = { instanceId: 'b-secret', definitionId: 'peach', suit: 'heart' as const, rank: 3 };
  const used = { as: 'mystery', colour: 'red' as const, physical: [secret] };
  const leaky: GameState = {
    seats: [], players: [], turn: { turnNumber: 1, ownerSeatId: 'a', extraTurnStack: [] }, phase: 'Play',
    zones: [
      { id: 'a:hand', kind: 'hand', ownerSeatId: 'a', cards: [] },
      { id: 'b:hand', kind: 'hand', ownerSeatId: 'b', cards: [secret] },
    ],
    pendingResponse: null, log: [], rng: { seed: 1, counter: 0 }, result: null, generalSelection: null,
    resolutionQueue: [{ kind: 'ToolRuleEffect', tool: used, userSeatId: 'b', target: { kind: 'seat', seatId: 'b' } }],
    pendingChoice: {
      id: 'c', seatId: 'a', verb: 'take', reason: { kind: 'choice', card: used, userSeatId: 'b' },
      options: [{ id: 'x', shows: { kind: 'card', card: secret }, effects: [] }],
    },
  };

  it('masks another seat’s hand card wherever the queue or a pending choice mentions it', () => {
    const forA = redactStateForSeat(leaky, 'a');
    expect(JSON.stringify(forA.resolutionQueue)).not.toContain('"definitionId":"peach"');
    expect(forA.pendingChoice!.options[0].shows).toEqual({ kind: 'card', card: { instanceId: 'b-secret', definitionId: 'hidden', suit: 'spade', rank: 0 } });
  });

  it('leaves the card visible to its owner', () => {
    const forB = redactStateForSeat(leaky, 'b');
    expect(forB.resolutionQueue).toEqual(leaky.resolutionQueue);
    expect(forB.pendingChoice).toEqual(leaky.pendingChoice);
  });
});
