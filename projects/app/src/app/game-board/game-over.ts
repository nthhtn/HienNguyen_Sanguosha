import { Component, input, output, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { GameResult, Player } from 'engine';
import { FinalSeatView } from 'protocol';
import { seatName } from '../labels';
import { I18n } from '../i18n/i18n.service';
import { TPipe } from '../i18n/t.pipe';
import { VictoryBoard } from './victory-board';

@Component({
  selector: 'app-game-over',
  imports: [MatButtonModule, MatIconModule, TPipe, VictoryBoard],
  template: `
    <div class="game-over">
      <app-victory-board [result]="result()" [seats]="seats()" [youSeatId]="youSeatId()" [nameOf]="nameOf" />
      <button mat-flat-button type="button" (click)="newGame.emit()">
        <mat-icon>replay</mat-icon> {{ 'ui.newGame' | t }}
      </button>
    </div>
  `,
  styles: `
    .game-over { display: grid; justify-items: center; gap: 16px; padding: 24px 0; }
  `,
})
export class GameOver {
  readonly result = input.required<GameResult>();
  readonly seats = input.required<FinalSeatView[]>();
  readonly youSeatId = input<string | null>(null);
  readonly players = input<Player[]>([]);
  readonly newGame = output<void>();

  private readonly i18n = inject(I18n);

  protected readonly nameOf = (seatId: string): string => seatName(this.players(), seatId, this.i18n.translator);
}
