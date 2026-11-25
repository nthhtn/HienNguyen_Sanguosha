import { Component, Injector, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { generalDisplayData } from 'content';
import { I18n } from '../i18n/i18n.service';
import { TPipe } from '../i18n/t.pipe';
import { generalDisplayName } from '../labels';
import { GeneralArtChoices } from './general-art-choices';

export interface GeneralArtDialogData {
  generalId: string;
}

// Every art set's artwork for one General, opened from its Wiki entry; the tiles are the same choice controls the Art Sets page has.
@Component({
  selector: 'app-general-art-dialog',
  imports: [MatDialogModule, MatButtonModule, GeneralArtChoices, TPipe],
  template: `
    <h2 mat-dialog-title>{{ name }}</h2>
    <mat-dialog-content>
      <p class="hint">{{ 'artSets.alternates' | t }}</p>
      <app-general-art-choices [general]="data.generalId" size="large" />
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>{{ 'ui.close' | t }}</button>
    </mat-dialog-actions>
  `,
  styles: `
    .hint { margin: 0 0 12px; color: #666; font-size: 0.85rem; }
  `,
})
export class GeneralArtDialog {
  protected readonly data = inject<GeneralArtDialogData>(MAT_DIALOG_DATA);
  private readonly i18n = inject(I18n);
  protected readonly name = generalDisplayData(this.data.generalId, this.i18n.locale())?.name ?? generalDisplayName(this.data.generalId, this.i18n.translator);
}

// Opens the popup. The Wiki entries call this through a dynamic import, so the dialog loads only when asked for.
export function openGeneralArtDialog(injector: Injector, generalId: string): void {
  injector.get(MatDialog).open(GeneralArtDialog, { data: { generalId } satisfies GeneralArtDialogData });
}
