import { TestBed } from '@angular/core/testing';
import { provideFakeArtSets, soloCatalog } from '../art-sets.testing';
import { ART_SET_CATALOG_TOKEN } from '../art-sets.service';
import { ArtSetsByGeneral } from './art-sets-by-general';

function render(providers = provideFakeArtSets()) {
  TestBed.configureTestingModule({ imports: [ArtSetsByGeneral], providers });
  const fixture = TestBed.createComponent(ArtSetsByGeneral);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('ArtSetsByGeneral', () => {
  it('has a row for each General more than one set covers, in classic order, each with its choices', () => {
    const el = render();
    const rows = [...el.querySelectorAll('li.row')];
    expect(rows.map((r) => r.getAttribute('data-general'))).toEqual(['cao-cao', 'guan-yu']);
    expect(rows[1].textContent).toContain('Guan Yu');
    expect([...rows[1].querySelectorAll('button.tile')].map((t) => t.getAttribute('data-set'))).toEqual(['classic', 'ink']);
    expect(el.querySelector('p.empty')).toBeNull();
  });

  it('says so when no General has more than one art set', () => {
    const el = render([{ provide: ART_SET_CATALOG_TOKEN, useValue: soloCatalog() }]);
    expect(el.querySelectorAll('li.row')).toHaveLength(0);
    expect(el.querySelector('p.empty')!.textContent!.trim()).toBe('No General has more than one art set yet.');
  });
});
