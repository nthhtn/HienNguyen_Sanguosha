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
});
