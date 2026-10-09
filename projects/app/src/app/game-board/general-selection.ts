import { Component, computed, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ChooseGeneralsAction, ContentRegistry, Kingdom, combinedMaxHp } from 'engine';
import { GeneralDisplayData, generalDisplayData } from 'content';
import { CardArt } from './card-art';
import { DecisionCountdown } from './decision-countdown';
import { generalDisplayName } from '../labels';

interface CandidateViewModel {
  id: string;
  name: string;
  display: GeneralDisplayData | null;
  kingdom: Kingdom;
  maxHp: number;
  hearts: number[];
  role: 'Main' | 'Deputy' | null;
  enabled: boolean;
  disabledReason: string;
}

// Presentational: which pairs are legal comes entirely from `actions` (the
// engine's getLegalActions); this component never compares kingdoms itself.
@Component({
  selector: 'app-general-selection',
  imports: [MatButtonModule, MatCardModule, MatChipsModule, MatIconModule, MatTooltipModule, CardArt, DecisionCountdown],
  template: `
    <header class="intro">
      <h2>{{ seatName() ? seatName() + ', Choose your Generals' : 'Choose your Generals' }}</h2>
      <p class="hint">Pick two Generals of the same kingdom. Your first pick is your Main General.</p>
    </header>

    <div class="candidates">
      @for (vm of candidateViewModels(); track vm.id) {
        <mat-card
          appearance="outlined"
          class="candidate kingdom-{{ vm.kingdom }}"
          role="button"
          [attr.tabindex]="vm.enabled ? 0 : -1"
          [attr.aria-disabled]="!vm.enabled"
          [attr.aria-pressed]="vm.role !== null"
          [attr.data-general-id]="vm.id"
          [class.selected]="vm.role !== null"
          [class.disabled]="!vm.enabled"
          [matTooltip]="vm.disabledReason"
          [matTooltipDisabled]="vm.enabled"
          (click)="toggle(vm)"
          (keydown.enter)="toggle(vm)"
          (keydown.space)="toggle(vm); $event.preventDefault()"
        >
          <div class="art">
            <app-card-art size="large" [id]="vm.id" [label]="vm.name" />
            @if (vm.role; as role) {
              <span class="role-chip" [class.deputy]="role === 'Deputy'">{{ role }}</span>
            }
          </div>
          <mat-card-header>
            <mat-card-title>{{ vm.name }}</mat-card-title>
            @if (vm.display?.title; as title) {
              <mat-card-subtitle>{{ title }}</mat-card-subtitle>
            }
          </mat-card-header>
          <mat-card-content>
            <div class="meta">
              <span class="kingdom-tag">{{ vm.kingdom }}</span>
              <span class="hearts" [attr.aria-label]="'HP ' + vm.maxHp">
                @for (h of vm.hearts; track $index) {
                  <mat-icon>favorite</mat-icon>
                }
              </span>
              <span class="hp-label">HP {{ vm.maxHp }}</span>
            </div>
            <ul class="skills">
              @for (skill of vm.display?.skills ?? []; track skill.name) {
                <li><strong>{{ skill.name }}</strong> {{ skill.text }}</li>
              }
            </ul>
          </mat-card-content>
        </mat-card>
      }
    </div>

    <mat-card class="bar" appearance="raised">
      <div class="slots">
        <div class="slot main">
          <span class="slot-label">Main</span>
          <span class="slot-name">{{ slotName(0) }}</span>
        </div>
        <button mat-icon-button type="button" class="swap" aria-label="Swap Main and Deputy"
                [disabled]="selected().length !== 2" (click)="swap()">
          <mat-icon>swap_horiz</mat-icon>
        </button>
        <div class="slot deputy">
          <span class="slot-label">Deputy</span>
          <span class="slot-name">{{ slotName(1) }}</span>
        </div>
      </div>
      <span class="summary">
        @if (summary(); as s) {
          Kingdom: <span class="force-name" [attr.data-force]="s.kingdom">{{ s.kingdom }}</span> · Combined HP: {{ s.hp }}
        }
      </span>
      <app-decision-countdown class="timer" />
      <button mat-flat-button type="button" class="confirm" [disabled]="!matchingAction()" (click)="confirm()">
        <mat-icon>check</mat-icon> Confirm
      </button>
    </mat-card>
  `,
  styles: `
    /* The whole view fits the window below the app bar: only the list of
       Generals scrolls (sideways), and each card scrolls (down) on its own. */
    :host {
      display: flex; flex-direction: column; padding-bottom: 8px; box-sizing: border-box;
      height: calc(100dvh - var(--mat-toolbar-standard-height, 64px) - 16px);
    }
    @media (max-width: 599px) { :host { height: calc(100dvh - var(--mat-toolbar-mobile-height, 56px) - 16px); } }
    .intro { flex: none; }
    .intro h2 { margin: 8px 0 0; font: var(--mat-sys-headline-small); }
    .hint { color: var(--mat-sys-on-surface-variant); margin: 4px 0 8px; }
    .step { font: var(--mat-sys-label-large); }
    mat-chip.current { outline: 2px solid var(--mat-sys-primary); }
    mat-chip.done { opacity: 0.7; }
    .candidates {
      flex: 1; min-height: 0;
      display: flex; align-items: stretch; gap: 16px;
      overflow-x: auto; overflow-y: hidden;
      /* Room for the hover lift and the selected ring. */
      margin: 8px 0; padding: 8px 4px;
    }
    .candidate {
      flex: 0 0 240px;
      max-height: 100%;
      box-sizing: border-box;
      cursor: pointer;
      overflow-x: hidden; overflow-y: auto;
      border-top: 6px solid var(--kingdom);
      transition: transform 150ms, box-shadow 150ms, opacity 150ms;
    }
    .candidate:hover:not(.disabled) { transform: translateY(-3px); box-shadow: var(--mat-sys-level3); }
    .candidate.selected { transform: translateY(-4px); box-shadow: 0 0 0 3px var(--kingdom), var(--mat-sys-level4); }
    .candidate.disabled { opacity: 0.4; cursor: not-allowed; filter: grayscale(0.6); }
    .kingdom-Wei { --kingdom: #3f6fd8; }
    .kingdom-Shu { --kingdom: #d84a3f; }
    .kingdom-Wu { --kingdom: #2f9e58; }
    .kingdom-Qun { --kingdom: #8a7f8c; }
    .art { position: relative; background: #1d1b20; display: flex; justify-content: center; }
    .role-chip {
      position: absolute; top: 8px; right: 8px;
      padding: 2px 10px; border-radius: 12px;
      background: var(--mat-sys-primary); color: var(--mat-sys-on-primary);
      font: var(--mat-sys-label-large);
    }
    /* Main and Deputy differ by style, not colour: no kingdom's hue. */
    .role-chip.deputy { background: var(--mat-sys-surface); color: var(--mat-sys-primary); box-shadow: inset 0 0 0 2px var(--mat-sys-primary); }
    mat-card-header { padding-top: 12px; }
    .meta { display: flex; align-items: center; gap: 8px; margin: 4px 0; }
    .force-name { color: var(--force-text); font-weight: 600; }
    .kingdom-tag { padding: 0 8px; border-radius: 8px; color: #fff; background: var(--kingdom); font: var(--mat-sys-label-medium); }
    .hearts { display: inline-flex; color: #d84a3f; }
    .hearts mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .hp-label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
    .skills { padding-left: 1.1em; margin: 4px 0 0; font: var(--mat-sys-body-small); }
    .skills li { margin-bottom: 4px; }
    .bar {
      flex: none;
      display: flex; flex-direction: row; align-items: center; gap: 16px; flex-wrap: wrap;
      padding: 8px 16px;
    }
    .slots { display: flex; align-items: center; gap: 4px; }
    .slot { display: flex; flex-direction: column; min-width: 110px; }
    .slot-label { font: var(--mat-sys-label-small); color: var(--mat-sys-on-surface-variant); text-transform: uppercase; }
    .slot-name { font: var(--mat-sys-title-small); }
    .summary { flex: 1; font: var(--mat-sys-body-medium); }
    .timer { width: 160px; }
    @media (max-width: 600px) {
      .bar { gap: 8px; }
      .summary { flex-basis: 100%; order: 3; }
      .confirm { margin-left: auto; }
    }
  `,
})
export class GeneralSelection {
  readonly candidates = input.required<string[]>();
  readonly actions = input.required<ChooseGeneralsAction[]>();
  readonly registry = input.required<ContentRegistry>();
  readonly seatId = input<string>('');
  readonly seatName = input<string>('');
  readonly chosen = output<ChooseGeneralsAction>();

  // UI-only state: the player's picks in order, [main, deputy].
  protected readonly selected = signal<string[]>([]);

  protected readonly candidateViewModels = computed<CandidateViewModel[]>(() => {
    const selected = this.selected();
    const actions = this.actions();
    // Nothing picked yet: a disabled card has no same-kingdom partner in the
    // whole pool. Once a first pick exists: it doesn't pair with that pick.
    // Either way, legality itself still comes only from `actions` above.
    const disabledReason =
      selected.length === 0 ? 'No other candidate shares this kingdom' : 'Must share a kingdom with your first pick';
    return this.candidates().map((id) => {
      const definition = this.registry().generals.get(id);
      const display = generalDisplayData(id);
      const index = selected.indexOf(id);
      return {
        id,
        name: display?.name ?? generalDisplayName(id),
        display,
        kingdom: definition?.kingdom ?? 'hidden',
        maxHp: definition?.maxHp ?? 0,
        hearts: Array.from({ length: definition?.maxHp ?? 0 }, (_, i) => i),
        role: index === 0 ? 'Main' : index === 1 ? 'Deputy' : null,
        enabled: this.isSelectable(id, selected, actions),
        disabledReason,
      };
    });
  });

  protected slotName(position: 0 | 1): string {
    const id = this.selected()[position];
    if (!id) return 'Pick a General';
    return generalDisplayData(id)?.name ?? generalDisplayName(id);
  }

  protected readonly matchingAction = computed<ChooseGeneralsAction | null>(() => {
    const [mainId, deputyId] = this.selected();
    return this.actions().find((a) => a.mainId === mainId && a.deputyId === deputyId) ?? null;
  });

  protected readonly summary = computed(() => {
    const action = this.matchingAction();
    if (!action) return null;
    const main = this.registry().generals.get(action.mainId);
    const deputy = this.registry().generals.get(action.deputyId);
    if (!main || !deputy) return null;
    // The engine decides the seat's max HP; the screen only shows it.
    const hp = combinedMaxHp(main.maxHp, deputy.maxHp);
    return { kingdom: main.kingdom, hp };
  });

  // Selectable iff already picked, or the engine offers a pair containing it:
  // with no picks yet, any pair at all; otherwise a pair with the first pick.
  private isSelectable(id: string, selected: string[], actions: ChooseGeneralsAction[]): boolean {
    if (selected.includes(id)) return true;
    const first = selected[0];
    return first === undefined
      ? actions.some((a) => a.mainId === id)
      : actions.some((a) => a.mainId === first && a.deputyId === id);
  }

  protected toggle(vm: CandidateViewModel): void {
    if (!vm.enabled) return;
    const selected = this.selected();
    if (selected.includes(vm.id)) {
      this.selected.set(selected.filter((id) => id !== vm.id));
    } else if (selected.length < 2) {
      this.selected.set([...selected, vm.id]);
    } else {
      this.selected.set([selected[0], vm.id]);
    }
  }

  protected swap(): void {
    const [mainId, deputyId] = this.selected();
    if (mainId && deputyId) this.selected.set([deputyId, mainId]);
  }

  protected confirm(): void {
    const action = this.matchingAction();
    if (action) this.chosen.emit(action);
  }
}
