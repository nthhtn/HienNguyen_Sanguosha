import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { cardDisplayData, cardIds } from 'content';
import { routes } from '../../app.routes';
import { en } from '../../i18n/en';
import { I18n } from '../../i18n/i18n.service';
import type { MessageKey } from '../../i18n/messages';
import { vi } from '../../i18n/vi';
import { parseRich } from './rich-text';

const text = (el: Element | null) => el!.textContent!.replace(/\s+/g, ' ').trim();
const ruleKeys = (Object.keys(en) as MessageKey[]).filter((key) => key.startsWith('rules.'));

describe('parseRich', () => {
  it('splits a sentence into text, links, card names and Force names', () => {
    expect(parseRich('See [[/wiki/rules/setup|Setup]]: {card:sha} for {force:Wei}.')).toEqual([
      { kind: 'text', text: 'See ' },
      { kind: 'link', path: '/wiki/rules/setup', text: 'Setup' },
      { kind: 'text', text: ': ' },
      { kind: 'card', id: 'sha' },
      { kind: 'text', text: ' for ' },
      { kind: 'force', name: 'Wei' },
      { kind: 'text', text: '.' },
    ]);
    expect(parseRich('Plain text')).toEqual([{ kind: 'text', text: 'Plain text' }]);
  });
});

describe('the rules texts in both languages', () => {
  it('no sentence holds a malformed token, in either language', () => {
    for (const catalog of [en, vi]) {
      for (const key of ruleKeys) {
        const leftovers = parseRich(catalog[key]).filter((part) => part.kind === 'text' && /\[\[|\]\]|\{card:|\{force:|\|/.test(part.text));
        expect([key, leftovers]).toEqual([key, []]);
      }
    }
  });

  const tokens = (source: string) => parseRich(source).filter((part) => part.kind !== 'text').map((part) => (part.kind === 'link' ? `link:${part.path}` : part.kind === 'card' ? `card:${part.id}` : `force:${part.name}`));

  it('has the same rules keys in English and Vietnamese', () => {
    expect(ruleKeys.length).toBeGreaterThan(60);
    expect(ruleKeys.filter((key) => !(key in vi))).toEqual([]);
  });

  it.each(ruleKeys)('%s keeps the same links, cards and Forces in both languages', (key) => {
    expect(tokens(vi[key])).toEqual(tokens(en[key]));
  });

  it('every card named in a sentence exists and is translated', () => {
    const named = new Set(ruleKeys.flatMap((key) => tokens(en[key])).filter((t) => t.startsWith('card:')).map((t) => t.slice(5)));
    for (const id of named) {
      expect(cardIds()).toContain(id);
      expect(cardDisplayData(id, 'vi')!.name).not.toBe(cardDisplayData(id, 'en')!.name);
    }
  });

  it('a link is labelled as the page is named in the navigation, in each language', () => {
    const NAV: Record<string, MessageKey> = {
      '/wiki/rules/setup': 'nav.rules.setup',
      '/wiki/rules/turn': 'nav.rules.turn',
      '/wiki/rules/card-types': 'nav.rules.cardTypes',
      '/wiki/rules/distance': 'nav.rules.distance',
      '/wiki/rules/judgment': 'nav.rules.judgment',
      '/wiki/generals': 'nav.cards.generals',
      '/wiki/tools': 'nav.cards.tools',
      '/wiki/equipment': 'nav.cards.equipment',
    };
    for (const [catalog, name] of [[en, 'English'], [vi, 'Vietnamese']] as const) {
      for (const key of ruleKeys) {
        for (const part of parseRich(catalog[key])) {
          if (part.kind === 'link') expect([name, part.path, part.text]).toEqual([name, part.path, catalog[NAV[part.path]]]);
        }
      }
    }
  });
});

describe('the rules pages in Vietnamese', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  async function open(page: string) {
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
    await TestBed.inject(I18n).setLocale('vi');
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(`/wiki/rules/${page}`);
    await harness.fixture.whenStable();
    harness.detectChanges();
    return { harness, el: harness.routeNativeElement as HTMLElement };
  }

  it.each([
    ['overview', 'Tổng quan'],
    ['card-types', 'Loại bài'],
    ['setup', 'Chuẩn bị'],
    ['turn', 'Cấu trúc lượt'],
    ['distance', 'Khoảng cách / Tầm'],
    ['judgment', 'Phán xét'],
  ])('%s: the title', async (page, title) => {
    const { el } = await open(page);
    expect(text(el.querySelector('h2'))).toBe(title);
  });

  it('overview: the Forces, the link labels and the paths', async () => {
    const { el } = await open('overview');
    expect(text(el)).toContain('Ngụy, Thục, Ngô hoặc Quần');
    expect([...el.querySelectorAll('a')].map((a) => `${a.getAttribute('href')} ${text(a)}`)).toEqual([
      '/wiki/rules/setup Chuẩn bị',
      '/wiki/rules/turn Cấu trúc lượt',
      '/wiki/rules/card-types Loại bài',
      '/wiki/rules/distance Khoảng cách / Tầm',
      '/wiki/rules/judgment Phán xét',
      '/wiki/generals Tướng',
    ]);
  });

  it('card types: the links keep their place in the headings, and the card names are Vietnamese', async () => {
    const { el } = await open('card-types');
    expect([...el.querySelectorAll('th > a')].map((a) => `${a.getAttribute('href')} ${text(a)}`)).toEqual([
      '/wiki/generals Bài Tướng',
      '/wiki/basic Bài cơ bản',
      '/wiki/tools Cẩm nang',
      '/wiki/equipment Trang bị',
    ]);
    expect(text(el)).toContain('Sát, Thiểm, Đào và Tửu');
    expect(text(el)).toContain('Vô Giải Khả Kích có thể hủy một Cẩm nang');
    expect(text(el)).toContain('một Chủ tướng và một Phó tướng');
  });

  it('turn: the six phases, and the cards named in the text', async () => {
    const { el } = await open('turn');
    expect([...el.querySelectorAll('th')].map(text)).toEqual(['Giai đoạn bắt đầu', 'Giai đoạn phán xét', 'Giai đoạn rút bài', 'Giai đoạn ra bài', 'Giai đoạn bỏ bài', 'Giai đoạn kết thúc']);
    expect(text(el)).toContain('một Sát mỗi lượt');
    expect(text(el)).toContain('Lạc Bất Tư Thục hoặc Binh Lương Thốn Đoạn');
  });

  it('judgment: the card names in the table headings', async () => {
    const { el } = await open('judgment');
    expect([...el.querySelectorAll('th')].map(text)).toEqual(['Lạc Bất Tư Thục', 'Binh Lương Thốn Đoạn', 'Thiểm Điện']);
  });

  it('no English card name is left on any rules page', async () => {
    for (const page of ['overview', 'card-types', 'setup', 'turn', 'distance', 'judgment']) {
      TestBed.resetTestingModule();
      const { el } = await open(page);
      expect(text(el)).not.toMatch(/\b(Slash|Dodge|Peach|Wine|Wuxie|Capture|Starvation|Lightning|Barbarians|Hail of Arrows|Steal|Force|Play Phase|Main General)\b/);
    }
  });

  it('a page follows a language switch', async () => {
    const { harness, el } = await open('setup');
    await TestBed.inject(I18n).setLocale('en');
    harness.detectChanges();
    expect(text(el.querySelector('h2'))).toBe('Setup');
    expect(text(el)).toContain('Every seat is dealt 7 Generals at a table of 2 to 8 seats, or 5 Generals at 9 to 12 seats.');
  });
});
