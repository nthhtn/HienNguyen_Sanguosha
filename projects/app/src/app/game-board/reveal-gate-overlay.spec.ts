import { TestBed } from '@angular/core/testing';
import { RevealGateOverlay } from './reveal-gate-overlay';

describe('RevealGateOverlay', () => {
  it('shows the name of the player being passed to and emits revealed when tapped', () => {
    const fixture = TestBed.createComponent(RevealGateOverlay);
    fixture.componentRef.setInput('name', 'Hing');
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h2')!.textContent).toBe('Pass the device to Hing');

    const revealedSpy = jest.fn();
    fixture.componentInstance.revealed.subscribe(revealedSpy);
    el.querySelector('button')!.dispatchEvent(new Event('click'));

    expect(revealedSpy).toHaveBeenCalled();
  });

  it('uses a Material button inside a Material card', () => {
    const fixture = TestBed.createComponent(RevealGateOverlay);
    fixture.componentRef.setInput('name', 'Hing');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('mat-card')).not.toBeNull();
    expect(el.querySelector('button')!.classList).toContain('mat-mdc-button-base');
  });
});
