import { BreakpointObserver } from '@angular/cdk/layout';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { App } from './app';

function setup(wide: boolean) {
  TestBed.configureTestingModule({
    imports: [App],
    providers: [
      provideRouter([
        { path: 'setup', children: [] },
        { path: 'game', children: [] },
        { path: 'play', children: [] },
        { path: 'wiki/:page', children: [] },
      ]),
      {
        provide: BreakpointObserver,
        useValue: { observe: () => of({ matches: wide, breakpoints: {} }), isMatched: () => wide },
      },
    ],
  });
}

async function render(url = '/setup') {
  const fixture = TestBed.createComponent(App);
  await TestBed.inject(Router).navigateByUrl(url);
  fixture.detectChanges();
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const refresh = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
  };
  return { fixture, el, refresh };
}

const nav = (el: HTMLElement) => el.querySelector('aside.side-nav') as HTMLElement;
const subLinks = (el: HTMLElement) => [...el.querySelectorAll('a.nav-sub')] as HTMLAnchorElement[];

describe('App shell', () => {
  describe('on a wide screen', () => {
    beforeEach(() => setup(true));

    it('shows the title and an always-open side panel with no menu button', async () => {
      const { el } = await render();
      expect(el.querySelector('mat-toolbar h1')!.textContent).toContain('Kingdom War');
      expect(nav(el).classList).toContain('open');
      expect(el.querySelector('button.nav-toggle')).toBeNull();
      expect(nav(el).hasAttribute('inert')).toBe(false);
    });

    it('links Play Game to /play and the Wiki group to its four pages', async () => {
      const { el } = await render();
      expect(el.querySelector('a.nav-play')!.getAttribute('href')).toBe('/play');
      expect(subLinks(el).map((a) => [a.textContent!.trim(), a.getAttribute('href')])).toEqual([
        ['Generals', '/wiki/generals'],
        ['Basic Cards', '/wiki/basic'],
        ['Equipments', '/wiki/equipment'],
        ['Tools', '/wiki/tools'],
      ]);
    });

    it('marks the current page', async () => {
      const { el } = await render('/setup');
      expect(el.querySelector('a.nav-play')!.getAttribute('aria-current')).toBe('page');
      const wiki = await render('/wiki/basic');
      expect(wiki.el.querySelector('a.nav-play')!.getAttribute('aria-current')).toBeNull();
      expect(subLinks(wiki.el).find((a) => a.textContent!.trim() === 'Basic Cards')!.getAttribute('aria-current')).toBe('page');
    });

    it('collapses and expands the Wiki group', async () => {
      const { el, refresh } = await render();
      const wiki = el.querySelector('button.nav-wiki') as HTMLButtonElement;
      expect(wiki.getAttribute('aria-expanded')).toBe('true');
      wiki.click();
      await refresh();
      expect(wiki.getAttribute('aria-expanded')).toBe('false');
      expect(subLinks(el)).toHaveLength(0);
    });
  });

  describe('on a narrow screen (Review Focus 3)', () => {
    beforeEach(() => setup(false));

    it('hides the panel behind a menu button', async () => {
      const { el } = await render();
      const toggle = el.querySelector('button.nav-toggle')!;
      expect(toggle.getAttribute('aria-label')).toBe('Open navigation');
      expect(nav(el).classList).not.toContain('open');
      expect(nav(el).hasAttribute('inert')).toBe(true);
    });

    it('opens the drawer, and a link closes it', async () => {
      const { el, refresh } = await render();
      (el.querySelector('button.nav-toggle') as HTMLButtonElement).click();
      await refresh();
      expect(nav(el).classList).toContain('open');
      expect(nav(el).hasAttribute('inert')).toBe(false);
      expect(el.querySelector('.nav-backdrop')).not.toBeNull();
      subLinks(el)[3].click();
      await refresh();
      expect(nav(el).classList).not.toContain('open');
      expect(el.querySelector('.nav-backdrop')).toBeNull();
    });

    it('closes the drawer from the backdrop and from Escape', async () => {
      const { el, refresh } = await render();
      (el.querySelector('button.nav-toggle') as HTMLButtonElement).click();
      await refresh();
      (el.querySelector('.nav-backdrop') as HTMLElement).click();
      await refresh();
      expect(nav(el).classList).not.toContain('open');

      (el.querySelector('button.nav-toggle') as HTMLButtonElement).click();
      await refresh();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      await refresh();
      expect(nav(el).classList).not.toContain('open');
    });
  });
});
