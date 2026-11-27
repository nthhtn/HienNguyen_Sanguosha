import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { ApiError, AuthService } from './auth.service';
import { SignIn } from './sign-in';

const ANN = { id: 'u1', kind: 'registered' as const, displayName: 'Ann', email: 'ann@example.com' };

describe('SignIn', () => {
  const auth = { signIn: jest.fn(), providers: jest.fn() };

  async function create(url = '/sign-in') {
    await TestBed.configureTestingModule({
      imports: [SignIn],
      providers: [
        { provide: AuthService, useValue: auth },
        provideRouter([
          { path: 'sign-in', component: SignIn },
          { path: 'setup', children: [] },
          { path: 'game', children: [] },
        ]),
      ],
    }).compileComponents();
    await TestBed.inject(Router).navigateByUrl(url);
    const fixture = TestBed.createComponent(SignIn);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, el: fixture.nativeElement as HTMLElement, router: TestBed.inject(Router) };
  }

  beforeEach(() => {
    auth.signIn.mockReset();
    auth.providers.mockReset().mockResolvedValue({ google: true });
  });

  it('has the Sign In title, fields and links', async () => {
    const { el } = await create();
    expect(el.querySelector('mat-card-title')?.textContent).toContain('Sign In');
    expect(el.querySelector('input.email')).not.toBeNull();
    expect(el.querySelector('input.password')?.getAttribute('type')).toBe('password');
    const links = [...el.querySelectorAll('.links a')].map((a) => a.textContent?.trim());
    expect(links).toEqual(['Forgot Password', 'Create Account', 'Play as Guest']);
  });

  it('offers Continue with Google, passing on the return URL', async () => {
    const { fixture, el } = await create('/sign-in?returnUrl=%2Frooms');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.querySelector('a.google-button')?.getAttribute('href')).toBe('/api/auth/google/start?returnUrl=%2Frooms');
  });

  it.each([
    ['google_email_in_use', 'That email already has a password account. Sign in with your password'],
    ['google_failed', 'Google sign-in did not work. Try again'],
    ['google_cancelled', 'Google sign-in was cancelled'],
    ['google_unverified', 'Your Google email is not verified'],
  ])('shows what went wrong when Google sent the player back with error=%s', async (code, text) => {
    const { el } = await create(`/sign-in?error=${code}`);
    expect(el.querySelector('.error')?.textContent?.trim()).toBe(text);
  });

  it('shows nothing for an error code it does not know', async () => {
    const { el } = await create('/sign-in?error=whatever');
    expect(el.querySelector('.error')).toBeNull();
  });

  it('signs in with the trimmed email, typed through the form, then goes to Setup', async () => {
    auth.signIn.mockResolvedValue(ANN);
    const { fixture, el, router } = await create();
    const navigate = jest.spyOn(router, 'navigateByUrl');
    const email = el.querySelector('input.email') as HTMLInputElement;
    const password = el.querySelector('input.password') as HTMLInputElement;
    email.value = ' ann@example.com ';
    email.dispatchEvent(new Event('input'));
    password.value = 'secret-pass';
    password.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (el.querySelector('button.submit') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(auth.signIn).toHaveBeenCalledWith({ email: 'ann@example.com', password: 'secret-pass' });
    expect(navigate).toHaveBeenCalledWith('/setup');
  });

  it('returns to a safe returnUrl after signing in', async () => {
    auth.signIn.mockResolvedValue(ANN);
    const { component, router } = await create('/sign-in?returnUrl=%2Fgame');
    const navigate = jest.spyOn(router, 'navigateByUrl');
    component.email.set('ann@example.com');
    component.password.set('secret-pass');
    await component.submit();
    expect(navigate).toHaveBeenCalledWith('/game');
  });

  it("shows the server's message when sign-in fails", async () => {
    auth.signIn.mockRejectedValue(new ApiError('invalid_credentials', 'Email or password is incorrect', 401));
    const { fixture, component, el } = await create();
    component.email.set('ann@example.com');
    component.password.set('wrong-pass');
    await component.submit();
    fixture.detectChanges();
    expect(el.querySelector('.error')?.textContent).toContain('Email or password is incorrect');
    expect(component.busy()).toBe(false);
  });

  it('does not submit with an empty field', async () => {
    const { fixture, component, el } = await create();
    component.email.set('ann@example.com');
    fixture.detectChanges();
    expect((el.querySelector('button.submit') as HTMLButtonElement).disabled).toBe(true);
    await component.submit();
    expect(auth.signIn).not.toHaveBeenCalled();
  });
});
