import { Routes } from '@angular/router';

// The three card pages share one component; each route names its category.
export const WIKI_ROUTES: Routes = [
  { path: 'generals', loadComponent: () => import('./wiki-generals').then((m) => m.WikiGenerals) },
  { path: 'basic', loadComponent: () => import('./wiki-cards').then((m) => m.WikiCards), data: { category: 'basic' } },
  { path: 'equipment', loadComponent: () => import('./wiki-cards').then((m) => m.WikiCards), data: { category: 'equipment' } },
  { path: 'tools', loadComponent: () => import('./wiki-cards').then((m) => m.WikiCards), data: { category: 'tool' } },
  { path: '', redirectTo: 'generals', pathMatch: 'full' },
];
