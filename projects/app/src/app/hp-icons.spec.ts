import { TestBed } from '@angular/core/testing';
import { hpIconUrls } from 'content';
import { HpIcons } from './hp-icons';

function render(inputs: Record<string, unknown>) {
  const fixture = TestBed.createComponent(HpIcons);
  for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
  fixture.detectChanges();
  const imgs = [...(fixture.nativeElement as HTMLElement).querySelectorAll('img')];
  return { imgs, srcs: imgs.map((i) => i.getAttribute('src')), lost: imgs.filter((i) => i.classList.contains('lost')).length, pop: imgs.filter((i) => i.classList.contains('pop')).length };
}

describe('HpIcons', () => {
  it('draws one ramp icon per HP', () => {
    expect(render({ hp: 3 }).srcs).toEqual(hpIconUrls(3));
  });

  it('draws up to eight icons, one colour each', () => {
    expect(render({ hp: 8 }).srcs).toEqual(hpIconUrls(8));
    expect(new Set(hpIconUrls(8)).size).toBe(8);
  });

  it('dims the icons between the HP and the maximum as lost', () => {
    const r = render({ hp: 3, max: 5 });
    expect(r.imgs).toHaveLength(5);
    expect(r.lost).toBe(2);
  });

  it('dims everything at 0 HP, and shows nothing without a maximum', () => {
    expect(render({ hp: 0, max: 4 }).lost).toBe(4);
    expect(render({ hp: 0 }).imgs).toHaveLength(0);
  });

  it('greys and pops the fading icons just below the HP', () => {
    const r = render({ hp: 4, max: 4, fading: 2 });
    expect(r.lost).toBe(2);
    expect(r.pop).toBe(2);
    expect(r.imgs.slice(2).every((i) => i.classList.contains('lost'))).toBe(true);
  });

  it('is decorative and sized by the size input', () => {
    const { imgs } = render({ hp: 1, size: 28 });
    expect(imgs[0].getAttribute('aria-hidden')).toBe('true');
    expect(imgs[0].style.height).toBe('28px');
  });
});
