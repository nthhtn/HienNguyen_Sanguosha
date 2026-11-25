import { Component, Injector, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { artSetName, DEFAULT_ART_SET, generalDisplayData, generalSkinUrl, resolveArtSet, setsCovering } from 'content';
import { ArtSets } from './art-sets.service';
import { I18n } from './i18n/i18n.service';
import { TPipe } from './i18n/t.pipe';
import { generalDisplayName } from './labels';

// The art set picker: one global set, and an override per General that some other set covers. The choice lives in ArtSets.
@Component({
  selector: 'app-art-sets-dialog',
  imports: [MatDialogModule, MatButtonModule, MatFormFieldModule, MatSelectModule, TPipe],
  template: `
    <h2 mat-dialog-title>{{ 'artSets.title' | t }}</h2>
    <mat-dialog-content class="content">
      <section>
        <h3>{{ 'artSets.global' | t }}</h3>
        <p class="hint">{{ 'artSets.globalHint' | t }}</p>
        <div class="sets" role="radiogroup" [attr.aria-label]="'artSets.global' | t">
          @for (set of sets(); track set.id) {
            <label class="set" [class.selected]="artSets.global() === set.id">
              <input type="radio" name="art-set" [value]="set.id" [checked]="artSets.global() === set.id" (change)="artSets.selectGlobal(set.id)" />
              <span class="name">{{ set.name }}</span>
              <span class="coverage">{{ 'artSets.coverage' | t: { count: set.count, total: total() } }}</span>
              <span class="previews">
                @for (url of set.previews; track url) {
                  <img [src]="url" alt="" />
                }
              </span>
            </label>
          }
        </div>
      </section>
      @if (generals().length) {
        <section>
          <h3>{{ 'artSets.perGeneral' | t }}</h3>
          <p class="hint">{{ 'artSets.perGeneralHint' | t }}</p>
          <ul class="generals">
            @for (g of generals(); track g.id) {
              <li [attr.data-general]="g.id">
                <img [src]="g.url" alt="" />
                <span class="general-name">{{ g.name }}</span>
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                  <mat-select [aria-label]="g.name" [value]="g.override ?? ''" (selectionChange)="artSets.setOverride(g.id, $event.value || null)">
                    <mat-option value="">{{ 'artSets.useGlobal' | t: { set: g.globalName } }}</mat-option>
                    @for (s of g.sets; track s.id) {
                      <mat-option [value]="s.id">{{ s.name }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
              </li>
            }
          </ul>
          <button mat-stroked-button type="button" class="clear" [disabled]="!hasOverrides()" (click)="artSets.clearOverrides()">{{ 'artSets.clearAll' | t }}</button>
        </section>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>{{ 'artSets.done' | t }}</button>
    </mat-dialog-actions>
  `,
  styles: `
    .content { display: grid; gap: 20px; min-width: min(420px, 100%); }
    h3 { margin: 0 0 4px; font-size: 1rem; }
    .hint { margin: 0 0 8px; color: #666; font-size: 0.85rem; }
    .sets { display: grid; gap: 8px; }
    .set { display: grid; grid-template-columns: auto 1fr; grid-template-areas: 'radio name' 'radio coverage' '. previews'; gap: 2px 10px; align-items: center; padding: 8px 10px; border: 1px solid #c8c8c8; border-radius: 8px; cursor: pointer; }
    .set.selected { border-color: var(--mat-sys-primary, #1d5fa8); background: color-mix(in srgb, var(--mat-sys-primary, #1d5fa8) 10%, transparent); }
    .set input { grid-area: radio; }
    .name { grid-area: name; font-weight: 600; }
    .coverage { grid-area: coverage; color: #666; font-size: 0.85rem; }
    .previews { grid-area: previews; display: flex; gap: 6px; margin-top: 4px; }
    .previews img { width: 44px; height: 58px; object-fit: cover; object-position: top; border-radius: 4px; }
    .generals { list-style: none; margin: 0 0 8px; padding: 0; display: grid; gap: 6px; }
    .generals li { display: grid; grid-template-columns: 36px minmax(0, 1fr) minmax(0, 270px); gap: 6px 12px; align-items: center; }
    .general-name { min-width: 0; overflow-wrap: anywhere; }
    .generals img { width: 36px; height: 48px; object-fit: cover; object-position: top; border-radius: 4px; }
    .set input { accent-color: var(--mat-sys-primary, #1d5fa8); }
    /* Material's select, so the chevron and the option list match the rest of the app; kept compact for a row. */
    mat-form-field { width: 100%; font-size: 0.9rem; --mat-form-field-container-height: 44px; --mat-form-field-container-vertical-padding: 10px; }
    .clear { min-height: 44px; }
    @media (max-width: 520px) {
      .generals li { grid-template-columns: 36px minmax(0, 1fr); }
      .generals mat-form-field { grid-column: 1 / -1; }
    }
  `,
})
export class ArtSetsDialog {
  protected readonly artSets = inject(ArtSets);
  private readonly i18n = inject(I18n);

  protected readonly total = computed(() => this.artSets.catalog.sets[DEFAULT_ART_SET].portraits.length);

  protected readonly sets = computed(() => {
    const catalog = this.artSets.catalog;
    const locale = this.i18n.locale();
    return catalog.order.map((id) => {
      const entry = catalog.sets[id];
      return {
        id,
        name: artSetName(entry, locale),
        count: entry.portraits.length,
        previews: entry.portraits.slice(0, 3).map((general) => generalSkinUrl(general, { global: id, overrides: {}, catalog }) ?? ''),
      };
    });
  });

  protected readonly hasOverrides = computed(() => Object.keys(this.artSets.overrides()).length > 0);

  // Generals a set other than classic covers: the only ones with something to choose.
  protected readonly generals = computed(() => {
    const catalog = this.artSets.catalog;
    const locale = this.i18n.locale();
    const choice = this.artSets.choice();
    const overrides = this.artSets.overrides();
    return catalog.sets[DEFAULT_ART_SET].portraits
      .filter((id) => setsCovering(id, catalog).length > 1)
      .map((id) => ({
        id,
        name: generalDisplayData(id, locale)?.name ?? generalDisplayName(id, this.i18n.translator),
        url: generalSkinUrl(id, choice) ?? '',
        override: overrides[id],
        // The set that shows when this General follows the global set: Classic where the global set lacks it.
        globalName: artSetName(catalog.sets[resolveArtSet(id, { global: this.artSets.global(), overrides: {}, catalog })], locale),
        sets: setsCovering(id, catalog).map((set) => ({ id: set, name: artSetName(catalog.sets[set], locale) })),
      }));
  });
}

// Opens the picker. The app bar calls this through a dynamic import, so the dialog code and what it needs load only when asked for.
export function openArtSetsDialog(injector: Injector): void {
  injector.get(MatDialog).open(ArtSetsDialog);
}
