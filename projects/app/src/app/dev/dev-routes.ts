import { Routes } from '@angular/router';

// The dev scenario pages. Production builds replace this file with dev-routes.prod.ts (an empty list).
export const DEV_ROUTES: Routes = [
  { path: 'preview', loadComponent: () => import('./dev-index').then((m) => m.DevIndex) },
  { path: 'preview/:scenarioId', loadComponent: () => import('./dev-scenario-page').then((m) => m.DevScenarioPage) },
];
