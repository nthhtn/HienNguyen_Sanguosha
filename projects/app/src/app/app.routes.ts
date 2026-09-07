import { Component } from '@angular/core';
import { Routes } from '@angular/router';
import { Setup } from './setup/setup';

// Placeholder until Task 11 creates the real GameBoard component.
@Component({ selector: 'app-game-board-placeholder', template: `<p>Game board coming in Task 11.</p>` })
class GameBoardPlaceholder {}

export const routes: Routes = [
  { path: 'setup', component: Setup },
  { path: 'game', component: GameBoardPlaceholder },
  { path: '', redirectTo: 'setup', pathMatch: 'full' },
];
