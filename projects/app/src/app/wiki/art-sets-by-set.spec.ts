import { TestBed } from '@angular/core/testing';
import { generalSkinUrl } from 'content';
import { ART_SET_CATALOG_TOKEN, ArtSets } from '../art-sets.service';
import { fakeCatalog, provideFakeArtSets } from '../art-sets.testing';
import { I18n } from '../i18n/i18n.service';
import { ArtSetsBySet } from './art-sets-by-set';

function render() {
  TestBed.configureTestingModule({ imports: [ArtSetsBySet], providers: provideFakeArtSets() });
  const fixture = TestBed.createComponent(ArtSetsBySet);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement, arts: TestBed.inject(ArtSets) };
}

const section = (el: HTMLElement, set: string) => el.querySelector(`section.set[data-set="${set}"]`) as HTMLElement;
const text = (e: Element | null) => e!.textContent!.replace(/\s+/g, ' ').trim();
const ids = (el: Element) => [...el.querySelectorAll('figure.tile')].map((t) => t.getAttribute('data-general'));

describe('ArtSetsBySet', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('has a section per set in catalog order, with its coverage and provenance', () => {
    const { el } = render();
    expect([...el.querySelectorAll('section.set')].map((s) => s.getAttribute('data-set'))).toEqual(['classic', 'ink']);
    expect(text(section(el, 'classic').querySelector('.coverage'))).toBe('4 of 4 Generals');
    expect(text(section(el, 'ink').querySelector('.coverage'))).toBe('2 of 4 Generals');
    expect(text(section(el, 'ink').querySelector('.provenance'))).toBe('test');
  });

  it('shows the description in Vietnamese in Vietnamese', async () => {
    const { fixture, el } = render();
    await TestBed.inject(I18n).setLocale('vi');
    fixture.detectChanges();
    expect(text(section(el, 'ink').querySelector('.provenance'))).toBe('thử');
  });

  it('groups the Generals a set covers by Force in the order Wei, Shu, Wu, Qun, leaving empty Forces out', () => {
    const { el } = render();
    const classic = section(el, 'classic');
    expect([...classic.querySelectorAll('section.force')].map((f) => f.getAttribute('data-force'))).toEqual(['Wei', 'Shu']);
    expect(ids(classic.querySelector('section.force[data-force="Shu"]')!)).toEqual(['guan-yu', 'zhang-fei', 'zhao-yun']);
    expect(ids(section(el, 'ink'))).toEqual(['cao-cao', 'guan-yu']);
  });

  it("shows each General's picture from that set, as the board does", () => {
    const { el } = render();
    const tile = section(el, 'ink').querySelector('figure.tile[data-general="guan-yu"]')!;
    expect(tile.querySelector('img')!.getAttribute('src')).toBe(generalSkinUrl('guan-yu', { global: 'ink', overrides: {}, catalog: fakeCatalog() }));
    expect(text(tile.querySelector('figcaption'))).toBe('Guan Yu');
  });

  it('notes how many Generals fall back to Classic in a partial set, and not in a complete one', () => {
    const { el } = render();
    expect(text(section(el, 'ink').querySelector('.fallback-note'))).toBe('2 Generals show their Classic portrait in this set.');
    expect(section(el, 'classic').querySelector('.fallback-note')).toBeNull();
  });

  it('says "1 General shows" when a set lacks exactly one General', () => {
    const base = fakeCatalog();
    const catalog = { ...base, sets: { ...base.sets, ink: { ...base.sets['ink'], portraits: ['cao-cao', 'guan-yu', 'zhang-fei'] } } };
    TestBed.configureTestingModule({ imports: [ArtSetsBySet], providers: [{ provide: ART_SET_CATALOG_TOKEN, useValue: catalog }] });
    const fixture = TestBed.createComponent(ArtSetsBySet);
    fixture.detectChanges();
    expect(text((fixture.nativeElement as HTMLElement).querySelector('section.set[data-set="ink"] .fallback-note'))).toBe('1 General shows its Classic portrait in this set.');
  });

  it('sets the global set from Use This Set, then shows In Use on it', () => {
    const { fixture, el, arts } = render();
    const use = (set: string) => section(el, set).querySelector('button.use') as HTMLButtonElement;
    expect(text(use('classic'))).toBe('In Use');
    expect(use('classic').disabled).toBe(true);
    expect(text(use('ink'))).toBe('Use This Set');
    use('ink').click();
    fixture.detectChanges();
    expect(arts.global()).toBe('ink');
    expect(text(use('ink'))).toBe('In Use');
    expect(use('ink').disabled).toBe(true);
    expect(text(use('classic'))).toBe('Use This Set');
  });
});
