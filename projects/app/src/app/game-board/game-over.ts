import { Component, input, output } from '@angular/core';
import { GameResult } from 'engine';
import { kingdomDisplayName } from '../labels';

@Component({
  selector: 'app-game-over',
  template: `
    <div class="game-over">
      <h2>Game over</h2>
      @if (result().winningKingdom) {
        <p>{{ kingdomDisplayName(result().winningKingdom!) }} wins!</p>
      } @else if (result().winningSeatIds.length > 0) {
        <p>{{ result().winningSeatIds.join(', ') }} wins!</p>
      } @else {
        <p>Draw — no survivors.</p>
      }
      <p>Winners: {{ result().winningSeatIds.join(', ') || 'none' }}</p>
      <p>Losers: {{ result().losingSeatIds.join(', ') || 'none' }}</p>
      <button (click)="newGame.emit()">New game</button>
    </div>
  `,
})
export class GameOver {
  readonly result = input.required<GameResult>();
  readonly newGame = output<void>();

  protected readonly kingdomDisplayName = kingdomDisplayName;
}
