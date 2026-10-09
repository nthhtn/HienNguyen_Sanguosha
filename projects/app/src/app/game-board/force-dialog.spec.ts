import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Force } from '../labels';
import { openForceDialog } from './force-dialog';

@Component({ selector: 'app-probe', template: 'probe' })
class Probe {}

describe('openForceDialog', () => {
  const panel = () => document.querySelector('.cdk-overlay-pane') as HTMLElement;

  afterEach(() => TestBed.inject(MatDialog).closeAll());

  it.each<Force>(['Wei', 'Shu', 'Wu', 'Qun', 'none'])('themes the dialog panel for %s', (force) => {
    TestBed.configureTestingModule({ imports: [MatDialogModule] });
    openForceDialog(TestBed.inject(MatDialog), Probe, force, {});
    expect(panel().classList).toContain('force-dialog');
    expect(panel().classList).toContain(`force-dialog-${force}`);
  });

  it('keeps the caller’s own dialog config', () => {
    TestBed.configureTestingModule({ imports: [MatDialogModule] });
    const ref = openForceDialog(TestBed.inject(MatDialog), Probe, 'Wu', { disableClose: true });
    expect(ref.disableClose).toBe(true);
  });
});
