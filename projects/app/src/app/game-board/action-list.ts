import { Component, computed, input, output } from '@angular/core';
import { Action, ContentRegistry, GameState } from 'engine';
import { actionLabel } from '../labels';

interface LabeledAction {
  action: Action;
  label: string;
}

@Component({
  selector: 'app-action-list',
  template: `
    <ul class="action-list">
      @for (item of labeledActions(); track item.action) {
        <li>
          <button (click)="actionChosen.emit(item.action)">{{ item.label }}</button>
        </li>
      }
    </ul>
  `,
})
export class ActionList {
  readonly actions = input.required<Action[]>();
  readonly state = input.required<GameState>();
  readonly registry = input.required<ContentRegistry>();
  readonly actionChosen = output<Action>();

  readonly labeledActions = computed<LabeledAction[]>(() =>
    this.actions().map((action) => ({ action, label: actionLabel(action, this.state(), this.registry()) }))
  );
}
