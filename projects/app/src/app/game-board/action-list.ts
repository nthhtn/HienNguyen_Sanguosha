import { Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { Action, ContentRegistry, GameState } from 'engine';
import { MatMenuModule } from '@angular/material/menu';
import { actionLabel, conversionLabel, targetLabel } from '../labels';

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
    action.kind === 'ArrangeCardsAction'
  );
}

interface ConversionGroup {
  label: string;
  uses: LabeledAction[];
}

@Component({
  selector: 'app-action-list',
  imports: [MatButtonModule, MatMenuModule],
  template: `
    <div class="action-list">
      @for (item of labeledActions(); track item.action) {
        <button mat-stroked-button type="button" (click)="actionChosen.emit(item.action)">{{ item.label }}</button>
      }
      @for (group of conversionGroups(); track group.label) {
        <button mat-stroked-button type="button" class="conversion" [matMenuTriggerFor]="targets">{{ group.label }}</button>
        <mat-menu #targets="matMenu">
          @for (use of group.uses; track use.label) {
            <button mat-menu-item type="button" (click)="actionChosen.emit(use.action)">{{ use.label }}</button>
          }
        </mat-menu>
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

  readonly labeledActions = computed<LabeledAction[]>(() =>
    this.actions()
      .filter((action) => !isCardAction(action))
      .map((action) => ({ action, label: actionLabel(action, this.state(), this.registry()) }))
  );

  // A conversion's plays, one button each ("Use 2 Cards as Sha"), with a menu of targets.
  readonly conversionGroups = computed<ConversionGroup[]>(() => {
    const groups = new Map<string, ConversionGroup>();
    for (const action of this.actions()) {
      if (action.kind !== 'UseConversionAction' || action.pendingResponseId) continue;
      const label = conversionLabel({ ...action, targets: [] }, this.state(), this.registry());
      const group = groups.get(label) ?? { label, uses: [] };
      group.uses.push({ action, label: `Targeting ${action.targets.map((t) => targetLabel(t, this.state().players)).join(', ')}` });
      groups.set(label, group);
    }
    return [...groups.values()];
  });
}
