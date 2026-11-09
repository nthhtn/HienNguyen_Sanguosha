import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { GameState, pickAllows, SeatGenerals, TargetPick } from 'engine';
import { generalDisplayName, seatForce, seatName } from '../labels';
import type { Force } from '../labels';
import { I18n } from '../i18n/i18n.service';
import { TPipe } from '../i18n/t.pipe';
import { SeatPortrait } from './seat-portrait';

export interface TargetsDialogData {
  // What is being played: "Sha".
  title: string;
  pick: TargetPick;
  state: GameState;
}

// Several equal targets chosen in one window (stage 9 spec): toggle up to
// `max` seats, then Confirm. Each seat is a card with its portrait, name,
// revealed Generals, HP and hand size (all public), and the order it was
// picked in. Closes with the seat ids in seat order, or with nothing on
// Cancel. The engine checks the picks again when they are played.
@Component({
  selector: 'app-targets-dialog',
  imports: [MatButtonModule, MatDialogModule, SeatPortrait, TPipe],
  template: `
    <h2 mat-dialog-title>{{ 'targets.title' | t }}</h2>
    <mat-dialog-content>
      <p>{{ prompt }}</p>
      <div class="seats">
        @for (seat of seats(); track seat.id) {
          <button
            type="button"
            class="pk"
            [attr.data-force]="seat.force"
            [class.picked]="picked().includes(seat.id)"
            [attr.aria-pressed]="picked().includes(seat.id)"
            [attr.aria-label]="seat.ariaLabel"
            [disabled]="!picked().includes(seat.id) && !allowed(seat.id)"
            (click)="toggle(seat.id)"
          >
            <app-seat-portrait [generals]="seat.generals" size="fill" />
            @if (order(seat.id); as n) {
              <span class="badge" aria-hidden="true">{{ n }}</span>
            }
            <span class="pk-name">{{ seat.label }}</span>
            <span class="pk-gens" [class.hidden-gens]="!seat.generalNames">{{ seat.generalNames || ('targets.generalsHidden' | t) }}</span>
            <span class="meta">
              <span class="hp" [attr.aria-label]="seat.hpLabel">
                @for (n of seat.hearts; track n) {
                  <span class="heart" [class.lost]="n >= seat.hp">♥</span>
                }
              </span>
              <span class="hand">{{ seat.handLabel }}</span>
            </span>
          </button>
        }
      </div>
    </mat-dialog-content>
    <mat-dialog-actions>
      <span class="count" aria-live="polite">{{ countLabel() }}</span>
      <button mat-button type="button" (click)="ref.close()">{{ 'ui.cancel' | t }}</button>
      <button mat-flat-button type="button" [disabled]="picked().length < data.pick.min" (click)="confirm()">{{ 'ui.confirm' | t }}</button>
    </mat-dialog-actions>
  `,
  styles: `
    .seats { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; }
    .pk {
      --force: var(--force-none); --force-text: var(--force-none-text);
      position: relative; display: flex; flex-direction: column; align-items: stretch; gap: 6px; padding: 8px; min-width: 0;
      text-align: left; font: inherit; color: inherit; cursor: pointer;
      background: var(--mat-sys-surface-container-low); border: 2px solid var(--mat-sys-outline-variant); border-radius: 14px;
    }
    .pk:hover:not(:disabled) { border-color: color-mix(in srgb, var(--force) 55%, var(--mat-sys-outline-variant)); }
    .pk:focus-visible { outline: 3px solid var(--mat-sys-primary); outline-offset: 2px; }
    .pk.picked { border-color: var(--force); background: color-mix(in srgb, var(--force) 12%, var(--mat-sys-surface-container-low)); }
    .pk:disabled { opacity: 0.45; cursor: not-allowed; }
    .pk[data-force='Wei'] { --force: var(--force-wei); --force-text: var(--force-wei); }
    .pk[data-force='Shu'] { --force: var(--force-shu); --force-text: var(--force-shu); }
    .pk[data-force='Wu'] { --force: var(--force-wu); --force-text: var(--force-wu); }
    .pk[data-force='Qun'] { --force: var(--force-qun); --force-text: var(--force-qun); }
    .pk[data-force='Ambitionist'] { --force: var(--force-ambitionist); --force-text: var(--force-ambitionist); }
    .badge {
      position: absolute; top: 4px; right: 4px; width: 26px; height: 26px; display: grid; place-items: center;
      border-radius: 50%; background: var(--force); color: #fff; border: 2px solid var(--mat-sys-surface-container-low);
      font: var(--mat-sys-label-large); font-weight: 700;
    }
    .pk-name { font: var(--mat-sys-title-small); font-weight: 700; overflow-wrap: anywhere; }
    .pk-gens { font: var(--mat-sys-label-large); color: var(--force-text); line-height: 1.2; }
    .pk-gens.hidden-gens { color: var(--mat-sys-on-surface-variant); font-weight: 400; }
    .meta { display: flex; justify-content: space-between; align-items: center; gap: 6px; font: var(--mat-sys-label-small); color: var(--mat-sys-on-surface-variant); }
    .heart { color: var(--mat-sys-error); letter-spacing: 1px; }
    .heart.lost { color: var(--mat-sys-outline-variant); }
    mat-dialog-actions { display: flex; align-items: center; gap: 8px; }
    .count { margin-right: auto; padding-left: 8px; font: var(--mat-sys-label-large); color: var(--mat-sys-on-surface-variant); }
  `,
})
export class TargetsDialog {
  protected readonly data = inject<TargetsDialogData>(MAT_DIALOG_DATA);
  protected readonly ref = inject<MatDialogRef<TargetsDialog, string[]>>(MatDialogRef);
  private readonly i18n = inject(I18n);
  protected readonly picked = signal<string[]>([]);
  protected readonly prompt = this.i18n.t(this.data.pick.min === this.data.pick.max ? 'targets.prompt' : 'targets.promptUpTo', { count: this.data.pick.max, title: this.data.title });

  protected readonly countLabel = computed(() => this.i18n.t('targets.selected', { n: this.picked().length, max: this.data.pick.max }));

  protected readonly seats = computed(() => {
    const tr = this.i18n.translator;
    const { state } = this.data;
    return this.data.pick.eligibleIds.map((id) => {
      const seat = state.seats.find((s) => s.id === id);
      const label = seatName(state.players, id, tr);
      const generals: SeatGenerals | null = seat?.generals ?? null;
      // Only the Generals that are face up.
      const generalNames = generals ? [generals.main, generals.deputy].filter((g) => g.revealed).map((g) => generalDisplayName(g.generalDefinitionId, tr)).join(' / ') : '';
      const hand = seat ? (state.zones.find((z) => z.id === seat.hand.zoneId)?.cards.length ?? 0) : 0;
      const maxHp = seat?.maxCombinedHp ?? 0;
      const hp = Math.max(0, seat?.combinedHp ?? 0);
      const force: Force = seatForce(seat);
      return {
        id, label, generals, generalNames, force, hp,
        hearts: Array.from({ length: maxHp }, (_, n) => n),
        hpLabel: tr('targets.hp', { n: hp, max: maxHp }),
        handLabel: tr(hand === 1 ? 'targets.cards.one' : 'targets.cards.other', { n: hand }),
        ariaLabel: generalNames ? `${label}, ${generalNames}` : label,
      };
    });
  });

  // The place a seat was picked in, from 1; 0 when it is not picked.
  protected order(id: string): number {
    return this.picked().indexOf(id) + 1;
  }

  // Whether the seat may join those picked: below the maximum, and within any cap on some seats.
  protected allowed(id: string): boolean {
    return pickAllows(this.data.pick, this.picked(), id);
  }

  protected toggle(id: string): void {
    this.picked.update((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  protected confirm(): void {
    const order = this.data.pick.eligibleIds;
    this.ref.close([...this.picked()].sort((a, b) => order.indexOf(a) - order.indexOf(b)));
  }
}
