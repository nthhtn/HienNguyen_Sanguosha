import { TestBed } from '@angular/core/testing';
import type { Action, CardZone, GameState, Seat } from 'engine';
import { buildContentRegistry } from 'content';
import type { AvatarSkill } from '../avatar-skills';
import { PhoneBoard } from './phone-board';
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
});
