import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { Action, CardInstance, ContentRegistry, GameState } from 'engine';
import { englishTranslator } from '../i18n/translator';
import { CardInfoDialog } from './card-info-dialog';
import { HandCardActions, handCardViewModels } from './hand-card-actions';

const registry: ContentRegistry = { generals: new Map(), cards: new Map([['peach', { id: 'peach', name: 'Peach', category: 'basic' as const, play: () => [] }]]) };
const peach: CardInstance = { instanceId: 'p1', definitionId: 'peach', suit: 'heart', rank: 3 };
const state = { seats: [], players: [], zones: [] } as unknown as GameState;
const eat: Action = { kind: 'PlayCardAction', seatId: 'seat-0', cardInstanceId: 'p1', targets: [] } as Action;

describe('HandCardActions', () => {
  function render(legal: Action[]) {
    const open = jest.fn();
    TestBed.configureTestingModule({ providers: [{ provide: MatDialog, useValue: { open } }] });
    const fixture = TestBed.createComponent(HandCardActions);
    fixture.componentRef.setInput('vm', handCardViewModels([peach], legal, state, registry, englishTranslator)[0]);
    fixture.componentRef.setInput('state', state);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement, open };
  }

  it('plays a card with one legal action at once', () => {
    const { fixture, el } = render([eat]);
    const played: Action[] = [];
    fixture.componentInstance.played.subscribe((a) => played.push(a));
    (el.querySelector('button.play') as HTMLButtonElement).click();
    expect(played).toEqual([eat]);
  });

  it('shows only Info for a card that cannot be played, and Info opens the card window', () => {
    const { el, open } = render([]);
    expect(el.querySelector('button.play')).toBeNull();
    (el.querySelector('button.info') as HTMLButtonElement).click();
    expect(open).toHaveBeenCalledWith(CardInfoDialog, expect.objectContaining({ data: expect.objectContaining({ card: peach }) }));
  });
});
