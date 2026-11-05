import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { GameService } from '../game.service';
import { PlaybackSpeed } from '../playback-speed.service';
import { DevIndex } from './dev-index';
import { DEV_PREVIEW as DEV_PREVIEW_IN_PRODUCTION, DEV_ROUTES as DEV_ROUTES_IN_PRODUCTION } from './dev-routes.prod';
import { DEV_PREVIEW } from './dev-routes';
import { DevScenarioPage } from './dev-scenario-page';
import { SCENARIOS } from './scenarios';

const params = new BehaviorSubject(convertToParamMap({}));

function openPage(scenarioId: string) {
  params.next(convertToParamMap({ scenarioId }));
  const fixture = TestBed.createComponent(DevScenarioPage);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

describe('dev pages', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DevIndex, DevScenarioPage],
      providers: [provideRouter([]), { provide: ActivatedRoute, useValue: { paramMap: params } }],
    }).compileComponents();
    TestBed.inject(PlaybackSpeed).speed.set('instant');
    TestBed.inject(GameService).botDelayMs = 0;
  });

  it('the index lists every group heading and a link per scenario', () => {
    const fixture = TestBed.createComponent(DevIndex);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const headings = Array.from(el.querySelectorAll('h2')).map((h) => h.querySelector('span:not(.count)')!.textContent!.trim());
    expect(headings).toEqual(['Play Board', 'Response Windows', 'Choice Prompts', 'Other Screens']);
    for (const s of SCENARIOS) expect(el.querySelector(`a[href="/preview/${s.id}"]`)).not.toBeNull();
  });

  it('opens a board scenario on the real board, waiting on you', () => {
    const { el } = openPage('respond-sha');
    const game = TestBed.inject(GameService);
    expect(el.querySelector('app-game-board')).not.toBeNull();
    expect(game.state()?.pendingResponse?.respondingSeatId).toBe('seat-0');
  });

  it('Reset loads the same state again as a new game', () => {
    const { fixture, el } = openPage('respond-sha');
    const game = TestBed.inject(GameService);
    const first = JSON.stringify(game.state());
    const number = game.gameNumber();
    (Array.from(el.querySelectorAll('button')).find((b) => b.textContent!.includes('Reset')) as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(JSON.stringify(game.state())).toEqual(first);
    expect(game.gameNumber()).toBe(number + 1);
  });

  it('shows "Scenario not found" with a link back for an unknown id', () => {
    const { el } = openPage('no-such-scenario');
    expect(el.textContent).toContain('Scenario not found');
    expect(el.querySelector('a[href="/preview"]')).not.toBeNull();
  });

  it('opens a screen scenario with the real screen', async () => {
    const { fixture, el } = openPage('over-four');
    await new Promise((resolve) => setTimeout(resolve, 50));
    fixture.detectChanges();
    expect(el.querySelector('app-game-over')).not.toBeNull();
  });

  it('leaving the page stops the bot timer of a scenario with a bot due', () => {
    jest.useFakeTimers();
    try {
      const { fixture } = openPage('play-other-turn');
      const game = TestBed.inject(GameService);
      const before = game.state();
      expect(game.botThinkingSeatId()).toBe('seat-1');
      fixture.destroy();
      jest.runOnlyPendingTimers();
      expect(game.botThinkingSeatId()).toBeNull();
      expect(game.state()).toBe(before);
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it('dev builds show Preview in the bar and production builds do not (the production file replaces the dev one)', () => {
    expect(DEV_PREVIEW).toBe(true);
    expect(DEV_PREVIEW_IN_PRODUCTION).toBe(false);
    expect(DEV_ROUTES_IN_PRODUCTION).toEqual([]);
  });
});
