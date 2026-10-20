import { signal, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { JudgmentDescription } from './judgment-description';
import { JudgmentDialog, JudgmentDialogData } from './judgment-dialog';
import { king, skillDescription } from './judgment-description.testing';
function render(description: JudgmentDescription | null, canClose = true) {
  const close = jest.fn();
  const sig: WritableSignal<JudgmentDescription | null> = signal(description);
  const data: JudgmentDialogData = { description: sig, canClose: signal(canClose), close };
  TestBed.configureTestingModule({ providers: [{ provide: MAT_DIALOG_DATA, useValue: data }, { provide: MatDialogRef, useValue: { close: jest.fn() } }] });
  const fixture = TestBed.createComponent(JudgmentDialog);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  return { fixture, el, close, sig };
}

describe('JudgmentDialog', () => {
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

  it('shows the judgment card and each replacement', () => {
    const { el } = render(skillDescription({ card: king, changes: [{ text: "Hing's Unyielding replaced 7 ♥ with K ♠", card: king }] }));
    expect(el.querySelector('.judged app-playing-card')).not.toBeNull();
    expect([...el.querySelectorAll('.change')].map((c) => c.textContent!.trim())).toEqual(["Hing's Unyielding replaced 7 ♥ with K ♠"]);
  });

  it('shows the consequence', () => {
    expect(render(skillDescription()).el.querySelector('.outcome')!.textContent).toContain('Bo discards 2 cards or takes 1 damage');
  });

  it('shows no consequence section when there is none', () => {
    expect(render(skillDescription({ outcome: null })).el.querySelector('.outcome')).toBeNull();
  });

  it('unsettled: the waiting line, no countdown, no Close', () => {
    const { el } = render(skillDescription({ settled: false, outcome: null, waiting: 'Waiting for Bo to decide whether to change the judgment' }));
    expect(el.querySelector('.waiting')!.textContent).toContain('Waiting for Bo');
    expect(el.querySelector('app-decision-countdown')).toBeNull();
    expect(el.querySelector('button.close')).toBeNull();
  });

  it('settled: the countdown and a Close button that closes it', () => {
    const { el, close } = render(skillDescription());
    expect(el.querySelector('.waiting')).toBeNull();
    expect(el.querySelector('app-decision-countdown')).not.toBeNull();
    const button = el.querySelector('button.close') as HTMLButtonElement;
    expect(button.textContent!.trim()).toBe('Close');
    button.click();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('settled but the viewer cannot close: the countdown, no Close', () => {
    const { el } = render(skillDescription(), false);
    expect(el.querySelector('app-decision-countdown')).not.toBeNull();
    expect(el.querySelector('button.close')).toBeNull();
  });

  it('updates in place when the description changes', () => {
    const { fixture, el, sig } = render(skillDescription({ settled: false, outcome: null, waiting: 'Waiting for skills that can change the judgment' }));
    expect(el.querySelector('.waiting')).not.toBeNull();
    sig.set(skillDescription({ card: king, changes: [{ text: 'Hing replaced 7 ♥ with K ♠', card: king }], outcome: 'Bo takes 1 damage' }));
    fixture.detectChanges();
    expect(el.querySelector('.waiting')).toBeNull();
    expect(el.querySelectorAll('.change')).toHaveLength(1);
    expect(el.querySelector('.outcome')!.textContent).toContain('Bo takes 1 damage');
  });

  it('has a View Board button in the title row', () => {
    const { el } = render(skillDescription());
    expect(el.querySelector('.title-row app-minimize-button button.minimize')).not.toBeNull();
  });

  it('renders nothing while there is no description', () => {
    const { el } = render(null);
    expect(el.querySelector('.source')).toBeNull();
  });
});
