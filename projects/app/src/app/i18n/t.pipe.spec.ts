import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CATALOG_LOADERS, INITIAL_CATALOGS } from './catalogs';
import { en } from './en';
import { I18n } from './i18n.service';
import type { Messages } from './messages';
import { TPipe } from './t.pipe';

const VI = { 'nav.language': 'Ngôn ngữ' } as Messages;

@Component({ imports: [TPipe], template: `<p>{{ 'nav.language' | t }}</p>` })
class Host {}

describe('t pipe', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        { provide: CATALOG_LOADERS, useValue: { en: () => Promise.resolve(en), vi: () => Promise.resolve(VI) } },
        { provide: INITIAL_CATALOGS, useValue: { en } },
      ],
    });
  });

  it('renders the current language and re-renders when it changes', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const text = () => (fixture.nativeElement as HTMLElement).querySelector('p')!.textContent;
    expect(text()).toBe('Language');

    await TestBed.inject(I18n).setLocale('vi');
    await fixture.whenStable();
    expect(text()).toBe('Ngôn ngữ');
  });
});
