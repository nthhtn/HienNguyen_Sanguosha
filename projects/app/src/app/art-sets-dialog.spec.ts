import { TestBed } from '@angular/core/testing';
import { ArtSets } from './art-sets.service';
import { provideFakeArtSets } from './art-sets.testing';
import { ArtSetsDialog } from './art-sets-dialog';
import { I18n } from './i18n/i18n.service';

function render() {
  TestBed.configureTestingModule({ imports: [ArtSetsDialog], providers: provideFakeArtSets() });
  const fixture = TestBed.createComponent(ArtSetsDialog);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement, arts: TestBed.inject(ArtSets) };
}

const radios = (el: HTMLElement) => [...el.querySelectorAll('input[type="radio"]')] as HTMLInputElement[];
const row = (el: HTMLElement, id: string) => el.querySelector(`li[data-general="${id}"]`) as HTMLLIElement | null;
const select = (el: HTMLElement, id: string) => row(el, id)!.querySelector('select') as HTMLSelectElement;
const optionTexts = (s: HTMLSelectElement) => [...s.options].map((o) => o.textContent!.trim());

describe('ArtSetsDialog', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('offers one radio per set with its coverage, and checks the global set', () => {
    const { el } = render();
    expect(radios(el).map((r) => r.value)).toEqual(['classic', 'ink']);
    expect(radios(el).map((r) => r.checked)).toEqual([true, false]);
    const labels = [...el.querySelectorAll('label.set')].map((l) => l.textContent!.replace(/\s+/g, ' ').trim());
    expect(labels[0]).toContain('Classic');
    expect(labels[0]).toContain('4 of 4 Generals');
    expect(labels[1]).toContain('Ink Wash');
    expect(labels[1]).toContain('2 of 4 Generals');
  });

  it('chooses the global set when a radio is picked', () => {
    const { fixture, el, arts } = render();
    radios(el)[1].click();
    fixture.detectChanges();
    expect(arts.global()).toBe('ink');
    expect(radios(el).map((r) => r.checked)).toEqual([false, true]);
  });

  it('lists only Generals that some other set covers, each offering only the sets that have art for it', () => {
    const { el } = render();
    expect([...el.querySelectorAll('li[data-general]')].map((li) => li.getAttribute('data-general'))).toEqual(['cao-cao', 'guan-yu']);
    expect(row(el, 'zhao-yun')).toBeNull();
    expect(optionTexts(select(el, 'cao-cao'))).toEqual(['Use Global Set (Classic)', 'Classic', 'Ink Wash']);
  });

  it('sets an override from a row, and clears it with the first option', () => {
    const { fixture, el, arts } = render();
    const s = select(el, 'guan-yu');
    s.value = 'ink';
    s.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(arts.overrides()).toEqual({ 'guan-yu': 'ink' });
    expect(select(el, 'guan-yu').value).toBe('ink');
    s.value = '';
    s.dispatchEvent(new Event('change'));
    expect(arts.overrides()).toEqual({});
  });

  it('keeps Clear All Overrides disabled until there is an override, then clears them all', () => {
    const { fixture, el, arts } = render();
    const clear = el.querySelector('button.clear') as HTMLButtonElement;
    expect(clear.disabled).toBe(true);
    arts.setOverride('cao-cao', 'ink');
    arts.setOverride('guan-yu', 'ink');
    fixture.detectChanges();
    expect(clear.disabled).toBe(false);
    clear.click();
    expect(arts.overrides()).toEqual({});
  });

  it('shows set names in Vietnamese', async () => {
    const { fixture, el } = render();
    await TestBed.inject(I18n).setLocale('vi');
    fixture.detectChanges();
    expect(el.textContent).toContain('Thủy mặc');
    expect(el.textContent).toContain('Cổ điển');
  });
});
