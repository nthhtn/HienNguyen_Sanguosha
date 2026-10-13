import { Component, DestroyRef, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import type { RoomListItem } from 'protocol';
import { AuthService } from '../auth/auth.service';
import { CreateRoomDialog, CreateRoomDialogData } from './create-room-dialog';
import { JoinRoomDialog, JoinRoomDialogData } from './join-room-dialog';
import { OnlineNotice } from './online-notice';
import { canJoin, roomStatusLabel } from './room-labels';
import { RoomsService } from './rooms.service';

// Open rooms to join, your own rooms pinned on top, and Create Room for
// registered players. The list refreshes every 5 s while this screen is open.
@Component({
  selector: 'app-rooms-page',
  imports: [MatButtonModule, MatCardModule, MatIconModule],
  styleUrl: './online-page.css',
  template: `
    <div class="online-page">
      <mat-card class="online-card" appearance="raised">
        <mat-card-header><mat-card-title>Rooms</mat-card-title></mat-card-header>
        <mat-card-content>
          <div class="toolbar">
            <button mat-flat-button type="button" class="create" [disabled]="!auth.isRegistered() || !rooms.list()" (click)="create()">
              <mat-icon>add</mat-icon> Create Room
            </button>
            @if (!auth.isRegistered()) {
              <span class="hint host-hint">Sign in to host a room</span>
            }
          </div>
          @if (notice(); as text) {
            <p class="notice" role="status">{{ text }}</p>
          }
          @if (rooms.error(); as text) {
            <p class="error" role="alert">{{ text }}</p>
          }
          @if (rooms.list(); as list) {
            @if (list.rooms.length === 0) {
              <p class="empty">No rooms yet</p>
            } @else {
              <ul class="room-list">
                @for (room of list.rooms; track room.id) {
                  <li class="room" [class.mine]="room.youAreMember">
                    <mat-icon aria-hidden="true">{{ room.youAreMember ? 'push_pin' : 'meeting_room' }}</mat-icon>
                    <span class="host-name">{{ room.hostName ?? 'Room' }}</span>
                    <span class="count">{{ room.memberCount }} / {{ room.capacity }}</span>
                    <span class="status">{{ statusLabel(room) }}</span>
                    @if (room.youAreMember) {
                      <button mat-stroked-button type="button" class="rejoin" (click)="rejoin(room)">Rejoin</button>
                    } @else {
                      <button mat-stroked-button type="button" class="join" [disabled]="!canJoin(room)" (click)="join(room)">Join</button>
                    }
                  </li>
                }
              </ul>
            }
          } @else if (!rooms.error()) {
            <p class="loading">Loading rooms…</p>
          }
        </mat-card-content>
      </mat-card>
    </div>
  `,
})
export class RoomsPage {
  protected readonly rooms = inject(RoomsService);
  protected readonly auth = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  // Why the last Lobby closed under you, if it did.
  protected readonly notice = signal(inject(OnlineNotice).take());
  protected readonly statusLabel = roomStatusLabel;
  protected readonly canJoin = canJoin;

  constructor() {
    this.rooms.startPolling();
    inject(DestroyRef).onDestroy(() => this.rooms.stopPolling());
  }

  create(): void {
    const list = this.rooms.list();
    if (!list) return;
    const data: CreateRoomDialogData = { seatLimits: list.seatLimits, displayName: this.auth.me()?.displayName ?? '' };
    this.dialog
      .open<CreateRoomDialog, CreateRoomDialogData, string>(CreateRoomDialog, { data, width: '440px' })
      .afterClosed()
      .subscribe((id) => {
        if (id) void this.router.navigate(['/rooms', id]);
      });
  }

  join(room: RoomListItem): void {
    const data: JoinRoomDialogData = { roomId: room.id, hostName: room.hostName, displayName: this.auth.me()?.displayName ?? '' };
    this.dialog
      .open<JoinRoomDialog, JoinRoomDialogData, boolean>(JoinRoomDialog, { data, width: '440px' })
      .afterClosed()
      .subscribe((joined) => {
        if (joined) void this.router.navigate(['/rooms', room.id]);
      });
  }

  rejoin(room: RoomListItem): void {
    void this.router.navigate(['/rooms', room.id]);
  }
}
