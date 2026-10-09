import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MusicService } from './music.service';

@Component({
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatToolbarModule, MatIconModule, MatButtonModule, MatMenuModule],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('Kingdom War');
  protected readonly wikiPages = [
    { path: '/wiki/generals', label: 'Generals', icon: 'sports_kabaddi', symbol: false },
    { path: '/wiki/basic', label: 'Basic Cards', icon: 'umbrella', symbol: false },
    // "swords" only exists in Material Symbols, not the legacy Material Icons font.
    { path: '/wiki/equipment', label: 'Equipment', icon: 'swords', symbol: true },
    { path: '/wiki/tools', label: 'Tools', icon: 'build', symbol: false },
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

  protected readonly rulesActive = computed(() => /^\/wiki\/rules(\/|$|\?)/.test(this.url()));

  protected readonly music = inject(MusicService);

  constructor() {
    this.music.start();
  }
}
