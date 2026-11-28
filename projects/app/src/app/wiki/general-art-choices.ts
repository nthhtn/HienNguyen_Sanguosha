import { Component, computed, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { artSetGeneralId, artSetName, generalSkinUrl, resolveArtSet, setsCovering } from 'content';
import { ArtSets } from '../art-sets.service';
import { I18n } from '../i18n/i18n.service';
import { TPipe } from '../i18n/t.pipe';

// All the artwork one General has, one tile per art set that covers it. A tile is a choice: pressing it pins the
// General to that set (as the picker's per General list does). The tile showing now is "In Use", a pinned one is
// "Pinned", and Follow Global Set takes the pin away. Used in each By General row and in the General entries' popup.
@Component({
  selector: 'app-general-art-choices',
  imports: [MatButtonModule, TPipe],
  template: `
    <ul class="choices" [class.large]="size() === 'large'">
      @for (t of tiles(); track t.set) {
        <li>
          <button type="button" class="tile" [attr.data-set]="t.set" [attr.aria-pressed]="t.inUse" (click)="artSets.setOverride(base(), t.set)">
            <img [src]="t.url" alt="" />
            <span class="set-name">{{ t.name }}</span>
            <span class="marks">
              @if (t.inUse) {
                <span class="mark in-use">{{ 'artSetsPage.inUse' | t }}</span>
              }
              @if (t.pinned) {
                <span class="mark pinned">{{ 'artSetsPage.pinned' | t }}</span>
              }
            </span>
          </button>
        </li>
      }
    </ul>
    <button mat-stroked-button type="button" class="follow" [disabled]="!pinned()" (click)="artSets.setOverride(base(), null)">{{ 'artSetsPage.followGlobal' | t }}</button>
  `,
  styles: `
    :host { display: block; }
    .choices { list-style: none; margin: 0 0 8px; padding: 0; display: flex; flex-wrap: wrap; gap: 10px; }
    .tile { display: grid; justify-items: center; gap: 4px; width: 96px; min-height: 44px; padding: 6px; font: inherit; color: inherit; background: none; border: 2px solid #c8c8c8; border-radius: 8px; cursor: pointer; }
    .large .tile { width: 132px; }
    .tile[aria-pressed='true'] { border-color: var(--mat-sys-primary, #1d5fa8); background: color-mix(in srgb, var(--mat-sys-primary, #1d5fa8) 10%, transparent); }
    .tile:focus-visible { outline: 2px solid var(--mat-sys-primary, #1d5fa8); outline-offset: 2px; }
    img { width: 100%; aspect-ratio: 3 / 4; object-fit: cover; object-position: top; border-radius: 4px; background: #e6e2d8; }
    .set-name { font-size: 0.85rem; font-weight: 600; text-align: center; overflow-wrap: anywhere; }
    .marks { display: flex; flex-wrap: wrap; gap: 4px; justify-content: center; min-height: 1.1em; }
    .mark { font-size: 0.72rem; padding: 0 6px; border-radius: 10px; background: #e0dccf; color: #444; }
    .mark.in-use { background: var(--mat-sys-primary, #1d5fa8); color: var(--mat-sys-on-primary, #fff); }
    .follow { min-height: 44px; }
  `,
})
export class GeneralArtChoices {
  protected readonly artSets = inject(ArtSets);
  private readonly i18n = inject(I18n);

  readonly general = input.required<string>();
  readonly size = input<'normal' | 'large'>('normal');

  protected readonly base = computed(() => artSetGeneralId(this.general()));
  protected readonly pinned = computed(() => this.artSets.overrides()[this.base()] !== undefined);

  protected readonly tiles = computed(() => {
    const catalog = this.artSets.catalog;
    const locale = this.i18n.locale();
    const base = this.base();
    const choice = this.artSets.choice();
    const shown = resolveArtSet(base, choice);
    const pin = this.artSets.overrides()[base];
    return setsCovering(base, catalog).map((set) => ({
      set,
      name: artSetName(catalog.sets[set], locale),
      url: generalSkinUrl(base, { global: set, overrides: {}, catalog }) ?? '',
      inUse: set === shown,
      pinned: set === pin,
    }));
  });
}
