import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { provideFakeArtSets } from '../art-sets.testing';
import { GeneralArtDialog } from './general-art-dialog';

function render(generalId: string): HTMLElement {
  TestBed.configureTestingModule({
    imports: [GeneralArtDialog],
    providers: [...provideFakeArtSets(), { provide: MAT_DIALOG_DATA, useValue: { generalId } }],
  });
  const fixture = TestBed.createComponent(GeneralArtDialog);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('GeneralArtDialog', () => {
  it("is titled with the General's name and shows the large tiles with a hint and a Close button", () => {
    const el = render('guan-yu');
    expect(el.querySelector('h2')!.textContent).toContain('Guan Yu');
    expect(el.querySelector('.hint')!.textContent).toContain('Pick the artwork this General shows');
    expect(el.querySelector('app-general-art-choices ul.choices.large')).not.toBeNull();
    expect(el.querySelector('button[mat-dialog-close]')!.textContent!.trim()).toBe('Close');
  });
});
