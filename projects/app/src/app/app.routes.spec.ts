import { offlineOnly } from './feature-flags';
import { routes } from './app.routes';
import { TutorialPage } from './tutorial/tutorial-page';

describe('routes', () => {
  const tutorial = routes.find((r) => r.path === 'tutorial');

  it('has a Tutorial route that loads the Tutorial page lazily', async () => {
    expect(tutorial).toBeDefined();
    expect(tutorial!.component).toBeUndefined();
    expect(await (tutorial!.loadComponent as () => Promise<unknown>)()).toBe(TutorialPage);
  });

  it('keeps the Tutorial offline-only, like Setup and Game, since a lesson runs the local game', () => {
    expect(tutorial!.canActivate).toEqual([offlineOnly]);
    expect(routes.find((r) => r.path === 'setup')!.canActivate).toEqual([offlineOnly]);
  });
});
