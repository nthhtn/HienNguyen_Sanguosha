import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { wikiDistanceTable } from 'content';
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
  const outBox = (n: number) => el.querySelector<HTMLInputElement>(`input[data-out="${n}"]`)!;
  const readout = () => text(el.querySelector('.readout')!);
  const badges = () => [...el.querySelectorAll('.dbadge')].map(text);
  const tick = (box: HTMLInputElement, checked = true) => {
    box.checked = checked;
    box.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  };
  const click = (n: number) => {
    buttonOf(n).click();
    fixture.detectChanges();
  };
  return { fixture, el, buttonOf, seatButtons, outBox, readout, badges, tick, click };
}

// The table the demo starts with, as the helper takes it.
const startSeats = (out: number[] = [2]) => DISTANCE_EXAMPLE.seats.map((seat) => ({ n: seat.n, out: out.includes(seat.n), ...(seat.mount ? { mount: seat.mount } : {}) }));
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
    const { el } = mount();
    const labels = [...el.querySelectorAll('.dbadge')].map((b) => b.getAttribute('aria-label'));
    expect(labels[0]).toBe('Seat 3, Distance 1, in range');
    expect(labels[1]).toBe('Seat 4, Distance 2, out of range');
  });

  it('seats are reachable with the keyboard', () => {
    const { buttonOf } = mount();
    expect(buttonOf(3).tabIndex).toBeGreaterThanOrEqual(0);
    expect(buttonOf(3).type).toBe('button');
  });

  it('the readout, the labels and the badge names follow a language switch', async () => {
    const { fixture, el, readout } = mount();
    await TestBed.inject(I18n).setLocale('vi');
    fixture.detectChanges();
    expect(readout()).toMatch(/^Người chơi 3:/);
    expect([...el.querySelectorAll('.dbadge')][0].getAttribute('aria-label')).toBe('Người chơi 3, Khoảng cách 1, trong tầm');
    expect(text(el.querySelector('fieldset legend')!)).toBe('Người chơi đã bị loại');
  });
});
