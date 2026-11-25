import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { GameBoard } from '../game-board/game-board';
import { GameService } from '../game.service';
import { I18n } from '../i18n/i18n.service';
import { playableGame } from '../scenario-kit/recipe';
import { LESSONS } from './lessons';
import { TutorialOverlay } from './tutorial-overlay';
import { TutorialPage } from './tutorial-page';
import { TUTORIAL_LESSONS, TutorialService } from './tutorial.service';
import { Lesson } from './tutorial-types';

// The real board needs the whole game around it; the page only has to put it on screen.
@Component({ selector: 'app-game-board', template: '<div class="board-stub"></div>' })
class BoardStub {}
@Component({ selector: 'app-tutorial-overlay', template: '<div class="overlay-stub"></div>' })
class OverlayStub {}

// Two short lessons of one Next step each, so a spec can finish one without playing a game.
const shortLesson = (id: Lesson['id']): Lesson => ({
  id,
  titleKey: 'discard.pile',
  summaryKey: 'history.title',
  seatCount: 2,
  build: (registry) => playableGame(registry, 7, 2),
  steps: [{ id: 'only', textKey: 'discard.pile', completes: { kind: 'next' } }],
});

describe('TutorialPage', () => {
  function create(lessons?: Lesson[]) {
    TestBed.configureTestingModule({
      imports: [TutorialPage],
      providers: [provideRouter([]), ...(lessons ? [{ provide: TUTORIAL_LESSONS, useValue: lessons }] : [])],
    });
    TestBed.overrideComponent(TutorialPage, { remove: { imports: [GameBoard, TutorialOverlay] }, add: { imports: [BoardStub, OverlayStub] } });
    const fixture = TestBed.createComponent(TutorialPage);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement, service: TestBed.inject(TutorialService), game: TestBed.inject(GameService) };
  }
  const text = (el: Element | null) => el?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

  beforeEach(() => localStorage.clear());
  afterEach(() => {
    localStorage.clear();
    document.querySelector('.cdk-overlay-container')?.replaceChildren();
  });

  describe('the list', () => {
    it('shows the five lessons in order, each with its summary and a Start Lesson button', () => {
      const { el } = create();
      const items = [...el.querySelectorAll('.lesson')];
      expect(items.map((i) => i.getAttribute('data-lesson'))).toEqual(LESSONS.map((l) => l.id));
      expect(items).toHaveLength(5);
      expect(text(items[0].querySelector('h3'))).toBe('Your Generals');
      expect(text(items[0].querySelector('.summary'))).toContain('Main General and Deputy General');
      expect(items.map((i) => text(i.querySelector('button.start')))).toEqual(Array(5).fill('Start Lesson'));
      expect(text(el.querySelector('h2'))).toBe('Tutorial');
    });

    it('marks the lessons already completed as Done, and only those', () => {
      localStorage.setItem('tutorial.completed', JSON.stringify(['turn', 'damage']));
      const { el } = create();
      const done = [...el.querySelectorAll('.lesson')].filter((i) => i.querySelector('.done')).map((i) => i.getAttribute('data-lesson'));
      expect(done).toEqual(['turn', 'damage']);
      expect(text(el.querySelector('.lesson[data-lesson="turn"] .done'))).toContain('Done');
    });

    it('shows no board and no spotlight until a lesson starts', () => {
      const { el } = create();
      expect(el.querySelector('app-game-board')).toBeNull();
      expect(el.querySelector('app-tutorial-overlay')).toBeNull();
    });

    it('reads in Vietnamese', async () => {
      const { el, fixture } = create();
      await TestBed.inject(I18n).setLocale('vi');
      fixture.detectChanges();
      expect(text(el.querySelector('.lesson button.start'))).toBe('Bắt đầu bài học');
      expect(text(el.querySelector('.lesson[data-lesson="generals"] h3'))).toBe('Tướng của bạn');
    });
  });

  describe('starting a lesson', () => {
    it('starts it at once when no game is in progress, and shows the board with the spotlight', () => {
      const { fixture, el, service } = create();
      (el.querySelector('.lesson[data-lesson="turn"] button.start') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(service.lesson()?.id).toBe('turn');
      expect(el.querySelector('app-game-board')).not.toBeNull();
      expect(el.querySelector('app-tutorial-overlay')).not.toBeNull();
      expect(el.querySelector('.lesson')).toBeNull();
    });

    describe('with a game in progress', () => {
      function createWithGame() {
        const made = create();
        made.game.startGame(2, 1, 'vs-bots');
        return made;
      }
      const click = (el: HTMLElement, selector: string) => (el.querySelector(selector) as HTMLButtonElement).click();
      const dialog = () => document.querySelector('.cdk-overlay-container app-tutorial-replace-dialog');

      it('asks first, warning that the game will be lost, and starts nothing yet', async () => {
        const { fixture, el, service } = createWithGame();
        click(el, '.lesson[data-lesson="turn"] button.start');
        fixture.detectChanges();
        await fixture.whenStable();
        expect(service.lesson()).toBeNull();
        expect(dialog()).not.toBeNull();
        expect(text(dialog())).toContain('That game will be lost');
      });

      it('starts the lesson only when the beginner confirms', async () => {
        const { fixture, el, service } = createWithGame();
        click(el, '.lesson[data-lesson="turn"] button.start');
        fixture.detectChanges();
        await fixture.whenStable();
        click(dialog() as HTMLElement, 'button.confirm');
        fixture.detectChanges();
        await fixture.whenStable();
        expect(service.lesson()?.id).toBe('turn');
      });

      it('keeps the game and shows the list when the beginner cancels', async () => {
        const { fixture, el, service, game } = createWithGame();
        const before = game.state();
        click(el, '.lesson[data-lesson="turn"] button.start');
        fixture.detectChanges();
        await fixture.whenStable();
        click(dialog() as HTMLElement, 'button.cancel');
        fixture.detectChanges();
        await fixture.whenStable();
        expect(service.lesson()).toBeNull();
        expect(game.state()).toBe(before);
        expect(el.querySelectorAll('.lesson')).toHaveLength(5);
      });
    });
  });

  describe('when a lesson is finished', () => {
    function finish() {
      const made = create([shortLesson('generals'), shortLesson('allegiance')]);
      made.service.start('generals');
      made.fixture.detectChanges();
      made.service.next();
      made.fixture.detectChanges();
      return made;
    }

    it('offers Next Lesson, the next one in the list, and Back to Lessons', () => {
      const { el, service } = finish();
      expect(service.finished()).toBe(true);
      expect(text(el.querySelector('button.next-lesson'))).toBe('Next Lesson');
      expect(text(el.querySelector('button.back'))).toBe('Back to Lessons');
      expect(text(el.querySelector('.finished'))).toContain('Lesson complete');
    });

    it('starts the next lesson from Next Lesson', () => {
      const { fixture, el, service } = finish();
      (el.querySelector('button.next-lesson') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(service.lesson()?.id).toBe('allegiance');
      expect(service.finished()).toBe(false);
    });

    it('returns to the list from Back to Lessons, with the Tutorial game discarded', () => {
      const { fixture, el, service, game } = finish();
      (el.querySelector('button.back') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(service.lesson()).toBeNull();
      expect(game.state()).toBeNull();
      expect(el.querySelectorAll('.lesson')).toHaveLength(2);
    });

    it('offers no Next Lesson after the last lesson', () => {
      const made = create([shortLesson('generals'), shortLesson('allegiance')]);
      made.service.start('allegiance');
      made.fixture.detectChanges();
      made.service.next();
      made.fixture.detectChanges();
      expect(made.el.querySelector('button.next-lesson')).toBeNull();
      expect(made.el.querySelector('button.back')).not.toBeNull();
    });

    it('shows nothing of the finished panel while the lesson runs', () => {
      const { fixture, el, service } = create([shortLesson('generals')]);
      service.start('generals');
      fixture.detectChanges();
      expect(el.querySelector('.finished')).toBeNull();
    });
  });

  it('leaves the Tutorial when the page goes away: the lesson stops and no game is left to resume', () => {
    const { fixture, service, game } = create();
    service.start('turn');
    fixture.detectChanges();
    expect(game.state()).not.toBeNull();
    fixture.destroy();
    expect(service.lesson()).toBeNull();
    expect(game.state()).toBeNull();
    expect(game.tutorialActive()).toBe(false);
  });
});
