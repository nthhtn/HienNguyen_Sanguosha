import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { CardInstance } from 'engine';
import { CardDisplayData, cardDisplayData } from 'content';
import { cardIdDisplayName } from '../labels';
import { PlayingCard } from './playing-card';
import { I18n } from '../i18n/i18n.service';
import { TPipe } from '../i18n/t.pipe';
import { englishTranslator, localeOf, Translator } from '../i18n/translator';

export interface CardInfoDialogData {
  card: CardInstance;
  name: string;
}

// Read-only card details (art, printing, rules text) for a card in the hand.
@Component({
  selector: 'app-card-info-dialog',
  imports: [MatDialogModule, MatButtonModule, PlayingCard, TPipe],
  template: `
    <h2 mat-dialog-title>{{ data.name }}</h2>
    <mat-dialog-content class="content">
      <app-playing-card size="large" [card]="data.card" [showName]="false" [showStat]="false" />
      <div class="details">
        @if (display; as d) {
          <div class="kind">
            {{ categoryName(d.category) }}@if (d.subtype) { · {{ subtypeName(d.subtype) }} }@if (d.range !== null) { · {{ 'card.range' | t: { n: d.range } }} }@if (d.mount) { · {{ 'card.distance' | t: { n: d.mount === 'offensive' ? '-1' : '+1' } }} }
          </div>
          <p class="text">{{ d.text ?? ('card.noText' | t) }}</p>
        } @else {
          <p class="text">{{ 'card.noText' | t }}</p>
        }
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close type="button">{{ 'ui.close' | t }}</button>
    </mat-dialog-actions>
  `,
  styles: `
    .content { display: flex; gap: 16px; flex-wrap: wrap; }
    .details { flex: 1; min-width: 180px; }
    .kind { font: var(--mat-sys-label-large); color: var(--mat-sys-primary); margin: 4px 0 8px; }
    .text { font: var(--mat-sys-body-medium); }
  `,
})
export class CardInfoDialog {
  protected readonly data = inject<CardInfoDialogData>(MAT_DIALOG_DATA);
  private readonly i18n = inject(I18n);
  protected readonly display = cardDisplayData(this.data.card.definitionId, this.i18n.locale());

  protected categoryName(category: CardDisplayData['category']): string {
    return this.i18n.t(`card.category.${category}` as const);
  }

  protected subtypeName(subtype: NonNullable<CardDisplayData['subtype']>): string {
    return this.i18n.t(`card.subtype.${subtype}` as const);
  }

  static nameFor(definitionId: string, registryName: string | undefined, tr: Translator = englishTranslator): string {
    return cardDisplayData(definitionId, localeOf(tr))?.name ?? registryName ?? cardIdDisplayName(definitionId, tr);
  }
}
