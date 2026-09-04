import { gatherTriggeredSkills } from './triggers';
import { ContentRegistry, GameModeDefinition, GeneralDefinition } from '../registry/types';
import { GameState } from '../domain/types';
import { createRng } from '../rng/rng';

function stateWithGenerals(mainId: string, deputyId: string): GameState {
  return {
    seats: [
      {
        id: 'seat-a',
        index: 0,
        kingdom: 'Wei',
        generals: {
          main: { generalDefinitionId: mainId, revealed: false },
          deputy: { generalDefinitionId: deputyId, revealed: false },
        },
        combinedHp: 7,
        maxCombinedHp: 7,
        hand: { zoneId: 'seat-a:hand' },
        equipped: { zoneId: 'seat-a:equip' },
        eliminated: false,
      },
    ],
    players: [{ id: 'p1', seatId: 'seat-a', kind: 'bot' }],
    turn: { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [] },
    zones: [],
    pendingResponse: null,
    log: [],
    rng: createRng(1),
    result: null,
  };
}

function stubMode(extraTriggers: GameModeDefinition['triggers'] = []): GameModeDefinition {
  return {
    id: 'stub',
    setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'],
    checkWinCondition: () => null,
    triggers: extraTriggers,
  };
}

describe('gatherTriggeredSkills', () => {
  it('collects a matching trigger from a seat general whose condition passes', () => {
    const general: GeneralDefinition = {
      id: 'general-main',
      kingdom: 'Wei',
      maxHp: 4,
      skills: [
        {
          id: 'skill-1',
          activation: 'auto',
          triggers: [{ point: 'before:DamageEffect', condition: () => true, effect: () => [] }],
        },
      ],
    };
    const registry: ContentRegistry = { cards: new Map(), generals: new Map([['general-main', general]]) };
    const state = stateWithGenerals('general-main', 'general-deputy');
    const found = gatherTriggeredSkills(state, registry, stubMode(), 'before:DamageEffect', {});
    expect(found).toHaveLength(1);
  });

  it('excludes a trigger whose condition returns false', () => {
    const general: GeneralDefinition = {
      id: 'general-main',
      kingdom: 'Wei',
      maxHp: 4,
      skills: [
        {
          id: 'skill-1',
          activation: 'auto',
          triggers: [{ point: 'after:DamageDealtEvent', condition: () => false, effect: () => [] }],
        },
      ],
    };
    const registry: ContentRegistry = { cards: new Map(), generals: new Map([['general-main', general]]) };
    const state = stateWithGenerals('general-main', 'general-deputy');
    const found = gatherTriggeredSkills(state, registry, stubMode(), 'after:DamageDealtEvent', {});
    expect(found).toHaveLength(0);
  });

  it('includes mode-level triggers alongside general skill triggers', () => {
    const state = stateWithGenerals('unregistered-1', 'unregistered-2');
    const modeTrigger = { point: 'before:DamageEffect' as const, condition: () => true, effect: () => [] };
    const found = gatherTriggeredSkills(
      state,
      { cards: new Map(), generals: new Map() },
      stubMode([modeTrigger]),
      'before:DamageEffect',
      {}
    );
    expect(found).toEqual([modeTrigger]);
  });
});
