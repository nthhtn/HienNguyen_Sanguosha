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

function render(seat: Seat, opts: { name?: string; handCount?: number; isTurnOwner?: boolean; isResponding?: boolean; isViewer?: boolean; isBot?: boolean; equipment?: CardInstance[] } = {}) {
  const fixture = TestBed.createComponent(SeatTile);
  fixture.componentRef.setInput('seat', seat);
  fixture.componentRef.setInput('name', opts.name ?? 'Seat 1');
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
    const el = render(makeSeat(), { handCount: 3, name: 'Hing' });
    const text = el.textContent!;
    expect(el.querySelector('.header strong')!.textContent).toBe('Hing');
    expect(text).not.toContain('seat-1');
    expect(text).toContain('Hidden');
    expect(text).toContain('Hidden General');
    expect(text).toContain('HP 6/8');
    expect(el.querySelector('.hand-count')!.textContent).toContain('3');
  });

  it('renders portraits for revealed generals', () => {
    const el = render(
      makeSeat({ kingdom: 'Shu', generals: { main: { generalDefinitionId: 'zhao-yun', revealed: true }, deputy: { generalDefinitionId: 'hidden', revealed: false } } })
    );
    expect(el.textContent).toContain('Shu');
    const portrait = el.querySelector('.generals app-card-art img') as HTMLImageElement;
    expect(portrait.getAttribute('src')).toBe('/card-art/generals/shu/zhao-yun.jpg');
    expect(portrait.classList).not.toContain('small');
  });

  it('shows a placeholder for a seat still choosing generals', () => {
    const el = render(makeSeat({ generals: null }));
    expect(el.textContent).toContain('Choosing Generals');
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
    expect(slots.map((s) => s.dataset['slot'])).toEqual(['weapon', 'armor', 'defensiveMount', 'offensiveMount']);
    expect(slots[0].querySelector('app-card-art img')!.classList).toContain('small');
    expect(slots[1].querySelector('app-card-art')).not.toBeNull();
    expect(slots[2].classList).toContain('empty');
    expect(slots[3].getAttribute('title')).toBe('Offensive Mount (empty)');
  });

  it('ignores an equipped card with no known slot (Review Focus 5)', () => {
    const el = render(makeSeat(), { equipment: [eq('e1', 'mystery-thing')] });
    expect(el.querySelectorAll('.equip .slot.empty')).toHaveLength(4);
  });

  it('still renders slots for an eliminated seat (Review Focus 2)', () => {
    const el = render(makeSeat({ eliminated: true }), { equipment: [eq('e1', 'green-dragon-blade')] });
    expect(el.querySelectorAll('.equip .slot')).toHaveLength(4);
  });
  it('draws general portraits at normal size and equipment slots at small size', () => {
    const el = render(
      makeSeat({ generals: { main: { generalDefinitionId: 'cao-cao', revealed: true }, deputy: { generalDefinitionId: 'hidden', revealed: false } } }),
      { equipment: [eq('e1', 'green-dragon-blade')] }
    );
    expect(el.querySelector('.generals app-card-art img')!.classList).not.toContain('small');
    expect(el.querySelector('.equip .slot app-card-art img')!.classList).toContain('small');
  });

  it('shows each equipped card’s name and suit and number, and opens its Info on click', async () => {
    const el = render(makeSeat(), { equipment: [{ instanceId: 'e1', definitionId: 'green-dragon-blade', suit: 'spade', rank: 5 }] });
    const weapon = el.querySelector('.slot[data-slot="weapon"]')!;
    expect(weapon.querySelector('.name')!.textContent).toBe('Green Dragon Blade');
    expect(weapon.querySelector('.face')!.textContent).toBe('5 ♠');
    (weapon.querySelector('button.slot-card') as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r));
    const info = document.querySelector('.cdk-overlay-container app-card-info-dialog')!;
    expect(info.textContent).toContain('Green Dragon Blade');
    // The Info popup shows the card as in the hand, at large size.
    expect(info.querySelector('app-playing-card .card.large .face')!.textContent).toBe('5 ♠');
    expect(info.querySelector('app-playing-card .card.large .name')!.textContent).toBe('Green Dragon Blade');
    expect(info.textContent).toContain('Range 3');
    document.querySelector('.cdk-overlay-container')!.replaceChildren();
  });

  it('colours the border after the seat’s force, and yellow while it is hidden', () => {
    for (const kingdom of ['Wei', 'Shu', 'Wu', 'Qun'] as const) {
      expect(render({ ...makeSeat(), kingdom }).querySelector('.tile')!.getAttribute('data-force')).toBe(kingdom);
    }
    expect(render({ ...makeSeat(), kingdom: 'hidden' }).querySelector('.tile')!.getAttribute('data-force')).toBe('none');
  });

  it('keeps the force colour on the turn owner and on a responding seat', () => {
    const owner = render({ ...makeSeat(), kingdom: 'Shu' }, { isTurnOwner: true }).querySelector('.tile')!;
    expect(owner.getAttribute('data-force')).toBe('Shu');
    expect(owner.classList).toContain('turn-owner');
    const responding = render({ ...makeSeat(), kingdom: 'Wu' }, { isResponding: true }).querySelector('.tile')!;
    expect(responding.getAttribute('data-force')).toBe('Wu');
  });

  it('says a seat at 0 HP or below is dying, and shows its HP as it is', () => {
    const el = render({ ...makeSeat(), combinedHp: -1 });
    expect(el.querySelector('.status.dying')!.textContent).toContain('Dying');
    expect(el.textContent).toContain('HP -1/');
    expect(render({ ...makeSeat(), combinedHp: -1, eliminated: true }).querySelector('.status')!.textContent).toContain('Eliminated');
  });

  it('shows status lines in the seat’s force colour, even once eliminated', () => {
    const dying = render({ ...makeSeat(), kingdom: 'Wu', combinedHp: 0 }).querySelector('.status')!;
    expect(dying.classList).toContain('force-status');
    expect(dying.getAttribute('data-force')).toBe('Wu');
    const out = render({ ...makeSeat(), kingdom: 'Shu', eliminated: true }).querySelector('.status')!;
    expect(out.textContent).toContain('Eliminated');
    expect(out.getAttribute('data-force')).toBe('Shu');
    expect(render({ ...makeSeat(), kingdom: 'hidden' }, { isResponding: true }).querySelector('.status')!.getAttribute('data-force')).toBe('none');
  });
});
