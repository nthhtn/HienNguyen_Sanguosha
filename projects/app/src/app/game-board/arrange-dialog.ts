import { Component, inject, signal } from '@angular/core';
import { CdkDrag, CdkDragDrop, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { Action, CardInstance } from 'engine';
import { PlayingCard } from './playing-card';
import { DecisionCountdown } from './decision-countdown';
import { ArrangeDescription } from './ability-description';
import { cardFaceLabel } from '../labels';

type ArrangeAction = Extract<Action, { kind: 'ArrangeCardsAction' }>;

export interface ArrangeDialogData {
  description: ArrangeDescription;
  // Told the arrangement on every change, so a timeout can use it.
  arrangedChanged?: (action: Action) => void;
}

interface Placed {
  card: CardInstance;
  place: 'top' | 'bottom';
}

// Astrology: each card on top or at the bottom, in the order the row shows
// (drag, or the arrows, to reorder). Closes only through Confirm, with the
// engine's own ArrangeCardsAction filled in.
@Component({
  selector: 'app-arrange-dialog',
  imports: [MatDialogModule, MatButtonModule, PlayingCard, DecisionCountdown, CdkDropList, CdkDrag],
  template: `
    <h2 mat-dialog-title>{{ data.description.title }}</h2>
    <mat-dialog-content>
      <p class="prompt">{{ data.description.prompt }}</p>
      <ol class="row" cdkDropList cdkDropListOrientation="horizontal" (cdkDropListDropped)="drop($event)">
        @for (item of items(); track item.card.instanceId; let i = $index) {
          <li class="item" cdkDrag [attr.data-card-id]="item.card.instanceId" [class.bottom]="item.place === 'bottom'">
            <app-playing-card [card]="item.card" />
            <div class="place" role="group" [attr.aria-label]="'Where ' + faceOf(item.card) + ' goes'">
              <button type="button" class="top" [class.on]="item.place === 'top'" [attr.aria-pressed]="item.place === 'top'" (click)="place(i, 'top')">Top</button>
              <button type="button" class="bottom" [class.on]="item.place === 'bottom'" [attr.aria-pressed]="item.place === 'bottom'" (click)="place(i, 'bottom')">Bottom</button>
            </div>
            <div class="move">
              <button type="button" class="left" [disabled]="i === 0" [attr.aria-label]="'Move ' + faceOf(item.card) + ' left'" (click)="move(i, -1)">‹</button>
              <button type="button" class="right" [disabled]="i === items().length - 1" [attr.aria-label]="'Move ' + faceOf(item.card) + ' right'" (click)="move(i, 1)">›</button>
            </div>
          </li>
        }
      </ol>
    </mat-dialog-content>
    <!-- At zero: the arrangement as it stands. -->
    <app-decision-countdown class="timer" />
    <mat-dialog-actions align="end">
      <button mat-flat-button type="button" class="confirm" (click)="confirm()">Confirm</button>
    </mat-dialog-actions>
  `,
  styles: `
    .prompt { margin: 0 0 12px; font: var(--mat-sys-body-medium); color: var(--mat-sys-on-surface-variant); }
    .row { list-style: none; padding: 0; margin: 0; display: flex; gap: 12px; overflow-x: auto; }
    .item { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 6px; border-radius: 10px; background: var(--mat-sys-surface-container); cursor: grab; }
    .item.bottom { opacity: 0.7; }
    .place, .move { display: flex; gap: 4px; }
    .place button, .move button {
      padding: 2px 8px; border: 1px solid var(--mat-sys-outline); border-radius: 12px; background: none; color: inherit; cursor: pointer; font: var(--mat-sys-label-medium);
    }
    .place button.on { background: var(--mat-sys-primary); color: var(--mat-sys-on-primary); border-color: var(--mat-sys-primary); }
    .move button:disabled { opacity: 0.4; cursor: default; }
    .timer { display: block; padding: 8px 24px 0; }
    .cdk-drag-preview { box-shadow: 0 4px 12px rgb(0 0 0 / 30%); }
    .cdk-drag-placeholder { opacity: 0.3; }
  `,
})
export class ArrangeDialog {
  protected readonly data = inject<ArrangeDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<ArrangeDialog, Action>>(MatDialogRef);
  protected readonly items = signal<Placed[]>(this.data.description.cards.map((card) => ({ card, place: 'top' })));

  constructor() {
    this.changed();
  }

  protected faceOf(card: CardInstance): string {
    return cardFaceLabel(card);
  }

  protected place(index: number, place: Placed['place']): void {
    this.items.update((items) => items.map((item, i) => (i === index ? { ...item, place } : item)));
    this.changed();
  }

  protected move(index: number, by: number): void {
    this.items.update((items) => {
      const next = [...items];
      moveItemInArray(next, index, index + by);
      return next;
    });
    this.changed();
  }

  protected drop(event: CdkDragDrop<unknown>): void {
    this.move(event.previousIndex, event.currentIndex - event.previousIndex);
  }

  protected confirm(): void {
    this.dialogRef.close(this.action());
  }

  private action(): ArrangeAction {
    const items = this.items();
    return {
      ...this.data.description.template,
      top: items.filter((i) => i.place === 'top').map((i) => i.card.instanceId),
      bottom: items.filter((i) => i.place === 'bottom').map((i) => i.card.instanceId),
    };
  }

  private changed(): void {
    this.data.arrangedChanged?.(this.action());
  }
}
