import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatToolbarModule } from '@angular/material/toolbar';
import { BATTLEFIELD_BACKGROUNDS, BattlefieldBackgrounds } from './battlefield-background.service';
import { AuthService } from './auth/auth.service';
import { LanguageSwitcher } from './i18n/language-switcher';
import { MusicService, SoundEffects } from './music.service';
import { I18n } from './i18n/i18n.service';
import type { MessageKey } from './i18n/messages';
import type { DeckId } from 'content';
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
  // One menu per deck, its pages under /wiki/<route>. A page that does not exist yet can be listed with `disabled: true`.
  protected readonly deckMenus: { deck: DeckId; route: string; label: MessageKey; icon: string; fontSet?: string; pages: { path: string; label: MessageKey; disabled?: boolean }[] }[] = [
    {
      deck: 'kingdomWars',
      route: 'kingdom-wars',
      label: 'setup.deck.kingdomWars',
      icon: 'swords', // "swords" only exists in Material Symbols, not the legacy Material Icons font.
      fontSet: 'material-symbols-outlined',
      pages: [
        { path: '/wiki/kingdom-wars/generals', label: 'nav.cards.generals' },
        { path: '/wiki/kingdom-wars/basic', label: 'nav.cards.basic' },
        { path: '/wiki/kingdom-wars/equipment', label: 'nav.cards.equipment' },
        { path: '/wiki/kingdom-wars/tools', label: 'nav.cards.tools' },
      ],
    },
    {
      deck: 'identity',
      route: 'identity',
      label: 'setup.deck.identity',
      icon: 'castle',
      pages: [
        { path: '/wiki/identity/generals', label: 'nav.cards.generals' },
        { path: '/wiki/identity/basic', label: 'nav.cards.basic' },
        { path: '/wiki/identity/equipment', label: 'nav.cards.equipment' },
        { path: '/wiki/identity/tools', label: 'nav.cards.tools' },
      ],
    },
  ];
  protected readonly rulesPages: { path: string; label: MessageKey }[] = [
    { path: '/wiki/rules/overview', label: 'nav.rules.overview' },
    { path: '/wiki/rules/card-types', label: 'nav.rules.cardTypes' },
    { path: '/wiki/rules/setup', label: 'nav.rules.setup' },
    { path: '/wiki/rules/turn', label: 'nav.rules.turn' },
    { path: '/wiki/rules/distance', label: 'nav.rules.distance' },
    { path: '/wiki/rules/judgment', label: 'nav.rules.judgment' },
  ];

  protected readonly backgrounds = inject(BattlefieldBackgrounds);
  protected readonly backgroundOptions = BATTLEFIELD_BACKGROUNDS.map((value) => ({
    value,
    label: (value === 'default' ? 'nav.battlefield.default' : `nav.battlefield.background${value}`) as MessageKey,
  }));

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

  protected deckActive(route: string): boolean {
    return new RegExp(`^/wiki/${route}(/|$|\\?)`).test(this.url());
  }
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
