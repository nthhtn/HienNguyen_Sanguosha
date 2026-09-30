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
    expect(buttons[0].textContent).toContain('End phase');
    expect(buttons[1].textContent).toContain('Draw 1 card');

    const chosenSpy = jest.fn();
    fixture.componentInstance.actionChosen.subscribe(chosenSpy);
    buttons[1].dispatchEvent(new Event('click'));

    expect(chosenSpy).toHaveBeenCalledWith(actions[1]);
  });
});
