import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { ChatMessage } from 'protocol';
import { ChatPanel } from './chat-panel';
import { ChatService } from './chat.service';
import { chatMessage } from './testing';

function fakeChat() {
  return { messages: signal<ChatMessage[]>([]), error: signal<string | null>(null), send: jest.fn(async (_body: string) => true) };
}

describe('ChatPanel', () => {
  let chat: ReturnType<typeof fakeChat>;

  async function render(inputs: { you?: string | null; canSend?: boolean } = {}) {
    await TestBed.configureTestingModule({ imports: [ChatPanel], providers: [{ provide: ChatService, useValue: chat }] }).compileComponents();
    const fixture = TestBed.createComponent(ChatPanel);
    fixture.componentRef.setInput('you', inputs.you ?? 'p-ann');
    fixture.componentRef.setInput('canSend', inputs.canSend ?? true);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const input = () => el.querySelector('input.draft') as HTMLInputElement;
    const type = (text: string) => {
      input().value = text;
      input().dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    const submit = async () => {
      el.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
      await fixture.whenStable();
      fixture.detectChanges();
    };
    const button = () => el.querySelector('button.send') as HTMLButtonElement;
    return { fixture, el, input, type, submit, button };
  }

  beforeEach(() => {
    chat = fakeChat();
  });

  it('says there are no messages yet', async () => {
    const { el } = await render();
    expect(el.querySelector('.empty')?.textContent?.trim()).toBe('No messages yet');
  });

  it('shows each message with its author, and marks your own', async () => {
    chat.messages.set([chatMessage(1, 'Bo', 'hi Ann'), chatMessage(2, 'Ann', 'hi Bo')]);
    const { el } = await render();
    const rows = [...el.querySelectorAll('li.message')];
    expect(rows.map((r) => [r.querySelector('.author')?.textContent?.trim(), r.querySelector('.body')?.textContent?.trim()])).toEqual([
      ['Bo', 'hi Ann'],
      ['Ann', 'hi Bo'],
    ]);
    expect(rows.map((r) => r.classList.contains('mine'))).toEqual([false, true]);
  });

  it('shows message text as text, never as markup', async () => {
    chat.messages.set([chatMessage(1, 'Bo', '<img src=x onerror=alert(1)>')]);
    const { el } = await render();
    expect(el.querySelector('li.message img')).toBeNull();
    expect(el.querySelector('li.message .body')?.textContent).toBe('<img src=x onerror=alert(1)>');
  });

  it('sends the trimmed text and clears the input once it was sent', async () => {
    const { input, type, submit } = await render();
    type('  hello there  ');
    await submit();
    expect(chat.send).toHaveBeenCalledWith('hello there');
    expect(input().value).toBe('');
  });

  it('keeps the text when the server refuses it, and shows why', async () => {
    chat.send.mockResolvedValue(false);
    chat.error.set('You are sending messages too fast. Wait a moment');
    const { el, input, type, submit } = await render();
    type('hello');
    await submit();
    expect(input().value).toBe('hello');
    expect(el.querySelector('.error')?.textContent?.trim()).toBe('You are sending messages too fast. Wait a moment');
  });

  it('sends nothing for an empty or blank message', async () => {
    const { type, submit, button } = await render();
    expect(button().disabled).toBe(true);
    type('   ');
    await submit();
    expect(chat.send).not.toHaveBeenCalled();
  });

  it('limits the input to 300 characters', async () => {
    const { input } = await render();
    expect(input().getAttribute('maxlength')).toBe('300');
  });

  it('disables typing and sending while it cannot send', async () => {
    const { input, type, submit, button } = await render({ canSend: false });
    expect(input().disabled).toBe(true);
    expect(button().disabled).toBe(true);
    type('hello');
    await submit();
    expect(chat.send).not.toHaveBeenCalled();
  });

  it('sends once when submitted twice before the server answers', async () => {
    let finish!: (ok: boolean) => void;
    chat.send.mockReturnValue(new Promise<boolean>((resolve) => (finish = resolve)));
    const { fixture, type, el } = await render();
    type('hello');
    const form = el.querySelector('form')!;
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    finish(true);
    await fixture.whenStable();
    expect(chat.send).toHaveBeenCalledTimes(1);
  });
});
