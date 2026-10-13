import { Component, computed, inject, viewChild } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleGroup, MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatCheckbox, MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { FIRST_REVEAL_MIN_SEATS } from 'content';
import { LobbyService } from './lobby.service';
import { OnlineGame } from './online-game';
import { OnlineResult } from './online-result';
import { RemoteDecisionClock, RemoteGameService } from './remote-game.service';
import { SocketService } from './socket.service';

// A room over its socket: the lobby (members, host controls, Start Game, Leave Room), the board while a game runs, and how the last game ended.
@Component({
  selector: 'app-lobby-page',
  imports: [RouterLink, MatButtonModule, MatButtonToggleModule, MatCardModule, MatCheckboxModule, MatIconModule, OnlineGame, OnlineResult],
  providers: [SocketService, LobbyService, RemoteGameService, RemoteDecisionClock],
  styleUrl: './online-page.css',
  template: `
    @if (game.ending(); as ending) {
      <app-online-result
        [ending]="ending"
        [solo]="lobby.isSolo()"
        [canAct]="lobby.canAct()"
        (backToLobby)="game.dismiss()"
        (playAgain)="lobby.start()"
        (backToRooms)="lobby.leave()"
      />
    } @else if (game.playing()) {
      <div class="game-banners">
        @if (lobby.ended(); as text) {
          <p class="banner ended" role="alert">{{ text }}</p>
        } @else if (lobby.status() === 'reconnecting') {
          <p class="banner reconnecting" role="status">Reconnecting…</p>
        }
        @if (lobby.notice(); as text) {
          <p class="notice" role="status">{{ text }}</p>
        }
      </div>
      <app-online-game />
    } @else {
      <div class="online-page">
        <mat-card class="online-card" appearance="raised">
          <mat-card-header>
            <mat-card-title>Lobby</mat-card-title>
            @if (lobby.room(); as room) {
              <mat-card-subtitle class="player-count">{{ room.members.length }} / {{ room.seatCount }} Players</mat-card-subtitle>
            }
          </mat-card-header>
          <mat-card-content>
            @if (lobby.ended(); as text) {
              <p class="banner ended" role="alert">{{ text }}</p>
            } @else if (lobby.status() === 'reconnecting') {
              <p class="banner reconnecting" role="status">Reconnecting…</p>
            }
            @if (lobby.waitingForHost(); as text) {
              <p class="banner waiting" role="status">{{ text }}</p>
            }
            @if (lobby.notice(); as text) {
              <p class="notice" role="status">{{ text }}</p>
            }
            @if (lobby.error(); as text) {
              <p class="error" role="alert">{{ text }}</p>
            }
            @if (lobby.room(); as room) {
              <section class="rules">
                <h3>Rules</h3>
                @if (lobby.isHost()) {
                  <div class="field">
                    <span class="label" id="lobby-seats">Seats</span>
                    <mat-button-toggle-group
                      class="seats"
                      aria-labelledby="lobby-seats"
                      [hideSingleSelectionIndicator]="true"
                      [disabled]="!lobby.canAct()"
                      [value]="room.seatCount"
                      (change)="setSeats($event.value)"
                    >
                      @for (n of seatOptions(); track n) {
                        <mat-button-toggle [value]="n">{{ n }}</mat-button-toggle>
                      }
                    </mat-button-toggle-group>
                  </div>
                  @if (room.seatCount >= firstRevealMinSeats) {
                    <mat-checkbox class="first-reveal" [disabled]="!lobby.canAct()" [checked]="!!room.rules.firstRevealDraw" (change)="setFirstReveal($event.checked)">
                      First Reveal Bonus
                    </mat-checkbox>
                  }
                } @else {
                  <p class="rules-summary">{{ rulesSummary() }}</p>
                }
              </section>
              <section class="players">
                <h3>Players</h3>
                <ul class="member-list">
                  @for (member of room.members; track member.playerId) {
                    <li class="member" [class.away]="member.kind === 'human' && !member.connected">
                      <mat-icon aria-hidden="true">{{ member.kind === 'bot' ? 'smart_toy' : 'person' }}</mat-icon>
                      <span class="name">{{ member.name }}</span>
                      @if (member.playerId === room.hostPlayerId) {
                        <span class="badge host">Host</span>
                      }
                      @if (member.playerId === lobby.you()) {
                        <span class="badge you">You</span>
                      }
                      @if (member.kind === 'bot') {
                        <span class="badge bot">Bot</span>
                      } @else if (!member.isRegistered) {
                        <span class="badge guest">Guest</span>
                      }
                      @if (member.kind === 'human' && !member.connected) {
                        <span class="badge away">Away</span>
                      }
                      @if (lobby.isHost() && member.playerId !== lobby.you()) {
                        @if (member.kind === 'human' && member.isRegistered) {
                          <button mat-button type="button" class="make-host" [disabled]="!lobby.canAct()" (click)="lobby.makeHost(member.playerId)">Make Host</button>
                        }
                        <button mat-button type="button" class="remove" [disabled]="!lobby.canAct()" (click)="lobby.removePlayer(member.playerId)">Remove</button>
                      }
                    </li>
                  }
                </ul>
                @if (lobby.canStart() && isFull() === false) {
                  <p class="hint start-hint">Fill every seat to start</p>
                }
              </section>
            } @else if (!lobby.ended()) {
              <p class="loading">Connecting…</p>
            }
          </mat-card-content>
          <mat-card-actions align="end">
            @if (lobby.ended()) {
              <a mat-button class="back" routerLink="/rooms">Back to Rooms</a>
            } @else {
              @if (lobby.canStart()) {
                <button mat-flat-button type="button" class="start" [disabled]="!lobby.canAct() || !isFull()" (click)="lobby.start()">
                  <mat-icon>play_arrow</mat-icon> Start Game
                </button>
              }
              @if (lobby.isHost()) {
                <button mat-stroked-button type="button" class="add-bot" [disabled]="!lobby.canAct() || isFull()" (click)="lobby.addBot()">
                  <mat-icon>smart_toy</mat-icon> Add Bot
                </button>
              }
              <button mat-button type="button" class="leave" [disabled]="!lobby.canAct()" (click)="lobby.leave()">Leave Room</button>
            }
          </mat-card-actions>
        </mat-card>
      </div>
    }
  `,
})
export class LobbyPage {
  protected readonly lobby = inject(LobbyService);
  protected readonly game = inject(RemoteGameService);
  protected readonly firstRevealMinSeats = FIRST_REVEAL_MIN_SEATS;
  private readonly seats = viewChild(MatButtonToggleGroup);
  private readonly firstReveal = viewChild(MatCheckbox);

  // From the member count (the server refuses fewer seats) up to the limit.
  protected readonly seatOptions = computed(() => {
    const room = this.lobby.room();
    if (!room) return [];
    const from = Math.max(room.seatLimits.min, room.members.length);
    return Array.from({ length: Math.max(0, room.seatLimits.max - from + 1) }, (_, i) => from + i);
  });

  protected readonly isFull = computed(() => {
    const room = this.lobby.room();
    return !room || room.members.length >= room.seatCount;
  });

  protected readonly rulesSummary = computed(() => {
    const room = this.lobby.room();
    if (!room) return '';
    const seats = `${room.seatCount} Seats`;
    if (room.seatCount < FIRST_REVEAL_MIN_SEATS) return seats;
    return `${seats} · First Reveal Bonus: ${room.rules.firstRevealDraw ? 'On' : 'Off'}`;
  });

  constructor() {
    this.lobby.open(inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '');
  }

  protected setSeats(seatCount: number): void {
    const room = this.lobby.room();
    if (room) void this.lobby.setRules(seatCount, room.rules).then((ok) => ok || this.restoreControls());
  }

  protected setFirstReveal(on: boolean): void {
    const room = this.lobby.room();
    if (room) void this.lobby.setRules(room.seatCount, { ...room.rules, firstRevealDraw: on }).then((ok) => ok || this.restoreControls());
  }

  // A refused change leaves the snapshot as it was, so the bindings never
  // re-apply: put the controls back to what the server holds.
  private restoreControls(): void {
    const room = this.lobby.room();
    if (!room) return;
    const seats = this.seats();
    if (seats) seats.value = room.seatCount;
    const firstReveal = this.firstReveal();
    if (firstReveal) firstReveal.checked = !!room.rules.firstRevealDraw;
  }
}
