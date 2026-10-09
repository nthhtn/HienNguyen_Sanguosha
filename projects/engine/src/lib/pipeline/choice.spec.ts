import { resolve } from './resolve';
import { applyEffect, Effect } from './effects';
import { createRng } from '../rng/rng';
import { getActiveSeatId } from '../rules/activeSeat';
import { getLegalActions } from '../rules/legality';
import { GameState, PendingChoice } from '../domain/types';
import { CardDefinition, ContentRegistry, GameModeDefinition } from '../registry/types';

const mode: GameModeDefinition = {
  id: 'stub',
  setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'],
  checkWinCondition: () => null,
  triggers: [],
};

// Seat a holds the fixture card; seat b has three hand cards and one worn card.
function state(): GameState {
  const seat = (id: string, index: number) => ({
    id, index, kingdom: 'Wei' as const, combinedHp: 3, maxCombinedHp: 4, eliminated: false,
    generals: { main: { generalDefinitionId: `${id}-m`, revealed: true }, deputy: { generalDefinitionId: `${id}-d`, revealed: true } },
    hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` },
  });
  const card = (instanceId: string, rank: number) => ({ instanceId, definitionId: 'filler', suit: 'club' as const, rank });
  return {
    seats: [seat('a', 0), seat('b', 1)],
    players: [],
    turn: { turnNumber: 1, ownerSeatId: 'a', extraTurnStack: [] },
    phase: 'Play',
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: [] },
      { id: 'discardPile', kind: 'discardPile', cards: [] },
      { id: 'a:hand', kind: 'hand', ownerSeatId: 'a', cards: [{ instanceId: 'picker', definitionId: 'picker', suit: 'spade', rank: 1 }] },
      { id: 'a:equip', kind: 'equip', ownerSeatId: 'a', cards: [] },
      { id: 'b:hand', kind: 'hand', ownerSeatId: 'b', cards: [card('b1', 1), card('b2', 2), card('b3', 3)] },
      { id: 'b:equip', kind: 'equip', ownerSeatId: 'b', cards: [card('b-eq', 9)] },
    ],
    pendingResponse: null, log: [], rng: createRng(1), result: null, generalSelection: null,
  };
}

const healA: Effect = { kind: 'HealEffect', target: { kind: 'seat', seatId: 'a' }, amount: 1 };
const choice: PendingChoice = {
  id: 'c1',
  seatId: 'a',
  reason: { kind: 'choice', card: { as: 'picker', colour: 'black', physical: [] }, userSeatId: 'a', targetSeatId: 'b' },
  verb: 'take',
  options: [
    { id: 'hand', shows: { kind: 'hidden-hand', seatId: 'b', count: 3 }, effects: [{ kind: 'MoveRandomCardEffect', fromZoneId: 'b:hand', toZoneId: 'a:hand' }] },
    {
      id: 'b-eq',
      shows: { kind: 'card', card: { instanceId: 'b-eq', definitionId: 'filler', suit: 'club', rank: 9 } },
      effects: [{ kind: 'MoveCardEffect', cardInstanceId: 'b-eq', toZoneId: 'a:hand' }],
    },
  ],
};
// A fixture card: opens `choice`, then heals its user.
const picker: CardDefinition = { id: 'picker', name: 'Picker', category: 'tool', legalPlayTargets: () => [[]], play: () => [{ kind: 'OpenChoiceEffect', choice }, healA] };
const ctx = { registry: { cards: new Map([[picker.id, picker]]), generals: new Map() } as ContentRegistry, mode };

const opened = () => resolve(state(), { kind: 'PlayCardAction', seatId: 'a', cardInstanceId: 'picker', targets: [] }, ctx).state;
const choose = (s: GameState, optionId: string, seatId = 'a', choiceId = 'c1') =>
  resolve(s, { kind: 'ChooseOptionAction', seatId, choiceId, optionId }, ctx).state;
const hand = (s: GameState, id: string) => s.zones.find((z) => z.id === `${id}:hand`)!.cards.map((c) => c.instanceId);
const hp = (s: GameState, id: string) => s.seats.find((x) => x.id === id)!.combinedHp;

describe('a pending choice', () => {
  it('pauses the queue: the chooser is the active seat and may only pick an option', () => {
    const s = opened();
    expect(s.pendingChoice).toEqual(choice);
    expect(hp(s, 'a')).toBe(3); // the heal waits
    expect(s.resolutionQueue).toEqual([healA, expect.objectContaining({ kind: 'ToolResolvedEffect' })]); // the Tool's end marker trails
    expect(getActiveSeatId(s)).toBe('a');
    expect(getLegalActions(s, 'a')).toEqual([
      { kind: 'ChooseOptionAction', seatId: 'a', choiceId: 'c1', optionId: 'hand' },
      { kind: 'ChooseOptionAction', seatId: 'a', choiceId: 'c1', optionId: 'b-eq' },
    ]);
    expect(getLegalActions(s, 'b')).toEqual([]);
    expect(() => resolve(s, { kind: 'EndPhaseAction', seatId: 'a' }, ctx)).toThrow('not legal while a choice is pending');
  });

  it('runs the picked option, logs the pick, then resumes the queue', () => {
    const s = choose(opened(), 'b-eq');
    expect(s.pendingChoice).toBeUndefined();
    expect(hand(s, 'a')).toEqual(['b-eq']);
    expect(hp(s, 'a')).toBe(4);
    expect(s.log.find((e) => e.kind === 'ChoiceMadeEvent')).toEqual({
      kind: 'ChoiceMadeEvent', seatId: 'a', reason: choice.reason, verb: 'take', shows: choice.options[1].shows,
    });
    expect(s.log.map((e) => e.kind)).toEqual(['CardPlayedEvent', 'CardMovedEvent', 'ChoiceMadeEvent', 'CardMovedEvent', 'HealEvent']);
  });

  it('rejects a pick by another seat, of an unknown option, or for a stale choice', () => {
    const s = opened();
    expect(() => choose(s, 'hand', 'b')).toThrow('is not the chooser');
    expect(() => choose(s, 'nope')).toThrow('has no option nope');
    expect(() => choose(s, 'hand', 'a', 'old')).toThrow('No matching pending choice: old');
  });

  it('takes a seeded random card from a hidden hand', () => {
    const once = choose(opened(), 'hand');
    const again = choose(opened(), 'hand');
    expect(hand(once, 'a')).toHaveLength(1);
    expect(hand(once, 'b')).toHaveLength(2);
    expect(hand(once, 'a')).toEqual(hand(again, 'a'));
    expect(once.rng.counter).toBeGreaterThan(opened().rng.counter);
  });

  it('survives a JSON round trip while pending, and resumes identically (Review Focus 3)', () => {
    const s = opened();
    const copy = JSON.parse(JSON.stringify(s)) as GameState;
    expect(choose(copy, 'hand')).toEqual(choose(s, 'hand'));
  });
});

describe('MoveRandomCardEffect', () => {
  it('does nothing when the zone is empty', () => {
    const empty = { ...state(), zones: state().zones.map((z) => (z.id === 'b:hand' ? { ...z, cards: [] } : z)) };
    expect(applyEffect(empty, { kind: 'MoveRandomCardEffect', fromZoneId: 'b:hand', toZoneId: 'a:hand' })).toEqual({ state: empty, events: [] });
  });
});

describe('seat, suit and label options', () => {
  it('are offered and logged like any option, and survive a JSON round trip', () => {
    const naming: PendingChoice = {
      id: 'c2', seatId: 'a', verb: 'pick',
      reason: { kind: 'ability', owner: { kind: 'general', seatId: 'b', slot: 'main', skillId: 'sow-revolt' }, abilityId: 'sow-revolt' },
      options: [
        { id: 'b', shows: { kind: 'seat', seatId: 'b' }, effects: [] },
        { id: 'heart', shows: { kind: 'suit', suit: 'heart' }, effects: [healA] },
        { id: 'done', shows: { kind: 'label', text: 'Done' }, effects: [] },
      ],
    };
    const s = applyEffect(state(), { kind: 'OpenChoiceEffect', choice: naming }).state;
    expect(getLegalActions(s, 'a').map((a) => (a.kind === 'ChooseOptionAction' ? a.optionId : a.kind))).toEqual(['b', 'heart', 'done']);
    const chosen = (from: GameState) => resolve(from, { kind: 'ChooseOptionAction', seatId: 'a', choiceId: 'c2', optionId: 'heart' }, ctx).state;
    expect(chosen(s).log[0]).toEqual({ kind: 'ChoiceMadeEvent', seatId: 'a', reason: naming.reason, verb: 'pick', shows: { kind: 'suit', suit: 'heart' } });
    expect(chosen(s).seats[0].combinedHp).toBe(4);
    expect(chosen(JSON.parse(JSON.stringify(s)))).toEqual(chosen(s));
  });
});
