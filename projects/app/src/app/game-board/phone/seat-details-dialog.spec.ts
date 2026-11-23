import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import type { CardInstance, CardZone, GameState, Seat } from 'engine';
import { HIDDEN_GENERAL_ART_URL } from 'content';
import { CardInfoDialog } from '../card-info-dialog';
import { GeneralInfoDialog } from '../general-info-dialog';
import { SeatDetailsDialog, SeatDetailsData } from './seat-details-dialog';
import { testSeat } from './phone.testing';

const card = (instanceId: string, definitionId: string): CardInstance => ({ instanceId, definitionId, suit: 'spade', rank: 7 });

function state(seat: Seat, equip: CardInstance[] = [], judgment: CardInstance[] = []): GameState {
  const zones: CardZone[] = [
    { id: 'drawPile', kind: 'drawPile', cards: [] },
    { id: seat.hand.zoneId, kind: 'hand', ownerSeatId: seat.id, cards: [card('h1', 'hidden'), card('h2', 'hidden')] },
    { id: seat.equipped.zoneId, kind: 'equip', ownerSeatId: seat.id, cards: equip },
    { id: seat.judgment.zoneId, kind: 'judgment', ownerSeatId: seat.id, cards: judgment },
  ];
  return {
    seats: [seat], players: [], zones, log: [],
    turn: { turnNumber: 1, ownerSeatId: seat.id, extraTurnStack: [] },
    phase: 'Play', pendingResponse: null, rng: { seed: 1, counter: 0 }, result: null, generalSelection: null,
  };
}

const revealed = (extra: Partial<Seat> = {}) =>
  testSeat('seat-2', 2, {
    kingdom: 'Wei',
    generals: { main: { generalDefinitionId: 'cao-cao', revealed: true }, deputy: { generalDefinitionId: 'hidden', revealed: false } },
    combinedHp: 3,
    maxCombinedHp: 4,
    ...extra,
  });

describe('SeatDetailsDialog', () => {
  function render(s: GameState) {
    const live = signal(s);
    const open = jest.fn();
    const close = jest.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: { state: live, seatId: 'seat-2' } satisfies SeatDetailsData },
        { provide: MatDialogRef, useValue: { close } },
        { provide: MatDialog, useValue: { open } },
      ],
    });
    const fixture = TestBed.createComponent(SeatDetailsDialog);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement, live, open, close };
  }

  it('shows the seat, its HP and hand count, and a revealed General with its skills', () => {
    const { el } = render(state(revealed()));
    expect(el.querySelector('h2')!.textContent).toContain('Seat 2');
    expect(el.querySelector('.summary')!.textContent).toContain('3/4');
    expect(el.querySelector('.summary')!.textContent).toContain('2');
    const main = el.querySelector('.general[data-slot="main"]')!;
    expect(main.querySelector('.general-name')!.textContent!.trim().length).toBeGreaterThan(0);
    expect(main.querySelectorAll('.skill').length).toBeGreaterThan(0);
  });

  it('opens the General info window from a revealed General', () => {
    const { el, open } = render(state(revealed()));
    (el.querySelector('.general[data-slot="main"] button.open-general') as HTMLButtonElement).click();
    expect(open).toHaveBeenCalledWith(GeneralInfoDialog, expect.objectContaining({ data: { generalDefinitionId: 'cao-cao' } }));
  });

  it('shows a hidden General as Hidden, with no button and no skills', () => {
    const { el } = render(state(revealed()));
    const deputy = el.querySelector('.general[data-slot="deputy"]')!;
    expect(deputy.textContent).toContain('Hidden');
    expect(deputy.querySelector('button')).toBeNull();
    expect(deputy.querySelectorAll('.skill')).toHaveLength(0);
  });

  it('shows the hidden-General picture for a hidden General (spec 3f)', () => {
    const { el } = render(state(revealed()));
    const picture = el.querySelector('.general[data-slot="deputy"] img.portrait')!;
    expect(picture.getAttribute('src')).toBe(HIDDEN_GENERAL_ART_URL);
  });

  it('shows the four Equipment slots in one row, always: a card face where filled, a dimmed box where empty (spec 3f)', () => {
    const { el } = render(state(revealed(), [card('e1', 'serpent-spear'), card('e2', 'red-hare')]));
    const slots = [...el.querySelectorAll('.equipment .slot')];
    expect(slots.map((s) => s.getAttribute('data-slot'))).toEqual(['weapon', 'armor', 'defensiveMount', 'offensiveMount']);
    expect(slots.map((s) => s.classList.contains('empty'))).toEqual([false, true, true, false]);
    expect(slots[0].querySelector('app-playing-card')).not.toBeNull();
    expect(slots[1].querySelector('app-playing-card')).toBeNull();
    expect(slots[1].querySelector('button')).toBeNull();
    expect(slots[1].getAttribute('title')).toContain('empty');
  });

  it('lists Equipment and Judgment by name, each opening the card info window', () => {
    const { el, open } = render(state(revealed(), [card('e1', 'serpent-spear')], [card('j1', 'lightning')]));
    const equipment = el.querySelectorAll<HTMLButtonElement>('.equipment button.card');
    expect(equipment).toHaveLength(1);
    expect(el.querySelectorAll('.judgment button.card')).toHaveLength(1);
    equipment[0].click();
    expect(open).toHaveBeenCalledWith(CardInfoDialog, expect.objectContaining({ data: expect.objectContaining({ card: card('e1', 'serpent-spear') }) }));
  });

  it('leaves out Judgment with no cards, but keeps the four empty Equipment slots', () => {
    const { el } = render(state(revealed()));
    expect(el.querySelectorAll('.equipment .slot.empty')).toHaveLength(4);
    expect(el.querySelector('.judgment')).toBeNull();
  });

  it('follows the game while open', () => {
    const { fixture, el, live } = render(state(revealed()));
    live.set(state(revealed(), [card('e1', 'serpent-spear')]));
    fixture.detectChanges();
    expect(el.querySelectorAll('.equipment button.card')).toHaveLength(1);
  });

  it('says Face Down, Chained and Eliminated as text', () => {
    const { el } = render(state(revealed({ faceDown: true, chained: true, eliminated: true })));
    const states = el.querySelector('.states')!.textContent!;
    expect(states).toContain('Face Down');
    expect(states).toContain('Chained');
    expect(states).toContain('Eliminated');
  });

  it('closes from Close', () => {
    const { el, close } = render(state(revealed()));
    (el.querySelector('button.close') as HTMLButtonElement).click();
    expect(close).toHaveBeenCalled();
  });
});
