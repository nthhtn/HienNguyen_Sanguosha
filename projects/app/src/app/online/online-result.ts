import { Component, computed, inject, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import type { GameResult } from 'engine';
import type { LastGame } from 'protocol';
import { I18n } from '../i18n/i18n.service';
import type { MessageKey } from '../i18n/messages';
import { TPipe } from '../i18n/t.pipe';
import { forceOf, kingdomDisplayName } from '../labels';

// How the room's last game ended, named by the seats it was played with. An
// open room goes back to its lobby; a solo room offers Play Again or Back to Rooms.
@Component({
  selector: 'app-online-result',
  imports: [MatButtonModule, MatCardModule, MatIconModule, TPipe],
  styleUrl: './online-page.css',
  styles: `
    /* The same look as the Game Over card of a game against bots. */
    .result mat-card-header { justify-content: center; }
    .result mat-card-content { text-align: center; }
    .big-icon { font-size: 48px; width: 48px; height: 48px; color: var(--mat-sys-primary); }
    .headline { font: var(--mat-sys-title-large); color: var(--mat-sys-primary); }
    /* "Wei wins!" in Wei's force colour, and so on. */
    .headline[data-force] { color: var(--force-text); font-weight: 600; }
    .winners, .losers { margin: 2px 0; }
  `,
  template: `
    <div class="online-page">
      <mat-card class="online-card result" appearance="raised">
        <mat-card-header>
          <mat-card-title>{{ (ending().outcome === 'finished' ? 'over.title' : 'result.stopped') | t }}</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          @if (ending().result; as result) {
            <mat-icon class="big-icon">emoji_events</mat-icon>
            <p class="headline" [attr.data-force]="result.winningKingdom ? forceOf(result.winningKingdom) : null">{{ headline(result) }}</p>
            <p class="winners">{{ 'over.winners' | t: { names: names(result.winningSeatIds) || ('over.none' | t) } }}</p>
            <p class="losers">{{ 'over.losers' | t: { names: names(result.losingSeatIds) || ('over.none' | t) } }}</p>
          } @else {
            <p class="banner stopped" role="alert">{{ stopped() }}</p>
          }
        </mat-card-content>
        <mat-card-actions align="end">
          @if (solo()) {
            <button mat-button type="button" class="back-to-rooms" [disabled]="!canAct()" (click)="backToRooms.emit()">{{ 'rooms.back' | t }}</button>
            <button mat-flat-button type="button" class="play-again" [disabled]="!canAct()" (click)="playAgain.emit()"><mat-icon>replay</mat-icon> {{ 'result.playAgain' | t }}</button>
          } @else {
            <button mat-flat-button type="button" class="back-to-lobby" (click)="backToLobby.emit()">{{ 'result.backToLobby' | t }}</button>
          }
        </mat-card-actions>
      </mat-card>
    </div>
  `,
})
export class OnlineResult {
  readonly ending = input.required<LastGame>();
  readonly solo = input(false);
  readonly canAct = input(true);
  readonly backToLobby = output<void>();
  readonly playAgain = output<void>();
  readonly backToRooms = output<void>();
  private readonly i18n = inject(I18n);
  protected readonly forceOf = forceOf;

  protected readonly stopped = computed(() => {
    const outcome = this.ending().outcome;
    return outcome === 'finished' ? '' : this.i18n.t(`outcome.${outcome}` as MessageKey);
  });

  protected names(seatIds: string[]): string {
    return seatIds.map((id) => this.ending().seats.find((s) => s.seatId === id)?.name ?? id).join(', ');
  }

  protected headline(result: GameResult): string {
    const tr = this.i18n.translator;
    if (result.winningKingdom) return tr('over.kingdomWins', { kingdom: kingdomDisplayName(result.winningKingdom, tr) });
    if (result.winningSeatIds.length > 0) return tr('over.namesWin', { names: this.names(result.winningSeatIds) });
    return tr('over.draw');
  }
}
