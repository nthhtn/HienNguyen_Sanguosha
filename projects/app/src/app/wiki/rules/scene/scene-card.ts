import { Component, computed, inject, input } from '@angular/core';
import { CARD_BACK_ART_URL, cardArtUrl, cardDisplayData } from 'content';
import { I18n } from '../../../i18n/i18n.service';

export type SceneCardSize = 'tiny' | 'small' | 'normal' | 'large';

// A deck card, or the back of one (id 'back'), shown with its real art.
@Component({
  selector: 'app-scene-card',
  template: `
    @if (url(); as url) {
      <img class="scene-card" [class]="size()" [class.dim]="dim()" [src]="url" [alt]="alt()" />
    }
  `,
  styles: `
    :host { display: inline-block; line-height: 0; }
    .scene-card { aspect-ratio: 662 / 969; object-fit: cover; border-radius: 4px; box-shadow: 0 1px 3px rgb(0 0 0 / 0.35); background: var(--mat-sys-surface-container-high); }
    .tiny { width: 26px; } .small { width: 44px; } .normal { width: 70px; } .large { width: 160px; }
    .dim { opacity: 0.4; filter: grayscale(1); }
  `,
})
export class SceneCard {
  private readonly i18n = inject(I18n);
  readonly id = input.required<string>();
  readonly size = input<SceneCardSize>('normal');
  readonly dim = input(false);

  protected readonly url = computed(() => (this.id() === 'back' ? CARD_BACK_ART_URL : cardArtUrl(this.id())));
  protected readonly alt = computed(() => (this.id() === 'back' ? this.i18n.t('rules.scene.cardBack') : (cardDisplayData(this.id(), this.i18n.locale())?.name ?? '')));
}
