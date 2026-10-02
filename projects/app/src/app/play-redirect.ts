import { inject, Injector } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';

// Play Game: resume a game in progress, otherwise start one from Setup.
// GameService is imported lazily so the shell's initial bundle doesn't carry
// the engine and content code (about 250 kB).
export const playRedirect: CanActivateFn = async (): Promise<UrlTree> => {
  const router = inject(Router);
  const injector = inject(Injector);
  const { GameService } = await import('./game.service');
  const state = injector.get(GameService).state();
  return router.parseUrl(state && !state.result ? '/game' : '/setup');
};
