import { TestBed } from '@angular/core/testing';
import { InstallPrompt } from './install-prompt.service';
import { fireInstallPrompt } from './install-prompt.testing';

describe('InstallPrompt', () => {
  it('is available once Chrome offers to install, and keeps Chrome from showing its own banner', () => {
    const prompt = TestBed.inject(InstallPrompt);
    expect(prompt.available()).toBe(false);
    const event = fireInstallPrompt(jest.fn(async () => undefined));
    expect(prompt.available()).toBe(true);
    expect(event.defaultPrevented).toBe(true);
  });

  it.each(['accepted', 'dismissed'] as const)('shows Chrome dialog once, then is gone, when %s', async (outcome) => {
    const prompt = TestBed.inject(InstallPrompt);
    const event = fireInstallPrompt(jest.fn(async () => undefined), outcome);
    await prompt.install();
    expect(event.prompt).toHaveBeenCalledTimes(1);
    expect(prompt.available()).toBe(false);
    await prompt.install();
    expect(event.prompt).toHaveBeenCalledTimes(1);
  });

  it('is gone once the app is installed', () => {
    const prompt = TestBed.inject(InstallPrompt);
    fireInstallPrompt(jest.fn(async () => undefined));
    window.dispatchEvent(new Event('appinstalled'));
    expect(prompt.available()).toBe(false);
  });

  it('stops listening when it is destroyed', () => {
    const prompt = TestBed.inject(InstallPrompt);
    TestBed.resetTestingModule();
    fireInstallPrompt(jest.fn(async () => undefined));
    expect(prompt.available()).toBe(false);
  });
});
