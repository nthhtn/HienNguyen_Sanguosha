import { Component, computed, input, output } from '@angular/core';
import { Action, ContentRegistry, GameState } from 'engine';
import { actionLabel, cardDefinitionId } from '../labels';
import { CardArt } from './card-art';

interface LabeledAction {
  action: Action;
  label: string;
  cardDefinitionId: string | undefined;
}

function actionCardInstanceId(action: Action): string | undefined {
  switch (action.kind) {
    case 'PlayCardAction':
    case 'RespondAction':
      return action.cardInstanceId;
    default:
      return undefined;
  }
}

@Component({
  selector: 'app-action-list',
  imports: [CardArt],
  template: `
    <ul class="action-list">
      @for (item of labeledActions(); track item.action) {
        <li>
          @if (item.cardDefinitionId; as id) {
            <app-card-art [id]="id" [label]="item.label" />
          }
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
    this.actions().map((action) => {
      const instanceId = actionCardInstanceId(action);
      return {
        action,
        label: actionLabel(action, this.state(), this.registry()),
        cardDefinitionId: instanceId ? cardDefinitionId(this.state(), instanceId) : undefined,
      };
    })
  );
}
