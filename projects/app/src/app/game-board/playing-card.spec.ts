import { TestBed } from '@angular/core/testing';
import { CardInstance } from 'engine';
import { PlayingCard } from './playing-card';

function render(card: CardInstance, size: 'normal' | 'small' = 'normal') {
  const fixture = TestBed.createComponent(PlayingCard);
  fixture.componentRef.setInput('card', card);
  fixture.componentRef.setInput('size', size);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('PlayingCard', () => {
  it('shows the card’s name and its suit and number', () => {
    const el = render({ instanceId: 'c1', definitionId: 'sha', suit: 'spade', rank: 7 });
    expect(el.querySelector('.name')!.textContent).toBe('Sha');
    expect(el.querySelector('.face')!.textContent).toBe('7 ♠');
    expect(el.querySelector('.face')!.classList).not.toContain('red');
  });

  it('uses the card data’s name and marks hearts and diamonds red', () => {
    const el = render({ instanceId: 'c2', definitionId: 'wuxie', suit: 'diamond', rank: 12 });
    expect(el.querySelector('.name')!.textContent).toBe('Wuxie');
    expect(el.querySelector('.face')!.textContent).toBe('Q ♦');
    expect(el.querySelector('.face')!.classList).toContain('red');
  });

  it('never shows the rules text', () => {
    const el = render({ instanceId: 'c3', definitionId: 'duel', suit: 'spade', rank: 1 }, 'small');
    expect(el.textContent).not.toContain('challenges');
    expect(el.textContent!.trim()).toContain('Duel');
  });
});
