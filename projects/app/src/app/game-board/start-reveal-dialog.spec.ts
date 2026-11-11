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
  it('shows each hidden General’s art beside its slot and name', () => {
    const { el } = render();
    const art = [...el.querySelectorAll('.general img')].map((i) => i.getAttribute('src'));
    expect(art).toEqual([generalSkinUrl('cao-cao'), generalSkinUrl('sima-yi')]);
    expect(el.querySelector('.general[data-slot="main"]')!.textContent).toContain('Cao Cao');
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
