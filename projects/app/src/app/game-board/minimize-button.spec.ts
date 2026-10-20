import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { I18n } from '../i18n/i18n.service';
import { DecisionDock } from './decision-dock';
import { MinimizeButton } from './minimize-button';

// Stands in for a dialog: a container holding the title row, as MatDialog renders it.
@Component({
  imports: [MinimizeButton],
  template: `
    <div class="mat-mdc-dialog-container">
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
  it('is labelled View Board', () => {
    expect(mount().button.textContent!.trim()).toBe('View Board');
  });

  it('is labelled in Vietnamese', async () => {
    TestBed.configureTestingModule({ providers: [{ provide: MatDialogRef, useValue: ref }] });
    await TestBed.inject(I18n).setLocale('vi');
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('button.minimize').textContent.trim()).toBe('Xem bàn');
  });

  it('minimizes its dialog with the dialog title and the context', () => {
    const { button } = mount();
    const minimize = jest.spyOn(TestBed.inject(DecisionDock), 'minimize');
    button.click();
    expect(minimize).toHaveBeenCalledWith(ref, 'Response Needed', 'Seat 1 used Sha');
  });

  it('passes no context when it has none', () => {
    const { fixture, button } = mount();
    fixture.componentInstance.context.set(null);
    fixture.detectChanges();
    const minimize = jest.spyOn(TestBed.inject(DecisionDock), 'minimize');
    button.click();
    expect(minimize).toHaveBeenCalledWith(ref, 'Response Needed', null);
  });
});
