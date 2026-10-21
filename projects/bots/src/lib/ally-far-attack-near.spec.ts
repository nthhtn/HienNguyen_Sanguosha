import { getLegalActions } from 'engine';
import { act, actor, card, decide, registry, table } from './testing';

// A single-seat-target Tool: the bot must pick a legal target from the offered actions and the game goes on.
describe('a bot holding Ally Far Attack Near', () => {
  it('is offered the play only on the exposed other-Kingdom seat, and playing it nets +2 cards', () => {
    const pile = ['d1', 'd2', 'd3', 'd4', 'd5'].map((id) => card(id, 'sha', 'club'));
    const s = table(
      { 'seat-a:hand': [card('af', 'ally-far-attack-near')], drawPile: pile },
      { kingdoms: { 'seat-a': 'Wei', 'seat-b': 'Wei', 'seat-c': 'Shu', 'seat-d': 'hidden' } }
    );
    expect(actor(s)).toBe('seat-a');
    const offered = getLegalActions(s, 'seat-a', registry).filter((x) => x.kind === 'PlayCardAction' && x.cardInstanceId === 'af');
    expect(offered.map((x) => (x as { targets: { seatId: string }[] }).targets.map((t) => t.seatId))).toEqual([['seat-c']]);

    // The rule-based bot has no rule for this card (as for Amass), so it legitimately ends its phase
    // instead; what matters is that its choice is one of the offered actions and the game goes on.
    const chosen = decide(s);
    expect(getLegalActions(s, 'seat-a', registry)).toContainEqual(chosen);
    expect(chosen).toMatchObject({ kind: 'EndPhaseAction' });

    // Playing the offered action (what a human or random bot may do) nets +2 cards for the user.
    const after = act(s, offered[0]);
    const handSize = (id: string) => after.zones.find((z) => z.id === `${id}:hand`)!.cards.length;
    expect(handSize('seat-a')).toBe(3); // 1 - 1 played + 3 drawn
    expect(handSize('seat-c')).toBe(1);
  });
});
