import { TestBed } from '@angular/core/testing';
import { GameStartCountdown } from './game-start-countdown';

describe('GameStartCountdown', () => {
  beforeEach(() => jest.useFakeTimers({ now: 1_000_000 }));
  afterEach(() => jest.useRealTimers());

  const render = (startsAt: number) => {
    const fixture = TestBed.createComponent(GameStartCountdown);
    fixture.componentRef.setInput('startsAt', startsAt);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  };

  it('shows the whole seconds left and counts down', () => {
    const { fixture, el } = render(1_003_000);
    expect(el.textContent).toContain('Game starts in 3');
    jest.advanceTimersByTime(1_100);
    fixture.detectChanges();
    expect(el.textContent).toContain('Game starts in 2');
  });

  it('renders nothing once the time is up', () => {
    const { fixture, el } = render(1_001_000);
    jest.advanceTimersByTime(1_200);
    fixture.detectChanges();
    expect(el.textContent!.trim()).toBe('');
  });

  it('renders nothing for a start time already past', () => {
    expect(render(999_000).el.textContent!.trim()).toBe('');
  });
});
