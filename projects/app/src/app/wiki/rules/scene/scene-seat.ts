import { Component, computed, inject, input } from '@angular/core';
import { generalDisplayData, generalSkinUrl } from 'content';
import { I18n } from '../../../i18n/i18n.service';
import type { MessageKey } from '../../../i18n/messages';

export type SceneForce = 'Wei' | 'Shu' | 'Wu' | 'Qun';

// A seat at the table: the General's portrait ringed in its Force colour, the seat's name and its Force.
@Component({
  selector: 'app-scene-seat',
  template: `
    <div class="seat" [class.out]="out()" [attr.data-force]="force()">
      <img class="scene-avatar" [src]="portrait()" [alt]="portraitName()" />
      <span class="nm">{{ name() }}</span>
      @if (forceName(); as forceName) {
        <span class="force">{{ forceName }}</span>
      }
    </div>
  `,
  styles: `
    :host { display: inline-block; }
    .seat { display: flex; flex-direction: column; align-items: center; gap: 2px; width: 88px; text-align: center; }
    .scene-avatar { width: 60px; height: 60px; border-radius: 50%; object-fit: cover; object-position: 50% 14%; border: 3px solid var(--force, var(--mat-sys-outline-variant)); background: var(--mat-sys-surface-container-high); }
    .nm { font: var(--mat-sys-label-large); line-height: 1.15; }
    .force { font: var(--mat-sys-label-small); color: var(--force-text, var(--mat-sys-on-surface-variant)); }
    .out .scene-avatar { filter: grayscale(1); opacity: 0.4; }
  `,
})
export class SceneSeat {
  private readonly i18n = inject(I18n);
  readonly general = input.required<string>();
  readonly n = input.required<number>();
  readonly force = input<SceneForce>();
  readonly out = input(false);
  readonly label = input<string>();

  protected readonly portrait = computed(() => generalSkinUrl(this.general()) ?? '');
  protected readonly portraitName = computed(() => generalDisplayData(this.general(), this.i18n.locale())?.name ?? '');
  protected readonly name = computed(() => this.label() ?? this.i18n.t('label.seat', { n: this.n() }));
  protected readonly forceName = computed(() => {
    const force = this.force();
    return force ? this.i18n.t(`label.kingdom.${force}` as MessageKey) : null;
  });
}
