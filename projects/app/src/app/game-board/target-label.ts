import { ChangeDetectionStrategy, Component, computed, input, inject } from '@angular/core';
import { GameState, Target } from 'engine';
import { seatForce, generalDisplayName, targetLabel } from '../labels';
import { I18n } from '../i18n/i18n.service';

interface TargetPart {
  // ' ' before the first target, ', ' between the rest.
  sep: string;
  text: string;
  // The seat's force (data-force), or null for a target that isn't a whole seat.
  force: ReturnType<typeof seatForce> | null;
}

// A label that names targets: "<prefix> <Player>" while the seat's kingdom is
// hidden (the name in yellow), or "<prefix> <Player> <Main> - <Deputy>" once it
// is revealed, all in the kingdom's colour; a General still face down is left
// out, with its hyphen. Without targets, just `label`.
@Component({
  selector: 'app-target-label',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `{{ prefix() ?? label() }}@for (part of parts(); track $index) {
      <ng-container>{{ part.sep }}</ng-container><span class="target" [attr.data-force]="part.force">{{ part.text }}</span>
    }`,
  styles: `
    .target[data-force] { color: var(--force-text); }
  `,
})
export class TargetLabel {
  readonly label = input('');
  readonly prefix = input<string | null>(null);
  readonly targets = input<Target[]>([]);
  readonly state = input.required<GameState>();

  private readonly i18n = inject(I18n);

  protected readonly parts = computed<TargetPart[]>(() => {
    if (this.prefix() === null) return [];
    const state = this.state();
    return this.targets().map((target, i) => {
      const sep = i === 0 ? ' ' : ', ';
      const name = targetLabel(target, state.players, this.i18n.translator);
      const seat = target.kind === 'seat' ? state.seats.find((s) => s.id === target.seatId) : undefined;
      if (!seat) return { sep, text: name, force: null };
      const force = seatForce(seat);
      if (force === 'none' || !seat.generals) return { sep, text: name, force };
      const { main, deputy } = seat.generals;
      // Only the Generals that are face up; the hyphen only between two.
      const shown = [main, deputy].filter((g) => g.revealed).map((g) => generalDisplayName(g.generalDefinitionId, this.i18n.translator));
      return { sep, text: [name, shown.join(' - ')].filter(Boolean).join(' '), force };
    });
  });
}
