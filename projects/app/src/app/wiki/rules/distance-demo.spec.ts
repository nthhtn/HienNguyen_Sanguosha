import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { cardDisplayData, wikiDistanceTable, wikiDistanceWeapons } from 'content';
import { I18n } from '../../i18n/i18n.service';
import { DistanceDemo } from './distance-demo';
import { DISTANCE_EXAMPLE } from './distance-example';

const text = (el: Element) => el.textContent!.replace(/\s+/g, ' ').trim();

function mount() {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(DistanceDemo);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const seatButtons = () => [...el.querySelectorAll<HTMLButtonElement>('.ring button.spot')];
  const buttonOf = (n: number) => seatButtons().find((b) => b.getAttribute('data-seat') === String(n))!;
  // Material checkboxes: the native input sits inside the host that carries the data attribute.
  const outBox = (n: number) => el.querySelector<HTMLInputElement>(`mat-checkbox[data-out="${n}"] input`)!;
  const readout = () => text(el.querySelector('.readout')!);
  const badges = () => [...el.querySelectorAll('.dbadge')].map(text);
  const tick = (box: HTMLInputElement, checked = true) => {
    if (box.checked !== checked) box.click();
    fixture.detectChanges();
  };
  const weaponSelect = () => el.querySelector<HTMLSelectElement>('select[data-weapon]')!;
  const pickWeapon = (id: string) => {
    weaponSelect().value = id;
    weaponSelect().dispatchEvent(new Event('change'));
    fixture.detectChanges();
  };
  const mountBox = (which: 'minus' | 'plus') => el.querySelector<HTMLInputElement>(`mat-checkbox[data-mount="${which}"] input`)!;
  const click = (n: number) => {
    buttonOf(n).click();
    fixture.detectChanges();
  };
  return { fixture, el, buttonOf, seatButtons, outBox, readout, badges, tick, click, weaponSelect, pickWeapon, mountBox };
}

// The table the demo starts with, as the helper takes it.
const startSeats = (out: number[] = [2]) => DISTANCE_EXAMPLE.seats.map((seat) => ({ n: seat.n, out: out.includes(seat.n), ...(seat.mount ? { mount: seat.mount } : {}) }));
type Table = { out?: number[]; mounts?: Record<number, string>; weapon?: string };
// What the game says for a table the reader has set up; the initial table is Seat 2 out and Shadow Runner on Seat 6.
const oracle = ({ out = [2], mounts = { 6: 'shadow-runner' }, weapon }: Table = {}) =>
  wikiDistanceTable({ seats: DISTANCE_EXAMPLE.seats.map((seat) => ({ n: seat.n, out: out.includes(seat.n), ...(mounts[seat.n] ? { mount: mounts[seat.n] } : {}) })), ...(weapon ? { weapon } : {}) });
const distanceOf = (out: number[], n: number) => wikiDistanceTable({ seats: startSeats(out) }).seats.find((s) => s.n === n)!.distance;

afterEach(() => localStorage.clear());

describe('DistanceDemo', () => {
  it('starts as the example table: Seat 2 out, Seat 3 selected, the numbers from the game', () => {
    const { el, buttonOf, badges } = mount();
    expect(badges()).toEqual(DISTANCE_EXAMPLE.seats.filter((seat) => seat.distance !== undefined).map((seat) => String(seat.distance)));
    expect(el.querySelectorAll('.ring .seat.out').length).toBe(1);
    expect(buttonOf(3).getAttribute('aria-pressed')).toBe('true');
    expect(buttonOf(4).getAttribute('aria-pressed')).toBe('false');
  });

  it('clicking a seat selects it, and the readout names it with the number the game gives', () => {
    const { readout, click, buttonOf } = mount();
    click(5);
    expect(buttonOf(5).getAttribute('aria-pressed')).toBe('true');
    expect(buttonOf(3).getAttribute('aria-pressed')).toBe('false');
    expect(readout()).toMatch(/^Seat 5:/);
    expect(readout()).toContain(`distance ${distanceOf([2], 5)}`);
  });

  it('knocking a seat out removes its badge and brings its neighbours closer, as the game says', () => {
    const { badges, outBox, tick, el } = mount();
    const before = badges().length;
    tick(outBox(3));
    expect(badges().length).toBe(before - 1);
    expect(el.querySelectorAll('.ring .seat.out').length).toBe(2);
    expect([...el.querySelectorAll('.ring .spot')].find((s) => text(s).includes('Seat 4'))!.querySelector('.dbadge')!.textContent!.trim()).toBe(String(distanceOf([2, 3], 4)));
  });

  it('knocking out the selected seat moves the selection to the next living seat', () => {
    const { outBox, tick, buttonOf, readout } = mount();
    tick(outBox(3));
    expect(buttonOf(3).getAttribute('aria-pressed')).toBe('false');
    expect(buttonOf(4).getAttribute('aria-pressed')).toBe('true');
    expect(readout()).toMatch(/^Seat 4:/);
  });

  it('with every other seat out, the readout says so and no seat can be selected', () => {
    const { outBox, tick, readout, seatButtons, el } = mount();
    for (const n of [3, 4, 5, 6]) tick(outBox(n));
    expect(readout()).toBe('Every other seat is out of play.');
    expect(seatButtons().every((b) => b.disabled)).toBe(true);
    expect(el.querySelectorAll('.dbadge').length).toBe(0);
    expect(el.querySelectorAll('button[aria-pressed="true"]').length).toBe(0);
  });

  it('a seat that returns is selected when nothing was', () => {
    const { outBox, tick, buttonOf } = mount();
    for (const n of [3, 4, 5, 6]) tick(outBox(n));
    tick(outBox(4), false);
    expect(buttonOf(4).getAttribute('aria-pressed')).toBe('true');
  });

  it('a seat that is out cannot be selected', () => {
    const { buttonOf, click, readout } = mount();
    expect(buttonOf(2).disabled).toBe(true);
    click(2);
    expect(readout()).toMatch(/^Seat 3:/);
  });

  it('names each badge by seat and distance, and says whether a Slash reaches', () => {
    const { buttonOf } = mount();
    expect(buttonOf(3).getAttribute('aria-label')).toBe('Seat 3, Distance 1, in range');
    expect(buttonOf(4).getAttribute('aria-label')).toBe('Seat 4, Distance 2, out of range');
  });

  it('a seat button is named once, by seat, distance and range, and says when the seat is out', () => {
    const { buttonOf, el } = mount();
    const badge = el.querySelector('.ring .spot[data-seat="3"] .dbadge')!;
    expect(buttonOf(3).getAttribute('aria-label')).toBe('Seat 3, Distance 1, in range');
    expect(badge.getAttribute('aria-hidden')).toBe('true');
    expect(buttonOf(2).getAttribute('aria-label')).toBe('Seat 2, out of play');
  });

  it('a seat button holds only phrasing content, as HTML requires', () => {
    const { el } = mount();
    expect(el.querySelectorAll('button.spot div').length).toBe(0);
  });

  it('the readout is read as a whole and gives the steps without a plural', () => {
    const { el, readout } = mount();
    expect(el.querySelector('.readout')!.getAttribute('aria-atomic')).toBe('true');
    expect(readout()).toMatch(/^Seat 3: distance 1\. Steps round the table: 1\./);
  });

  it('the readout shows at a glance whether a Slash reaches the selected seat', () => {
    const { el, click, fixture } = mount();
    const panel = () => el.querySelector('.readout')!;
    expect(panel().classList.contains('reach')).toBe(true);
    click(4);
    fixture.detectChanges();
    expect(panel().classList.contains('reach')).toBe(false);
  });

  it('seats are reachable with the keyboard', () => {
    const { buttonOf } = mount();
    expect(buttonOf(3).tabIndex).toBeGreaterThanOrEqual(0);
    expect(buttonOf(3).type).toBe('button');
  });

  it('the readout, the labels and the badge names follow a language switch', async () => {
    const { fixture, el, readout, buttonOf } = mount();
    await TestBed.inject(I18n).setLocale('vi');
    fixture.detectChanges();
    expect(readout()).toMatch(/^Người chơi 3:/);
    expect(buttonOf(3).getAttribute('aria-label')).toBe('Người chơi 3, Khoảng cách 1, trong tầm');
    expect(buttonOf(2).getAttribute('aria-label')).toBe('Người chơi 2, đã bị loại');
    expect([...el.querySelectorAll('fieldset legend')].map(text)).toEqual(['Tầm tấn công của bạn', 'Tọa kỵ', 'Người chơi đã bị loại']);
  });

  it('a Weapon changes the range and which seats a Slash reaches, as the game says', () => {
    const { el, readout, pickWeapon } = mount();
    pickWeapon('gender-swords');
    const said = oracle({ weapon: 'gender-swords' });
    expect(readout()).toContain(`Attack range ${said.range}`);
    const reach = [...el.querySelectorAll('.ring .spot')].filter((s) => s.querySelector('.dbadge')).map((s) => s.querySelector('.dbadge')!.classList.contains('reach'));
    expect(reach).toEqual(said.seats.filter((s) => s.distance !== null).map((s) => s.canReach));
    expect(reach).toContain(true);
  });

  it('Shadow Runner on the selected seat lengthens it, as the game says', () => {
    const { fixture, el, readout, mountBox, tick } = mount();
    tick(mountBox('plus'));
    fixture.detectChanges();
    expect(el.querySelector('.ring .spot[data-seat="3"] .mount')).not.toBeNull();
    expect(readout()).toContain(`distance ${oracle({ mounts: { 3: 'shadow-runner', 6: 'shadow-runner' } }).seats.find((s) => s.n === 3)!.distance}`);
  });

  it('Red Hare on you shortens the others but never below 1, as the game says', () => {
    const { fixture, badges, mountBox, tick } = mount();
    tick(mountBox('minus'));
    fixture.detectChanges();
    expect(badges()).toEqual(oracle({ mounts: { 1: 'red-hare', 6: 'shadow-runner' } }).seats.filter((s) => s.distance !== null).map((s) => String(s.distance)));
    expect(badges().every((b) => Number(b) >= 1)).toBe(true);
  });

  it('the Shadow Runner box follows the selection', () => {
    const { mountBox, click, fixture } = mount();
    expect(mountBox('plus').checked).toBe(false);
    click(6);
    expect(mountBox('plus').checked).toBe(true);
    click(4);
    fixture.detectChanges();
    expect(mountBox('plus').checked).toBe(false);
  });

  it('a Mount survives its seat being knocked out and brought back', () => {
    const { el, outBox, tick, badges } = mount();
    const before = badges();
    tick(outBox(6));
    expect(el.querySelector('.ring .spot[data-seat="6"] .mount')).toBeNull();
    tick(outBox(6), false);
    expect(el.querySelector('.ring .spot[data-seat="6"] .mount')).not.toBeNull();
    expect(badges()).toEqual(before);
  });

  it('the Shadow Runner box is disabled when no seat is selected', () => {
    const { outBox, tick, mountBox } = mount();
    for (const n of [3, 4, 5, 6]) tick(outBox(n));
    expect(mountBox('plus').disabled).toBe(true);
  });

  it('the weapon options are named by the game, with its ranges, and follow the language', async () => {
    const { fixture, weaponSelect } = mount();
    const options = () => [...weaponSelect().options].map(text);
    const weapons = wikiDistanceWeapons();
    expect(options()).toEqual(['No Weapon (range 1)', ...weapons.map((w) => `${cardDisplayData(w.id, 'en')!.name} (range ${w.range})`)]);
    await TestBed.inject(I18n).setLocale('vi');
    fixture.detectChanges();
    expect(options()).toEqual(['Không có Vũ khí (tầm 1)', ...weapons.map((w) => `${cardDisplayData(w.id, 'vi')!.name} (tầm ${w.range})`)]);
  });
});

describe('DistanceDemo and the rules', () => {
  it('holds no rule: it reads every distance, range and reach from the game', () => {
    const source = readFileSync(join(__dirname, 'distance-demo.ts'), 'utf8');
    expect(source).not.toMatch(/\b(seatDistance|getSeatDistance|attackRange|shaTargetIds)\b/);
    expect(source).toMatch(/\bwikiDistanceTable\b/);
  });
});
