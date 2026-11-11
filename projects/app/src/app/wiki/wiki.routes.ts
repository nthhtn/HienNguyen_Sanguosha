import { inject } from '@angular/core';
import { Route, Router, Routes } from '@angular/router';

// Rules pages that became sections of a bigger page, and the section each now lives in.
const MERGED_RULES_PAGES: Record<string, string> = {
  allegiance: 'setup#allegiance',
  'card-types': 'turn#card-types',
  distance: 'attack#distance',
  response: 'attack#response',
  damage: 'attack#damage',
  chains: 'judgment#chains',
};

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
      { path: 'setup', loadComponent: () => import('./rules/rules-groups').then((m) => m.RulesSetupGroup) },
      { path: 'turn', loadComponent: () => import('./rules/rules-groups').then((m) => m.RulesTurnGroup) },
      { path: 'attack', loadComponent: () => import('./rules/rules-groups').then((m) => m.RulesAttackGroup) },
      { path: 'judgment', loadComponent: () => import('./rules/rules-groups').then((m) => m.RulesJudgmentGroup) },
      { path: 'glossary', loadComponent: () => import('./rules/glossary').then((m) => m.RulesGlossary) },
      // The pages that were folded into another keep their addresses: each goes to its section.
      ...Object.entries(MERGED_RULES_PAGES).map(([path, target]): Route => ({ path, pathMatch: 'full', redirectTo: () => inject(Router).parseUrl(`/wiki/rules/${target}`) })),
    ],
  },
  { path: '', redirectTo: 'kingdom-wars/generals', pathMatch: 'full' },
];
