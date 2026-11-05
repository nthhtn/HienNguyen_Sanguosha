import { buildContentRegistry } from 'content';
import { GameState, getActiveSeatId } from 'engine';
import { emptyHand, freshGame, give, setGenerals, playCard, playableGame, setHp, setTurn, stepUntil, windowOf } from './recipe';

const registry = buildContentRegistry();
const game = () => playableGame(registry, 7, 4);
const handOf = (state: GameState, seatId: string) =>
  state.zones.find((z) => z.id === state.seats.find((s) => s.id === seatId)!.hand.zoneId)!.cards;
const countOf = (state: GameState, definitionId: string) =>
  state.zones.reduce((n, z) => n + z.cards.filter((c) => c.definitionId === definitionId).length, 0);

describe('dev recipe helpers', () => {
  it('playableGame reaches a playable phase with seat-0 human and the rest bots', () => {
    const state = game();
    expect(state.phase).not.toBe('GeneralSelection');
    expect(state.seats).toHaveLength(4);
    expect(state.players.map((p) => p.kind)).toEqual(['human', 'bot', 'bot', 'bot']);
  });

  it('give puts the named cards in the hand without changing how many of them exist', () => {
    const before = game();
    const after = give(before, 'seat-0', ['wuxie', 'wuxie-guo', 'peach']);
    const hand = handOf(after, 'seat-0').map((c) => c.definitionId);
    expect(hand).toEqual(expect.arrayContaining(['wuxie', 'wuxie-guo']));
    expect(hand).toContain('peach');
    for (const id of ['wuxie', 'wuxie-guo', 'peach']) expect(countOf(after, id)).toBe(countOf(before, id));
  });

  it('setHp sets combinedHp', () => {
    expect(setHp(game(), 'seat-0', 1).seats[0].combinedHp).toBe(1);
  });

  it('setTurn makes the seat active in that phase with nothing pending', () => {
    const state = setTurn(game(), 'seat-2', 'Play');
    expect(state.phase).toBe('Play');
    expect(state.turn.ownerSeatId).toBe('seat-2');
    expect(getActiveSeatId(state)).toBe('seat-2');
  });

  it('stepUntil throws when the window is never reached', () => {
    expect(() => stepUntil(game(), registry, () => false, 5)).toThrow('stepUntil: window not reached');
  });

  it('windowOf is null for a resting state', () => {
    expect(windowOf(setTurn(game(), 'seat-0', 'Play'))).toBeNull();
  });
});

describe('dev recipe helpers for playing moves', () => {
  it('emptyHand moves a hand to the discard pile without losing cards', () => {
    const before = game();
    const total = before.zones.reduce((n, z) => n + z.cards.length, 0);
    const after = emptyHand(before, 'seat-1');
    expect(handOf(after, 'seat-1')).toEqual([]);
    expect(after.zones.reduce((n, z) => n + z.cards.length, 0)).toBe(total);
  });

  it('playCard plays the named card from a hand at the targets and opens the window it asks', () => {
    let state = setTurn(game(), 'seat-1', 'Play');
    state = give(emptyHand(state, 'seat-0'), 'seat-1', ['sha']);
    state = give(state, 'seat-0', ['shan']);
    const after = playCard(state, registry, 'seat-1', 'sha', ['seat-0']);
    expect(after.pendingResponse?.respondingSeatId).toBe('seat-0');
  });

  it('playCard throws when the seat does not hold the card', () => {
    const state = emptyHand(setTurn(game(), 'seat-1', 'Play'), 'seat-1');
    expect(() => playCard(state, registry, 'seat-1', 'sha', ['seat-0'])).toThrow('seat-1 holds no sha');
  });
});

describe('dev recipe helper setGenerals', () => {
  it('gives the seat the named Generals, unrevealed, with full HP for them', () => {
    const state = setGenerals(game(), registry, 'seat-0', 'kingdomWars:ji-ling', 'kingdomWars:guan-yu');
    const generals = state.seats[0].generals!;
    expect(generals.main).toEqual({ generalDefinitionId: 'kingdomWars:ji-ling', revealed: false });
    expect(generals.deputy.generalDefinitionId).toBe('kingdomWars:guan-yu');
    expect(state.seats[0].combinedHp).toBe(state.seats[0].maxCombinedHp);
  });
});

describe('dev recipe helper freshGame', () => {
  it('stops at General selection with seat-0 to choose', () => {
    const state = freshGame(registry, 7, 4);
    expect(state.phase).toBe('GeneralSelection');
    expect(getActiveSeatId(state)).toBe('seat-0');
    expect(state.players.map((p) => p.kind)).toEqual(['human', 'bot', 'bot', 'bot']);
  });
});
