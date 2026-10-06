import { TestBed } from '@angular/core/testing';
import { Action, ContentRegistry, GameState } from 'engine';
import { ActionList } from './action-list';

function emptyState(): GameState {
  return {
    seats: [],
    players: [],
    turn: { turnNumber: 1, ownerSeatId: 'seat-0', extraTurnStack: [] },
    phase: 'Play',
    zones: [],
    pendingResponse: null,
    log: [],
    rng: { seed: 1, counter: 0 },
    result: null, generalSelection: null,
  };
}

function emptyRegistry(): ContentRegistry {
  return { cards: new Map(), generals: new Map() };
}

function stateWithShaInHand(): GameState {
  return {
    ...emptyState(),
    zones: [
      {
        id: 'hand-0',
        kind: 'hand',
        ownerSeatId: 'seat-0',
        cards: [{ instanceId: 'card-1', definitionId: 'sha', suit: 'spade', rank: 7 }],
      },
    ],
  };
}

describe('ActionList', () => {
  it('renders one button per action and emits the chosen action on click', () => {
    const fixture = TestBed.createComponent(ActionList);
    const actions: Action[] = [
      { kind: 'EndPhaseAction', seatId: 'seat-0' },
      { kind: 'DrawCardsAction', seatId: 'seat-0', count: 1 },
    ];
    fixture.componentRef.setInput('actions', actions);
    fixture.componentRef.setInput('state', emptyState());
    fixture.componentRef.setInput('registry', emptyRegistry());
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const buttons = el.querySelectorAll('button');
    expect(buttons).toHaveLength(2);
    expect(buttons[0].textContent).toContain('End Phase');
    expect(buttons[1].textContent).toContain('Draw 1 Card');

    const chosenSpy = jest.fn();
    fixture.componentInstance.actionChosen.subscribe(chosenSpy);
    buttons[1].dispatchEvent(new Event('click'));

    expect(chosenSpy).toHaveBeenCalledWith(actions[1]);

    expect(el.querySelectorAll('app-card-art')).toHaveLength(0);
  });

  it('leaves card plays and responses to the hand, rendering only the other actions', () => {
    const fixture = TestBed.createComponent(ActionList);
    const actions: Action[] = [
      { kind: 'PlayCardAction', seatId: 'seat-0', cardInstanceId: 'card-1', targets: [] },
      { kind: 'RespondAction', seatId: 'seat-0', pendingResponseId: 'r1', cardInstanceId: 'card-1' },
      { kind: 'EndPhaseAction', seatId: 'seat-0' },
    ];
    fixture.componentRef.setInput('actions', actions);
    fixture.componentRef.setInput('state', stateWithShaInHand());
    fixture.componentRef.setInput('registry', emptyRegistry());
    fixture.detectChanges();

    const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll('button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0].textContent).toContain('End Phase');
  });

  it('renders Material buttons', () => {
    const fixture = TestBed.createComponent(ActionList);
    fixture.componentRef.setInput('actions', [{ kind: 'EndPhaseAction', seatId: 'seat-0' }]);
    fixture.componentRef.setInput('state', emptyState());
    fixture.componentRef.setInput('registry', emptyRegistry());
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('button')!.classList).toContain('mat-mdc-button-base');
  });
  it('leaves choice picks to the Choice dialog', () => {
    const fixture = TestBed.createComponent(ActionList);
    fixture.componentRef.setInput('actions', [{ kind: 'ChooseOptionAction', seatId: 'seat-0', choiceId: 'c', optionId: 'hand' }] as Action[]);
    fixture.componentRef.setInput('state', emptyState());
    fixture.componentRef.setInput('registry', emptyRegistry());
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('button')).toHaveLength(0);
  });
});
