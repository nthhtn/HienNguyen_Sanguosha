import { Routes } from '@angular/router';

const generals = () => import('./wiki-generals').then((m) => m.WikiGenerals);
const alternateGenerals = () => import('./wiki-alternate-generals').then((m) => m.WikiAlternateGenerals);
const cards = () => import('./wiki-cards').then((m) => m.WikiCards);

// Each deck has its own set of pages; the deck comes from the parent route's
// data. The three card pages share one component, and each route names its
// category. Alternate's Generals page is its own component.
export const WIKI_ROUTES: Routes = [
  {
    path: 'default',
    data: { deck: 'default' },
    children: [
      { path: 'generals', loadComponent: generals },
      { path: 'basic', loadComponent: cards, data: { category: 'basic' } },
      { path: 'equipment', loadComponent: cards, data: { category: 'equipment' } },
      { path: 'tools', loadComponent: cards, data: { category: 'tool' } },
    ],
  },
  {
    path: 'alternate',
    data: { deck: 'alternate' },
    children: [
      { path: 'generals', loadComponent: alternateGenerals },
      { path: 'basic', loadComponent: cards, data: { category: 'basic' } },
      { path: 'equipment', loadComponent: cards, data: { category: 'equipment' } },
      { path: 'tools', loadComponent: cards, data: { category: 'tool' } },
    ],
  },
  // The addresses from before the decks had their own pages still work.
  { path: 'generals', redirectTo: 'default/generals', pathMatch: 'full' },
  { path: 'basic', redirectTo: 'default/basic', pathMatch: 'full' },
  { path: 'equipment', redirectTo: 'default/equipment', pathMatch: 'full' },
  { path: 'tools', redirectTo: 'default/tools', pathMatch: 'full' },
  { path: 'rules', redirectTo: 'rules/overview', pathMatch: 'full' },
  { path: 'rules/overview', loadComponent: () => import('./rules/overview').then((m) => m.RulesOverview) },
  { path: 'rules/card-types', loadComponent: () => import('./rules/card-types').then((m) => m.RulesCardTypes) },
  { path: 'rules/setup', loadComponent: () => import('./rules/setup').then((m) => m.RulesSetup) },
  { path: 'rules/turn', loadComponent: () => import('./rules/turn').then((m) => m.RulesTurn) },
  { path: 'rules/distance', loadComponent: () => import('./rules/distance').then((m) => m.RulesDistance) },
  { path: 'rules/judgment', loadComponent: () => import('./rules/judgment').then((m) => m.RulesJudgment) },
  { path: '', redirectTo: 'default/generals', pathMatch: 'full' },
];
