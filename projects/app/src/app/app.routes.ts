import { Routes } from '@angular/router';
import { Setup } from './setup/setup';
import { GameBoard } from './game-board/game-board';

export const routes: Routes = [
  { path: 'setup', component: Setup },
  { path: 'game', component: GameBoard },
  { path: '', redirectTo: 'setup', pathMatch: 'full' },
];
