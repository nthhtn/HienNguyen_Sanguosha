import { TestBed } from '@angular/core/testing';
import { GameState } from 'engine';
import { PhaseIndicator } from './phase-indicator';

function state(phase: GameState['phase'], handSize = 0, combinedHp = 4): GameState {
  return {
    seats: [{
      id: 'seat-0', index: 0, kingdom: 'Wei',
      generals: { main: { generalDefinitionId: 'g1', revealed: false }, deputy: { generalDefinitionId: 'g2', revealed: false } },
      combinedHp, maxCombinedHp: 4,
      hand: { zoneId: 'seat-0:hand' }, equipped: { zoneId: 'seat-0:equip' }, judgment: { zoneId: 'seat-0:judgment' }, eliminated: false,
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
  // The turn and phase line, without the counts either side of it.
  const bar = (fixture.nativeElement as HTMLElement).querySelector('.phase-indicator')!.cloneNode(true) as HTMLElement;
  bar.querySelectorAll('.count').forEach((c) => c.remove());
  return bar.textContent!.replace(/\s+/g, ' ').trim();
}

describe('PhaseIndicator', () => {
  it('shows the turn owner, (you) for the viewer, and the phase', () => {
    expect(render(state('Play'), 'seat-0')).toBe('Seat 0 (you) – Play Phase');
  });

  it('names the Start phase in a Start window and never offers End Phase', () => {
    const s = state('Start');
    s.turn = { ...s.turn, startWindow: true };
    const text = render(s, 'seat-0');
    expect(text).toBe('Seat 0 (you) – Start Phase');
    expect(text).not.toContain('End Phase');
  });

  it('leaves out (you) when it is someone else\'s turn', () => {
    expect(render(state('Play'), 'seat-1')).toBe('Seat 0 – Play Phase');
  });

  it('adds how many cards are left to discard while over the hand limit', () => {
    expect(render(state('Discard', 6, 4), 'seat-0')).toBe('Seat 0 (you) – Discard Phase – discard 2 more');
  });

  it('counts what the engine still owes, not the whole excess (final review #7)', () => {
    // 6 cards at 4 HP, but only 1 discard is still owed this phase (a card was drawn mid-phase).
    const owing = state('Discard', 6, 4);
    expect(render({ ...owing, turn: { ...owing.turn, discardsLeft: 1 } }, 'seat-0')).toBe('Seat 0 (you) – Discard Phase – discard 1 more');
  });

  it('names every phase the same way', () => {
    for (const phase of ['Start', 'Judgment', 'Draw', 'End'] as const) {
      expect(render(state(phase), null)).toBe(`Seat 0 – ${phase} Phase`);
    }
  });

  it('tags the bar with the turn owner\'s force, for the name and timer colour', () => {
    const fixture = TestBed.createComponent(PhaseIndicator);
    fixture.componentRef.setInput('state', state('Play'));
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.phase-indicator')!.getAttribute('data-force')).toBe('Wei');
  });

  it('shows the turn number before the turn owner, and the draw pile count after the phase', () => {
    const fixture = TestBed.createComponent(PhaseIndicator);
    const s = state('Play');
    fixture.componentRef.setInput('state', { ...s, zones: [...s.zones, { id: 'drawPile', kind: 'drawPile', cards: [] }] });
    fixture.detectChanges();
    const counts = [...(fixture.nativeElement as HTMLElement).querySelectorAll('.count')].map((c) => c.textContent!.trim());
    expect(counts).toEqual(['Turn 2', 'Draw Pile 0']);
  });
});
