import { Component, input, output, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { GameResult, Player } from 'engine';
import { forceOf, kingdomDisplayName, seatName } from '../labels';
import { I18n } from '../i18n/i18n.service';
import { TPipe } from '../i18n/t.pipe';

@Component({
  selector: 'app-game-over',
  imports: [MatButtonModule, MatCardModule, MatIconModule, TPipe],
  template: `
    <div class="game-over">
      <mat-card appearance="raised" class="result-card">
        <mat-icon class="big-icon">emoji_events</mat-icon>
        <h2>{{ 'over.title' | t }}</h2>
        @if (result().winningKingdom) {
          <p class="headline" [attr.data-force]="forceOf(result().winningKingdom)">{{ 'over.kingdomWins' | t: { kingdom: kingdomName(result().winningKingdom!) } }}</p>
        } @else if (result().winningSeatIds.length > 0) {
          <p class="headline">{{ 'over.namesWin' | t: { names: names(result().winningSeatIds) } }}</p>
        } @else {
          <p class="headline">{{ 'over.draw' | t }}</p>
        }
        <p>{{ 'over.winners' | t: { names: names(result().winningSeatIds) || ('over.none' | t) } }}</p>
        <p>{{ 'over.losers' | t: { names: names(result().losingSeatIds) || ('over.none' | t) } }}</p>
        <button mat-flat-button type="button" (click)="newGame.emit()">
          <mat-icon>replay</mat-icon> {{ 'ui.newGame' | t }}
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
    /* "Wei wins!" in Wei's force colour, and so on. */
    .headline[data-force] { color: var(--force-text); font-weight: 600; }
    p { margin: 2px 0; }
    button { margin-top: 16px; }
  `,
})
export class GameOver {
  readonly result = input.required<GameResult>();
  readonly players = input<Player[]>([]);
  readonly newGame = output<void>();

  private readonly i18n = inject(I18n);

  protected names(seatIds: string[]): string {
    return seatIds.map((id) => seatName(this.players(), id, this.i18n.translator)).join(', ');
  }

  protected kingdomName(kingdom: Parameters<typeof kingdomDisplayName>[0]): string {
    return kingdomDisplayName(kingdom, this.i18n.translator);
  }
  protected readonly forceOf = forceOf;
}
