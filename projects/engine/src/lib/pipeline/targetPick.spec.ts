import { advanceToDecision, resolve } from './resolve';
import { getLegalActions } from '../rules/legality';
import { CardDefinition, ContentRegistry, GameModeDefinition, SkillDefinition } from '../registry/types';
import { Action } from './actions';
import { CardInstance, GameState } from '../domain/types';

const mode: GameModeDefinition = { id: 'stub', setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'], checkWinCondition: () => null, triggers: [] };
// 'volley' heals each target 1; it may take 1 to 3 of the other seats.
const volley: CardDefinition = {
  id: 'volley', name: 'Volley', category: 'basic',
  legalPlayTargets: (state, ctx) => state.seats.filter((s) => s.id !== ctx.seatId).map((s) => [{ kind: 'seat' as const, seatId: s.id }]),
  targetPick: (state, ctx) => ({ eligibleIds: state.seats.filter((s) => s.id !== ctx.seatId).map((s) => s.id), min: 1, max: ctx.via ? 2 : 3 }),
  play: (_s, ctx) => ctx.targets.map((t) => ({ kind: 'HealEffect' as const, target: t, amount: 1 })),
};
const plain: CardDefinition = { id: 'plain', name: 'Plain', category: 'basic', play: () => [] };
const asVolley: SkillDefinition = { id: 'as-volley', conversions: [{ id: 'as-volley', as: 'volley', cards: 1, when: 'play' }] };
const registry: ContentRegistry = {
  cards: new Map([['volley', volley], ['plain', plain]]),
  generals: new Map([['g', { id: 'g', kingdom: 'Wei', maxHp: 4, skills: [asVolley] }]]),
};
const ctx = { registry, mode };
const card = (instanceId: string, definitionId: string): CardInstance => ({ instanceId, definitionId, suit: 'spade', rank: 3 });

function table(): GameState {
  const ids = ['a', 'b', 'c', 'd', 'e'];
  return {
    seats: ids.map((id, index) => ({
      id, index, kingdom: 'Wei' as const, eliminated: false, combinedHp: 2, maxCombinedHp: 4,
      generals: { main: { generalDefinitionId: 'g', revealed: true }, deputy: { generalDefinitionId: 'g', revealed: true } },
      hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` },
    })),
    players: [], turn: { turnNumber: 1, ownerSeatId: 'a', extraTurnStack: [] }, phase: 'Play',
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: [] }, { id: 'discardPile', kind: 'discardPile', cards: [] }, { id: 'processing', kind: 'processing', cards: [] },
      ...ids.flatMap((id) => [
        { id: `${id}:hand`, kind: 'hand' as const, ownerSeatId: id, cards: id === 'a' ? [card('v', 'volley'), card('p', 'plain')] : [] },
        { id: `${id}:equip`, kind: 'equip' as const, ownerSeatId: id, cards: [] },
        { id: `${id}:judgment`, kind: 'judgment' as const, ownerSeatId: id, cards: [] },
      ]),
    ],
    pendingResponse: null, log: [], rng: { seed: 1, counter: 0 }, result: null, generalSelection: null,
  };
}
const seats = (...ids: string[]) => ids.map((seatId) => ({ kind: 'seat' as const, seatId }));
const play = (s: GameState, ...targets: string[]) => resolve(s, { kind: 'PlayCardAction', seatId: 'a', cardInstanceId: 'v', targets: seats(...targets) }, ctx).state;

describe('a card that may take several targets', () => {
  it('is offered once, as a template carrying its pick', () => {
    const plays = getLegalActions(table(), 'a', registry).filter((a) => a.kind === 'PlayCardAction' && a.cardInstanceId === 'v');
    expect(plays).toEqual([{ kind: 'PlayCardAction', seatId: 'a', cardInstanceId: 'v', targets: [], pickTargets: { eligibleIds: ['b', 'c', 'd', 'e'], min: 1, max: 3 } }]);
  });

  it('plays at the targets given, when they are listed, distinct and within the count', () => {
    const s = play(table(), 'b', 'd', 'e');
    expect(s.seats.filter((x) => x.combinedHp === 3).map((x) => x.id)).toEqual(['b', 'd', 'e']);
  });

  it('rejects too many, a repeat, an unlisted seat, or none', () => {
    expect(() => play(table(), 'b', 'c', 'd', 'e')).toThrow();
    expect(() => play(table(), 'b', 'b')).toThrow();
    expect(() => play(table(), 'a')).toThrow();
    expect(() => play(table())).toThrow();
  });

  it('a conversion is offered as a template too, with its own pick', () => {
    const conv = getLegalActions(table(), 'a', registry).filter((a): a is Extract<Action, { kind: 'UseConversionAction' }> => a.kind === 'UseConversionAction');
    // One template per owner (the fixture's Main and Deputy share the skill).
    expect(conv).toHaveLength(2);
    expect(conv[0]).toEqual(expect.objectContaining({ targets: [], pickTargets: { eligibleIds: ['b', 'c', 'd', 'e'], min: 1, max: 2 } }));
    const selecting = resolve(table(), { ...conv[0], pickTargets: undefined, targets: seats('c', 'e') }, ctx).state;
    const done = resolve(selecting, { kind: 'SelectAction', seatId: 'a', selectionId: selecting.pendingSelection!.id, ids: ['p'] }, ctx).state;
    expect(done.seats.filter((x) => x.combinedHp === 3).map((x) => x.id)).toEqual(['c', 'e']);
  });
});

describe('TurnFaceUpEffect', () => {
  it('turns a face-down seat face up, and does nothing to one already up', () => {
    const t = table();
    const down = { ...t, seats: t.seats.map((s) => (s.id === 'a' ? { ...s, faceDown: true as const } : s)) };
    const s = advanceToDecision({ ...down, resolutionQueue: [{ kind: 'TurnFaceUpEffect', seatId: 'a' }, { kind: 'TurnFaceUpEffect', seatId: 'b' }] }, ctx).state;
    expect(s.seats[0].faceDown).toBeUndefined();
    expect(s.log.filter((e) => e.kind === 'SeatTurnedEvent')).toEqual([{ kind: 'SeatTurnedEvent', seatId: 'a', faceDown: false }]);
  });
});
