import { Component, computed, inject, input } from '@angular/core';
import { HIDDEN_GENERAL_ART_URL, cardArtUrl, generalDisplayData } from 'content';
import { I18n } from '../../../i18n/i18n.service';
import type { SceneCardSize } from './scene-card';

// A General's card face, or the face-down General (id 'hidden'), shown with its real art.
@Component({
  selector: 'app-scene-general',
  template: `
    @if (url(); as url) {
      <img class="scene-card" [class]="size()" [src]="url" [alt]="alt()" />
    }
  `,
  styles: `
    :host { display: inline-block; line-height: 0; }
    .scene-card { aspect-ratio: 662 / 969; object-fit: cover; border-radius: 4px; box-shadow: 0 1px 3px rgb(0 0 0 / 0.35); background: var(--mat-sys-surface-container-high); }
    .tiny { width: 26px; } .small { width: 44px; } .normal { width: 70px; } .large { width: 160px; }
  `,
})
export class SceneGeneral {
  private readonly i18n = inject(I18n);
  readonly id = input.required<string>();
  readonly size = input<SceneCardSize>('normal');

  protected readonly url = computed(() => (this.id() === 'hidden' ? HIDDEN_GENERAL_ART_URL : cardArtUrl(this.id())));
  protected readonly alt = computed(() => (this.id() === 'hidden' ? this.i18n.t('rules.scene.hiddenGeneral') : (generalDisplayData(this.id(), this.i18n.locale())?.name ?? this.id())));
}
