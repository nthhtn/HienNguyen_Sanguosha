import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FEATURE_FLAGS } from './feature-flags';
import { Home } from './home';
import { I18n } from './i18n/i18n.service';
import { fireInstallPrompt } from './install-prompt.testing';
import { clearDisplayMode, setWindowSize, stubDisplayMode } from './layout.testing';

describe('Home', () => {
  let fixture: ComponentFixture<Home>;

  afterEach(() => {
    clearDisplayMode();
    setWindowSize(1024, 768);
  });

  function render(options: { playOffline?: boolean; width?: number; height?: number } = {}): HTMLElement {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: FEATURE_FLAGS, useValue: { playOffline: options.playOffline ?? false, playbackSettings: false, phoneBoard: true } },
      ],
    });
    stubDisplayMode('browser');
    setWindowSize(options.width ?? 1024, options.height ?? 768);
    fixture = TestBed.createComponent(Home);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }
  const href = (el: HTMLElement, selector: string) => el.querySelector(selector)!.getAttribute('href');

  it('names the game and says what it is', () => {
    const el = render();
    expect(el.querySelector('mat-card-title')!.textContent).toContain('Sanguosha');
    expect(el.querySelector('mat-card-subtitle')!.textContent).toContain('Guozhan with friends');
  });

  it('offers Play Online, which goes to Rooms, and Play as Guest, which returns there', () => {
    const el = render();
    expect(el.querySelector('a.play-online')!.textContent).toContain('Play Online');
    expect(href(el, 'a.play-online')).toBe('/rooms');
    expect(el.querySelector('a.play-guest')!.textContent).toContain('Play as Guest');
    expect(href(el, 'a.play-guest')).toBe('/guest?returnUrl=%2Frooms');
  });

  it('links Sign In (returning to Rooms) and the Rules', () => {
    const el = render();
    expect(href(el, 'a.sign-in')).toBe('/sign-in?returnUrl=%2Frooms');
    expect(href(el, 'a.rules')).toBe('/wiki/rules');
  });

  it('offers Play Offline only where offline play is on', () => {
    expect(render().querySelector('a.play-offline')).toBeNull();
    TestBed.resetTestingModule();
    const el = render({ playOffline: true });
    expect(href(el, 'a.play-offline')).toBe('/setup');
  });

  it('shows the install card on a phone browser tab, and not on a computer', () => {
    expect(render().querySelector('.install')).toBeNull();
    TestBed.resetTestingModule();
    const el = render({ width: 915, height: 412 });
    expect(el.querySelector('.install .install-title')!.textContent).toContain('Get the Phone App');
    expect(el.querySelector('.install')!.textContent).toContain('Chrome');
  });

  it('shows the Install App button only once Chrome offers it, and opens Chrome dialog', () => {
    const el = render({ width: 915, height: 412 });
    expect(el.querySelector('button.install-app')).toBeNull();
    expect(el.querySelector('.install-manual')).not.toBeNull();
    const event = fireInstallPrompt(jest.fn(async () => undefined));
    fixture.detectChanges();
    const button = el.querySelector('button.install-app') as HTMLButtonElement;
    expect(button.textContent).toContain('Install App');
    expect(el.querySelector('.install-manual')).toBeNull();
    button.click();
    expect(event.prompt).toHaveBeenCalled();
  });

  it('reads in Vietnamese', async () => {
    const el = render({ playOffline: true, width: 915, height: 412 });
    await TestBed.inject(I18n).setLocale('vi');
    fixture.detectChanges();
    expect(el.querySelector('mat-card-title')!.textContent).toContain('Tam quốc sát');
    expect(el.querySelector('a.play-online')!.textContent).toContain('Chơi trực tuyến');
    expect(el.querySelector('a.play-guest')!.textContent).toContain('Chơi với tư cách khách');
    expect(el.querySelector('.install .install-title')!.textContent).toContain('Cài ứng dụng');
  });
});
