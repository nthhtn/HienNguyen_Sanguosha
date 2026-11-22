import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { ChatMessage } from 'protocol';
import { BoardChatState } from './board-chat-state.service';
import { ChatService } from './chat.service';
import { chatMessage } from './testing';

describe('BoardChatState', () => {
  function setup(initial: ChatMessage[] = []) {
    const messages = signal<ChatMessage[]>(initial);
    TestBed.configureTestingModule({ providers: [BoardChatState, { provide: ChatService, useValue: { messages } }] });
    const state = TestBed.inject(BoardChatState);
    state.setYou('p-ann');
    return { state, messages };
  }

  it("counts others' messages that arrive while it is closed, not the history or your own", () => {
    const { state, messages } = setup([chatMessage(1, 'Bo', 'old')]);
    expect(state.unread()).toBe(0);
    messages.update((all) => [...all, chatMessage(2, 'Ann', 'mine'), chatMessage(3, 'Cy', 'new')]);
    expect(state.unread()).toBe(1);
  });

  it('counts nothing while open, and opening marks everything seen', () => {
    const { state, messages } = setup();
    messages.update((all) => [...all, chatMessage(1, 'Bo', 'hi')]);
    state.toggle();
    expect(state.open()).toBe(true);
    expect(state.unread()).toBe(0);
    state.toggle();
    expect(state.unread()).toBe(0);
  });

  it('is available only while a board chat says so', () => {
    const { state } = setup();
    expect(state.available()).toBe(false);
    state.setAvailable(true);
    expect(state.available()).toBe(true);
  });
});
