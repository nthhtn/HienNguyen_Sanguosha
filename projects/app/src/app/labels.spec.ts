import { actionLabel, eventLabel, generalDisplayName, kingdomDisplayName } from './labels';
import { Action, ContentRegistry, EngineEvent, GameState } from 'engine';

function stateWithZones(): GameState {
  return {
    seats: [],
    players: [],
    turn: { turnNumber: 1, ownerSeatId: 'seat-0', extraTurnStack: [] },
    phase: 'Play',
    zones: [
      {
        id: 'hand-0',
        kind: 'hand',
        ownerSeatId: 'seat-0',
        cards: [{ instanceId: 'card-1', definitionId: 'sha', suit: 'spade', rank: 7 }],
      },
    ],
    pendingResponse: null,
    log: [],
    rng: { seed: 1, counter: 0 },
    result: null,
  };
}

function registryWithSha(): ContentRegistry {
  return {
    cards: new Map([['sha', { id: 'sha', name: 'Sha', category: 'basic', play: () => [] }]]),
    generals: new Map(),
  };
}

describe('generalDisplayName', () => {
  it('title-cases a kebab-case id', () => {
    expect(generalDisplayName('xiahou-dun')).toBe('Xiahou Dun');
  });

  it('renders the hidden sentinel as a human phrase', () => {
    expect(generalDisplayName('hidden')).toBe('a hidden general');
  });
});

describe('kingdomDisplayName', () => {
  it('passes through a real kingdom unchanged', () => {
    expect(kingdomDisplayName('Wei')).toBe('Wei');
  });

  it('renders the hidden sentinel as a human phrase', () => {
    expect(kingdomDisplayName('hidden')).toBe('Hidden');
  });
});

describe('actionLabel', () => {
  it('labels DrawCardsAction with the count', () => {
    const action: Action = { kind: 'DrawCardsAction', seatId: 'seat-0', count: 2 };
    expect(actionLabel(action, stateWithZones(), registryWithSha())).toBe('Draw 2 cards');
  });

  it('labels a targetless PlayCardAction with the card name', () => {
    const action: Action = {
      kind: 'PlayCardAction',
      seatId: 'seat-0',
      cardInstanceId: 'card-1',
      targets: [],
    };
    expect(actionLabel(action, stateWithZones(), registryWithSha())).toBe('Play Sha');
  });

  it('labels a targeted PlayCardAction with the target', () => {
    const action: Action = {
      kind: 'PlayCardAction',
      seatId: 'seat-0',
      cardInstanceId: 'card-1',
      targets: [{ kind: 'seat', seatId: 'seat-1' }],
    };
    expect(actionLabel(action, stateWithZones(), registryWithSha())).toBe('Play Sha targeting seat-1');
  });

  it('labels PassAction and EndPhaseAction', () => {
    expect(
      actionLabel({ kind: 'PassAction', seatId: 'seat-0', pendingResponseId: 'r1' }, stateWithZones(), registryWithSha())
    ).toBe('Pass');
    expect(actionLabel({ kind: 'EndPhaseAction', seatId: 'seat-0' }, stateWithZones(), registryWithSha())).toBe(
      'End phase'
    );
  });
});

describe('eventLabel', () => {
  it('labels DamageDealtEvent', () => {
    const event: EngineEvent = {
      kind: 'DamageDealtEvent',
      damage: { source: null, target: { kind: 'seat', seatId: 'seat-1' }, amount: 2, nature: 'normal' },
    };
    expect(eventLabel(event)).toBe('seat-1 took 2 normal damage');
  });

  it('labels SeatEliminatedEvent', () => {
    expect(eventLabel({ kind: 'SeatEliminatedEvent', seatId: 'seat-2' })).toBe('seat-2 was eliminated');
  });
});
