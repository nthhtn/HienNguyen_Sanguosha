import { TestBed } from '@angular/core/testing';
import { provideFakeArtSets } from '../art-sets.testing';
import { GeneralArtButton } from './general-art-button';

function render(general: string) {
  TestBed.configureTestingModule({ imports: [GeneralArtButton], providers: provideFakeArtSets() });
  const fixture = TestBed.createComponent(GeneralArtButton);
  fixture.componentRef.setInput('general', general);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

const button = (el: HTMLElement) => el.querySelector('button.art-sets-button') as HTMLButtonElement | null;
const settle = async (fixture: { detectChanges(): void }) => {
  await new Promise((resolve) => setTimeout(resolve));
  fixture.detectChanges();
};

describe('GeneralArtButton', () => {
  afterEach(() => document.querySelector('.cdk-overlay-container')?.replaceChildren());

  it('is absent for a General that only classic covers', () => {
    expect(button(render('zhao-yun').el)).toBeNull();
  });

  it('shows how many art sets cover the General, the same for a Kingdom Wars id', () => {
    expect(button(render('guan-yu').el)!.textContent!.trim()).toBe('Art Sets (2)');
    TestBed.resetTestingModule();
    expect(button(render('kingdomWars:guan-yu').el)!.textContent!.trim()).toBe('Art Sets (2)');
  });

  it("opens a popup titled with the General's name that lists its art, for the base General", async () => {
    const { fixture, el } = render('kingdomWars:guan-yu');
    button(el)!.click();
    await settle(fixture);
    const dialog = document.querySelector('app-general-art-dialog')!;
    expect(dialog.querySelector('h2')!.textContent).toContain('Guan Yu');
    expect([...dialog.querySelectorAll('button.tile')].map((t) => t.getAttribute('data-set'))).toEqual(['classic', 'ink']);
  });
});
