import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DecisionTimer } from '../decision-timer.service';
import { DecisionCountdown } from './decision-countdown';

describe('DecisionCountdown', () => {
  const render = (startsInMs: number | null, seconds: number | null = 10) => {
    const startsIn = signal(startsInMs);
    TestBed.configureTestingModule({
      providers: [{ provide: DecisionTimer, useValue: { secondsLeft: signal(seconds), totalSeconds: signal(10), startsInMs: startsIn } }],
    });
    const fixture = TestBed.createComponent(DecisionCountdown);
    fixture.detectChanges();
    return { fixture, startsIn, el: fixture.nativeElement as HTMLElement };
  };

  it('shows the seconds and the bar once nothing is left to wait for', () => {
    const { el } = render(0);
    expect(el.querySelector('.countdown')?.textContent).toContain('10s');
  });

  it('shows nothing while the animation it follows is still playing', () => {
    const { fixture, startsIn, el } = render(1_500);
    expect(el.querySelector('.countdown')).toBeNull();
    startsIn.set(0);
    fixture.detectChanges();
    expect(el.querySelector('.countdown')).not.toBeNull();
  });

  it('shows nothing when no decision is timed', () => {
    expect(render(null, null).el.querySelector('.countdown')).toBeNull();
  });
});
