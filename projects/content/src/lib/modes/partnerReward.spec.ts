import { table, kwMode, harness, card } from '../generals/skills.testing';
import type { GameState } from 'engine';

// Seat b holds Kingdom Wars Liu Bei (4) + Zhang Fei (4): Synergistic Partners with an even printed HP sum.
// Liu Shan (3) + Zhao Yun (4) are partners with an odd sum (the Rounding bonus applies too).
// A Kingdom Wars General's id carries the `kingdomWars:` prefix in a real game.
const kw = (id: string) => `kingdomWars:${id}`;
describe('Guozhan: the Synergistic Partners reward', () => {
  const h = harness(kwMode);
  const reveal = (s: GameState, slot: 'main' | 'deputy', seatId = 'seat-b') => h.run(s, [{ kind: 'RevealGeneralEffect', seatId, slot }]);
  const handSize = (s: GameState, seatId = 'seat-b') => s.zones.find((z) => z.id === `${seatId}:hand`)!.cards.length;
  const deck = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6'].map((id) => card(id, 'sha'));
  const hiddenPair = (main: string, deputy: string) => ({ 'seat-b': [main, deputy, false] as [string, string, boolean] });
  const make = (generals: Record<string, [string, string, boolean]>, rules: GameState['rules'] = { partnerReward: true }, hp?: number): GameState => ({
    ...table({ drawPile: deck }, { generals, ...(hp === undefined ? {} : { hp: { 'seat-b': hp } }) }),
    rules,
  });
  const pairTable = (rules?: GameState['rules'], hp?: number) => make(hiddenPair(kw('liu-bei'), kw('zhang-fei')), rules, hp);
  const both = (s: GameState) => reveal(reveal(s, 'main'), 'deputy');

  it('offers recover and draw when the second General completes a pair', () => {
    const s = both(pairTable());
    expect(s.pendingChoice).toMatchObject({ seatId: 'seat-b', verb: 'pick', reason: { kind: 'partner-reward' } });
    expect(s.pendingChoice!.options.map((o) => [o.id, o.shows])).toEqual([
      ['recover', { kind: 'label', text: 'Recover 1 HP' }],
      ['draw', { kind: 'label', text: 'Draw 2 Cards' }],
    ]);
  });

  it('draws 2 cards when draw is chosen', () => {
    expect(handSize(h.choose(both(pairTable()), 'draw'))).toBe(2);
  });

  it('recovers 1 HP when recover is chosen while damaged, and offers recover enabled', () => {
    const s = both(pairTable(undefined, 3));
    expect(s.pendingChoice!.options.find((o) => o.id === 'recover')!.disabled).toBeUndefined();
    expect(h.choose(s, 'recover').seats.find((x) => x.id === 'seat-b')!.combinedHp).toBe(4);
  });

  it('shows recover disabled at full HP, hides it from the legal actions and refuses a forged pick', () => {
    const s = both(pairTable());
    expect(s.pendingChoice!.options.find((o) => o.id === 'recover')!.disabled).toBe(true);
    expect(h.legal(s, 'seat-b').flatMap((a) => (a.kind === 'ChooseOptionAction' ? [a.optionId] : []))).toEqual(['draw']);
    expect(() => h.choose(s, 'recover')).toThrow(/disabled/);
  });

  it('works whichever General is revealed second', () => {
    expect(reveal(reveal(pairTable(), 'deputy'), 'main').pendingChoice?.reason).toEqual({ kind: 'partner-reward' });
  });

  it('does not offer the reward after only the first General', () => {
    expect(reveal(pairTable(), 'main').pendingChoice).toBeUndefined();
  });

  it('is not offered again after a hide and a re-reveal', () => {
    const done = h.choose(both(pairTable()), 'draw');
    const again = reveal(h.run(done, [{ kind: 'HideGeneralEffect', seatId: 'seat-b', slot: 'main' }]), 'main');
    expect(again.pendingChoice).toBeUndefined();
  });

  it('is not offered for a death reveal or for generals that are not partners', () => {
    expect(both(make(hiddenPair(kw('liu-bei'), kw('cao-cao')))).pendingChoice).toBeUndefined();
    const dead = h.run(pairTable(), [{ kind: 'EliminateSeatEffect', seatId: 'seat-b' }]);
    expect(dead.pendingChoice).toBeUndefined();
  });

  it('is not offered for Identity Generals, whose ids have no prefix', () => {
    expect(both(make(hiddenPair('liu-bei', 'zhang-fei'))).pendingChoice).toBeUndefined();
  });

  it('is not offered without the partnerReward rule', () => {
    expect(both(pairTable({})).pendingChoice).toBeUndefined();
    expect(both({ ...pairTable(), rules: undefined }).pendingChoice).toBeUndefined();
  });

  it('stacks with the Rounding draw on the same reveal', () => {
    const s = both(make(hiddenPair(kw('liu-shan'), kw('zhao-yun'))));
    expect(handSize(s)).toBe(1);
    expect(s.pendingChoice?.reason).toEqual({ kind: 'partner-reward' });
  });

  it('is offered when the second General is revealed by using its skill', () => {
    // Revealing for an ability is the same RevealGeneralEffect carrying forAbilityId.
    const s = h.run(reveal(pairTable(), 'main'), [{ kind: 'RevealGeneralEffect', seatId: 'seat-b', slot: 'deputy', forAbilityId: 'any-skill' }]);
    expect(s.pendingChoice?.reason).toEqual({ kind: 'partner-reward' });
  });
});
