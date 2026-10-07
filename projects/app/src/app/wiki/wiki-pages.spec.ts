import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../app.routes';

async function open(url: string) {
  TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl(url);
  await harness.fixture.whenStable();
  const el = () => harness.routeNativeElement as HTMLElement;
  return { harness, el, router: TestBed.inject(Router) };
}

const tabLabels = (el: HTMLElement) => [...el.querySelectorAll('[role="tab"]')].map((t) => t.textContent!.trim());
const selectedTab = (el: HTMLElement) => el.querySelector('[role="tab"][aria-selected="true"]')!.textContent!.trim();
const entryIds = (el: HTMLElement) => [...el.querySelectorAll('article.entry')].map((a) => a.getAttribute('data-id'));

describe('Wiki pages', () => {
  it('redirects /wiki to the Generals page', async () => {
    const { router } = await open('/wiki');
    expect(router.url).toBe('/wiki/generals');
  });

  it('shows Generals in Wei, Shu, Wu and Qun tabs, opening on Wei', async () => {
    const { el } = await open('/wiki/generals');
    expect(el().querySelector('h2')!.textContent).toBe('Generals');
    expect(el().querySelector('.summary')!.textContent).toContain('57 generals · 5 with skills in the game');
    expect(tabLabels(el())).toEqual(['Wei (15)', 'Shu (15)', 'Wu (15)', 'Qun (12)']);
    expect(selectedTab(el())).toBe('Wei (15)');
    expect(el().querySelectorAll('app-wiki-general-entry')).toHaveLength(15);
  });

  it('lists all six basic cards together, with no tabs', async () => {
    const { el } = await open('/wiki/basic');
    expect(el().querySelector('mat-tab-group')).toBeNull();
    expect(entryIds(el())).toEqual(['sha', 'fire-attack', 'lightning-attack', 'shan', 'wine', 'peach']);
  });

  it.each(['/wiki/equipment', '/wiki/tools'])('tags each card on %s with Base or its expansion pack', async (path) => {
    const { el } = await open(path);
    const tags = [...el().querySelectorAll('.expansion-tag')].map((t) => t.textContent!.trim());
    expect(tags.length).toBeGreaterThan(0);
    expect(tags.every((t) => ['Base', 'EX', 'Army'].includes(t))).toBe(true);
  });

  it('opens the tab named in the URL (Review Focus 1)', async () => {
    const { el } = await open('/wiki/equipment?tab=offensive-mount');
    expect(tabLabels(el())).toEqual(['Weapons (11)', 'Armors (4)', 'Defensive Mount (4)', 'Offensive Mount (3)']);
    expect(selectedTab(el())).toBe('Offensive Mount (3)');
    expect(entryIds(el())).toEqual(['da-yuan', 'red-hare', 'zi-xing']);
  });

  it('falls back to the first tab for an unknown tab (Review Focus 2)', async () => {
    const { el } = await open('/wiki/equipment?tab=nope');
    expect(selectedTab(el())).toBe('Weapons (11)');
    expect(el().querySelectorAll('app-wiki-card-entry')).toHaveLength(11);
  });

  it('records the chosen tab in the URL', async () => {
    const { harness, el, router } = await open('/wiki/tools');
    expect(tabLabels(el())).toEqual(['Instant (12)', 'Delayed (3)']);
    (el().querySelectorAll('[role="tab"]')[1] as HTMLElement).click();
    await harness.fixture.whenStable();
    harness.fixture.detectChanges();
    expect(router.url).toBe('/wiki/tools?tab=delayed');
    expect(entryIds(el())).toEqual(['capture', 'lightning', 'starvation']);
  });

  it('each card route renders its own category', async () => {
    const { harness, el } = await open('/wiki/basic');
    expect(el().querySelector('h2')!.textContent).toBe('Basic Cards');
    await harness.navigateByUrl('/wiki/tools');
    await harness.fixture.whenStable();
    expect(el().querySelector('h2')!.textContent).toBe('Tools');
    expect(el().querySelector('.summary')!.textContent).toContain('15 cards · 13 in the game');
  });
});
