import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../app.routes';

// The English text and links of every rules page, pinned: the sentences live in
// the catalog now, and a typo there must not pass unseen.
describe('the rules pages in English', () => {
  beforeEach(() => localStorage.clear());

  it.each(['overview', 'card-types', 'setup', 'turn', 'distance', 'judgment'])('%s keeps its text and links', async (page) => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(`/wiki/rules/${page}`);
    await harness.fixture.whenStable();
    harness.detectChanges();
    const el = harness.routeNativeElement as HTMLElement;
    expect({
      text: [...el.querySelectorAll('h2, h3, p, li, th, td')].map((node) => node.textContent!.replace(/\s+/g, ' ').trim()),
      links: [...el.querySelectorAll('a')].map((a) => `${a.getAttribute('href')} ${a.textContent!.trim()}`),
    }).toMatchSnapshot();
  });
});
