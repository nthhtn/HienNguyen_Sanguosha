import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';

// Chrome's `beforeinstallprompt` event; not in TypeScript's DOM types.
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Holds Chrome's offer to install the app, so the install hint can show an Install App button. Chrome sends the
// offer once, early; App injects this service at start so the listener is in place. An offer opens Chrome's dialog
// once, whatever the player chooses there.
@Injectable({ providedIn: 'root' })
export class InstallPrompt {
  private readonly offer = signal<BeforeInstallPromptEvent | null>(null);
  readonly available = computed(() => this.offer() !== null);

  constructor() {
    const offered = (event: Event) => {
      event.preventDefault();
      this.offer.set(event as BeforeInstallPromptEvent);
    };
    const installed = () => this.offer.set(null);
    window.addEventListener('beforeinstallprompt', offered);
    window.addEventListener('appinstalled', installed);
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('beforeinstallprompt', offered);
      window.removeEventListener('appinstalled', installed);
    });
  }

  async install(): Promise<void> {
    const offer = this.offer();
    if (!offer) return;
    this.offer.set(null);
    await offer.prompt();
    await offer.userChoice;
  }
}
