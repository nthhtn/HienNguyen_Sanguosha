import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { CardInstance } from 'engine';
import { cardDisplayData } from 'content';
import { cardFaceLabel, cardIdDisplayName } from '../labels';
import { CardArt } from './card-art';

export interface CardInfoDialogData {
  card: CardInstance;
  name: string;
}

// Read-only card details (art, printing, rules text) for a card in the hand.
@Component({
  selector: 'app-card-info-dialog',
  imports: [MatDialogModule, MatButtonModule, CardArt],
  template: `
    <h2 mat-dialog-title>{{ data.name }}</h2>
    <mat-dialog-content class="content">
      <app-card-art size="large" [id]="data.card.definitionId" [label]="data.name" />
      <div class="details">
        <div class="face">{{ face }}</div>
        @if (display; as d) {
          <div class="kind">
            {{ capitalise(d.category) }}@if (d.subtype) { · {{ capitalise(d.subtype) }} }@if (d.range !== null) { · Range {{ d.range }} }
          </div>
          <p class="text">{{ d.text ?? 'No rules text available yet.' }}</p>
        } @else {
          <p class="text">No rules text available yet.</p>
        }
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close type="button">Close</button>
    </mat-dialog-actions>
  `,
  styles: `
    .content { display: flex; gap: 16px; flex-wrap: wrap; }
    .details { flex: 1; min-width: 180px; }
    .face { font: var(--mat-sys-headline-small); }
    .kind { font: var(--mat-sys-label-large); color: var(--mat-sys-primary); margin: 4px 0 8px; }
    .text { font: var(--mat-sys-body-medium); }
  `,
})
export class CardInfoDialog {
  protected readonly data = inject<CardInfoDialogData>(MAT_DIALOG_DATA);
  protected readonly display = cardDisplayData(this.data.card.definitionId);
  protected readonly face = cardFaceLabel(this.data.card);

  protected capitalise(word: string): string {
    return word.charAt(0).toUpperCase() + word.slice(1);
  }

  static nameFor(definitionId: string, registryName: string | undefined): string {
    return cardDisplayData(definitionId)?.name ?? registryName ?? cardIdDisplayName(definitionId);
  }
}
