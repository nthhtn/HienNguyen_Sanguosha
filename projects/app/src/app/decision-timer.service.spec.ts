import { DestroyRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Action, DECISION_SECONDS, GameState, JUDGMENT_LEAD_IN_MS, cardsOverHandLimit } from 'engine';
import { DecisionTimer } from './decision-timer.service';
import { GameService } from './game.service';
import { cardDefinitionId } from './labels';
import { askToChange, settleJudgment } from './settled-judgment.testing';

// A stand-in for the board's DestroyRef, to attach and later detach.
function boardLifetime() {
  const callbacks: (() => void)[] = [];
  const ref = { onDestroy: (fn: () => void) => (callbacks.push(fn), () => undefined) } as unknown as DestroyRef;
  return { ref, destroy: () => callbacks.forEach((fn) => fn()) };
}


// Whether the state waits on the target's own answer to a damage card (a Slash's
// Dodge window or a Duel's), not on a Wuxie question or an ability's ask.
function waitsOnDamageAnswer(state: GameState): boolean {
  const reason = state.pendingResponse?.reason;
  return !!state.pendingResponse && !state.pendingChoice && (!reason || reason.kind === 'card-effect');
}

describe('DecisionTimer', () => {
  let game: GameService;
  let timer: DecisionTimer;
  // Advance the clock and let signals/effects settle.
  const advance = (seconds: number) => {
    jest.advanceTimersByTime(seconds * 1000);
    TestBed.tick();
  };
  // Pass-and-play on a seed, seat-0 revealed, in its first Play phase: seat-0
  // rests in its Start window first, and Confirm closes it.
  const toPlayPhaseOf = (seed: number) => {
    game.startGame(2, seed);
    game.reveal(game.activeSeatId()!);
    while (game.state()!.phase === 'GeneralSelection') {
      game.submit(game.legalActions()[0]);
      game.reveal(game.activeSeatId()!);
    }
    game.submit(game.legalActions().find((a) => a.kind === 'ConfirmRevealsAction')!);
    game.reveal(game.activeSeatId()!);
    TestBed.tick();
  };
  const toPlayPhase = () => toPlayPhaseOf(1);

  beforeEach(() => {
    jest.useFakeTimers();
    game = TestBed.inject(GameService);
    game.botDelayMs = 0;
    timer = TestBed.inject(DecisionTimer);
  });
  afterEach(() => jest.useRealTimers());

  it('stays off while no game board is on screen', () => {
    toPlayPhase();
    expect(timer.secondsLeft()).toBeNull();
  });

  describe('with a board on screen', () => {
    let board: ReturnType<typeof boardLifetime>;
    beforeEach(() => {
      board = boardLifetime();
      timer.attach(board.ref);
    });

    it('gives the Play phase 300 seconds', () => {
      toPlayPhase();
      expect(timer.secondsLeft()).toBe(DECISION_SECONDS.play);
      expect(timer.totalSeconds()).toBe(300);
      advance(10);
      expect(timer.secondsLeft()).toBe(290);
    });

    it('ends the Play phase when time runs out', () => {
      toPlayPhase();
      const owner = game.state()!.turn.ownerSeatId;
      advance(DECISION_SECONDS.play);
      expect(game.state()!.turn.ownerSeatId === owner && game.state()!.phase === 'Play').toBe(false);
      expect(game.lastError()).toBeNull();
    });

    it('times the Start window at 60 seconds, and confirms with nothing revealed at zero', () => {
      game.startGame(2, 1);
      game.reveal(game.activeSeatId()!);
      while (game.state()!.phase === 'GeneralSelection') {
        game.submit(game.legalActions()[0]);
        game.reveal(game.activeSeatId()!);
      }
      TestBed.tick();
      expect(game.state()!.phase === 'Start' && game.state()!.turn.startWindow).toBe(true);
      expect(timer.totalSeconds()).toBe(DECISION_SECONDS.choice);
      advance(10);
      expect(timer.secondsLeft()).toBe(DECISION_SECONDS.choice - 10);
      advance(DECISION_SECONDS.choice - 10);
      expect(game.state()!.turn.startWindow).toBeFalsy();
      expect(game.state()!.seats[0].generals!.main.revealed || game.state()!.seats[0].generals!.deputy.revealed).toBe(false);
      expect(game.lastError()).toBeNull();
    });

    it('keeps one Play-phase clock across actions, paused while a response is under way', () => {
      // A deal where seat-0 can aim a card at seat-1 in its first Play phase.
      for (let seed = 1; seed < 50; seed++) {
        toPlayPhaseOf(seed);
        const aimed = game.legalActions().find(
          (a) => a.kind === 'PlayCardAction' && a.targets.length === 1 && ['sha', 'duel'].includes(cardDefinitionId(game.state()!, a.cardInstanceId) ?? '')
        );
        if (!aimed) continue;
        const owner = game.activeSeatId()!;
        advance(100);
        expect(timer.secondsLeft()).toBe(200);
        game.submit(aimed);
        if (!waitsOnDamageAnswer(game.state()!)) continue;
        // The response belongs to seat-1: its own 60 seconds once its view shows.
        const responder = game.activeSeatId()!;
        game.reveal(responder);
        TestBed.tick();
        expect(timer.secondsLeft()).toBe(60);
        advance(20); // the Play clock must not move meanwhile
        game.submit(game.legalActions().find((a) => a.kind === 'PassAction')!);
        game.reveal(owner);
        TestBed.tick();
        // Back in the owner's Play phase: resumed, not restarted.
        expect(game.state()!.phase).toBe('Play');
        expect(timer.secondsLeft()).toBe(200);
        return;
      }
      throw new Error('no seed gave seat-0 a targeted play');
    });

    it('clocks a settled judgment behind the pass-and-play gate, and closes it by timeout once its animation and countdown have played', () => {
      game.startGame(2, 1, 'pass-and-play', [], { judgmentNotice: true });
      settleJudgment(game);
      TestBed.tick();
      expect(game.revealedSeatId()).toBeNull();
      expect(timer.secondsLeft()).toBe(DECISION_SECONDS.notice);
      const lead = (JUDGMENT_LEAD_IN_MS.head + JUDGMENT_LEAD_IN_MS.tail) / 1000;
      advance(lead + DECISION_SECONDS.notice - 1);
      expect(game.judgmentSettled()).toBe(true);
      // The timer checks every 250 ms, and the animation is not a whole number of ticks long.
      advance(1.25);
      expect(game.judgmentSettled()).toBe(false);
      expect(game.state()!.log.find((e) => e.kind === 'JudgmentAcknowledgedEvent')).toMatchObject({ seatId: 'seat-0', source: 'timeout' });
    });

    it("shows the full countdown while the animation plays, then counts down; startsInMs says how long is left of the animation", () => {
      game.startGame(2, 1, 'pass-and-play', [], { judgmentNotice: true });
      settleJudgment(game, [], 2);
      TestBed.tick();
      expect(timer.startsInMs()).toBe(JUDGMENT_LEAD_IN_MS.tail);
      advance(1);
      expect(timer.secondsLeft()).toBe(DECISION_SECONDS.notice);
      expect(timer.startsInMs()).toBe(JUDGMENT_LEAD_IN_MS.tail - 1_000);
      advance(1);
      expect(timer.startsInMs()).toBe(0);
      advance(1);
      expect(timer.secondsLeft()).toBe(DECISION_SECONDS.notice - 1);
    });

    it("gives a changer's decision 10 seconds after the card has been shown, and declines when they run out", () => {
      game.startGame(2, 1, 'pass-and-play', [], { judgmentNotice: true });
      askToChange(game, 'seat-0');
      game.reveal('seat-0');
      TestBed.tick();
      expect(timer.secondsLeft()).toBe(DECISION_SECONDS.judgmentChange);
      expect(timer.startsInMs()).toBe(JUDGMENT_LEAD_IN_MS.head);
      advance(JUDGMENT_LEAD_IN_MS.head / 1000 + DECISION_SECONDS.judgmentChange - 1);
      expect(game.state()!.pendingChoice).toBeDefined();
      advance(1.25);
      expect(game.state()!.pendingChoice).toBeUndefined();
      expect(game.state()!.log.some((e) => e.kind === 'JudgmentAcknowledgedEvent')).toBe(false);
    });

    it("waits behind the pass-and-play gate: a changer's decision is not clocked until their view shows", () => {
      game.startGame(2, 1, 'pass-and-play', [], { judgmentNotice: true });
      askToChange(game, 'seat-0');
      TestBed.tick();
      expect(game.revealedSeatId()).toBeNull();
      expect(timer.secondsLeft()).toBeNull();
    });

    it('pauses behind the pass-and-play gate', () => {
      game.startGame(2, 1);
      TestBed.tick();
      expect(game.revealedSeatId()).toBeNull();
      expect(timer.secondsLeft()).toBeNull();
    });

    it('gives general selection 300 seconds, then picks the first legal pair', () => {
      game.startGame(2, 1);
      game.reveal(game.activeSeatId()!);
      TestBed.tick();
      expect(timer.secondsLeft()).toBe(DECISION_SECONDS.selection);
      const first = game.legalActions()[0] as Extract<Action, { kind: 'ChooseGeneralsAction' }>;
      advance(DECISION_SECONDS.selection - 1);
      expect(game.state()!.seats[0].generals).toBeNull();
      advance(1);
      expect(game.state()!.seats[0].generals).toMatchObject({ main: { generalDefinitionId: first.mainId }, deputy: { generalDefinitionId: first.deputyId } });
    });

    it('picks the first option when a choice times out, never ending the Play phase (Review Focus 4)', () => {
      for (let seed = 1; seed < 200; seed++) {
        toPlayPhaseOf(seed);
        const grab = game.legalActions().find((a) => a.kind === 'PlayCardAction' && ['steal', 'break'].includes(cardDefinitionId(game.state()!, a.cardInstanceId) ?? ''));
        if (!grab) continue;
        game.submit(grab);
        if (!game.state()!.pendingChoice) continue; // a Wuxie window came first
        game.reveal(game.activeSeatId()!);
        TestBed.tick();
        expect(timer.secondsLeft()).toBe(DECISION_SECONDS.choice);
        advance(DECISION_SECONDS.choice);
        expect(game.state()!.pendingChoice).toBeUndefined();
        expect(game.state()!.phase).toBe('Play');
        expect(game.state()!.turn.ownerSeatId).toBe('seat-0');
        return;
      }
      throw new Error('no seed gave seat-0 a Steal or Break');
    });

    it('answers No Response when a response times out', () => {
      // Find a deal where seat-0 can aim a card at seat-1, then let seat-1's window time out.
      for (let seed = 1; seed < 50; seed++) {
        toPlayPhaseOf(seed);
        const aimed = game.legalActions().find(
          (a) => a.kind === 'PlayCardAction' && a.targets.length === 1 && ['sha', 'duel'].includes(cardDefinitionId(game.state()!, a.cardInstanceId) ?? '')
        );
        if (!aimed) continue;
        game.submit(aimed);
        if (!waitsOnDamageAnswer(game.state()!)) continue;
        const responder = game.activeSeatId()!;
        const hp = game.state()!.seats.find((s) => s.id === responder)!.combinedHp;
        game.reveal(responder);
        TestBed.tick();
        expect(timer.secondsLeft()).toBe(60);
        advance(DECISION_SECONDS.response);
        expect(game.state()!.seats.find((s) => s.id === responder)!.combinedHp).toBeLessThan(hp);
        return;
      }
      throw new Error('no seed gave seat-0 a targeted play');
    });

    it('discards the UI’s chosen cards when the Discard phase times out, else the first ones', () => {
      toPlayPhase();
      const seatId = game.activeSeatId()!;
      game.submit(game.legalActions().find((a) => a.kind === 'EndPhaseAction')!);
      game.reveal(seatId);
      TestBed.tick();
      const over = cardsOverHandLimit(game.state()!, seatId);
      expect(over).toBeGreaterThan(0);
      const discards = game.legalActions().filter((a) => a.kind === 'DiscardCardAction');
      const chosen = discards.slice(-over); // the last cards, unlike the default
      expect(timer.secondsLeft()).toBe(60);
      timer.setTimeoutChoice(chosen);
      advance(DECISION_SECONDS.discard);
      const discardPile = game.state()!.zones.find((z) => z.kind === 'discardPile')!.cards.map((c) => c.instanceId);
      for (const a of chosen) expect(discardPile).toContain((a as Extract<Action, { kind: 'DiscardCardAction' }>).cardInstanceId);
      expect(cardsOverHandLimit(game.state()!, seatId)).toBe(0);
    });

    it('gives each player 300 seconds overall for their lineup, kept across leaving the page', () => {
      game.startGame(2, 1);
      game.reveal(game.activeSeatId()!);
      TestBed.tick();
      advance(100);
      expect(timer.secondsLeft()).toBe(200);
      // Off to the Wiki and back: the same 200 seconds, not a fresh 300.
      board.destroy();
      TestBed.tick();
      advance(50);
      const back = boardLifetime();
      timer.attach(back.ref);
      TestBed.tick();
      expect(timer.secondsLeft()).toBe(200);
      // The next player starts with their own 300.
      game.submit(game.legalActions()[0]);
      game.reveal(game.activeSeatId()!);
      TestBed.tick();
      expect(timer.secondsLeft()).toBe(DECISION_SECONDS.selection);
    });

    it('starts every clock afresh in a new game', () => {
      game.startGame(2, 1);
      game.reveal(game.activeSeatId()!);
      TestBed.tick();
      advance(100);
      game.startGame(2, 1);
      game.reveal(game.activeSeatId()!);
      TestBed.tick();
      expect(timer.secondsLeft()).toBe(DECISION_SECONDS.selection);
    });

    it('stops when the board leaves the screen', () => {
      toPlayPhase();
      board.destroy();
      TestBed.tick();
      expect(timer.secondsLeft()).toBeNull();
      const before = game.state();
      advance(DECISION_SECONDS.play + 5);
      expect(game.state()).toBe(before);
    });
  });
});
