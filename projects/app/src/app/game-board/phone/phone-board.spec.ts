import { TestBed } from '@angular/core/testing';
import type { CardZone, GameState, Seat, UseSkill } from 'engine';
import { buildContentRegistry } from 'content';
import type { AvatarSkill } from '../avatar-skills';
import { PhoneBoard } from './phone-board';
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

const useSkill = { kind: 'UseSkillAction', seatId: 'seat-0', skillId: 'test' } as unknown as UseSkill;

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
});
