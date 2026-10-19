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
    expect(el.querySelector('.name')!.textContent).toBe('Slash');
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

  it('shows a weapon’s range', () => {
    const card = { instanceId: 'c4', definitionId: 'axe', suit: 'diamond', rank: 5 } as const;
    expect(render(card).querySelector('.stat')!.textContent).toBe('3');
    expect(render(card, 'small').querySelector('.stat')!.textContent).toBe('3');
  });

  it('shows a mount’s distance, only the sign in a narrow slot', () => {
    const offensive = { instanceId: 'c5', definitionId: 'da-yuan', suit: 'spade', rank: 13 } as const;
    expect(render(offensive).querySelector('.stat')!.textContent).toBe('-1');
    expect(render(offensive, 'small').querySelector('.stat')!.textContent).toBe('-1');
    const defensive = { instanceId: 'c6', definitionId: 'shadow-runner', suit: 'club', rank: 5 } as const;
    expect(render(defensive, 'small').querySelector('.stat')!.textContent).toBe('+1');
  });

  it('marks an elemental Sha with its element', () => {
    const fire = render({ instanceId: 'c9', definitionId: 'fire-attack', suit: 'diamond', rank: 4 });
    expect(fire.querySelector('.nature')!.classList).toContain('fire');
    const thunder = render({ instanceId: 'c10', definitionId: 'lightning-attack', suit: 'spade', rank: 5 }, 'small');
    expect(thunder.querySelector('.nature')!.classList).toContain('thunder');
  });

  it('shows no element on a plain Sha', () => {
    expect(render({ instanceId: 'c11', definitionId: 'sha', suit: 'spade', rank: 7 }).querySelector('.nature')).toBeNull();
  });

  it('shows no stat on other cards', () => {
    expect(render({ instanceId: 'c7', definitionId: 'sha', suit: 'spade', rank: 7 }).querySelector('.stat')).toBeNull();
    expect(render({ instanceId: 'c8', definitionId: 'eight-trigrams', suit: 'spade', rank: 2 }).querySelector('.stat')).toBeNull();
  });

  it('can hide the stat badge', () => {
    const fixture = TestBed.createComponent(PlayingCard);
    fixture.componentRef.setInput('card', { instanceId: 'c9', definitionId: 'da-yuan', suit: 'spade', rank: 13 });
    fixture.componentRef.setInput('showStat', false);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.stat')).toBeNull();
  });
});
