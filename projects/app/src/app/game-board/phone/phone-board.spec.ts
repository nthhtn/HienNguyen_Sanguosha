import { TestBed } from '@angular/core/testing';
import type { Action, CardZone, GameState, Seat } from 'engine';
import { buildContentRegistry } from 'content';
import type { AvatarSkill } from '../avatar-skills';
import { MatDialog } from '@angular/material/dialog';
import { BattlefieldBackgrounds } from '../../battlefield-background.service';
import { PhoneBoard } from './phone-board';
import { SeatDetailsDialog } from './seat-details-dialog';
import { phoneSeats, phoneSizes } from './phone-seat-layout';
import { testSeats } from './phone.testing';

function state(seats: Seat[]): GameState {
  const zones: CardZone[] = [
    { id: 'drawPile', kind: 'drawPile', cards: [] },
    ...seats.map((s): CardZone => ({ id: s.hand.zoneId, kind: 'hand', ownerSeatId: s.id, cards: [] })),
  ];
  return {
    seats, players: [], zones, log: [],
    turn: { turnNumber: 1, ownerSeatId: 'seat-0', extraTurnStack: [] },
    phase: 'Play', pendingResponse: null, rng: { seed: 1, counter: 0 }, result: null, generalSelection: null,
  };
}

const useSkill = { kind: 'UseSkillAction', seatId: 'seat-0', skillId: 'test' } as unknown as Extract<Action, { kind: 'UseSkillAction' }>;

describe('PhoneBoard', () => {
  function render(count: number, viewer: string | null = 'seat-0', skills: AvatarSkill[] = []) {
    const fixture = TestBed.createComponent(PhoneBoard);
    fixture.componentRef.setInput('state', state(testSeats(count)));
    fixture.componentRef.setInput('viewerSeatId', viewer);
    fixture.componentRef.setInput('registry', buildContentRegistry());
    fixture.componentRef.setInput('skills', skills);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }
  const tilesIn = (el: HTMLElement, area: string) => el.querySelectorAll(`.${area} [data-seat-id] app-phone-seat-tile`).length;

  it('offers the Battlefield menu while on screen and draws the default table', () => {
    const backgrounds = TestBed.inject(BattlefieldBackgrounds);
    const { fixture, el } = render(4);
    expect(backgrounds.available()).toBe(true);
    const board = el.querySelector('.phone-board') as HTMLElement;
    expect(board.style.background).toBe('');
    backgrounds.select('2');
    fixture.detectChanges();
    expect((fixture.componentInstance as PhoneBoard & { background: () => string | null }).background()).toContain('battlefield/2.jpg');
    fixture.destroy();
    expect(backgrounds.available()).toBe(false);
  });

  it('puts 7 opponents of an 8-seat game along the top', () => {
    const { el } = render(8);
    expect(tilesIn(el, 'top')).toBe(7);
    expect(tilesIn(el, 'left')).toBe(0);
    expect(tilesIn(el, 'right')).toBe(0);
  });

  it('puts 12 seats as 2, 7 and 2', () => {
    const { el } = render(12);
    expect([tilesIn(el, 'left'), tilesIn(el, 'top'), tilesIn(el, 'right')]).toEqual([2, 7, 2]);
  });

  it('marks every tile with its seat, the viewer at the bottom as a full tile', () => {
    const { el } = render(5);
    expect(el.querySelectorAll('[data-seat-id]')).toHaveLength(5);
    const own = el.querySelector('.bottom [data-seat-id="seat-0"] app-phone-seat-tile')!;
    expect(own.querySelector('.tile')!.classList).not.toContain('slim');
  });

  it('offers usable skills as buttons in the action column', () => {
    const { fixture, el } = render(4, 'seat-0', [
      { slot: 'main', skillId: 'a', label: 'Kindness', action: useSkill },
      { slot: 'deputy', skillId: 'b', label: 'Wisdom', action: null },
    ]);
    const chosen: unknown[] = [];
    fixture.componentInstance.actionChosen.subscribe((a) => chosen.push(a));
    const buttons = [...el.querySelectorAll<HTMLButtonElement>('.actions button.skill')];
    expect(buttons.map((b) => b.textContent!.trim())).toEqual(['Kindness']);
    buttons[0].click();
    expect(chosen).toEqual([useSkill]);
  });

  it("opens Seat Details for a tapped opponent and for the viewer's own tile", () => {
    const open = jest.spyOn(TestBed.inject(MatDialog), 'open').mockReturnValue({ close: jest.fn() } as never);
    const { el } = render(4);
    (el.querySelector('.top [data-seat-id="seat-2"] button.tile') as HTMLButtonElement).click();
    (el.querySelector('.bottom [data-seat-id="seat-0"] button.tile') as HTMLButtonElement).click();
    expect(open.mock.calls.map(([component, config]) => [component, (config as { data: { seatId: string } }).data.seatId])).toEqual([
      [SeatDetailsDialog, 'seat-2'],
      [SeatDetailsDialog, 'seat-0'],
    ]);
  });

  it('closes the Seat Details it opened when the board goes away', () => {
    const close = jest.fn();
    jest.spyOn(TestBed.inject(MatDialog), 'open').mockReturnValue({ close } as never);
    const { fixture, el } = render(4);
    (el.querySelector('.top [data-seat-id="seat-2"] button.tile') as HTMLButtonElement).click();
    fixture.destroy();
    expect(close).toHaveBeenCalled();
  });

  it('shows every seat at the top, and no own seat, with no viewer', () => {
    const { el } = render(4, null);
    expect(tilesIn(el, 'top')).toBe(4);
    expect(el.querySelector('.bottom [data-seat-id]')).toBeNull();
  });

  describe('sized by the room the board gets, inside the safe areas', () => {
    let reported: { width: number; height: number } = { width: 0, height: 0 };
    beforeEach(() => {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 915 });
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: 412 });
      (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
        constructor(private readonly callback: ResizeObserverCallback) {}
        observe(target: Element) {
          this.callback([{ target, contentRect: reported } as unknown as ResizeObserverEntry], this as unknown as ResizeObserver);
        }
        disconnect() {}
      };
    });
    afterEach(() => {
      delete (globalThis as { ResizeObserver?: unknown }).ResizeObserver;
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: 768 });
    });

    it('uses the board box, not the window, when a cut-out takes 35 px', () => {
      // The board's content box: 880 x 412 minus its 8 px padding on each side.
      reported = { width: 864, height: 396 };
      const { el } = render(12);
      const expected = phoneSizes(880, 412, phoneSeats(testSeats(12), 'seat-0'));
      const board = el.querySelector('.phone-board') as HTMLElement;
      expect(board.style.getPropertyValue('--top-width')).toBe(`${expected.topTileWidth}px`);
      expect(expected.topTileWidth).not.toBe(phoneSizes(915, 412, phoneSeats(testSeats(12), 'seat-0')).topTileWidth);
    });
  });

  describe('a picked hand card', () => {
    const peach = { instanceId: 'p1', definitionId: 'peach', suit: 'heart' as const, rank: 3 };
    const sha = { instanceId: 's1', definitionId: 'sha', suit: 'spade' as const, rank: 7 };
    const eat = { kind: 'PlayCardAction', seatId: 'seat-0', cardInstanceId: 'p1', targets: [] } as unknown as Action;
    const endPhase = { kind: 'EndPhaseAction', seatId: 'seat-0' } as unknown as Action;

    function withHand(handActions: Action[]) {
      const { fixture, el } = render(4);
      fixture.componentRef.setInput('hand', [peach, sha]);
      fixture.componentRef.setInput('handActions', handActions);
      fixture.componentRef.setInput('boardActions', [endPhase]);
      fixture.detectChanges();
      const chosen: Action[] = [];
      const played: Action[] = [];
      fixture.componentInstance.actionChosen.subscribe((a) => chosen.push(a));
      fixture.componentInstance.played.subscribe((a) => played.push(a));
      const pick = (id: string) => {
        (el.querySelector(`app-hand-view [data-card-id="${id}"]`) as HTMLElement).click();
        fixture.detectChanges();
      };
      return { fixture, el, chosen, played, pick };
    }

    it('shows its Play and Info at the top of the action column', () => {
      const { el, pick } = withHand([eat]);
      expect(el.querySelector('.actions app-hand-card-actions')).toBeNull();
      pick('p1');
      const first = el.querySelector('.actions')!.firstElementChild!;
      expect(first.tagName.toLowerCase()).toBe('app-hand-card-actions');
      expect(first.querySelector('button.play')).not.toBeNull();
      expect(first.querySelector('button.info')).not.toBeNull();
    });

    it('plays it from the action column and clears the pick', () => {
      const { fixture, el, played, pick } = withHand([eat]);
      pick('p1');
      (el.querySelector('.actions app-hand-card-actions button.play') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(played).toEqual([eat]);
      expect(el.querySelector('.actions app-hand-card-actions')).toBeNull();
    });

    it('shows only Info for a card that cannot be played', () => {
      const { el, pick } = withHand([eat]);
      pick('s1');
      expect(el.querySelector('.actions app-hand-card-actions button.play')).toBeNull();
      expect(el.querySelector('.actions app-hand-card-actions button.info')).not.toBeNull();
    });

    it('clears the pick when the card leaves the hand', () => {
      const { fixture, el, pick } = withHand([eat]);
      pick('p1');
      fixture.componentRef.setInput('hand', [sha]);
      fixture.detectChanges();
      expect(el.querySelector('.actions app-hand-card-actions')).toBeNull();
    });

    it('clears the pick when another action is chosen', () => {
      const { el, chosen, pick, fixture } = withHand([eat]);
      pick('p1');
      (el.querySelector('.actions app-action-list button') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(chosen).toEqual([endPhase]);
      expect(el.querySelector('.actions app-hand-card-actions')).toBeNull();
    });

    it('puts the card back on a second tap', () => {
      const { el, pick } = withHand([eat]);
      pick('p1');
      pick('p1');
      expect(el.querySelector('.actions app-hand-card-actions')).toBeNull();
    });
  });
  describe('tutorial anchors', () => {
    const sha = { instanceId: 's1', definitionId: 'sha', suit: 'spade' as const, rank: 7 };
    const play = { kind: 'PlayCardAction', seatId: 'seat-0', cardInstanceId: 's1', targets: [] } as unknown as Action;
    const endPhase = { kind: 'EndPhaseAction', seatId: 'seat-0' } as unknown as Action;
    const count = (el: HTMLElement, id: string) => el.querySelectorAll(`[data-tutorial="${id}"]`).length;

    function renderPlayPhase() {
      const { fixture, el } = render(4);
      fixture.componentRef.setInput('hand', [sha]);
      fixture.componentRef.setInput('handActions', [play]);
      fixture.componentRef.setInput('boardActions', [endPhase]);
      fixture.detectChanges();
      return { fixture, el };
    }

    it('anchors the viewer seat, its HP and its Generals, once each', () => {
      const { el } = renderPlayPhase();
      for (const id of ['seat:seat-0', 'hp:seat-0', 'general-info:seat-0']) expect([id, count(el, id)]).toEqual([id, 1]);
    });

    it('anchors every other seat once', () => {
      const { el } = renderPlayPhase();
      for (const id of ['seat:seat-1', 'seat:seat-2', 'seat:seat-3']) expect([id, count(el, id)]).toEqual([id, 1]);
    });

    it('anchors the hand, its cards, End Phase and the phase indicator once each', () => {
      const { el } = renderPlayPhase();
      for (const id of ['hand', 'hand-card:sha', 'end-phase', 'phase-indicator']) expect([id, count(el, id)]).toEqual([id, 1]);
    });

    it('anchors Play in the action column only once a card is picked', () => {
      const { fixture, el } = renderPlayPhase();
      expect(count(el, 'play-button:sha')).toBe(0);
      (el.querySelector('app-hand-view [data-card-id="s1"]') as HTMLElement).click();
      fixture.detectChanges();
      expect(el.querySelectorAll('.actions [data-tutorial="play-button:sha"]')).toHaveLength(1);
      expect(el.querySelector('.actions [data-tutorial="play-button:sha"]')!.tagName).toBe('BUTTON');
    });
  });
});

