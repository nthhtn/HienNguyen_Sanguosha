import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { ChatMessage } from 'protocol';
import type { CardInstance } from 'engine';
import { Layout } from '../layout.service';
import { BoardChatState } from '../online/board-chat-state.service';
import { ChatService } from '../online/chat.service';
import { BoardPanel } from './board-panel';

const sha: CardInstance = { instanceId: 'c1', definitionId: 'sha', suit: 'spade', rank: 7 };
const shan: CardInstance = { instanceId: 'c2', definitionId: 'shan', suit: 'heart', rank: 2 };

describe('BoardPanel', () => {
  function render(options: { chat?: boolean; phone?: boolean; drawPileCount?: number | null; cards?: boolean } = {}) {
    const providers: unknown[] = [
      { provide: Layout, useValue: { toolbarHidden: signal(options.phone ?? false) } },
      { provide: ChatService, useValue: { messages: signal<ChatMessage[]>([]), error: signal(null), send: jest.fn() } },
    ];
    if (options.chat) providers.push(BoardChatState);
    TestBed.configureTestingModule({ providers: providers as never[] });
    const state = options.chat ? TestBed.inject(BoardChatState) : null;
    state?.setAvailable(true);
    const fixture = TestBed.createComponent(BoardPanel);
    fixture.componentRef.setInput('actionHistory', options.cards ? [{ kind: 'action', text: 'Seat 1 used Slash (7 ♠)', card: sha }] : []);
    fixture.componentRef.setInput('discardHistory', options.cards ? [{ kind: 'card', card: shan, inPile: true }] : []);
    if (options.drawPileCount !== undefined) fixture.componentRef.setInput('drawPileCount', options.drawPileCount);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const tabs = () => [...el.querySelectorAll('[role="tab"]')] as HTMLElement[];
    return { fixture, el, state, tabs };
  }

  it('shows the Draw Pile count above the tabs when given one, and nothing when not', () => {
    expect(render({ drawPileCount: 54 }).el.querySelector('.draw-pile')!.textContent).toContain('Draw Pile 54');
    TestBed.resetTestingModule();
    expect(render().el.querySelector('.draw-pile')).toBeNull();
  });

  it('has two tabs with no chat, or off the phone board', () => {
    expect(render().tabs()).toHaveLength(2);
    TestBed.resetTestingModule();
    expect(render({ chat: true, phone: false }).tabs()).toHaveLength(2);
  });

  it('adds a Chat tab in an online room on the phone board, and opening it makes the chat open', async () => {
    const { fixture, el, state, tabs } = render({ chat: true, phone: true });
    expect(tabs().map((t) => t.textContent!.trim())).toEqual(['Action History', 'Discard Pile', 'Chat']);
    expect(state!.open()).toBe(false);
    tabs()[2].click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.querySelector('app-chat-panel')).not.toBeNull();
    expect(state!.open()).toBe(true);
    tabs()[0].click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(state!.open()).toBe(false);
  });

  it('is not viewing the chat once the panel is gone', async () => {
    const { fixture, state, tabs } = render({ chat: true, phone: true });
    tabs()[2].click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(state!.open()).toBe(true);
    fixture.destroy();
    expect(state!.open()).toBe(false);
  });

  describe('card info', () => {
    const settle = async (fixture: { whenStable(): Promise<unknown>; detectChanges(): void }) => {
      await fixture.whenStable();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    };

    it('shows a Card Info tab with the card when a card in the history is pressed', async () => {
      const { fixture, el, tabs } = render({ cards: true });
      expect(tabs()).toHaveLength(2);
      (el.querySelector('button.entry-card') as HTMLButtonElement).click();
      await settle(fixture);
      expect(tabs().map((t) => t.textContent!.trim())).toEqual(['Action History', 'Discard Pile', 'Card Info']);
      expect(tabs()[2].getAttribute('aria-selected')).toBe('true');
      expect(el.querySelector('app-card-info-pane')!.textContent).toContain('Slash');
    });

    it('does the same for a card in the discard list, with the chat tab keeping its place', async () => {
      const { fixture, el, tabs } = render({ cards: true, chat: true, phone: true });
      tabs()[1].click();
      await settle(fixture);
      (el.querySelector('button.card') as HTMLButtonElement).click();
      await settle(fixture);
      expect(tabs().map((t) => t.textContent!.trim())).toEqual(['Action History', 'Discard Pile', 'Chat', 'Card Info']);
      expect(tabs()[3].getAttribute('aria-selected')).toBe('true');
      expect(el.querySelector('app-card-info-pane')!.textContent).toContain('Dodge');
    });

    it('goes back to the tab it came from when the same card is pressed again', async () => {
      const { fixture, el, tabs } = render({ cards: true });
      tabs()[1].click();
      await settle(fixture);
      (el.querySelector('button.card') as HTMLButtonElement).click();
      await settle(fixture);
      tabs()[1].click();
      await settle(fixture);
      (el.querySelector('button.card') as HTMLButtonElement).click();
      await settle(fixture);
      expect(tabs()).toHaveLength(2);
      expect(tabs()[1].getAttribute('aria-selected')).toBe('true');
    });
  });
});
