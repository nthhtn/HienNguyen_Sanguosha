import { Routes } from '@angular/router';
import { requireSignIn } from './auth/require-sign-in';
import { playRedirect } from './play-redirect';

// Lazy-loaded so the initial bundle carries only the shell; each screen pulls
// in its own Material modules and game code when first visited.
export const routes: Routes = [
  { path: 'setup', loadComponent: () => import('./setup/setup').then((m) => m.Setup) },
  { path: 'game', loadComponent: () => import('./game-board/game-board').then((m) => m.GameBoard) },
  // Never renders: the guard always redirects to /game or /setup.
  { path: 'play', canActivate: [playRedirect], children: [] },
  { path: 'wiki', loadChildren: () => import('./wiki/wiki.routes').then((m) => m.WIKI_ROUTES) },
  { path: 'rooms', canActivate: [requireSignIn], loadComponent: () => import('./online/rooms-page').then((m) => m.RoomsPage) },
  { path: 'sign-in', loadComponent: () => import('./auth/sign-in').then((m) => m.SignIn) },
  { path: 'sign-up', loadComponent: () => import('./auth/sign-up').then((m) => m.SignUp) },
  { path: 'guest', loadComponent: () => import('./auth/guest').then((m) => m.PlayAsGuest) },
  { path: 'forgot-password', loadComponent: () => import('./auth/forgot-password').then((m) => m.ForgotPassword) },
  { path: 'reset-password', loadComponent: () => import('./auth/reset-password').then((m) => m.ResetPassword) },
  { path: '', redirectTo: 'setup', pathMatch: 'full' },
];
