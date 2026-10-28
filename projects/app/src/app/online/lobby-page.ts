import { Component, computed, inject, viewChild } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleGroup, MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatCheckbox, MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { FIRST_REVEAL_MIN_SEATS } from 'content';
import { deckIdOf } from 'content';
import type { RoomRules, RoomSnapshot } from 'protocol';
import type { DeckId } from 'content';
import { DeckPicker } from '../deck-picker';
import { I18n } from '../i18n/i18n.service';
import { TMsgPipe } from '../i18n/msg';
import { TPipe } from '../i18n/t.pipe';
import { BoardChat } from './board-chat';
import { ChatPanel } from './chat-panel';
import { ChatService } from './chat.service';
import { LobbyService } from './lobby.service';
import { OnlineGame } from './online-game';
import { OnlineResult } from './online-result';
import { RemoteDecisionClock, RemoteGameService } from './remote-game.service';
import { SocketService } from './socket.service';

// A room over its socket: the lobby (members, host controls, Start Game, Leave Room), the board while a game runs, and how the last game ended.
@Component({
  selector: 'app-lobby-page',
  imports: [DeckPicker, RouterLink, MatButtonModule, MatButtonToggleModule, MatCardModule, MatCheckboxModule, MatIconModule, OnlineGame, OnlineResult, ChatPanel, BoardChat, TPipe, TMsgPipe],
  providers: [SocketService, LobbyService, ChatService, RemoteGameService, RemoteDecisionClock],
  styleUrl: './online-page.css',
  template: `
    @if (game.ending(); as ending) {
      <app-online-result
        [ending]="ending"
        [solo]="lobby.isSolo()"
        [canAct]="lobby.canAct()"
        [youPlayerId]="lobby.you()"
        (backToLobby)="game.dismiss()"
        (playAgain)="lobby.start()"
        (backToRooms)="lobby.leave()"
      />
    } @else if (game.playing()) {
      <div class="game-banners">
        @if (lobby.ended(); as text) {
          <p class="banner ended" role="alert">{{ text | tm }}</p>
        } @else if (lobby.status() === 'reconnecting') {
          <p class="banner reconnecting" role="status">{{ 'lobby.reconnecting' | t }}</p>
        }
        @if (lobby.notice(); as text) {
          <p class="notice" role="status">{{ text | tm }}</p>
        }
      </div>
      <app-online-game />
      @if (!lobby.isSolo()) {
        <app-board-chat [you]="lobby.you()" [canSend]="lobby.canAct()" />
      }
    } @else {
      <div class="online-page">
        <mat-card class="online-card" appearance="raised">
          <mat-card-header>
            <mat-card-title>{{ 'lobby.title' | t }}</mat-card-title>
            @if (lobby.room(); as room) {
              <mat-card-subtitle class="player-count">{{ 'lobby.playerCount' | t: { count: room.members.length, max: room.seatCount } }}</mat-card-subtitle>
            }
          </mat-card-header>
          <mat-card-content>
            @if (lobby.ended(); as text) {
              <p class="banner ended" role="alert">{{ text | tm }}</p>
            } @else if (lobby.status() === 'reconnecting') {
              <p class="banner reconnecting" role="status">{{ 'lobby.reconnecting' | t }}</p>
            }
            @if (lobby.waitingForHost(); as text) {
              <p class="banner waiting" role="status">{{ text | tm }}</p>
            }
            @if (lobby.notice(); as text) {
              <p class="notice" role="status">{{ text | tm }}</p>
            }
            @if (lobby.error(); as text) {
              <p class="error" role="alert">{{ text | tm }}</p>
            }
            @if (lobby.room(); as room) {
              @if (waitingForGame()) {
                <p class="banner waiting-for-game" role="status">{{ 'lobby.waitingForGame' | t }}</p>
              } @else {
                <section class="rules">
                  <h3>{{ 'lobby.rules' | t }}</h3>
                  @if (lobby.isHost()) {
                    <div class="field">
                      <span class="label" id="lobby-seats">{{ 'setup.seats' | t }}</span>
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
                    <app-deck-picker [value]="deckOf(room.rules.deck)" [disabled]="!lobby.canAct()" (valueChange)="setDeck($event)" />
                    @if (room.seatCount >= firstRevealMinSeats) {
                      <mat-checkbox class="first-reveal" [disabled]="!lobby.canAct()" [checked]="!!room.rules.firstRevealDraw" (change)="setFirstReveal($event.checked)">
                        {{ 'setup.firstReveal' | t }}
                      </mat-checkbox>
                    }
                  } @else {
                    <p class="rules-summary">{{ rulesSummary() }}</p>
                  }
                </section>
                <section class="players">
                  <h3>{{ 'lobby.players' | t }}</h3>
                  <ul class="member-list">
                    @for (member of room.members; track member.playerId) {
                      <li class="member" [class.away]="member.kind === 'human' && !member.connected">
                        <mat-icon aria-hidden="true">{{ member.kind === 'bot' ? 'smart_toy' : 'person' }}</mat-icon>
                        <span class="name">{{ member.name }}</span>
                        @if (member.playerId === room.hostPlayerId) {
                          <span class="badge host">{{ 'lobby.host' | t }}</span>
                        }
                        @if (member.playerId === lobby.you()) {
                          <span class="badge you">{{ 'lobby.you' | t }}</span>
                        }
                        @if (member.kind === 'bot') {
                          <span class="badge bot">{{ 'lobby.bot' | t }}</span>
                        } @else if (!member.isRegistered) {
                          <span class="badge guest">{{ 'lobby.guest' | t }}</span>
                        }
                        @if (member.kind === 'human' && !member.connected) {
                          <span class="badge away">{{ 'lobby.away' | t }}</span>
                        }
                        @if (lobby.isHost() && member.playerId !== lobby.you()) {
                          @if (member.kind === 'human' && member.isRegistered) {
                            <button mat-button type="button" class="make-host" [disabled]="!lobby.canAct()" (click)="lobby.makeHost(member.playerId)">{{ 'lobby.makeHost' | t }}</button>
                          }
                          <button mat-button type="button" class="remove" [disabled]="!lobby.canAct()" (click)="lobby.removePlayer(member.playerId)">{{ 'lobby.remove' | t }}</button>
                        }
                      </li>
                    }
                  </ul>
                  @if (lobby.canStart() && isFull() === false) {
                    <p class="hint start-hint">{{ 'lobby.fillSeats' | t }}</p>
                  }
                </section>
              }
              @if (!lobby.isSolo()) {
                <section class="chat">
                  <h3>{{ 'lobby.chat' | t }}</h3>
                  <app-chat-panel [you]="lobby.you()" [canSend]="lobby.canAct()" />
                </section>
              }
            } @else if (!lobby.ended()) {
              <p class="loading">{{ 'lobby.connecting' | t }}</p>
            }
          </mat-card-content>
          <mat-card-actions align="end">
            @if (lobby.ended()) {
              <a mat-button class="back" routerLink="/rooms">{{ 'rooms.back' | t }}</a>
            } @else {
              @if (lobby.canStart()) {
                <button mat-flat-button type="button" class="start" [disabled]="!lobby.canAct() || !isFull()" (click)="lobby.start()">
                  <mat-icon>play_arrow</mat-icon> {{ 'setup.start' | t }}
                </button>
              }
              @if (lobby.isHost() && !waitingForGame()) {
                <button mat-stroked-button type="button" class="add-bot" [disabled]="!lobby.canAct() || isFull()" (click)="lobby.addBot()">
                  <mat-icon>smart_toy</mat-icon> {{ 'lobby.addBot' | t }}
                </button>
              }
              <button mat-button type="button" class="leave" [disabled]="!lobby.canAct()" (click)="lobby.leave()">{{ 'lobby.leave' | t }}</button>
            }
          </mat-card-actions>
        </mat-card>
      </div>
    }
  `,
})
export class LobbyPage {
  protected readonly lobby = inject(LobbyService);
  private readonly i18n = inject(I18n);
  // Injected here so it exists before the first welcome: the socket does not
  // replay, and the panel only renders once the room is known.
  protected readonly chat = inject(ChatService);
  protected readonly game = inject(RemoteGameService);
  protected readonly firstRevealMinSeats = FIRST_REVEAL_MIN_SEATS;
  private readonly seats = viewChild(MatButtonToggleGroup);
  private readonly firstReveal = viewChild(MatCheckbox);
  private readonly deckPicker = viewChild(DeckPicker);

  // From the member count (the server refuses fewer seats) up to the limit.
  protected readonly seatOptions = computed(() => {
    const room = this.lobby.room();
    if (!room) return [];
    const from = Math.max(room.seatLimits.min, room.members.length);
    return Array.from({ length: Math.max(0, room.seatLimits.max - from + 1) }, (_, i) => from + i);
  });

  // The room plays but there is no game to show yet: it is starting, being
  // restored, or its end is still being stored. No lobby controls meanwhile.
  protected readonly waitingForGame = computed(() => this.lobby.room()?.status === 'playing');

  protected readonly isFull = computed(() => {
    const room = this.lobby.room();
    return !room || room.members.length >= room.seatCount;
  });

  protected readonly rulesSummary = computed(() => {
    const room = this.lobby.room();
    if (!room) return '';
    const deck = this.i18n.t(deckIdOf(room.rules.deck) === 'kingdomWars' ? 'setup.deck.kingdomWars' : 'setup.deck.dynastyWars');
    const seats = `${this.i18n.t('lobby.seats', { n: room.seatCount })} · ${this.i18n.t('lobby.deckSummary', { deck })}`;
    if (room.seatCount < FIRST_REVEAL_MIN_SEATS) return seats;
    return this.i18n.t('lobby.rulesSummary', { seats, state: this.i18n.t(room.rules.firstRevealDraw ? 'lobby.on' : 'lobby.off') });
  });

  constructor() {
    this.lobby.open(inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '');
  }

  protected readonly deckOf = deckIdOf;

  protected setSeats(seatCount: number): void {
    const room = this.lobby.room();
    if (room) void this.lobby.setRules(seatCount, this.rulesOf(room)).then((ok) => ok || this.restoreControls());
  }

  protected setFirstReveal(on: boolean): void {
    const room = this.lobby.room();
    if (room) void this.lobby.setRules(room.seatCount, { ...this.rulesOf(room), firstRevealDraw: on }).then((ok) => ok || this.restoreControls());
  }

  protected setDeck(deck: DeckId): void {
    const room = this.lobby.room();
    if (room) void this.lobby.setRules(room.seatCount, { ...this.rulesOf(room), deck }).then((ok) => ok || this.restoreControls());
  }

  // The rules the host can change, in the shape the server takes them.
  private rulesOf(room: RoomSnapshot): RoomRules {
    const { firstRevealDraw, deck } = room.rules;
    return { ...(firstRevealDraw === undefined ? {} : { firstRevealDraw }), ...(deck === undefined ? {} : { deck: deckIdOf(deck) }) };
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
    this.deckPicker()?.value.set(deckIdOf(room.rules.deck));
  }
}
