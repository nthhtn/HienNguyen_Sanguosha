// Fires the event Chrome sends when it would offer to install the app. `prompt` stands in for Chrome's dialog (a
// spec passes a jest.fn()); the player's answer is `outcome`.
export function fireInstallPrompt(prompt: () => Promise<void>, outcome: 'accepted' | 'dismissed' = 'dismissed') {
  const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
    prompt,
    userChoice: Promise.resolve({ outcome, platform: 'web' }),
  });
  window.dispatchEvent(event);
  return event;
}
