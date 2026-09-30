import { TestBed } from '@angular/core/testing';
import { CardInstance, Seat } from 'engine';
import { SeatSummary } from './seat-summary';

function makeSeat(overrides: Partial<Seat> = {}): Seat {
  return {
    id: 'seat-0',
    index: 0,
    kingdom: 'hidden',
    generals: {
      main: { generalDefinitionId: 'hidden', revealed: false },
      deputy: { generalDefinitionId: 'hidden', revealed: false },
    },
    combinedHp: 6,
    maxCombinedHp: 8,
    hand: { zoneId: 'hand-0' },
    equipped: { zoneId: 'equip-0' },
    eliminated: false,
    ...overrides,
  };
}

function makeHand(count: number, definitionId = 'hidden'): CardInstance[] {
  return Array.from({ length: count }, (_, i) => ({
    instanceId: `card-${i}`,
    definitionId,
    suit: 'spade' as const,
    rank: 1,
  }));
}

describe('SeatSummary', () => {
  it('renders hidden kingdom/generals and HP, and one hand thumbnail per card', () => {
    const fixture = TestBed.createComponent(SeatSummary);
    fixture.componentRef.setInput('seat', makeSeat());
    fixture.componentRef.setInput('hand', makeHand(3));
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const text = el.textContent!;
    expect(text).toContain('seat-0');
    expect(text).toContain('Hidden');
    expect(text).toContain('a hidden general');
    expect(text).toContain('6/8');
    expect(el.querySelectorAll('.hand app-card-art')).toHaveLength(3);
  });

  it('renders a revealed kingdom and general name with a portrait', () => {
    const fixture = TestBed.createComponent(SeatSummary);
    fixture.componentRef.setInput(
      'seat',
      makeSeat({ kingdom: 'Wu', generals: { main: { generalDefinitionId: 'zhao-yun', revealed: true }, deputy: { generalDefinitionId: 'hidden', revealed: false } } })
    );
    fixture.componentRef.setInput('hand', []);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Wu');
    const mainPortrait = el.querySelector('.generals app-card-art img') as HTMLImageElement | null;
    expect(mainPortrait?.getAttribute('src')).toBe('/card-art/generals/shu/zhao-yun.jpg');
    expect(mainPortrait?.getAttribute('alt')).toBe('Zhao Yun');
  });

  it('renders a card image for a visible (non-hidden) hand card', () => {
    const fixture = TestBed.createComponent(SeatSummary);
    fixture.componentRef.setInput('seat', makeSeat());
    fixture.componentRef.setInput('hand', makeHand(1, 'sha'));
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const img = el.querySelector('.hand app-card-art img') as HTMLImageElement | null;
    expect(img?.getAttribute('src')).toBe('/card-art/cards/basic/sha.jpg');
  });

  it('shows a placeholder instead of portraits for a seat still choosing generals', () => {
    const fixture = TestBed.createComponent(SeatSummary);
    fixture.componentRef.setInput('seat', makeSeat({ generals: null }));
    fixture.componentRef.setInput('hand', makeHand(4));
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Choosing generals');
    expect(el.querySelectorAll('.generals app-card-art')).toHaveLength(0);
  });

  it('marks an eliminated seat', () => {
    const fixture = TestBed.createComponent(SeatSummary);
    fixture.componentRef.setInput('seat', makeSeat({ eliminated: true }));
    fixture.componentRef.setInput('hand', []);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('eliminated');
  });
});
