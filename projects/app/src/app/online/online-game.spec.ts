import { Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { DecisionTimer } from '../decision-timer.service';
import { GameBoard } from '../game-board/game-board';
import { OnlineGame } from './online-game';
import { RemoteDecisionClock, RemoteGameService } from './remote-game.service';
import { SocketService, WEB_SOCKET_FACTORY } from './socket.service';
import { FakeSocket, gameUpdates, PLAYING, ROOM, welcome } from './testing';

@Component({ selector: 'app-clock-probe', template: '' })
class ClockProbe {
  readonly timer = inject(DecisionTimer);
}

describe('OnlineGame', () => {
  let socket: FakeSocket;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [OnlineGame],
      providers: [
        SocketService,
        RemoteGameService,
        RemoteDecisionClock,
        { provide: WEB_SOCKET_FACTORY, useValue: (url: string) => (socket = new FakeSocket(url)) },
        provideRouter([]),
      ],
    });
    // Created before the welcome arrives, as LobbyPage creates it before it connects.
    TestBed.inject(RemoteGameService);
    TestBed.inject(SocketService).connect(ROOM.id);
    socket.serverOpens();
    socket.serverSends(welcome(PLAYING, 'p-ann', gameUpdates()[0]));
  });

  it("shows the shared board on the server's game, from the player's own seat", async () => {
    const fixture = TestBed.createComponent(OnlineGame);
    fixture.detectChanges();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-game-board app-general-selection')).not.toBeNull();
    expect(el.querySelector('app-reveal-gate-overlay')).toBeNull();
  });

  it('lets the dialogs the board opens find the online clock', async () => {
    const fixture = TestBed.createComponent(OnlineGame);
    fixture.detectChanges();
    await fixture.whenStable();
    const dialog = fixture.debugElement.query(By.directive(GameBoard)).injector.get(MatDialog);
    const ref = dialog.open(ClockProbe);
    expect(ref.componentInstance.timer).toBe(TestBed.inject(RemoteDecisionClock));
    ref.close();
  });
});
