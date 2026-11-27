import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { msg, type Msg } from '../i18n/msg';
import { ProfileSettings } from './profile-settings';
import { ProfileService } from './profile.service';

describe('ProfileSettings', () => {
  const actionError = signal<Msg | null>(null);
  const service = { actionError, rename: jest.fn(async () => true), changePassword: jest.fn(async () => true) };

  async function render() {
    await TestBed.configureTestingModule({ imports: [ProfileSettings], providers: [{ provide: ProfileService, useValue: service }] }).compileComponents();
    const fixture = TestBed.createComponent(ProfileSettings);
    fixture.componentRef.setInput('displayName', 'Ann');
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }
  const type = (el: HTMLElement, selector: string, value: string) => {
    const input = el.querySelector(selector) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  };

  beforeEach(() => {
    actionError.set(null);
    service.rename.mockClear();
    service.changePassword.mockClear();
  });

  it('starts with the current name and saves a changed name', async () => {
    const { fixture, el } = await render();
    expect((el.querySelector('input.name') as HTMLInputElement).value).toBe('Ann');
    type(el, 'input.name', 'Ann Two');
    fixture.detectChanges();
    (el.querySelector('button.save-name') as HTMLButtonElement).click();
    expect(service.rename).toHaveBeenCalledWith('Ann Two');
  });

  it('keeps Save Name off until the name differs from the current one', async () => {
    const { fixture, el } = await render();
    expect((el.querySelector('button.save-name') as HTMLButtonElement).disabled).toBe(true);
    type(el, 'input.name', 'Ann Two');
    fixture.detectChanges();
    expect((el.querySelector('button.save-name') as HTMLButtonElement).disabled).toBe(false);
  });

  it('sends both passwords and clears the fields once the change went through', async () => {
    const { fixture, el } = await render();
    type(el, 'input.current-password', 'old-pass');
    type(el, 'input.new-password', 'new-password');
    fixture.detectChanges();
    (el.querySelector('button.save-password') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(service.changePassword).toHaveBeenCalledWith('old-pass', 'new-password');
    expect((el.querySelector('input.current-password') as HTMLInputElement).value).toBe('');
    expect(el.querySelector('.password-saved')?.textContent).toContain('Password changed');
  });

  it("shows the server's error and keeps what was typed when the password change is refused", async () => {
    service.changePassword.mockResolvedValueOnce(false);
    actionError.set(msg('error.invalid_credentials'));
    const { fixture, el } = await render();
    type(el, 'input.current-password', 'wrong');
    type(el, 'input.new-password', 'new-password');
    fixture.detectChanges();
    (el.querySelector('button.save-password') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.querySelector('.error')?.textContent).toContain('Email or password is incorrect');
    expect((el.querySelector('input.new-password') as HTMLInputElement).value).toBe('new-password');
  });
});
