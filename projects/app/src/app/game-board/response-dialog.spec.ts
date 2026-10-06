import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Action, CardInstance } from 'engine';
import { ResponseDialog, ResponseDialogData } from './response-dialog';

const shan: CardInstance = { instanceId: 'shan-1', definitionId: 'shan', suit: 'heart', rank: 2 };
const respond: Action = { kind: 'RespondAction', seatId: 'seat-0', pendingResponseId: 'w1', cardInstanceId: 'shan-1' };
const pass: Action = { kind: 'PassAction', seatId: 'seat-0', pendingResponseId: 'w1' };
const description = {
  source: 'Seat 1 played Sha against Hing', latest: null, prompt: 'Your turn to respond to Sha', outcome: 'You lose 1 HP (1 damage from Seat 1)', outcomeForce: 'Shu' as const,
};

function render(cards: ResponseDialogData['cards'], skills: ResponseDialogData['skills'] = [], startOnNoResponse = false) {
  const close = jest.fn();
  TestBed.configureTestingModule({
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: { description, cards, skills, noResponse: pass, startOnNoResponse } satisfies ResponseDialogData },
      { provide: MatDialogRef, useValue: { close } },
    ],
  });
  const fixture = TestBed.createComponent(ResponseDialog);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const confirm = () => el.querySelector('button.confirm') as HTMLButtonElement;
  const pick = (selector: string) => {
    (el.querySelector(`${selector} input`) as HTMLInputElement).click();
    fixture.detectChanges();
  };
  return { el, confirm, pick, close };
}

describe('ResponseDialog', () => {
  it('describes the source, the prompt and what No Response costs', () => {
    const { el } = render([]);
    expect(el.querySelector('.source')!.textContent).toContain('Seat 1 played Sha against Hing');
    expect(el.querySelector('.prompt')!.textContent).toContain('Your turn to respond to Sha');
    expect(el.querySelector('.no-response')!.textContent).toContain('You lose 1 HP (1 damage from Seat 1)');
    // In the force colour of the player it befalls.
    expect(el.querySelector('.outcome')!.classList).toContain('force-status');
    expect(el.querySelector('.outcome')!.getAttribute('data-force')).toBe('Shu');
  });

  it('lists the answering cards and an empty skills list', () => {
    const { el } = render([{ id: 'shan-1', action: respond, card: shan, label: 'Shan (2 ♥)' }]);
    expect(el.querySelectorAll('.card-option')).toHaveLength(1);
    // The same card face as in the hand: name strip and suit-and-number badge.
    expect(el.querySelector('.card-option app-playing-card .name')!.textContent).toBe('Shan');
    expect(el.querySelector('.card-option app-playing-card .face')!.textContent).toBe('2 ♥');
    expect(el.querySelector('.card-option input')!.getAttribute('aria-label')).toBe('Shan (2 ♥)');
    expect(el.textContent).toContain('No skills can respond');
  });

  it('starts on No Response, which is the only choice when nothing can answer', () => {
    const { el, confirm, close } = render([]);
    expect(el.textContent).toContain('No cards can respond');
    expect(confirm().textContent!.trim()).toBe('No Response');
    confirm().click();
    expect(close).toHaveBeenCalledWith(pass);
  });

  it('starts on the first card when no skill can respond', () => {
    const shan2: CardInstance = { instanceId: 'shan-2', definitionId: 'shan', suit: 'club', rank: 5 };
    const { confirm, close } = render([
      { id: 'shan-1', action: respond, card: shan, label: 'Shan (2 ♥)' },
      { id: 'shan-2', action: { ...respond, cardInstanceId: 'shan-2' }, card: shan2, label: 'Shan (5 ♣)' },
    ]);
    expect(confirm().textContent!.trim()).toBe('Respond with Shan');
    confirm().click();
    expect(close).toHaveBeenCalledWith(respond);
  });

  it('starts on No Response when asked to, even with an answering card (a Wuxie question)', () => {
    const { confirm, close } = render([{ id: 'shan-1', action: respond, card: shan, label: 'Shan (2 ♥)' }], [], true);
    expect(confirm().textContent!.trim()).toBe('No Response');
    confirm().click();
    expect(close).toHaveBeenCalledWith(pass);
  });

  it('starts on the first skill when a skill can respond, ahead of any card', () => {
    const skillAction: Action = { kind: 'RespondAction', seatId: 'seat-0', pendingResponseId: 'w1', cardInstanceId: 'skill-proxy' };
    const { el, confirm, close } = render(
      [{ id: 'shan-1', action: respond, card: shan, label: 'Shan (2 ♥)' }],
      [{ id: 'skill-1', action: skillAction, label: 'Eight Trigrams' }]
    );
    expect(el.querySelector('.skill-option')!.textContent).toContain('Eight Trigrams');
    expect(confirm().textContent!.trim()).toBe('Respond with Eight Trigrams');
    confirm().click();
    expect(close).toHaveBeenCalledWith(skillAction);
  });

  it('responds with the picked card, and can switch back to No Response', () => {
    const { confirm, pick, close } = render([{ id: 'shan-1', action: respond, card: shan, label: 'Shan (2 ♥)' }]);
    expect(confirm().textContent!.trim()).toBe('Respond with Shan');
    pick('.no-response');
    expect(confirm().textContent!.trim()).toBe('No Response');
    pick('.card-option');
    confirm().click();
    expect(close).toHaveBeenCalledWith(respond);
  });

  it('lists the General skills first, then the cards, then No Response', () => {
    const { el } = render([{ id: 'shan-1', action: respond, card: shan, label: 'Shan (2 ♥)' }]);
    const order = [...el.querySelectorAll('h3, .option')].map((n) =>
      n.tagName === 'H3' ? n.textContent!.trim() : n.classList.contains('skill-option') ? 'skill' : n.classList.contains('card-option') ? 'card' : 'no-response'
    );
    expect(order).toEqual(['Skills', 'Cards', 'card', 'no-response']);
  });

  it('offers no way out other than the primary button', () => {
    const { el } = render([]);
    expect(el.querySelectorAll('mat-dialog-actions button')).toHaveLength(1);
  });
});
