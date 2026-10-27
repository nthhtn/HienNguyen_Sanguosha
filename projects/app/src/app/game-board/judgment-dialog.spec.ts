import { signal, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { JudgmentDescription } from './judgment-description';
import { JudgmentDialog, JudgmentDialogData } from './judgment-dialog';
import type { Action } from 'engine';
import { JudgmentDecisionView } from './judgment-decision';
import { king, seven, skillDescription } from './judgment-description.testing';
function render(description: JudgmentDescription | null, extra: Partial<JudgmentDialogData> = {}) {
  const sig: WritableSignal<JudgmentDescription | null> = signal(description);
  const data: JudgmentDialogData = { description: sig, ...extra };
  TestBed.configureTestingModule({ providers: [{ provide: MAT_DIALOG_DATA, useValue: data }, { provide: MatDialogRef, useValue: { close: jest.fn() } }] });
  const fixture = TestBed.createComponent(JudgmentDialog);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  return { fixture, el, sig };
}

describe('JudgmentDialog', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('names the source: the General, the skill and its text', () => {
    const { el } = render(skillDescription());
    expect(el.querySelector('h2')!.textContent).toContain('Judgment');
    expect(el.querySelector('.source')!.textContent).toContain('Xiahou Dun');
    expect(el.querySelector('.source')!.textContent).toContain('Unyielding');
    expect(el.querySelector('.source')!.textContent).toContain('After you take damage, judge.');
    expect(el.querySelector('.source app-card-art')).not.toBeNull();
  });

  it('names a card source and the seat it sits on', () => {
    const { el } = render(skillDescription({ source: { kind: 'card', cardName: 'Lightning', seatName: 'Bo' } }));
    expect(el.querySelector('.source')!.textContent).toContain('Lightning on Bo');
    expect(el.querySelector('.source app-card-art')).toBeNull();
  });

  it('shows the judgment card, each card it replaced, and says so in words', () => {
    const { el } = render(skillDescription({ card: king, replaced: [seven], changes: [{ text: "Hing's Unyielding replaced 7 ♥ with K ♠", card: king }] }));
    expect(el.querySelectorAll('.arena app-playing-card')).toHaveLength(2);
    expect([...el.querySelectorAll('.change')].map((c) => c.textContent!.trim())).toEqual(["Hing's Unyielding replaced 7 ♥ with K ♠"]);
  });

  it('shows the consequence sentence once the sequence has reached it', () => {
    const { fixture, el } = render(skillDescription());
    jest.advanceTimersByTime(3000);
    fixture.detectChanges();
    expect(el.querySelector('.line')!.textContent).toContain('Bo discards 2 cards or takes 1 damage');
  });

  it('shows no consequence sentence when there is none', () => {
    const { fixture, el } = render(skillDescription({ outcome: null }));
    jest.advanceTimersByTime(10_000);
    fixture.detectChanges();
    expect(el.querySelector('.line')).toBeNull();
  });

  it('unsettled: the waiting line, no countdown', () => {
    const { el } = render(skillDescription({ settled: false, outcome: null, waiting: 'Waiting for Bo to decide whether to change the judgment' }));
    expect(el.querySelector('.waiting')!.textContent).toContain('Waiting for Bo');
    expect(el.querySelector('app-decision-countdown')).toBeNull();
  });

  it('settled: the countdown, and no button to skip it', () => {
    const { el } = render(skillDescription());
    expect(el.querySelector('.waiting')).toBeNull();
    expect(el.querySelector('app-decision-countdown')).not.toBeNull();
    expect(el.querySelector('button.close')).toBeNull();
    expect(el.querySelector('mat-dialog-actions button')).toBeNull();
  });

  it('updates in place when the description changes', () => {
    const { fixture, el, sig } = render(skillDescription({ settled: false, outcome: null, waiting: 'Waiting for skills that can change the judgment' }));
    expect(el.querySelector('.waiting')).not.toBeNull();
    sig.set(skillDescription({ card: king, replaced: [seven], changes: [{ text: 'Hing replaced 7 ♥ with K ♠', card: king }], outcome: 'Bo takes 1 damage' }));
    fixture.detectChanges();
    expect(el.querySelector('.waiting')).toBeNull();
    expect(el.querySelectorAll('.change')).toHaveLength(1);
    jest.advanceTimersByTime(10_000);
    fixture.detectChanges();
    expect(el.querySelector('.line')!.textContent).toContain('Bo takes 1 damage');
  });

  it('has a View Board button in the title row', () => {
    const { el } = render(skillDescription());
    expect(el.querySelector('.title-row app-minimize-button button.minimize')).not.toBeNull();
  });

  it('renders nothing while there is no description', () => {
    const { el } = render(null);
    expect(el.querySelector('.source')).toBeNull();
  });

  describe('the decision area', () => {
    const use: Action = { kind: 'ChooseOptionAction', seatId: 'seat-0', choiceId: 'ask-1', optionId: 'use' };
    const asking = skillDescription({ settled: false, verdict: null, effect: null, outcome: null, waiting: 'Waiting' });
    const ask: JudgmentDecisionView = {
      kind: 'mine', deciderName: 'Hing',
      step: { kind: 'ask', description: { title: 'Devil', prompt: 'Change it?', hint: null, card: null, generalId: null, useLabel: 'Use', use, decline: { ...use, optionId: 'decline' } } },
    };

    it('hands the viewer’s pick to the board to submit, and the countdown stays in the decision area, not the footer', () => {
      const choose = jest.fn();
      const { el } = render(asking, { decision: signal(ask), choose });
      jest.advanceTimersByTime(2100);
      TestBed.tick();
      (el.querySelector('.decide button.use') as HTMLButtonElement).click();
      expect(choose).toHaveBeenCalledWith(use);
      expect(el.querySelector('mat-dialog-actions')).toBeNull();
    });

    it('tells the board the device was handed over in Pass and Play', () => {
      const reveal = jest.fn();
      const { el } = render(asking, { decision: signal<JudgmentDecisionView | null>({ kind: 'gate', seatId: 'seat-1', deciderName: 'Bo' }), reveal });
      jest.advanceTimersByTime(2100);
      TestBed.tick();
      (el.querySelector('.decide button.reveal') as HTMLButtonElement).click();
      expect(reveal).toHaveBeenCalledWith('seat-1');
    });
  });
});
