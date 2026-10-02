import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatToolbarModule } from '@angular/material/toolbar';

@Component({
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatToolbarModule, MatIconModule, MatButtonModule, MatMenuModule],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('Kingdom War');
  protected readonly wikiPages = [
    { path: '/wiki/generals', label: 'Generals' },
    { path: '/wiki/basic', label: 'Basic Cards' },
    { path: '/wiki/equipment', label: 'Equipments' },
    { path: '/wiki/tools', label: 'Tools' },
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
  protected readonly wikiActive = computed(() => this.url().startsWith('/wiki'));
}
