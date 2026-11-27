import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { DISPLAY_MODE_OVERRIDE } from '../display-mode-override';
import { FEATURE_FLAGS } from '../feature-flags';
import { I18n } from '../i18n/i18n.service';
import { DecisionDock } from './decision-dock';
import { MinimizeButton } from './minimize-button';

// Stands in for a dialog: a container holding the title row, as MatDialog renders it.
@Component({
  imports: [MinimizeButton],
  template: `
    <div class="cdk-overlay-pane force-dialog force-dialog-Shu">
      <h2 mat-dialog-title>Response Needed</h2>
      <app-minimize-button [context]="context()" />
    </div>
  `,
})
class Host {
  context = signal<string | null>('Seat 1 used Sha');
}

const ref = { addPanelClass: jest.fn(), removePanelClass: jest.fn(), beforeClosed: () => ({ subscribe: jest.fn() }) };

function mount() {
  TestBed.configureTestingModule({ providers: [{ provide: MatDialogRef, useValue: ref }] });
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const button = fixture.nativeElement.querySelector('button.minimize') as HTMLButtonElement;
  return { fixture, button };
}

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe('MinimizeButton', () => {
  it('is labelled Minimize', () => {
    expect(mount().button.textContent!.trim()).toBe('Minimize');
  });

  it('is labelled in Vietnamese', async () => {
    TestBed.configureTestingModule({ providers: [{ provide: MatDialogRef, useValue: ref }] });
    await TestBed.inject(I18n).setLocale('vi');
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('button.minimize').textContent.trim()).toBe('Thu nhỏ');
  });

  it('on the phone board is a minus icon named Minimize', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 852 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 393 });
    try {
      TestBed.configureTestingModule({
        providers: [
          { provide: MatDialogRef, useValue: ref },
          { provide: DISPLAY_MODE_OVERRIDE, useValue: 'fullscreen' },
          { provide: FEATURE_FLAGS, useValue: { playOffline: true, playbackSettings: true, phoneBoard: true, tutorial: true } },
        ],
      });
      const fixture = TestBed.createComponent(Host);
      fixture.detectChanges();
      const button = fixture.nativeElement.querySelector('button.minimize') as HTMLButtonElement;
      expect(button.querySelector('mat-icon')!.textContent!.trim()).toBe('remove');
      expect(button.getAttribute('aria-label')).toBe('Minimize');
    } finally {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: 768 });
    }
  });

  it('minimizes its dialog with the dialog title and the context', () => {
    const { button } = mount();
    const minimize = jest.spyOn(TestBed.inject(DecisionDock), 'minimize');
    button.click();
    expect(minimize).toHaveBeenCalledWith(ref, 'Response Needed', 'Seat 1 used Sha', 'Shu');
  });

  it('passes no context when it has none', () => {
    const { fixture, button } = mount();
    fixture.componentInstance.context.set(null);
    fixture.detectChanges();
    const minimize = jest.spyOn(TestBed.inject(DecisionDock), 'minimize');
    button.click();
    expect(minimize).toHaveBeenCalledWith(ref, 'Response Needed', null, 'Shu');
  });
});
