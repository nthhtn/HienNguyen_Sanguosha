import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import type { CardInstance, GameState, UsedCard } from 'engine';
import { card, registry, table, TableOptions } from '../generals/skills.testing';
import { extraCostOf, wouldStop } from './stops';

const used = (c: CardInstance, as: string, colour: UsedCard['colour'], nature?: UsedCard['nature']): UsedCard => ({
  as, colour, suit: c.suit, rank: c.rank, physical: [c], ...(nature ? { nature } : {}),
});
const sha = (c = card('s1', 'sha', 'spade')) => used(c, 'sha', c.suit === 'heart' || c.suit === 'diamond' ? 'red' : 'black');
const stops = (s: GameState, c: UsedCard, target = 'seat-b', user = 'seat-a') => wouldStop(s, { card: c, userSeatId: user, targetSeatId: target }, registry);
const at = (seatId: string, general: string, revealed = true): TableOptions['generals'] => ({ [seatId]: [general, 'filler-xu-huang', revealed] });

describe('stops: armour', () => {
  const shield = [card('bs', 'black-shield', 'club', 2)];
  it('a black Sha is stopped by Black Shield; a red Sha is not', () => {
    const s = table({ 'seat-b:equip': shield });
    expect(stops(s, sha())).toBe(true);
    expect(stops(s, sha(card('s2', 'sha', 'heart')))).toBe(false);
  });
  it('a user wearing Black Pommel ignores the armour', () => {
    expect(stops(table({ 'seat-b:equip': shield, 'seat-a:equip': [card('bp', 'black-pommel')] }), sha())).toBe(false);
  });
  it('a Sha with no nature is stopped by Wood Armor; a fire Sha is not', () => {
    const s = table({ 'seat-b:equip': [card('wa', 'wood-armor', 'club', 2)] });
    expect(stops(s, sha())).toBe(true);
    expect(stops(s, used(card('s3', 'sha', 'spade'), 'sha', 'black', 'fire'))).toBe(false);
  });
});

describe('stops: Humility', () => {
  const lu = (revealed = true) => table({}, { generals: at('seat-b', 'kingdomWars:lu-xun', revealed) });
  const tool = (as: string) => used(card('t1', as, 'spade'), as, 'black');
  it('stops Steal and Capture on a revealed Lu Xun, not Duel', () => {
    const s = lu();
    expect(stops(s, tool('steal'))).toBe(true);
    expect(stops(s, tool('capture'))).toBe(true);
    expect(stops(s, tool('duel'))).toBe(false);
  });
  it('stops nothing while his General is hidden', () => {
    expect(stops(lu(false), tool('steal'))).toBe(false);
  });
  it('Lu Xun using it on himself is not stopped', () => {
    expect(stops(lu(), tool('steal'), 'seat-b', 'seat-b')).toBe(false);
  });
});

describe('stops: Pleasure', () => {
  const liuShan = at('seat-b', 'liu-shan');
  const run = (hand: CardInstance[]) => {
    const s = table({ 'seat-a:hand': hand }, { generals: liuShan });
    const c = sha();
    const use = { card: c, userSeatId: 'seat-a', targetSeatId: 'seat-b' };
    return { stopped: wouldStop(s, use, registry), cost: extraCostOf(s, use, registry) };
  };
  it('stops a Sha whose user holds no other Basic card', () => {
    expect(run([card('s1', 'sha', 'spade')])).toEqual({ stopped: true, cost: null });
  });
  it('taxes a Sha by one Basic card when the user holds another', () => {
    expect(run([card('s1', 'sha', 'spade'), card('p1', 'peach', 'heart')])).toEqual({ stopped: false, cost: { basicCards: 1 } });
  });
  it('a non-Basic hand card is not a payment', () => {
    expect(run([card('s1', 'sha', 'spade'), card('d1', 'duel', 'spade')]).stopped).toBe(true);
  });
});

describe('stops: coverage', () => {
  const root = join(__dirname, '..');
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      return statSync(p).isDirectory() ? files(p) : p.endsWith('.ts') && !p.endsWith('.spec.ts') ? [p] : [];
    });
  it('only the known files make a card have no effect on a seat', () => {
    const known = ['shared/armor.ts', 'shared/cancel.ts', 'generals/mountain.ts'];
    const found = files(root).filter((p) => readFileSync(p, 'utf8').includes("'no-effect'")).map((p) => relative(root, p));
    const unknown = found.filter((p) => !known.includes(p));
    if (unknown.length) throw new Error(`${unknown.join(', ')} yields 'no-effect': declare \`stops\` on the new trigger and add the file to this list in stops.spec.ts`);
    expect(found.sort()).toEqual([...known].sort());
  });
});
