import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatToolbarModule } from '@angular/material/toolbar';
import { AuthService } from './auth/auth.service';
import { MusicService, SoundEffects } from './music.service';

@Component({
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatToolbarModule, MatIconModule, MatButtonModule, MatMenuModule],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('Kingdom War');
  protected readonly cardPages = [
    { path: '/wiki/generals', label: 'Generals' },
    { path: '/wiki/basic', label: 'Basic Cards' },
    { path: '/wiki/equipment', label: 'Equipment' },
    { path: '/wiki/tools', label: 'Tools' },
  ];
  protected readonly rulesPages = [
    { path: '/wiki/rules/overview', label: 'Overview' },
    { path: '/wiki/rules/card-types', label: 'Card Types' },
    { path: '/wiki/rules/setup', label: 'Setup' },
    { path: '/wiki/rules/turn', label: 'Turn Structure' },
    { path: '/wiki/rules/distance', label: 'Distance / Range' },
    { path: '/wiki/rules/judgment', label: 'Judgment' },
  ];

  private readonly router = inject(Router);
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects)
    ),
    { initialValue: this.router.url }
  );
  protected readonly playActive = computed(() => /^\/(setup|game)(\/|$|\?)/.test(this.url()));
  protected readonly onlineActive = computed(() => /^\/(rooms|my-games)(\/|$|\?)/.test(this.url()));

  protected readonly cardsActive = computed(() => /^\/wiki\/(generals|basic|equipment|tools)(\/|$|\?)/.test(this.url()));
  protected readonly rulesActive = computed(() => /^\/wiki\/rules(\/|$|\?)/.test(this.url()));

  protected readonly music = inject(MusicService);
  protected readonly effects = inject(SoundEffects);

  protected readonly auth = inject(AuthService);

  constructor() {
    this.music.start();
    void this.auth.load();
  }

  protected async signOut(): Promise<void> {
    try {
      await this.auth.signOut();
    } catch {
      // Still signed in on the server; the menu keeps showing the account.
      return;
    }
    await this.router.navigateByUrl('/setup');
  }
}
