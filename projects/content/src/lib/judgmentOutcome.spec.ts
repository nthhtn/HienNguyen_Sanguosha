import { usedCardOf, skipFlagOf } from 'engine';
import type { CardInstance, Effect, GameState, JudgmentReader, JudgmentView } from 'engine';
import { card, registry, table } from './generals/skills.testing';
import { judgmentOutcome, judgmentReaderId, judgmentReaderIds } from './judgmentOutcome';
import { ENGLISH_PROSE, judgmentOutcomeText } from './display';
import { unyielding, riverGoddess } from './generals/wei';
import { ironCavalry } from './generals/shu';
import { lightningStrike } from './generals/wind';
import { duelingHeroes } from './generals/fire';
import { militaryFarm, lament } from './generals/mountain';
import type { GeneralOwner, SkillDefinition } from 'engine';
import { ALTERNATE_VARIANTS } from './alternateVariants';

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

// What a skill's own onJudged does with the card.
const readSkill = (skill: SkillDefinition, state: GameState, owner: GeneralOwner, seatId: string, judged: CardInstance, data?: Record<string, unknown>) =>
  skill.onJudged!(state, { owner, seatId, judged, ...(data ? { data } : {}), done }, registry) as Effect[];
const ownerOf = (skillId: string, seatId = 'seat-a'): GeneralOwner => ({ kind: 'general', seatId, slot: 'main', skillId });
const eliminate = (state: GameState, seatId: string): GameState => ({ ...state, seats: state.seats.map((s) => (s.id === seatId ? { ...s, eliminated: true } : s)) });
const handOf = (n: number, seatId: string) => ({ [`${seatId}:hand`]: Array.from({ length: n }, (_, i) => card(`${seatId}-h${i}`, 'sha', 'spade', 3)) });

describe('judgmentOutcome: Unyielding', () => {
  const owner = ownerOf('unyielding');
  const data = { sourceSeatId: 'seat-b' };
  const run = (state: GameState, suit: CardInstance['suit']) => {
    const judged = card('j', 'x', suit, 5);
    return { outcome: outcome(state, view(skillReader('unyielding'), 'seat-a', judged, data)), effects: readSkill(unyielding, state, owner, 'seat-a', judged, data) };
  };
  const step = { kind: 'SkillStepEffect', owner, step: 'outcome', data } as unknown as Extract<Effect, { kind: 'SkillStepEffect' }>;

  it('a heart spares the damage source', () => {
    const { outcome: o, effects } = run(table(handOf(3, 'seat-b')), 'heart');
    expect(o).toEqual({ readerId: 'unyielding', key: 'spared', seats: { seat: 'seat-a', owner: 'seat-a', source: 'seat-b' } });
    expect(kinds(effects)).toEqual(['JudgmentDoneEffect']);
  });

  it('a dead damage source is spared whatever the card', () => {
    const { outcome: o, effects } = run(eliminate(table(handOf(3, 'seat-b')), 'seat-b'), 'club');
    expect(o?.key).toBe('spared');
    expect(kinds(effects)).toEqual(['JudgmentDoneEffect']);
  });

  it.each([[2, 'discard-or-damage'], [5, 'discard-or-damage'], [1, 'damage'], [0, 'damage']])('a non-heart with %i hand cards: %s', (cards, key) => {
    const state = table(handOf(cards, 'seat-b'));
    const { outcome: o, effects } = run(state, 'club');
    expect(o?.key).toBe(key);
    expect(kinds(effects)).toEqual(['JudgmentDoneEffect', 'SkillStepEffect']);
    const next = unyielding.onStep!(state, step, registry) as Effect[];
    if (key === 'damage') expect(kinds(next)).toEqual(['DamageEffect']);
    else expect(kinds(next)).not.toEqual(['DamageEffect']);
  });
});

describe('judgmentOutcome: River Goddess', () => {
  const owner = ownerOf('river-goddess');
  const run = (state: GameState, suit: CardInstance['suit']) => {
    const judged = card('j', 'x', suit, 5);
    return { outcome: outcome(state, view(skillReader('river-goddess'), 'seat-a', judged)), effects: readSkill(riverGoddess, state, owner, 'seat-a', judged) };
  };

  it.each(SUITS)('a %s: the key matches what the skill does', (suit) => {
    const { outcome: o, effects } = run(table(), suit);
    const red = suit === 'heart' || suit === 'diamond';
    expect(o).toEqual({ readerId: 'river-goddess', key: red ? 'ends' : 'again', seats: { seat: 'seat-a', owner: 'seat-a', source: null } });
    expect(kinds(effects)).toEqual(red ? ['JudgmentDoneEffect'] : ['MoveCardEffect', 'JudgmentDoneEffect', 'AskUseEffect']);
  });

  it('ends when the judged owner is no longer living, even on black', () => {
    const { outcome: o, effects } = run(eliminate(table(), 'seat-a'), 'club');
    expect(o?.key).toBe('ends');
    expect(kinds(effects)).toEqual(['JudgmentDoneEffect']);
  });
});

describe('judgmentOutcome: Alternate Goddess Luo', () => {
  const owner = ownerOf('alternate:goddess-luo');
  const goddessLuo = ALTERNATE_VARIANTS['zhen-ji']['洛神'];
  const run = (state: GameState, suit: CardInstance['suit']) => {
    const judged = card('j', 'x', suit, 5);
    return { outcome: outcome(state, view(skillReader('alternate:goddess-luo'), 'seat-a', judged)), effects: readSkill(goddessLuo, state, owner, 'seat-a', judged) };
  };

  it.each(SUITS)('a %s: the key matches what the skill does', (suit) => {
    const { outcome: o, effects } = run(table(), suit);
    const red = suit === 'heart' || suit === 'diamond';
    expect(o).toEqual({ readerId: 'alternate:goddess-luo', key: red ? 'ends' : 'again', seats: { seat: 'seat-a', owner: 'seat-a', source: null } });
    // Black: set aside in her stash, then asked to go on; red: discarded, then the held cards are acquired.
    expect(kinds(effects)).toEqual(red ? ['JudgmentDoneEffect', 'SkillStepEffect'] : ['MoveCardEffect', 'JudgmentDoneEffect', 'AskUseEffect']);
  });

  it('ends when the judged owner is no longer living, even on black', () => {
    const { outcome: o, effects } = run(eliminate(table(), 'seat-a'), 'club');
    expect(o?.key).toBe('ends');
    expect(kinds(effects)).toEqual(['JudgmentDoneEffect', 'SkillStepEffect']);
  });
});

describe('judgmentOutcome: Iron Cavalry', () => {
  const owner = ownerOf('iron-cavalry');
  const step = { kind: 'CardStepEffect', step: 'sha-targeted', target: { kind: 'seat', seatId: 'seat-b' }, data: {} };

  it.each(SUITS)('a %s: red makes the Slash unblockable', (suit) => {
    const judged = card('j', 'x', suit, 5);
    const red = suit === 'heart' || suit === 'diamond';
    const o = outcome(table(), view(skillReader('iron-cavalry'), 'seat-a', judged, { step }));
    expect(o).toEqual({ readerId: 'iron-cavalry', key: red ? 'unblockable' : 'none', seats: { seat: 'seat-a', owner: 'seat-a', source: null } });
    const effects = readSkill(ironCavalry, table(), owner, 'seat-a', judged, { step });
    expect(kinds(effects).includes('AbilityUsedEffect')).toBe(red);
  });
});

describe('judgmentOutcome: Lightning Strike', () => {
  const owner = ownerOf('lightning-strike');
  // The judged seat is the one the owner picked.
  const run = (state: GameState, suit: CardInstance['suit']) => {
    const judged = card('j', 'x', suit, 5);
    return { outcome: outcome(state, view(skillReader('lightning-strike'), 'seat-c', judged)), effects: readSkill(lightningStrike, state, owner, 'seat-c', judged) };
  };

  it.each(SUITS)('a %s: only a spade strikes', (suit) => {
    const { outcome: o, effects } = run(table(), suit);
    expect(o).toEqual({ readerId: 'lightning-strike', key: suit === 'spade' ? 'damage' : 'none', seats: { seat: 'seat-c', owner: 'seat-a', source: null } });
    const damage = effects.find((e) => e.kind === 'DamageEffect');
    if (suit === 'spade') expect(damage).toMatchObject({ damage: { amount: 2, nature: 'thunder', target: { kind: 'seat', seatId: 'seat-c' } } });
    else expect(damage).toBeUndefined();
  });

  it('a judged seat that died does nothing', () => {
    const { outcome: o, effects } = run(eliminate(table(), 'seat-c'), 'spade');
    expect(o?.key).toBe('none');
    expect(effects.find((e) => e.kind === 'DamageEffect')).toBeUndefined();
  });
});

describe('judgmentOutcome: Dueling Heroes', () => {
  const owner = ownerOf('dueling-heroes');

  it.each(SUITS)('a %s: the judged colour is the key and the turn flag', (suit) => {
    const judged = card('j', 'x', suit, 5);
    const colour = suit === 'heart' || suit === 'diamond' ? 'red' : 'black';
    expect(outcome(table(), view(skillReader('dueling-heroes'), 'seat-a', judged))).toEqual({ readerId: 'dueling-heroes', key: colour, seats: { seat: 'seat-a', owner: 'seat-a', source: null } });
    const effects = readSkill(duelingHeroes, table(), owner, 'seat-a', judged);
    expect(effects.find((e) => e.kind === 'SetTurnFlagEffect')).toMatchObject({ flag: `dueling-heroes-${colour}` });
  });
});

describe('judgmentOutcome: Military Farm', () => {
  const owner = ownerOf('military-farm');
  const run = (state: GameState, suit: CardInstance['suit']) => {
    const judged = card('j', 'x', suit, 5);
    return { outcome: outcome(state, view(skillReader('military-farm'), 'seat-a', judged)), effects: readSkill(militaryFarm, state, owner, 'seat-a', judged) };
  };

  it.each(SUITS)('a %s: only a heart is discarded', (suit) => {
    const { outcome: o, effects } = run(table(), suit);
    expect(o).toEqual({ readerId: 'military-farm', key: suit === 'heart' ? 'discard' : 'farm', seats: { seat: 'seat-a', owner: 'seat-a', source: null } });
    expect(kinds(effects).includes('AbilityUsedEffect')).toBe(suit !== 'heart');
  });

  it('a dead owner discards', () => {
    const { outcome: o, effects } = run(eliminate(table(), 'seat-a'), 'club');
    expect(o?.key).toBe('discard');
    expect(kinds(effects)).toEqual(['JudgmentDoneEffect']);
  });
});

describe('judgmentOutcome: Lament', () => {
  const owner = ownerOf('lament');
  const data = { victim: 'seat-b', source: 'seat-c' };
  const run = (state: GameState, suit: CardInstance['suit'], withData: Record<string, unknown> | undefined = data) => {
    const judged = card('j', 'x', suit, 5);
    return { outcome: outcome(state, view(skillReader('lament'), 'seat-b', judged, withData)), effects: readSkill(lament, state, owner, 'seat-b', judged, withData) };
  };
  const clubStep = { kind: 'SkillStepEffect', owner, step: 'club', data: { source: 'seat-c' } } as unknown as Extract<Effect, { kind: 'SkillStepEffect' }>;
  const faceDown = (state: GameState, seatId: string): GameState => ({ ...state, seats: state.seats.map((s) => (s.id === seatId ? { ...s, faceDown: true } : s)) });

  it('a heart heals the victim, a diamond draws 2, whoever the source is', () => {
    const heart = run(table(), 'heart');
    expect(heart.outcome).toEqual({ readerId: 'lament', key: 'heal', seats: { seat: 'seat-b', owner: 'seat-a', source: 'seat-c' } });
    expect(heart.effects.map((e) => e.kind)).toEqual(['JudgmentDoneEffect', 'HealEffect']);
    const diamond = run(table(), 'diamond', { victim: 'seat-b' });
    expect(diamond.outcome?.key).toBe('draw');
    expect(diamond.effects.map((e) => e.kind)).toEqual(['JudgmentDoneEffect', 'DrawCardsEffect']);
  });

  it.each([[3, 'discard2', '"min":2'], [2, 'discard2', '"min":2'], [1, 'discard1', '"min":1']])('a club with %i cards held by the source: %s', (cards, key, min) => {
    const state = table(handOf(cards, 'seat-c'));
    expect(run(state, 'club').outcome?.key).toBe(key);
    expect(JSON.stringify(lament.onStep!(state, clubStep, registry))).toContain(min);
  });

  it('a club with a source holding nothing does nothing', () => {
    const state = table();
    expect(run(state, 'club').outcome?.key).toBe('none');
    expect(lament.onStep!(state, clubStep, registry)).toEqual([]);
  });

  it.each(['club', 'spade'] as const)('a %s with no source, or a dead one, does nothing', (suit) => {
    for (const [state, withData] of [[table(handOf(3, 'seat-c')), { victim: 'seat-b' }], [eliminate(table(handOf(3, 'seat-c')), 'seat-c'), data]] as const) {
      const { outcome: o, effects } = run(state, suit, withData);
      expect(o?.key).toBe('none');
      expect(kinds(effects)).toEqual(['JudgmentDoneEffect']);
    }
  });

  it('a spade turns the source face down, or face up when it already is down', () => {
    const up = run(table(), 'spade');
    expect(up.outcome?.key).toBe('face-down');
    expect(up.effects.map((e) => e.kind)).toEqual(['JudgmentDoneEffect', 'TurnFaceDownEffect']);
    const down = run(faceDown(table(), 'seat-c'), 'spade');
    expect(down.outcome?.key).toBe('face-up');
    expect(down.effects.map((e) => e.kind)).toEqual(['JudgmentDoneEffect', 'TurnFaceUpEffect']);
  });

  it('reads the suit as the victim counts it', () => {
    registry.generals.set('test-beauty', { id: 'test-beauty', kingdom: 'Wu', maxHp: 3, skills: [{ id: 'test-beauty', compulsory: true, modifiers: { suitAs: { spade: 'heart' } } }] });
    const state = table({}, { generals: { 'seat-b': ['test-beauty', 'filler-dong-zhuo', true] } });
    const { outcome: o, effects } = run(state, 'spade');
    expect(o?.key).toBe('heal');
    expect(effects.map((e) => e.kind)).toEqual(['JudgmentDoneEffect', 'HealEffect']);
  });
});

describe('every judging reader has outcome text', () => {
  // The keys each reader's decision function can return (see the describes above).
  const KEYS: Record<string, string[]> = {
    lightning: ['struck', 'moves', 'stays'],
    capture: ['skip', 'spared'],
    starvation: ['skip', 'spared'],
    'eight-trigrams': ['shan', 'none'],
    'eight-arrays': ['shan', 'none'],
    unyielding: ['discard-or-damage', 'damage', 'spared'],
    'river-goddess': ['again', 'ends'],
    'alternate:goddess-luo': ['again', 'ends'],
    'iron-cavalry': ['unblockable', 'none'],
    'lightning-strike': ['damage', 'none'],
    'alternate:lightning-strike': ['damage', 'none'],
    'dueling-heroes': ['red', 'black'],
    'military-farm': ['farm', 'discard'],
    lament: ['heal', 'draw', 'discard2', 'discard1', 'face-down', 'face-up', 'none'],
  };
  const names = { seat: 'A', owner: 'B', source: 'C' };

  it('every card and General skill with onJudged has an outcome entry', () => {
    const judging = [
      ...[...registry.cards.values()].filter((c) => c.onJudged).map((c) => c.id),
      ...[...registry.generals.values()].flatMap((g) => g.skills.filter((sk) => sk.onJudged).map((sk) => sk.id)),
    ];
    expect(judging.length).toBeGreaterThan(0);
    const missing = [...new Set(judging)].filter((id) => !judgmentReaderIds().includes(id));
    expect(missing).toEqual([]);
  });

  it('the dispatch table, the key list and the English text cover exactly the same readers and keys', () => {
    expect(judgmentReaderIds().sort()).toEqual(Object.keys(KEYS).sort());
    expect(Object.keys(ENGLISH_PROSE.judgmentOutcomes).sort()).toEqual(Object.keys(KEYS).sort());
    for (const [readerId, keys] of Object.entries(KEYS)) {
      expect({ readerId, keys: Object.keys(ENGLISH_PROSE.judgmentOutcomes[readerId]).sort() }).toEqual({ readerId, keys: [...keys].sort() });
    }
  });

  it('every key has text in English and in Vietnamese', () => {
    for (const [readerId, keys] of Object.entries(KEYS)) {
      for (const key of keys) {
        for (const locale of ['en', 'vi']) {
          expect({ readerId, key, locale, text: judgmentOutcomeText(readerId, key, names, locale) }).toEqual({ readerId, key, locale, text: expect.stringMatching(/\S/) });
        }
      }
    }
  });
});
