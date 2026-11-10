import { Routes } from '@angular/router';

const generals = () => import('./wiki-generals').then((m) => m.WikiGenerals);
const kingdomWarsGenerals = () => import('./wiki-kingdom-wars-generals').then((m) => m.WikiKingdomWarsGenerals);
const cards = () => import('./wiki-cards').then((m) => m.WikiCards);

// Each deck has its own set of pages; the deck comes from the parent route's
// data. The three card pages share one component, and each route names its
// category. Kingdom Wars' Generals page is its own component.
export const WIKI_ROUTES: Routes = [
  {
    path: 'identity',
    data: { deck: 'identity' },
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
  { path: 'default/:page', redirectTo: 'identity/:page' },
  { path: 'dynasty-wars/:page', redirectTo: 'identity/:page' },
  { path: 'alternate/:page', redirectTo: 'kingdom-wars/:page' },
  { path: 'generals', redirectTo: 'identity/generals', pathMatch: 'full' },
  { path: 'basic', redirectTo: 'identity/basic', pathMatch: 'full' },
  { path: 'equipment', redirectTo: 'identity/equipment', pathMatch: 'full' },
  { path: 'tools', redirectTo: 'identity/tools', pathMatch: 'full' },
  {
    path: 'rules',
    loadComponent: () => import('./rules/rules-shell').then((m) => m.RulesShell),
    children: [
      { path: '', redirectTo: 'overview', pathMatch: 'full' },
      { path: 'overview', loadComponent: () => import('./rules/overview').then((m) => m.RulesOverview) },
      { path: 'card-types', loadComponent: () => import('./rules/card-types').then((m) => m.RulesCardTypes) },
      { path: 'setup', loadComponent: () => import('./rules/setup').then((m) => m.RulesSetup) },
      { path: 'allegiance', loadComponent: () => import('./rules/allegiance').then((m) => m.RulesAllegiance) },
      { path: 'turn', loadComponent: () => import('./rules/turn').then((m) => m.RulesTurn) },
      { path: 'distance', loadComponent: () => import('./rules/distance').then((m) => m.RulesDistance) },
      { path: 'response', loadComponent: () => import('./rules/response').then((m) => m.RulesResponse) },
      { path: 'damage', loadComponent: () => import('./rules/damage').then((m) => m.RulesDamage) },
      { path: 'judgment', loadComponent: () => import('./rules/judgment').then((m) => m.RulesJudgment) },
      { path: 'chains', loadComponent: () => import('./rules/chains').then((m) => m.RulesChains) },
      { path: 'glossary', loadComponent: () => import('./rules/glossary').then((m) => m.RulesGlossary) },
    ],
  },
  { path: '', redirectTo: 'kingdom-wars/generals', pathMatch: 'full' },
];
