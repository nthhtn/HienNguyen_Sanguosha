import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { ChatMessage } from 'protocol';
import { Layout } from '../layout.service';
import { BoardChatState } from '../online/board-chat-state.service';
import { ChatService } from '../online/chat.service';
import { BoardPanel } from './board-panel';

describe('BoardPanel', () => {
  function render(options: { chat?: boolean; phone?: boolean; drawPileCount?: number | null } = {}) {
    const providers: unknown[] = [
      { provide: Layout, useValue: { toolbarHidden: signal(options.phone ?? false) } },
      { provide: ChatService, useValue: { messages: signal<ChatMessage[]>([]), error: signal(null), send: jest.fn() } },
    ];
    if (options.chat) providers.push(BoardChatState);
    TestBed.configureTestingModule({ providers: providers as never[] });
    const state = options.chat ? TestBed.inject(BoardChatState) : null;
    state?.setAvailable(true);
    const fixture = TestBed.createComponent(BoardPanel);
    fixture.componentRef.setInput('actionHistory', []);
    fixture.componentRef.setInput('discardHistory', []);
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
});
