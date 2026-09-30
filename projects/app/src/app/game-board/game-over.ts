import { Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { GameResult } from 'engine';
import { kingdomDisplayName } from '../labels';

@Component({
  selector: 'app-game-over',
  imports: [MatButtonModule, MatCardModule, MatIconModule],
  template: `
    <div class="game-over">
      <mat-card appearance="raised" class="result-card">
        <mat-icon class="big-icon">emoji_events</mat-icon>
        <h2>Game over</h2>
        @if (result().winningKingdom) {
          <p class="headline">{{ kingdomDisplayName(result().winningKingdom!) }} wins!</p>
        } @else if (result().winningSeatIds.length > 0) {
          <p class="headline">{{ result().winningSeatIds.join(', ') }} wins!</p>
        } @else {
          <p class="headline">Draw — no survivors.</p>
        }
        <p>Winners: {{ result().winningSeatIds.join(', ') || 'none' }}</p>
        <p>Losers: {{ result().losingSeatIds.join(', ') || 'none' }}</p>
        <button mat-flat-button type="button" (click)="newGame.emit()">
          <mat-icon>replay</mat-icon> New game
        </button>
      </mat-card>
    </div>
  `,
  styles: `
    .game-over { display: grid; place-items: center; min-height: 60vh; padding: 24px 0; }
    .result-card { width: min(100%, 420px); padding: 32px 24px; text-align: center; align-items: center; gap: 4px; }
    .big-icon { font-size: 48px; width: 48px; height: 48px; color: var(--mat-sys-primary); }
    h2 { margin: 8px 0 0; font: var(--mat-sys-headline-small); }
    .headline { font: var(--mat-sys-title-large); color: var(--mat-sys-primary); }
    p { margin: 2px 0; }
    button { margin-top: 16px; }
  `,
})
export class GameOver {
  readonly result = input.required<GameResult>();
  readonly newGame = output<void>();

  protected readonly kingdomDisplayName = kingdomDisplayName;
}
