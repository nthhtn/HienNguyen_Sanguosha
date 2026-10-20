import { GameService } from './game.service';
import { ruleBasedPolicy } from 'bots';
import { getLegalActions } from 'engine';
import { settleJudgment } from './settled-judgment.testing';

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
    expect(service.lastError()?.detail).toContain('not legal during general selection');
    expect(service.state()).toBe(stateBefore);
  });

  it('completes general selection for every seat, rests in turn 1\'s Start window, then settles in its Play phase', () => {
    // Seed 4 deals a mixed-kingdom table, so the game is still running after selection.
    service.startGame(3, 4);
    finishSelection(service);
    expect(service.state()!.phase).toBe('Start');
    expect(service.state()!.turn.startWindow).toBe(true);
    expect(service.activeSeatId()).toBe('seat-0');
    service.submit(service.legalActions().find((a) => a.kind === 'EndPhaseAction')!);
    const state = service.state()!;
    expect(state.phase).toBe('Play');
    expect(state.seats.every((s) => s.generals !== null)).toBe(true);
    expect(service.activeSeatId()).toBe('seat-0');
  });

  it('exposes the mode’s seat cap', () => {
    expect(service.maxSeats).toBe(10);
  });

  it('startGame reports an over-cap table through lastError instead of throwing', () => {
    expect(() => service.startGame(service.maxSeats + 1, 1)).not.toThrow();
    expect(service.state()).toBeNull();
    expect(service.lastError()?.detail).toContain(`between 2 and ${service.maxSeats} seats`);
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

describe('GameService in vs-bots mode', () => {
  let service: GameService;

  beforeEach(() => {
    jest.useFakeTimers();
    service = new GameService();
    service.botDelayMs = 0;
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  // Run pending bot moves until a human is to act (or the game ends).
  function flushBots(): void {
    for (let guard = 0; service.botThinkingSeatId() && guard < 50000; guard++) jest.runOnlyPendingTimers();
  }

  it('marks seat-0 human and every other seat a bot, and shows seat-0’s view without a gate', () => {
    service.startGame(3, 1, 'vs-bots');
    expect(service.mode()).toBe('vs-bots');
    expect(service.state()!.players.map((p) => p.kind)).toEqual(['human', 'bot', 'bot']);
    expect(service.humanSeatId()).toBe('seat-0');
    expect(service.botSeatIds()).toEqual(['seat-1', 'seat-2']);
    expect(service.revealedSeatId()).toBe('seat-0');
    expect(service.visibleState()).not.toBeNull();
  });

  it('lets the human choose first, then the bots choose and play until the human must act', () => {
    service.startGame(3, 1, 'vs-bots');
    expect(service.activeSeatId()).toBe('seat-0');
    expect(service.botThinkingSeatId()).toBeNull();
    service.submit(service.legalActions()[0]);
    expect(service.botThinkingSeatId()).toBe('seat-1');
    expect(service.legalActions()).toEqual([]); // Review Focus 4
    flushBots();
    const state = service.state()!;
    expect(state.phase).not.toBe('GeneralSelection');
    expect(state.seats.every((s) => s.generals !== null)).toBe(true);
    expect(state.result !== null || service.activeSeatId() === 'seat-0').toBe(true);
  });

  it('waits botDelayMs before each bot move', () => {
    service.botDelayMs = 700;
    service.startGame(3, 1, 'vs-bots');
    service.submit(service.legalActions()[0]);
    jest.advanceTimersByTime(699);
    expect(service.state()!.seats[1].generals).toBeNull();
    jest.advanceTimersByTime(1);
    expect(service.state()!.seats[1].generals).not.toBeNull();
  });

  it('hands a bot’s Slash to the human to answer', () => {
    service.startGame(2, 1, 'vs-bots');
    let answered = false;
    for (let step = 0; step < 5000 && !service.state()!.result && !answered; step++) {
      if (service.botThinkingSeatId()) { jest.runOnlyPendingTimers(); continue; }
      const pending = service.state()!.pendingResponse;
      if (pending?.respondingSeatId === 'seat-0') {
        expect(service.legalActions().some((a) => a.kind === 'PassAction')).toBe(true);
        answered = true;
        break;
      }
      const legal = service.legalActions();
      service.submit(legal.find((a) => a.kind === 'EndPhaseAction') ?? legal[0]);
    }
    expect(answered).toBe(true);
  });

  it('plays on to a result even if the human only ends phases and passes, then stops (Review Focus 1)', () => {
    service.startGame(3, 2, 'vs-bots');
    for (let step = 0; step < 200000 && !service.state()!.result; step++) {
      if (service.botThinkingSeatId()) { jest.runOnlyPendingTimers(); continue; }
      const legal = service.legalActions();
      service.submit(legal.find((a) => a.kind === 'EndPhaseAction' || a.kind === 'PassAction') ?? legal[0]);
    }
    expect(service.state()!.result).not.toBeNull();
    expect(service.botThinkingSeatId()).toBeNull();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('ignores a move submitted for a bot seat while that bot is due to act', () => {
    service.startGame(3, 1, 'vs-bots');
    service.submit(service.legalActions()[0]);
    const before = service.state();
    const botMove = getLegalActions(before!, 'seat-1', service.registry)[0];
    service.submit(botMove);
    expect(service.state()).toBe(before);
    expect(service.botThinkingSeatId()).toBe('seat-1');
    expect(jest.getTimerCount()).toBe(1);
  });

  it('cancels a pending bot move when a new game starts (Review Focus 2)', () => {
    service.startGame(3, 1, 'vs-bots');
    service.submit(service.legalActions()[0]);
    expect(jest.getTimerCount()).toBe(1);
    service.startGame(2, 5, 'pass-and-play');
    expect(jest.getTimerCount()).toBe(0);
    expect(service.botThinkingSeatId()).toBeNull();
  });

  it('stops the bots and reports the error when a bot move throws (Review Focus 3)', () => {
    service.startGame(3, 1, 'vs-bots');
    jest.spyOn(ruleBasedPolicy, 'decide').mockImplementation(() => {
      throw new Error('bot exploded');
    });
    service.submit(service.legalActions()[0]);
    jest.runOnlyPendingTimers();
    expect(service.lastError()?.detail).toContain('bot exploded');
    expect(service.botThinkingSeatId()).toBeNull();
    expect(jest.getTimerCount()).toBe(0);
  });
});

describe('GameService in pass-and-play mode', () => {
  it('is the default: every player is human and no bot timer runs', () => {
    jest.useFakeTimers();
    const service = new GameService();
    service.startGame(2, 1);
    expect(service.mode()).toBe('pass-and-play');
    expect(service.state()!.players.every((p) => p.kind === 'human')).toBe(true);
    expect(service.humanSeatId()).toBeNull();
    expect(service.revealedSeatId()).toBeNull();
    service.submit(service.legalActions()[0]);
    expect(jest.getTimerCount()).toBe(0);
    jest.useRealTimers();
  });
});

describe('GameService: a settled judgment', () => {
  let service: GameService;
  const acknowledged = () => service.state()!.log.find((e) => e.kind === 'JudgmentAcknowledgedEvent');

  beforeEach(() => {
    jest.useFakeTimers();
    service = new GameService();
    service.botDelayMs = 700;
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('closeJudgment closes it as the acting seat, with by, in vs-bots', () => {
    service.startGame(3, 1, 'vs-bots', [], { judgmentNotice: true });
    settleJudgment(service);
    expect(service.judgmentSettled()).toBe(true);
    expect(service.activeSeatId()).toBe('seat-0');
    service.closeJudgment('seat-0');
    expect(service.judgmentSettled()).toBe(false);
    expect(service.state()).not.toHaveProperty('judgmentView');
    expect(acknowledged()).toEqual({ kind: 'JudgmentAcknowledgedEvent', seatId: 'seat-0', by: 'seat-0', source: 'close' });
  });

  it('in pass-and-play, whoever holds the device closes it: the acting seat acts, by names the holder', () => {
    service.startGame(3, 1, 'pass-and-play', [], { judgmentNotice: true });
    settleJudgment(service);
    service.closeJudgment('seat-2');
    expect(acknowledged()).toEqual({ kind: 'JudgmentAcknowledgedEvent', seatId: 'seat-0', by: 'seat-2', source: 'close' });
    expect(service.revealedSeatId()).toBeNull();
  });

  it('does nothing when nothing is settled', () => {
    service.startGame(3, 1, 'vs-bots', [], { judgmentNotice: true });
    const before = service.state();
    service.closeJudgment('seat-0');
    expect(service.state()).toBe(before);
    expect(service.judgmentSettled()).toBe(false);
  });

  it('with no human left, a bot closes it after the bot delay, and the UI cannot', () => {
    service.startGame(3, 1, 'vs-bots', [], { judgmentNotice: true });
    settleJudgment(service, ['seat-0']);
    expect(service.activeSeatId()).toBe('seat-1');
    expect(service.botThinkingSeatId()).toBe('seat-1');
    service.closeJudgment('seat-1');
    expect(service.judgmentSettled()).toBe(true);
    jest.advanceTimersByTime(699);
    expect(service.judgmentSettled()).toBe(true);
    jest.advanceTimersByTime(1);
    expect(service.judgmentSettled()).toBe(false);
    expect(acknowledged()).toEqual({ kind: 'JudgmentAcknowledgedEvent', seatId: 'seat-1', source: 'close' });
  });
});

