import { Component, Injector, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { artSetName, DEFAULT_ART_SET, generalDisplayData, generalSkinUrl, setsCovering } from 'content';
import { ArtSets } from './art-sets.service';
import { I18n } from './i18n/i18n.service';
import { TPipe } from './i18n/t.pipe';
import { generalDisplayName } from './labels';

// The art set picker: one global set, and an override per General that some other set covers. The choice lives in ArtSets.
@Component({
  selector: 'app-art-sets-dialog',
  imports: [MatDialogModule, MatButtonModule, TPipe],
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
                <select [attr.aria-label]="g.name" (change)="artSets.setOverride(g.id, $any($event.target).value || null)">
                  <option value="" [selected]="!g.override">{{ 'artSets.useGlobal' | t: { set: globalName() } }}</option>
                  @for (s of g.sets; track s.id) {
                    <option [value]="s.id" [selected]="g.override === s.id">{{ s.name }}</option>
                  }
                </select>
              </li>
            }
          </ul>
          <button mat-button type="button" class="clear" [disabled]="!hasOverrides()" (click)="artSets.clearOverrides()">{{ 'artSets.clearAll' | t }}</button>
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
    .generals li { display: grid; grid-template-columns: 36px 1fr minmax(0, auto); gap: 10px; align-items: center; }
    .generals img { width: 36px; height: 48px; object-fit: cover; object-position: top; border-radius: 4px; }
    select { max-width: 100%; }
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

  protected readonly globalName = computed(() => artSetName(this.artSets.catalog.sets[this.artSets.global()], this.i18n.locale()));

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
        sets: setsCovering(id, catalog).map((set) => ({ id: set, name: artSetName(catalog.sets[set], locale) })),
      }));
  });
}

// Opens the picker. The app bar calls this through a dynamic import, so the dialog code and what it needs load only when asked for.
export function openArtSetsDialog(injector: Injector): void {
  injector.get(MatDialog).open(ArtSetsDialog);
}
