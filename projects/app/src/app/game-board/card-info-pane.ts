import { Component, computed, inject, input } from '@angular/core';
import { CardInstance } from 'engine';
import { CardDisplayData, cardDisplayData } from 'content';
import { cardIdDisplayName } from '../labels';
import { PlayingCard } from './playing-card';
import { I18n } from '../i18n/i18n.service';
import { TPipe } from '../i18n/t.pipe';

// A card's details: its name, large art, kind and rules text. The body of the Info popup, and the pane that opens beside
// the History and Discard lists when a card is selected.
@Component({
  selector: 'app-card-info-pane',
  imports: [PlayingCard, TPipe],
  template: `
    @if (showName()) {
      <h3 class="name">{{ name() }}</h3>
    }
    <div class="content">
      <app-playing-card size="large" [card]="card()" [showName]="false" [showStat]="false" />
      <div class="details">
        @if (display(); as d) {
          <div class="kind">
            {{ categoryName(d.category) }}@if (d.subtype) { · {{ subtypeName(d.subtype) }} }@if (d.range !== null) { · {{ 'card.range' | t: { n: d.range } }} }@if (d.mount) { · {{ 'card.distance' | t: { n: d.mount === 'offensive' ? '-1' : '+1' } }} }
          </div>
          <p class="text">{{ d.text ?? ('card.noText' | t) }}</p>
        } @else {
          <p class="text">{{ 'card.noText' | t }}</p>
        }
      </div>
    </div>
  `,
  styles: `
    :host { display: block; }
    .name { margin: 0 0 12px; font: var(--mat-sys-title-large); }
    .content { display: flex; gap: 16px; flex-wrap: wrap; }
    .details { flex: 1; min-width: 180px; }
    .kind { font: var(--mat-sys-label-large); color: var(--mat-sys-primary); margin: 4px 0 8px; }
    .text { margin: 0; font: var(--mat-sys-body-medium); }
  `,
})
export class CardInfoPane {
  readonly card = input.required<CardInstance>();
  // Off where the host already shows the name as its title (the Info popup).
  readonly showName = input(true);
  private readonly i18n = inject(I18n);
  protected readonly display = computed(() => cardDisplayData(this.card().definitionId, this.i18n.locale()));
  protected readonly name = computed(() => this.display()?.name ?? cardIdDisplayName(this.card().definitionId, this.i18n.translator));

  protected categoryName(category: CardDisplayData['category']): string {
    return this.i18n.t(`card.category.${category}` as const);
  }

  protected subtypeName(subtype: NonNullable<CardDisplayData['subtype']>): string {
    return this.i18n.t(`card.subtype.${subtype}` as const);
  }
}
