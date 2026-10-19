import { TestBed } from '@angular/core/testing';
import { I18n } from './i18n.service';
import { LanguageSwitcher } from './language-switcher';

describe('LanguageSwitcher', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  async function render() {
    const fixture = TestBed.createComponent(LanguageSwitcher);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const trigger = () => el.querySelector('button.current') as HTMLButtonElement;
    const open = async () => {
      trigger().click();
      fixture.detectChanges();
      await fixture.whenStable();
      return [...document.querySelectorAll('.mat-mdc-menu-panel button[mat-menu-item]')] as HTMLButtonElement[];
    };
    return { fixture, el, trigger, open };
  }

  it('shows the flag of the language in use on its button, labelled Language', async () => {
    const { trigger } = await render();
    expect(trigger().getAttribute('aria-label')).toBe('Language');
    expect(trigger().getAttribute('title')).toBe('English');
    expect(trigger().querySelector('img')!.getAttribute('src')).toBe('flags/gb.svg');
    expect(trigger().textContent!.trim()).toBe('');
  });

  it('lists one flag per language in the menu, with no text, labelled in its own language', async () => {
    const { open } = await render();
    const items = await open();
    expect(items.map((b) => [b.getAttribute('aria-label'), b.getAttribute('title'), b.querySelector('img')!.getAttribute('src')])).toEqual([
      ['English', 'English', 'flags/gb.svg'],
      ['Tiếng Việt', 'Tiếng Việt', 'flags/vn.svg'],
    ]);
    for (const b of items) {
      expect(b.querySelector('img')!.getAttribute('alt')).toBe('');
      expect(b.textContent!.trim()).toBe('');
    }
    expect(items.map((b) => b.getAttribute('aria-current'))).toEqual(['true', null]);
  });

  it('switches to Vietnamese, remembers it, and shows its flag and label', async () => {
    const { trigger, open, fixture } = await render();
    (await open())[1].click();
    await fixture.whenStable();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(TestBed.inject(I18n).locale()).toBe('vi');
    expect(localStorage.getItem('locale')).toBe('vi');
    expect(trigger().getAttribute('aria-label')).toBe('Ngôn ngữ');
    expect(trigger().querySelector('img')!.getAttribute('src')).toBe('flags/vn.svg');
  });

  it('switches back to English', async () => {
    const { trigger, open, fixture } = await render();
    (await open())[1].click();
    await fixture.whenStable();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    (await open())[0].click();
    await fixture.whenStable();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(localStorage.getItem('locale')).toBe('en');
    expect(trigger().querySelector('img')!.getAttribute('src')).toBe('flags/gb.svg');
  });
});
