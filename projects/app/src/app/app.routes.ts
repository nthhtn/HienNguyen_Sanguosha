import { Routes } from '@angular/router';
import { playRedirect } from './play-redirect';

// Lazy-loaded so the initial bundle carries only the shell; each screen pulls
// in its own Material modules and game code when first visited.
export const routes: Routes = [
  { path: 'setup', loadComponent: () => import('./setup/setup').then((m) => m.Setup) },
  { path: 'game', loadComponent: () => import('./game-board/game-board').then((m) => m.GameBoard) },
  // Never renders: the guard always redirects to /game or /setup.
  { path: 'play', canActivate: [playRedirect], children: [] },
  { path: 'wiki', loadChildren: () => import('./wiki/wiki.routes').then((m) => m.WIKI_ROUTES) },
  { path: '', redirectTo: 'setup', pathMatch: 'full' },
];
