import { getLegalActions } from 'engine';
import type { GameState } from 'engine';
import { act, actor, card, decide, registry, table } from './testing';

// Ascertain's secret look: a bot that used it answers both of its choices (what
// to look at, then Done) with a legal pick, and the game goes on.
describe('a bot that used Ascertain', () => {
  const hidden = (s: GameState): GameState => ({
    ...s,
    seats: s.seats.map((x) => (x.id === 'seat-b' && x.generals ? { ...x, generals: { ...x.generals, deputy: { ...x.generals.deputy, revealed: false } } } : x)),
  });

  it('is offered the Recast and each other seat', () => {
    const s = table({ 'seat-a:hand': [card('as', 'ascertain', 'club', 3)] });
    const offered = getLegalActions(s, 'seat-a', registry).filter((x) => x.kind === 'PlayCardAction' && x.cardInstanceId === 'as');
    expect(offered.map((x) => (x as { targets: { seatId: string }[] }).targets.map((t) => t.seatId))).toEqual([[], ['seat-b'], ['seat-c'], ['seat-d']]);
    expect(getLegalActions(s, 'seat-a', registry)).toContainEqual(decide(s));
  });

  it('answers the pick and the look with legal choices, and the look then closes', () => {
    const s0 = hidden(table({ 'seat-a:hand': [card('as', 'ascertain', 'club', 3)], 'seat-b:hand': [card('b1', 'peach', 'heart', 4)] }));
    let s = act(s0, { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'as', targets: [{ kind: 'seat', seatId: 'seat-b' }] });
    expect(s.pendingChoice).toMatchObject({ seatId: 'seat-a', secret: true });
    for (let step = 0; step < 2; step++) {
      expect(actor(s)).toBe('seat-a');
      const chosen = decide(s);
      expect(chosen.kind).toBe('ChooseOptionAction');
      expect(getLegalActions(s, 'seat-a', registry)).toContainEqual(chosen);
      s = act(s, chosen);
    }
    expect(s.pendingChoice).toBeUndefined();
    expect(s.zones.find((z) => z.id === 'seat-b:hand')!.cards.map((c) => c.instanceId)).toEqual(['b1']);
  });
});
