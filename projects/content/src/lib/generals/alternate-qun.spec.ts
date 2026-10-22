import type { GameState } from 'engine';
import { askedAbout, card, handIds, harness, hp, table, TableOptions } from './skills.testing';

const h = harness();
const at = (seatId: string, general: string): TableOptions['generals'] => ({ [seatId]: [general, 'filler-jia-xu', true] });
const offered = (s: GameState, seatId: string, skillId: string) =>
  h.legal(s, seatId).some((a) => a.kind === 'UseSkillAction' && a.owner.kind === 'general' && a.owner.skillId === skillId);

describe('Alternate Diao Chan, Seed of Animosity', () => {
  const id = 'alternate:seed-of-animosity';
  // Seat-a discards k; seat-c Duels seat-b. Wuxie and Wuxie Kingdom sit in the other seats' hands.
  const sow = (general: string) =>
    table(
      { 'seat-a:hand': [card('k', 'shan')], 'seat-c:hand': [card('wx', 'wuxie', 'spade')], 'seat-d:hand': [card('wg', 'wuxie-guo', 'spade')] },
      { generals: at('seat-a', general) }
    );
  const duelled = (general: string, skillId: string) => h.choose(h.choose(h.select(h.useSkill(sow(general), 'seat-a', skillId), 'k'), 'seat-b'), 'seat-c');

  it('the Duel it makes is never offered a Wuxie or Wuxie Kingdom answer and resolves', () => {
    const s = duelled('alternate:diao-chan', id);
    expect(s.log.find((e) => e.kind === 'CardPlayedEvent')).toMatchObject({ card: { as: 'duel', noWuxie: true } });
    expect(s.pendingResponse?.reason?.kind).not.toBe('wuxie');
    expect(s.pendingResponse?.respondingSeatId).toBe('seat-b');
    expect(hp(h.pass(s), 'seat-b')).toBe(3);
  });

  it('Default Diao Chan offers Wuxie on the same Duel', () => {
    const s = duelled('diao-chan', 'sow-discord');
    expect(s.pendingResponse?.reason).toMatchObject({ kind: 'wuxie' });
    expect(s.log.find((e) => e.kind === 'CardPlayedEvent')).toMatchObject({ card: { as: 'duel' } });
    expect(s.log.find((e) => e.kind === 'CardPlayedEvent')).not.toMatchObject({ card: { noWuxie: true } });
  });

  it('a Duel played normally still offers Wuxie', () => {
    const s = h.play(table({ 'seat-a:hand': [card('du', 'duel')], 'seat-c:hand': [card('wx', 'wuxie', 'spade')] }, { generals: at('seat-a', 'alternate:diao-chan') }), 'du', 'seat-b');
    expect(s.pendingResponse?.reason).toMatchObject({ kind: 'wuxie' });
  });

  it('still needs two other male seats, discards a card, and is once per turn', () => {
    const girls = { 'seat-c': ['filler-zhu-rong', 'filler-sun-jian'], 'seat-d': ['filler-cai-wenji', 'filler-sun-jian'] } as NonNullable<TableOptions['generals']>;
    expect(offered(table({ 'seat-a:hand': [card('k', 'shan')] }, { generals: { ...at('seat-a', 'alternate:diao-chan'), ...girls } }), 'seat-a', id)).toBe(false);
    const s = h.select(h.useSkill(sow('alternate:diao-chan'), 'seat-a', id), 'k');
    expect(handIds(s, 'seat-a')).toEqual([]);
    const done = h.pass(h.choose(h.choose(s, 'seat-b'), 'seat-c'));
    expect(offered(done, 'seat-a', id)).toBe(false);
  });
});

describe('Alternate Diao Chan, Envious Moon', () => {
  const id = 'alternate:envious-moon';
  const end = (general: string) => h.act(table({ drawPile: [card('d1', 'shan')] }, { generals: at('seat-a', general) }), { kind: 'EndPhaseAction', seatId: 'seat-a' });

  it('asks whether to draw 1; accepting draws 1', () => {
    const s = end('alternate:diao-chan');
    expect(askedAbout(s)).toBe(id);
    expect(handIds(s, 'seat-a')).toEqual([]);
    expect(handIds(h.use(s), 'seat-a')).toEqual(['d1']);
  });

  it('declining draws nothing', () => {
    expect(handIds(h.decline(end('alternate:diao-chan')), 'seat-a')).toEqual([]);
  });

  it('Default Diao Chan draws 1 without asking', () => {
    const s = end('diao-chan');
    expect(askedAbout(s)).toBeNull();
    expect(handIds(s, 'seat-a')).toEqual(['d1']);
  });
});
