import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { generalDisplayData } from 'content';
import { generalDisplayName } from '../labels';
import { CardArt } from './card-art';
import { I18n } from '../i18n/i18n.service';
import { TPipe } from '../i18n/t.pipe';

export interface GeneralInfoDialogData {
  generalDefinitionId: string;
}

// Read-only General details (art, title, skills), opened from a seat's avatar.
@Component({
  selector: 'app-general-info-dialog',
  imports: [MatDialogModule, MatButtonModule, CardArt, TPipe],
  template: `
    <h2 mat-dialog-title>{{ name }}</h2>
    <mat-dialog-content class="content">
      <app-card-art size="large" [id]="data.generalDefinitionId" [label]="name" />
      <div class="details">
        @if (display?.title; as title) {
          <div class="title">{{ title }}</div>
        }
        @if (display?.skills?.length) {
          <ul class="skills">
            @for (skill of display!.skills; track skill.name) {
              <li><strong>{{ skill.name }}</strong> {{ skill.text }}</li>
            }
          </ul>
        } @else {
          <p class="empty">{{ 'general.noSkills' | t }}</p>
        }
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>{{ 'ui.close' | t }}</button>
    </mat-dialog-actions>
  `,
  styles: `
    .content { display: flex; gap: 16px; align-items: flex-start; }
    .details { flex: 1; min-width: 0; }
    .title { font-style: italic; color: #666; margin-bottom: 8px; }
    .skills { padding-left: 1.1em; margin: 0; }
    .skills li { margin-bottom: 6px; }
    .empty { color: #666; }
    @media (max-width: 480px) { .content { flex-direction: column; align-items: center; } }
  `,
})
export class GeneralInfoDialog {
  protected readonly data = inject<GeneralInfoDialogData>(MAT_DIALOG_DATA);
  private readonly i18n = inject(I18n);
  protected readonly display = generalDisplayData(this.data.generalDefinitionId, this.i18n.locale());
  protected readonly name = this.display?.name ?? generalDisplayName(this.data.generalDefinitionId, this.i18n.translator);
}
