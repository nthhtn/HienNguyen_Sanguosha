// Fires the event Chrome sends when it would offer to install the app, with a fake dialog.
export function fireInstallPrompt(outcome: 'accepted' | 'dismissed' = 'dismissed') {
  const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
    prompt: jest.fn(async () => undefined),
    userChoice: Promise.resolve({ outcome, platform: 'web' }),
  });
  window.dispatchEvent(event);
  return event;
}
