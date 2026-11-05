import { buildContentRegistry } from 'content';
import { GameState, getActiveSeatId } from 'engine';
import { give, playableGame, setHp, setTurn, stepUntil, windowOf } from './recipe';

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
