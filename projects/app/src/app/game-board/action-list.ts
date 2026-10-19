import { Component, computed, inject, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { Action, ContentRegistry, GameState, findSkill } from 'engine';
import { MatMenuModule } from '@angular/material/menu';
import { actionLabel, conversionLabel, registryCardName, targetLabel } from '../labels';
import { TargetLabel } from './target-label';
import { TargetsDialog, TargetsDialogData } from './targets-dialog';
import { I18n } from '../i18n/i18n.service';
import { TPipe } from '../i18n/t.pipe';
import type { Translator } from '../i18n/translator';

type UseConversion = Extract<Action, { kind: 'UseConversionAction' }>;

interface LabeledAction {
  action: Action;
  label: string;
}

// Card plays are offered on the cards themselves (HandView), discards in the
// Discard dialog, responses (Pass included) in the Response dialog, and picks
// in the Choice dialog, active skills on the seat's avatar, arrangements in the
// Arrange dialog; this list carries
// every other legal action (End Phase, …).
function isCardAction(action: Action): boolean {
  return (
    action.kind === 'PlayCardAction' ||
    action.kind === 'RespondAction' ||
    action.kind === 'PassAction' ||
    action.kind === 'DiscardCardAction' ||
    action.kind === 'ChooseOptionAction' ||
    action.kind === 'SelectAction' ||
    action.kind === 'CancelSelectionAction' ||
    action.kind === 'UseConversionAction' ||
    action.kind === 'UseSkillAction' ||
    action.kind === 'RevealGeneralAction' ||
    action.kind === 'ArrangeCardsAction'
  );
}

interface ConversionGroup {
  label: string;
  uses: { action: UseConversion; label: string }[];
  // Used at once: no target to choose (Random Strike's Hail of Arrows).
  direct: Action | null;
  // Several equal targets: chosen in the Choose Targets window first.
  template: UseConversion | null;
  // The card it is used as, for the window: "Sha".
  as: string;
}

@Component({
  selector: 'app-action-list',
  imports: [MatButtonModule, MatMenuModule, TargetLabel, TPipe],
  template: `
    <div class="action-list">
      @for (item of labeledActions(); track item.action) {
        <button mat-stroked-button type="button" (click)="actionChosen.emit(item.action)">{{ item.label }}</button>
      }
      @for (group of conversionGroups(); track group.label) {
        @if (group.template) {
          <button mat-stroked-button type="button" class="conversion" (click)="pickTargets(group)">{{ group.label }}</button>
        } @else if (group.direct) {
          <button mat-stroked-button type="button" class="conversion" (click)="actionChosen.emit(group.direct)">{{ group.label }}</button>
        } @else {
          <button mat-stroked-button type="button" class="conversion" [matMenuTriggerFor]="targets">{{ group.label }}</button>
          <mat-menu #targets="matMenu">
            @for (use of group.uses; track use.label) {
              <button mat-menu-item type="button" (click)="actionChosen.emit(use.action)"><app-target-label [label]="use.label" [prefix]="'actions.targeting' | t" [targets]="use.action.targets" [state]="state()" /></button>
            }
          </mat-menu>
        }
      }
    </div>
  `,
  styles: `
    .action-list { display: flex; gap: 8px; flex-wrap: wrap; margin: 8px 0; }
  `,
})
export class ActionList {
  readonly actions = input.required<Action[]>();
  readonly state = input.required<GameState>();
  readonly registry = input.required<ContentRegistry>();
  readonly actionChosen = output<Action>();

  private readonly dialog = inject(MatDialog);
  private readonly i18n = inject(I18n);

  readonly labeledActions = computed<LabeledAction[]>(() =>
    this.actions()
      .filter((action) => !isCardAction(action))
      .map((action) => ({ action, label: actionLabel(action, this.state(), this.registry(), this.i18n.translator) }))
  );

  // A conversion's plays, one button each ("Use 2 Cards as Sha"), with a menu of targets.
  readonly conversionGroups = computed<ConversionGroup[]>(() => {
    const groups = new Map<string, ConversionGroup>();
    for (const action of this.actions()) {
      if (action.kind !== 'UseConversionAction' || action.pendingResponseId) continue;
      const label = conversionLabel({ ...action, targets: [] }, this.state(), this.registry(), this.i18n.translator);
      const group = groups.get(label) ?? { label, uses: [], direct: null, template: null, as: conversionAsName(action, this.state(), this.registry(), this.i18n.translator) };
      if (action.pickTargets) group.template = action;
      else if (action.targets.length === 0) group.direct = action;
      else group.uses.push({ action, label: this.i18n.t('actions.targetingList', { targets: action.targets.map((t) => targetLabel(t, this.state().players, this.i18n.translator)).join(', ') }) });
      groups.set(label, group);
    }
    return [...groups.values()];
  });

  // The Choose Targets window, then the conversion at the seats picked (none: nothing is used).
  protected pickTargets(group: ConversionGroup): void {
    const template = group.template;
    if (!template?.pickTargets) return;
    this.dialog
      .open<TargetsDialog, TargetsDialogData, string[]>(TargetsDialog, { data: { title: group.as, pick: template.pickTargets, state: this.state() }, width: 'min(92vw, 420px)' })
      .beforeClosed()
      .subscribe((ids) => {
        if (!ids?.length) return;
        const { pickTargets: _pick, ...use } = template;
        this.actionChosen.emit({ ...use, targets: ids.map((seatId) => ({ kind: 'seat' as const, seatId })) });
      });
  }
}

// The name of the card a conversion makes: "Sha".
function conversionAsName(action: UseConversion, state: GameState, registry: ContentRegistry, tr: Translator): string {
  const owner = action.via.owner;
  const conversions =
    owner.kind === 'equipment'
      ? registry.cards.get(state.zones.flatMap((z) => z.cards).find((c) => c.instanceId === owner.cardInstanceId)?.definitionId ?? '')?.abilities?.conversions
      : (registry.generals.get(state.seats.find((s) => s.id === owner.seatId)?.generals?.[owner.slot].generalDefinitionId ?? '')?.skills.find((s) => s.id === owner.skillId) ?? findSkill(registry, owner.skillId))?.conversions;
  const as = conversions?.find((c) => c.id === action.via.conversionId)?.as;
  return (as && registry.cards.has(as) ? registryCardName(registry, as, tr) : undefined) ?? tr('actions.theCard');
}
