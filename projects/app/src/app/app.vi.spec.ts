import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { Me } from 'protocol';
import { App } from './app';
import { AuthService } from './auth/auth.service';
import { I18n } from './i18n/i18n.service';
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
const text = (el: Element | null) => el!.textContent!.replace(/\s+/g, ' ').trim();
const overlay = () => document.querySelector('.cdk-overlay-container') as HTMLElement;

describe('App shell in Vietnamese', () => {
  beforeEach(async () => {
    localStorage.clear();
    me.set(null);
    loaded.set(true);
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        { provide: AuthService, useValue: fakeAuth },
        { provide: MUSIC_PLAYER_FACTORY, useValue: () => ({ loop: false, volume: 1, play: () => Promise.resolve(), pause: () => undefined }) },
        provideRouter([{ path: 'setup', children: [] }, { path: 'wiki/:page', children: [] }, { path: 'wiki/rules/:page', children: [] }, { path: 'sign-in', children: [] }, { path: 'sign-up', children: [] }]),
      ],
    }).compileComponents();
    await TestBed.inject(I18n).setLocale('vi');
  });
  afterEach(() => {
    localStorage.clear();
    overlay()?.replaceChildren();
  });

  async function render() {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }
  const menuItems = () => [...document.querySelectorAll('.mat-mdc-menu-panel [mat-menu-item]')].map((i) => text(i));

  it('the title, the four navigation items and their aria labels', async () => {
    const { el } = await render();
    expect(text(el.querySelector('mat-toolbar h1'))).toBe('Quốc chiến');
    expect([...el.querySelectorAll('nav.nav .label')].map((l) => text(l))).toEqual(['Chơi ngoại tuyến', 'Chơi trực tuyến', 'Bài', 'Luật']);
    expect([...el.querySelectorAll('nav.nav > a, nav.nav > button')].map((i) => i.getAttribute('aria-label'))).toEqual(['Chơi ngoại tuyến', 'Chơi trực tuyến', 'Bài', 'Luật']);
  });

  it('the Cards and Rules menus name their pages in Vietnamese', async () => {
    const { fixture, el } = await render();
    (el.querySelector('nav.nav button.nav-cards') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(menuItems()).toEqual(['Tướng', 'Bài cơ bản', 'Trang bị', 'Cẩm nang']);
    overlay().replaceChildren();
    (el.querySelector('nav.nav button.nav-rules') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(menuItems()).toEqual(['Tổng quan', 'Loại bài', 'Chuẩn bị', 'Cấu trúc lượt', 'Khoảng cách / Tầm', 'Phán xét']);
  });

  it('signed out, the sign-in link; as a guest, the account menu', async () => {
    const signedOut = await render();
    expect(text(signedOut.el.querySelector('a.sign-in .label'))).toBe('Đăng nhập');
    me.set({ id: 'u2', kind: 'guest', displayName: 'Guest' });
    const guest = await render();
    expect(guest.el.querySelector('button.account')!.getAttribute('aria-label')).toBe('Tài khoản');
    (guest.el.querySelector('button.account') as HTMLButtonElement).click();
    guest.fixture.detectChanges();
    await guest.fixture.whenStable();
    expect(menuItems()).toEqual(['Đang chơi với tư cách khách', 'Tạo tài khoản', 'Đăng xuất']);
  });

  it('a registered account shows its email, not the guest line', async () => {
    me.set({ id: 'u1', kind: 'registered', displayName: 'Ann', email: 'ann@example.com' });
    const { fixture, el } = await render();
    (el.querySelector('button.account') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(menuItems()).toEqual(['ann@example.com', 'Đăng xuất']);
  });

  it('the music and sound buttons, in both states, label and tooltip', async () => {
    const { fixture, el } = await render();
    const music = el.querySelector('button.music-toggle') as HTMLButtonElement;
    const effects = el.querySelector('button.effects-toggle') as HTMLButtonElement;
    expect([music.getAttribute('aria-label'), music.getAttribute('title')]).toEqual(['Tắt nhạc', 'Tắt nhạc']);
    expect([effects.getAttribute('aria-label'), effects.getAttribute('title')]).toEqual(['Tắt hiệu ứng âm thanh', 'Tắt hiệu ứng âm thanh']);
    music.click();
    effects.click();
    fixture.detectChanges();
    expect([music.getAttribute('aria-label'), music.getAttribute('title')]).toEqual(['Bật nhạc', 'Bật nhạc']);
    expect([effects.getAttribute('aria-label'), effects.getAttribute('title')]).toEqual(['Bật hiệu ứng âm thanh', 'Bật hiệu ứng âm thanh']);
  });

  it('follows a language switch in place, title included', async () => {
    const { fixture, el } = await render();
    await TestBed.inject(I18n).setLocale('en');
    await fixture.whenStable();
    expect(text(el.querySelector('mat-toolbar h1'))).toBe('Kingdom War');
    expect([...el.querySelectorAll('nav.nav .label')].map((l) => text(l))).toEqual(['Play Offline', 'Play Online', 'Cards', 'Rules']);
    await TestBed.inject(I18n).setLocale('vi');
    await fixture.whenStable();
    expect(text(el.querySelector('mat-toolbar h1'))).toBe('Quốc chiến');
  });
});
