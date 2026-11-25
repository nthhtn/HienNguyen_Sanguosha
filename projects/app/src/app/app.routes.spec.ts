import { offlineOnly, tutorialEnabled } from './feature-flags';
import { routes } from './app.routes';
import { TutorialPage } from './tutorial/tutorial-page';

describe('routes', () => {
  const tutorial = routes.find((r) => r.path === 'tutorial');

  it('has a Tutorial route that loads the Tutorial page lazily', async () => {
    expect(tutorial).toBeDefined();
    expect(tutorial!.component).toBeUndefined();
    expect(await (tutorial!.loadComponent as () => Promise<unknown>)()).toBe(TutorialPage);
  });

  it('guards the Tutorial with its own switch, so it is on in production where Setup and Game are not', () => {
    expect(tutorial!.canActivate).toEqual([tutorialEnabled]);
    expect(routes.find((r) => r.path === 'setup')!.canActivate).toEqual([offlineOnly]);
  });
});
