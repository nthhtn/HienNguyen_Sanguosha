import { Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { Action, ContentRegistry, GameState } from 'engine';
import { actionLabel } from '../labels';

interface LabeledAction {
  action: Action;
  label: string;
}

// Card plays and responses are offered on the cards themselves (HandView);
// this list carries every other legal action (End phase, Pass, …).
function isCardAction(action: Action): boolean {
  return action.kind === 'PlayCardAction' || action.kind === 'RespondAction';
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
