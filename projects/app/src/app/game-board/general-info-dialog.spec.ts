import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { GeneralInfoDialog } from './general-info-dialog';

function render(generalDefinitionId: string): HTMLElement {
  TestBed.configureTestingModule({
    imports: [GeneralInfoDialog],
    providers: [{ provide: MAT_DIALOG_DATA, useValue: { generalDefinitionId } }],
  });
  const fixture = TestBed.createComponent(GeneralInfoDialog);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('GeneralInfoDialog', () => {
  it('shows the General’s name, title, art and each skill with its text', () => {
    const el = render('guan-yu');
    expect(el.querySelector('h2')!.textContent).toContain('Guan Yu');
    expect(el.textContent).toContain('Bearded Gentleman');
    expect((el.querySelector('app-card-art img') as HTMLImageElement).getAttribute('src')).toBe('/card-art/generals/skins/shu/guanyu.png');
    const skills = [...el.querySelectorAll('.skills li')].map((li) => li.textContent!.trim());
    expect(skills).toHaveLength(1);
    expect(skills[0]).toContain('Fighting Saint');
    expect(skills[0]).toContain('Guan Yu can use any red card as an attack.');
  });

  it('falls back to a readable name and an empty-state line for an unknown General', () => {
    const el = render('no-such-general');
    expect(el.querySelector('h2')!.textContent).toContain('No Such General');
    expect(el.textContent).toContain('No skills listed');
    expect(el.textContent).not.toContain('no-such-general');
  });
});
