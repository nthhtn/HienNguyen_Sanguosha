import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FEATURE_FLAGS } from './feature-flags';
import { I18n } from './i18n/i18n.service';
import { InstallHint } from './install-hint';
import { fireInstallPrompt } from './install-prompt.testing';
import { clearDisplayMode, setWindowSize, stubDisplayMode } from './layout.testing';

describe('InstallHint', () => {
  let fixture: ComponentFixture<InstallHint>;

  afterEach(() => {
    clearDisplayMode();
    setWindowSize(1024, 768);
  });

  function render(mode: 'fullscreen' | 'browser', width: number, height: number, phoneBoard = true): HTMLElement {
    TestBed.configureTestingModule({ providers: [{ provide: FEATURE_FLAGS, useValue: { playOffline: true, playbackSettings: true, phoneBoard } }] });
    stubDisplayMode(mode);
    setWindowSize(width, height);
    fixture = TestBed.createComponent(InstallHint);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('tells a phone browser tab to install, with no button until Chrome offers it', () => {
    const el = render('browser', 915, 412);
    expect(el.textContent).toContain('Install the app to play on this phone.');
    expect(el.querySelector('button.install-app')).toBeNull();
  });

  it('offers Install App once Chrome does, and opens Chrome dialog', () => {
    const el = render('browser', 915, 412);
    const event = fireInstallPrompt();
    fixture.detectChanges();
    const button = el.querySelector('button.install-app') as HTMLButtonElement;
    expect(button.textContent).toContain('Install App');
    button.click();
    expect(event.prompt).toHaveBeenCalled();
  });

  it.each([
    ['fullscreen', 915, 412],
    ['browser', 1366, 768],
    ['browser', 700, 330],
  ] as const)('says nothing in %s at %i x %i', (mode, width, height) => {
    expect(render(mode, width, height).textContent!.trim()).toBe('');
  });

  it('says nothing while the phone board flag is off', () => {
    expect(render('browser', 915, 412, false).textContent!.trim()).toBe('');
  });

  it('is in Vietnamese when the language is Vietnamese', async () => {
    const el = render('browser', 915, 412);
    await TestBed.inject(I18n).setLocale('vi');
    try {
      fixture.detectChanges();
      expect(el.textContent).toContain('Cài ứng dụng để chơi trên điện thoại này.');
    } finally {
      await TestBed.inject(I18n).setLocale('en');
    }
  });
});

describe('the install hint beside the small-screen messages', () => {
  afterEach(() => {
    clearDisplayMode();
    setWindowSize(1024, 768);
  });

  it('follows the notice beside disabled controls, and the board prompt, but not the rotate prompt', async () => {
    const { SmallScreenNotice } = await import('./small-screen-notice');
    const { SmallScreenPrompt } = await import('./game-board/small-screen-prompt');
    stubDisplayMode('browser');
    setWindowSize(915, 412);
    const notice = TestBed.createComponent(SmallScreenNotice);
    notice.detectChanges();
    expect(notice.nativeElement.textContent).toContain('Playing needs a tablet or computer screen.Install the app to play on this phone.');
    const prompt = TestBed.createComponent(SmallScreenPrompt);
    prompt.detectChanges();
    expect(prompt.nativeElement.textContent).toContain('Install the app to play on this phone.');
    clearDisplayMode();
    TestBed.resetTestingModule();
    stubDisplayMode('fullscreen');
    setWindowSize(412, 915);
    const rotate = TestBed.createComponent(SmallScreenPrompt);
    rotate.detectChanges();
    expect(rotate.nativeElement.textContent).toContain('Rotate Your Device');
    expect(rotate.nativeElement.querySelector('app-install-hint')).toBeNull();
  });
});
