import { TestBed } from '@angular/core/testing';
import { I18n } from '../i18n/i18n.service';
import { JudgmentDescription } from './judgment-description';
import type { Action } from 'engine';
import { JudgmentDecisionView } from './judgment-decision';
import { JudgmentStage } from './judgment-stage';
import { card, king, seven, skillDescription } from './judgment-description.testing';

describe('JudgmentStage', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    delete (globalThis as { matchMedia?: unknown }).matchMedia;
  });

  function render(description: JudgmentDescription) {
    TestBed.configureTestingModule({});
    const fixture = TestBed.createComponent(JudgmentStage);
    fixture.componentRef.setInput('description', description);
    const unlocked = jest.fn();
    fixture.componentInstance.unlocked.subscribe(unlocked);
    // A second pass: with reduced motion the beats have already run, and show on the next one.
    fixture.detectChanges();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const at = (ms: number) => {
      jest.advanceTimersByTime(ms);
      fixture.detectChanges();
    };
    return { fixture, el, unlocked, at };
  }
  const bad = (over: Partial<JudgmentDescription> = {}) => skillDescription({ verdict: 'bad', effect: { kind: 'none' }, ...over });
  const count = (el: HTMLElement, selector: string) => el.querySelectorAll(selector).length;

  it('plays the source, the rule and the card in order', () => {
    const { el, at } = render(skillDescription());
    expect(count(el, '.source.in')).toBe(0);
    at(0);
    expect(count(el, '.source.in')).toBe(1);
    expect(count(el, '.rule.in')).toBe(0);
    at(500);
    expect(count(el, '.rule.in')).toBe(1);
    expect(count(el, '.pc.in')).toBe(0);
    at(500);
    expect(count(el, '.pc.in')).toBe(1);
    expect(count(el, '.pc.up')).toBe(0);
    at(300);
    expect(count(el, '.pc.up')).toBe(1);
  });

  it('draws a check for a good verdict after the head beats, and a cross for a bad one', () => {
    const good = render(skillDescription({ verdict: 'good' }));
    good.at(2099);
    expect(count(good.el, '.stamp.show')).toBe(0);
    good.at(1);
    expect(count(good.el, '.stamp.good.show')).toBe(1);
    TestBed.resetTestingModule();
    const cross = render(bad());
    cross.at(2100);
    expect(count(cross.el, '.stamp.bad.show')).toBe(1);
  });

  it('draws no stamp for a neutral verdict', () => {
    const { el, at } = render(skillDescription({ verdict: 'neutral' }));
    at(10_000);
    expect(count(el, '.stamp')).toBe(0);
  });

  it('does not draw the verdict while the judgment is unsettled, and shows the waiting line', () => {
    const { el, at } = render(skillDescription({ settled: false, verdict: null, effect: null, outcome: null, waiting: 'Waiting for Bo to decide whether to change the judgment' }));
    at(10_000);
    expect(count(el, '.stamp.show')).toBe(0);
    expect(el.querySelector('.waiting')!.textContent).toContain('Waiting for Bo');
  });

  it('draws the verdict once the replacement has had its animation after the judgment settles', () => {
    const { fixture, el, at } = render(skillDescription({ settled: false, verdict: null, effect: null, outcome: null, waiting: 'Waiting', card: seven }));
    at(3000);
    fixture.componentRef.setInput('description', skillDescription({
      card: king, replaced: [seven], changes: [{ text: 'Hing replaced 7 ♥ with K ♠', card: king }], verdict: 'bad', effect: { kind: 'none' },
    }));
    fixture.detectChanges();
    expect(count(el, '.pc.old')).toBe(1);
    at(1299);
    expect(count(el, '.stamp.show')).toBe(0);
    at(1);
    expect(count(el, '.stamp.bad.show')).toBe(1);
  });

  it('fans out replaced cards and strikes them out, the older ones smaller', () => {
    const olds = [card('o1', 'club', 2), card('o2', 'club', 3), card('o3', 'club', 4)];
    const { el, at } = render(skillDescription({ card: king, replaced: olds }));
    at(2000);
    expect(count(el, '.pc.old')).toBe(1);
    expect(count(el, '.pc.older')).toBe(2);
    expect(count(el, '.pc.current')).toBe(1);
  });

  it('shows the damage hearts and greys the lost ones in turn, once the consequence plays', () => {
    const description = bad({ effect: { kind: 'damage', amount: 3, subject: 'seat' }, hp: { seatName: 'Bo', current: 4, max: 4 } });
    const { el, at } = render(description);
    expect(count(el, '.heart')).toBe(4);
    at(2100 + 900);
    expect(count(el, '.heart.lost')).toBe(1);
    at(520);
    expect(count(el, '.heart.lost')).toBe(3);
    expect(el.querySelector('.dmg')!.textContent).toContain('3');
  });

  it('draws only the current HP when the maximum is not known', () => {
    const { el } = render(bad({ effect: { kind: 'damage', amount: 1, subject: 'seat' }, hp: { seatName: 'Bo', current: 2, max: null } }));
    expect(count(el, '.heart')).toBe(2);
  });

  it('shows the phases and strikes out the one that is skipped', () => {
    const { el, at } = render(bad({ effect: { kind: 'skip-phase', phase: 'Play' } }));
    expect([...el.querySelectorAll('.chip')].map((c) => c.textContent!.trim())).toEqual(['Draw Phase', 'Play Phase', 'Discard Phase']);
    at(3000);
    expect(el.querySelector('.chip.skipped')!.textContent).toContain('Play Phase');
  });

  it('marks the phase that is kept', () => {
    const { el, at } = render(skillDescription({ verdict: 'good', effect: { kind: 'keep-phase', phase: 'Draw' } }));
    at(3000);
    expect(el.querySelector('.chip.kept')!.textContent).toContain('Draw Phase');
  });

  it('shows Lightning moving on with an arrow between the seats', () => {
    const { el, at } = render(skillDescription({ verdict: 'good', effect: { kind: 'pass-on' }, judgedSeatName: 'Hing' }));
    at(3000);
    expect(el.querySelector('.arrow')).not.toBeNull();
    expect(el.querySelector('.chips.seats')!.textContent).toContain('Hing');
  });

  it('always shows the one-line sentence of the consequence', () => {
    const { el, at } = render(bad({ outcome: 'Bo takes 3 thunder damage' }));
    at(3000);
    expect(el.querySelector('.line.in')!.textContent).toContain('Bo takes 3 thunder damage');
  });

  it('unlocks Continue once, 1100 ms after the consequence', () => {
    const { unlocked, at } = render(skillDescription());
    at(4099);
    expect(unlocked).not.toHaveBeenCalled();
    at(1);
    expect(unlocked).toHaveBeenCalledTimes(1);
    at(20_000);
    expect(unlocked).toHaveBeenCalledTimes(1);
  });

  it('shows the final state at once under reduced motion', () => {
    (globalThis as { matchMedia?: unknown }).matchMedia = () => ({ matches: true });
    const { el, unlocked } = render(bad({ effect: { kind: 'skip-phase', phase: 'Play' } }));
    expect(count(el, '.stamp.bad.show')).toBe(1);
    expect(count(el, '.chip.skipped')).toBe(1);
    expect(unlocked).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('keeps its place when the language changes mid-sequence: nothing restarts, and the text follows', async () => {
    localStorage.clear();
    const { fixture, el, unlocked, at } = render(bad({ effect: { kind: 'skip-phase', phase: 'Play' } }));
    at(1500);
    expect(count(el, '.pc.in')).toBe(1);
    await TestBed.inject(I18n).setLocale('vi');
    fixture.detectChanges();
    expect(count(el, '.source.in')).toBe(1);
    expect(count(el, '.rule.in')).toBe(1);
    expect(count(el, '.pc.in')).toBe(1);
    expect(el.querySelector('.chip')!.textContent).not.toContain('Draw Phase');
    at(5000);
    expect(unlocked).toHaveBeenCalledTimes(1);
    localStorage.clear();
  });

  it('shows the end of the sequence at once when it is rebuilt part-way (instant)', () => {
    TestBed.configureTestingModule({});
    const fixture = TestBed.createComponent(JudgmentStage);
    fixture.componentRef.setInput('description', bad({ effect: { kind: 'skip-phase', phase: 'Play' } }));
    fixture.componentRef.setInput('instant', true);
    const unlocked = jest.fn();
    fixture.componentInstance.unlocked.subscribe(unlocked);
    fixture.detectChanges();
    fixture.detectChanges();
    expect(count(fixture.nativeElement, '.stamp.bad.show')).toBe(1);
    expect(unlocked).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('stops its timers when it is destroyed', () => {
    const { fixture } = render(skillDescription());
    fixture.destroy();
    expect(jest.getTimerCount()).toBe(0);
  });

  describe('the decision area', () => {
    const use: Action = { kind: 'ChooseOptionAction', seatId: 'seat-0', choiceId: 'ask-1', optionId: 'use' };
    const decline: Action = { kind: 'ChooseOptionAction', seatId: 'seat-0', choiceId: 'ask-1', optionId: 'decline' };
    const ask: JudgmentDecisionView = {
      kind: 'mine', deciderName: 'Hing',
      step: { kind: 'ask', description: { title: 'Devil', prompt: 'Change the judgment?', hint: null, card: null, generalId: null, useLabel: 'Use', use, decline } },
    };
    const select: JudgmentDecisionView = {
      kind: 'mine', deciderName: 'Hing',
      step: {
        kind: 'select',
        description: {
          title: 'Devil', prompt: 'Pick a card', confirmLabel: 'Replace', cancelLabel: 'Cancel', min: 1, max: 1,
          items: [{ id: 'h1', label: 'K ♠', card: king }, { id: 'h2', label: '7 ♥', card: seven }],
          template: { kind: 'SelectAction', seatId: 'seat-0', selectionId: 'sel-1', ids: [] }, cancel: { kind: 'CancelSelectionAction', seatId: 'seat-0', selectionId: 'sel-1' },
        },
      },
    };
    const open = (decision: JudgmentDecisionView | null, over: Partial<JudgmentDescription> = {}) => {
      const r = render(skillDescription({ settled: false, verdict: null, effect: null, outcome: null, waiting: 'Waiting for skills', ...over }));
      r.fixture.componentRef.setInput('decision', decision);
      r.fixture.detectChanges();
      const chosen = jest.fn();
      const revealed = jest.fn();
      r.fixture.componentInstance.chosen.subscribe(chosen);
      r.fixture.componentInstance.revealed.subscribe(revealed);
      return { ...r, chosen, revealed };
    };

    it('opens after the head beats, not before, in the place the consequence will take', () => {
      const { el, at } = open(ask);
      at(2099);
      expect(el.querySelector('.decide')).toBeNull();
      expect(el.querySelector('.waiting')).not.toBeNull();
      at(1);
      expect(el.querySelector('.decide app-ask-panel')).not.toBeNull();
      expect(el.querySelector('.waiting')).toBeNull();
    });

    it('asks the viewer’s question and offers only the engine’s own actions', () => {
      const { el, at, chosen } = open(ask);
      at(2100);
      expect(el.querySelector('.decide .prompt')!.textContent).toContain('Change the judgment?');
      (el.querySelector('.decide button.use') as HTMLButtonElement).click();
      (el.querySelector('.decide button.decline') as HTMLButtonElement).click();
      expect(chosen.mock.calls.map((c) => c[0])).toEqual([use, decline]);
    });

    it('lets the viewer pick a card and confirms it as the engine’s SelectAction', () => {
      const { fixture, el, at, chosen } = open(select);
      at(2100);
      (el.querySelector('.decide [data-item-id="h1"]') as HTMLButtonElement).click();
      fixture.detectChanges();
      (el.querySelector('.decide button.confirm') as HTMLButtonElement).click();
      expect(chosen).toHaveBeenCalledWith({ kind: 'SelectAction', seatId: 'seat-0', selectionId: 'sel-1', ids: ['h1'] });
    });

    it('shows others a waiting line with the seat that is deciding', () => {
      const { el, at } = open({ kind: 'watching', deciderName: 'Bo' });
      at(2100);
      expect(el.querySelector('.decide .waiting')!.textContent).toContain('Waiting for Bo to decide whether to change the judgment');
      expect(el.querySelector('.decide button')).toBeNull();
    });

    it('asks to pass the device first in Pass and Play, and says whose seat it is when revealed', () => {
      const { el, at, revealed } = open({ kind: 'gate', seatId: 'seat-1', deciderName: 'Bo' });
      at(2100);
      expect(el.querySelector('.decide')!.textContent).toContain('Bo');
      expect(el.querySelector('.decide app-ask-panel')).toBeNull();
      (el.querySelector('.decide button.reveal') as HTMLButtonElement).click();
      expect(revealed).toHaveBeenCalledWith('seat-1');
    });

    it('closes for a replacement and opens again for the next asker once the swap has played', () => {
      const { fixture, el, at } = open(ask);
      at(2100);
      expect(el.querySelector('.decide')).not.toBeNull();
      fixture.componentRef.setInput('description', skillDescription({
        settled: false, verdict: null, effect: null, outcome: null, waiting: 'Waiting', card: king, replaced: [seven],
        changes: [{ text: 'Hing replaced 7 ♥ with K ♠', card: king }],
      }));
      fixture.componentRef.setInput('decision', { kind: 'watching', deciderName: 'Bo' });
      fixture.detectChanges();
      expect(el.querySelector('.decide')).toBeNull();
      expect(count(el, '.pc.old')).toBe(1);
      at(1299);
      expect(el.querySelector('.decide')).toBeNull();
      at(1);
      expect(el.querySelector('.decide .waiting')!.textContent).toContain('Bo');
    });
  });
});
