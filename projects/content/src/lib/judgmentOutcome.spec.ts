import { usedCardOf, skipFlagOf } from 'engine';
import type { CardInstance, Effect, GameState, JudgmentReader, JudgmentView } from 'engine';
import { card, registry, table } from './generals/skills.testing';
import { judgmentOutcome, judgmentReaderId } from './judgmentOutcome';

const SUITS: CardInstance['suit'][] = ['spade', 'heart', 'club', 'diamond'];
const done: Effect = { kind: 'JudgmentDoneEffect', judgment: undefined as never };

const view = (reader: JudgmentReader, seatId: string, judged: CardInstance, data?: Record<string, unknown>): JudgmentView => ({
  seatId, reader, card: judged, ...(data ? { data } : {}), changes: [], settled: true,
});
const cardReader = (definitionId: string): JudgmentReader => ({ kind: 'card', card: usedCardOf(card(`${definitionId}-tool`, definitionId, 'spade', 6)) });
const skillReader = (skillId: string, seatId = 'seat-a'): JudgmentReader => ({ kind: 'skill', owner: { kind: 'general', seatId, slot: 'main', skillId } });
const outcome = (state: GameState, v: JudgmentView) => judgmentOutcome(state, v, registry);
const kinds = (effects: unknown[]) => (effects as Effect[]).map((e) => e.kind);

// What the card's own onJudged does with the same card, for the key to be checked against.
const readCard = (state: GameState, definitionId: string, seatId: string, judged: CardInstance, data?: Record<string, unknown>) =>
  registry.cards.get(definitionId)!.onJudged!(state, { tool: usedCardOf(card(`${definitionId}-tool`, definitionId, 'spade', 6)), seatId, judged, ...(data ? { data } : {}), done }, registry) as Effect[];

describe('judgmentReaderId', () => {
  it('is the card a card reader counts as, or the skill id of a skill reader', () => {
    expect(judgmentReaderId(cardReader('lightning'))).toBe('lightning');
    expect(judgmentReaderId(skillReader('lament'))).toBe('lament');
  });
});

describe('judgmentOutcome: unknown readers', () => {
  it('is null for a reader without an entry', () => {
    expect(outcome(table(), view(cardReader('sha'), 'seat-a', card('j', 'x')))).toBeNull();
  });
});

describe('judgmentOutcome: Lightning', () => {
  const holder = (zones: Record<string, CardInstance[]> = {}) => table({ 'seat-b:judgment': [card('lt', 'lightning')], ...zones });
  const struckBy = (suit: CardInstance['suit'], rank: number) => outcome(holder(), view(cardReader('lightning'), 'seat-b', card('j', 'x', suit, rank)));

  it.each([[2], [5], [9]])('a spade of rank %i strikes: 3 thunder damage with no source', (rank) => {
    const judged = card('j', 'x', 'spade', rank);
    expect(struckBy('spade', rank)).toEqual({ readerId: 'lightning', key: 'struck', seats: { seat: 'seat-b', owner: 'seat-b', source: null } });
    const effects = readCard(holder(), 'lightning', 'seat-b', judged);
    expect(effects.find((e) => e.kind === 'DamageEffect')).toMatchObject({ damage: { source: null, amount: 3, nature: 'thunder' } });
  });

  it.each<[CardInstance['suit'], number]>([['spade', 1], ['spade', 10], ['heart', 5], ['club', 5], ['diamond', 5]])('a %s of rank %i moves it on, and the card itself does nothing', (suit, rank) => {
    expect(struckBy(suit, rank)?.key).toBe('moves');
    expect(readCard(holder(), 'lightning', 'seat-b', card('j', 'x', suit, rank))).toEqual([]);
  });

  it('stays when every other living seat already holds a Lightning', () => {
    const everyone = holder({ 'seat-a:judgment': [card('l1', 'lightning')], 'seat-c:judgment': [card('l2', 'lightning')], 'seat-d:judgment': [card('l3', 'lightning')] });
    expect(outcome(everyone, view(cardReader('lightning'), 'seat-b', card('j', 'x', 'heart', 5)))?.key).toBe('stays');
  });

  it('moves on past an eliminated seat to a living one that has none', () => {
    const state = holder();
    const gone: GameState = { ...state, seats: state.seats.map((s) => (s.id === 'seat-c' ? { ...s, eliminated: true } : s)) };
    expect(outcome(gone, view(cardReader('lightning'), 'seat-b', card('j', 'x', 'heart', 5)))?.key).toBe('moves');
  });
});

describe.each([
  ['capture', 'heart', 'Play'],
  ['starvation', 'club', 'Draw'],
] as const)('judgmentOutcome: %s', (id, spares, phase) => {
  const state = () => table({ 'seat-b:judgment': [card('tool', id)] });

  it.each(SUITS)('a %s: the key matches what the card does', (suit) => {
    const judged = card('j', 'x', suit, 5);
    const key = outcome(state(), view(cardReader(id), 'seat-b', judged))?.key;
    const effects = readCard(state(), id, 'seat-b', judged);
    if (suit === spares) {
      expect(key).toBe('spared');
      expect(effects).toEqual([]);
    } else {
      expect(key).toBe('skip');
      expect(effects).toEqual([{ kind: 'SetTurnFlagEffect', flag: skipFlagOf(phase) }]);
    }
  });

  it('reads the suit as the judged seat counts it', () => {
    registry.generals.set('test-beauty', { id: 'test-beauty', kingdom: 'Wu', maxHp: 3, skills: [{ id: 'test-beauty', compulsory: true, modifiers: { suitAs: { spade: 'heart', club: 'heart' } } }] });
    const beauty = table({ 'seat-b:judgment': [card('tool', id)] }, { generals: { 'seat-b': ['test-beauty', 'filler-dong-zhuo', true] } });
    const judged = card('j', 'x', spares === 'heart' ? 'spade' : 'club', 5);
    // The seat's spades and clubs count as hearts: a spare only when `spares` is heart.
    expect(outcome(beauty, view(cardReader(id), 'seat-b', judged))?.key).toBe(spares === 'heart' ? 'spared' : 'skip');
    expect(readCard(beauty, id, 'seat-b', judged)).toHaveLength(spares === 'heart' ? 0 : 1);
  });
});

describe('judgmentOutcome: Eight Trigrams and Eight Arrays', () => {
  const step = { kind: 'CardStepEffect', step: 'sha-shan', data: {} };
  const data = { step };

  it.each(SUITS)('a %s: the card and the skill agree, and the key matches the effects', (suit) => {
    const judged = card('j', 'x', suit, 5);
    const red = suit === 'heart' || suit === 'diamond';
    const asCard = outcome(table(), view(cardReader('eight-trigrams'), 'seat-a', judged, data));
    const asSkill = outcome(table(), view(skillReader('eight-arrays'), 'seat-a', judged, data));
    expect(asCard).toMatchObject({ readerId: 'eight-trigrams', key: red ? 'shan' : 'none', seats: { seat: 'seat-a', owner: 'seat-a' } });
    expect(asSkill).toMatchObject({ readerId: 'eight-arrays', key: asCard!.key });
    const effects = readCard(table({ 'seat-a:equip': [card('et', 'eight-trigrams')] }), 'eight-trigrams', 'seat-a', judged, data);
    expect(kinds(effects).includes('AbilityUsedEffect')).toBe(red);
  });
});
