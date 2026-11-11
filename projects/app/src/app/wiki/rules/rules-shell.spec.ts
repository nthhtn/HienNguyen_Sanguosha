import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../app.routes';

describe('the Rules shell', () => {
  beforeEach(() => localStorage.clear());

  const open = async (url: string) => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    await harness.fixture.whenStable();
    harness.detectChanges();
    return harness.routeNativeElement as HTMLElement;
  };

  it('opens the Overview by default', async () => {
    const el = await open('/wiki/rules');
    expect(el.querySelector('.rules-page h2')!.textContent).toContain('Overview');
  });

  it('lists every topic on the left and marks the current one', async () => {
    const el = await open('/wiki/rules/turn');
    const links = [...el.querySelectorAll('.rules-index a')] as HTMLAnchorElement[];
    expect(links.map((a) => a.getAttribute('href'))).toHaveLength(6);
    expect(links.filter((a) => a.getAttribute('aria-current') === 'page').map((a) => a.getAttribute('href'))).toEqual(['/wiki/rules/turn']);
  });

  it('holds its topics as sections, with a list of them at the top', async () => {
    const el = await open('/wiki/rules/attack');
    expect([...el.querySelectorAll('.rules-page section')].map((section) => section.id)).toEqual(['distance', 'response', 'damage']);
    expect([...el.querySelectorAll('app-rules-contents a')].map((a) => a.textContent!.trim())).toEqual(['Distance / Range', 'Response Windows', 'Damage and Dying']);
  });

  it.each([
    ['allegiance', '/wiki/rules/setup#allegiance'],
    ['card-types', '/wiki/rules/turn#card-types'],
    ['distance', '/wiki/rules/attack#distance'],
    ['response', '/wiki/rules/attack#response'],
    ['damage', '/wiki/rules/attack#damage'],
    ['chains', '/wiki/rules/judgment#chains'],
  ])('sends the old %s address to its section', async (page, target) => {
    await open(`/wiki/rules/${page}`);
    expect(TestBed.inject(Router).url).toBe(target);
  });
});
