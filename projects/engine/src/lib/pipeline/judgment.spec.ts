import { advanceToDecision } from './resolve';
import { applyEffect } from './effects';
import { createRng } from '../rng/rng';
import { CardInstance, GameState, Phase, QueueItem } from '../domain/types';
import { ContentRegistry, GameModeDefinition } from '../registry/types';
import { EngineEvent } from './events';

const mode: GameModeDefinition = {
  id: 'stub',
  setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'],
  checkWinCondition: () => null,
  triggers: [],
};

// Task 3 puts fixture delayed Tools here.
const registry: ContentRegistry = { cards: new Map(), generals: new Map() };
const ctx = { registry, mode };

const card = (instanceId: string, definitionId = 'x', suit: CardInstance['suit'] = 'spade', rank = 5): CardInstance => ({ instanceId, definitionId, suit, rank });

interface TableOptions {
  phase?: Phase;
  flags?: Record<string, boolean>;
  queue?: QueueItem[];
  // Cards by zone id, e.g. { drawPile: [...], 'seat-a:judgment': [...] }.
  cards?: Record<string, CardInstance[]>;
}

// Seats a (turn owner) and b at 4 HP, each with a hand, equipment and judgment zone.
function table(o: TableOptions = {}): GameState {
  const seat = (id: string, index: number) => ({
    id, index, kingdom: 'Wei' as const,
    generals: { main: { generalDefinitionId: 'g1', revealed: false }, deputy: { generalDefinitionId: 'g2', revealed: false } },
    combinedHp: 4, maxCombinedHp: 4,
    hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` }, eliminated: false,
  });
  const cardsOf = (id: string) => o.cards?.[id] ?? [];
  return {
    seats: [seat('seat-a', 0), seat('seat-b', 1)],
    players: [],
    turn: { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [], ...(o.flags ? { flags: o.flags } : {}) },
    phase: o.phase ?? 'Play',
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: cardsOf('drawPile') },
      { id: 'discardPile', kind: 'discardPile', cards: cardsOf('discardPile') },
      { id: 'processing', kind: 'processing', cards: [] },
      ...['seat-a', 'seat-b'].flatMap((id) => [
        { id: `${id}:hand`, kind: 'hand' as const, ownerSeatId: id, cards: cardsOf(`${id}:hand`) },
        { id: `${id}:equip`, kind: 'equip' as const, ownerSeatId: id, cards: [] },
        { id: `${id}:judgment`, kind: 'judgment' as const, ownerSeatId: id, cards: cardsOf(`${id}:judgment`) },
      ]),
    ],
    pendingResponse: null,
    ...(o.queue ? { resolutionQueue: o.queue } : {}),
    log: [], rng: createRng(1), result: null, generalSelection: null,
  };
}

// Drains the queue and moves on to the next decision.
const settle = (s: GameState) => advanceToDecision(s, ctx).state;
const idsIn = (s: GameState, zoneId: string) => s.zones.find((z) => z.id === zoneId)!.cards.map((c) => c.instanceId);
const phasesOf = (log: EngineEvent[]) =>
  log.flatMap((e) => (e.kind === 'PhaseChangedEvent' ? [`${e.seatId}:${e.phase}`] : e.kind === 'TurnAdvancedEvent' ? [`turn ${e.turnNumber}`] : []));

describe('turn flags', () => {
  it('SetTurnFlagEffect sets a flag for the rest of the turn', () => {
    expect(applyEffect(table(), { kind: 'SetTurnFlagEffect', flag: 'skipPlay' }).state.turn.flags).toEqual({ skipPlay: true });
  });

  it('a phase flagged to skip is logged as skipped and never entered', () => {
    const next = settle(table({ phase: 'Judgment', flags: { skipDraw: true, skipPlay: true } }));
    expect(next.log.filter((e) => e.kind === 'PhaseSkippedEvent')).toEqual([
      { kind: 'PhaseSkippedEvent', seatId: 'seat-a', phase: 'Draw' },
      { kind: 'PhaseSkippedEvent', seatId: 'seat-a', phase: 'Play' },
    ]);
    expect(phasesOf(next.log)).toEqual(['seat-a:Discard', 'seat-a:End', 'turn 2', 'seat-b:Start', 'seat-b:Judgment', 'seat-b:Draw', 'seat-b:Play']);
    expect(next.turn.flags).toBeUndefined();
  });
});
