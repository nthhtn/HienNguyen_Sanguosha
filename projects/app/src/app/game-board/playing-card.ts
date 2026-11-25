import { Component, computed, input, inject } from '@angular/core';
import { CardInstance } from 'engine';
import { cardDisplayData, cardNature } from 'content';
import { cardFaceLabel, cardIdDisplayName } from '../labels';
import { CardArt } from './card-art';
import { I18n } from '../i18n/i18n.service';
import { TPipe } from '../i18n/t.pipe';

// A card as it sits in a hand or on the table: its art, its suit and number in
// the corner, and its name along the bottom. Never its rules text — that is
// for the Info popup.
@Component({
  selector: 'app-playing-card',
  imports: [CardArt, TPipe],
  template: `
    <div class="card" [class.small]="size() === 'small'" [class.large]="size() === 'large'" [attr.title]="showFace() ? ('card.named' | t: { name: name(), face: face() }) : name()">
      <app-card-art [cropped]="true" [size]="size()" [id]="card().definitionId" [label]="name()" />
      <div class="overlays">
        @if (showFace()) {
          <span class="face" [class.red]="red()">{{ face() }}</span>
        }
        @if (nature(); as nature) {
          <span class="nature" [class.fire]="nature === 'fire'" [class.thunder]="nature === 'thunder'" aria-hidden="true">{{ nature === 'fire' ? '🔥' : '⚡' }}</span>
        }
        @if (showStat() && stat(); as stat) {
          <span class="stat">{{ stat }}</span>
        }
        @if (showName()) {
          <span class="name"><span class="name-text">{{ name() }}</span></span>
        }
      </div>
    </div>
  `,
  styles: `
    :host { display: block; width: fit-content; max-width: 100%; }
    .card { position: relative; display: block; line-height: 0; overflow: hidden; border-radius: 4px; }
    .card.large { border-radius: 0; }
    .card app-card-art { display: block; width: 100%; height: auto; }
    .overlays { position: absolute; inset: 0; overflow: hidden; border-radius: inherit; pointer-events: none; }
    .face {
      position: absolute; top: 0; left: 0; max-width: calc(100% - 4px); padding: 2px 4px; border-radius: 0 0 4px 0; box-sizing: border-box;
      background: rgb(255 255 255 / 92%); color: #1b1b1b; box-shadow: 0 0 2px rgb(0 0 0 / 40%);
      font: 700 13px/1 system-ui, sans-serif; white-space: nowrap;
    }
    .face.red { color: #c62828; }
    /* An elemental Sha: the cropped art no longer shows the frame's flame or bolt. */
    .nature {
      position: absolute; top: 0; right: 0; padding: 2px 3px; border-radius: 0 0 0 4px; color: #fff;
      box-shadow: 0 0 2px rgb(0 0 0 / 40%); font: 12px/1 system-ui, sans-serif;
    }
    .nature.fire { background: #d84315; }
    .nature.thunder { background: #5e35b1; }
    .small .nature { padding: 1px 2px; font-size: 9px; border-radius: 0 0 0 3px; }
    .large .nature { top: 0; right: 0; padding: 4px 6px; font-size: 20px; border-radius: 0 0 0 6px; }
    .name {
      position: absolute; left: 0; right: 0; bottom: 0; padding: 0; border-radius: 0 0 3px 3px; box-sizing: border-box;
      background: rgb(0 0 0 / 68%); overflow: hidden;
    }
    .name-text {
      display: block; padding: 3px 2px; color: #fff; text-align: center;
      font: 600 11px/1.1 system-ui, sans-serif; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    /* A weapon's range or a mount's distance: the cropped art no longer shows it. */
    .stat {
      position: absolute; right: 0; bottom: 19px; min-width: 14px; box-sizing: border-box; padding: 1px 3px; border-radius: 4px 0 0 0;
      background: rgb(255 255 255 / 92%); color: #1b1b1b; box-shadow: 0 0 2px rgb(0 0 0 / 40%);
      font: 700 12px/1.1 system-ui, sans-serif; text-align: center; white-space: nowrap;
    }
    .small .stat { bottom: 27px; min-width: 11px; padding: 0 2px; font-size: 9px; border-radius: 3px 0 0 0; }
    .large .stat { bottom: 36px; min-width: 28px; padding: 3px 7px; font-size: 20px; border-radius: 6px 0 0 0; }
    .small .face { padding: 1px 2px; font-size: 9px; border-radius: 0 0 3px 0; }
    .large .face { padding: 4px 7px; font-size: 20px; border-radius: 0 0 6px 0; }
    .large .name { border-radius: 0; }
    .large .name-text { padding: 7px 4px; font-size: 17px; }
    /* Slots are narrow: let the name wrap (up to three lines) rather than cut it. */
    .small .name-text {
      padding: 1px; font-size: 7.5px; line-height: 1.05; white-space: normal; overflow-wrap: anywhere;
      display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;
    }
  `,
})
export class PlayingCard {
  readonly card = input.required<CardInstance>();
  readonly size = input<'normal' | 'small' | 'large'>('normal');
  // The name banner along the bottom; off where the name is already a heading.
  readonly showName = input(true);
  // The range or distance badge; off where it is written out as text.
  readonly showStat = input(true);
  // The suit and number; off for a card a skill makes from nothing, which has none.
  readonly showFace = input(true);

  private readonly i18n = inject(I18n);

  protected readonly name = computed(
    () => cardDisplayData(this.card().definitionId, this.i18n.locale())?.name ?? cardIdDisplayName(this.card().definitionId, this.i18n.translator)
  );
  // A weapon's attack range, or a mount's distance, as a bare number.
  protected readonly stat = computed(() => {
    const data = cardDisplayData(this.card().definitionId, this.i18n.locale());
    if (!data) return null;
    if (data.range !== null) return String(data.range);
    if (!data.mount) return null;
    return data.mount === 'offensive' ? '-1' : '+1';
  });
  protected readonly nature = computed(() => cardNature(this.card().definitionId));
  protected readonly face = computed(() => cardFaceLabel(this.card()));
  protected readonly red = computed(() => this.card().suit === 'heart' || this.card().suit === 'diamond');
}
