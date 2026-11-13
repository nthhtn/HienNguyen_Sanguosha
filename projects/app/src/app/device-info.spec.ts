import { ComponentFixture, TestBed } from '@angular/core/testing';
import { routes } from './app.routes';
import { DeviceInfo } from './device-info';
import { I18n } from './i18n/i18n.service';
import { clearDisplayMode, resizeTo, stubDisplayMode } from './layout.testing';

describe('DeviceInfo', () => {
  let fixture: ComponentFixture<DeviceInfo>;

  beforeEach(() => resizeTo(1366, 768));
  afterEach(() => clearDisplayMode());

  function render(): string {
    fixture = TestBed.createComponent(DeviceInfo);
    fixture.detectChanges();
    return renderedText();
  }
  function renderedText(): string {
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('shows the window size, display mode, orientation and layout', () => {
    stubDisplayMode('fullscreen');
    resizeTo(915, 412);
    const text = render();
    expect(text).toContain('Device Info');
    expect(text).toContain('915 × 412');
    expect(text).toContain('Full Screen');
    expect(text).toContain('Landscape');
    expect(text).toContain('Phone Board');
    expect(text).toContain('Pixel Ratio');
  });

  it('says too small to play in a phone browser tab', () => {
    stubDisplayMode('browser');
    resizeTo(915, 412);
    expect(render()).toContain('Too small to play');
  });

  it('says Browser and Portrait in an upright browser tab', () => {
    resizeTo(412, 915);
    const text = render();
    expect(text).toContain('Browser');
    expect(text).toContain('Portrait');
  });

  it('follows the window when it changes', () => {
    const before = render();
    resizeTo(1440, 900);
    const after = renderedText();
    expect(before).not.toContain('1440 × 900');
    expect(after).toContain('1440 × 900');
    expect(after).toContain('Large');
  });

  it('is in Vietnamese when the language is Vietnamese', async () => {
    await TestBed.inject(I18n).setLocale('vi');
    try {
      expect(render()).toContain('Thông tin thiết bị');
    } finally {
      await TestBed.inject(I18n).setLocale('en');
    }
  });

  it('is a route anyone can open, signed in or not', () => {
    const route = routes.find((r) => r.path === 'device-info');
    expect(route?.loadComponent).toBeDefined();
    expect(route?.canActivate).toBeUndefined();
  });
});
