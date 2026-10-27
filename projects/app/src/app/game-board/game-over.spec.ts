import { TestBed } from '@angular/core/testing';
import { GameResult, Kingdom } from 'engine';
import { FinalSeatView } from 'protocol';
import { GameOver } from './game-over';

const seat = (n: number, kingdom: Kingdom, eliminated = false): FinalSeatView => ({
  seatId: `seat-${n}`, kingdom, allegiance: 'kingdom', mainGeneralId: null, deputyGeneralId: null, eliminated,
});
const FOUR_SEATS = [seat(0, 'Wei'), seat(1, 'Shu', true), seat(2, 'Wei'), seat(3, 'Wu', true)];

describe('GameOver', () => {
  it('renders the victory board with its columns and emits newGame on click', () => {
    const fixture = TestBed.createComponent(GameOver);
    const result: GameResult = {
      endedAt: 12,
      winningKingdom: 'Wei',
      winningSeatIds: ['seat-0', 'seat-2'],
      losingSeatIds: ['seat-1', 'seat-3'],
    };
    fixture.componentRef.setInput('result', result);
    fixture.componentRef.setInput('seats', FOUR_SEATS);
    fixture.componentRef.setInput('youSeatId', null);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-victory-board')).not.toBeNull();
    expect(el.querySelectorAll('.col').length).toBe(3);
    expect(el.querySelector('.headline')!.getAttribute('data-force')).toBe('Wei');
    expect(el.textContent).toContain('Seat 0');

    const newGameSpy = jest.fn();
    fixture.componentInstance.newGame.subscribe(newGameSpy);
    el.querySelector('button')!.dispatchEvent(new Event('click'));
    expect(newGameSpy).toHaveBeenCalled();
  });

  it('names the seats by their players’ names', () => {
    const fixture = TestBed.createComponent(GameOver);
    fixture.componentRef.setInput('result', { endedAt: 1, winningSeatIds: ['seat-0'], losingSeatIds: ['seat-1'] } satisfies GameResult);
    fixture.componentRef.setInput('seats', [seat(0, 'Wei'), seat(1, 'Shu', true)]);
    fixture.componentRef.setInput('youSeatId', 'seat-0');
    fixture.componentRef.setInput('players', [
      { id: 'p0', seatId: 'seat-0', kind: 'human', name: 'Hing' },
      { id: 'p1', seatId: 'seat-1', kind: 'bot', name: 'Seat 1' },
    ]);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Hing');
  });
});
