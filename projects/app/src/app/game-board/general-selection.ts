import { Component, computed, input, output, signal, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ChooseGeneralsAction, ContentRegistry, Kingdom, combinedMaxHp } from 'engine';
import { GeneralDisplayData, generalDisplayData } from 'content';
import { CardArt } from './card-art';
import { HpIcons } from '../hp-icons';
import { DecisionCountdown } from './decision-countdown';
import { generalDisplayName, kingdomDisplayName } from '../labels';
import { TPipe } from '../i18n/t.pipe';
import { SkillTraits } from '../skill-traits';
import { I18n } from '../i18n/i18n.service';

interface CandidateViewModel {
  id: string;
  name: string;
  display: GeneralDisplayData | null;
  kingdom: Kingdom;
  maxHp: number;
  role: 'Main' | 'Deputy' | null;
  enabled: boolean;
  disabledReason: string;
}

// Presentational: which pairs are legal comes entirely from `actions` (the
// engine's getLegalActions); this component never compares kingdoms itself.
@Component({
  selector: 'app-general-selection',
  imports: [MatButtonModule, MatCardModule, MatIconModule, MatTooltipModule, CardArt, DecisionCountdown, HpIcons, SkillTraits, TPipe],
  template: `
    <header class="intro">
      <h2>{{ seatName() ? ('select.titleFor' | t: { name: seatName() }) : ('select.title' | t) }}</h2>
      <p class="hint">{{ 'select.hint' | t }}</p>
    </header>

    <div class="candidates">
      @for (row of rows(); track $index) {
        <div class="row">
          @for (vm of row; track vm.id) {
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
              <!-- Left: the art and its caption. Right: the General's title and skills, which scroll when they overflow. -->
              <div class="left">
                <div class="art">
                  <app-card-art size="large" [skin]="true" [id]="vm.id" [label]="vm.name" />
                  @if (vm.role; as role) {
                    <span class="role-chip" [class.deputy]="role === 'Deputy'">{{ roleName(role) }}</span>
                  }
                </div>
                <div class="caption">
                  <div class="name">{{ vm.name }}</div>
                  <div class="meta">
                    <span class="kingdom-tag">{{ kingdomName(vm.kingdom) }}</span>
                    <app-hp-icons [hp]="vm.maxHp" [size]="16" />
                    <span class="hp-label">{{ 'select.hp' | t: { n: vm.maxHp } }}</span>
                  </div>
                </div>
              </div>
              <div class="right">
                <div class="effects">
                  @if (vm.display?.title; as title) {
                    <div class="title">{{ title }}</div>
                  }
                  @if (vm.display?.skills?.length) {
                    <ul class="skills">
                      @for (skill of vm.display!.skills; track skill.name) {
                        <li [class.not-in-game]="skill.inGame === false"><strong>{{ skill.name }}</strong><app-skill-traits [traits]="skill.traits" /> {{ skill.text }}
                          @if (skill.inGame === false) { <em class="not-in-game-hint">{{ 'wiki.notInGame' | t }}</em> }</li>
                      }
                    </ul>
                  } @else {
                    <p class="empty">{{ 'general.noSkills' | t }}</p>
                  }
                </div>
              </div>
            </mat-card>
          }
        </div>
      }
    </div>

    <mat-card class="bar" appearance="raised">
      <div class="slots">
        <div class="slot main">
          <span class="slot-label">{{ 'select.main' | t }}</span>
          <span class="slot-name">{{ slotName(0) }}</span>
        </div>
        <button mat-icon-button type="button" class="swap" [attr.aria-label]="'select.swap' | t"
                [disabled]="selected().length !== 2" (click)="swap()">
          <mat-icon>swap_horiz</mat-icon>
        </button>
        <div class="slot deputy">
          <span class="slot-label">{{ 'select.deputy' | t }}</span>
          <span class="slot-name">{{ slotName(1) }}</span>
        </div>
      </div>
      <span class="summary">
        @if (summary(); as s) {
          {{ 'select.kingdom' | t }} <span class="force-name" [attr.data-force]="s.kingdom">{{ kingdomName(s.kingdom) }}</span> {{ 'select.combinedHp' | t: { hp: s.hp } }}
        }
      </span>
      <app-decision-countdown class="timer" />
      <button mat-flat-button type="button" class="confirm" [disabled]="!matchingAction()" (click)="confirm()">
        <mat-icon>check</mat-icon> {{ 'ui.confirm' | t }}
      </button>
    </mat-card>
  `,
  styles: `
    /* A card is split in two: the art and its caption on the left, the General's skills on the right (scrolling down
       when they overflow). On a large screen the whole view fits the window; on smaller ones the cards wrap into
       columns and the page scrolls. */
    :host {
      display: flex; flex-direction: column; padding-bottom: 8px; box-sizing: border-box;
      height: calc(100dvh - var(--mat-toolbar-standard-height, 64px) - 16px);
    }
    .intro { flex: none; }
    .intro h2 { margin: 8px 0 0; font: var(--mat-sys-headline-small); }
    .hint { color: var(--mat-sys-on-surface-variant); margin: 4px 0 8px; }
    /* Candidates are always 5 (3 + 2) or 7 (4 + 3), centred; the cards fill the height left between the header and
       the bottom bar. */
    .candidates {
      --caption-height: 76px;
      flex: 1; min-height: 0;
      display: flex; flex-direction: column; justify-content: center; gap: 16px;
      margin: 8px 0; padding: 8px 4px;
    }
    .row { flex: 1 1 0; min-height: 0; display: flex; align-items: center; justify-content: center; gap: 16px; container-type: size; }
    .candidate {
      /* The art on the left is never bigger than 130 x 189, and only shrinks when the row is too short (6px is
         the Force border). The skills take the rest of the card's width. */
      --art-width: min(130px, calc((100cqh - var(--caption-height) - 6px) * 200 / 290));
      flex: 1 1 0; min-width: 0; max-width: 380px; height: min(100cqh, 260px);
      box-sizing: border-box;
      display: flex; flex-direction: row;
      cursor: pointer;
      overflow: hidden;
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
    .left { flex: none; width: var(--art-width); max-width: 55%; display: flex; flex-direction: column; }
    .art { position: relative; aspect-ratio: 200 / 290; background: #1d1b20; }
    .art app-card-art { display: block; width: 100%; height: 100%; }
    /* .large is needed to outrank CardArt's own fixed 160 x 220 size. */
    .art ::ng-deep .card-art.large { display: block; width: 100%; height: 100%; object-fit: cover; }
    .right { flex: 1; min-width: 0; display: flex; border-left: 1px solid var(--mat-sys-outline-variant); }
    .effects { flex: 1; min-width: 0; overflow-y: auto; overscroll-behavior: contain; padding: 8px 10px; font: var(--mat-sys-body-medium); text-align: left; overflow-wrap: anywhere; }
    .title { font-style: italic; color: var(--mat-sys-on-surface-variant); margin-bottom: 6px; }
    .skills { padding-left: 1.1em; margin: 0; }
    .skills li { margin-bottom: 6px; }
    .skills li.not-in-game { opacity: 0.6; }
    .empty { margin: 0; color: var(--mat-sys-on-surface-variant); }
    .role-chip {
      position: absolute; top: 8px; right: 8px;
      padding: 2px 10px; border-radius: 12px;
      background: var(--mat-sys-primary); color: var(--mat-sys-on-primary);
      font: var(--mat-sys-label-large);
    }
    /* Main and Deputy differ by style, not colour: no kingdom's hue. */
    .role-chip.deputy { background: var(--mat-sys-surface); color: var(--mat-sys-primary); box-shadow: inset 0 0 0 2px var(--mat-sys-primary); }
    .caption { flex: none; box-sizing: border-box; height: var(--caption-height); padding: 6px 4px; text-align: center; overflow: hidden; }
    .name { font: var(--mat-sys-title-medium); }
    .meta { display: flex; align-items: center; justify-content: center; gap: 4px; margin-top: 4px; }
    .force-name { color: var(--force-text); font-weight: 600; }
    .kingdom-tag { padding: 0 8px; border-radius: 8px; color: #fff; background: var(--kingdom); font: var(--mat-sys-label-medium); }
    .hp-label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
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
    /* Medium layout (layout.service.ts): too short to fit every card, so the cards keep their size and the page
       scrolls; the bar with Confirm stays at the bottom of the screen. */
    :host-context([data-layout='medium']) { height: auto; min-height: calc(100dvh - var(--mat-toolbar-standard-height, 44px) - 16px); }
    :host-context([data-layout='medium']) .candidates {
      flex: none; display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 380px)); justify-content: center;
    }
    :host-context([data-layout='medium']) .row { display: contents; }
    :host-context([data-layout='medium']) .candidate {
      --art-width: 130px; max-width: none; height: 270px;
    }
    :host-context([data-layout='medium']) .bar { position: sticky; bottom: 0; z-index: 2; background: var(--mat-sys-surface-container); border-radius: 12px; }
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

  private readonly i18n = inject(I18n);

  // UI-only state: the player's picks in order, [main, deputy].
  protected readonly selected = signal<string[]>([]);

  protected readonly candidateViewModels = computed<CandidateViewModel[]>(() => {
    const selected = this.selected();
    const actions = this.actions();
    // Nothing picked yet: a disabled card has no same-kingdom partner in the
    // whole pool. Once a first pick exists: it doesn't pair with that pick.
    // Either way, legality itself still comes only from `actions` above.
    const disabledReason = this.i18n.t(selected.length === 0 ? 'select.noPartner' : 'select.mustShare');
    return this.candidates().map((id) => {
      const definition = this.registry().generals.get(id);
      const display = generalDisplayData(id, this.i18n.locale());
      const index = selected.indexOf(id);
      return {
        id,
        name: display?.name ?? generalDisplayName(id, this.i18n.translator),
        display,
        kingdom: definition?.kingdom ?? 'hidden',
        maxHp: definition?.maxHp ?? 0,
        role: index === 0 ? 'Main' : index === 1 ? 'Deputy' : null,
        enabled: this.isSelectable(id, selected, actions),
        disabledReason,
      };
    });
  });

  // Always 5 or 7 candidates: two rows, with the extra card on top (3 + 2, or 4 + 3). Cards are wide now, so five
  // do not fit in one row.
  protected readonly rows = computed<CandidateViewModel[][]>(() => {
    const all = this.candidateViewModels();
    if (all.length <= 1) return [all];
    const top = Math.ceil(all.length / 2);
    return [all.slice(0, top), all.slice(top)];
  });

  // What the chip says; the role values themselves ('Main', 'Deputy') stay the logic's.
  protected roleName(role: 'Main' | 'Deputy'): string {
    return this.i18n.t(role === 'Main' ? 'select.main' : 'select.deputy');
  }

  protected kingdomName(kingdom: Parameters<typeof kingdomDisplayName>[0]): string {
    return kingdomDisplayName(kingdom, this.i18n.translator);
  }

  protected slotName(position: 0 | 1): string {
    const id = this.selected()[position];
    if (!id) return this.i18n.t('select.pick');
    return generalDisplayData(id, this.i18n.locale())?.name ?? generalDisplayName(id, this.i18n.translator);
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
