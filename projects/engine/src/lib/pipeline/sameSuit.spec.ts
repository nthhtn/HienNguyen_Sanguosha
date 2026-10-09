import { resolve } from './resolve';
import { getLegalActions } from '../rules/legality';
import { CardDefinition, ContentRegistry, GameModeDefinition, SkillDefinition } from '../registry/types';
import { CardInstance, GameState } from '../domain/types';

const mode: GameModeDefinition = { id: 'stub', setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'], checkWinCondition: () => null, triggers: [] };
const rain: CardDefinition = { id: 'rain', name: 'Rain', category: 'tool', legalPlayTargets: () => [[]], play: () => [] };
const pairs: SkillDefinition = { id: 'pairs', conversions: [{ id: 'pairs', as: 'rain', cards: 2, sameSuit: true, when: 'play' }] };
const registry: ContentRegistry = { cards: new Map([['rain', rain]]), generals: new Map([['g', { id: 'g', kingdom: 'Qun', maxHp: 4, skills: [pairs] }]]) };
const ctx = { registry, mode };
const card = (instanceId: string, suit: CardInstance['suit']): CardInstance => ({ instanceId, definitionId: 'x', suit, rank: 2 });

const table = (hand: CardInstance[]): GameState => ({
  seats: [{ id: 'a', index: 0, kingdom: 'Qun', eliminated: false, combinedHp: 4, maxCombinedHp: 4, generals: { main: { generalDefinitionId: 'g', revealed: true }, deputy: { generalDefinitionId: 'g', revealed: true } }, hand: { zoneId: 'a:hand' }, equipped: { zoneId: 'a:equip' }, judgment: { zoneId: 'a:judgment' } }],
  players: [], turn: { turnNumber: 1, ownerSeatId: 'a', extraTurnStack: [] }, phase: 'Play',
  zones: [{ id: 'discardPile', kind: 'discardPile', cards: [] }, { id: 'a:hand', kind: 'hand', ownerSeatId: 'a', cards: hand }, { id: 'a:equip', kind: 'equip', ownerSeatId: 'a', cards: [] }],
  pendingResponse: null, log: [], rng: { seed: 1, counter: 0 }, result: null, generalSelection: null,
});

describe('a same-suit pair conversion', () => {
  it('is offered only with 2 cards of one suit; its selection rejects mixed suits', () => {
    expect(getLegalActions(table([card('h1', 'heart'), card('s1', 'spade')]), 'a', registry).some((a) => a.kind === 'UseConversionAction')).toBe(false);
    const s = table([card('h1', 'heart'), card('s1', 'spade'), card('h2', 'heart'), card('s2', 'spade'), card('c1', 'club')]);
    const action = getLegalActions(s, 'a', registry).find((a) => a.kind === 'UseConversionAction')!;
    const selecting = resolve(s, action, ctx).state;
    expect(selecting.pendingSelection?.sameSuit).toBe(true);
    expect(selecting.pendingSelection?.eligibleIds).toEqual(['h1', 's1', 'h2', 's2']); // the lone club can't pair
    expect(() => resolve(selecting, { kind: 'SelectAction', seatId: 'a', selectionId: selecting.pendingSelection!.id, ids: ['h1', 's1'] }, ctx)).toThrow('same suit');
    expect(() => resolve(selecting, { kind: 'SelectAction', seatId: 'a', selectionId: selecting.pendingSelection!.id, ids: ['h1', 'h2'] }, ctx)).not.toThrow();
  });
});
