import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../app.routes';

async function open(url: string) {
  localStorage.clear();
  TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl(url);
  await harness.fixture.whenStable();
  harness.detectChanges();
  return harness.routeNativeElement as HTMLElement;
}

const text = (el: Element | null) => el!.textContent!.replace(/\s+/g, ' ').trim();
const tabLabels = (el: HTMLElement) => [...el.querySelectorAll('[role="tab"]')].map((t) => text(t));
const selectedTab = (el: HTMLElement) => text(el.querySelector('[role="tab"][aria-selected="true"]'));
const entryIds = (el: HTMLElement) => [...el.querySelectorAll('article.entry')].map((a) => a.getAttribute('data-id'));

describe('The Alternate Generals page', () => {
  afterEach(() => localStorage.clear());

  it('lists sixty Generals in four Kingdom tabs', async () => {
    const el = await open('/wiki/alternate/generals');
    expect(text(el.querySelector('h2'))).toBe('Generals');
    expect(text(el.querySelector('.deck-line'))).toBe('Deck: Kingdom Wars');
    expect(tabLabels(el)).toEqual(['Wei (15)', 'Shu (15)', 'Wu (15)', 'Qun (15)']);
    expect(entryIds(el)).toHaveLength(15);
  });

  it('counts the Generals and those with every skill working in the summary line', async () => {
    const el = await open('/wiki/alternate/generals');
    expect(text(el.querySelector('.summary'))).toMatch(/^60 Generals · \d+ with skills in the game$/);
  });

  it('opens a tab from the tab query parameter', async () => {
    const wu = await open('/wiki/alternate/generals?tab=wu');
    expect(selectedTab(wu)).toBe('Wu (15)');
    expect(entryIds(wu)).toContain('sun-quan');
  });

  it('opens the first tab for an unknown tab', async () => {
    const unknown = await open('/wiki/alternate/generals?tab=nowhere');
    expect(selectedTab(unknown)).toBe('Wei (15)');
  });

  it('shows the nine new Generals with their own art', async () => {
    const el = await open('/wiki/alternate/generals?tab=qun');
    expect(entryIds(el)).toContain('ji-ling');
    const ji = el.querySelector('article.entry[data-id="ji-ling"]')!;
    expect(ji.querySelector('.card-art-placeholder')).toBeNull();
    expect(ji.querySelector('app-card-art img')!.getAttribute('src')).toBe('/card-art/generals/skins/qun/jiling.png');
  });

  it('shows the page in Vietnamese', async () => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
    const { I18n } = await import('../i18n/i18n.service');
    await TestBed.inject(I18n).setLocale('vi');
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/wiki/alternate/generals');
    await harness.fixture.whenStable();
    harness.detectChanges();
    const el = harness.routeNativeElement as HTMLElement;
    expect(text(el.querySelector('h2'))).toBe('Tướng');
    expect(tabLabels(el)).toEqual(['Ngụy (15)', 'Thục (15)', 'Ngô (15)', 'Quần (15)']);
    expect(text(el.querySelector('.summary'))).toMatch(/^60 Tướng · \d+ đã có kỹ năng trong trò chơi$/);
    expect(text(el.querySelector('article.entry[data-id="cao-cao"] .name'))).toBe('Tào Tháo');
  });
});
