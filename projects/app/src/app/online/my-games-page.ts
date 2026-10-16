import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import type { GameSummary } from 'protocol';
import { I18n } from '../i18n/i18n.service';
import { TMsgPipe } from '../i18n/msg';
import { TPipe } from '../i18n/t.pipe';
import { didWin, gameHeadline, gameOutcome, gameWhen, playerLabel } from './game-labels';
import { MyGamesService } from './my-games.service';

// Your finished games, newest first. Read-only: there is no replay viewer yet.
@Component({
  selector: 'app-my-games-page',
  imports: [RouterLink, MatButtonModule, MatCardModule, MatIconModule, TPipe, TMsgPipe],
  providers: [MyGamesService],
  styleUrl: './online-page.css',
  template: `
    <div class="online-page">
      <mat-card class="online-card" appearance="raised">
        <mat-card-header><mat-card-title>{{ 'myGames.title' | t }}</mat-card-title></mat-card-header>
        <mat-card-content>
          @if (service.error(); as text) {
            <p class="error" role="alert">{{ text | tm }}</p>
          }
          @if (service.games(); as games) {
            @if (games.length === 0) {
              <p class="empty">{{ 'myGames.empty' | t }}</p>
            } @else {
              <ul class="room-list">
                @for (game of games; track game.gameId) {
                  <li class="room game">
                    <mat-icon aria-hidden="true">{{ won(game) ? 'emoji_events' : 'flag' }}</mat-icon>
                    <span class="outcome badge">{{ outcome(game) }}</span>
                    <span class="host-name">
                      <span class="headline">{{ headline(game) }}</span>
                      <span class="players hint">{{ players(game) }}</span>
                    </span>
                    <span class="when status">{{ when(game) }}</span>
                  </li>
                }
              </ul>
            }
          } @else if (!service.error()) {
            <p class="loading">{{ 'myGames.loading' | t }}</p>
          }
        </mat-card-content>
        <mat-card-actions align="end">
          <a mat-button class="back" routerLink="/rooms">{{ 'rooms.back' | t }}</a>
        </mat-card-actions>
      </mat-card>
    </div>
  `,
  styles: `
    .host-name {
      display: flex;
      flex-direction: column;
    }
  `,
})
export class MyGamesPage {
  protected readonly service = inject(MyGamesService);
  private readonly i18n = inject(I18n);
  protected readonly won = didWin;
  protected readonly outcome = (game: GameSummary) => gameOutcome(game, this.i18n.translator);
  protected readonly headline = (game: GameSummary) => gameHeadline(game, this.i18n.translator);
  protected readonly when = (game: GameSummary) => gameWhen(game, this.i18n.translator);

  constructor() {
    void this.service.load();
  }

  protected players(game: GameSummary): string {
    return game.players.map((p) => playerLabel(game, p.seatId, this.i18n.translator)).join(', ');
  }
}
