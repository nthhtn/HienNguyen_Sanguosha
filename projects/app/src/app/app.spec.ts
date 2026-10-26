import { BattlefieldBackgrounds } from './battlefield-background.service';
import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import type { Me } from 'protocol';
import { App } from './app';
import { AuthService } from './auth/auth.service';
import { MUSIC_PLAYER_FACTORY } from './music.service';

const me = signal<Me | null>(null);
const loaded = signal(true);
const fakeAuth = {
  me,
  loaded,
  isRegistered: computed(() => me()?.kind === 'registered'),
  load: jest.fn(async () => me()),
  signOut: jest.fn(async () => me.set(null)),
};

describe('App', () => {
  beforeEach(async () => {
    me.set(null);
    loaded.set(true);
    fakeAuth.signOut.mockClear();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        { provide: AuthService, useValue: fakeAuth },
        // jsdom can't play media; a silent stand-in player.
        { provide: MUSIC_PLAYER_FACTORY, useValue: () => ({ loop: false, volume: 1, play: () => Promise.resolve(), pause: () => undefined }) },
        provideRouter([
          { path: 'setup', children: [] },
          { path: 'game', children: [] },
          { path: 'play', children: [] },
          { path: 'rooms', children: [] },
          { path: 'my-games', children: [] },
          { path: 'sign-in', children: [] },
          { path: 'sign-up', children: [] },
          { path: 'wiki/default/:page', children: [] },
          { path: 'wiki/alternate/:page', children: [] },
          { path: 'wiki/rules/:page', children: [] },
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

  it('has a separate sound effects on/off button in the toolbar', async () => {
    localStorage.clear();
    const { fixture, el } = await render();
    const button = el.querySelector('button.effects-toggle') as HTMLButtonElement;
    expect(button.getAttribute('aria-label')).toBe('Turn Sound Effects Off');
    button.click();
    fixture.detectChanges();
    expect(button.getAttribute('aria-label')).toBe('Turn Sound Effects On');
    expect((el.querySelector('button.music-toggle') as HTMLButtonElement).getAttribute('aria-label')).toBe('Turn Music Off');
    localStorage.clear();
  });

  it('has one language button in the toolbar, before the sound buttons', async () => {
    localStorage.clear();
    const { el } = await render();
    const buttons = [...el.querySelectorAll('mat-toolbar app-language-switcher button')];
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual(['Language']);
    const switcher = el.querySelector('app-language-switcher')!;
    const music = el.querySelector('button.music-toggle')!;
    expect(switcher.compareDocumentPosition(music) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    localStorage.clear();
  });

  it('puts Battlefield, the account, the language menu and the sound buttons on the right, in that order', async () => {
    const { el, fixture } = await render();
    TestBed.inject(BattlefieldBackgrounds).available.set(true);
    fixture.detectChanges();
    const right = ['button.nav-battlefield', 'a.sign-in, button.account', 'app-language-switcher', 'button.music-toggle', 'button.effects-toggle'].map(
      (selector) => el.querySelector(selector)!
    );
    expect(el.querySelector('nav.nav .nav-battlefield')).toBeNull();
    for (let i = 1; i < right.length; i++) {
      expect(right[i - 1].compareDocumentPosition(right[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    expect(el.querySelector('span.spacer')!.compareDocumentPosition(right[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('should render title', async () => {
    const { el } = await render();
    expect(el.querySelector('mat-toolbar h1')?.textContent).toContain('Kingdom War');
  });

  it('links Play to /play, highlighted on the play screens', async () => {
    const { el, fixture } = await render('/setup');
    const play = el.querySelector('a.nav-play') as HTMLAnchorElement;
    expect(play.getAttribute('href')).toBe('/play');
    expect(play.classList).toContain('active');
    await TestBed.inject(Router).navigateByUrl('/wiki/default/generals');
    fixture.detectChanges();
    expect(play.classList).not.toContain('active');
    expect(el.querySelector('button.nav-default')!.classList).toContain('active');
    expect(el.querySelector('button.nav-alternate')!.classList).not.toContain('active');
    await TestBed.inject(Router).navigateByUrl('/wiki/alternate/tools');
    fixture.detectChanges();
    expect(el.querySelector('button.nav-default')!.classList).not.toContain('active');
    expect(el.querySelector('button.nav-alternate')!.classList).toContain('active');
  });

  it('has five items in the bar: Play Offline, Play Online, Kingdom Wars, Dynasty Wars and Rules, each with an icon', async () => {
    const { el } = await render();
    const items = [...el.querySelectorAll('nav.nav > a, nav.nav > button')];
    expect(items.map((i) => [i.querySelector('.label')!.textContent, i.querySelector('mat-icon')!.textContent])).toEqual([
      ['Play Offline', 'play_arrow'],
      ['Play Online', 'public'],
      ['Kingdom Wars', 'swords'],
      ['Dynasty Wars', 'castle'],
      ['Rules', 'menu_book'],
    ]);
  });

  it('has a Battlefield menu with the default look and three backgrounds, remembering the pick', async () => {
    localStorage.removeItem('battlefield-background');
    const { el, fixture } = await render();
    expect(el.querySelector('button.nav-battlefield')).toBeNull();
    TestBed.inject(BattlefieldBackgrounds).available.set(true);
    fixture.detectChanges();
    (el.querySelector('button.nav-battlefield') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    const items = [...document.querySelectorAll('.mat-mdc-menu-panel button[mat-menu-item]')] as HTMLButtonElement[];
    expect(items.map((b) => b.textContent!.trim())).toEqual(['Default', 'Background 1', 'Background 2', 'Background 3']);
    expect(items[0].classList).toContain('active');
    items[2].click();
    expect(TestBed.inject(BattlefieldBackgrounds).choice()).toBe('2');
    expect(localStorage.getItem('battlefield-background')).toBe('2');
    localStorage.removeItem('battlefield-background');
  });

  it('links Online to /rooms, highlighted on the online screens', async () => {
    const { el, fixture } = await render('/rooms');
    const online = el.querySelector('a.nav-online') as HTMLAnchorElement;
    expect(online.getAttribute('href')).toBe('/rooms');
    expect(online.getAttribute('aria-label')).toBe('Play Online');
    expect(online.classList).toContain('active');
    expect(online.getAttribute('aria-current')).toBe('page');
    expect(el.querySelector('a.nav-play')!.classList).not.toContain('active');
    await TestBed.inject(Router).navigateByUrl('/setup');
    fixture.detectChanges();
    expect(online.classList).not.toContain('active');
  });

  it('keeps Online highlighted on My Games', async () => {
    const { el } = await render('/my-games');
    expect(el.querySelector('a.nav-online')!.classList).toContain('active');
  });

  it('has no single Cards button any more', async () => {
    const { el } = await render();
    expect(el.querySelector('button.nav-cards')).toBeNull();
  });

  it('has a Default menu with four options and no icons', async () => {
    const { el, fixture } = await render();
    (el.querySelector('nav.nav button.nav-default') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    const items = [...document.querySelectorAll('.mat-mdc-menu-panel a[mat-menu-item]')] as HTMLAnchorElement[];
    expect(items.map((a) => [a.textContent!.trim(), a.getAttribute('href')])).toEqual([
      ['Generals', '/wiki/default/generals'],
      ['Basic Cards', '/wiki/default/basic'],
      ['Equipment', '/wiki/default/equipment'],
      ['Tools', '/wiki/default/tools'],
    ]);
    expect(items.every((a) => !a.querySelector('mat-icon'))).toBe(true);
  });

  it('has an Alternate menu with four enabled links, Generals first', async () => {
    const { el, fixture } = await render();
    (el.querySelector('nav.nav button.nav-alternate') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    const items = [...document.querySelectorAll('.mat-mdc-menu-panel [mat-menu-item]')] as HTMLElement[];
    expect(items.map((i) => i.textContent!.trim())).toEqual(['Generals', 'Basic Cards', 'Equipment', 'Tools']);
    expect(items.map((a) => a.tagName)).toEqual(['A', 'A', 'A', 'A']);
    expect(items.map((a) => a.getAttribute('href'))).toEqual(['/wiki/alternate/generals', '/wiki/alternate/basic', '/wiki/alternate/equipment', '/wiki/alternate/tools']);
    expect(items.some((a) => a.hasAttribute('disabled') || a.getAttribute('aria-disabled') === 'true')).toBe(false);
  });

  it('has a Rules menu with the six rules pages, highlighted on any of them', async () => {
    const { el, fixture } = await render();
    const button = el.querySelector('nav.nav button.nav-rules') as HTMLButtonElement;
    expect(button.querySelector('mat-icon')!.textContent).toBe('menu_book');
    expect(button.querySelector('.label')!.textContent).toBe('Rules');
    expect(button.classList).not.toContain('active');
    button.click();
    fixture.detectChanges();
    await fixture.whenStable();
    const items = [...document.querySelectorAll('.mat-mdc-menu-panel a[mat-menu-item]')] as HTMLAnchorElement[];
    expect(items.map((a) => [a.textContent!.trim(), a.getAttribute('href')])).toEqual([
      ['Overview', '/wiki/rules/overview'],
      ['Card Types', '/wiki/rules/card-types'],
      ['Setup', '/wiki/rules/setup'],
      ['Turn Structure', '/wiki/rules/turn'],
      ['Distance / Range', '/wiki/rules/distance'],
      ['Judgment', '/wiki/rules/judgment'],
    ]);
    await TestBed.inject(Router).navigateByUrl('/wiki/rules/turn');
    fixture.detectChanges();
    expect(button.classList).toContain('active');
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
    await TestBed.inject(Router).navigateByUrl('/wiki/default/basic');
    fixture.detectChanges();
    expect(el.querySelector('a.nav-play')!.getAttribute('aria-current')).toBeNull();
    (el.querySelector('nav.nav button.nav-default') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    const current = [...document.querySelectorAll('.mat-mdc-menu-panel a[aria-current="page"]')];
    expect(current.map((a) => a.textContent!.trim())).toEqual(['Basic Cards']);
  });

  it('icon buttons have accessible names (Review Focus 4)', async () => {
    const { el } = await render();
    expect(el.querySelector('a.nav-play')!.getAttribute('aria-label')).toBe('Play Offline');
    expect(el.querySelector('button.nav-default')!.getAttribute('aria-label')).toBe('Dynasty Wars');
    expect(el.querySelector('button.nav-alternate')!.getAttribute('aria-label')).toBe('Kingdom Wars');
    expect(el.querySelector('button.nav-rules')!.getAttribute('aria-label')).toBe('Rules');
  });

  it('loads who is signed in on start', async () => {
    fakeAuth.load.mockClear();
    await render();
    expect(fakeAuth.load).toHaveBeenCalledTimes(1);
  });

  it('shows Sign In when nobody is signed in', async () => {
    const { el } = await render();
    expect(el.querySelector('a.sign-in')?.textContent).toContain('Sign In');
    expect(el.querySelector('button.account')).toBeNull();
  });

  it('shows nothing for the account until the first answer arrives', async () => {
    loaded.set(false);
    const { el } = await render();
    expect(el.querySelector('a.sign-in')).toBeNull();
    expect(el.querySelector('button.account')).toBeNull();
  });

  it("shows the signed-in user's name, and Sign Out signs out and goes to Setup", async () => {
    me.set({ id: 'u1', kind: 'registered', displayName: 'Ann', email: 'ann@example.com' });
    const { fixture, el } = await render('/wiki/default/generals');
    const account = el.querySelector('button.account') as HTMLButtonElement;
    expect(account.textContent).toContain('Ann');
    account.click();
    fixture.detectChanges();
    await fixture.whenStable();
    const signOut = document.querySelector('.cdk-overlay-container button.sign-out') as HTMLButtonElement;
    expect(signOut.textContent).toContain('Sign Out');
    signOut.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fakeAuth.signOut).toHaveBeenCalled();
    expect(TestBed.inject(Router).url).toBe('/setup');
    expect(el.querySelector('a.sign-in')).not.toBeNull();
  });

  it('offers Create Account to a guest', async () => {
    me.set({ id: 'u2', kind: 'guest', displayName: 'Guest' });
    const { fixture, el } = await render();
    (el.querySelector('button.account') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    const overlay = document.querySelector('.cdk-overlay-container') as HTMLElement;
    expect(overlay.textContent).toContain('Playing as a guest');
    expect(overlay.querySelector('a.create-account')?.textContent).toContain('Create Account');
  });
});
