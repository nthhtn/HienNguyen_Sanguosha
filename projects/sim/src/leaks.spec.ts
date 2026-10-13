import { createRng, redactStateForSeat } from 'engine';
import type { CardInstance, EngineEvent, GameState } from 'engine';
import { findEventLeaks, findReshuffleLeaks, findViewLeaks } from './leaks';

const card = (instanceId: string, definitionId: string): CardInstance => ({ instanceId, definitionId, suit: 'spade', rank: 1 });

// Two seats. seat-0 shows its main General (g-a) and hides its deputy (g-b);
// seat-1 hides both (g-c, g-d). Opaque card ids, as the engine deals them.
function table(overrides: Partial<GameState> = {}): GameState {
  return {
    seats: [
      { id: 'seat-0', generals: { main: { generalDefinitionId: 'g-a', revealed: true }, deputy: { generalDefinitionId: 'g-b', revealed: false } } },
      { id: 'seat-1', generals: { main: { generalDefinitionId: 'g-c', revealed: false }, deputy: { generalDefinitionId: 'g-d', revealed: false } } },
    ],
    zones: [
      { id: 'draw', kind: 'drawPile', cards: [card('card-0', 'peach'), card('card-1', 'wine')] },
      { id: 'discard', kind: 'discardPile', cards: [card('card-2', 'sha')] },
      { id: 'seat-0:hand', kind: 'hand', ownerSeatId: 'seat-0', cards: [card('card-3', 'shan')] },
      { id: 'seat-1:hand', kind: 'hand', ownerSeatId: 'seat-1', cards: [card('card-4', 'duel')] },
    ],
    pendingResponse: null,
    generalSelection: null,
    log: [],
    rng: createRng(1),
    ...overrides,
  } as unknown as GameState;
}

// What the server will send: the redacted state without rng and log.
function sentView(state: GameState, seatId: string): object {
  const { rng, log, ...view } = redactStateForSeat(state, seatId);
  return view;
}

describe('findViewLeaks', () => {
  it('reports nothing for a properly redacted view, own face-down General included', () => {
    const state = table();
    expect(findViewLeaks(state, sentView(state, 'seat-0'), 'seat-0')).toEqual([]);
  });

  it('reports a view that still carries the RNG state or the log', () => {
    const state = table();
    const leaks = findViewLeaks(state, redactStateForSeat(state, 'seat-0'), 'seat-0');
    expect(leaks).toEqual(expect.arrayContaining([expect.stringContaining('RNG'), expect.stringContaining('log')]));
  });

  it("reports another seat's hidden card shown face up", () => {
    const state = table();
    const leaky = { ...sentView(state, 'seat-0'), zones: state.zones };
    expect(findViewLeaks(state, leaky, 'seat-0')).toEqual(
      expect.arrayContaining([expect.stringContaining('card-4 as duel'), expect.stringContaining('card-0 as peach')])
    );
  });

  it('reports a masked card whose id still names the card', () => {
    const state = table({
      zones: [{ id: 'seat-1:hand', kind: 'hand', ownerSeatId: 'seat-1', cards: [card('duel-spade-1-7', 'duel')] }],
    } as Partial<GameState>);
    expect(findViewLeaks(state, sentView(state, 'seat-0'), 'seat-0')).toEqual([expect.stringContaining('names its card duel')]);
  });

  it('reports a card masked by name only, whose rank is still shown', () => {
    const state = table();
    const view = JSON.parse(JSON.stringify(sentView(state, 'seat-0'))) as GameState;
    const hidden = view.zones.find((z) => z.id === 'seat-1:hand')!.cards[0];
    expect(hidden.definitionId).toBe('hidden');
    (hidden as { rank: number }).rank = 1;
    expect(findViewLeaks(state, view, 'seat-0')).toEqual([expect.stringContaining("shows hidden card card-4's rank 1")]);
  });

  it("reports another seat's face-down General named anywhere in the view", () => {
    const state = table();
    const leaky = { ...sentView(state, 'seat-0'), seats: state.seats };
    expect(findViewLeaks(state, leaky, 'seat-0')).toEqual(
      expect.arrayContaining([expect.stringContaining('g-c'), expect.stringContaining('g-d')])
    );
  });

  it('does not report draw-pile cards the viewer is arranging', () => {
    const state = table({
      pendingArrangement: { id: 'arr', seatId: 'seat-0', cardInstanceIds: ['card-0'], reason: { kind: 'decline' } },
    } as unknown as Partial<GameState>);
    const view = sentView(state, 'seat-0') as GameState;
    expect(view.zones[0].cards[0].definitionId).toBe('peach');
    expect(findViewLeaks(state, view, 'seat-0')).toEqual([]);
  });
});

describe('findEventLeaks', () => {
  it("reports a card face carried into a hand, not into the discard pile", () => {
    const state = table();
    const events: EngineEvent[] = [
      { kind: 'CardMovedEvent', cardInstanceId: 'card-4', fromZoneId: 'draw', toZoneId: 'seat-1:hand', card: card('card-4', 'duel') },
      { kind: 'CardMovedEvent', cardInstanceId: 'card-2', fromZoneId: 'seat-0:hand', toZoneId: 'discard', card: card('card-2', 'sha') },
    ];
    expect(findEventLeaks(state, events)).toEqual([expect.stringContaining('seat-1:hand')]);
  });

  it("reports a face-down General named in the log, any seat's", () => {
    const state = table();
    const events: EngineEvent[] = [
      { kind: 'FormChosenEvent', seatId: 'seat-0', generalId: 'g-b', skillId: 'x' },
      { kind: 'FormChosenEvent', seatId: 'seat-0', generalId: 'g-a', skillId: 'x' },
    ];
    expect(findEventLeaks(state, events)).toEqual([expect.stringContaining('g-b')]);
  });
});

describe('findReshuffleLeaks', () => {
  const prev = table();
  const reshuffledLog: EngineEvent[] = [{ kind: 'DiscardPileReshuffledEvent', cardCount: 1 }];

  it('reports a reshuffled card that kept its id', () => {
    const next = table({
      zones: [{ id: 'draw', kind: 'drawPile', cards: [card('card-2', 'sha')] }, { id: 'discard', kind: 'discardPile', cards: [] }],
      log: reshuffledLog,
    } as Partial<GameState>);
    expect(findReshuffleLeaks(prev, next)).toEqual([expect.stringContaining('card-2')]);
  });

  it('reports a reshuffled card drawn under its old id', () => {
    const next = table({
      zones: [{ id: 'draw', kind: 'drawPile', cards: [] }, { id: 'discard', kind: 'discardPile', cards: [] }],
      log: [...reshuffledLog, { kind: 'CardsDrawnEvent', seatId: 'seat-0', cardInstanceIds: ['card-2'] }],
    } as Partial<GameState>);
    expect(findReshuffleLeaks(prev, next)).toEqual([expect.stringContaining('card-2')]);
  });

  it('reports nothing when reshuffled cards were renamed', () => {
    const next = table({
      zones: [{ id: 'draw', kind: 'drawPile', cards: [card('r9-0', 'sha')] }, { id: 'discard', kind: 'discardPile', cards: [] }],
      log: reshuffledLog,
    } as Partial<GameState>);
    expect(findReshuffleLeaks(prev, next)).toEqual([]);
  });
});
