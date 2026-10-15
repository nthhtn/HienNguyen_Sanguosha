import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { LobbyPage } from './lobby-page';
import { OnlineGame } from './online-game';
import { WEB_SOCKET_FACTORY } from './socket.service';
import { chatMessage, FakeSocket, ROOM, welcome } from './testing';

// The Lobby with its real services: the chat history in the first welcome
// must reach the panel, which only renders after that welcome.
describe('LobbyPage chat wiring', () => {
  it('shows the history that came with the first welcome', async () => {
    let socket!: FakeSocket;
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: 'rooms/:id', component: LobbyPage }]), { provide: WEB_SOCKET_FACTORY, useValue: (url: string) => (socket = new FakeSocket(url)) }],
    });
    TestBed.overrideComponent(OnlineGame, { set: { imports: [], providers: [], template: '' } });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(`/rooms/${ROOM.id}`, LobbyPage);
    socket.serverOpens();
    socket.serverSends(welcome(ROOM, 'p-ann', null, [chatMessage(1, 'Bo', 'hi')]));
    harness.detectChanges();
    const el = harness.routeNativeElement as HTMLElement;
    expect(el.querySelector('section.chat li.message .body')?.textContent?.trim()).toBe('hi');
  });
});
