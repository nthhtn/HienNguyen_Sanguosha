import { Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { I18n } from './i18n.service';
import { LOCALES, LocaleCode } from './locales';
import { TPipe } from './t.pipe';

// The toolbar's language menu: its button shows the flag of the language in use,
// and opening it lists a flag per language. Flags only, no text on screen; each
// carries the language's own name as its label, since a flag alone is neither
// accessible nor a reliable symbol.
@Component({
  selector: 'app-language-switcher',
  imports: [MatButtonModule, MatMenuModule, TPipe],
  template: `
    <button mat-icon-button type="button" class="current" [matMenuTriggerFor]="menu" [attr.aria-label]="'nav.language' | t" [attr.title]="current().nativeName">
      <img [src]="current().flag" alt="" width="24" height="16" />
    </button>
    <mat-menu #menu="matMenu">
      @for (l of locales; track l.code) {
        <button
          mat-menu-item
          type="button"
          class="lang"
          [class.active]="i18n.locale() === l.code"
          [attr.data-locale]="l.code"
          [attr.aria-label]="l.nativeName"
          [attr.aria-current]="i18n.locale() === l.code ? 'true' : null"
          [attr.title]="l.nativeName"
          (click)="choose(l.code)"
        >
          <img [src]="l.flag" alt="" width="24" height="16" />
        </button>
      }
    </mat-menu>
  `,
  styles: `
    .current {
      color: var(--mat-sys-on-primary);
    }
    img {
      display: block;
      border-radius: 2px;
    }
    .lang.active {
      background: color-mix(in srgb, var(--mat-sys-on-surface) 12%, transparent);
    }
  `,
})
export class LanguageSwitcher {
  protected readonly i18n = inject(I18n);
  protected readonly locales = LOCALES;
  protected readonly current = computed(() => LOCALES.find((l) => l.code === this.i18n.locale()) ?? LOCALES[0]);

  protected choose(code: LocaleCode): void {
    void this.i18n.setLocale(code);
  }
}
