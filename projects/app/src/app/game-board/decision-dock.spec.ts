import { TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { DecisionDock } from './decision-dock';

function fakeRef() {
  const closed = new Subject<void>();
  const ref = { addPanelClass: jest.fn(), removePanelClass: jest.fn(), afterClosed: () => closed.asObservable() };
  return { ref: ref as unknown as MatDialogRef<unknown, unknown>, closed, spies: ref };
}

describe('DecisionDock', () => {
  const dock = () => TestBed.inject(DecisionDock);

  it('minimizing hides the dialog and remembers its title and context', () => {
    const { ref, spies } = fakeRef();
    dock().minimize(ref, 'Response Needed', 'Seat 1 used Sha');
    expect(dock().minimized()).toEqual({ title: 'Response Needed', context: 'Seat 1 used Sha' });
    expect(spies.addPanelClass).toHaveBeenCalledWith('decision-minimized');
  });

  it('has no context unless one is given', () => {
    dock().minimize(fakeRef().ref, 'Choose a Card');
    expect(dock().minimized()).toEqual({ title: 'Choose a Card', context: null });
  });

  it('restoring shows the dialog again and clears the banner', () => {
    const { ref, spies } = fakeRef();
    dock().minimize(ref, 'Response Needed');
    dock().restore();
    expect(dock().minimized()).toBeNull();
    expect(spies.removePanelClass).toHaveBeenCalledWith('decision-minimized');
  });

  it('closing the dialog while minimized clears the banner', () => {
    const { ref, closed } = fakeRef();
    dock().minimize(ref, 'Response Needed');
    closed.next();
    expect(dock().minimized()).toBeNull();
  });

  it('a later minimize replaces the entry and the earlier dialog closing keeps it', () => {
    const a = fakeRef();
    const b = fakeRef();
    dock().minimize(a.ref, 'Response Needed');
    dock().minimize(b.ref, 'Choose a Card');
    a.closed.next();
    expect(dock().minimized()?.title).toBe('Choose a Card');
  });

  it('restoring with nothing minimized does nothing', () => {
    expect(() => dock().restore()).not.toThrow();
    expect(dock().minimized()).toBeNull();
  });
});
