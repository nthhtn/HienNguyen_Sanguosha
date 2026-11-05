import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { GameService } from '../../game.service';
import { PlaybackSpeed } from '../../playback-speed.service';
import { DevIndex } from '../dev-index';
import { ANIMATIONS } from './animations';
import { AnimationLabPage } from './animation-lab-page';

const buttonOf = (el: HTMLElement, rowId: string) => el.querySelector(`[data-animation="${rowId}"] button.play`) as HTMLButtonElement;

describe('animation lab page', () => {
  let game: GameService;

  beforeEach(async () => {
    jest.useFakeTimers();
    await TestBed.configureTestingModule({
      imports: [AnimationLabPage, DevIndex],
      providers: [provideRouter([]), { provide: ActivatedRoute, useValue: { paramMap: new BehaviorSubject(convertToParamMap({})) } }],
    }).compileComponents();
    TestBed.inject(PlaybackSpeed).speed.set('instant');
    game = TestBed.inject(GameService);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  function open() {
    const fixture = TestBed.createComponent(AnimationLabPage);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('shows the board and a Play button for every animation', () => {
    const { el } = open();
    expect(el.querySelector('app-game-board')).not.toBeNull();
    for (const a of ANIMATIONS) expect(buttonOf(el, a.id)).not.toBeNull();
  });

  it('Play appends the animation’s events to the table without starting a new game', () => {
    const { fixture, el } = open();
    const base = game.state()!;
    const number = game.gameNumber();
    buttonOf(el, 'beat-damage').click();
    fixture.detectChanges();
    expect(game.state()!.log.length).toBeGreaterThan(base.log.length);
    expect(game.state()!.log[game.state()!.log.length - 1].kind).toBe('DamageDealtEvent');
    expect(game.gameNumber()).toBe(number);
  });

  it('playing twice gives the same table both times', () => {
    const { fixture, el } = open();
    buttonOf(el, 'beat-heal').click();
    fixture.detectChanges();
    const first = JSON.stringify(game.state());
    buttonOf(el, 'beat-heal').click();
    fixture.detectChanges();
    expect(JSON.stringify(game.state())).toEqual(first);
  });

  it('no bot moves after a Play', () => {
    const { fixture, el } = open();
    buttonOf(el, 'beat-dying').click();
    fixture.detectChanges();
    const played = game.state()!;
    jest.runAllTimers();
    fixture.detectChanges();
    expect(game.state()).toBe(played);
    expect(game.botThinkingSeatId()).toBeNull();
  });

  it('New Table puts the clean table back', () => {
    const { fixture, el } = open();
    const base = JSON.stringify(game.state());
    buttonOf(el, 'beat-damage').click();
    fixture.detectChanges();
    (Array.from(el.querySelectorAll('button')).find((b) => b.textContent!.includes('New Table')) as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(JSON.stringify(game.state())).toEqual(base);
  });

  it('Victory Reveal shows the Game Over screen, and Replay recreates it', () => {
    const { fixture, el } = open();
    (el.querySelector('button.reveal') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelector('app-game-board')).toBeNull();
    const first = el.querySelector('app-game-over');
    expect(first).not.toBeNull();
    (Array.from(el.querySelectorAll('button')).find((b) => b.textContent!.includes('Replay')) as HTMLButtonElement).click();
    fixture.detectChanges();
    const second = el.querySelector('app-game-over');
    expect(second).not.toBeNull();
    expect(second).not.toBe(first);
  });

  const dialogButton = (el: HTMLElement, id: string) => el.querySelector(`button[data-dialog="${id}"]`) as HTMLButtonElement;

  it('Judgment opens in the lab with the panel still there, and New Table comes back to the clean table', () => {
    const { fixture, el } = open();
    const clean = JSON.stringify(game.state());
    dialogButton(el, 'choice-judgment').click();
    fixture.detectChanges();
    expect(game.state()!.judgmentView).toBeDefined();
    expect(el.querySelector('app-game-board')).not.toBeNull();
    expect(el.querySelector('aside.panel')).not.toBeNull();
    expect(dialogButton(el, 'choice-judgment').classList).toContain('on');
    (el.querySelector('button.new-table') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(JSON.stringify(game.state())).toEqual(clean);
    expect(dialogButton(el, 'choice-judgment').classList).not.toContain('on');
  });

  it('Compete opens in the lab, and a Play after it is back on the clean table with no bot moving', () => {
    const { fixture, el } = open();
    dialogButton(el, 'choice-compete').click();
    fixture.detectChanges();
    expect(game.state()!.pendingSelection?.of).toBe('cards');
    buttonOf(el, 'beat-damage').click();
    fixture.detectChanges();
    expect(game.state()!.pendingSelection).toBeUndefined();
    const played = game.state()!;
    jest.runAllTimers();
    expect(game.state()).toBe(played);
  });

  it('names the Judgment dialog without the word Popup', () => {
    const { el } = open();
    expect(dialogButton(el, 'choice-judgment').textContent).toContain('Judgment');
    expect(dialogButton(el, 'choice-judgment').textContent).not.toContain('Popup');
  });

  it('leaving the page stops the bots', () => {
    const { fixture } = open();
    fixture.destroy();
    jest.runAllTimers();
    expect(game.botThinkingSeatId()).toBeNull();
  });

  it('the preview index links to the lab', () => {
    const fixture = TestBed.createComponent(DevIndex);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('a[href="/preview/animations"]')).not.toBeNull();
  });
});
