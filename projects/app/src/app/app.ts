import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatToolbarModule } from '@angular/material/toolbar';
import { AuthService } from './auth/auth.service';
import { LanguageSwitcher } from './i18n/language-switcher';
import { MusicService, SoundEffects } from './music.service';
import { I18n } from './i18n/i18n.service';
import type { MessageKey } from './i18n/messages';
import { TPipe } from './i18n/t.pipe';

@Component({
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatToolbarModule, MatIconModule, MatButtonModule, MatMenuModule, LanguageSwitcher, TPipe],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  private readonly i18n = inject(I18n);
  protected readonly title = computed(() => this.i18n.t('app.title'));
  protected readonly cardPages: { path: string; label: MessageKey }[] = [
    { path: '/wiki/generals', label: 'nav.cards.generals' },
    { path: '/wiki/basic', label: 'nav.cards.basic' },
    { path: '/wiki/equipment', label: 'nav.cards.equipment' },
    { path: '/wiki/tools', label: 'nav.cards.tools' },
  ];
  protected readonly rulesPages: { path: string; label: MessageKey }[] = [
    { path: '/wiki/rules/overview', label: 'nav.rules.overview' },
    { path: '/wiki/rules/card-types', label: 'nav.rules.cardTypes' },
    { path: '/wiki/rules/setup', label: 'nav.rules.setup' },
    { path: '/wiki/rules/turn', label: 'nav.rules.turn' },
    { path: '/wiki/rules/distance', label: 'nav.rules.distance' },
    { path: '/wiki/rules/judgment', label: 'nav.rules.judgment' },
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
