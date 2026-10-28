import type { GameState } from 'engine';
import { createGame } from 'engine';
import { guozhanMode } from '../../modes/guozhan';
import { askedAbout, card, harness, hp, registry, table } from '../../generals/skills.testing';

// Fire Fan: when its wearer uses a plain Slash in their Play Phase, they may
// make it a Fire Attack. Asked every time.
const { play, pass, respond, use, decline, choose, settle } = harness();
const fan = card('ff', 'fire-fan', 'diamond', 1);
const damages = (s: GameState) => s.log.flatMap((e) => (e.kind === 'DamageDealtEvent' ? [e.damage] : []));

describe('Fire Fan', () => {
  it('is a range-4 weapon in the registry', () => {
    const def = registry.cards.get('fire-fan');
    expect(def?.equipSlot).toBe('weapon');
    expect(def?.weaponRange).toBe(4);
  });

  it('asks its wearer when they use a plain Slash, and Use makes it a Fire Attack', () => {
    let s = play(table({ 'seat-a:hand': [card('s', 'sha')], 'seat-a:equip': [fan] }), 's', 'seat-b');
    expect(askedAbout(s)).toBe('fire-fan');
    expect(s.pendingChoice?.seatId).toBe('seat-a');
    s = pass(use(s));
    expect(hp(s, 'seat-b')).toBe(3);
    expect(damages(s)).toMatchObject([{ amount: 1, nature: 'fire', cause: { card: { as: 'sha', nature: 'fire' } } }]);
  });

  it('Don’t leaves the Slash plain', () => {
    const s = pass(decline(play(table({ 'seat-a:hand': [card('s', 'sha')], 'seat-a:equip': [fan] }), 's', 'seat-b')));
    expect(hp(s, 'seat-b')).toBe(3);
    expect(damages(s)).toMatchObject([{ nature: 'normal' }]);
  });

  it('the converted Slash still counts toward the one Slash a turn', () => {
    const s = pass(use(play(table({ 'seat-a:hand': [card('s', 'sha')], 'seat-a:equip': [fan] }), 's', 'seat-b')));
    expect(s.turn.cardPlays).toEqual({ sha: 1 });
  });

  it('does not ask for a Fire Attack or a Lightning Attack', () => {
    for (const id of ['fire-attack', 'lightning-attack']) {
      const s = play(table({ 'seat-a:hand': [card('x', id, 'heart', 4)], 'seat-a:equip': [fan] }), 'x', 'seat-b');
      expect(s.pendingChoice).toBeFalsy();
      expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-b' });
    }
  });

  it('does not ask for a Slash played as an answer in a Duel', () => {
    let s = play(table({ 'seat-a:hand': [card('du', 'duel', 'spade', 1)], 'seat-b:hand': [card('s', 'sha')], 'seat-b:equip': [card('ff2', 'fire-fan', 'diamond', 1)] }), 'du', 'seat-b');
    s = respond(s, 's');
    expect(s.pendingChoice).toBeFalsy();
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-a' });
  });

  it('does not ask a seat that does not wear it', () => {
    const s = play(table({ 'seat-a:hand': [card('s', 'sha')], 'seat-b:equip': [fan] }), 's', 'seat-b');
    expect(s.pendingChoice).toBeFalsy();
  });

  // A Slash a skill makes is plain too: Xiahou Yuan's Godspeed Slash has no card behind it.
  describe('with Xiahou Yuan’s Godspeed', () => {
    const godspeedSha = () => {
      const turnStarts = settle(table({ 'seat-a:equip': [fan] }, { generals: { 'seat-a': ['xiahou-yuan', 'filler-meng-huo', true] }, owner: 'seat-d', phase: 'End' }));
      return choose(use(turnStarts), 'seat-c');
    };

    it('asks about Fire Fan on the Godspeed Slash, and Use makes it a Fire Attack', () => {
      expect(askedAbout(godspeedSha())).toBe('fire-fan');
      const s = pass(use(godspeedSha()));
      expect(hp(s, 'seat-c')).toBe(3);
      expect(damages(s)).toMatchObject([{ amount: 1, nature: 'fire' }]);
      expect(s.turn.cardPlays).toBeUndefined(); // still outside the Slash limit
    });

    it('Don’t leaves the Godspeed Slash plain', () => {
      const s = pass(decline(godspeedSha()));
      expect(damages(s)).toMatchObject([{ nature: 'normal' }]);
    });
  });

  // A real deal from each deck: the Fire Fan and a Slash the deal made are put in
  // seat-0's equipment and hand, the Generals are fixed, and it is seat-0's Play Phase.
  describe.each(['identity', 'kingdomWars'])('in a game dealt from the %s deck', (deck) => {
    const dealtGame = (): GameState => {
      const g = createGame(guozhanMode, registry, ['seat-0', 'seat-1', 'seat-2', 'seat-3'], 1, { deck });
      const all = g.zones.flatMap((z) => z.cards);
      const dealtFan = all.find((c) => c.definitionId === 'fire-fan')!;
      const dealtSha = all.find((c) => c.definitionId === 'sha')!;
      const taken = new Set([dealtFan.instanceId, dealtSha.instanceId]);
      return {
        ...g,
        phase: 'Play',
        generalSelection: null,
        seats: g.seats.map((x) => ({
          ...x,
          kingdom: 'Wei' as const,
          generals: { main: { generalDefinitionId: 'filler-xu-huang', revealed: true }, deputy: { generalDefinitionId: 'filler-dong-zhuo', revealed: true } },
          combinedHp: 4,
          maxCombinedHp: 4,
        })),
        zones: g.zones.map((z) => {
          const rest = z.cards.filter((c) => !taken.has(c.instanceId));
          if (z.id === 'seat-0:equip') return { ...z, cards: [...rest, dealtFan] };
          if (z.id === 'seat-0:hand') return { ...z, cards: [...rest, dealtSha] };
          return { ...z, cards: rest };
        }),
      };
    };
    const shaIn = (s: GameState) => s.zones.find((z) => z.id === 'seat-0:hand')!.cards.find((c) => c.definitionId === 'sha')!.instanceId;

    it('deals Fire Fan as the Ace of Diamonds', () => {
      const g = createGame(guozhanMode, registry, ['seat-0', 'seat-1', 'seat-2', 'seat-3'], 1, { deck });
      const fans = g.zones.flatMap((z) => z.cards).filter((c) => c.definitionId === 'fire-fan');
      expect(fans.map((c) => [c.suit, c.rank])).toEqual([['diamond', 1]]);
    });

    it('offers its wearer the Fire Attack choice on a plain Slash', () => {
      const g = dealtGame();
      const s = use(play(g, shaIn(g), 'seat-1'));
      expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-1' });
      const after = pass(s);
      expect(damages(after)).toMatchObject([{ nature: 'fire' }]);
    });
  });
});
