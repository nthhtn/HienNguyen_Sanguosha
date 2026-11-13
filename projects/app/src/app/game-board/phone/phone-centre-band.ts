import { Component, computed, inject, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { GameState } from 'engine';
import { I18n } from '../../i18n/i18n.service';
import { TPipe } from '../../i18n/t.pipe';
import { Layout } from '../../layout.service';
import { actionHistory } from '../action-history';
import { PhaseIndicator } from '../phase-indicator';
import { PlayingCard } from '../playing-card';

// The phone board's middle: the phase and whose turn (with the Draw Pile count), the newest Action History line, the
// cards just turned up, and the two buttons the hidden toolbar and the history tiles would otherwise hold.
@Component({
  selector: 'app-phone-centre-band',
  imports: [MatIconModule, PhaseIndicator, PlayingCard, TPipe],
  template: `
    <div class="info">
      <app-phase-indicator [state]="state()" [viewerSeatId]="viewerSeatId()" />
      @if (latest(); as line) {
        <div class="latest">{{ line }}</div>
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
      <button type="button" class="history" [attr.aria-label]="'board.panel.open' | t" (click)="layout.togglePanel()"><mat-icon>history</mat-icon></button>
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
    app-phase-indicator ::ng-deep .timer { width: 96px; }
    .turned-up ::ng-deep app-playing-card .name { font-size: 14px; }
    .latest { font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .turned-up { flex: none; display: flex; gap: 4px; }
    .buttons { flex: none; display: flex; gap: 6px; }
    .buttons button {
      width: 44px; height: 44px; display: inline-flex; align-items: center; justify-content: center; padding: 0;
      border: 1px solid rgb(251 247 236 / 0.4); border-radius: 8px; background: transparent; color: inherit; cursor: pointer;
    }
  `,
})
export class PhoneCentreBand {
  readonly state = input.required<GameState>();
  readonly viewerSeatId = input<string | null>(null);

  protected readonly layout = inject(Layout);
  private readonly i18n = inject(I18n);

  // The newest action, in the Action History's wording.
  protected readonly latest = computed(() => {
    const s = this.state();
    const newest = actionHistory(s.log, s.zones, s.players, s.seats, this.i18n.translator).find((entry) => entry.kind === 'action');
    return newest?.kind === 'action' ? newest.text : null;
  });
  protected readonly turnedUp = computed(() => this.state().zones.find((z) => z.kind === 'processing')?.cards ?? []);
}
