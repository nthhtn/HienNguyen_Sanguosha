import type { Provider } from '@angular/core';
import type { ArtSetCatalog } from 'content';
import { ART_SET_CATALOG_TOKEN } from './art-sets.service';

// A catalog with a second, partial set, for tests: the real one ships only classic until a second art set is added.
export function fakeCatalog(): ArtSetCatalog {
  return {
    order: ['classic', 'ink'],
    sets: {
      classic: { names: { en: 'Classic', vi: 'Cổ điển' }, provenance: 'test', portraits: ['cao-cao', 'guan-yu', 'zhang-fei', 'zhao-yun'], faces: ['cao-cao', 'guan-yu', 'zhang-fei', 'zhao-yun'] },
      ink: { names: { en: 'Ink Wash', vi: 'Thủy mặc' }, provenance: 'test', portraits: ['cao-cao', 'guan-yu'], faces: ['cao-cao'] },
    },
  };
}

export function provideFakeArtSets(): Provider[] {
  return [{ provide: ART_SET_CATALOG_TOKEN, useValue: fakeCatalog() }];
}
