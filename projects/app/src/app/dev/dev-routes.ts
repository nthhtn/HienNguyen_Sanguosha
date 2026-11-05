import { Routes } from '@angular/router';

// The dev scenario pages. Production builds replace this file with dev-routes.prod.ts (an empty list).
export const DEV_ROUTES: Routes = [
  { path: 'dev', loadComponent: () => import('./dev-index').then((m) => m.DevIndex) },
  { path: 'dev/:scenarioId', loadComponent: () => import('./dev-scenario-page').then((m) => m.DevScenarioPage) },
];
