import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TutorialAnchor } from './tutorial-anchor';

@Component({
  imports: [TutorialAnchor],
  template: `<button class="on" [appTutorialAnchor]="id()">Go</button><button class="plain">Stay</button>`,
})
class Host {
  readonly id = signal<string | null>('end-phase');
}

describe('TutorialAnchor', () => {
  const render = () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  };

  it('puts the id on the element as data-tutorial', () => {
    const { el } = render();
    expect(el.querySelector('.on')!.getAttribute('data-tutorial')).toBe('end-phase');
  });

  it('follows the input when it changes', () => {
    const { fixture, el } = render();
    fixture.componentInstance.id.set('hand-card:sha');
    fixture.detectChanges();
    expect(el.querySelector('.on')!.getAttribute('data-tutorial')).toBe('hand-card:sha');
  });

  it('leaves no attribute when the id is null, so an element can be anchored only some of the time', () => {
    const { fixture, el } = render();
    fixture.componentInstance.id.set(null);
    fixture.detectChanges();
    expect(el.querySelector('.on')!.hasAttribute('data-tutorial')).toBe(false);
  });

  it('changes nothing else: no class, role, style or other attribute appears', () => {
    const { el } = render();
    const on = el.querySelector('.on')!;
    const plain = el.querySelector('.plain')!;
    const names = (e: Element) => e.getAttributeNames().filter((n) => !n.startsWith('_ng') && n !== 'data-tutorial' && n !== 'class').sort();
    expect(names(on)).toEqual(names(plain));
    expect(on.className).toBe('on');
  });
});
