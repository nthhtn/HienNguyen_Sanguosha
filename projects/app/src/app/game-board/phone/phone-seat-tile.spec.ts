import { readFileSync } from 'fs';
import { join } from 'path';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { CardInstance, Seat } from 'engine';
import { PhoneSeatTile } from './phone-seat-tile';
import { testSeat } from './phone.testing';

const card = (instanceId: string, definitionId: string): CardInstance => ({ instanceId, definitionId, suit: 'spade', rank: 7 });

describe('PhoneSeatTile', () => {
  let fixture: ComponentFixture<PhoneSeatTile>;

  function render(seat: Seat, set: Record<string, unknown> = {}): HTMLElement {
    fixture = TestBed.createComponent(PhoneSeatTile);
    fixture.componentRef.setInput('seat', seat);
    fixture.componentRef.setInput('name', 'Seat 3');
    fixture.componentRef.setInput('handCount', 5);
    for (const [key, value] of Object.entries(set)) fixture.componentRef.setInput(key, value);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the name, HP, hand count, both Generals, three Judgment boxes and four Equipment boxes', () => {
    const el = render(testSeat('seat-3', 3, { combinedHp: 3, maxCombinedHp: 4 }), {
      judgment: [card('j1', 'lightning')],
      equipment: [card('e1', 'serpent-spear')],
    });
    expect(el.querySelector('.name')!.textContent).toContain('Seat 3');
    expect(el.querySelector('.hp')!.textContent).toContain('3/4');
    expect(el.querySelector('.hand')!.textContent).toContain('5');
    expect(el.querySelectorAll('.general')).toHaveLength(2);
    const judgment = el.querySelectorAll('.judgment-box');
    expect(judgment).toHaveLength(3);
    expect([...judgment].filter((b) => b.classList.contains('filled'))).toHaveLength(1);
    const equipment = el.querySelectorAll('.equip-box');
    expect(equipment).toHaveLength(4);
    expect(el.querySelector('.equip-box[data-slot="weapon"]')!.classList).toContain('filled');
    expect(el.querySelector('.equip-box[data-slot="armor"]')!.classList).not.toContain('filled');
  });

  it('shows the chained mark only for a chained seat, with an accessible name', () => {
    expect(render(testSeat('seat-3', 3)).querySelector('.chain-mark')).toBeNull();
    const mark = render(testSeat('seat-3', 3, { chained: true })).querySelector('.chain-mark')!;
    expect(mark.getAttribute('aria-label')).toBe('Chained');
  });

  it('marks an Ambitionist', () => {
    expect(render(testSeat('seat-3', 3, { allegiance: 'ambitionist' })).querySelector('.ambitionist-mark')).not.toBeNull();
  });

  it('stamps an eliminated seat', () => {
    const el = render(testSeat('seat-3', 3, { eliminated: true }));
    expect(el.querySelector('.tile')!.classList).toContain('eliminated');
    expect(el.querySelector('.stamp')!.textContent).toContain('Eliminated');
  });

  it('shows whose turn it is and who is responding', () => {
    const tile = render(testSeat('seat-3', 3), { isTurnOwner: true, isResponding: true }).querySelector('.tile')!;
    expect(tile.classList).toContain('turn-owner');
    expect(tile.classList).toContain('responding');
  });

  it('is slim when asked', () => {
    expect(render(testSeat('seat-3', 3), { slim: true }).querySelector('.tile')!.classList).toContain('slim');
  });

  it("opens on a tap on an opponent's tile, but not on the viewer's", () => {
    let opened = 0;
    render(testSeat('seat-3', 3));
    fixture.componentInstance.opened.subscribe(() => opened++);
    (fixture.nativeElement.querySelector('button.tile') as HTMLButtonElement).click();
    expect(opened).toBe(1);
    const viewer = render(testSeat('seat-0', 0), { isViewer: true });
    expect(viewer.querySelector('button.tile')).toBeNull();
  });

  it('sets no text under 12 px', () => {
    const source = readFileSync(join(__dirname, 'phone-seat-tile.ts'), 'utf8');
    const sizes = [...source.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1]));
    expect(sizes.length).toBeGreaterThan(0);
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(12);
    expect(source).not.toMatch(/font-size:\s*[\d.]+em/);
  });
});
