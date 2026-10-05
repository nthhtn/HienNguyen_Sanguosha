import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatRadioModule } from '@angular/material/radio';
import { Action, CardInstance } from 'engine';
import { cardFaceLabel, cardIdDisplayName } from '../labels';
import { PlayingCard } from './playing-card';
import { DecisionCountdown } from './decision-countdown';
import { ResponseDescription } from './response-description';

// One way to respond: a card from the hand, or (later) a general's skill.
export interface ResponseOption {
  id: string;
  action: Action;
  card?: CardInstance;
  label: string;
}

export interface ResponseDialogData {
  description: ResponseDescription;
  cards: ResponseOption[];
  skills: ResponseOption[];
  // The engine's PassAction for this window.
  noResponse: Action;
}

const NO_RESPONSE = 'no-response';

// A response the viewer owes: what caused it, what they can answer with, and
// what happens if they don't. Pick one entry and confirm with the primary
// button. Starts on the first skill, else the first card, else No Response.
// Closes only through that button, with the chosen engine action.
@Component({
  selector: 'app-response-dialog',
  imports: [MatDialogModule, MatButtonModule, MatIconModule, MatRadioModule, PlayingCard, DecisionCountdown],
  template: `
    <h2 mat-dialog-title>Response Needed</h2>
    <mat-dialog-content>
      <div class="description">
        <p class="source">{{ data.description.source }}</p>
        @if (data.description.latest; as latest) {
          <p class="latest">{{ latest }}</p>
        }
        <p class="prompt">{{ data.description.prompt }}</p>
      </div>

      <mat-radio-group class="options" [value]="picked()" (change)="picked.set($event.value)" aria-label="Choose a response">
        <h3>Skills</h3>
        @for (option of data.skills; track option.id) {
          <mat-radio-button class="option skill-option" [value]="option.id" [attr.data-option-id]="option.id">
            {{ option.label }}
          </mat-radio-button>
        } @empty {
          <p class="empty">No skills can respond</p>
        }

        <h3>Cards</h3>
        <div class="cards">
          @for (option of data.cards; track option.id) {
            <!-- The same card face as in the hand: name, suit and number. -->
            <mat-radio-button class="option card-option" [value]="option.id" [attr.data-option-id]="option.id" [aria-label]="option.label">
              @if (option.card; as card) {
                <app-playing-card [card]="card" />
              }
            </mat-radio-button>
          } @empty {
            <p class="empty">No cards can respond</p>
          }
        </div>

        <mat-radio-button class="option no-response" [value]="noResponseId">
          <span class="option-body">
            <span>No Response</span>
            <span class="outcome force-status" [attr.data-force]="data.description.outcomeForce">— {{ data.description.outcome }}</span>
          </span>
        </mat-radio-button>
      </mat-radio-group>
    </mat-dialog-content>
    <!-- Below the choices, above the button. At zero: No Response. -->
    <app-decision-countdown class="timer" />
    <mat-dialog-actions align="end">
      <button mat-flat-button type="button" class="confirm" (click)="confirm()">{{ confirmLabel() }}</button>
    </mat-dialog-actions>
  `,
  styles: `
    .description { margin-bottom: 12px; }
    .description p { margin: 0 0 4px; }
    .source { font: var(--mat-sys-title-medium); }
    .latest { color: var(--mat-sys-on-surface-variant); }
    .prompt { font: var(--mat-sys-body-large); color: var(--mat-sys-primary); }
    .options { display: flex; flex-direction: column; }
    h3 { margin: 12px 0 4px; font: var(--mat-sys-title-small); }
    .option-body { display: inline-flex; align-items: center; gap: 8px; }
    .cards { display: flex; flex-wrap: wrap; gap: 8px 16px; }
    .card-option app-playing-card { display: block; padding: 4px 0; }
    .empty { margin: 0 0 4px 12px; color: var(--mat-sys-on-surface-variant); font: var(--mat-sys-body-medium); }
    .no-response { margin-top: 12px; }
    .timer { display: block; padding: 8px 24px 0; }
  `,
})
export class ResponseDialog {
  protected readonly data = inject<ResponseDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<ResponseDialog, Action>>(MatDialogRef);

  protected readonly noResponseId = NO_RESPONSE;
  protected readonly picked = signal<string>(this.data.skills[0]?.id ?? this.data.cards[0]?.id ?? NO_RESPONSE);

  private readonly pickedOption = computed(
    () => [...this.data.cards, ...this.data.skills].find((o) => o.id === this.picked()) ?? null
  );
  protected readonly confirmLabel = computed(() => {
    const option = this.pickedOption();
    return option ? `Respond with ${option.card ? this.name(option.card) : option.label}` : 'No Response';
  });

  protected name(card: CardInstance): string {
    return cardIdDisplayName(card.definitionId);
  }

  protected confirm(): void {
    this.dialogRef.close(this.pickedOption()?.action ?? this.data.noResponse);
  }

  static cardLabel(card: CardInstance): string {
    return `${cardIdDisplayName(card.definitionId)} (${cardFaceLabel(card)})`;
  }
}
