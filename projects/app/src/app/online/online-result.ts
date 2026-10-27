import { Component, computed, inject, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import type { LastGame } from 'protocol';
import { VictoryBoard } from '../game-board/victory-board';
import { I18n } from '../i18n/i18n.service';
import type { MessageKey } from '../i18n/messages';
import { TPipe } from '../i18n/t.pipe';

// How the room's last game ended: the victory columns for a finished game, or
// why it stopped. An open room goes back to its lobby; a solo room offers Play
// Again or Back to Rooms.
@Component({
  selector: 'app-online-result',
  imports: [MatButtonModule, MatCardModule, MatIconModule, TPipe, VictoryBoard],
  styleUrl: './online-page.css',
  styles: `
    /* The same look as the Game Over card of a game against bots. */
    .result mat-card-header { justify-content: center; }
    .result mat-card-content { text-align: center; }
  `,
  template: `
    <div class="online-page">
      <mat-card class="online-card result" appearance="raised">
        <mat-card-header>
          <mat-card-title>{{ (ending().outcome === 'finished' ? 'over.title' : 'result.stopped') | t }}</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          @if (ending().result; as result) {
            <app-victory-board [result]="result" [seats]="ending().finalSeats" [youSeatId]="youSeatId()" [nameOf]="nameOf" />
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
  // The viewer's player id; null for a viewer with no seat.
  readonly youPlayerId = input<string | null>(null);
  readonly backToLobby = output<void>();
  readonly playAgain = output<void>();
  readonly backToRooms = output<void>();
  private readonly i18n = inject(I18n);

  protected readonly stopped = computed(() => {
    const outcome = this.ending().outcome;
    return outcome === 'finished' ? '' : this.i18n.t(`outcome.${outcome}` as MessageKey);
  });

  protected readonly youSeatId = computed(() => {
    const you = this.youPlayerId();
    return you === null ? null : (this.ending().seats.find((s) => s.playerId === you)?.seatId ?? null);
  });

  protected readonly nameOf = (seatId: string): string => this.ending().seats.find((s) => s.seatId === seatId)?.name ?? seatId;
}
