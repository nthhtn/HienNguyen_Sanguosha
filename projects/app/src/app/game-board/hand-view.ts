import { Component, DestroyRef, ElementRef, computed, inject, input, output, signal } from '@angular/core';
import { Action, CardInstance, ContentRegistry, GameState } from 'engine';
import { PlayingCard } from './playing-card';
import { HandCardActions, handCardViewModels } from './hand-card-actions';
import { I18n } from '../i18n/i18n.service';
import { TPipe } from '../i18n/t.pipe';

// The viewer's own hand as one row of cards. Hovering (or focusing, for touch)
// a card reveals its Play button (only when the card can be played), from the engine's legal actions for that card
// only, and Info. Discards and responses have their own dialogs.
// A hand card's width at its normal size, and the gap between cards in a row (styles below).
const CARD_WIDTH = 70;
const CARD_GAP = 8;

// The overlapping row's side padding (styles below: 4 px each side), which the cards cannot use.
const OVERLAP_ROW_PADDING = 8;

// The width the cards of an overlapping hand can use, from the hand's measured width.
export function overlapWidth(hostWidth: number): number {
  return Math.max(0, hostWidth - OVERLAP_ROW_PADDING);
}

// How far apart the left edges of neighbouring hand cards are: a card's width and the gap when they all fit, closer
// (overlapping) when they do not, but never closer than minStrip, and then the row scrolls.
export function handStep(width: number, count: number, cardWidth: number, gap: number, minStrip = 44): { step: number; scrolls: boolean } {
  const natural = cardWidth + gap;
  if (count <= 1) return { step: natural, scrolls: false };
  const fitting = (width - cardWidth) / (count - 1);
  if (fitting >= natural) return { step: natural, scrolls: false };
  if (fitting < minStrip) return { step: minStrip, scrolls: true };
  return { step: fitting, scrolls: false };
}

@Component({
  selector: 'app-hand-view',
  imports: [PlayingCard, HandCardActions, TPipe],
  template: `
    <div class="hand-row" role="list" [class.overlap]="fit() === 'overlap'">
      @for (vm of cardViewModels(); track vm.card.instanceId; let first = $first) {
        <div
          class="hand-card"
          role="listitem"
          tabindex="0"
          [attr.data-card-id]="vm.card.instanceId"
          [class.picked]="vm.card.instanceId === pickedId()"
          [style.margin-left.px]="first ? null : overlapMargin()"
          (click)="tap(vm.card.instanceId)"
          (keydown.enter)="tap(vm.card.instanceId)"
          (keydown.space)="tap(vm.card.instanceId); $event.preventDefault()"
        >
          <app-playing-card [card]="vm.card" />
          @if (fit() === 'row') {
            <div class="overlay">
              <app-hand-card-actions [vm]="vm" [state]="state()" (played)="played.emit($event)" />
            </div>
          }
        </div>
      } @empty {
        <span class="empty">{{ 'hand.empty' | t }}</span>
      }
    </div>
  `,
  styles: `
    .hand-row {
      display: flex;
      flex-wrap: nowrap;
      gap: 8px;
      overflow-x: auto;
      padding: 16px 4px 8px;
    }
    .hand-card {
      position: relative;
      flex: 0 0 auto;
      border-radius: 6px;
      transition: transform 150ms;
      outline: none;
    }
    .hand-card:hover,
    .hand-card:focus-within { transform: translateY(-10px); }
    .overlay {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 6px;
      padding: 6px;
      border-radius: 6px;
      background: rgb(0 0 0 / 55%);
      opacity: 0;
      pointer-events: none;
      transition: opacity 150ms;
    }
    .hand-card:hover .overlay,
    .hand-card:focus-within .overlay { opacity: 1; pointer-events: auto; }
    .overlay ::ng-deep button {
      min-width: 0;
      height: 32px;
      padding: 0 6px;
      font-size: 12px;
      --mat-button-outlined-label-text-color: #fff;
    }
    .overlay ::ng-deep mat-icon { margin-right: 2px; font-size: 18px; width: 18px; height: 18px; }
    .empty { color: var(--mat-sys-on-surface-variant); }
    /* Medium layout: a shorter row. */
    :host-context([data-layout='medium']) .hand-row { padding: 12px 4px 0; }
    /* Phone board: cards overlap when they do not fit (each card keeps at least 44 px showing, then the row scrolls). A
       tap picks a card (spec 3c): it lifts, is outlined and comes to the front; its buttons are in the action column. */
    .hand-row.overlap { gap: 0; padding: 12px 4px 0; }
    .hand-row.overlap .hand-card:hover,
    .hand-row.overlap .hand-card:focus-within { transform: none; }
    .hand-row.overlap .hand-card.picked { transform: translateY(-10px); z-index: 1; box-shadow: 0 0 0 3px #e0a92e; }
    .hand-row.overlap ::ng-deep app-playing-card .name {
      font-size: 14px; line-height: 1.1; white-space: normal; overflow-wrap: anywhere;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
    }
  `,
})
export class HandView {
  readonly cards = input.required<CardInstance[]>();
  // 'row': side by side, the row scrolls (the web board). 'overlap': the phone board's hand, see handStep.
  readonly fit = input<'row' | 'overlap'>('row');
  private readonly width = signal(0);
  protected readonly overlapMargin = computed(() =>
    this.fit() === 'overlap' ? handStep(overlapWidth(this.width()), this.cards().length, CARD_WIDTH, CARD_GAP).step - CARD_WIDTH : null
  );

  constructor() {
    // The overlap needs the row's width; jsdom has no ResizeObserver.
    if (typeof ResizeObserver !== 'function') return;
    const observer = new ResizeObserver(([entry]) => this.width.set(entry.contentRect.width));
    observer.observe(inject<ElementRef<HTMLElement>>(ElementRef).nativeElement);
    inject(DestroyRef).onDestroy(() => observer.disconnect());
  }
  readonly actions = input.required<Action[]>();
  readonly state = input.required<GameState>();
  readonly registry = input.required<ContentRegistry>();
  readonly played = output<Action>();
  // The phone board's picked card (its buttons are in the action column), and a tap that picks or puts back a card.
  readonly pickedId = input<string | null>(null);
  readonly picked = output<string | null>();

  protected tap(cardId: string): void {
    if (this.fit() !== 'overlap') return;
    this.picked.emit(cardId === this.pickedId() ? null : cardId);
  }

  private readonly i18n = inject(I18n);

  protected readonly cardViewModels = computed(() => handCardViewModels(this.cards(), this.actions(), this.state(), this.registry(), this.i18n.translator));
}
