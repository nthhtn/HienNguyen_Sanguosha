import { TestBed } from '@angular/core/testing';
import { Seat } from 'engine';
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

describe('SeatSummary', () => {
  it('renders hidden kingdom/generals and HP/hand count', () => {
    const fixture = TestBed.createComponent(SeatSummary);
    fixture.componentRef.setInput('seat', makeSeat());
    fixture.componentRef.setInput('handCount', 3);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent!;
    expect(text).toContain('seat-0');
    expect(text).toContain('Hidden');
    expect(text).toContain('a hidden general');
    expect(text).toContain('6/8');
    expect(text).toContain('3');
  });

  it('renders a revealed kingdom and general name', () => {
    const fixture = TestBed.createComponent(SeatSummary);
    fixture.componentRef.setInput(
      'seat',
      makeSeat({ kingdom: 'Wu', generals: { main: { generalDefinitionId: 'zhao-yun', revealed: true }, deputy: { generalDefinitionId: 'hidden', revealed: false } } })
    );
    fixture.componentRef.setInput('handCount', 0);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent!;
    expect(text).toContain('Wu');
    expect(text).toContain('Zhao Yun');
  });

  it('marks an eliminated seat', () => {
    const fixture = TestBed.createComponent(SeatSummary);
    fixture.componentRef.setInput('seat', makeSeat({ eliminated: true }));
    fixture.componentRef.setInput('handCount', 0);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('eliminated');
  });
});
