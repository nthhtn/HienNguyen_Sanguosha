import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../app.routes';
import { ArtSets } from '../art-sets.service';
import { provideFakeArtSets } from '../art-sets.testing';

async function open(url: string) {
  localStorage.clear();
  TestBed.configureTestingModule({ providers: [provideRouter(routes), ...provideFakeArtSets()] });
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl(url);
  await harness.fixture.whenStable();
  const el = () => harness.routeNativeElement as HTMLElement;
  return { harness, el };
}

const tabLabels = (el: HTMLElement) => [...el.querySelectorAll('[role="tab"]')].map((t) => t.textContent!.trim());
const selectedTab = (el: HTMLElement) => el.querySelector('[role="tab"][aria-selected="true"]')!.textContent!.trim();

describe('The Art Sets page', () => {
  afterEach(() => localStorage.clear());

  it('has the title, an intro and the By Set and By General tabs, By Set first', async () => {
    const { el } = await open('/wiki/art-sets');
    expect(el().querySelector('h2')!.textContent).toContain('Art Sets');
    expect(tabLabels(el())).toEqual(['By Set', 'By General']);
    expect(selectedTab(el())).toBe('By Set');
    expect(el().querySelector('section.set')).not.toBeNull();
  });

  it('opens on the tab named in the address, and falls back to By Set for a bad one', async () => {
    expect(selectedTab((await open('/wiki/art-sets?tab=generals')).el())).toBe('By General');
    TestBed.resetTestingModule();
    expect(selectedTab((await open('/wiki/art-sets?tab=bogus')).el())).toBe('By Set');
  });

  it('follows a change made through ArtSets, as the picker makes it', async () => {
    const { harness, el } = await open('/wiki/art-sets');
    TestBed.inject(ArtSets).selectGlobal('ink');
    harness.fixture.detectChanges();
    const use = el().querySelector('section.set[data-set="ink"] button.use')!;
    expect(use.textContent!.trim()).toBe('In Use');
  });
});
