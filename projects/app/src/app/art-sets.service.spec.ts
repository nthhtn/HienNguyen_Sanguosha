import { TestBed } from '@angular/core/testing';
import { ART_SET_CATALOG_TOKEN, ArtSets } from './art-sets.service';
import { fakeCatalog, provideFakeArtSets } from './art-sets.testing';

function service(withFake = true): ArtSets {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: withFake ? provideFakeArtSets() : [] });
  return TestBed.inject(ArtSets);
}

describe('ArtSets', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => jest.restoreAllMocks());

  it('starts on classic with no overrides, and is multiple only with more than one set', () => {
    expect(service(false).multiple).toBe(false);
    const arts = service();
    expect(arts.multiple).toBe(true);
    expect(arts.global()).toBe('classic');
    expect(arts.overrides()).toEqual({});
    expect(arts.choice()).toEqual({ global: 'classic', overrides: {}, catalog: fakeCatalog() });
    expect(TestBed.inject(ART_SET_CATALOG_TOKEN)).toEqual(fakeCatalog());
  });

  it('stores the global set and reads it back in a new service', () => {
    service().selectGlobal('ink');
    expect(localStorage.getItem('art-set')).toBe('ink');
    expect(service().global()).toBe('ink');
  });

  it('ignores an unknown set as the global set', () => {
    const arts = service();
    arts.selectGlobal('gone');
    expect(arts.global()).toBe('classic');
  });

  it('stores an override as JSON, clears it with null, and ignores a set that lacks the General', () => {
    const arts = service();
    arts.setOverride('guan-yu', 'ink');
    expect(arts.choice().overrides).toEqual({ 'guan-yu': 'ink' });
    expect(JSON.parse(localStorage.getItem('art-set-overrides')!)).toEqual({ 'guan-yu': 'ink' });
    arts.setOverride('zhao-yun', 'ink');
    expect(arts.overrides()).toEqual({ 'guan-yu': 'ink' });
    arts.setOverride('guan-yu', null);
    expect(arts.overrides()).toEqual({});
  });

  it('clears every override and the stored key', () => {
    const arts = service();
    arts.setOverride('guan-yu', 'ink');
    arts.setOverride('cao-cao', 'ink');
    arts.clearOverrides();
    expect(arts.overrides()).toEqual({});
    expect(JSON.parse(localStorage.getItem('art-set-overrides')!)).toEqual({});
  });

  it('falls back to classic for a stored global set the catalog lacks', () => {
    localStorage.setItem('art-set', 'gone');
    expect(service().global()).toBe('classic');
  });

  it('drops stored overrides that name a missing set or a set that lacks the General, and survives bad JSON', () => {
    localStorage.setItem('art-set-overrides', JSON.stringify({ 'guan-yu': 'ink', 'cao-cao': 'gone', 'zhao-yun': 'ink', 'zhang-fei': 7 }));
    expect(service().overrides()).toEqual({ 'guan-yu': 'ink' });
    localStorage.setItem('art-set-overrides', '{not json');
    expect(service().overrides()).toEqual({});
  });

  it('still works for the visit when storage throws', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const arts = service();
    expect(arts.global()).toBe('classic');
    arts.selectGlobal('ink');
    arts.setOverride('guan-yu', 'classic');
    expect(arts.global()).toBe('ink');
    expect(arts.overrides()).toEqual({ 'guan-yu': 'classic' });
  });
});
