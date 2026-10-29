import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../app.routes';
import { I18n } from '../i18n/i18n.service';
import { makeTranslator } from '../i18n/translator';
import { vi } from '../i18n/vi';
import { wikiCardTabs, wikiGeneralTabs } from 'content';
import { wikiPackLabel, wikiTabLabel } from './wiki-labels';

async function open(url: string) {
  localStorage.clear();
  TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
  await TestBed.inject(I18n).setLocale('vi');
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl(url);
  await harness.fixture.whenStable();
  harness.detectChanges();
  return harness.routeNativeElement as HTMLElement;
}

const text = (el: Element | null) => el!.textContent!.replace(/\s+/g, ' ').trim();
const tabLabels = (el: HTMLElement) => [...el.querySelectorAll('[role="tab"]')].map((t) => text(t));
const entry = (el: HTMLElement, id: string) => el.querySelector(`article.entry[data-id="${id}"]`) as HTMLElement;

describe('Wiki Cards in Vietnamese', () => {
  afterEach(() => localStorage.clear());

  it('the Generals page: heading, summary, kingdom tabs and a General in Vietnamese', async () => {
    const el = await open('/wiki/generals');
    expect(text(el.querySelector('h2'))).toBe('Tướng');
    expect(text(el.querySelector('.summary'))).toMatch(/^57 Tướng · \d+ đã có kỹ năng trong trò chơi$/);
    expect(tabLabels(el)).toEqual(['Ngụy (15)', 'Thục (15)', 'Ngô (15)', 'Quần (12)']);
    const caoCao = entry(el, 'cao-cao');
    expect(text(caoCao.querySelector('.name'))).toBe('Tào Tháo');
    expect(text(caoCao.querySelector('.kingdom-tag'))).toBe('Ngụy');
    expect(text(caoCao.querySelector('.expansion-tag'))).toBe('Tiêu chuẩn');
    expect(text(caoCao.querySelector('.gender-tag'))).toBe('Nam');
    expect(text(caoCao.querySelector('.skills'))).toContain('Gian hùng');
    expect(text(caoCao)).not.toContain('Cao Cao ');
  });

  it('the deck line and the skill states read in Vietnamese', async () => {
    const generals = await open('/wiki/identity/generals');
    expect(text(generals.querySelector('.deck-line'))).toBe('Bộ bài: Vương triều chiến');
    const states = [...entry(generals, 'cao-cao').querySelectorAll('.skill-status')].map((s) => text(s));
    expect(states).toEqual(['Không dùng trong Quốc chiến']);
  });

  it('the Kingdom Wars labels read in Vietnamese', async () => {
    const tools = await open('/wiki/kingdom-wars/tools');
    expect(text(tools.querySelector('.deck-line'))).toBe('Bộ bài: Quốc chiến');
    const ascertain = entry(tools, 'ascertain');
    expect(text(ascertain.querySelector('.badge'))).toBe('Đã có trong trò chơi');
  });

  it('the Kingdom Wars-only weapons read in Vietnamese', async () => {
    const equipment = await open('/wiki/kingdom-wars/equipment');
    expect(['trident-glaive', 'wu-six-swords'].map((id) => text(entry(equipment, id).querySelector('.name')))).toEqual(['Tam Tiêm Lưỡng Nhận Đao', 'Ngô Lục Kiếm']);
    expect(text(entry(equipment, 'fire-fan').querySelector('.badge'))).toBe('Đã có trong trò chơi');
  });

  it('the Kingdom Wars Basic page shows Slash’s rules text', async () => {
    const el = await open('/wiki/kingdom-wars/basic');
    expect(entry(el, 'sha').querySelector('.gap')).toBeNull();
    expect(text(entry(el, 'sha'))).toContain('Mỗi lượt bạn chỉ được dùng một Sát');
  });

  it('a Basic Cards page: heading, summary and a card in Vietnamese', async () => {
    const el = await open('/wiki/basic');
    expect(text(el.querySelector('h2'))).toBe('Bài cơ bản');
    expect(text(el.querySelector('.summary'))).toMatch(/^\d+ lá bài · \d+ đã có trong trò chơi$/);
    const sha = entry(el, 'sha');
    expect(text(sha.querySelector('.name'))).toBe('Sát');
    expect(text(sha.querySelector('.badge'))).toBe('Đã có trong trò chơi');
    expect(text(sha.querySelector('.printings'))).toMatch(/^\d+ lá: /);
  });

  it('the Equipment tabs and range', async () => {
    const el = await open('/wiki/equipment');
    expect(text(el.querySelector('h2'))).toBe('Trang bị');
    expect(tabLabels(el)[0]).toMatch(/^Vũ khí \(\d+\)$/);
    expect(tabLabels(el)[1]).toMatch(/^Giáp \(\d+\)$/);
    expect(el.querySelector('.range')!.textContent).toMatch(/^Tầm \d+$/);
  });

  it('the Tools tabs', async () => {
    const el = await open('/wiki/tools');
    expect(text(el.querySelector('h2'))).toBe('Cẩm nang');
    expect(tabLabels(el).map((t) => t.replace(/ \(\d+\)$/, ''))).toEqual(['Tức thời', 'Trì hoãn']);
  });

  it('a tab named after a card takes the card name, and an unknown tab keeps its label', () => {
    const tr = makeTranslator(vi, 'vi');
    expect(wikiTabLabel({ key: 'sha', label: 'Slash' }, tr)).toBe('Sát');
    expect(wikiTabLabel({ key: 'defensive-mount', label: 'Defensive Mount' }, tr)).toBe('Tọa kỵ thủ');
    expect(wikiTabLabel({ key: 'nonsense', label: 'Nonsense' }, tr)).toBe('Nonsense');
    expect(wikiTabLabel({ key: 'sha', label: 'Slash' }, makeTranslator(vi, 'en'))).toBe('Slash');
  });

  it('every tab the content library produces has a Vietnamese label', () => {
    const tr = makeTranslator(vi, 'vi');
    const tabs = [...wikiGeneralTabs(), ...wikiCardTabs('basic'), ...wikiCardTabs('equipment'), ...wikiCardTabs('tool')];
    for (const tab of tabs) expect(wikiTabLabel(tab, tr)).not.toBe(tab.label);
  });

  it('a pack names itself in Vietnamese, and an unknown pack keeps its raw name', () => {
    const tr = makeTranslator(vi, 'vi');
    expect(['Base', 'EX', 'Army', 'Wind', 'Fire', 'Forest', 'Mountain'].map((p) => wikiPackLabel(p, tr))).toEqual(['Tiêu chuẩn', 'EX', 'Quân tranh', 'Phong', 'Hỏa', 'Lâm', 'Sơn']);
    expect(wikiPackLabel('Shadow', tr)).toBe('Shadow');
  });

  it('re-renders in Vietnamese when the language is switched on the open page', async () => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
    const i18n = TestBed.inject(I18n);
    await i18n.setLocale('en');
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/wiki/generals');
    await harness.fixture.whenStable();
    const el = harness.routeNativeElement as HTMLElement;
    expect(text(el.querySelector('h2'))).toBe('Generals');
    await i18n.setLocale('vi');
    harness.detectChanges();
    expect(text(el.querySelector('h2'))).toBe('Tướng');
    expect(tabLabels(el)).toEqual(['Ngụy (15)', 'Thục (15)', 'Ngô (15)', 'Quần (12)']);
    expect(text(entry(el, 'cao-cao').querySelector('.name'))).toBe('Tào Tháo');
  });
});
