import { Component, computed, input, output, signal } from '@angular/core';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ChooseGeneralsAction, ContentRegistry, Kingdom } from 'engine';
import { GeneralDisplayData, generalDisplayData } from 'content';
import { CardArt } from './card-art';
import { generalDisplayName } from '../labels';

interface CandidateViewModel {
  id: string;
  name: string;
  display: GeneralDisplayData | null;
  kingdom: Kingdom;
  maxHp: number;
  role: 'Main' | 'Deputy' | null;
  enabled: boolean;
}

// Presentational: which pairs are legal comes entirely from `actions` (the
// engine's getLegalActions); this component never compares kingdoms itself.
@Component({
  selector: 'app-general-selection',
  imports: [MatBadgeModule, MatButtonModule, MatCardModule, MatChipsModule, MatTooltipModule, CardArt],
  template: `
    <h2>Choose your generals</h2>
    <p class="hint">Pick two generals of the same kingdom. Your first pick is your Main general.</p>
    <div class="candidates">
      @for (vm of candidateViewModels(); track vm.id) {
        <mat-card
          appearance="outlined"
          class="candidate"
          role="button"
          [attr.tabindex]="vm.enabled ? 0 : -1"
          [attr.aria-disabled]="!vm.enabled"
          [attr.aria-pressed]="vm.role !== null"
          [attr.data-general-id]="vm.id"
          [class.selected]="vm.role !== null"
          [class.disabled]="!vm.enabled"
          [matBadge]="vm.role ?? ''"
          [matBadgeHidden]="vm.role === null"
          matBadgePosition="above after"
          matTooltip="Must share a kingdom with your first pick"
          [matTooltipDisabled]="vm.enabled"
          (click)="toggle(vm)"
          (keydown.enter)="toggle(vm)"
          (keydown.space)="toggle(vm); $event.preventDefault()"
        >
          <mat-card-header>
            <mat-card-title>{{ vm.name }}</mat-card-title>
            @if (vm.display?.title; as title) {
              <mat-card-subtitle>{{ title }}</mat-card-subtitle>
            }
          </mat-card-header>
          <app-card-art [id]="vm.id" [label]="vm.name" />
          <mat-card-content>
            <mat-chip-set>
              <mat-chip [class]="'kingdom-' + vm.kingdom" [disableRipple]="true">{{ vm.kingdom }}</mat-chip>
            </mat-chip-set>
            <span class="hp">HP {{ vm.maxHp }}</span>
            <ul class="skills">
              @for (skill of vm.display?.skills ?? []; track skill.name) {
                <li><strong>{{ skill.name }}</strong> — {{ skill.text }}</li>
              }
            </ul>
          </mat-card-content>
        </mat-card>
      }
    </div>
    @if (summary(); as s) {
      <p class="summary">Kingdom: {{ s.kingdom }} · Combined HP: {{ s.hp }}</p>
    }
    <div class="controls">
      <button mat-stroked-button type="button" class="swap" [disabled]="selected().length !== 2" (click)="swap()">
        Swap
      </button>
      <button mat-flat-button type="button" class="confirm" [disabled]="!matchingAction()" (click)="confirm()">
        Confirm
      </button>
    </div>
  `,
  styles: `
    .candidates {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 200px), 1fr));
      gap: 16px;
      margin: 16px 0;
    }
    .candidate { cursor: pointer; transition: box-shadow 120ms, opacity 120ms; }
    .candidate.selected { outline: 3px solid var(--mat-sys-primary); }
    .candidate.disabled { opacity: 0.45; cursor: not-allowed; }
    .skills { padding-left: 1.1em; font-size: 0.85em; }
    .hp { margin-left: 8px; }
    .controls { display: flex; gap: 8px; flex-wrap: wrap; }
    .kingdom-Wei { --mat-chip-elevated-container-color: #d6e4ff; }
    .kingdom-Shu { --mat-chip-elevated-container-color: #ffd9d6; }
    .kingdom-Wu { --mat-chip-elevated-container-color: #d6f5dc; }
    .kingdom-Qun { --mat-chip-elevated-container-color: #e6e1e5; }
  `,
})
export class GeneralSelection {
  readonly candidates = input.required<string[]>();
  readonly actions = input.required<ChooseGeneralsAction[]>();
  readonly registry = input.required<ContentRegistry>();
  readonly chosen = output<ChooseGeneralsAction>();

  // UI-only state: the player's picks in order, [main, deputy].
  protected readonly selected = signal<string[]>([]);

  protected readonly candidateViewModels = computed<CandidateViewModel[]>(() => {
    const selected = this.selected();
    const actions = this.actions();
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
        role: index === 0 ? 'Main' : index === 1 ? 'Deputy' : null,
        enabled: this.isSelectable(id, selected, actions),
      };
    });
  });

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
    return { kingdom: main.kingdom, hp: main.maxHp + deputy.maxHp };
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
