import { TestBed } from '@angular/core/testing';
import { CardInstance, Seat } from 'engine';
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

function render(seat: Seat, opts: { handCount?: number; isTurnOwner?: boolean; isResponding?: boolean; isViewer?: boolean; isBot?: boolean; equipment?: CardInstance[] } = {}) {
  const fixture = TestBed.createComponent(SeatTile);
  fixture.componentRef.setInput('seat', seat);
  fixture.componentRef.setInput('handCount', opts.handCount ?? 4);
  fixture.componentRef.setInput('isTurnOwner', opts.isTurnOwner ?? false);
  fixture.componentRef.setInput('isResponding', opts.isResponding ?? false);
  fixture.componentRef.setInput('isViewer', opts.isViewer ?? false);
  fixture.componentRef.setInput('isBot', opts.isBot ?? false);
  fixture.componentRef.setInput('equipment', opts.equipment ?? []);
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
  it('marks a bot seat with a robot icon', () => {
    expect(render(makeSeat(), { isBot: true }).querySelector('.bot-icon')).not.toBeNull();
    expect(render(makeSeat()).querySelector('.bot-icon')).toBeNull();
  });
  const eq = (instanceId: string, definitionId: string): CardInstance => ({ instanceId, definitionId, suit: 'spade', rank: 1 });

  it('renders four equipment slots in order, filled or empty', () => {
    const el = render(makeSeat(), { equipment: [eq('e1', 'silver-lion'), eq('e2', 'green-dragon-blade')] });
    const slots = [...el.querySelectorAll('.equip .slot')] as HTMLElement[];
    expect(slots.map((s) => s.dataset['slot'])).toEqual(['weapon', 'armor', 'plusMount', 'minusMount']);
    expect(slots[0].querySelector('app-card-art')).not.toBeNull();
    expect(slots[1].querySelector('app-card-art')).not.toBeNull();
    expect(slots[2].classList).toContain('empty');
    expect(slots[3].getAttribute('title')).toBe('−1 Horse (empty)');
  });

  it('ignores an equipped card with no known slot (Review Focus 5)', () => {
    const el = render(makeSeat(), { equipment: [eq('e1', 'mystery-thing')] });
    expect(el.querySelectorAll('.equip .slot.empty')).toHaveLength(4);
  });

  it('still renders slots for an eliminated seat (Review Focus 2)', () => {
    const el = render(makeSeat({ eliminated: true }), { equipment: [eq('e1', 'green-dragon-blade')] });
    expect(el.querySelectorAll('.equip .slot')).toHaveLength(4);
  });
});
