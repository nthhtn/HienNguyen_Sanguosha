import { Routes } from '@angular/router';

const generals = () => import('./wiki-generals').then((m) => m.WikiGenerals);
const kingdomWarsGenerals = () => import('./wiki-kingdom-wars-generals').then((m) => m.WikiKingdomWarsGenerals);
const cards = () => import('./wiki-cards').then((m) => m.WikiCards);

// Each deck has its own set of pages; the deck comes from the parent route's
// data. The three card pages share one component, and each route names its
// category. Kingdom Wars' Generals page is its own component.
export const WIKI_ROUTES: Routes = [
  {
    path: 'dynasty-wars',
    data: { deck: 'dynastyWars' },
    children: [
      { path: 'generals', loadComponent: generals },
      { path: 'basic', loadComponent: cards, data: { category: 'basic' } },
      { path: 'equipment', loadComponent: cards, data: { category: 'equipment' } },
      { path: 'tools', loadComponent: cards, data: { category: 'tool' } },
    ],
  },
  {
    path: 'kingdom-wars',
    data: { deck: 'kingdomWars' },
    children: [
      { path: 'generals', loadComponent: kingdomWarsGenerals },
      { path: 'basic', loadComponent: cards, data: { category: 'basic' } },
      { path: 'equipment', loadComponent: cards, data: { category: 'equipment' } },
      { path: 'tools', loadComponent: cards, data: { category: 'tool' } },
    ],
  },
  // The addresses from before the decks had their own pages, or their current
  // names, still work.
  { path: 'default/:page', redirectTo: 'dynasty-wars/:page' },
  { path: 'alternate/:page', redirectTo: 'kingdom-wars/:page' },
  { path: 'generals', redirectTo: 'dynasty-wars/generals', pathMatch: 'full' },
  { path: 'basic', redirectTo: 'dynasty-wars/basic', pathMatch: 'full' },
  { path: 'equipment', redirectTo: 'dynasty-wars/equipment', pathMatch: 'full' },
  { path: 'tools', redirectTo: 'dynasty-wars/tools', pathMatch: 'full' },
  { path: 'rules', redirectTo: 'rules/overview', pathMatch: 'full' },
  { path: 'rules/overview', loadComponent: () => import('./rules/overview').then((m) => m.RulesOverview) },
  { path: 'rules/card-types', loadComponent: () => import('./rules/card-types').then((m) => m.RulesCardTypes) },
  { path: 'rules/setup', loadComponent: () => import('./rules/setup').then((m) => m.RulesSetup) },
  { path: 'rules/turn', loadComponent: () => import('./rules/turn').then((m) => m.RulesTurn) },
  { path: 'rules/distance', loadComponent: () => import('./rules/distance').then((m) => m.RulesDistance) },
  { path: 'rules/judgment', loadComponent: () => import('./rules/judgment').then((m) => m.RulesJudgment) },
  { path: '', redirectTo: 'kingdom-wars/generals', pathMatch: 'full' },
];
