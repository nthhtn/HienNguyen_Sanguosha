import { Component, computed, inject, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { GameState } from 'engine';
import { I18n } from '../../i18n/i18n.service';
import { TPipe } from '../../i18n/t.pipe';
import { Layout } from '../../layout.service';
import { BoardChatState } from '../../online/board-chat-state.service';
import { actionHistory } from '../action-history';
import { seatForce, seatName } from '../../labels';
import { PhaseIndicator } from '../phase-indicator';
import { PlayingCard } from '../playing-card';

// The phone board's middle: the phase and whose turn (the Draw Pile count is in the panel), the newest Action History line, the
// cards just turned up, and the two buttons the hidden toolbar and the history tiles would otherwise hold.
@Component({
  selector: 'app-phone-centre-band',
  imports: [MatIconModule, PhaseIndicator, PlayingCard, TPipe],
  template: `
    <div class="info">
      <app-phase-indicator [state]="state()" [viewerSeatId]="viewerSeatId()" [showDrawPile]="false" />
      @if (latestParts().length) {
        <div class="latest">
          @for (part of latestParts(); track $index) {
            @if (part.force) {
              <span class="who" [attr.data-force]="part.force">{{ part.text }}</span>
            } @else {
              {{ part.text }}
            }
          }
        </div>
      }
    </div>
    @if (turnedUp().length) {
      <div class="turned-up">
        @for (card of turnedUp(); track card.instanceId) {
          <app-playing-card [card]="card" />
        }
      </div>
    }
    <div class="buttons">
      <button type="button" class="menu" [attr.aria-label]="'nav.menu' | t" (click)="layout.openNav()"><mat-icon>menu</mat-icon></button>
      <button
        type="button"
        class="history"
        [attr.aria-label]="unread() > 0 ? ('board.panel.openUnread' | t: { n: unread() }) : ('board.panel.open' | t)"
        (click)="layout.togglePanel()"
      >
        <mat-icon>history</mat-icon>
        @if (unread() > 0) {
          <span class="unread">{{ unread() }}</span>
        }
      </button>
    </div>
  `,
  styles: `
    :host {
      display: flex; align-items: center; gap: 10px; box-sizing: border-box; height: 100%; min-width: 0; padding: 4px 8px;
      border: 1px dashed rgb(251 247 236 / 0.28); border-radius: 8px; color: #fbf7ec; overflow: hidden;
    }
    .info { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
    app-phase-indicator { position: static; }
    app-phase-indicator ::ng-deep .phase-indicator { margin: 0; padding: 2px 8px; justify-content: flex-start; font-size: 14px; border-radius: 6px; }
    app-phase-indicator ::ng-deep .count { font-size: 14px; }
    app-phase-indicator ::ng-deep .timer { width: 150px; }
    app-phase-indicator ::ng-deep .timer .bar { min-width: 24px; }
    .turned-up ::ng-deep app-playing-card .name { font-size: 14px; }
    .latest { font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    /* A player's name in their force's colour (spec 3h). */
    .latest .who { color: var(--force, inherit); font-weight: 700; }
    .turned-up { flex: none; display: flex; gap: 4px; }
    .buttons { flex: none; display: flex; gap: 6px; }
    .buttons button {
      position: relative; width: 44px; height: 44px; display: inline-flex; align-items: center; justify-content: center; padding: 0;
      border: 1px solid rgb(251 247 236 / 0.4); border-radius: 8px; background: transparent; color: inherit; cursor: pointer;
    }
    .unread {
      position: absolute; top: -4px; right: -4px; min-width: 18px; padding: 0 4px; border-radius: 9px; box-sizing: border-box;
      background: var(--mat-sys-error); color: var(--mat-sys-on-error); font-size: 12px; line-height: 18px; text-align: center;
    }
  `,
})
export class PhoneCentreBand {
  readonly state = input.required<GameState>();
  readonly viewerSeatId = input<string | null>(null);

  protected readonly layout = inject(Layout);
  // The online board's chat, when there is one (the lobby page provides it).
  protected readonly chat = inject(BoardChatState, { optional: true });
  private readonly i18n = inject(I18n);

  // The newest action, in the Action History's wording.
  protected readonly latest = computed(() => {
    const s = this.state();
    const newest = actionHistory(s.log, s.zones, s.players, s.seats, this.i18n.translator).find((entry) => entry.kind === 'action');
    return newest?.kind === 'action' ? newest.text : null;
  });
  // Only the newest card turned up, not all of them (spec 3e).
  // The newest line cut at each player's name, so a name can take its force's colour (spec 3h).
  protected readonly latestParts = computed(() => {
    const line = this.latest();
    if (!line) return [];
    const state = this.state();
    const tr = this.i18n.translator;
    const forces = new Map(state.seats.map((seat) => [seatName(state.players, seat.id, tr), seatForce(seat)] as const));
    const names = [...forces.keys()].filter((name) => name.length > 0).sort((a, b) => b.length - a.length);
    if (!names.length) return [{ text: line, force: null as string | null }];
    const pattern = new RegExp(`(${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`);
    return line.split(pattern).filter((text) => text !== '').map((text) => ({ text, force: forces.get(text) ?? null }));
  });
  protected readonly turnedUp = computed(() => (this.state().zones.find((z) => z.kind === 'processing')?.cards ?? []).slice(-1));
  // Chat messages not yet seen, shown on History because the chat lives in the panel; none in a solo game.
  protected readonly unread = computed(() => (this.chat?.available() ? this.chat.unread() : 0));
}
