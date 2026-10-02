import { ApplicationRef } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { ViewportScroller } from '@angular/common';
import { Router } from '@angular/router';
import { App } from './app';
import { appConfig } from './app.config';

// The router's scroll handling only starts at a real bootstrap, so boot the
// actual app config and watch the viewport.
describe('appConfig', () => {
  let appRef: ApplicationRef;
  const scroller = {
    scrollToPosition: jest.fn(),
    scrollToAnchor: jest.fn(),
    setHistoryScrollRestoration: jest.fn(),
    getScrollPosition: () => [0, 500] as [number, number],
    setOffset: jest.fn(),
  };

  beforeEach(async () => {
    // A real bootstrap prints Angular's development-mode banner.
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    document.body.innerHTML = '<app-root></app-root>';
    appRef = await bootstrapApplication(App, {
      providers: [...appConfig.providers, { provide: ViewportScroller, useValue: scroller }],
    });
  });

  afterEach(() => {
    appRef.destroy();
    jest.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('scrolls to the top when moving to another page', async () => {
    const router = appRef.injector.get(Router);
    await router.navigateByUrl('/wiki/generals');
    scroller.scrollToPosition.mockClear();
    await router.navigateByUrl('/wiki/tools');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(scroller.scrollToPosition).toHaveBeenCalledWith([0, 0]);
  });
});
