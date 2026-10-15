import viProse from '../../data/locales/vi/prose.json';
import { ENGLISH_PROSE, abilityHint, choicePromptText, competeOutcomeText, seatPickText, selectionText, stepSelectionText } from './display';

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const ids = (table: object) => Object.keys(table).sort();

describe('the Vietnamese prose file mirrors the English tables', () => {
  it('has exactly the English ids in each of the six tables', () => {
    for (const table of Object.keys(ENGLISH_PROSE) as (keyof typeof ENGLISH_PROSE)[]) {
      expect({ table, ids: ids(viProse[table]) }).toEqual({ table, ids: ids(ENGLISH_PROSE[table]) });
    }
  });

  it('keeps every placeholder of a hint, a seat pick and a choice prompt', () => {
    for (const table of ['hints', 'seatPick', 'choicePrompt'] as const) {
      const english: Record<string, string> = ENGLISH_PROSE[table];
      const vietnamese: Record<string, string> = viProse[table];
      for (const id of Object.keys(english)) {
        expect({ table, id, placeholders: placeholders(vietnamese[id]) }).toEqual({ table, id, placeholders: placeholders(english[id]) });
      }
    }
  });

  it('keeps placeholders, and the presence of a cancel label, in selection texts', () => {
    for (const table of ['selection', 'stepSelection'] as const) {
      const english: Record<string, { prompt: string; confirm: string; cancel?: string }> = ENGLISH_PROSE[table];
      const vietnamese: Record<string, { prompt: string; confirm: string; cancel?: string }> = viProse[table];
      for (const id of Object.keys(english)) {
        expect({ table, id, placeholders: placeholders(vietnamese[id].prompt) }).toEqual({ table, id, placeholders: placeholders(english[id].prompt) });
        expect({ table, id, hasCancel: 'cancel' in vietnamese[id] }).toEqual({ table, id, hasCancel: 'cancel' in english[id] });
      }
    }
  });

  it('keeps both placeholders in every compete outcome', () => {
    for (const id of Object.keys(ENGLISH_PROSE.competeOutcomes)) {
      const english = ENGLISH_PROSE.competeOutcomes[id];
      const vietnamese = viProse.competeOutcomes[id as keyof typeof viProse.competeOutcomes];
      expect({ id, won: placeholders(vietnamese.won), lost: placeholders(vietnamese.lost) }).toEqual({ id, won: placeholders(english.won), lost: placeholders(english.lost) });
    }
  });

  it('has no empty text, and no hint or seat pick with {target} twice', () => {
    const texts = [
      ...Object.values(viProse.hints), ...Object.values(viProse.seatPick), ...Object.values(viProse.choicePrompt),
      ...Object.values(viProse.selection).flatMap((t) => Object.values(t)), ...Object.values(viProse.stepSelection).flatMap((t) => Object.values(t)),
      ...Object.values(viProse.competeOutcomes).flatMap((t) => Object.values(t)),
    ];
    for (const text of texts) expect({ text, empty: text.trim() === '' }).toEqual({ text, empty: false });
    for (const text of [...Object.values(viProse.hints), ...Object.values(viProse.seatPick)]) {
      expect({ text, targets: placeholders(text).filter((p) => p === 'target').length <= 1 }).toEqual({ text, targets: true });
    }
  });
});

describe('the display functions by locale', () => {
  it('English is the default and is unchanged', () => {
    expect(abilityHint('axe')).toBe('Discard 2 cards to make your Sha hit {target}');
    expect(abilityHint('axe', 'en')).toBe('Discard 2 cards to make your Sha hit {target}');
    expect(selectionText('bestowed-rouse')).toEqual({ prompt: 'Choose drawn cards to give away', confirm: 'Give', cancel: 'Keep the Rest' });
    expect(seatPickText('alliance')).toBe('Choose a seat to swap hands with {target}');
    expect(choicePromptText('upheaval')).toBe('Choose a seat to play a Sha at, or pass');
    expect(stepSelectionText('compete-user')).toEqual({ prompt: 'Choose a hand card to compete with', confirm: 'Compete' });
  });

  it('Vietnamese returns the Vietnamese entry', () => {
    expect(abilityHint('axe', 'vi')).toBe('Bỏ 2 lá bài để Sát của bạn trúng {target}');
    expect(selectionText('bestowed-rouse', 'vi')).toEqual({ prompt: 'Chọn các lá bài vừa rút để đưa đi', confirm: 'Đưa', cancel: 'Giữ phần còn lại' });
    expect(seatPickText('alliance', 'vi')).toBe('Chọn một người chơi để đổi bài trên tay với {target}');
    expect(choicePromptText('upheaval', 'vi')).toBe('Chọn một người chơi để đánh Sát vào, hoặc bỏ qua');
    expect(stepSelectionText('compete-user', 'vi')).toEqual({ prompt: 'Chọn một lá bài trên tay để đấu điểm', confirm: 'Đấu điểm' });
  });

  it('a locale with no prose, or an empty one, falls back to English', () => {
    expect(abilityHint('axe', 'fr')).toBe('Discard 2 cards to make your Sha hit {target}');
    expect(abilityHint('axe', '')).toBe('Discard 2 cards to make your Sha hit {target}');
    expect(selectionText('kindness', 'fr')).toEqual({ prompt: 'Choose cards to give', confirm: 'Give' });
  });

  it('an unknown ability is null in every language, even one named like an object property', () => {
    for (const locale of ['en', 'vi', 'fr']) {
      expect(abilityHint('no-such-ability', locale)).toBeNull();
      expect(abilityHint('constructor', locale)).toBeNull();
      expect(selectionText('toString', locale)).toBeNull();
      expect(seatPickText('__proto__', locale)).toBeNull();
      expect(choicePromptText('hasOwnProperty', locale)).toBeNull();
      expect(stepSelectionText('valueOf', locale)).toBeNull();
      expect(competeOutcomeText('constructor', true, { user: 'A', target: 'B' }, locale)).toBeNull();
    }
  });

  it('compete outcomes replace every {user} and {target}, in both languages', () => {
    const names = { user: 'Hing', target: 'Seat 1' };
    expect(competeOutcomeText('rouse-the-tiger', true, names)).toBe("Hing will choose a seat within Seat 1's attack range; Seat 1 deals it 1 damage");
    expect(competeOutcomeText('rouse-the-tiger', true, names, 'vi')).toBe('Hing sẽ chọn một người chơi trong tầm đánh của Seat 1; Seat 1 gây cho họ 1 sát thương');
    expect(competeOutcomeText('rouse-the-tiger', false, names, 'vi')).toBe('Seat 1 gây 1 sát thương cho Hing');
    expect(competeOutcomeText('intense-edge', false, names, 'vi')).toBe('Không có gì xảy ra');
    expect(competeOutcomeText('heavens-justice', false, names, 'vi')).toBe('Hing không thể đánh Sát trong lượt này');
  });
});
