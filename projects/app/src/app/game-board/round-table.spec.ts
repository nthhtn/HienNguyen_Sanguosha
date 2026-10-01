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
    { kind: 'SeatEliminatedEvent', seatId: 'seat-2' },
    { kind: 'TurnAdvancedEvent', seatId: 'seat-1', turnNumber: 3 },
    { kind: 'PhaseChangedEvent', seatId: 'seat-1', phase: 'Draw' },
    { kind: 'PhaseChangedEvent', seatId: 'seat-1', phase: 'Play' },
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

  it('shows turn, phase, turn owner and pile counts in the centre', () => {
    const centre = render(state()).querySelector('.centre')!.textContent!;
    expect(centre).toContain('Turn 3 · Play');
    expect(centre).toContain("seat-1's turn");
    expect(centre).toContain('Draw pile 9');
    expect(centre).toContain('Discard 2');
  });

  it('shows the last three log lines in the centre, newest last', () => {
    const lines = [...render(state()).querySelectorAll('.centre .recent li')].map((li) => li.textContent!.trim());
    expect(lines).toEqual(["Turn 3: seat-1's turn", 'seat-1 entered the Draw phase', 'seat-1 entered the Play phase']);
  });

  it('marks the responding seat and says who the table is waiting on', () => {
    const pending = {
      id: 'r1', respondingSeatId: 'seat-0', allowedActionKinds: ['PassAction'],
      context: { effect: { kind: 'HealEffect' as const, target: { kind: 'seat' as const, seatId: 'seat-0' }, amount: 1 } },
    };
    const el = render(state({ pendingResponse: pending }));
    expect(tile(el, 'seat-0').querySelector('.tile')!.classList).toContain('responding');
    expect(el.querySelector('.centre')!.textContent).toContain('Waiting on seat-0');
  });
  it('shows which seat is thinking, and marks bot seats', () => {
    const el = render(state(), 'seat-0', 'seat-1', ['seat-1', 'seat-2']);
    expect(el.querySelector('.centre .thinking')!.textContent).toContain('seat-1 is thinking');
    expect(tile(el, 'seat-1').querySelector('.bot-icon')).not.toBeNull();
    expect(tile(el, 'seat-0').querySelector('.bot-icon')).toBeNull();
  });

  it('shows no thinking line when nobody is thinking', () => {
    expect(render(state(), 'seat-0').querySelector('.centre .thinking')).toBeNull();
  });
});
