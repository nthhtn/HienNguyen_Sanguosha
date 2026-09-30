import { GameService } from './game.service';

function finishSelection(service: GameService): void {
  while (service.state()!.phase === 'GeneralSelection') {
    service.submit(service.legalActions()[0]);
  }
}

describe('GameService', () => {
  let service: GameService;

  beforeEach(() => {
    service = new GameService();
  });

  it('starts with no game in progress', () => {
    expect(service.state()).toBeNull();
    expect(service.activeSeatId()).toBeNull();
    expect(service.legalActions()).toEqual([]);
  });

  it('startGame creates a game with the requested seat count', () => {
    service.startGame(4, 42);

    const state = service.state();
    expect(state).not.toBeNull();
    expect(state!.seats).toHaveLength(4);
    expect(state!.seats.map((s) => s.id)).toEqual(['seat-0', 'seat-1', 'seat-2', 'seat-3']);
  });

  it('startGame is deterministic for a given seed', () => {
    service.startGame(3, 7);
    const first = service.state();

    service.startGame(3, 7);
    const second = service.state();

    expect(JSON.stringify(second)).toEqual(JSON.stringify(first));
  });

  it('activeSeatId is the first seat still choosing during general selection', () => {
    service.startGame(2, 1);
    expect(service.state()!.phase).toBe('GeneralSelection');
    expect(service.activeSeatId()).toBe('seat-0');
  });

  it('legalActions are the active seat’s ChooseGeneralsActions during selection', () => {
    service.startGame(2, 1);
    const actions = service.legalActions();
    expect(actions.length).toBeGreaterThan(0);
    expect(actions.every((a) => a.kind === 'ChooseGeneralsAction' && a.seatId === 'seat-0')).toBe(true);
  });

  it('visibleState is null until reveal is called, then hides other seats’ candidates', () => {
    service.startGame(2, 1);
    expect(service.visibleState()).toBeNull();
    service.reveal('seat-0');
    const visible = service.visibleState()!;
    expect(visible.generalSelection!.candidates['seat-0']).not.toContain('hidden');
    expect(visible.generalSelection!.candidates['seat-1']).toEqual(['hidden', 'hidden', 'hidden', 'hidden', 'hidden']);
  });

  it('submit advances state on a legal action and resets revealedSeatId', () => {
    service.startGame(2, 1);
    service.reveal('seat-0');
    service.submit(service.legalActions()[0]);
    expect(service.revealedSeatId()).toBeNull();
    expect(service.lastError()).toBeNull();
    expect(service.activeSeatId()).toBe('seat-1');
  });

  it('submit sets lastError and leaves state unchanged when resolve() throws', () => {
    service.startGame(2, 1);
    const stateBefore = service.state();
    service.submit({ kind: 'PassAction', seatId: 'seat-0', pendingResponseId: 'does-not-exist' });
    expect(service.lastError()).toContain('not legal during general selection');
    expect(service.state()).toBe(stateBefore);
  });

  it('completes general selection for every seat, then starts turn 1 at Judgment', () => {
    service.startGame(3, 5);
    finishSelection(service);
    const state = service.state()!;
    expect(state.phase).toBe('Judgment');
    expect(state.seats.every((s) => s.generals !== null)).toBe(true);
    expect(service.activeSeatId()).toBe('seat-0');
  });

  it('exposes the mode’s seat cap', () => {
    expect(service.maxSeats).toBe(5);
  });

  it('startGame reports an over-cap table through lastError instead of throwing', () => {
    expect(() => service.startGame(8, 1)).not.toThrow();
    expect(service.state()).toBeNull();
    expect(service.lastError()).toContain('between 2 and 5 seats');
  });

  it('clearError resets lastError without touching state', () => {
    service.startGame(2, 1);
    const seatId = service.activeSeatId()!;
    service.submit({ kind: 'PassAction', seatId, pendingResponseId: 'nope' });
    expect(service.lastError()).not.toBeNull();

    const stateBefore = service.state();
    service.clearError();

    expect(service.lastError()).toBeNull();
    expect(service.state()).toBe(stateBefore);
  });
});
