import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { App } from './app';
import { MUSIC_PLAYER_FACTORY } from './music.service';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        // jsdom can't play media; a silent stand-in player.
        { provide: MUSIC_PLAYER_FACTORY, useValue: () => ({ loop: false, volume: 1, play: () => Promise.resolve(), pause: () => undefined }) },
        provideRouter([
          { path: 'setup', children: [] },
          { path: 'game', children: [] },
          { path: 'play', children: [] },
          { path: 'wiki/:page', children: [] },
        ]),
      ],
    }).compileComponents();
  });

  afterEach(() => (document.querySelector('.cdk-overlay-container') as HTMLElement | null)?.replaceChildren());

  async function render(url = '/setup') {
    const fixture = TestBed.createComponent(App);
    await TestBed.inject(Router).navigateByUrl(url);
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('has a music on/off button in the toolbar', async () => {
    localStorage.clear();
    const { fixture, el } = await render();
    const button = el.querySelector('button.music-toggle') as HTMLButtonElement;
    expect(button.getAttribute('aria-label')).toBe('Turn Music Off');
    button.click();
    fixture.detectChanges();
    expect(button.getAttribute('aria-label')).toBe('Turn Music On');
    expect(button.textContent).toContain('music_off');
    localStorage.clear();
  });

  it('should render title', async () => {
    const { el } = await render();
    expect(el.querySelector('mat-toolbar h1')?.textContent).toContain('Kingdom War');
  });

  it('links Play Game to /play, highlighted on the play screens', async () => {
    const { el, fixture } = await render('/setup');
    const play = el.querySelector('a.nav-play') as HTMLAnchorElement;
    expect(play.getAttribute('href')).toBe('/play');
    expect(play.classList).toContain('active');
    await TestBed.inject(Router).navigateByUrl('/wiki/generals');
    fixture.detectChanges();
    expect(play.classList).not.toContain('active');
    expect(el.querySelector('a[href="/wiki/generals"]')!.classList).toContain('active');
  });

  it('has a Wiki-icon item for each of the four pages, side by side in the bar', async () => {
    const { el } = await render();
    const items = [...el.querySelectorAll('nav.nav a.nav-wiki')] as HTMLAnchorElement[];
    expect(items.map((a) => [a.querySelector('.label')!.textContent, a.getAttribute('href')])).toEqual([
      ['Generals', '/wiki/generals'],
      ['Basic Cards', '/wiki/basic'],
      ['Equipment', '/wiki/equipment'],
      ['Tools', '/wiki/tools'],
    ]);
    expect(items.map((a) => a.querySelector('mat-icon')!.textContent)).toEqual(['sports_kabaddi', 'umbrella', 'swords', 'menu_book']);
  });

  it('sits on the left, straight after the title, with no side panel', async () => {
    const { el } = await render();
    const title = el.querySelector('mat-toolbar h1')!;
    expect(title.nextElementSibling!.matches('nav.nav')).toBe(true);
    expect(el.querySelector('aside.side-nav')).toBeNull();
    expect(el.querySelector('button.nav-toggle')).toBeNull();
  });

  it('marks the current page for screen readers', async () => {
    const { el, fixture } = await render('/setup');
    expect(el.querySelector('a.nav-play')!.getAttribute('aria-current')).toBe('page');
    await TestBed.inject(Router).navigateByUrl('/wiki/basic');
    fixture.detectChanges();
    expect(el.querySelector('a.nav-play')!.getAttribute('aria-current')).toBeNull();
    const current = [...el.querySelectorAll('nav.nav a.nav-wiki[aria-current="page"]')];
    expect(current.map((a) => a.textContent!.trim())).toEqual(['umbrellaBasic Cards']);
  });

  it('icon buttons have accessible names (Review Focus 4)', async () => {
    const { el } = await render();
    expect(el.querySelector('a.nav-play')!.getAttribute('aria-label')).toBe('Play Game');
    expect(el.querySelector('a.nav-wiki')!.getAttribute('aria-label')).toBe('Generals');
  });
});
