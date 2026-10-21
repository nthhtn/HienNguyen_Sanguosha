import { act, actor, card, decide, table } from './testing';

// Amass's discard is a mandatory selection (min = max, no Cancel): the bot must still answer it.
describe('a bot facing Amass', () => {
  it('answers the mandatory discard of 2 with 2 eligible cards, and the game goes on', () => {
    const base = table({ 'seat-a:hand': [card('x1', 'sha'), card('x2', 'peach'), card('x3', 'wine')], drawPile: [card('d1', 'sha'), card('d2', 'shan')] });
    const sel = {
      id: 'amass-test', seatId: 'seat-a', reason: { kind: 'card-effect' as const, card: { as: 'amass', physical: [] }, userSeatId: 'seat-a' },
      of: 'cards' as const, eligibleIds: ['x1', 'x2', 'x3', 'd1'], min: 2, max: 2, then: { kind: 'discard' as const },
    };
    const s = { ...base, pendingSelection: sel };
    expect(actor(s)).toBe('seat-a');
    const action = decide(s);
    expect(action).toMatchObject({ kind: 'SelectAction' });
    const ids = (action as { ids: string[] }).ids;
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    for (const id of ids) expect(sel.eligibleIds).toContain(id);
    expect(act(s, action).pendingSelection).toBeFalsy();
  });
});
