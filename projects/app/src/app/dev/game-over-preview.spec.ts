import { TestBed } from '@angular/core/testing';
import { GAME_OVER_CASES } from './game-over-fixtures';
import { GameOverPreview } from './game-over-preview';

const text = (el: Element | null) => el!.textContent!.replace(/\s+/g, ' ').trim();

describe('Game Over preview', () => {
  function open() {
    const fixture = TestBed.createComponent(GameOverPreview);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }
  const choose = (fixture: ReturnType<typeof open>['fixture'], el: HTMLElement, key: string) => {
    const select = el.querySelector('select') as HTMLSelectElement;
    select.value = key;
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  };

  it('lists every ending in one switcher and shows the first on the real Game Over screen', () => {
    const { el } = open();
    expect(el.querySelectorAll('select option')).toHaveLength(Object.keys(GAME_OVER_CASES).length);
    expect(el.querySelectorAll('app-game-over')).toHaveLength(1);
  });

  it('switching the ending shows that ending on the same page', () => {
    const { fixture, el } = open();
    const first = text(el.querySelector('app-game-over .headline'));
    choose(fixture, el, 'draw');
    expect(el.querySelectorAll('app-game-over')).toHaveLength(1);
    expect(text(el.querySelector('app-game-over .headline'))).not.toBe(first);
    expect(text(el.querySelector('app-game-over .headline'))).toContain('Draw');
  });

  it('Replay recreates the screen so its reveal plays again', () => {
    const { fixture, el } = open();
    const before = el.querySelector('app-game-over');
    (el.querySelector('button.replay') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelector('app-game-over')).not.toBe(before);
  });
});
