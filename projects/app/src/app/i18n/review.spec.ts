import { ENGLISH_PROSE, kingdomWarsCardIds, kingdomWarsGeneralIds, cardIds, generalIds, reviewGeneralIds } from 'content';
import review from '../../../../content/data/locales/vi/review.json';
import { en } from './en';
import { reviewStatus, reviewUniverse } from './review';

const universe = reviewUniverse(en, reviewGeneralIds(), [...cardIds(), ...kingdomWarsCardIds()], ENGLISH_PROSE);

describe('reviewStatus', () => {
  it('counts the reviewed ids of each category and lists the rest', () => {
    const result = reviewStatus({ ui: ['a'], generals: [], cards: ['x', 'gone'], prose: { hints: ['h1'] } }, { ui: ['a', 'b'], generals: ['g'], cards: ['x', 'y'], prose: { hints: ['h1', 'h2'], selection: ['s'] } });
    expect(result.map((r) => [r.category, r.reviewed, r.total])).toEqual([
      ['UI messages', 1, 2],
      ['Generals (name, title and skills)', 0, 1],
      ['Cards (name and text)', 1, 2],
      ['Prose: hints', 1, 2],
      ['Prose: selection', 0, 1],
    ]);
    expect(result[2].unknown).toEqual(['gone']);
    expect(result[3].unreviewed).toEqual(['h2']);
  });
});

describe('the Vietnamese review file', () => {
  it('reports a prose table that no longer exists', () => {
    const result = reviewStatus({ ui: [], generals: [], cards: [], prose: { gone: ['a'] } }, { ui: [], generals: [], cards: [], prose: {} });
    expect(result.find((r) => r.category === 'Prose: gone')!.unknown).toEqual(['a']);
  });

  it('counts the Kingdom Wars-only cards, so they can be listed as reviewed', () => {
    const cards = reviewStatus({ ...review, cards: [...review.cards, 'wu-six-swords'] }, universe).find((r) => r.category === 'Cards (name and text)')!;
    expect(cards.unknown).toEqual([]);
    expect(cards.unreviewed).toEqual(expect.arrayContaining(['wuxie-guo', 'amass', 'ascertain', 'ally-far-attack-near', 'trident-glaive']));
    expect(cards.total).toBe(cardIds().length + kingdomWarsCardIds().length);
  });

  it('counts the Kingdom Wars Generals as kingdomWars:<id>, so they can be listed as reviewed', () => {
    const generals = reviewStatus({ ...review, generals: [...review.generals, 'kingdomWars:cao-cao'] }, universe).find((r) => r.category === 'Generals (name, title and skills)')!;
    expect(generals.unknown).toEqual([]);
    expect(generals.unreviewed).toContain('kingdomWars:ding-feng');
    expect(generals.unreviewed).toContain('cao-cao');
    expect(generals.total).toBe(generalIds().length + kingdomWarsGeneralIds().length);
  });

  it('lists only ids that exist', () => {
    const stale = reviewStatus(review, universe).flatMap((r) => r.unknown.map((id) => `${r.category}: ${id}`));
    expect(stale).toEqual([]);
  });
});
