import { act, actor, card, decide, table } from './testing';

// A single-seat-target Tool: the bot must pick a legal target from the offered actions and the game goes on.
describe('a bot holding Ally Far Attack Near', () => {
  it('plays it on an offered target without crashing', () => {
    const s0 = table({ 'seat-a:hand': [card('af', 'ally-far-attack-near')] });
    const s = { ...s0, seats: s0.seats.map((x, i) => ({ ...x, kingdom: (i === 0 ? 'Wei' : 'Shu') as 'Wei' | 'Shu' })) };
    expect(actor(s)).toBe('seat-a');
    const action = decide(s);
    expect(() => act(s, action)).not.toThrow();
  });
});
