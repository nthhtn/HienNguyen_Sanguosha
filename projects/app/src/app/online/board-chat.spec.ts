import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { ChatMessage } from 'protocol';
import { BoardChat } from './board-chat';
import { ChatService } from './chat.service';
import { chatMessage } from './testing';

function fakeChat(initial: ChatMessage[] = []) {
  return { messages: signal<ChatMessage[]>(initial), error: signal<string | null>(null), send: jest.fn(async (_body: string) => true) };
}

describe('BoardChat', () => {
  async function render(chat: ReturnType<typeof fakeChat>) {
    await TestBed.configureTestingModule({ imports: [BoardChat], providers: [{ provide: ChatService, useValue: chat }] }).compileComponents();
    const fixture = TestBed.createComponent(BoardChat);
    fixture.componentRef.setInput('you', 'p-ann');
    fixture.componentRef.setInput('canSend', true);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const toggle = () => el.querySelector('button.chat-toggle') as HTMLButtonElement | null;
    const unread = () => el.querySelector('.unread')?.textContent?.trim() ?? null;
    const click = (button: HTMLButtonElement | null) => {
      button!.click();
      fixture.detectChanges();
    };
    const arrive = (...messages: ChatMessage[]) => {
      chat.messages.update((all) => [...all, ...messages]);
      fixture.detectChanges();
    };
    return { fixture, el, toggle, unread, click, arrive };
  }

  it('starts closed: a Chat toggle and no panel', async () => {
    const { el, toggle } = await render(fakeChat());
    expect(toggle()?.textContent).toContain('Chat');
    expect(toggle()?.getAttribute('aria-label')).toBe('Chat');
    expect(toggle()?.getAttribute('aria-expanded')).toBe('false');
    expect(el.querySelector('.drawer')).toBeNull();
    expect(el.querySelector('app-chat-panel')).toBeNull();
  });

  it('counts messages from others that arrive while it is closed, and not your own', async () => {
    const { toggle, unread, arrive } = await render(fakeChat());
    expect(unread()).toBeNull();
    arrive(chatMessage(1, 'Bo', 'hi'));
    arrive(chatMessage(2, 'Ann', 'my own message'));
    arrive(chatMessage(3, 'Cy', 'hello'));
    expect(unread()).toBe('2');
    expect(toggle()?.getAttribute('aria-label')).toBe('Chat, 2 unread');
  });

  it('does not count the history it started with (Review Focus 5)', async () => {
    const { unread, arrive } = await render(fakeChat([chatMessage(1, 'Bo', 'old'), chatMessage(2, 'Cy', 'older')]));
    expect(unread()).toBeNull();
    arrive(chatMessage(3, 'Bo', 'new'));
    expect(unread()).toBe('1');
  });

  it('opens the panel with Close Chat, hides the toggle, and clears the count', async () => {
    const { el, toggle, unread, click, arrive } = await render(fakeChat());
    arrive(chatMessage(1, 'Bo', 'hi'));
    click(toggle());
    expect(el.querySelector('.drawer app-chat-panel')).not.toBeNull();
    expect(el.querySelector('.drawer h2')?.textContent?.trim()).toBe('Chat');
    expect(toggle()).toBeNull();
    expect(unread()).toBeNull();
    arrive(chatMessage(2, 'Bo', 'while open'));
    expect(unread()).toBeNull();
  });

  it('closes again, and a message that arrived while open is not unread', async () => {
    const { el, toggle, unread, click, arrive } = await render(fakeChat());
    click(toggle());
    arrive(chatMessage(1, 'Bo', 'while open'));
    click(el.querySelector('button.close-chat') as HTMLButtonElement);
    expect(el.querySelector('.drawer')).toBeNull();
    expect(unread()).toBeNull();
    arrive(chatMessage(2, 'Bo', 'after closing'));
    expect(unread()).toBe('1');
  });
});
