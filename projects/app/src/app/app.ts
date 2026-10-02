import { BreakpointObserver } from '@angular/cdk/layout';
import { afterNextRender, Component, computed, ElementRef, inject, Injector, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatToolbarModule } from '@angular/material/toolbar';

const WIDE = '(min-width: 1024px)';

@Component({
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatToolbarModule, MatIconModule, MatButtonModule, MatListModule],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
  host: { '(document:keydown.escape)': 'dismissDrawer()' },
})
export class App {
  protected readonly title = signal('Kingdom War');
  protected readonly wikiPages = [
    { path: '/wiki/generals', label: 'Generals' },
    { path: '/wiki/basic', label: 'Basic Cards' },
    { path: '/wiki/equipment', label: 'Equipments' },
    { path: '/wiki/tools', label: 'Tools' },
  ];

  private readonly breakpoints = inject(BreakpointObserver);
  // Wide screens show the panel beside the page; narrow ones slide it in over it.
  protected readonly wide = toSignal(this.breakpoints.observe(WIDE).pipe(map((state) => state.matches)), {
    initialValue: this.breakpoints.isMatched(WIDE),
  });
  protected readonly navOpen = signal(false);
  protected readonly wikiOpen = signal(true);

  private readonly router = inject(Router);
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects)
    ),
    { initialValue: this.router.url }
  );
  protected readonly playActive = computed(() => /^\/(setup|game)(\/|$|\?)/.test(this.url()));

  private readonly injector = inject(Injector);
  private readonly toggle = viewChild('toggle', { read: ElementRef });
  private readonly firstLink = viewChild('firstLink', { read: ElementRef });

  // Opening moves focus into the drawer, once it is no longer inert.
  protected openDrawer(): void {
    this.navOpen.set(true);
    afterNextRender(() => (this.firstLink()?.nativeElement as HTMLElement | undefined)?.focus(), { injector: this.injector });
  }

  // Escape or the backdrop: close and hand focus back to the menu button, so
  // keyboard and screen-reader users don't lose their place.
  protected dismissDrawer(): void {
    if (!this.navOpen()) return;
    this.navOpen.set(false);
    afterNextRender(() => (this.toggle()?.nativeElement as HTMLElement | undefined)?.focus(), { injector: this.injector });
  }

  // Choosing a link navigates away, so focus follows the new page instead.
  protected closeDrawer(): void {
    this.navOpen.set(false);
  }
}
