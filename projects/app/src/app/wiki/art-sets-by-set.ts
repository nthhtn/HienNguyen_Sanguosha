import { Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { artSetName, DEFAULT_ART_SET, generalSkinForce, generalSkinUrl, type GeneralForce } from 'content';
import { artGeneralName } from '../art-general-name';
import { ArtSets } from '../art-sets.service';
import { I18n } from '../i18n/i18n.service';
import type { MessageKey } from '../i18n/messages';
import { TPipe } from '../i18n/t.pipe';

const FORCES: readonly GeneralForce[] = ['Wei', 'Shu', 'Wu', 'Qun'];

// The Art Sets page, By Set: each set's artwork as a gallery of the Generals it covers, grouped by Force, with a button that makes it the global set.
@Component({
  selector: 'app-art-sets-by-set',
  imports: [MatButtonModule, TPipe],
  template: `
    @for (set of sets(); track set.id) {
      <section class="set" [attr.data-set]="set.id">
        <header>
          <div>
            <h3>{{ set.name }}</h3>
            <p class="coverage">{{ 'artSets.coverage' | t: { count: set.count, total: set.total } }}</p>
            <p class="provenance">{{ set.provenance }}</p>
          </div>
          <button mat-stroked-button type="button" class="use" [disabled]="set.inUse" (click)="artSets.selectGlobal(set.id)">
            {{ (set.inUse ? 'artSetsPage.inUse' : 'artSetsPage.use') | t }}
          </button>
        </header>
        @if (set.missing > 0) {
          <p class="fallback-note">{{ noteKey(set.missing) | t: { count: set.missing } }}</p>
        }
        @for (group of set.groups; track group.force) {
          <section class="force" [attr.data-force]="group.force">
            <h4>{{ forceKey(group.force) | t }}</h4>
            <div class="tiles">
              @for (g of group.generals; track g.id) {
                <figure class="tile" [attr.data-general]="g.id">
                  <img [src]="g.url" alt="" />
                  <figcaption>{{ g.name }}</figcaption>
                </figure>
              }
            </div>
          </section>
        }
      </section>
    }
  `,
  styles: `
    :host { display: grid; gap: 24px; }
    .set { padding: 16px 0; border-bottom: 1px solid var(--mat-sys-outline-variant); }
    header { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 12px; }
    h3 { margin: 0; font: var(--mat-sys-title-large); }
    h4 { margin: 12px 0 6px; font: var(--mat-sys-title-small); }
    p { margin: 2px 0; }
    .coverage, .provenance, .fallback-note { color: var(--mat-sys-on-surface-variant); font-size: 0.9rem; }
    .use { min-height: 44px; }
    .tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(84px, 1fr)); gap: 10px; }
    .tile { margin: 0; display: grid; gap: 4px; justify-items: center; }
    .tile img { width: 100%; aspect-ratio: 3 / 4; object-fit: cover; object-position: top; border-radius: 6px; background: #e6e2d8; }
    figcaption { font-size: 0.8rem; text-align: center; overflow-wrap: anywhere; }
  `,
})
export class ArtSetsBySet {
  protected readonly artSets = inject(ArtSets);
  private readonly i18n = inject(I18n);

  protected noteKey(missing: number): MessageKey {
    return missing === 1 ? 'artSetsPage.fallbackNote.one' : 'artSetsPage.fallbackNote';
  }

  protected forceKey(force: GeneralForce): MessageKey {
    return `label.kingdom.${force}`;
  }

  protected readonly sets = computed(() => {
    const catalog = this.artSets.catalog;
    const locale = this.i18n.locale();
    const global = this.artSets.global();
    const total = catalog.sets[DEFAULT_ART_SET].portraits.length;
    return catalog.order.map((id) => {
      const entry = catalog.sets[id];
      const groups = FORCES.map((force) => ({
        force,
        generals: entry.portraits
          .filter((general) => generalSkinForce(general) === force)
          .map((general) => ({
            id: general,
            name: artGeneralName(general, this.i18n),
            url: generalSkinUrl(general, { global: id, overrides: {}, catalog }) ?? '',
          })),
      })).filter((group) => group.generals.length > 0);
      return { id, name: artSetName(entry, locale), count: entry.portraits.length, total, missing: total - entry.portraits.length, provenance: entry.provenance, inUse: id === global, groups };
    });
  });
}
