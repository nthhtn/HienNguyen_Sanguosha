import { PlaybackGate } from '../playback-gate.service';
import { OverlayContainer } from '@angular/cdk/overlay';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { playableGame } from '../scenario-kit/recipe';
import { DISPLAY_MODE_OVERRIDE } from '../display-mode-override';
import { setWindowSize } from '../layout.testing';
import { TutorialOverlay } from './tutorial-overlay';
import { TUTORIAL_LESSONS, TutorialService } from './tutorial.service';
import { Lesson, Step } from './tutorial-types';

// Real catalog keys with known English text, standing in for lesson text: the overlay only shows what it is given.
const step = (id: string, extra: Partial<Step> = {}): Step => ({ id, textKey: 'discard.pile', completes: { kind: 'next' }, ...extra });

const STEPS: Step[] = [
  step('hand', { target: 'hand' }),
  step('plain'),
  step('missing', { target: 'seat:seat-9' }),
  step('phone', { target: 'hand', phone: { target: 'end-phase', textKey: 'history.title' } }),
  step('end', { target: 'end-phase' }),
  // Several controls in turn (a card, its Play button, then a menu item that opens): the first one on the page.
  step('either', { target: ['seat:seat-0', 'end-phase'] }),
];

const lesson: Lesson = {
  id: 'turn',
  group: 'basics',
  titleKey: 'discard.pile',
  summaryKey: 'discard.pile',
  seatCount: 2,
  build: (registry) => playableGame(registry, 7, 2),
  steps: STEPS,
};

// A lesson whose only step waits for the beginner to act, not for Next.
const actionLesson: Lesson = {
  ...lesson,
  id: 'damage',
  steps: [step('act', { target: 'end-phase', completes: { kind: 'action', allow: [{ kind: 'ConfirmRevealsAction' }] } })],
};

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) };
}

// A board element carrying an anchor, with a fixed box (jsdom does no layout).
function anchored(id: string, box: DOMRect, parent: HTMLElement = document.body): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute('data-tutorial', id);
  el.getBoundingClientRect = () => box;
  parent.appendChild(el);
  return el;
}

describe('TutorialOverlay', () => {
  let fixture: ComponentFixture<TutorialOverlay>;
  let service: TutorialService;
  let el: HTMLElement;

  function create(): void {
    TestBed.configureTestingModule({ providers: [{ provide: TUTORIAL_LESSONS, useValue: [lesson, actionLesson] }] });
    service = TestBed.inject(TutorialService);
    fixture = TestBed.createComponent(TutorialOverlay);
    el = fixture.nativeElement as HTMLElement;
  }
  const show = (index = 0, id: 'turn' | 'damage' = 'turn') => {
    service.start(id);
    for (let i = 0; i < index; i++) service.next();
    fixture.detectChanges();
  };
  const ring = () => el.querySelector<HTMLElement>('.ring');
  const blockers = () => Array.from(el.querySelectorAll<HTMLElement>('.blocker'));
  const text = () => el.querySelector('.card .text')!.textContent!.trim();
  const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

  beforeEach(() => {
    setWindowSize(1000, 800);
    document.body.replaceChildren();
  });
  afterEach(() => document.body.replaceChildren());

  describe('with a target on screen', () => {
    it('circles the target with a ring around its padded box and shows the step text', () => {
      anchored('hand', rect(100, 100, 200, 50));
      create();
      show();
      expect(text()).toBe('Discard Pile');
      expect(ring()!.style.left).toBe('92px');
      expect(ring()!.style.top).toBe('92px');
      expect(ring()!.style.width).toBe('216px');
      expect(ring()!.style.height).toBe('66px');
    });

    it('covers everything else with four blockers around the hole', () => {
      anchored('hand', rect(100, 100, 200, 50));
      create();
      show();
      expect(blockers().map((b) => [b.style.left, b.style.top, b.style.width, b.style.height])).toEqual([
        ['0px', '0px', '1000px', '92px'],
        ['0px', '158px', '1000px', '642px'],
        ['0px', '92px', '92px', '66px'],
        ['308px', '92px', '692px', '66px'],
      ]);
    });

    it('finds a target inside a CDK overlay container as well as in the page', () => {
      const container = document.createElement('div');
      container.className = 'cdk-overlay-container';
      document.body.appendChild(container);
      anchored('end-phase', rect(400, 300, 100, 40), container);
      create();
      show(4);
      expect(ring()!.style.left).toBe('392px');
    });

    it('rings the first of several targets that is on the page', () => {
      anchored('end-phase', rect(400, 300, 100, 40));
      create();
      show(5);
      expect(ring()!.style.left).toBe('392px');
    });

    it('moves to an earlier target of the list when it appears, and back when it leaves', async () => {
      anchored('end-phase', rect(400, 300, 100, 40));
      create();
      show(5);
      const menu = anchored('seat:seat-0', rect(100, 100, 200, 50));
      await nextFrame();
      await nextFrame();
      fixture.detectChanges();
      expect(ring()!.style.left).toBe('92px');
      menu.remove();
      await nextFrame();
      await nextFrame();
      fixture.detectChanges();
      expect(ring()!.style.left).toBe('392px');
    });

    it('shows the step without a hole when none of several targets is on the page', () => {
      create();
      show(5);
      expect(ring()).toBeNull();
      expect(blockers()).toHaveLength(1);
    });

    it('ignores a click on a blocker: it does not reach the control underneath', () => {
      const underneath = anchored('hand', rect(100, 100, 200, 50));
      const clicked = jest.fn();
      underneath.addEventListener('click', clicked);
      create();
      show();
      blockers()[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(clicked).not.toHaveBeenCalled();
    });

    it('catches pointer events with real boxes, not a pointer-events pass-through', () => {
      anchored('hand', rect(100, 100, 200, 50));
      create();
      show();
      for (const blocker of blockers()) expect(getComputedStyle(blocker).pointerEvents).not.toBe('none');
      expect(getComputedStyle(ring()!).pointerEvents).toBe('none');
      // The card is inside a layer that passes events through, so it must take them back for its buttons.
      expect(getComputedStyle(el.querySelector('.card')!).pointerEvents).toBe('auto');
    });
  });

  // A dialog opens as a popover, in the browser's top layer, where z-index no longer ranks anything: a later popover
  // always sits over an earlier one. So the spotlight is a popover too, and goes to the top again when a dialog opens.
  describe('in the top layer, above every dialog', () => {
    let calls: string[];
    const popover = (name: 'showPopover' | 'hidePopover') =>
      Object.defineProperty(HTMLElement.prototype, name, {
        configurable: true,
        value(this: HTMLElement) {
          if (this.classList.contains('tutorial-overlay')) calls.push(name === 'showPopover' ? 'show' : 'hide');
        },
      });
    beforeEach(() => {
      calls = [];
      popover('showPopover');
      popover('hidePopover');
    });
    afterEach(() => {
      delete (HTMLElement.prototype as Partial<HTMLElement>).showPopover;
      delete (HTMLElement.prototype as Partial<HTMLElement>).hidePopover;
    });
    const settle = () => new Promise<void>((resolve) => setTimeout(resolve));

    it('is a manual popover that is shown with the step', () => {
      anchored('hand', rect(100, 100, 200, 50));
      create();
      show();
      expect(el.querySelector('.tutorial-overlay')!.getAttribute('popover')).toBe('manual');
      expect(calls).toContain('show');
    });

    it('rises above a dialog that opens afterwards, so a dialog never covers the card', async () => {
      anchored('hand', rect(100, 100, 200, 50));
      create();
      show();
      await settle();
      calls.length = 0;
      TestBed.inject(OverlayContainer).getContainerElement().appendChild(document.createElement('div'));
      await settle();
      // Hidden and shown again: showing a popover that is already open would leave it where it is.
      expect(calls).toEqual(['hide', 'show']);
    });

    it('ignores the dialogs once the step is gone', async () => {
      anchored('hand', rect(100, 100, 200, 50));
      create();
      show();
      await settle();
      service.exit();
      fixture.detectChanges();
      await settle();
      calls.length = 0;
      TestBed.inject(OverlayContainer).getContainerElement().appendChild(document.createElement('div'));
      await settle();
      expect(calls).toEqual([]);
    });

    it('still works where the browser has no popover support', () => {
      delete (HTMLElement.prototype as Partial<HTMLElement>).showPopover;
      delete (HTMLElement.prototype as Partial<HTMLElement>).hidePopover;
      anchored('hand', rect(100, 100, 200, 50));
      create();
      expect(() => show()).not.toThrow();
      expect(text()).toBe('Discard Pile');
    });
  });

  describe('when the layout changes', () => {
    it('moves the hole when the window is resized', () => {
      const target = anchored('hand', rect(100, 100, 200, 50));
      create();
      show();
      target.getBoundingClientRect = () => rect(300, 400, 200, 50);
      window.dispatchEvent(new Event('resize'));
      fixture.detectChanges();
      expect(ring()!.style.left).toBe('292px');
      expect(ring()!.style.top).toBe('392px');
    });

    it('moves the hole when the target moves with no resize (an animation, a scroll)', async () => {
      const target = anchored('hand', rect(100, 100, 200, 50));
      create();
      show();
      target.getBoundingClientRect = () => rect(500, 500, 200, 50);
      await nextFrame();
      await nextFrame();
      fixture.detectChanges();
      expect(ring()!.style.left).toBe('492px');
    });

    it('finds a target that appears after the step does', async () => {
      create();
      show();
      expect(ring()).toBeNull();
      anchored('hand', rect(100, 100, 200, 50));
      await nextFrame();
      await nextFrame();
      fixture.detectChanges();
      expect(ring()).not.toBeNull();
    });

    it('shows the step without a hole when the target leaves the screen', () => {
      const target = anchored('hand', rect(100, 100, 200, 50));
      create();
      show();
      target.getBoundingClientRect = () => rect(5000, 5000, 200, 50);
      window.dispatchEvent(new Event('resize'));
      fixture.detectChanges();
      expect(ring()).toBeNull();
      expect(blockers()).toHaveLength(1);
      expect(el.querySelector('button.exit')).not.toBeNull();
    });

    it('scrolls a target that is off screen into view when its step starts', () => {
      const target = anchored('hand', rect(100, 900, 200, 50));
      const scrollIntoView = jest.fn();
      target.scrollIntoView = scrollIntoView;
      create();
      show();
      expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' });
    });

    it('does not scroll a target that is already on screen', () => {
      const target = anchored('hand', rect(100, 100, 200, 50));
      const scrollIntoView = jest.fn();
      target.scrollIntoView = scrollIntoView;
      create();
      show();
      expect(scrollIntoView).not.toHaveBeenCalled();
    });
  });

  describe('without a target on this layout', () => {
    it('shows a centred text card with one full blocker, and Exit works', () => {
      create();
      show(1);
      expect(ring()).toBeNull();
      expect(blockers().map((b) => [b.style.left, b.style.top, b.style.width, b.style.height])).toEqual([['0px', '0px', '1000px', '800px']]);
      expect(el.querySelector('.card')!.getAttribute('data-side')).toBe('centre');
      (el.querySelector('button.exit') as HTMLButtonElement).click();
      expect(service.lesson()).toBeNull();
    });

    it('does the same for a target no element carries, and Next still works', () => {
      create();
      show(2);
      expect(ring()).toBeNull();
      expect(blockers()).toHaveLength(1);
      const next = el.querySelector('button.next') as HTMLButtonElement;
      expect(next.disabled).toBe(false);
      next.click();
      expect(service.step()!.id).toBe('phone');
    });
  });

  describe('while the beginner has nothing to do', () => {
    // A step the game completes by itself (a bot moves, a popup closes): the board is the thing to watch, so nothing is dimmed.
    const waiting = (id: string, extra: Partial<Step> = {}): Lesson => ({
      ...lesson,
      id: 'sha-shan',
      steps: [step(id, { completes: { kind: 'state', reached: () => false }, ...extra })],
    });
    const waitingAck = (): Lesson => ({
      ...lesson,
      id: 'sha-shan',
      steps: [step('ack', { target: 'judgment-dialog', completes: { kind: 'action', allow: [{ kind: 'AcknowledgeJudgmentAction' }] } })],
    });
    function createWith(l: Lesson): void {
      TestBed.configureTestingModule({ providers: [{ provide: TUTORIAL_LESSONS, useValue: [l] }] });
      service = TestBed.inject(TutorialService);
      fixture = TestBed.createComponent(TutorialOverlay);
      el = fixture.nativeElement as HTMLElement;
      service.start('sha-shan');
      fixture.detectChanges();
    }

    it('shows a small note with Exit and a ring on what to watch, but no dimming', () => {
      anchored('hand', rect(100, 100, 200, 50));
      createWith(waiting('wait', { target: 'hand' }));
      expect(ring()).not.toBeNull();
      expect(blockers()).toHaveLength(0);
      expect(el.querySelector('.card.compact')).not.toBeNull();
      expect(text()).toBe('Discard Pile');
      expect(el.querySelector('button.exit')).not.toBeNull();
      expect(el.querySelector('button.next')).toBeNull();
    });

    it('dims nothing when there is no target either', () => {
      createWith(waiting('wait'));
      expect(ring()).toBeNull();
      expect(blockers()).toHaveLength(0);
      expect(el.querySelector('.card')).not.toBeNull();
    });

    it('dims nothing while the judgment popup closes by itself', () => {
      anchored('judgment-dialog', rect(300, 200, 400, 300));
      createWith(waitingAck());
      expect(ring()).not.toBeNull();
      expect(blockers()).toHaveLength(0);
    });

    it('lets a click through to the board: the overlay layer itself catches nothing', () => {
      anchored('hand', rect(100, 100, 200, 50));
      createWith(waiting('wait', { target: 'hand' }));
      const layer = el.querySelector<HTMLElement>('.tutorial-overlay')!;
      expect(layer.style.pointerEvents).toBe('none');
      expect(el.querySelectorAll('.blocker')).toHaveLength(0);
    });

    it('dims nothing while the board plays an animation, whatever the step, and dims again once it is idle', () => {
      anchored('end-phase', rect(400, 300, 100, 40));
      create();
      show(0, 'damage');
      expect(blockers()).toHaveLength(4);
      TestBed.inject(PlaybackGate).idle.set(false);
      fixture.detectChanges();
      expect(blockers()).toHaveLength(0);
      TestBed.inject(PlaybackGate).idle.set(true);
      fixture.detectChanges();
      expect(blockers()).toHaveLength(4);
    });

    it('still dims on a step that waits for the beginner to act', () => {
      anchored('end-phase', rect(400, 300, 100, 40));
      create();
      show(0, 'damage');
      expect(blockers()).toHaveLength(4);
      expect(ring()).not.toBeNull();
      expect(el.querySelector('.card.compact')).toBeNull();
    });
  });

  describe('minimizing the instructions', () => {
    const minimize = () => (el.querySelector('button.minimize') as HTMLButtonElement).click();
    const restore = () => (el.querySelector('button.restore') as HTMLButtonElement).click();

    it('shrinks the card to one small button and drops the dim and the ring', () => {
      anchored('end-phase', rect(400, 300, 100, 40));
      create();
      show(0, 'damage');
      expect(blockers()).toHaveLength(4);
      expect(el.querySelector('button.minimize')!.textContent!.trim()).toBe('Minimize');
      minimize();
      fixture.detectChanges();
      expect(el.querySelector('.card')).toBeNull();
      expect(blockers()).toHaveLength(0);
      expect(ring()).toBeNull();
      expect(el.querySelector('button.restore')!.textContent!.trim()).toBe('Show Instructions');
    });

    it('brings the card, the ring and the dim back on Show Instructions', () => {
      anchored('end-phase', rect(400, 300, 100, 40));
      create();
      show(0, 'damage');
      minimize();
      fixture.detectChanges();
      restore();
      fixture.detectChanges();
      expect(el.querySelector('.card')).not.toBeNull();
      expect(el.querySelector('button.restore')).toBeNull();
      expect(blockers()).toHaveLength(4);
      expect(ring()).not.toBeNull();
    });

    it('can be minimized on a waiting step too', () => {
      anchored('hand', rect(100, 100, 200, 50));
      create();
      show();
      minimize();
      fixture.detectChanges();
      expect(el.querySelector('.card')).toBeNull();
      expect(el.querySelector('button.restore')).not.toBeNull();
    });

    it('stays minimized through the next steps of the lesson, until it is shown again', () => {
      anchored('hand', rect(100, 100, 200, 50));
      create();
      show();
      minimize();
      fixture.detectChanges();
      service.next();
      fixture.detectChanges();
      expect(service.step()!.id).toBe('plain');
      expect(el.querySelector('.card')).toBeNull();
      expect(el.querySelector('button.restore')).not.toBeNull();
      expect(blockers()).toHaveLength(0);
    });

    it('stays minimized while the board plays and a waiting step comes', () => {
      anchored('hand', rect(100, 100, 200, 50));
      create();
      show();
      minimize();
      TestBed.inject(PlaybackGate).idle.set(false);
      fixture.detectChanges();
      TestBed.inject(PlaybackGate).idle.set(true);
      fixture.detectChanges();
      expect(el.querySelector('.card')).toBeNull();
    });

    it('opens the card again when another lesson starts', () => {
      anchored('hand', rect(100, 100, 200, 50));
      create();
      show();
      minimize();
      fixture.detectChanges();
      service.start('damage');
      fixture.detectChanges();
      expect(el.querySelector('.card')).not.toBeNull();
    });

    it('has Next on the minimized note while the step waits for it', () => {
      anchored('hand', rect(100, 100, 200, 50));
      create();
      show();
      minimize();
      fixture.detectChanges();
      (el.querySelector('.minimized button.next') as HTMLButtonElement).click();
      expect(service.step()!.id).toBe('plain');
    });

    it('keeps the Exit reachable: it is on the minimized state too', () => {
      anchored('hand', rect(100, 100, 200, 50));
      create();
      show();
      minimize();
      fixture.detectChanges();
      expect(el.querySelector('.minimized button.exit')).not.toBeNull();
    });
  });

  describe('buttons', () => {
    it('has Next and Exit Tutorial on a next step', () => {
      anchored('hand', rect(100, 100, 200, 50));
      create();
      show();
      expect(el.querySelector('button.next')!.textContent!.trim()).toBe('Next');
      expect(el.querySelector('button.exit')!.textContent!.trim()).toBe('Exit Tutorial');
    });

    it('has only Exit Tutorial on a step that waits for the beginner to act', () => {
      anchored('end-phase', rect(400, 300, 100, 40));
      create();
      show(0, 'damage');
      expect(el.querySelector('button.next')).toBeNull();
      expect(el.querySelector('button.exit')!.textContent!.trim()).toBe('Exit Tutorial');
    });

    it('Next moves to the next step', () => {
      anchored('hand', rect(100, 100, 200, 50));
      create();
      show();
      (el.querySelector('button.next') as HTMLButtonElement).click();
      expect(service.step()!.id).toBe('plain');
    });

    it('Exit Tutorial leaves the lesson and the overlay disappears', () => {
      anchored('hand', rect(100, 100, 200, 50));
      create();
      show();
      (el.querySelector('button.exit') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(service.lesson()).toBeNull();
      expect(el.querySelector('.tutorial-overlay')).toBeNull();
    });
  });

  it('shows nothing before a lesson starts and once it has finished', () => {
    create();
    fixture.detectChanges();
    expect(el.querySelector('.tutorial-overlay')).toBeNull();
    show(STEPS.length - 1);
    expect(el.querySelector('.tutorial-overlay')).not.toBeNull();
    service.next();
    fixture.detectChanges();
    expect(service.finished()).toBe(true);
    expect(el.querySelector('.tutorial-overlay')).toBeNull();
  });

  describe('on the phone board', () => {
    function createCompact(): void {
      // The installed app held sideways, between the phone board's size and the medium layout's.
      setWindowSize(800, 400);
      TestBed.configureTestingModule({
        providers: [
          { provide: TUTORIAL_LESSONS, useValue: [lesson, actionLesson] },
          { provide: DISPLAY_MODE_OVERRIDE, useValue: 'standalone' },
        ],
      });
      service = TestBed.inject(TutorialService);
      fixture = TestBed.createComponent(TutorialOverlay);
      el = fixture.nativeElement as HTMLElement;
    }

    it('uses a step’s phone target and phone text', () => {
      anchored('hand', rect(10, 10, 100, 40));
      anchored('end-phase', rect(600, 300, 100, 40));
      createCompact();
      show(3);
      expect(text()).toBe('Action History');
      expect(ring()!.style.left).toBe('592px');
    });

    it('falls back to the step’s own target and text where it has no phone variant', () => {
      anchored('hand', rect(10, 10, 100, 40));
      createCompact();
      show(0);
      expect(text()).toBe('Discard Pile');
      expect(ring()!.style.left).toBe('2px');
    });
  });

  describe('on the wide board', () => {
    it('ignores a step’s phone variant', () => {
      anchored('hand', rect(10, 10, 100, 40));
      anchored('end-phase', rect(600, 300, 100, 40));
      create();
      show(3);
      expect(text()).toBe('Discard Pile');
      expect(ring()!.style.left).toBe('2px');
    });
  });
});
