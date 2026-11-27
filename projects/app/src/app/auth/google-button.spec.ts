import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { GoogleButton } from './google-button';

describe('GoogleButton', () => {
  const providers = jest.fn();

  async function render(returnUrl: string | null, google: boolean) {
    providers.mockResolvedValue({ google });
    await TestBed.configureTestingModule({ imports: [GoogleButton], providers: [{ provide: AuthService, useValue: { providers, me: signal(null) } }] }).compileComponents();
    const fixture = TestBed.createComponent(GoogleButton);
    fixture.componentRef.setInput('returnUrl', returnUrl);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('links to the start of the Google flow, carrying a return URL inside the app', async () => {
    const link = (await render('/rooms?x=1', true)).querySelector('a.google-button') as HTMLAnchorElement;
    expect(link.textContent).toContain('Continue with Google');
    expect(link.getAttribute('href')).toBe('/api/auth/google/start?returnUrl=%2Frooms%3Fx%3D1');
  });

  it('carries no return URL when there is none, or when it could leave the site', async () => {
    expect((await render(null, true)).querySelector('a.google-button')?.getAttribute('href')).toBe('/api/auth/google/start');
    TestBed.resetTestingModule();
    expect((await render('//evil.example', true)).querySelector('a.google-button')?.getAttribute('href')).toBe('/api/auth/google/start');
  });

  it('shows nothing when Google sign-in is off', async () => {
    expect((await render('/rooms', false)).querySelector('a.google-button')).toBeNull();
  });
});
