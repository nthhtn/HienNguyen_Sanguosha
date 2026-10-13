import { Dialog } from '@angular/cdk/dialog';
import { Component } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { DecisionTimer } from '../decision-timer.service';
import { GameService } from '../game.service';
import { GameBoard } from '../game-board/game-board';
import { RemoteDecisionClock, RemoteGameService } from './remote-game.service';

// The running game on the shared board. GameBoard and its children are the
// local ones, unchanged: under this component, GameService is the server's
// game and DecisionTimer its clock. The board's dialogs open through this
// component's own Dialog and MatDialog, so they find the same two (a root
// MatDialog would give them the local ones).
@Component({
  selector: 'app-online-game',
  imports: [GameBoard],
  providers: [{ provide: GameService, useExisting: RemoteGameService }, { provide: DecisionTimer, useExisting: RemoteDecisionClock }, Dialog, MatDialog],
  template: `<app-game-board />`,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class OnlineGame {}
