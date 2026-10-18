import { CardInstance } from './types';
import type { CardDefinition, ContentRegistry } from '../registry/types';
import { answersAs, colourOf, usedCardFrom, usedCardKey, usedCardOf } from './usedCard';

const c = (instanceId: string, suit: CardInstance['suit']): CardInstance => ({ instanceId, definitionId: 'filler', suit, rank: 4 });
const via = { owner: { kind: 'equipment' as const, seatId: 'a', cardInstanceId: 'spear' }, abilityId: 'serpent-spear', conversionId: 'serpent-spear' };

describe('used cards', () => {
  it('reads hearts and diamonds as red, spades and clubs as black', () => {
    expect([colourOf(c('1', 'heart')), colourOf(c('2', 'diamond')), colourOf(c('3', 'spade')), colourOf(c('4', 'club'))]).toEqual(['red', 'red', 'black', 'black']);
  });

  it('one card used as itself keeps its suit, rank and colour', () => {
    expect(usedCardFrom([c('1', 'heart')], 'filler')).toEqual(usedCardOf(c('1', 'heart')));
  });

  it('two cards: red if both red, black if both black, else no colour; never a suit or rank', () => {
    expect(usedCardFrom([c('1', 'heart'), c('2', 'diamond')], 'sha')).toEqual({ as: 'sha', colour: 'red', physical: [c('1', 'heart'), c('2', 'diamond')] });
    expect(usedCardFrom([c('1', 'spade'), c('2', 'club')], 'sha').colour).toBe('black');
    expect(usedCardFrom([c('1', 'heart'), c('2', 'club')], 'sha').colour).toBe('none');
  });

  it('keeps the conversion that made it', () => {
    expect(usedCardFrom([c('1', 'heart'), c('2', 'club')], 'sha', via).via).toEqual(via);
  });

  it('is keyed by its physical cards, or "virtual" with none', () => {
    expect(usedCardKey(usedCardFrom([c('a', 'heart'), c('b', 'club')], 'sha'))).toBe('a+b');
    expect(usedCardKey({ as: 'sha', colour: 'none', physical: [] })).toBe('virtual');
  });

  describe('a card that plays as another (CardDefinition.playsAs)', () => {
    const def = (id: string, more: Partial<CardDefinition> = {}): CardDefinition => ({ id, name: id, category: 'basic', play: () => [], ...more });
    const registry: ContentRegistry = { cards: new Map([def('filler'), def('hot', { playsAs: 'filler', nature: 'fire' })].map((d) => [d.id, d])), generals: new Map() };
    const hot: CardInstance = { instanceId: 'h', definitionId: 'hot', suit: 'heart', rank: 4 };

    it('used as itself, is used as that card, with its nature', () => {
      expect(usedCardOf(hot, registry)).toEqual({ as: 'filler', colour: 'red', suit: 'heart', rank: 4, physical: [hot], nature: 'fire' });
      expect(usedCardOf(hot)).toEqual({ as: 'hot', colour: 'red', suit: 'heart', rank: 4, physical: [hot] }); // no registry: as itself
      expect(usedCardOf(c('1', 'heart'), registry)).not.toHaveProperty('nature');
    });

    it('converted, has no nature', () => {
      expect(usedCardFrom([hot], 'filler', via)).not.toHaveProperty('nature');
    });

    it('answers a window that asks for that card', () => {
      expect(answersAs('hot', ['filler'], registry)).toBe(true);
      expect(answersAs('hot', ['hot'], registry)).toBe(true);
      expect(answersAs('filler', ['hot'], registry)).toBe(false);
      expect(answersAs('hot', ['filler'])).toBe(false);
    });
  });
});
