import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

// Online screens need a signed-in user, registered or guest. Anyone else goes
// to Sign In, which returns here afterwards.
export const requireSignIn: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const me = auth.loaded() ? auth.me() : await auth.load();
  return me ? true : router.createUrlTree(['/sign-in'], { queryParams: { returnUrl: state.url } });
};
