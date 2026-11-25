import { Injectable, InjectionToken, computed, inject, signal } from '@angular/core';
import { ART_SET_CATALOG, DEFAULT_ART_SET, setsCovering, type ArtChoice, type ArtSetCatalog, type ArtSetId } from 'content';

// The catalog the choice resolves against: the generated one, replaceable in tests (the real one ships only classic until a second set is added).
export const ART_SET_CATALOG_TOKEN = new InjectionToken<ArtSetCatalog>('ART_SET_CATALOG', { providedIn: 'root', factory: () => ART_SET_CATALOG });

const GLOBAL_KEY = 'art-set';
const OVERRIDES_KEY = 'art-set-overrides';

// A viewer's art set choice: one global set and per-General overrides keyed by base General id. A per-viewer
// convenience, so storage can be missing or blocked: the choice then holds only for this visit. Stored values the
// catalog no longer supports are dropped on read, so a removed set never leaves a gap.
@Injectable({ providedIn: 'root' })
export class ArtSets {
  readonly catalog = inject(ART_SET_CATALOG_TOKEN);

  // Whether there is anything to choose between; the picker is offered only then.
  readonly multiple = this.catalog.order.length > 1;

  private readonly globalSet = signal<ArtSetId>(this.readGlobal());
  private readonly overrideMap = signal<Readonly<Record<string, ArtSetId>>>(this.readOverrides());

  readonly global = this.globalSet.asReadonly();
  readonly overrides = this.overrideMap.asReadonly();
  readonly choice = computed<ArtChoice>(() => ({ global: this.global(), overrides: this.overrides(), catalog: this.catalog }));

  selectGlobal(id: ArtSetId): void {
    if (!this.catalog.sets[id]) return;
    this.globalSet.set(id);
    this.write(GLOBAL_KEY, id);
  }

  // `null` clears the override. A set that has no portrait for the General is ignored.
  setOverride(baseId: string, id: ArtSetId | null): void {
    const next = { ...this.overrideMap() };
    if (id === null) delete next[baseId];
    else if (setsCovering(baseId, this.catalog).includes(id)) next[baseId] = id;
    else return;
    this.overrideMap.set(next);
    this.write(OVERRIDES_KEY, JSON.stringify(next));
  }

  clearOverrides(): void {
    this.overrideMap.set({});
    this.write(OVERRIDES_KEY, '{}');
  }

  private readGlobal(): ArtSetId {
    const stored = this.read(GLOBAL_KEY);
    return stored !== null && this.catalog.sets[stored] ? stored : DEFAULT_ART_SET;
  }

  private readOverrides(): Record<string, ArtSetId> {
    const result: Record<string, ArtSetId> = {};
    try {
      const parsed: unknown = JSON.parse(this.read(OVERRIDES_KEY) ?? '{}');
      if (parsed && typeof parsed === 'object') {
        for (const [general, set] of Object.entries(parsed)) {
          if (typeof set === 'string' && setsCovering(general, this.catalog).includes(set)) result[general] = set;
        }
      }
    } catch {
      // Unreadable value: no overrides.
    }
    return result;
  }

  private read(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private write(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Not remembered; the choice still holds for this visit.
    }
  }
}
