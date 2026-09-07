import { TestBed } from '@angular/core/testing';
import { EngineEvent } from 'engine';
import { EventLog } from './event-log';

describe('EventLog', () => {
  it('renders one line per event, oldest first', () => {
    const fixture = TestBed.createComponent(EventLog);
    const events: EngineEvent[] = [
      { kind: 'SeatEliminatedEvent', seatId: 'seat-1' },
      { kind: 'TurnAdvancedEvent', seatId: 'seat-2', turnNumber: 3 },
    ];
    fixture.componentRef.setInput('events', events);
    fixture.detectChanges();

    const items = (fixture.nativeElement as HTMLElement).querySelectorAll('li');
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain('seat-1 was eliminated');
    expect(items[1].textContent).toContain("Turn 3: seat-2's turn");
  });
});
