import { TestBed } from '@angular/core/testing';
import { generalSkinUrl } from 'content';
import { ArtSets } from '../art-sets.service';
import { fakeCatalog, provideFakeArtSets } from '../art-sets.testing';
import { I18n } from '../i18n/i18n.service';
import { GeneralArtChoices } from './general-art-choices';

function render(general: string) {
  TestBed.configureTestingModule({ imports: [GeneralArtChoices], providers: provideFakeArtSets() });
  const fixture = TestBed.createComponent(GeneralArtChoices);
  fixture.componentRef.setInput('general', general);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement, arts: TestBed.inject(ArtSets) };
}

const tile = (el: HTMLElement, set: string) => el.querySelector(`button.tile[data-set="${set}"]`) as HTMLButtonElement;
const follow = (el: HTMLElement) => el.querySelector('button.follow') as HTMLButtonElement;

describe('GeneralArtChoices', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('has one tile per set that covers the General, showing the picture the board shows for that set', () => {
    const { el } = render('guan-yu');
    const catalog = fakeCatalog();
    expect([...el.querySelectorAll('button.tile')].map((b) => b.getAttribute('data-set'))).toEqual(['classic', 'ink']);
    expect(tile(el, 'classic').querySelector('.set-name')!.textContent!.trim()).toBe('Classic');
    expect(tile(el, 'ink').querySelector('.set-name')!.textContent!.trim()).toBe('Ink Wash');
    for (const set of ['classic', 'ink']) {
      expect(tile(el, set).querySelector('img')!.getAttribute('src')).toBe(generalSkinUrl('guan-yu', { global: set, overrides: {}, catalog }));
    }
  });

  it('marks the set in use and the set pinned for this General', () => {
    const { fixture, el, arts } = render('guan-yu');
    expect(tile(el, 'classic').getAttribute('aria-pressed')).toBe('true');
    expect(tile(el, 'classic').querySelector('.in-use')).not.toBeNull();
    expect(el.querySelector('.pinned')).toBeNull();
    arts.setOverride('guan-yu', 'ink');
    fixture.detectChanges();
    expect(tile(el, 'ink').querySelector('.in-use')).not.toBeNull();
    expect(tile(el, 'ink').querySelector('.pinned')).not.toBeNull();
    expect(tile(el, 'classic').querySelector('.in-use')).toBeNull();
    expect(tile(el, 'classic').getAttribute('aria-pressed')).toBe('false');
  });

  it('pins the General to the set of a tile, even the set the global choice already shows', () => {
    const { fixture, el, arts } = render('guan-yu');
    tile(el, 'ink').click();
    fixture.detectChanges();
    expect(arts.overrides()).toEqual({ 'guan-yu': 'ink' });
    tile(el, 'classic').click();
    expect(arts.overrides()).toEqual({ 'guan-yu': 'classic' });
  });

  it('follows the global set again from Follow Global Set, which is disabled with no pin', () => {
    const { fixture, el, arts } = render('guan-yu');
    expect(follow(el).disabled).toBe(true);
    arts.setOverride('guan-yu', 'ink');
    fixture.detectChanges();
    expect(follow(el).disabled).toBe(false);
    follow(el).click();
    expect(arts.overrides()).toEqual({});
  });

  it('shows no pin for a stored override naming a set that is gone', () => {
    localStorage.setItem('art-set-overrides', JSON.stringify({ 'guan-yu': 'gone' }));
    const { el } = render('guan-yu');
    expect(el.querySelector('.pinned')).toBeNull();
    expect(follow(el).disabled).toBe(true);
  });

  it('treats a Kingdom Wars id as its base General and shares the pin', () => {
    const { fixture, el, arts } = render('kingdomWars:guan-yu');
    expect([...el.querySelectorAll('button.tile')].map((b) => b.getAttribute('data-set'))).toEqual(['classic', 'ink']);
    tile(el, 'ink').click();
    fixture.detectChanges();
    expect(arts.overrides()).toEqual({ 'guan-yu': 'ink' });
  });

  it('labels the tiles with Vietnamese set names in Vietnamese', async () => {
    const { fixture, el } = render('guan-yu');
    await TestBed.inject(I18n).setLocale('vi');
    fixture.detectChanges();
    expect(tile(el, 'ink').querySelector('.set-name')!.textContent!.trim()).toBe('Thủy mặc');
  });
});
