import { Component, computed, inject, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Action, CardInstance, ContentRegistry, GameState } from 'engine';
import { actionLabel } from '../labels';
import { CardArt } from './card-art';
import { CardInfoDialog, CardInfoDialogData } from './card-info-dialog';

interface HandCardViewModel {
  card: CardInstance;
  name: string;
  actions: { action: Action; label: string }[];
}

function cardInstanceIdOf(action: Action): string | undefined {
  return action.kind === 'PlayCardAction' || action.kind === 'RespondAction' ? action.cardInstanceId : undefined;
}

// The viewer's own hand as one row of cards. Hovering (or focusing, for touch)
// a card reveals Play — the engine's legal plays/responses for that card only —
// and Info.
@Component({
  selector: 'app-hand-view',
  imports: [MatButtonModule, MatIconModule, MatMenuModule, MatTooltipModule, CardArt],
  template: `
    <div class="hand-row" role="list">
      @for (vm of cardViewModels(); track vm.card.instanceId) {
        <div class="hand-card" role="listitem" tabindex="0" [attr.data-card-id]="vm.card.instanceId">
          <app-card-art [id]="vm.card.definitionId" [label]="vm.name" />
          <div class="overlay">
            @if (vm.actions.length > 1) {
              <button mat-flat-button type="button" class="play" [matMenuTriggerFor]="choices">
                <mat-icon>play_arrow</mat-icon> Play
              </button>
              <mat-menu #choices="matMenu">
                @for (choice of vm.actions; track choice.action) {
                  <button mat-menu-item type="button" (click)="play.emit(choice.action)">{{ choice.label }}</button>
                }
              </mat-menu>
            } @else {
              <button
                mat-flat-button
                type="button"
                class="play"
                [disabled]="vm.actions.length === 0"
                (click)="play.emit(vm.actions[0].action)"
              >
                <mat-icon>play_arrow</mat-icon> Play
              </button>
            }
            <button mat-stroked-button type="button" class="info" (click)="openInfo(vm)">
              <mat-icon>info</mat-icon> Info
            </button>
          </div>
        </div>
      } @empty {
        <span class="empty">No cards in hand</span>
      }
    </div>
  `,
  styles: `
    .hand-row {
      display: flex;
      flex-wrap: nowrap;
      gap: 8px;
      overflow-x: auto;
      padding: 16px 4px 8px;
    }
    .hand-card {
      position: relative;
      flex: 0 0 auto;
      border-radius: 6px;
      transition: transform 150ms;
      outline: none;
    }
    .hand-card:hover,
    .hand-card:focus-within { transform: translateY(-10px); }
    .overlay {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 6px;
      padding: 6px;
      border-radius: 6px;
      background: rgb(0 0 0 / 55%);
      opacity: 0;
      pointer-events: none;
      transition: opacity 150ms;
    }
    .hand-card:hover .overlay,
    .hand-card:focus-within .overlay { opacity: 1; pointer-events: auto; }
    .overlay button {
      min-width: 0;
      height: 32px;
      padding: 0 6px;
      font-size: 12px;
      --mat-button-outlined-label-text-color: #fff;
    }
    .overlay mat-icon { margin-right: 2px; font-size: 18px; width: 18px; height: 18px; }
    .empty { color: var(--mat-sys-on-surface-variant); }
  `,
})
export class HandView {
  readonly cards = input.required<CardInstance[]>();
  readonly actions = input.required<Action[]>();
  readonly state = input.required<GameState>();
  readonly registry = input.required<ContentRegistry>();
  readonly play = output<Action>();

  private readonly dialog = inject(MatDialog);

  protected readonly cardViewModels = computed<HandCardViewModel[]>(() =>
    this.cards().map((card) => ({
      card,
      name: CardInfoDialog.nameFor(card.definitionId, this.registry().cards.get(card.definitionId)?.name),
      actions: this.actions()
        .filter((action) => cardInstanceIdOf(action) === card.instanceId)
        .map((action) => ({ action, label: actionLabel(action, this.state(), this.registry()) })),
    }))
  );

  protected openInfo(vm: HandCardViewModel): void {
    this.dialog.open<CardInfoDialog, CardInfoDialogData>(CardInfoDialog, {
      data: { card: vm.card, name: vm.name },
      width: 'min(92vw, 480px)',
    });
  }
}
