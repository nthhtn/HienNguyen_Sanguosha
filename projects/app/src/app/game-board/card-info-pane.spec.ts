import { TestBed } from '@angular/core/testing';
import { CardInstance } from 'engine';
import { CardInfoPane } from './card-info-pane';

const sha: CardInstance = { instanceId: 'c1', definitionId: 'sha', suit: 'spade', rank: 7 };

function render(over: { showName?: boolean } = {}) {
  const fixture = TestBed.createComponent(CardInfoPane);
  fixture.componentRef.setInput('card', sha);
  if (over.showName !== undefined) fixture.componentRef.setInput('showName', over.showName);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('CardInfoPane', () => {
  it('shows the card name, its large art, its kind and its rules text, as the Info popup does', () => {
    const el = render();
    expect(el.querySelector('.name')!.textContent).toContain('Slash');
    expect(el.querySelector('app-playing-card')).not.toBeNull();
    expect(el.querySelector('.kind')!.textContent).toContain('Basic');
    expect(el.querySelector('.text')!.textContent!.length).toBeGreaterThan(0);
  });

  it('leaves the name out when its host already has it as a title', () => {
    expect(render({ showName: false }).querySelector('.name')).toBeNull();
  });

  it('puts the name with the info, on the right of the card, in the compact layout of the board panel', () => {
    const fixture = TestBed.createComponent(CardInfoPane);
    fixture.componentRef.setInput('card', sha);
    fixture.componentRef.setInput('compact', true);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.classList.contains('compact')).toBe(true);
    expect(el.querySelector('.content > .name')).toBeNull();
    expect(el.querySelector('.details .name')!.textContent).toContain('Slash');
    const children = [...el.querySelector('.content')!.children];
    expect(children[0].tagName.toLowerCase()).toBe('app-playing-card');
    expect(children[1].classList.contains('details')).toBe(true);
  });

  it('keeps the name above the card and the info when it is not compact', () => {
    const el = render();
    expect(el.querySelector(':scope > .name')).not.toBeNull();
    expect(el.querySelector('.details .name')).toBeNull();
    expect(el.classList.contains('compact')).toBe(false);
  });

  it('keeps the card on the left and the info on the right, never wrapping, when asked to sit side by side', () => {
    const fixture = TestBed.createComponent(CardInfoPane);
    fixture.componentRef.setInput('card', sha);
    fixture.componentRef.setInput('sideBySide', true);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.classList.contains('side-by-side')).toBe(true);
    // The name stays above, unlike the compact layout.
    expect(el.querySelector(':scope > .name')).not.toBeNull();
    const children = [...el.querySelector('.content')!.children];
    expect(children[0].tagName.toLowerCase()).toBe('app-playing-card');
    expect(children[1].classList.contains('details')).toBe(true);
  });
});
