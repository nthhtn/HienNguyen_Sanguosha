import { TestBed } from '@angular/core/testing';
import { GameState } from 'engine';
import { TargetLabel } from './target-label';

const seat = (id: string, kingdom: string, main = 'hidden', deputy = 'hidden', deputyRevealed = true) => ({
  id,
  kingdom,
  generals: { main: { generalDefinitionId: main, revealed: kingdom !== 'hidden' }, deputy: { generalDefinitionId: deputy, revealed: deputyRevealed } },
});
const state = {
  players: [{ seatId: 'seat-1', name: 'Hing' }, { seatId: 'seat-2', name: 'Bot' }],
  seats: [seat('seat-1', 'hidden'), seat('seat-2', 'Wei', 'cao-cao', 'sima-yi'), seat('seat-3', 'Shu', 'liu-bei', 'hidden', false)],
} as unknown as GameState;

function render(inputs: { prefix?: string | null; label?: string; targets?: unknown[] }) {
  const fixture = TestBed.createComponent(TargetLabel);
  fixture.componentRef.setInput('state', state);
  for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('TargetLabel', () => {
  it('shows a hidden-kingdom target as just the player name, in the yellow (none) force', () => {
    const el = render({ prefix: 'Targeting', targets: [{ kind: 'seat', seatId: 'seat-1' }] });
    expect(el.textContent).toBe('Targeting Hing');
    expect(el.querySelector('.target')!.getAttribute('data-force')).toBe('none');
  });

  it('adds the Main and Deputy General once the kingdom is revealed, in its force', () => {
    const el = render({ prefix: 'Play Slash Targeting', targets: [{ kind: 'seat', seatId: 'seat-2' }] });
    expect(el.textContent).toBe('Play Slash Targeting Bot Cao Cao - Sima Yi');
    expect(el.querySelector('.target')!.getAttribute('data-force')).toBe('Wei');
  });

  it('leaves out a General still face down, and the hyphen with it', () => {
    const el = render({ prefix: 'Targeting', targets: [{ kind: 'seat', seatId: 'seat-3' }] });
    expect(el.textContent).toBe('Targeting seat-3 Liu Bei'.replace('seat-3', 'Seat 3'));
  });

  it('separates several targets with commas, and shows the plain label when there are none', () => {
    const el = render({ prefix: 'Targeting', targets: [{ kind: 'seat', seatId: 'seat-1' }, { kind: 'seat', seatId: 'seat-2' }] });
    expect(el.textContent).toBe('Targeting Hing, Bot Cao Cao - Sima Yi');
    expect(render({ label: 'Pass' }).textContent).toBe('Pass');
  });
});
