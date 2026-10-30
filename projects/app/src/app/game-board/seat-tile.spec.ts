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
    judgment: { zoneId: 'judgment-1' },
    eliminated: false,
    ...overrides,
  };
}

function render(seat: Seat, opts: { name?: string; handCount?: number; isTurnOwner?: boolean; isResponding?: boolean; isViewer?: boolean; isBot?: boolean; equipment?: CardInstance[]; judgment?: CardInstance[]; judgmentCountsAs?: Record<string, string>; pile?: CardInstance[]; stash?: CardInstance[]; dying?: boolean } = {}) {
  const fixture = TestBed.createComponent(SeatTile);
  fixture.componentRef.setInput('seat', seat);
  fixture.componentRef.setInput('name', opts.name ?? 'Seat 1');
  fixture.componentRef.setInput('handCount', opts.handCount ?? 4);
  fixture.componentRef.setInput('isTurnOwner', opts.isTurnOwner ?? false);
  fixture.componentRef.setInput('isResponding', opts.isResponding ?? false);
  fixture.componentRef.setInput('isViewer', opts.isViewer ?? false);
  fixture.componentRef.setInput('isBot', opts.isBot ?? false);
  fixture.componentRef.setInput('equipment', opts.equipment ?? []);
  fixture.componentRef.setInput('judgment', opts.judgment ?? []);
  if (opts.judgmentCountsAs) fixture.componentRef.setInput('judgmentCountsAs', opts.judgmentCountsAs);
  if (opts.pile) fixture.componentRef.setInput('pile', opts.pile);
  if (opts.stash) fixture.componentRef.setInput('stash', opts.stash);
  if (opts.dying !== undefined) fixture.componentRef.setInput('dying', opts.dying);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('SeatTile', () => {
  it('a seat kept alive below 1 HP (Refusing Death) is not shown as dying when its parent says so', () => {
    expect(render({ ...makeSeat(), combinedHp: -1 }, { dying: false }).querySelector('.status.dying')).toBeNull();
    expect(render({ ...makeSeat(), combinedHp: -1 }, { dying: true }).querySelector('.status.dying')).not.toBeNull();
  });

  it('shows a face-down seat with a badge and dimmed portraits', () => {
    const el = render(makeSeat({ faceDown: true }));
    expect(el.querySelector('.face-down-badge')?.textContent?.trim()).toBe('Face Down');
    expect(el.querySelector('.generals')?.classList).toContain('face-down');
    expect(render(makeSeat()).querySelector('.face-down-badge')).toBeNull();
  });

  it('shows the cards under the General face up', () => {
    const el = render(makeSeat(), { pile: [{ instanceId: 'p1', definitionId: 'sha', suit: 'spade', rank: 7 }, { instanceId: 'p2', definitionId: 'shan', suit: 'heart', rank: 2 }] });
    expect(el.querySelectorAll('[aria-label="Under General"] app-playing-card')).toHaveLength(2);
  });

  it('shows the Farms under the General, face up', () => {
    const el = render(makeSeat(), { stash: [{ instanceId: 'f1', definitionId: 'shan', suit: 'spade', rank: 3 }] });
    expect(el.querySelectorAll('[aria-label="Set Aside Cards"] app-playing-card')).toHaveLength(1);
  });

  it('shows a chain marker on a chained seat, and none on an unchained one', () => {
    const marker = render(makeSeat({ chained: true })).querySelector('.chain-badge');
    expect(marker?.textContent?.trim()).toBe('Chained');
    expect(render(makeSeat()).querySelector('.chain-badge')).toBeNull();
  });

  it('shows the chosen Form and a silenced seat', () => {
    const forms = { slot: 'main' as const, held: ['hidden'], chosen: { generalId: 'zhou-yu', skillId: 'brave-gesture' } };
    expect(render(makeSeat({ forms }), {}).querySelector('.form-badge')?.textContent?.trim()).toBe('Form: Zhou Yu (Brave Gesture)');
    expect(render(makeSeat({ silenced: true }), {}).querySelector('.silenced-badge')?.textContent?.trim()).toBe('No Skills');
    expect(render(makeSeat(), {}).querySelector('.silenced-badge')).toBeNull();
  });

  it('shows which General lost its skills (Kingdom Wars Sorrow); the whole-seat badge stays as it was', () => {
    const badges = (el: HTMLElement) => [...el.querySelectorAll('.silenced-badge')].map((b) => b.textContent?.trim());
    expect(badges(render(makeSeat({ silencedSlots: ['deputy'] }), {}))).toEqual(['Deputy General: No Skills']);
    expect(badges(render(makeSeat({ silencedSlots: ['main'] }), {}))).toEqual(['Main General: No Skills']);
    expect(badges(render(makeSeat({ silenced: true }), {}))).toEqual(['No Skills']);
  });


  it('names a Judgment slot card placed as another card', () => {
    const el = render(makeSeat(), { judgment: [{ instanceId: 'dm', definitionId: 'shan', suit: 'diamond', rank: 3 }], judgmentCountsAs: { dm: 'capture' } });
    const slot = el.querySelector('.judgment .slot') as HTMLElement;
    expect(slot.textContent).toContain('As Capture');
    expect(slot.getAttribute('title')).toBe('Judgment Area: Dodge as Capture');
  });

  it('shows the seat name, hidden kingdom and generals, HP and hand count', () => {
    const el = render(makeSeat(), { handCount: 3, name: 'Hing' });
    const text = el.textContent!;
    expect(el.querySelector('.header strong')!.textContent).toBe('Hing');
    expect(text).not.toContain('seat-1');
    expect(text).toContain('Hidden');
    expect(el.querySelectorAll('app-seat-avatar .half')).toHaveLength(2);
    expect(el.querySelector('app-seat-avatar .half[data-slot="main"] .caption')!.textContent!.trim()).toBe('Hidden');
    expect(text).toContain('HP 6/8');
    expect(el.querySelector('.hand-count')!.textContent).toContain('3');
  });

  it('renders portraits for revealed generals', () => {
    const el = render(
      makeSeat({ kingdom: 'Shu', generals: { main: { generalDefinitionId: 'zhao-yun', revealed: true }, deputy: { generalDefinitionId: 'hidden', revealed: false } } })
    );
    expect(el.textContent).toContain('Shu');
    const portrait = el.querySelector('app-seat-avatar .half[data-slot="main"] img') as HTMLImageElement;
    expect(portrait.getAttribute('src')).toBe('/card-art/generals/skins/shu/zhaoyun.png');
  });

  it('shows a placeholder for a seat still choosing generals', () => {
    const el = render(makeSeat({ generals: null }));
    expect(el.textContent).toContain('Choosing Generals');
    expect(el.querySelector('app-seat-avatar')).toBeNull();
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

  it('always has a Judgment slot, with a placeholder while it is empty', () => {
    const area = render(makeSeat()).querySelector('.judgment')!;
    expect(area.getAttribute('aria-label')).toBe('Judgment Area');
    expect(area.querySelectorAll('.slot')).toHaveLength(1);
    expect(area.querySelector('.slot')!.classList).toContain('empty');
    expect(area.querySelector('.slot')!.getAttribute('title')).toBe('Judgment Area (empty)');
  });

  it('shows each card in the Judgment slot, small and face up, oldest first, with its Info', () => {
    const el = render(makeSeat(), {
      judgment: [
        { instanceId: 'j1', definitionId: 'capture', suit: 'spade', rank: 6 },
        { instanceId: 'j2', definitionId: 'lightning', suit: 'spade', rank: 1 },
      ],
    });
    const slots = [...el.querySelectorAll('.judgment .slot')] as HTMLElement[];
    expect(slots).toHaveLength(2);
    expect(slots.some((x) => x.classList.contains('empty'))).toBe(false);
    expect(slots[0].querySelector('app-card-art img')!.classList).toContain('small');
    expect(slots.map((x) => x.querySelector('button.slot-card')!.getAttribute('aria-label'))).toEqual(['Info: Capture', 'Info: Lightning']);
  });

  it('still shows the Judgment slot for an eliminated seat', () => {
    expect(render(makeSeat({ eliminated: true })).querySelector('.judgment .slot')).not.toBeNull();
  });

  it('shows one HP icon per HP, icon 1 up to the seat’s current HP, next to its HP text', () => {
    const imgs = Array.from(render(makeSeat({ combinedHp: 3 })).querySelectorAll('.stats img.hp-icon')) as HTMLImageElement[];
    expect(imgs.map((i) => i.getAttribute('src'))).toEqual(['/card-art/misc/hp/1.png', '/card-art/misc/hp/2.png', '/card-art/misc/hp/3.png']);
    expect(imgs.every((i) => i.getAttribute('alt') === '')).toBe(true);
  });

  it('shows no HP icon for a dying seat', () => {
    expect(render(makeSeat({ combinedHp: 0 })).querySelector('img.hp-icon')).toBeNull();
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
    expect(el.querySelector('app-seat-avatar .frame')).not.toBeNull();
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
    expect(info.querySelector('app-playing-card .card.large .name')).toBeNull();
    expect(info.textContent).toContain('Range 3');
    document.querySelector('.cdk-overlay-container')!.replaceChildren();
  });

  it('colours the border after the seat’s force, and yellow while it is hidden', () => {
    for (const kingdom of ['Wei', 'Shu', 'Wu', 'Qun'] as const) {
      expect(render({ ...makeSeat(), kingdom }).querySelector('.tile')!.getAttribute('data-force')).toBe(kingdom);
    }
    expect(render({ ...makeSeat(), kingdom: 'hidden' }).querySelector('.tile')!.getAttribute('data-force')).toBe('none');
  });

  it('shows an Ambitionist as such, in its own (purple) force', () => {
    const el = render({ ...makeSeat(), kingdom: 'Wei', allegiance: 'ambitionist' });
    expect(el.querySelector('.tile')!.getAttribute('data-force')).toBe('Ambitionist');
    expect(el.querySelector('.kingdom')!.textContent!.trim()).toBe('Ambitionist');
  });

  it('overlays the Ambitionist icon on an Ambitionist seat only', () => {
    const icon = render({ ...makeSeat(), kingdom: 'Wei', allegiance: 'ambitionist' }).querySelector('img.ambitionist-icon') as HTMLImageElement;
    expect(icon.getAttribute('src')).toBe('/card-art/generals/ambitionist_icon.png');
    expect(icon.getAttribute('alt')).toBe('Ambitionist');
    expect(render({ ...makeSeat(), kingdom: 'Wei', allegiance: 'kingdom' }).querySelector('.ambitionist-icon')).toBeNull();
    expect(render({ ...makeSeat(), kingdom: 'Wei' }).querySelector('.ambitionist-icon')).toBeNull();
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

  const renderWith = (inputs: Record<string, unknown>) => {
    const fixture = TestBed.createComponent(SeatTile);
    fixture.componentRef.setInput('seat', makeSeat());
    fixture.componentRef.setInput('name', 'Seat 1');
    fixture.componentRef.setInput('handCount', 4);
    for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  it('renders the callout text', () => {
    const el = renderWith({ cue: { involved: true, callout: { text: { text: 'Help!' }, tone: 'red' } } });
    expect(el.querySelector('.callout')?.textContent).toContain('Help!');
    expect(el.querySelector('.callout')?.classList).toContain('red');
  });

  it('adds the hit class for a hit cue and floats its text', () => {
    const el = renderWith({ cue: { involved: true, impact: 'hit', floatText: '−1' } });
    expect(el.querySelector('.tile')!.classList).toContain('hit');
    expect(el.querySelector('.float')?.textContent).toContain('−1');
  });

  it('adds the heal and flip classes and dims a seat that is not involved', () => {
    expect(renderWith({ cue: { involved: true, impact: 'heal', floatText: '+1' } }).querySelector('.tile')!.classList).toContain('heal');
    expect(renderWith({ cue: { involved: true, reveal: true } }).querySelector('.generals')!.classList).toContain('flip');
    expect(renderWith({ dimmed: true }).querySelector('.tile')!.classList).toContain('dimmed');
    expect(renderWith({}).querySelector('.tile')!.classList).not.toContain('dimmed');
  });

  it('shows the viewer seat its callout and float', () => {
    const el = renderWith({ isViewer: true, cue: { involved: true, impact: 'hit', floatText: '−1', callout: { text: { text: 'No Dodge' }, tone: 'pass' } } });
    expect(el.querySelector('.tile.viewer .callout')?.textContent).toContain('No Dodge');
    expect(el.querySelector('.tile.viewer .float')?.textContent).toContain('−1');
  });
});
