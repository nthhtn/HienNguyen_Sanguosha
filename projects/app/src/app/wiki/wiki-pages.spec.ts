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

  it('shows one tab per basic card', async () => {
    const { el } = await open('/wiki/basic');
    expect(tabLabels(el())).toEqual(['Sha (1)', 'Shan (1)', 'Wine (1)', 'Peach (1)']);
    expect(entryIds(el())).toEqual(['sha']);
  });

  it('opens the tab named in the URL (Review Focus 1)', async () => {
    const { el } = await open('/wiki/equipment?tab=minus-mount');
    expect(tabLabels(el())).toEqual(['Weapons (8)', 'Armors (1)', 'Plus Mount (3)', 'Minus Mount (3)']);
    expect(selectedTab(el())).toBe('Minus Mount (3)');
    expect(entryIds(el())).toEqual(['da-yuan', 'red-hare', 'zi-xing']);
  });

  it('falls back to the first tab for an unknown tab (Review Focus 2)', async () => {
    const { el } = await open('/wiki/equipment?tab=nope');
    expect(selectedTab(el())).toBe('Weapons (8)');
    expect(el().querySelectorAll('app-wiki-card-entry')).toHaveLength(8);
  });

  it('records the chosen tab in the URL', async () => {
    const { harness, el, router } = await open('/wiki/tools');
    expect(tabLabels(el())).toEqual(['Instant (10)', 'Delayed (2)']);
    (el().querySelectorAll('[role="tab"]')[1] as HTMLElement).click();
    await harness.fixture.whenStable();
    harness.fixture.detectChanges();
    expect(router.url).toBe('/wiki/tools?tab=delayed');
    expect(entryIds(el())).toEqual(['capture', 'lightning']);
  });

  it('each card route renders its own category', async () => {
    const { harness, el } = await open('/wiki/basic');
    expect(el().querySelector('h2')!.textContent).toBe('Basic Cards');
    await harness.navigateByUrl('/wiki/tools');
    await harness.fixture.whenStable();
    expect(el().querySelector('h2')!.textContent).toBe('Tools');
    expect(el().querySelector('.summary')!.textContent).toContain('12 cards · 2 in the game');
  });
});
