import { Component, computed, inject } from '@angular/core';
import { DEFAULT_ART_SET, generalSkinForce, setsCovering } from 'content';
import { artGeneralName } from '../art-general-name';
import { ArtSets } from '../art-sets.service';
import { I18n } from '../i18n/i18n.service';
import type { MessageKey } from '../i18n/messages';
import { TPipe } from '../i18n/t.pipe';
import { GeneralArtChoices } from './general-art-choices';

// The Art Sets page, By General: one row for each General that more than one art set covers, with all of its artwork to choose from.
@Component({
  selector: 'app-art-sets-by-general',
  imports: [GeneralArtChoices, TPipe],
  template: `
    @if (rows().length) {
      <ul class="rows">
        @for (row of rows(); track row.id) {
          <li class="row" [attr.data-general]="row.id">
            <h3>
              {{ row.name }}
              @if (row.forceKey; as key) {
                <span class="force">{{ key | t }}</span>
              }
            </h3>
            <app-general-art-choices [general]="row.id" />
          </li>
        }
      </ul>
    } @else {
      <p class="empty">{{ 'artSetsPage.noChoices' | t }}</p>
    }
  `,
  styles: `
    :host { display: block; }
    .rows { list-style: none; margin: 0; padding: 0; }
    .row { padding: 16px 0; border-bottom: 1px solid var(--mat-sys-outline-variant); }
    h3 { margin: 0 0 8px; font: var(--mat-sys-title-medium); }
    .force { margin-left: 8px; font: var(--mat-sys-label-medium); color: var(--mat-sys-on-surface-variant); }
    .empty { color: var(--mat-sys-on-surface-variant); }
  `,
})
export class ArtSetsByGeneral {
  private readonly artSets = inject(ArtSets);
  private readonly i18n = inject(I18n);

  protected readonly rows = computed(() => {
    const catalog = this.artSets.catalog;
    return catalog.sets[DEFAULT_ART_SET].portraits
      .filter((id) => setsCovering(id, catalog).length > 1)
      .map((id) => {
        const force = generalSkinForce(id);
        return {
          id,
          name: artGeneralName(id, this.i18n),
          forceKey: force ? (`label.kingdom.${force}` as MessageKey) : null,
        };
      });
  });
}
