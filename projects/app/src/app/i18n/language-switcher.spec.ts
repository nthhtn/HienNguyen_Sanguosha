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
    const buttons = () => [...el.querySelectorAll('button')] as HTMLButtonElement[];
    return { fixture, el, buttons };
  }

  it('has one flag button per language, labelled in its own language', async () => {
    const { buttons } = await render();
    expect(buttons().map((b) => [b.getAttribute('aria-label'), b.getAttribute('title'), b.querySelector('img')!.getAttribute('src')])).toEqual([
      ['English', 'English', 'flags/gb.svg'],
      ['Tiếng Việt', 'Tiếng Việt', 'flags/vn.svg'],
    ]);
    for (const b of buttons()) expect(b.querySelector('img')!.getAttribute('alt')).toBe('');
  });

  it('marks the current language as pressed', async () => {
    const { buttons } = await render();
    expect(buttons().map((b) => b.getAttribute('aria-pressed'))).toEqual(['true', 'false']);
  });

  it('switches to Vietnamese, remembers it and relabels the group', async () => {
    const { el, buttons, fixture } = await render();
    const group = el.querySelector('[role="group"]')!;
    expect(group.getAttribute('aria-label')).toBe('Language');

    buttons()[1].click();
    await fixture.whenStable();
    await fixture.whenStable();

    expect(buttons().map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'true']);
    expect(TestBed.inject(I18n).locale()).toBe('vi');
    expect(localStorage.getItem('locale')).toBe('vi');
    expect(group.getAttribute('aria-label')).toBe('Ngôn ngữ');
  });

  it('switches back to English', async () => {
    const { buttons, fixture } = await render();
    buttons()[1].click();
    await fixture.whenStable();
    await fixture.whenStable();
    buttons()[0].click();
    await fixture.whenStable();
    await fixture.whenStable();
    expect(buttons().map((b) => b.getAttribute('aria-pressed'))).toEqual(['true', 'false']);
    expect(localStorage.getItem('locale')).toBe('en');
  });
});
