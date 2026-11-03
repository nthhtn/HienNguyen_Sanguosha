import { Component, computed, inject, input } from '@angular/core';
import { AMBITIONIST_ICON_URL, CHAIN_ICON_URL, generalDisplayData, generalSkinUrl } from 'content';
import { DAMAGE_IMAGE_URLS } from '../../../game-board/damage-effects';
import { I18n } from '../../../i18n/i18n.service';
import type { MessageKey } from '../../../i18n/messages';
import { TPipe } from '../../../i18n/t.pipe';

export type SceneForce = 'Wei' | 'Shu' | 'Wu' | 'Qun';

// A seat at the table: the General's portrait ringed in its Force colour, the seat's name and its Force.
@Component({
  selector: 'app-scene-seat',
  imports: [TPipe],
  template: `
    <span class="seat" [class.out]="out()" [class.selected]="selected()" [attr.data-force]="ambitionist() ? 'Ambitionist' : force()">
      <img class="scene-avatar" [src]="portrait()" [alt]="portraitName()" />
      @if (ambitionist()) {
        <img class="scene-ambitionist" [src]="ambitionistUrl" alt="" aria-hidden="true" />
      }
      @if (chained()) {
        <img class="scene-chain" [src]="chainUrl" [alt]="'seat.chained' | t" />
      }
      @if (markUrl(); as markUrl) {
        <img class="scene-mark" [src]="markUrl" alt="" aria-hidden="true" />
      }
      <span class="nm">{{ name() }}</span>
      @if (forceName(); as forceName) {
        <span class="force">{{ forceName }}</span>
      }
      @if (note(); as note) {
        <span class="note">{{ note }}</span>
      }
    </span>
  `,
  styles: `
    :host { display: inline-block; }
    .seat { position: relative; display: flex; flex-direction: column; align-items: center; gap: 2px; width: var(--seat-w, 88px); text-align: center; }
    .scene-avatar { width: var(--seat-av, 60px); height: var(--seat-av, 60px); border-radius: 50%; object-fit: cover; object-position: 50% 14%; border: 3px solid var(--force, var(--mat-sys-outline-variant)); background: var(--mat-sys-surface-container-high); }
    .nm { font: var(--mat-sys-label-large); line-height: 1.15; }
    .force { font: var(--mat-sys-label-small); color: var(--force-text, var(--mat-sys-on-surface-variant)); }
    .note { font: var(--mat-sys-label-small); color: var(--mat-sys-on-surface-variant); }
    /* The portrait is --seat-av wide, centred in the --seat-w box: the chain sits on its top right corner, the damage mark on its centre. */
    .scene-chain { position: absolute; top: -6px; right: calc((var(--seat-w, 88px) - var(--seat-av, 60px)) / 2 - 8px); width: 28px; filter: drop-shadow(0 1px 1px rgb(0 0 0 / 0.6)); }
    /* The Game screen's Ambitionist mark, on the portrait's bottom right corner. */
    .scene-ambitionist { position: absolute; top: calc(var(--seat-av, 60px) - 26px); right: calc((var(--seat-w, 88px) - var(--seat-av, 60px)) / 2 - 10px); width: 30px; filter: drop-shadow(0 1px 1px rgb(0 0 0 / 0.6)); pointer-events: none; }
    .scene-mark { position: absolute; top: calc(var(--seat-av, 60px) / 2); left: 50%; width: 52px; transform: translate(-50%, -50%); pointer-events: none; }
    .selected .scene-avatar { box-shadow: 0 0 0 3px var(--mat-sys-surface), 0 0 0 6px var(--mat-sys-primary); }
    .out .scene-avatar { filter: grayscale(1); opacity: 0.4; }
  `,
})
export class SceneSeat {
  private readonly i18n = inject(I18n);
  readonly general = input.required<string>();
  readonly n = input.required<number>();
  readonly force = input<SceneForce>();
  readonly out = input(false);
  // Plays alone, for no Force: the Ambitionist mark and label take the place of the Force's.
  readonly ambitionist = input(false);
  readonly selected = input(false);
  readonly label = input<string>();
  readonly chained = input(false);
  readonly mark = input<keyof typeof DAMAGE_IMAGE_URLS>();
  readonly note = input<string>();

  protected readonly chainUrl = CHAIN_ICON_URL;
  protected readonly ambitionistUrl = AMBITIONIST_ICON_URL;

  protected readonly markUrl = computed(() => {
    const mark = this.mark();
    return mark ? DAMAGE_IMAGE_URLS[mark] : null;
  });
  protected readonly portrait = computed(() => generalSkinUrl(this.general()) ?? '');
  protected readonly portraitName = computed(() => generalDisplayData(this.general(), this.i18n.locale())?.name ?? '');
  protected readonly name = computed(() => this.label() ?? this.i18n.t('label.seat', { n: this.n() }));
  protected readonly forceName = computed(() => {
    if (this.ambitionist()) return this.i18n.t('label.kingdom.Ambitionist');
    const force = this.force();
    return force ? this.i18n.t(`label.kingdom.${force}` as MessageKey) : null;
  });
}
