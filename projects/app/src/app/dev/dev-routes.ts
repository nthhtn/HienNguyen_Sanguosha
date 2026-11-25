import { Routes } from '@angular/router';

// Whether the toolbar shows the Preview link. Dev builds only, like the routes.
export const DEV_PREVIEW = true;

// Offline play, playback settings, and `?display=` overrides. Off in production builds (dev-routes.prod.ts).
export const DEV_FEATURES = true;

// The dev scenario pages. Production builds replace this file with dev-routes.prod.ts (an empty list).
export const DEV_ROUTES: Routes = [
  { path: 'preview', loadComponent: () => import('./dev-index').then((m) => m.DevIndex) },
  { path: 'preview/animations', loadComponent: () => import('./lab/animation-lab-page').then((m) => m.AnimationLabPage) },
  { path: 'preview/:scenarioId', loadComponent: () => import('./dev-scenario-page').then((m) => m.DevScenarioPage) },
];
