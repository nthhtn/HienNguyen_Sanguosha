import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { cardDisplayData, cardIds } from 'content';
import { routes } from '../../app.routes';
import { en } from '../../i18n/en';
import { I18n } from '../../i18n/i18n.service';
import type { MessageKey } from '../../i18n/messages';
import { vi } from '../../i18n/vi';
import { DISTANCE_EXAMPLE } from './distance-example';
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
      '/wiki/rules/allegiance': 'nav.rules.allegiance',
      '/wiki/rules/turn': 'nav.rules.turn',
      '/wiki/rules/card-types': 'nav.rules.cardTypes',
      '/wiki/rules/distance': 'nav.rules.distance',
      '/wiki/rules/response': 'nav.rules.response',
      '/wiki/rules/damage': 'nav.rules.damage',
      '/wiki/rules/chains': 'nav.rules.chains',
      '/wiki/rules/glossary': 'nav.rules.glossary',
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
    ['allegiance', 'Phe phái'],
    ['turn', 'Cấu trúc lượt'],
    ['distance', 'Khoảng cách / Tầm'],
    ['response', 'Cửa sổ phản hồi'],
    ['damage', 'Sát thương và hấp hối'],
    ['chains', 'Xích'],
    ['glossary', 'Thuật ngữ'],
    ['judgment', 'Phán xét'],
  ])('%s: the title', async (page, title) => {
    const { el } = await open(page);
    expect(text(el.querySelector('h2'))).toBe(title);
  });

  it('overview: the Forces, the link labels and the paths', async () => {
    const { el } = await open('overview');
    expect(text(el)).toContain('Ngụy, Thục, Ngô hoặc Quần');
    expect([...el.querySelectorAll('a')].map((a) => `${a.getAttribute('href')} ${text(a)}`)).toEqual([
      '/wiki/rules/allegiance Phe phái', // the Winning list's cap sentence
      '/wiki/rules/setup Chuẩn bị',
      '/wiki/rules/allegiance Phe phái',
      '/wiki/rules/turn Cấu trúc lượt',
      '/wiki/rules/card-types Loại bài',
      '/wiki/rules/distance Khoảng cách / Tầm',
      '/wiki/rules/response Cửa sổ phản hồi',
      '/wiki/rules/damage Sát thương và hấp hối',
      '/wiki/rules/judgment Phán xét',
      '/wiki/rules/chains Xích',
      '/wiki/rules/glossary Thuật ngữ',
      '/wiki/generals Tướng',
    ]);
  });

  it('overview: the Forces scene names Zhang Jiao for Qun', async () => {
    const { el } = await open('overview');
    expect([...el.querySelectorAll('figure')].map(text)).toEqual(['Ngụy Tào Tháo', 'Thục Lưu Bị', 'Ngô Tôn Quyền', 'Quần Trương Giác']);
  });

  it('overview: the Winning list ends with the cap, linking to the Allegiance page', async () => {
    const { el } = await open('overview');
    const items = [...el.querySelector('ul')!.querySelectorAll('li')];
    expect(items.length).toBe(4);
    expect(text(items[3])).toContain('đã đủ chỗ sẽ trở thành Dã tâm gia và chơi một mình');
    expect(items[3].querySelector('a')!.getAttribute('href')).toBe('/wiki/rules/allegiance');
  });

  it('allegiance: an Ambitionist seat has its mark, its own label and no Force', async () => {
    const { el } = await open('allegiance');
    const first = el.querySelector('app-scene')!;
    expect(first.querySelectorAll('img.scene-ambitionist').length).toBe(1);
    expect(text(first.querySelector('.seat[data-force="Ambitionist"]')!)).toContain('Dã tâm gia');
    expect(text(first.querySelector('.seat[data-force="Wei"]')!)).toContain('Ngụy');
    expect(text(first.querySelector('.seat[data-force="Ambitionist"]')!)).not.toContain('Ngụy');
  });

  it('allegiance: the cap example turns the fourth Wei seat into an Ambitionist and keeps a dead seat counted', async () => {
    const { el } = await open('allegiance');
    const scene = [...el.querySelectorAll('app-scene')].find((s) => s.querySelector('.cap') && text(s.querySelector('.cap')!) === 'Ví dụ: 6 người chơi, mức trần 3')!;
    const [one, two, three] = [...scene.querySelectorAll('ol.steps > li')];
    expect(one.querySelectorAll('.seat[data-force="Wei"]').length).toBe(3);
    expect(one.querySelectorAll('img.scene-ambitionist').length).toBe(0);
    expect(two.querySelectorAll('img.scene-ambitionist').length).toBe(1);
    expect(two.querySelectorAll('.seat[data-force="Wei"]').length).toBe(3);
    expect(three.querySelectorAll('.seat.out').length).toBe(1);
  });

  it('allegiance: killing an Ambitionist shows three drawn cards', async () => {
    const { el } = await open('allegiance');
    const scene = [...el.querySelectorAll('app-scene')].find((s) => s.querySelector('.cap') && text(s.querySelector('.cap')!) === 'Ví dụ: hạ gục một Dã tâm gia')!;
    expect([...scene.querySelectorAll('img.scene-card')].map((img) => img.getAttribute('alt'))).toEqual(['Mặt sau lá bài', 'Mặt sau lá bài', 'Mặt sau lá bài']);
    expect(scene.querySelectorAll('.seat.out').length).toBe(1);
  });

  it('allegiance: an Ambitionist counts as a Force of one and can be picked by a different-Force card', async () => {
    const { el } = await open('allegiance');
    expect(text(el)).toContain('được tính như một thế lực chỉ có một người');
    expect(text(el)).toContain('có thể chọn một Dã tâm gia');
    expect(text(el)).toContain('Một Dã tâm gia không liên minh với Dã tâm gia khác: mỗi người là một nhóm một người riêng');
    expect(text(el)).not.toContain('bỏ qua Dã tâm gia');
  });

  it('setup: the kill rewards point to Allegiance for Ambitionists', async () => {
    const { el } = await open('setup');
    const last = [...el.querySelectorAll('ul')].at(-1)!;
    expect(text(last.querySelector('li:last-child')!)).toContain('Dã tâm gia không thuộc thế lực nào');
    expect(last.querySelector('li:last-child a')!.getAttribute('href')).toBe('/wiki/rules/allegiance');
  });

  it('allegiance: the three outcomes are shown, the last with no Force named', async () => {
    const { el } = await open('allegiance');
    const boxes = [...el.querySelectorAll('.branch > div')];
    expect(boxes.map((b) => text(b.querySelector('h5')!))).toEqual(['Một thế lực thắng', 'Ván tiếp tục', 'Người sống sót cuối cùng thắng một mình']);
    expect(boxes[2].querySelectorAll('.seat[data-force="Ambitionist"]').length).toBe(1);
    expect(boxes[2].querySelectorAll('.seat[data-force="Wei"]').length).toBe(0);
  });

  it('overview: a win needs revealed Generals, and Quần wins together as a thế lực like the others', async () => {
    const { el } = await open('overview');
    expect(text(el)).toContain('đã lật Tướng và cùng chơi cho một thế lực');
    expect(text(el)).toContain('Nếu chỉ còn một người chơi, người đó thắng một mình');
    expect(text(el)).toContain('Quần là một thế lực như các thế lực khác: các người chơi Quần cùng thắng');
    expect(text(el)).not.toContain('không bao giờ thắng theo nhóm');
  });

  it('overview: the four beats and the who-wins example', async () => {
    const { el } = await open('overview');
    expect(el.querySelectorAll('ol.steps > li').length).toBe(4);
    expect(el.querySelectorAll('.seat.out').length).toBe(2);
    expect([...el.querySelectorAll('.cap')].map(text)).toEqual(['Bốn thế lực', 'Ví dụ: ai thắng']);
  });

  it('setup: the deal shows seven Generals, including a Qun one', async () => {
    const { el } = await open('setup');
    const alts = [...el.querySelector('ol.steps > li')!.querySelectorAll('img.scene-card')].map((img) => img.getAttribute('alt'));
    expect(alts.length).toBe(7);
    expect(alts).toContain('Trương Giác');
  });

  it('setup: the HP example rounds down to 3', async () => {
    const { el } = await open('setup');
    const step = el.querySelectorAll('ol.steps > li')[2];
    expect(step.querySelectorAll('app-scene-hp img:not(.lost)').length).toBe(3);
    expect(text(step)).toContain('3,5');
  });

  it('setup: both kill cases are shown', async () => {
    const { el } = await open('setup');
    expect([...el.querySelectorAll('.cap')].map(text)).toEqual(expect.arrayContaining(['Khác thế lực', 'Cùng thế lực']));
  });

  it('card types: the section headings link to the wiki pages, and the card names are Vietnamese', async () => {
    const { el } = await open('card-types');
    expect([...el.querySelectorAll('h3 > a')].map((a) => `${a.getAttribute('href')} ${text(a)}`)).toEqual([
      '/wiki/generals Bài Tướng',
      '/wiki/basic Bài cơ bản',
      '/wiki/tools Cẩm nang',
      '/wiki/equipment Trang bị',
    ]);
    expect(text(el)).toContain('Sát, Thiểm, Đào và Tửu');
    expect(text(el)).toContain('Vô Giải Khả Kích có thể hủy một Cẩm nang');
    expect(text(el)).toContain('một Chủ tướng và một Phó tướng');
  });

  it('card types: the General cards are named by their General names, never ids', async () => {
    const { el } = await open('card-types');
    const names = [...el.querySelectorAll('figure figcaption b')].map(text);
    expect(names.slice(0, 3)).toEqual(['Tào Tháo', 'Quan Vũ', 'Úp']);
    expect(text(el)).not.toMatch(/cao-cao|guan-yu/);
  });

  it('card types: Wine boosts the next Sát, the only attack the engine boosts', async () => {
    const { el } = await open('card-types');
    expect(text(el)).toContain('Sát kế tiếp của bạn gây thêm 1 sát thương');
  });

  it('card types: the equipment scene shows the four slots', async () => {
    const { el } = await open('card-types');
    expect([...el.querySelectorAll('figure .tag')].map(text)).toEqual(['Vũ khí', 'Giáp', 'Tọa kỵ công -1', 'Tọa kỵ thủ +1']);
  });

  it('card types: the Tools are split into instant and delayed, with their cards', async () => {
    const { el } = await open('card-types');
    const caps = [...el.querySelectorAll('.cap')].map(text);
    expect(caps).toEqual(expect.arrayContaining(['Cẩm nang tức thời: có hiệu lực ngay', 'Cẩm nang trì hoãn: đặt vào khu phán xét']));
    const delayed = [...el.querySelectorAll('app-scene')].find((s) => text(s.querySelector('.cap')!).startsWith('Cẩm nang trì hoãn'))!;
    expect([...delayed.querySelectorAll('img.scene-card')].map((img) => img.getAttribute('alt'))).toEqual(['Lạc Bất Tư Thục', 'Binh Lương Thốn Đoạn', 'Thiểm Điện']);
  });

  it('distance: the table scene shows the distances of the example', async () => {
    const { el } = await open('distance');
    const expected = DISTANCE_EXAMPLE.seats.filter((seat) => seat.distance !== undefined).map((seat) => String(seat.distance));
    expect([...el.querySelectorAll('.dbadge')].map(text)).toEqual(expected);
    expect([...el.querySelectorAll('button.spot:not([disabled])')].map((b) => b.getAttribute('aria-label'))).toEqual(['Người chơi 3, Khoảng cách 1, trong tầm', 'Người chơi 4, Khoảng cách 2, ngoài tầm', 'Người chơi 5, Khoảng cách 2, ngoài tầm', 'Người chơi 6, Khoảng cách 2, ngoài tầm']);
    expect(el.querySelectorAll('.ring .seat.out').length).toBe(1);
    expect(el.querySelectorAll('.ring .mount img.scene-card').length).toBe(1);
    expect(text(el.querySelector('.cap')!)).toBe('Thử xem: bạn là Người chơi 1');
  });

  it('response: Slash and Dodge show a play branch and a pass branch', async () => {
    const { el } = await open('response');
    const scene = el.querySelector('app-scene')!;
    expect([...scene.querySelectorAll('.branch > div h5')].map(text)).toEqual(['Đánh Thiểm', 'Bỏ qua']);
  });

  it('response: the Wuxie chain has four ordered steps and ends with the Tool taking effect', async () => {
    const { el } = await open('response');
    const scene = [...el.querySelectorAll('app-scene')].find((s) => s.querySelector('.cap') && text(s.querySelector('.cap')!) === 'Ví dụ: Quá Hà Sách Kiều và chuỗi Vô Giải Khả Kích')!;
    const steps = [...scene.querySelectorAll('ol.steps > li')];
    expect(steps.length).toBe(4);
    expect(steps[3].querySelector('img.scene-card')!.getAttribute('alt')).toBe('Quá Hà Sách Kiều');
    expect(text(steps[3])).toContain('có hiệu lực');
  });

  it('response: Barbarians shows three targets, one spared, and no missing-rule note', async () => {
    const { el } = await open('response');
    const scene = [...el.querySelectorAll('app-scene')].find((s) => s.querySelector('.cap') && text(s.querySelector('.cap')!) === 'Ví dụ: Nam Man Xâm Nhập')!;
    expect(scene.querySelectorAll('figure.target').length).toBe(3);
    expect([...scene.querySelectorAll('.pill.ok')].map(text)).toEqual(['Được cứu']);
    expect(el.querySelector('.note-pending')).toBeNull();
  });

  it('damage: the dying example needs two Peaches, one from each of two seats', async () => {
    const { el } = await open('damage');
    const scene = [...el.querySelectorAll('app-scene')].find((s) => s.querySelector('.cap') && text(s.querySelector('.cap')!) === 'Ví dụ: một người chơi ở -1 Sinh lực')!;
    const rescue = scene.querySelectorAll('ol.steps > li')[2];
    expect([...rescue.querySelectorAll('img.scene-card')].map((img) => img.getAttribute('alt'))).toEqual(['Đào', 'Đào']);
    expect([...rescue.querySelectorAll('.note')].map(text)).toEqual(['-1 Sinh lực', '0 Sinh lực', '1 Sinh lực']);
  });

  it('damage: the 2 damage in the dying example is explained by a Wine-boosted Sát', async () => {
    const { el } = await open('damage');
    const scene = [...el.querySelectorAll('app-scene')].find((s) => s.querySelector('.cap') && text(s.querySelector('.cap')!) === 'Ví dụ: một người chơi ở -1 Sinh lực')!;
    const first = scene.querySelector('ol.steps > li')!;
    expect([...first.querySelectorAll('img.scene-card')].map((img) => img.getAttribute('alt'))).toEqual(['Tửu', 'Sát']);
    expect(text(first)).toContain('được Tửu tăng sức mạnh');
  });

  it('damage: Wine and Slash show 2 damage', async () => {
    const { el } = await open('damage');
    const scene = [...el.querySelectorAll('app-scene')].find((s) => s.querySelector('.cap') && text(s.querySelector('.cap')!) === 'Ví dụ: 2 sát thương')!;
    expect([...scene.querySelectorAll('img.scene-card')].map((img) => img.getAttribute('alt'))).toEqual(['Tửu', 'Sát']);
  });

  it('damage: three kinds of damage, each with its cards', async () => {
    const { el } = await open('damage');
    expect([...el.querySelectorAll('figure.kind figcaption b')].map(text)).toEqual(['Thường', 'Lửa', 'Sét']);
    expect([...el.querySelectorAll('figure.kind img.scene-card')].map((img) => img.getAttribute('alt'))).toEqual(['Sát', 'Hỏa Sát', 'Lôi Sát']);
  });

  it('damage: both ways a dying round can end are shown', async () => {
    const { el } = await open('damage');
    expect([...el.querySelectorAll('.branch > div h5')].map(text)).toEqual(['Trở lại trên 0 Sinh lực', 'Không ai cứu']);
  });

  it('damage: points to the Chains page where fire and thunder matter, and to Setup for the kill reward', async () => {
    const { el } = await open('damage');
    expect([...el.querySelectorAll('a')].map((a) => `${a.getAttribute('href')} ${text(a)}`)).toEqual(['/wiki/rules/chains Xích', '/wiki/rules/setup Chuẩn bị']);
  });

  it('chains: chaining toggles a seat, with exactly one chained badge in the first scene', async () => {
    const { el } = await open('chains');
    const first = el.querySelector('app-scene')!;
    expect(first.querySelectorAll('img.scene-chain').length).toBe(1);
    expect(first.querySelectorAll('app-scene-seat').length).toBe(2);
  });

  it('chains: the wave example hits the two seats after the damaged one, in turn order, and unchains them', async () => {
    const { el } = await open('chains');
    const scene = [...el.querySelectorAll('app-scene')].find((s) => s.querySelector('.cap') && text(s.querySelector('.cap')!) === 'Ví dụ: 1 sát thương lửa lên Người chơi 2')!;
    const [start, damaged, wave] = [...scene.querySelectorAll('ol.steps > li')];
    expect([...start.querySelectorAll('.nm')].map(text)).toEqual(['Người chơi 2', 'Người chơi 3', 'Người chơi 5']);
    expect(start.querySelectorAll('img.scene-chain').length).toBe(3);
    expect(damaged.querySelectorAll('img.scene-chain').length).toBe(2);
    expect([...damaged.querySelectorAll('.note')].map(text)).toEqual(['3 Sinh lực', '4 Sinh lực', '4 Sinh lực']);
    expect([...wave.querySelectorAll('.note')].map(text)).toEqual(['3 Sinh lực', '3 Sinh lực', '3 Sinh lực']);
    expect([...wave.querySelectorAll('.nm')].map(text)).toEqual(['Người chơi 2', 'Người chơi 3', 'Người chơi 5']);
    expect(wave.querySelectorAll('img.scene-mark').length).toBe(2);
    expect(wave.querySelectorAll('img.scene-chain').length).toBe(0);
  });

  it('chains: says plain damage never travels, and that a wave does not start a wave', async () => {
    const { el } = await open('chains');
    expect(text(el)).toContain('Sát thương thường thì không bao giờ');
    expect(text(el)).toContain('không tự khởi động thêm một làn sóng');
  });

  it('glossary: twelve terms, each with a picture and a definition', async () => {
    const { el } = await open('glossary');
    const entries = [...el.querySelectorAll('.entry')];
    expect(entries.length).toBe(12);
    for (const entry of entries) {
      expect(entry.querySelectorAll('img').length).toBeGreaterThan(0);
      expect(text(entry.querySelector('dt')!)).not.toBe('');
      expect(text(entry.querySelector('dd')!)).not.toBe('');
    }
  });

  it('glossary: the Vietnamese terms follow the agreed wording', async () => {
    const { el } = await open('glossary');
    expect([...el.querySelectorAll('dt')].map(text)).toEqual(['Thế lực', 'Sinh lực', 'Chủ tướng', 'Phó tướng', 'Tướng ẩn', 'Bị xích', 'Khu phán xét', 'Phản hồi', 'Tọa kỵ', 'Tầm tấn công', 'Hấp hối', 'Chồng bài rút']);
  });

  it('glossary: definitions link to the pages they summarise, labelled as the pages are named', async () => {
    const { el } = await open('glossary');
    expect([...el.querySelectorAll('a')].map((a) => `${a.getAttribute('href')} ${text(a)}`)).toEqual([
      '/wiki/rules/chains Xích',
      '/wiki/rules/judgment Phán xét',
      '/wiki/rules/response Cửa sổ phản hồi',
      '/wiki/rules/distance Khoảng cách / Tầm',
      '/wiki/rules/distance Khoảng cách / Tầm',
      '/wiki/rules/damage Sát thương và hấp hối',
    ]);
  });

  it('turn: six phases in order, only the Play Phase marked as waiting', async () => {
    const { el } = await open('turn');
    expect([...el.querySelectorAll('.phase h4')].map(text)).toEqual(['Giai đoạn bắt đầu', 'Giai đoạn phán xét', 'Giai đoạn rút bài', 'Giai đoạn ra bài', 'Giai đoạn bỏ bài', 'Giai đoạn kết thúc']);
    expect([...el.querySelectorAll('.phase')].map((tile) => tile.classList.contains('waits'))).toEqual([false, false, false, true, false, false]);
  });

  it('turn: the cards named in the text', async () => {
    const { el } = await open('turn');
    expect(text(el)).toContain('một Sát mỗi lượt');
    expect(text(el)).toContain('Lạc Bất Tư Thục hoặc Binh Lương Thốn Đoạn');
  });

  it('turn: the Discard Phase example keeps 4 cards and discards 2', async () => {
    const { el } = await open('turn');
    const scene = [...el.querySelectorAll('app-scene')].find((s) => text(s.querySelector('.cap')!) === 'Ví dụ: 6 lá bài, 4 Sinh lực')!;
    expect(scene.querySelectorAll('img.scene-card').length).toBe(6);
    expect(scene.querySelectorAll('img.scene-card.dim').length).toBe(2);
  });

  it('turn: the Play Phase example follows one Sát and the heal', async () => {
    const { el } = await open('turn');
    const scene = [...el.querySelectorAll('app-scene')].find((s) => text(s.querySelector('.cap')!) === 'Ví dụ: một giai đoạn ra bài ở 3 Sinh lực')!;
    expect(scene.querySelectorAll('ol.steps > li').length).toBe(3);
  });

  it('turn: turns pass counter-clockwise', async () => {
    const { el } = await open('turn');
    expect(text(el)).toContain('ngược chiều kim đồng hồ');
    expect(text(el)).not.toMatch(/theo chiều kim đồng hồ/);
  });

  it('judgment: one scene per Delayed Tool, with its card and two outcomes', async () => {
    const { el } = await open('judgment');
    const scenes = [...el.querySelectorAll('app-scene')];
    expect(scenes.map((scene) => text(scene.querySelector('h4')!))).toEqual(['Lạc Bất Tư Thục', 'Binh Lương Thốn Đoạn', 'Thiểm Điện']);
    for (const scene of scenes) {
      expect(scene.querySelectorAll('img.scene-card').length).toBe(1);
      expect(scene.querySelectorAll('.branch > div').length).toBe(2);
    }
  });

  it('judgment: each suit and rank is coloured as on a playing card, hearts and diamonds red, spades and clubs black', async () => {
    const { el } = await open('judgment');
    const faces = [...el.querySelectorAll('.pill.face')];
    expect(faces.map(text)).toEqual(['9 ♥', 'K ♠', '4 ♣', 'Q ♦', '5 ♠', 'J ♠']);
    for (const face of faces) expect([text(face), face.classList.contains('red')]).toEqual([text(face), /[♥♦]/.test(text(face))]);
    expect(el.querySelectorAll('.pill.ok, .pill.bad').length).toBe(0);
  });

  it('judgment: the four steps are ordered, and the missing example is said to be missing', async () => {
    const { el } = await open('judgment');
    expect(el.querySelectorAll('ol.steps > li').length).toBe(4);
    expect(text(el.querySelector('.note-pending')!)).toBe('Chưa viết: một ví dụ về kỹ năng của Tướng đổi phán xét.');
  });

  it('no English card name is left on any rules page', async () => {
    for (const page of ['overview', 'card-types', 'setup', 'allegiance', 'turn', 'distance', 'response', 'damage', 'judgment', 'chains', 'glossary']) {
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
