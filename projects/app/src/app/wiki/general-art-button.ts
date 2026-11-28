import { Component, Injector, computed, inject, input } from '@angular/core';
import { artSetGeneralId, setsCovering } from 'content';
import { ArtSets } from '../art-sets.service';
import { TPipe } from '../i18n/t.pipe';

// "Art Sets (n)" under a General's portrait in the Wiki, opening a popup of that General's artwork in every set. It shows only
// when the General has alternates, so nothing appears until a second art set covers it.
@Component({
  selector: 'app-general-art-button',
  imports: [TPipe],
  template: `
    @if (count() > 1) {
      <button type="button" class="art-sets-button" (click)="open()">{{ 'wiki.artSets' | t: { count: count() } }}</button>
    }
  `,
  styles: `
    .art-sets-button { min-height: 44px; padding: 0 14px; font: inherit; font-size: 0.85rem; color: inherit; background: none; border: 1px solid var(--mat-sys-outline, #888); border-radius: 22px; cursor: pointer; }
    .art-sets-button:hover, .art-sets-button:focus-visible { background: var(--mat-sys-surface-container-high, #eee); }
  `,
})
export class GeneralArtButton {
  readonly general = input.required<string>();
  private readonly injector = inject(Injector);
  private readonly artSets = inject(ArtSets);

  protected readonly count = computed(() => setsCovering(artSetGeneralId(this.general()), this.artSets.catalog).length);

  protected async open(): Promise<void> {
    const { openGeneralArtDialog } = await import('./general-art-dialog');
    openGeneralArtDialog(this.injector, this.general());
  }
}
