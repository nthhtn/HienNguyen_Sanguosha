import { Routes } from '@angular/router';

// The three card pages share one component; each route names its category.
export const WIKI_ROUTES: Routes = [
  { path: 'generals', loadComponent: () => import('./wiki-generals').then((m) => m.WikiGenerals) },
  { path: 'basic', loadComponent: () => import('./wiki-cards').then((m) => m.WikiCards), data: { category: 'basic' } },
  { path: 'equipment', loadComponent: () => import('./wiki-cards').then((m) => m.WikiCards), data: { category: 'equipment' } },
  { path: 'tools', loadComponent: () => import('./wiki-cards').then((m) => m.WikiCards), data: { category: 'tool' } },
  { path: 'rules', redirectTo: 'rules/overview', pathMatch: 'full' },
  { path: 'rules/overview', loadComponent: () => import('./rules/overview').then((m) => m.RulesOverview) },
  { path: 'rules/card-types', loadComponent: () => import('./rules/card-types').then((m) => m.RulesCardTypes) },
  { path: 'rules/setup', loadComponent: () => import('./rules/setup').then((m) => m.RulesSetup) },
  { path: 'rules/turn', loadComponent: () => import('./rules/turn').then((m) => m.RulesTurn) },
  { path: 'rules/distance', loadComponent: () => import('./rules/distance').then((m) => m.RulesDistance) },
  { path: 'rules/judgment', loadComponent: () => import('./rules/judgment').then((m) => m.RulesJudgment) },
  { path: '', redirectTo: 'generals', pathMatch: 'full' },
];
