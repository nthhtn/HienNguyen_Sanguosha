import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth/auth.service';
import { Layout } from './layout.service';

// The home page is a front door for someone arriving at the link: the installed app and anyone already signed in (a
// guest included) have no use for it and go on to Play, which resumes a game or goes to Rooms or Setup.
export const homeRedirect: CanActivateFn = async () => {
  const router = inject(Router);
  if (inject(Layout).installed()) return router.parseUrl('/play');
  const auth = inject(AuthService);
  const me = auth.loaded() ? auth.me() : await auth.load();
  return me ? router.parseUrl('/play') : true;
};
