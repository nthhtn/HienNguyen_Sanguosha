import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../app.routes';
import { I18n } from '../i18n/i18n.service';
import { makeTranslator } from '../i18n/translator';
import { vi } from '../i18n/vi';
import { wikiTabLabel } from './wiki-labels';

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
    expect(text(el.querySelector('.summary'))).toMatch(/^57 Tướng · \d+ đã có kỹ năng trong game$/);
    expect(tabLabels(el)).toEqual(['Ngụy (15)', 'Thục (15)', 'Ngô (15)', 'Quần (12)']);
    const caoCao = entry(el, 'cao-cao');
    expect(text(caoCao.querySelector('.name'))).toBe('Tào Tháo');
    expect(text(caoCao.querySelector('.kingdom-tag'))).toBe('Ngụy');
    expect(text(caoCao.querySelector('.expansion-tag'))).toBe('Cơ bản');
    expect(text(caoCao.querySelector('.gender-tag'))).toBe('Nam');
    expect(text(caoCao.querySelector('.skills'))).toContain('Gian hùng');
    expect(text(caoCao)).not.toContain('Cao Cao ');
  });

  it('a Basic Cards page: heading, summary and a card in Vietnamese', async () => {
    const el = await open('/wiki/basic');
    expect(text(el.querySelector('h2'))).toBe('Bài cơ bản');
    expect(text(el.querySelector('.summary'))).toMatch(/^\d+ lá bài · \d+ đã có trong game$/);
    const sha = entry(el, 'sha');
    expect(text(sha.querySelector('.name'))).toBe('Sát');
    expect(text(sha.querySelector('.badge'))).toBe('Đã có trong game');
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
    expect(wikiTabLabel({ key: 'sha', label: 'Sha' }, tr)).toBe('Sát');
    expect(wikiTabLabel({ key: 'defensive-mount', label: 'Defensive Mount' }, tr)).toBe('Tọa kỵ thủ');
    expect(wikiTabLabel({ key: 'nonsense', label: 'Nonsense' }, tr)).toBe('Nonsense');
    expect(wikiTabLabel({ key: 'sha', label: 'Sha' }, makeTranslator(vi, 'en'))).toBe('Sha');
  });
});
