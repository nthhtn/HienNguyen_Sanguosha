import { TestBed } from '@angular/core/testing';
import type { CardZone, EngineEvent, GameState } from 'engine';
import { Layout } from '../../layout.service';
import { signal } from '@angular/core';
import { BoardChatState } from '../../online/board-chat-state.service';
import { PhoneCentreBand } from './phone-centre-band';
import { testSeat } from './phone.testing';

function state(processing: CardZone['cards'] = []): GameState {
  const seats = [testSeat('seat-0', 0), testSeat('seat-1', 1)];
  const zones: CardZone[] = [
    { id: 'drawPile', kind: 'drawPile', cards: [] },
    { id: 'processing', kind: 'processing', cards: processing },
    { id: 'seat-0:hand', kind: 'hand', ownerSeatId: 'seat-0', cards: [] },
    { id: 'seat-1:hand', kind: 'hand', ownerSeatId: 'seat-1', cards: [] },
  ];
  const log: EngineEvent[] = [
    { kind: 'TurnAdvancedEvent', seatId: 'seat-1', turnNumber: 2 },
    { kind: 'PhaseChangedEvent', seatId: 'seat-1', phase: 'Draw' },
    { kind: 'CardsDrawnEvent', seatId: 'seat-1', cardInstanceIds: ['a', 'b'] },
  ];
  return {
    seats, players: [], zones, log,
    turn: { turnNumber: 2, ownerSeatId: 'seat-1', extraTurnStack: [] },
    phase: 'Draw', pendingResponse: null, rng: { seed: 1, counter: 0 }, result: null, generalSelection: null,
  };
}

describe('PhoneCentreBand', () => {
  function render(s: GameState) {
    const fixture = TestBed.createComponent(PhoneCentreBand);
    fixture.componentRef.setInput('state', s);
    fixture.componentRef.setInput('viewerSeatId', 'seat-0');
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('shows the phase indicator and the newest history line', () => {
    const { el } = render(state());
    expect(el.querySelector('app-phase-indicator')).not.toBeNull();
    expect(el.querySelector('.latest')!.textContent!.trim().length).toBeGreaterThan(0);
  });

  it("shows a player's name in the newest line in their force's colour (spec 3h)", () => {
    const { el } = render(state());
    const who = el.querySelector('.latest .who');
    expect(who).not.toBeNull();
    expect(who!.getAttribute('data-force')).toBeTruthy();
    expect(who!.textContent).toMatch(/^Seat \d$/);
  });

  it('opens the menu drawer from Menu', () => {
    const { el } = render(state());
    (el.querySelector('button.menu') as HTMLButtonElement).click();
    expect(TestBed.inject(Layout).navOpen()).toBe(true);
  });

  it('opens the History panel from History', () => {
    const { el } = render(state());
    const history = el.querySelector('button.history') as HTMLButtonElement;
    expect(history.getAttribute('aria-label')).toBe('History');
    history.click();
    expect(TestBed.inject(Layout).panelOpen()).toBe(true);
  });

  it('shows the turned-up cards', () => {
    const { el } = render(state([{ instanceId: 'p1', definitionId: 'sha', suit: 'spade', rank: 7 }]));
    expect(el.querySelectorAll('.turned-up app-playing-card')).toHaveLength(1);
  });

  it('shows only the newest turned-up card', () => {
    const cards = [
      { instanceId: 'p1', definitionId: 'sha', suit: 'spade' as const, rank: 7 },
      { instanceId: 'p2', definitionId: 'shan', suit: 'heart' as const, rank: 2 },
    ];
    const { el } = render(state(cards));
    expect(el.querySelectorAll('.turned-up app-playing-card')).toHaveLength(1);
  });

  it('draws no turned-up area with nothing in the processing zone', () => {
    expect(render(state()).el.querySelector('.turned-up')).toBeNull();
  });

  it('leaves the Draw Pile count to the panel', () => {
    expect(render(state()).el.querySelector('.draw-pile')).toBeNull();
  });

  describe('Chat lives in the right-hand panel', () => {
    function chatState(available: boolean, unread = 0) {
      return { available: signal(available), unread: signal(unread), open: signal(false), toggle: jest.fn() };
    }

    it('has no Chat button, even in an online room', () => {
      TestBed.configureTestingModule({ providers: [{ provide: BoardChatState, useValue: chatState(true, 2) }] });
      expect(render(state()).el.querySelector('button.chat')).toBeNull();
    });

    it('shows the unread count on History, and says so in its label', () => {
      TestBed.configureTestingModule({ providers: [{ provide: BoardChatState, useValue: chatState(true, 2) }] });
      const history = render(state()).el.querySelector('button.history') as HTMLButtonElement;
      expect(history.querySelector('.unread')!.textContent!.trim()).toBe('2');
      expect(history.getAttribute('aria-label')).toBe('History, 2 unread');
    });

    it('shows no count with none unread, in a solo game, or with no board chat', () => {
      TestBed.configureTestingModule({ providers: [{ provide: BoardChatState, useValue: chatState(true, 0) }] });
      expect(render(state()).el.querySelector('button.history .unread')).toBeNull();
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ providers: [{ provide: BoardChatState, useValue: chatState(false, 3) }] });
      expect(render(state()).el.querySelector('button.history .unread')).toBeNull();
      TestBed.resetTestingModule();
      expect(render(state()).el.querySelector('button.history .unread')).toBeNull();
    });
  });
});
