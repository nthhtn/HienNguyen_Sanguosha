import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { CardInstance } from 'engine';
import { cardDisplayData } from 'content';
import { cardIdDisplayName } from '../labels';
import { CardInfoPane } from './card-info-pane';
import { TPipe } from '../i18n/t.pipe';
import { englishTranslator, localeOf, Translator } from '../i18n/translator';

export interface CardInfoDialogData {
  card: CardInstance;
  name: string;
}

// Read-only card details (art, printing, rules text) for a card in the hand.
@Component({
  selector: 'app-card-info-dialog',
  imports: [MatDialogModule, MatButtonModule, CardInfoPane, TPipe],
  template: `
    <h2 mat-dialog-title>{{ data.name }}</h2>
    <mat-dialog-content>
      <app-card-info-pane [card]="data.card" [showName]="false" />
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close type="button">{{ 'ui.close' | t }}</button>
    </mat-dialog-actions>
  `,
})
export class CardInfoDialog {
  protected readonly data = inject<CardInfoDialogData>(MAT_DIALOG_DATA);
  static nameFor(definitionId: string, registryName: string | undefined, tr: Translator = englishTranslator): string {
    return cardDisplayData(definitionId, localeOf(tr))?.name ?? registryName ?? cardIdDisplayName(definitionId, tr);
  }
}
