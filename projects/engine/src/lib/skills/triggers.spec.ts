import { gatherTriggeredSkills } from './triggers';
import { ContentRegistry, GameModeDefinition, GeneralDefinition } from '../registry/types';
import { GameState, Seat } from '../domain/types';
import { createRng } from '../rng/rng';

function seat(id: string, index: number, mainId: string, deputyId: string, eliminated = false): Seat {
  return {
    id,
    index,
    kingdom: 'Wei',
    generals: {
      main: { generalDefinitionId: mainId, revealed: false },
      deputy: { generalDefinitionId: deputyId, revealed: false },
    },
    combinedHp: 7,
    maxCombinedHp: 7,
    hand: { zoneId: `${id}:hand` },
    equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` },
    eliminated,
  };
}

function stateWithSeats(seats: Seat[]): GameState {
  return {
    seats,
    players: seats.map((s) => ({ id: `p-${s.id}`, seatId: s.id, kind: 'bot' as const, name: s.id })),
    turn: { turnNumber: 1, ownerSeatId: seats[0].id, extraTurnStack: [] },
    phase: 'Play',
    zones: [],
    pendingResponse: null,
    log: [],
    rng: createRng(1),
    result: null, generalSelection: null,
  };
}

function stateWithGenerals(mainId: string, deputyId: string): GameState {
  return stateWithSeats([seat('seat-a', 0, mainId, deputyId)]);
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
          triggers: [{ point: 'after:DamageDealtEvent', condition: () => false, effect: () => [] }],
        },
      ],
    };
    const registry: ContentRegistry = { cards: new Map(), generals: new Map([['general-main', general]]) };
    const state = stateWithGenerals('general-main', 'general-deputy');
    const found = gatherTriggeredSkills(state, registry, stubMode(), 'after:DamageDealtEvent', {});
    expect(found).toHaveLength(0);
  });

  it('includes mode-level triggers alongside general skill triggers, with no owner context', () => {
    const state = stateWithGenerals('unregistered-1', 'unregistered-2');
    const modeTrigger = { point: 'before:DamageEffect' as const, condition: () => true, effect: () => [] };
    const found = gatherTriggeredSkills(
      state,
      { cards: new Map(), generals: new Map() },
      stubMode([modeTrigger]),
      'before:DamageEffect',
      {}
    );
    expect(found).toEqual([{ trigger: modeTrigger }]);
    expect(found[0].owner).toBeUndefined();
  });

  it('passes the owning seat id and slot to a general trigger, once per holder', () => {
    // The same general is deliberately held by two different seats (seat-a as
    // main, seat-c as deputy) — each holder must be gathered exactly once, with
    // its own owner context.
    const seenOwners: unknown[] = [];
    const general: GeneralDefinition = {
      id: 'shared-general',
      kingdom: 'Wei',
      maxHp: 4,
      skills: [
        {
          id: 'skill-1',
          triggers: [
            {
              point: 'before:DamageEffect',
              condition: (_state, _subject, owner) => {
                seenOwners.push(owner);
                return true;
              },
              effect: () => [],
            },
          ],
        },
      ],
    };
    const registry: ContentRegistry = { cards: new Map(), generals: new Map([['shared-general', general]]) };
    const state = stateWithSeats([
      seat('seat-a', 0, 'shared-general', 'other'),
      seat('seat-b', 1, 'other', 'other'),
      seat('seat-c', 2, 'other', 'shared-general'),
    ]);

    const found = gatherTriggeredSkills(state, registry, stubMode(), 'before:DamageEffect', {});

    expect(found).toHaveLength(2);
    expect(found.map((f) => f.owner)).toEqual([
      { kind: 'general', seatId: 'seat-a', slot: 'main', skillId: 'skill-1' },
      { kind: 'general', seatId: 'seat-c', slot: 'deputy', skillId: 'skill-1' },
    ]);
    expect(seenOwners).toEqual([
      { kind: 'general', seatId: 'seat-a', slot: 'main', skillId: 'skill-1' },
      { kind: 'general', seatId: 'seat-c', slot: 'deputy', skillId: 'skill-1' },
    ]);
  });

  it('does not gather a trigger for a general held by an eliminated seat', () => {
    const general: GeneralDefinition = {
      id: 'general-main',
      kingdom: 'Wei',
      maxHp: 4,
      skills: [
        {
          id: 'skill-1',
          triggers: [{ point: 'before:DamageEffect', condition: () => true, effect: () => [] }],
        },
      ],
    };
    const registry: ContentRegistry = { cards: new Map(), generals: new Map([['general-main', general]]) };
    const state = stateWithSeats([
      seat('seat-a', 0, 'general-main', 'other', true), // eliminated
      seat('seat-b', 1, 'general-main', 'other'),
    ]);

    const found = gatherTriggeredSkills(state, registry, stubMode(), 'before:DamageEffect', {});

    expect(found).toHaveLength(1);
    expect(found[0].owner).toEqual({ kind: 'general', seatId: 'seat-b', slot: 'main', skillId: 'skill-1' });
  });
});

describe('gatherTriggeredSkills with a seat that has not chosen generals', () => {
  it('skips the seat instead of throwing', () => {
    const skill: GeneralDefinition = {
      id: 'g1', kingdom: 'Wei', maxHp: 4,
      skills: [{ id: 's', triggers: [{ point: 'after:X', condition: () => true, effect: () => [] }] }],
    };
    const registry: ContentRegistry = { cards: new Map(), generals: new Map([['g1', skill]]) };
    const mode: GameModeDefinition = { id: 'm', setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'], checkWinCondition: () => null, triggers: [] };
    const state = stateWithSeats([{ ...seat('seat-a', 0, 'g1', 'g1'), generals: null }]);
    expect(gatherTriggeredSkills(state, registry, mode, 'after:X', {})).toEqual([]);
  });
});

describe('gatherTriggeredSkills after a seat is eliminated', () => {
  const afterDeathSkill = { id: 'last-words', afterDeath: true as const, triggers: [{ point: 'after:SeatEliminatedEvent' as const, condition: () => true, effect: () => [] }] };
  const registry: ContentRegistry = {
    cards: new Map(),
    generals: new Map<string, GeneralDefinition>([
      ['printed', { id: 'printed', kingdom: 'Wei', maxHp: 4, skills: [] }],
      ['spare', { id: 'spare', kingdom: 'Wei', maxHp: 4, skills: [afterDeathSkill] }],
    ]),
  };
  const gather = (extra: Partial<Seat>) => {
    const state = stateWithSeats([{ ...seat('seat-a', 0, 'printed', 'printed', true), ...extra }]);
    return gatherTriggeredSkills(state, registry, stubMode(), 'after:SeatEliminatedEvent', { seatId: 'seat-a' }).map((f) => f.owner);
  };

  it('gathers an afterDeath skill held as a chosen Form', () => {
    expect(gather({ forms: { slot: 'deputy', held: ['spare'], chosen: { generalId: 'spare', skillId: 'last-words' } } })).toEqual([
      { kind: 'general', seatId: 'seat-a', slot: 'deputy', skillId: 'last-words' },
    ]);
  });

  it('gathers an afterDeath skill gained for good', () => {
    const gained = gather({ gainedSkills: [{ slot: 'main', skillId: 'last-words' }] });
    // `findSkill` finds it through the registry's generals.
    expect(gained).toEqual([{ kind: 'general', seatId: 'seat-a', slot: 'main', skillId: 'last-words' }]);
  });
});
