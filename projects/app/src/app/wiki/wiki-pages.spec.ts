import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../app.routes';

async function open(url: string): Promise<{ harness: RouterTestingHarness; el: () => HTMLElement; router: Router }> {
  TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl(url);
  return { harness, el: () => harness.routeNativeElement as HTMLElement, router: TestBed.inject(Router) };
}

const groupTitles = (el: HTMLElement) => [...el.querySelectorAll('.group-title')].map((h) => h.textContent!.trim());

describe('Wiki pages', () => {
  it('redirects /wiki to the Generals page', async () => {
    const { router } = await open('/wiki');
    expect(router.url).toBe('/wiki/generals');
  });

  it('lists the 26 generals in four kingdom sections', async () => {
    const page = (await open('/wiki/generals')).el();
    expect(page.querySelector('h2')!.textContent).toBe('Generals');
    expect(page.querySelector('.summary')!.textContent).toContain('26 generals · 6 with skills in the game');
    expect(groupTitles(page)).toEqual(['Wei', 'Shu', 'Wu', 'Qun']);
    expect(page.querySelectorAll('app-wiki-general-entry')).toHaveLength(26);
  });

  it('splits Equipments into Weapons, Armor and Horses', async () => {
    const page = (await open('/wiki/equipment')).el();
    expect(page.querySelector('h2')!.textContent).toBe('Equipments');
    expect(page.querySelector('.summary')!.textContent).toContain('15 cards · 1 in the game');
    expect(groupTitles(page)).toEqual(['Weapons', 'Armor', 'Horses']);
    expect(page.querySelectorAll('app-wiki-card-entry')).toHaveLength(15);
  });

  it('each card route renders its own category (Review Focus 3)', async () => {
    const { harness, el } = await open('/wiki/basic');
    expect(el().querySelector('h2')!.textContent).toBe('Basic Cards');
    expect(el().querySelectorAll('app-wiki-card-entry')).toHaveLength(3);
    expect(groupTitles(el())).toEqual([]);

    // Same harness: moving Basic -> Tools must not reuse the Basic page.
    await harness.navigateByUrl('/wiki/tools');
    expect(el().querySelector('h2')!.textContent).toBe('Tools');
    expect(el().querySelector('.summary')!.textContent).toContain('12 cards · 2 in the game');
    expect(el().querySelectorAll('app-wiki-card-entry')).toHaveLength(12);
  });
});
