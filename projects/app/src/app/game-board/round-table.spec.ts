import { TestBed } from '@angular/core/testing';
import { CardZone, EngineEvent, GameState, Seat } from 'engine';
import { RoundTable } from './round-table';

function seat(id: string, index: number, eliminated = false): Seat {
  return {
    id, index, kingdom: 'hidden', eliminated,
    generals: { main: { generalDefinitionId: 'hidden', revealed: false }, deputy: { generalDefinitionId: 'hidden', revealed: false } },
    combinedHp: 7, maxCombinedHp: 7,
    hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` },
  };
}

function cards(n: number) {
  return Array.from({ length: n }, (_, i) => ({ instanceId: `c${i}`, definitionId: 'hidden', suit: 'spade' as const, rank: 0 }));
}

function state(overrides: Partial<GameState> = {}): GameState {
  const seats = [seat('seat-0', 0), seat('seat-1', 1), seat('seat-2', 2, true)];
  const zones: CardZone[] = [
    { id: 'drawPile', kind: 'drawPile', cards: cards(9) },
    { id: 'discardPile', kind: 'discardPile', cards: cards(2) },
    { id: 'seat-0:hand', kind: 'hand', ownerSeatId: 'seat-0', cards: cards(4) },
    { id: 'seat-1:hand', kind: 'hand', ownerSeatId: 'seat-1', cards: cards(5) },
    { id: 'seat-2:hand', kind: 'hand', ownerSeatId: 'seat-2', cards: [] },
  ];
  const log: EngineEvent[] = [
    { kind: 'GeneralsChosenEvent', seatId: 'seat-0' },
    { kind: 'SeatEliminatedEvent', seatId: 'seat-2' },
    { kind: 'TurnAdvancedEvent', seatId: 'seat-1', turnNumber: 3 },
    { kind: 'PhaseChangedEvent', seatId: 'seat-1', phase: 'Draw' },
    { kind: 'CardsDrawnEvent', seatId: 'seat-1', cardInstanceIds: ['a', 'b'] },
    { kind: 'PhaseChangedEvent', seatId: 'seat-1', phase: 'Play' },
    { kind: 'GeneralRevealedEvent', seatId: 'seat-1', slot: 'main' },
  ];
  return {
    seats, players: [], zones, log,
    turn: { turnNumber: 3, ownerSeatId: 'seat-1', extraTurnStack: [] },
    phase: 'Play', pendingResponse: null, rng: { seed: 1, counter: 0 }, result: null, generalSelection: null,
    ...overrides,
  };
}

function render(s: GameState, viewerSeatId = 'seat-1', thinkingSeatId: string | null = null, botSeatIds: string[] = []) {
  const fixture = TestBed.createComponent(RoundTable);
  fixture.componentRef.setInput('state', s);
  fixture.componentRef.setInput('viewerSeatId', viewerSeatId);
  fixture.componentRef.setInput('thinkingSeatId', thinkingSeatId);
  fixture.componentRef.setInput('botSeatIds', botSeatIds);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

const tile = (el: HTMLElement, seatId: string) => el.querySelector(`[data-seat-id="${seatId}"]`) as HTMLElement;

describe('RoundTable', () => {
  it('shrinks the tiles of a crowded table (more than six seats)', () => {
    const seats = (n: number) => Array.from({ length: n }, (_, i) => seat(`seat-${i}`, i));
    expect(render(state({ seats: seats(7) })).querySelector('.table')!.classList).toContain('crowded');
    expect(render(state({ seats: seats(6) })).querySelector('.table')!.classList).not.toContain('crowded');
  });

  it('renders one tile per seat, the viewer at the bottom', () => {
    const el = render(state(), 'seat-1');
    expect(el.querySelectorAll('app-seat-tile')).toHaveLength(3);
    const viewer = tile(el, 'seat-1');
    expect(viewer.textContent).toContain('(you)');
    expect(viewer.style.left).toBe('50%');
    expect(parseFloat(viewer.style.top)).toBeGreaterThan(80);
  });

  it('passes hand counts, the turn owner and eliminated state to the tiles', () => {
    const el = render(state(), 'seat-0');
    expect(tile(el, 'seat-1').querySelector('.hand-count')!.textContent).toContain('5');
    expect(tile(el, 'seat-1').querySelector('.tile')!.classList).toContain('turn-owner');
    expect(tile(el, 'seat-0').querySelector('.tile')!.classList).not.toContain('turn-owner');
    expect(tile(el, 'seat-2').querySelector('.tile')!.classList).toContain('eliminated');
  });

  it('shows the turn number, turn owner and draw pile count in the centre (the discard pile sits beside the table)', () => {
    const centre = render(state()).querySelector('.centre')!.textContent!;
    expect(centre).toContain('Turn 3');
    expect(centre).not.toContain('· Play');
    expect(centre).toContain("Seat 1's turn");
    expect(centre).toContain('Draw Pile 9');
    expect(centre).not.toContain('Discard');
  });

  it('shows the last three actions in the centre, newest last, in the action history’s wording', () => {
    const lines = [...render(state()).querySelectorAll('.centre .recent li')].map((li) => li.textContent!.trim());
    expect(lines).toEqual(['Seat 2 was eliminated', 'Seat 1 drew 2 cards', 'Seat 1 revealed their Main General']);
  });

  it('marks the responding seat and says who the table is waiting on', () => {
    const pending = {
      id: 'r1', respondingSeatId: 'seat-0', allowedActionKinds: ['PassAction'],
      context: { effect: { kind: 'HealEffect' as const, target: { kind: 'seat' as const, seatId: 'seat-0' }, amount: 1 } },
    };
    const el = render(state({ pendingResponse: pending }));
    expect(tile(el, 'seat-0').querySelector('.tile')!.classList).toContain('responding');
    expect(el.querySelector('.centre')!.textContent).toContain('Waiting on Seat 0');
  });
  it('says what the waiting seat is being asked', () => {
    const pending = {
      id: 'x1', respondingSeatId: 'seat-0', allowedActionKinds: ['RespondAction', 'PassAction'], allowedCardIds: ['wuxie'],
      reason: {
        kind: 'wuxie' as const, toolUserSeatId: 'seat-1', target: { kind: 'seat' as const, seatId: 'seat-0' },
        tool: { as: 'barbarians', colour: 'black' as const, physical: [] },
      },
      context: { effect: { kind: 'SkipNextEffect' as const } },
    };
    const players = [{ id: 'p0', seatId: 'seat-0', kind: 'human' as const, name: 'Hing' }];
    const el = render(state({ pendingResponse: pending, players }));
    expect(el.querySelector('.waiting')!.textContent!.trim()).toBe('Waiting on Hing: Wuxie?');
  });

  it('shows the turned-up cards in the centre, and marks the seat choosing one', () => {
    const base = state();
    const turnedUp = [
      { instanceId: 't1', definitionId: 'peach', suit: 'heart' as const, rank: 3 },
      { instanceId: 't2', definitionId: 'sha', suit: 'spade' as const, rank: 7 },
    ];
    const el = render(state({
      zones: [...base.zones, { id: 'processing', kind: 'processing', cards: turnedUp }],
      pendingChoice: { id: 'c', seatId: 'seat-0', verb: 'take', options: [], reason: { kind: 'choice', card: { as: 'harvest', colour: 'red', physical: [] }, userSeatId: 'seat-1' } },
    }));
    expect(el.querySelectorAll('.centre .turned-up app-playing-card')).toHaveLength(2);
    expect(tile(el, 'seat-0').querySelector('.tile')!.classList).toContain('responding');
  });

  it('shows which seat is thinking, and marks bot seats', () => {
    const el = render(state(), 'seat-0', 'seat-1', ['seat-1', 'seat-2']);
    expect(el.querySelector('.centre .thinking')!.textContent).toContain('Seat 1 is thinking');
    expect(tile(el, 'seat-1').querySelector('.bot-icon')).not.toBeNull();
    expect(tile(el, 'seat-0').querySelector('.bot-icon')).toBeNull();
  });

  it('shows no thinking line when nobody is thinking', () => {
    expect(render(state(), 'seat-0').querySelector('.centre .thinking')).toBeNull();
  });
  it('shows each seat by its player’s name', () => {
    const named = state({ players: [{ id: 'p1', seatId: 'seat-1', kind: 'human', name: 'Hing' }] });
    const el = render(named, 'seat-0');
    expect(tile(el, 'seat-1').querySelector('.header strong')!.textContent).toBe('Hing');
    expect(tile(el, 'seat-0').querySelector('.header strong')!.textContent).toBe('Seat 0');
    expect(el.querySelector('.centre')!.textContent).toContain("Hing's turn");
  });

  it('passes each seat’s equipment to its tile', () => {
    const s = state();
    const equipped = {
      ...s,
      zones: [...s.zones, { id: 'seat-0:equip', kind: 'equip' as const, ownerSeatId: 'seat-0', cards: [
        { instanceId: 'e1', definitionId: 'green-dragon-blade', suit: 'spade' as const, rank: 5 },
      ] }],
    };
    const el = render(equipped, 'seat-0');
    expect(tile(el, 'seat-0').querySelector('.equip .slot[data-slot="weapon"] app-card-art')).not.toBeNull();
  });
});
