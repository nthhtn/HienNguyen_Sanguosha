import { TestBed } from '@angular/core/testing';
import { GameState } from 'engine';
import { PhaseIndicator } from './phase-indicator';

function state(phase: GameState['phase'], handSize = 0, combinedHp = 4): GameState {
  return {
    seats: [{
      id: 'seat-0', index: 0, kingdom: 'Wei',
      generals: { main: { generalDefinitionId: 'g1', revealed: false }, deputy: { generalDefinitionId: 'g2', revealed: false } },
      combinedHp, maxCombinedHp: 4,
      hand: { zoneId: 'seat-0:hand' }, equipped: { zoneId: 'seat-0:equip' }, eliminated: false,
    }],
    players: [], turn: { turnNumber: 2, ownerSeatId: 'seat-0', extraTurnStack: [] }, phase,
    zones: [{
      id: 'seat-0:hand', kind: 'hand', ownerSeatId: 'seat-0',
      cards: Array.from({ length: handSize }, (_, i) => ({ instanceId: `c${i}`, definitionId: 'sha', suit: 'spade' as const, rank: 1 })),
    }],
    pendingResponse: null, log: [], rng: { seed: 1, counter: 0 }, result: null, generalSelection: null,
  };
}

function render(s: GameState, viewerSeatId: string | null): string {
  const fixture = TestBed.createComponent(PhaseIndicator);
  fixture.componentRef.setInput('state', s);
  fixture.componentRef.setInput('viewerSeatId', viewerSeatId);
  fixture.detectChanges();
  return (fixture.nativeElement as HTMLElement).querySelector('.phase-indicator')!.textContent!.replace(/\s+/g, ' ').trim();
}

describe('PhaseIndicator', () => {
  it('shows the turn owner, (you) for the viewer, and the phase', () => {
    expect(render(state('Play'), 'seat-0')).toBe('Seat 0 (you) – Play Phase');
  });

  it('leaves out (you) when it is someone else\'s turn', () => {
    expect(render(state('Play'), 'seat-1')).toBe('Seat 0 – Play Phase');
  });

  it('adds how many cards are left to discard while over the hand limit', () => {
    expect(render(state('Discard', 6, 4), 'seat-0')).toBe('Seat 0 (you) – Discard Phase – discard 2 more');
  });

  it('names every phase the same way', () => {
    for (const phase of ['Start', 'Judgment', 'Draw', 'End'] as const) {
      expect(render(state(phase), null)).toBe(`Seat 0 – ${phase} Phase`);
    }
  });
});
