import { Component, inject } from '@angular/core';
import { I18n } from './i18n.service';
import { LOCALES, LocaleCode } from './locales';
import { TPipe } from './t.pipe';

// One flag button per language, in the toolbar. The label is the language's own
// name, since a flag alone is neither accessible nor a reliable symbol.
@Component({
  selector: 'app-language-switcher',
  imports: [TPipe],
  template: `
    <div class="switcher" role="group" [attr.aria-label]="'nav.language' | t">
      @for (l of locales; track l.code) {
        <button
          type="button"
          class="lang"
          [class.active]="i18n.locale() === l.code"
          [attr.data-locale]="l.code"
          [attr.aria-label]="l.nativeName"
          [attr.aria-pressed]="i18n.locale() === l.code"
          [attr.title]="l.nativeName"
          (click)="choose(l.code)"
        >
          <img [src]="l.flag" alt="" width="24" height="16" />
        </button>
      }
    </div>
  `,
  styles: `
    .switcher {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .lang {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 32px;
      padding: 0;
      border: 2px solid transparent;
      border-radius: 6px;
      background: none;
      cursor: pointer;
      opacity: 0.7;
    }
    .lang:hover,
    .lang:focus-visible {
      opacity: 1;
    }
    .lang.active {
      opacity: 1;
      border-color: var(--mat-sys-on-primary);
    }
    img {
      display: block;
      border-radius: 2px;
    }
  `,
})
export class LanguageSwitcher {
  protected readonly i18n = inject(I18n);
  protected readonly locales = LOCALES;

  protected choose(code: LocaleCode): void {
    void this.i18n.setLocale(code);
  }
}
