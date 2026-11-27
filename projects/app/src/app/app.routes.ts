import { inject } from '@angular/core';
import { Router, Routes } from '@angular/router';
import { requireSignIn } from './auth/require-sign-in';
import { offlineOnly, tutorialEnabled } from './feature-flags';
import { DEV_ROUTES } from './dev/dev-routes';
import { homeRedirect } from './home-redirect';
import { playRedirect } from './play-redirect';

// Lazy-loaded so the initial bundle carries only the shell; each screen pulls
// in its own Material modules and game code when first visited.
export const routes: Routes = [
  ...DEV_ROUTES,
  { path: 'setup', canActivate: [offlineOnly], loadComponent: () => import('./setup/setup').then((m) => m.Setup) },
  { path: 'game', canActivate: [offlineOnly], loadComponent: () => import('./game-board/game-board').then((m) => m.GameBoard) },
  // Never renders: the guard always redirects to /game or /setup.
  { path: 'tutorial', canActivate: [tutorialEnabled], loadComponent: () => import('./tutorial/tutorial-page').then((m) => m.TutorialPage) },
  { path: 'play', canActivate: [offlineOnly, playRedirect], children: [] },
  { path: 'wiki', loadChildren: () => import('./wiki/wiki.routes').then((m) => m.WIKI_ROUTES) },
  { path: 'rooms', canActivate: [requireSignIn], loadComponent: () => import('./online/rooms-page').then((m) => m.RoomsPage) },
  { path: 'rooms/:id', canActivate: [requireSignIn], loadComponent: () => import('./online/lobby-page').then((m) => m.LobbyPage) },
  { path: 'profile', canActivate: [requireSignIn], loadComponent: () => import('./profile/profile-page').then((m) => m.ProfilePage) },
  // My Games is the Profile's History tab now; old links still land on it.
  { path: 'my-games', redirectTo: () => inject(Router).parseUrl('/profile?tab=history') },
  { path: 'sign-in', loadComponent: () => import('./auth/sign-in').then((m) => m.SignIn) },
  { path: 'sign-up', loadComponent: () => import('./auth/sign-up').then((m) => m.SignUp) },
  { path: 'guest', loadComponent: () => import('./auth/guest').then((m) => m.PlayAsGuest) },
  { path: 'forgot-password', loadComponent: () => import('./auth/forgot-password').then((m) => m.ForgotPassword) },
  { path: 'reset-password', loadComponent: () => import('./auth/reset-password').then((m) => m.ResetPassword) },
  // No sign-in: a player reads their window size here before they have an account.
  { path: 'device-info', loadComponent: () => import('./device-info').then((m) => m.DeviceInfo) },
  // The front door; the installed app and signed-in players are sent on to Play (homeRedirect).
  { path: '', pathMatch: 'full', canActivate: [homeRedirect], loadComponent: () => import('./home').then((m) => m.Home) },
];
