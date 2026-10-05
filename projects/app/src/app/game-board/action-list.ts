import { Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { Action, ContentRegistry, GameState } from 'engine';
import { actionLabel } from '../labels';

interface LabeledAction {
  action: Action;
  label: string;
}

// Card plays are offered on the cards themselves (HandView), discards in the
// Discard dialog, and responses (Pass included) in the Response dialog; this
// list carries every other legal action (End Phase, …).
function isCardAction(action: Action): boolean {
  return (
    action.kind === 'PlayCardAction' ||
    action.kind === 'RespondAction' ||
    action.kind === 'PassAction' ||
    action.kind === 'DiscardCardAction'
  );
}

@Component({
  selector: 'app-action-list',
  imports: [MatButtonModule],
  template: `
    <div class="action-list">
      @for (item of labeledActions(); track item.action) {
        <button mat-stroked-button type="button" (click)="actionChosen.emit(item.action)">{{ item.label }}</button>
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
}
