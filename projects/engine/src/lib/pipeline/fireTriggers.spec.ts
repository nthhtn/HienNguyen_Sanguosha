import { advanceToDecision } from './resolve';
import { Effect, applyEffect } from './effects';
import { createRng } from '../rng/rng';
import { CardInstance, GameState, GeneralOwner } from '../domain/types';
import { CardsDrawnEvent } from './events';
import { CardDefinition, ContentRegistry, GameModeDefinition, SkillDefinition } from '../registry/types';

// Seats a and b each hold 'echo', whose trigger after any draw by seat c makes
// its owner draw 1; seat a also holds 'quiet', with no trigger at that point.
const byC = (subject: unknown) => (subject as { seatId?: string }).seatId === 'c';
const echo: SkillDefinition = {
  id: 'echo',
  triggers: [{ point: 'after:CardsDrawnEvent', condition: (_s, subject) => byC(subject), effect: (_s, _x, owner) => [{ kind: 'DrawCardsEffect', seatId: (owner as GeneralOwner).seatId, count: 1 }] }],
};
const quiet: SkillDefinition = { id: 'quiet', triggers: [{ point: 'after:DamageDealtEvent', condition: () => true, effect: () => [] }] };
const filler: CardDefinition = { id: 'filler', name: 'Filler', category: 'basic', legalPlayTargets: () => [], play: () => [] };
const registry: ContentRegistry = {
  cards: new Map([[filler.id, filler]]),
  generals: new Map([
    ['plain', { id: 'plain', kingdom: 'Wei', maxHp: 4, skills: [] }],
    ['echoer', { id: 'echoer', kingdom: 'Wei', maxHp: 4, skills: [echo, quiet] }],
  ]),
};
const mode: GameModeDefinition = { id: 'stub', setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'], checkWinCondition: () => null, triggers: [] };
const ctx = { registry, mode };

const card = (instanceId: string): CardInstance => ({ instanceId, definitionId: 'filler', suit: 'club', rank: 5 });
const cDrew: CardsDrawnEvent = { kind: 'CardsDrawnEvent', seatId: 'c', cardInstanceIds: ['x'] };
const fire = (skillId: string): Effect => ({ kind: 'FireSkillTriggersEffect', owner: { kind: 'general', seatId: 'a', slot: 'deputy', skillId }, point: 'after:CardsDrawnEvent', subject: cDrew });

function table(queue: Effect[]): GameState {
  const seat = (id: string, index: number, deputy: string) => ({
    id, index, kingdom: 'Wei' as const, combinedHp: 4, maxCombinedHp: 4, eliminated: false,
    generals: { main: { generalDefinitionId: 'plain', revealed: true }, deputy: { generalDefinitionId: deputy, revealed: true } },
    hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` },
  });
  return {
    seats: [seat('a', 0, 'echoer'), seat('b', 1, 'echoer'), seat('c', 2, 'plain')], players: [], turn: { turnNumber: 1, ownerSeatId: 'a', extraTurnStack: [] }, phase: 'Play',
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: [card('d1'), card('d2'), card('d3')] },
      { id: 'discardPile', kind: 'discardPile', cards: [] },
      ...['a', 'b', 'c'].flatMap((id) => [
        { id: `${id}:hand`, kind: 'hand' as const, ownerSeatId: id, cards: [] },
        { id: `${id}:equip`, kind: 'equip' as const, ownerSeatId: id, cards: [] },
      ]),
    ],
    pendingResponse: null, resolutionQueue: queue,
    log: [], rng: createRng(1), result: null, generalSelection: null,
  };
}

describe('FireSkillTriggersEffect (S10)', () => {
  it('queues only the named owner’s triggers for the subject event', () => {
    const s = advanceToDecision(table([fire('echo')]), ctx).state;
    expect(s.log).toEqual([{ kind: 'CardsDrawnEvent', seatId: 'a', cardInstanceIds: ['d1'] }]);
  });

  it('does nothing when the owner holds no trigger at that point', () => {
    const s = advanceToDecision(table([fire('quiet')]), ctx).state;
    expect(s.log).toEqual([]);
    expect(s.resolutionQueue ?? []).toEqual([]);
  });

  it('applyEffect refuses it: it needs the registry', () => {
    expect(() => applyEffect(table([]), fire('echo'))).toThrow('needs the registry');
  });
});
