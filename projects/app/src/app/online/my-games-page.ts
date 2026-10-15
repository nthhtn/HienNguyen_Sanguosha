import { DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import type { GameSummary } from 'protocol';
import { gameHeadline, gameOutcome, playerLabel } from './game-labels';
import { MyGamesService } from './my-games.service';

// Your finished games, newest first. Read-only: there is no replay viewer yet.
@Component({
  selector: 'app-my-games-page',
  imports: [DatePipe, RouterLink, MatButtonModule, MatCardModule, MatIconModule],
  styleUrl: './online-page.css',
  template: `
    <div class="online-page">
      <mat-card class="online-card" appearance="raised">
        <mat-card-header><mat-card-title>My Games</mat-card-title></mat-card-header>
        <mat-card-content>
          @if (service.error(); as text) {
            <p class="error" role="alert">{{ text }}</p>
          }
          @if (service.games(); as games) {
            @if (games.length === 0) {
              <p class="empty">No finished games yet</p>
            } @else {
              <ul class="room-list">
                @for (game of games; track game.gameId) {
                  <li class="room game">
                    <mat-icon aria-hidden="true">{{ outcome(game) === 'Won' ? 'emoji_events' : 'flag' }}</mat-icon>
                    <span class="outcome badge">{{ outcome(game) }}</span>
                    <span class="host-name">
                      <span class="headline">{{ headline(game) }}</span>
                      <span class="players hint">{{ players(game) }}</span>
                    </span>
                    <span class="when status">{{ game.finishedAt | date: 'medium' }}</span>
                  </li>
                }
              </ul>
            }
          } @else if (!service.error()) {
            <p class="loading">Loading games…</p>
          }
        </mat-card-content>
        <mat-card-actions align="end">
          <a mat-button class="back" routerLink="/rooms">Back to Rooms</a>
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
  protected readonly outcome = gameOutcome;
  protected readonly headline = gameHeadline;

  constructor() {
    void this.service.load();
  }

  protected players(game: GameSummary): string {
    return game.players.map((p) => playerLabel(game, p.seatId)).join(', ');
  }
}
