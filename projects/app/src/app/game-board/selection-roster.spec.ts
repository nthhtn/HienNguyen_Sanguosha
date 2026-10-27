import { TestBed } from '@angular/core/testing';
import { SelectionRoster, SelectionRosterRow } from './selection-roster';

describe('SelectionRoster', () => {
  const rows: SelectionRosterRow[] = [
    { seatId: 'seat-0', name: 'Ann', ready: true, isYou: true },
    { seatId: 'seat-1', name: 'Bo', ready: false, isYou: false },
    { seatId: 'seat-2', name: 'Bot 2', ready: true, isYou: false },
  ];
  const render = () => {
    const fixture = TestBed.createComponent(SelectionRoster);
    fixture.componentRef.setInput('rows', rows);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  it('has a Title Case heading and a row for every seat', () => {
    const el = render();
    expect(el.querySelector('h3')!.textContent).toBe('Players');
    expect(el.querySelectorAll('li')).toHaveLength(3);
  });

  it('shows Choosing or Ready for each seat, in sentence case', () => {
    const statuses = Array.from(render().querySelectorAll('li .status')).map((e) => e.textContent!.trim());
    expect(statuses).toEqual(['Ready', 'Choosing', 'Ready']);
  });

  it("marks the viewer's own row", () => {
    const items = Array.from(render().querySelectorAll('li'));
    expect(items[0].textContent).toContain('You');
    expect(items[1].textContent).not.toContain('You');
  });

  it('shows names, never seat ids', () => {
    expect(render().textContent).not.toMatch(/seat-\d/);
  });
});
