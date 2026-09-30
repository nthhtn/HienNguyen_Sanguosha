import { actionLabel, cardDefinitionId, cardIdDisplayName, eventLabel, generalDisplayName, kingdomDisplayName } from './labels';
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
    result: null, generalSelection: null,
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

describe('cardIdDisplayName', () => {
  it('title-cases a kebab-case id', () => {
    expect(cardIdDisplayName('green-dragon-blade')).toBe('Green Dragon Blade');
  });

  it('renders the hidden sentinel as a human phrase', () => {
    expect(cardIdDisplayName('hidden')).toBe('a hidden card');
  });
});

describe('cardDefinitionId', () => {
  it("returns a card instance's definitionId when it exists in a zone", () => {
    expect(cardDefinitionId(stateWithZones(), 'card-1')).toBe('sha');
  });

  it('returns undefined when no zone contains the instance', () => {
    expect(cardDefinitionId(stateWithZones(), 'missing')).toBeUndefined();
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

  it('labels ChooseGeneralsAction with both generals and their roles', () => {
    const action: Action = { kind: 'ChooseGeneralsAction', seatId: 'seat-0', mainId: 'cao-cao', deputyId: 'xu-chu' };
    expect(actionLabel(action, stateWithZones(), registryWithSha())).toBe('Choose Cao Cao (main) and Xu Chu (deputy)');
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

  it('labels GeneralsChosenEvent without naming any general', () => {
    expect(eventLabel({ kind: 'GeneralsChosenEvent', seatId: 'seat-1' })).toBe('seat-1 chose their generals');
  });
});
