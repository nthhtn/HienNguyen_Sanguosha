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
  it('redirects /wiki to the Default Generals page', async () => {
    const { router } = await open('/wiki');
    expect(router.url).toBe('/wiki/default/generals');
  });

  it.each([
    ['/wiki/generals', '/wiki/default/generals'],
    ['/wiki/generals?tab=wu', '/wiki/default/generals?tab=wu'],
    ['/wiki/basic', '/wiki/default/basic'],
    ['/wiki/equipment', '/wiki/default/equipment'],
    ['/wiki/tools', '/wiki/default/tools'],
  ])('sends %s to %s', async (from, to) => {
    const { router } = await open(from);
    expect(router.url).toBe(to);
  });

  it.each(['/wiki/alternate/generals', '/wiki/alternate/basic', '/wiki/alternate/equipment', '/wiki/alternate/tools', '/wiki/default/generals', '/wiki/default/tools'])('keeps %s where it is', async (path) => {
    const { router } = await open(path);
    expect(router.url).toBe(path);
  });

  it('shows Generals in Wei, Shu, Wu and Qun tabs, opening on Wei', async () => {
    const { el } = await open('/wiki/generals');
    expect(el().querySelector('h2')!.textContent).toBe('Generals');
    expect(el().querySelector('.summary')!.textContent).toMatch(/57 generals · \d+ with skills in the game/);
    expect(tabLabels(el())).toEqual(['Wei (15)', 'Shu (15)', 'Wu (15)', 'Qun (12)']);
    expect(selectedTab(el())).toBe('Wei (15)');
    expect(el().querySelectorAll('app-wiki-general-entry')).toHaveLength(15);
  });

  it.each([
    ['/wiki/default/generals', 'Deck: Default'],
    ['/wiki/default/tools', 'Deck: Default'],
    ['/wiki/alternate/tools', 'Deck: Alternate'],
  ])('names the deck on %s', async (path, line) => {
    const { el } = await open(path);
    expect(el().querySelector('.deck-line')!.textContent!.trim()).toBe(line);
  });

  it('lists the six Alternate basic cards with their own copies', async () => {
    const { el } = await open('/wiki/alternate/basic');
    expect(el().querySelector('mat-tab-group')).toBeNull();
    expect(entryIds(el())).toEqual(['sha', 'fire-attack', 'lightning-attack', 'shan', 'wine', 'peach']);
    expect(el().querySelector('.summary')!.textContent).toBe('6 cards · 6 in the game');
    expect(el().querySelector('article.entry[data-id="sha"] .printings')!.textContent).toContain('21 copies');
    expect(el().querySelectorAll('.expansion-tag')).toHaveLength(0);
  });

  it('splits Alternate equipment into four tabs with nothing left over, and counts what the game cannot play', async () => {
    const { el } = await open('/wiki/alternate/equipment');
    expect(tabLabels(el())).toEqual(['Weapons (10)', 'Armors (4)', 'Defensive Mount (3)', 'Offensive Mount (3)']);
    expect(el().querySelector('.summary')!.textContent).toBe('20 cards · 20 in the game');
  });

  it('lists the 19 Alternate tools, all in the game', async () => {
    const { el } = await open('/wiki/alternate/tools');
    expect(tabLabels(el())).toEqual(['Instant (16)', 'Delayed (3)']);
    expect(el().querySelector('.summary')!.textContent).toBe('19 cards · 19 in the game');
    expect(el().querySelector('article.entry[data-id="wuxie-guo"] .badge')!.textContent!.trim()).toBe('In the game');
    expect(el().querySelector('article.entry[data-id="ascertain"] .badge')!.textContent!.trim()).toBe('In the game');
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
    expect(router.url).toBe('/wiki/default/tools?tab=delayed');
    expect(entryIds(el())).toEqual(['capture', 'lightning', 'starvation']);
  });

  it('each card route renders its own category', async () => {
    const { harness, el } = await open('/wiki/basic');
    expect(el().querySelector('h2')!.textContent).toBe('Basic Cards');
    await harness.navigateByUrl('/wiki/tools');
    await harness.fixture.whenStable();
    expect(el().querySelector('h2')!.textContent).toBe('Tools');
    expect(el().querySelector('.summary')!.textContent).toContain('15 cards · 15 in the game');
  });

  it('redirects /wiki/rules to the Overview page', async () => {
    const { router } = await open('/wiki/rules');
    expect(router.url).toBe('/wiki/rules/overview');
  });

  it.each([
    ['overview', 'Overview'],
    ['card-types', 'Card Types'],
    ['setup', 'Setup'],
    ['turn', 'Turn Structure'],
    ['distance', 'Distance / Range'],
    ['judgment', 'Judgment'],
  ])('renders the %s rules page', async (path, title) => {
    const { el } = await open(`/wiki/rules/${path}`);
    expect(el().querySelector('h2')!.textContent).toBe(title);
  });

  it('links each card type to its Wiki page, General Cards first', async () => {
    const { el } = await open('/wiki/rules/card-types');
    const hrefs = [...el().querySelectorAll('th > a')].map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['/wiki/generals', '/wiki/basic', '/wiki/tools', '/wiki/equipment']);
  });
});
