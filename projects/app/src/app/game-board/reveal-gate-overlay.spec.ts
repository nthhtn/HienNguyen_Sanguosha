import { TestBed } from '@angular/core/testing';
import { RevealGateOverlay } from './reveal-gate-overlay';

describe('RevealGateOverlay', () => {
  it('shows the seat id being passed to and emits revealed when tapped', () => {
    const fixture = TestBed.createComponent(RevealGateOverlay);
    fixture.componentRef.setInput('seatId', 'seat-2');
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('seat-2');

    const revealedSpy = jest.fn();
    fixture.componentInstance.revealed.subscribe(revealedSpy);
    el.querySelector('button')!.dispatchEvent(new Event('click'));

    expect(revealedSpy).toHaveBeenCalled();
  });
});
