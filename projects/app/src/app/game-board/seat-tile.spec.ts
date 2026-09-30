import { TestBed } from '@angular/core/testing';
import { Seat } from 'engine';
import { SeatTile } from './seat-tile';

function makeSeat(overrides: Partial<Seat> = {}): Seat {
  return {
    id: 'seat-1',
    index: 1,
    kingdom: 'hidden',
    generals: {
      main: { generalDefinitionId: 'hidden', revealed: false },
      deputy: { generalDefinitionId: 'hidden', revealed: false },
    },
    combinedHp: 6,
    maxCombinedHp: 8,
    hand: { zoneId: 'hand-1' },
    equipped: { zoneId: 'equip-1' },
    eliminated: false,
    ...overrides,
  };
}

function render(seat: Seat, opts: { handCount?: number; isTurnOwner?: boolean; isResponding?: boolean; isViewer?: boolean } = {}) {
  const fixture = TestBed.createComponent(SeatTile);
  fixture.componentRef.setInput('seat', seat);
  fixture.componentRef.setInput('handCount', opts.handCount ?? 4);
  fixture.componentRef.setInput('isTurnOwner', opts.isTurnOwner ?? false);
  fixture.componentRef.setInput('isResponding', opts.isResponding ?? false);
  fixture.componentRef.setInput('isViewer', opts.isViewer ?? false);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('SeatTile', () => {
  it('shows the seat name, hidden kingdom and generals, HP and hand count', () => {
    const el = render(makeSeat(), { handCount: 3 });
    const text = el.textContent!;
    expect(text).toContain('seat-1');
    expect(text).toContain('Hidden');
    expect(text).toContain('a hidden general');
    expect(text).toContain('HP 6/8');
    expect(el.querySelector('.hand-count')!.textContent).toContain('3');
  });

  it('renders small portraits for revealed generals', () => {
    const el = render(
      makeSeat({ kingdom: 'Shu', generals: { main: { generalDefinitionId: 'zhao-yun', revealed: true }, deputy: { generalDefinitionId: 'hidden', revealed: false } } })
    );
    expect(el.textContent).toContain('Shu');
    const portrait = el.querySelector('.generals app-card-art img') as HTMLImageElement;
    expect(portrait.getAttribute('src')).toBe('/card-art/generals/shu/zhao-yun.jpg');
    expect(portrait.classList).toContain('small');
  });

  it('shows a placeholder for a seat still choosing generals', () => {
    const el = render(makeSeat({ generals: null }));
    expect(el.textContent).toContain('Choosing generals');
    expect(el.querySelectorAll('.generals app-card-art')).toHaveLength(0);
  });

  it('labels the viewer’s own tile', () => {
    expect(render(makeSeat(), { isViewer: true }).textContent).toContain('(you)');
    expect(render(makeSeat()).textContent).not.toContain('(you)');
  });

  it('highlights the turn owner and tags a responding seat', () => {
    expect(render(makeSeat(), { isTurnOwner: true }).querySelector('.tile')!.classList).toContain('turn-owner');
    const responding = render(makeSeat(), { isResponding: true });
    expect(responding.querySelector('.tile')!.classList).toContain('responding');
    expect(responding.textContent).toContain('Responding');
  });

  it('greys out an eliminated seat', () => {
    const el = render(makeSeat({ eliminated: true }));
    expect(el.querySelector('.tile')!.classList).toContain('eliminated');
    expect(el.textContent).toContain('Eliminated');
  });
});
