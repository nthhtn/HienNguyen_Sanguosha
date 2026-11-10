import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
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
    expect(links.map((a) => a.getAttribute('href'))).toHaveLength(11);
    expect(links.filter((a) => a.getAttribute('aria-current') === 'page').map((a) => a.getAttribute('href'))).toEqual(['/wiki/rules/turn']);
  });
});
