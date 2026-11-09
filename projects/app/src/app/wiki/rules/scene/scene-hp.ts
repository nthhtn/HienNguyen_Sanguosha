import { Component, computed, inject, input } from '@angular/core';
import { hpIconUrls } from 'content';
import { I18n } from '../../../i18n/i18n.service';

// A row of HP icons; the ones beyond `hp` up to `max` are dimmed as lost.
@Component({
  selector: 'app-scene-hp',
  template: `
    @for (icon of icons(); track $index) {
      <img [class.lost]="icon.lost" [src]="icon.url" alt="" />
    }
  `,
  host: { role: 'img', '[attr.aria-label]': 'label()' },
  styles: `
    :host { display: inline-flex; gap: 2px; align-items: center; vertical-align: middle; }
    img { width: 20px; height: auto; }
    .lost { filter: grayscale(1) brightness(0.6); opacity: 0.5; }
  `,
})
export class SceneHp {
  private readonly i18n = inject(I18n);
  readonly hp = input.required<number>();
  readonly max = input<number>();

  protected readonly label = computed(() => {
    const max = this.max();
    return max !== undefined && max !== this.hp() ? this.i18n.t('rules.scene.hpOfMax', { n: this.hp(), max }) : this.i18n.t('rules.scene.hpCount', { n: this.hp() });
  });
  protected readonly icons = computed(() => hpIconUrls(this.max() ?? this.hp()).map((url, i) => ({ url, lost: i >= this.hp() })));
}
