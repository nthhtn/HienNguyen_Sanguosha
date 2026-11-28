import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { CardInstance } from 'engine';
import { CardInfoSplit } from './card-info-split';
import { setWindowSize } from '../layout.testing';

const sha: CardInstance = { instanceId: 'c1', definitionId: 'sha', suit: 'spade', rank: 7 };

@Component({
  imports: [CardInfoSplit],
  template: `<app-card-info-split [card]="card()" listLabel="Action History" (closed)="closed()"><p class="list">The list</p></app-card-info-split>`,
})
class Host {
  readonly card = signal<CardInstance | null>(null);
  readonly closed = jest.fn();
}

function setup(width: number) {
  setWindowSize(width, 900);
  const keys = new Subject<KeyboardEvent>();
  const backdrop = new Subject<MouseEvent>();
  const ref = { updateSize: jest.fn(), updatePosition: jest.fn(), disableClose: false, keydownEvents: () => keys, backdropClick: () => backdrop };
  TestBed.configureTestingModule({ providers: [{ provide: MatDialogRef, useValue: ref }] });
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const select = (card: CardInstance | null) => {
    fixture.componentInstance.card.set(card);
    fixture.detectChanges();
    TestBed.tick();
    fixture.detectChanges();
  };
  return { fixture, el, ref, keys, backdrop, select };
}

describe('CardInfoSplit on a wide window', () => {
  it('shows only the list until a card is selected', () => {
    const { el } = setup(1440);
    expect(el.querySelector('.list')).not.toBeNull();
    expect(el.querySelector('app-card-info-pane')).toBeNull();
    expect(el.querySelector('mat-tab-group')).toBeNull();
  });

  it('puts the card info to the left of the list, and grows the popup to the left', () => {
    const { el, ref, select } = setup(1440);
    select(sha);
    const info = el.querySelector('.split > .info')!;
    expect(info.querySelector('app-card-info-pane')).not.toBeNull();
    expect(info.nextElementSibling!.querySelector('.list')).not.toBeNull();
    expect(ref.updateSize).toHaveBeenCalled();
    expect(ref.updatePosition).toHaveBeenCalledWith(expect.objectContaining({ right: expect.stringMatching(/px$/) }));
  });

  it('lifts Material’s 560 px cap on the popup pane while it is grown, and puts it back after', () => {
    const { fixture, select } = setup(1440);
    const container = document.createElement('div');
    container.className = 'cdk-overlay-pane';
    container.appendChild(fixture.nativeElement);
    select(sha);
    expect(container.style.getPropertyValue('--mat-dialog-container-max-width')).toBe('none');
    select(null);
    expect(container.style.getPropertyValue('--mat-dialog-container-max-width')).toBe('');
  });

  it('puts the popup back where it was when the pane closes', () => {
    const { ref, select } = setup(1440);
    select(sha);
    ref.updatePosition.mockClear();
    select(null);
    expect(ref.updatePosition).toHaveBeenCalledWith();
  });

  it('asks to close from the pane button, from Escape and from a click outside, keeping the popup open meanwhile', () => {
    const { el, ref, keys, backdrop, fixture, select } = setup(1440);
    select(sha);
    expect(ref.disableClose).toBe(true);
    (el.querySelector('.info button.close') as HTMLButtonElement).click();
    keys.next(new KeyboardEvent('keydown', { key: 'Escape' }));
    backdrop.next(new MouseEvent('click'));
    expect(fixture.componentInstance.closed).toHaveBeenCalledTimes(3);
    select(null);
    expect(ref.disableClose).toBe(false);
  });
});

describe('CardInfoSplit on a narrow window', () => {
  it('shows the list in a tab and a Card Info tab that stays disabled until a card is selected', () => {
    const { el } = setup(1000);
    const tabs = [...el.querySelectorAll('[role="tab"]')];
    expect(tabs.map((t) => t.textContent!.trim())).toEqual(['Action History', 'Card Info']);
    expect(tabs[1].getAttribute('aria-disabled')).toBe('true');
    expect(el.querySelector('.split')).toBeNull();
  });

  it('switches to the Card Info tab when a card is selected, and back to the list when it is cleared', () => {
    const { el, ref, select } = setup(1000);
    select(sha);
    const tabs = [...el.querySelectorAll('[role="tab"]')];
    expect(tabs[1].getAttribute('aria-selected')).toBe('true');
    expect(el.querySelector('app-card-info-pane')).not.toBeNull();
    expect(ref.updateSize).not.toHaveBeenCalled();
    select(null);
    expect([...el.querySelectorAll('[role="tab"]')][0].getAttribute('aria-selected')).toBe('true');
  });
});
