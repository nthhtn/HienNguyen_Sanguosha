import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { generalSkinUrl } from 'content';
import { StartRevealDialog, StartRevealDialogData } from './start-reveal-dialog';

function render() {
  const close = jest.fn();
  const data: StartRevealDialogData = {
    options: [
      { slot: 'main', slotLabel: 'Main General', name: 'Cao Cao', generalId: 'cao-cao' },
      { slot: 'deputy', slotLabel: 'Deputy General', name: 'Sima Yi', generalId: 'sima-yi' },
    ],
  };
  TestBed.configureTestingModule({ providers: [{ provide: MAT_DIALOG_DATA, useValue: data }, { provide: MatDialogRef, useValue: { close } }] });
  const fixture = TestBed.createComponent(StartRevealDialog);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement, close };
}

describe('StartRevealDialog', () => {
  it('shows each hidden General’s art with name and role on the right; tap toggles selection', () => {
    const { el, fixture } = render();
    const art = [...el.querySelectorAll('.general img')].map((i) => i.getAttribute('src'));
    expect(art).toEqual([generalSkinUrl('cao-cao'), generalSkinUrl('sima-yi')]);
    expect(el.querySelectorAll('mat-icon')).toHaveLength(0);
    const main = el.querySelector('.general[data-slot="main"]')!;
    expect(main.querySelector('.name')!.textContent).toBe('Cao Cao');
    expect(main.querySelector('.slot')!.textContent).toBe('Main General');
    (main as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(main.classList.contains('checked')).toBe(true);
  });

  it('closes with the ticked slots, Main first', () => {
    const { fixture, el, close } = render();
    (el.querySelector('.general[data-slot="deputy"]') as HTMLButtonElement).click();
    (el.querySelector('.general[data-slot="main"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    (el.querySelector('button.confirm') as HTMLButtonElement).click();
    expect(close).toHaveBeenCalledWith(['main', 'deputy']);
  });
});

describe('StartRevealDialog tutorial anchors', () => {
  it('marks the whole window, which a step with several clicks spotlights as one', () => {
    const { el } = render();
    expect(el.getAttribute('data-tutorial')).toBe('reveal-dialog');
    // A block, so the host has a box the spotlight can cut a hole around.
    expect(el.style.display).toBe('block');
  });

  it('marks each General slot and the confirm button', () => {
    const { el } = render();
    const marked = [...el.querySelectorAll('[data-tutorial]')].map((e) => [e.tagName.toLowerCase(), e.getAttribute('data-tutorial')]);
    expect(marked).toEqual([
      ['button', 'reveal-slot:main'],
      ['button', 'reveal-slot:deputy'],
      ['button', 'reveal-confirm'],
    ]);
  });
});

