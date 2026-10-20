import { TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { Force } from '../labels';
import { DecisionBanner } from './decision-banner';
import { DecisionDock } from './decision-dock';

function minimize(title = 'Response Needed', context: string | null = 'Seat 1 used Sha', force: Force | null = null) {
  const closed = new Subject<void>();
  const ref = { addPanelClass: jest.fn(), removePanelClass: jest.fn(), beforeClosed: () => closed.asObservable() };
  TestBed.inject(DecisionDock).minimize(ref as unknown as MatDialogRef<unknown, unknown>, title, context, force);
  return { ref, closed };
}

function mount() {
  const fixture = TestBed.createComponent(DecisionBanner);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

describe('DecisionBanner', () => {
  it('shows nothing while no decision is minimized', () => {
    expect(mount().el.querySelector('.banner')).toBeNull();
  });

  it('is one button naming the decision, its context and Open', () => {
    minimize();
    const banner = mount().el.querySelector('.banner') as HTMLButtonElement;
    expect(banner.tagName).toBe('BUTTON');
    expect(banner.textContent).toContain('Response Needed');
    expect(banner.textContent).toContain('Seat 1 used Sha');
    expect(banner.textContent).toContain('Open');
  });

  it.each<Force>(['Wei', 'Shu', 'Wu', 'Qun'])('takes the %s colours of the dialog it stands for', (force) => {
    minimize('Response Needed', null, force);
    const banner = mount().el.querySelector('.banner')!;
    // The global [data-force] rules colour the title and the countdown inside it.
    expect(banner.getAttribute('data-force')).toBe(force);
    expect(banner.querySelector('app-decision-countdown')).not.toBeNull();
  });

  it('is the default colour when the dialog has no force', () => {
    minimize();
    expect(mount().el.querySelector('.banner')!.hasAttribute('data-force')).toBe(false);
  });

  it('shows the title alone when there is no context', () => {
    minimize('Choose a Card', null);
    expect(mount().el.querySelector('.banner')!.textContent).toContain('Choose a Card');
  });

  it('restores the dialog when clicked, and goes away', () => {
    const { ref } = minimize();
    const { fixture, el } = mount();
    (el.querySelector('.banner') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(ref.removePanelClass).toHaveBeenCalledWith('decision-minimized');
    expect(el.querySelector('.banner')).toBeNull();
  });

  it('goes away when the dialog closes', () => {
    const { closed } = minimize();
    const { fixture, el } = mount();
    closed.next();
    fixture.detectChanges();
    expect(el.querySelector('.banner')).toBeNull();
  });
});
