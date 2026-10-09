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
  it('groups a conversion’s plays under one button, with a menu of targets', () => {
    const state: GameState = {
      ...emptyState(),
      zones: [{ id: 'equip-0', kind: 'equip', ownerSeatId: 'seat-0', cards: [{ instanceId: 'sp', definitionId: 'serpent-spear', suit: 'spade', rank: 12 }] }],
    };
    const registry: ContentRegistry = {
      cards: new Map([
        ['sha', { id: 'sha', name: 'Sha', category: 'basic', play: () => [] }],
        ['serpent-spear', {
          id: 'serpent-spear', name: 'Serpent Spear', category: 'equipment', equipSlot: 'weapon', play: () => [],
          abilities: { conversions: [{ id: 'serpent-spear', as: 'sha', cards: 2, when: 'both' }] },
        }],
      ]),
      generals: new Map(),
    };
    const via = { owner: { kind: 'equipment' as const, seatId: 'seat-0', cardInstanceId: 'sp' }, conversionId: 'serpent-spear' };
    const at = (seatId: string): Action => ({ kind: 'UseConversionAction', seatId: 'seat-0', via, targets: [{ kind: 'seat', seatId }] });
    const fixture = TestBed.createComponent(ActionList);
    fixture.componentRef.setInput('actions', [{ kind: 'EndPhaseAction', seatId: 'seat-0' }, at('seat-1'), at('seat-2')]);
    fixture.componentRef.setInput('state', state);
    fixture.componentRef.setInput('registry', registry);
    fixture.detectChanges();
    const chosen = jest.fn();
    fixture.componentInstance.actionChosen.subscribe(chosen);

    const el = fixture.nativeElement as HTMLElement;
    expect([...el.querySelectorAll('button')].map((b) => b.textContent!.trim())).toEqual(['End Phase', 'Use 2 Cards as Sha']);
    (el.querySelector('button.conversion') as HTMLButtonElement).click();
    fixture.detectChanges();
    const items = [...document.querySelectorAll('.mat-mdc-menu-item')] as HTMLButtonElement[];
    expect(items.map((b) => b.textContent!.trim())).toEqual(['Targeting Seat 1', 'Targeting Seat 2']);
    items[1].click();
    expect(chosen).toHaveBeenCalledWith(at('seat-2'));
  });

  describe('a skill’s conversion', () => {
    const owner = { kind: 'general' as const, seatId: 'seat-0', slot: 'main' as const, skillId: 'random-strike' };
    const state: GameState = { ...emptyState(), seats: [{ id: 'seat-0', index: 0, kingdom: 'Qun', eliminated: false, combinedHp: 4, maxCombinedHp: 4, generals: { main: { generalDefinitionId: 'g', revealed: true }, deputy: { generalDefinitionId: 'g', revealed: true } }, hand: { zoneId: 'h' }, equipped: { zoneId: 'e' }, judgment: { zoneId: 'j' } }] };
    const registry: ContentRegistry = {
      cards: new Map([
        ['hail-of-arrows', { id: 'hail-of-arrows', name: 'Hail of Arrows', category: 'tool', play: () => [] }],
        ['sha', { id: 'sha', name: 'Sha', category: 'basic', play: () => [] }],
      ]),
      generals: new Map([['g', { id: 'g', kingdom: 'Qun', maxHp: 4, skills: [
        { id: 'random-strike', conversions: [{ id: 'random-strike', as: 'hail-of-arrows', cards: 2, sameSuit: true, when: 'play' }] },
        { id: 'pairs', conversions: [{ id: 'pairs', as: 'sha', cards: 2, when: 'play' }] },
      ] }]]),
    };
    const render = (actions: Action[]) => {
      const fixture = TestBed.createComponent(ActionList);
      fixture.componentRef.setInput('actions', actions);
      fixture.componentRef.setInput('state', state);
      fixture.componentRef.setInput('registry', registry);
      fixture.detectChanges();
      const chosen = jest.fn();
      fixture.componentInstance.actionChosen.subscribe(chosen);
      return { fixture, chosen, el: fixture.nativeElement as HTMLElement };
    };

    it('with no target: one button that uses it at once', () => {
      const hail: Action = { kind: 'UseConversionAction', seatId: 'seat-0', via: { owner, conversionId: 'random-strike' }, targets: [] };
      const { el, chosen } = render([hail]);
      const button = el.querySelector('button.conversion') as HTMLButtonElement;
      expect(button.textContent!.trim()).toBe('As Hail of Arrows · Random Strike');
      button.click();
      expect(chosen).toHaveBeenCalledWith(hail);
    });

    it('with several targets: the Choose Targets window first', async () => {
      const pairs = { ...owner, skillId: 'pairs' };
      const template: Action = { kind: 'UseConversionAction', seatId: 'seat-0', via: { owner: pairs, conversionId: 'pairs' }, targets: [], pickTargets: { eligibleIds: ['seat-1', 'seat-2'], min: 1, max: 2 } };
      const { el, chosen, fixture } = render([template]);
      (el.querySelector('button.conversion') as HTMLButtonElement).click();
      fixture.detectChanges();
      await fixture.whenStable();
      const dialog = document.querySelector('app-targets-dialog') as HTMLElement;
      expect(dialog.textContent).toContain('Choose up to 2 targets for Sha');
      const button = (text: string) => [...dialog.querySelectorAll('button')].find((b) => b.textContent!.trim() === text) as HTMLButtonElement;
      button('Seat 2').click();
      fixture.detectChanges();
      await fixture.whenStable();
      button('Confirm').click();
      expect(chosen).toHaveBeenCalledWith({ kind: 'UseConversionAction', seatId: 'seat-0', via: { owner: pairs, conversionId: 'pairs' }, targets: [{ kind: 'seat', seatId: 'seat-2' }] });
      (document.querySelector('.cdk-overlay-container') as HTMLElement | null)?.replaceChildren();
    });
  });

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
