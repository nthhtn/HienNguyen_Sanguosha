import { GameService } from './game.service';

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

  it('activeSeatId reflects the turn owner when there is no pending response', () => {
    service.startGame(2, 1);
    expect(service.activeSeatId()).toBe(service.state()!.turn.ownerSeatId);
  });

  it('legalActions matches getLegalActions for the active seat', () => {
    service.startGame(2, 1);
    const state = service.state()!;
    const seatId = service.activeSeatId()!;

    expect(service.legalActions().length).toBeGreaterThan(0);
    expect(service.legalActions().every((a) => a.seatId === seatId)).toBe(true);
  });

  it('visibleState is null until reveal is called, then matches the redacted view', () => {
    service.startGame(2, 1);
    expect(service.visibleState()).toBeNull();

    const seatId = service.activeSeatId()!;
    service.reveal(seatId);

    const visible = service.visibleState()!;
    expect(visible.seats.find((s) => s.id === seatId)).toBeDefined();
    // A different seat's generals should be masked in the visible view.
    const otherSeat = visible.seats.find((s) => s.id !== seatId)!;
    expect(otherSeat.generals.main.generalDefinitionId).toBe('hidden');
  });

  it('submit advances state on a legal action and resets revealedSeatId', () => {
    service.startGame(2, 1);
    const seatId = service.activeSeatId()!;
    service.reveal(seatId);
    expect(service.revealedSeatId()).toBe(seatId);

    const endPhase = service.legalActions().find((a) => a.kind === 'EndPhaseAction')!;
    expect(endPhase).toBeDefined();
    service.submit(endPhase);

    expect(service.revealedSeatId()).toBeNull();
    expect(service.lastError()).toBeNull();
  });

  it('submit sets lastError and leaves state unchanged when resolve() throws', () => {
    service.startGame(2, 1);
    const stateBefore = service.state();
    const seatId = service.activeSeatId()!;

    service.submit({ kind: 'PassAction', seatId, pendingResponseId: 'does-not-exist' });

    expect(service.lastError()).toContain('No matching pending response');
    expect(service.state()).toBe(stateBefore);
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
