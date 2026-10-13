import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { ApiError, AuthService } from './auth.service';
import { ResetPassword } from './reset-password';

describe('ResetPassword', () => {
  const auth = { resetPassword: jest.fn() };

  async function create(url: string) {
    await TestBed.configureTestingModule({
      imports: [ResetPassword],
      providers: [
        { provide: AuthService, useValue: auth },
        provideRouter([
          { path: 'reset-password', component: ResetPassword },
          { path: 'setup', children: [] },
        ]),
      ],
    }).compileComponents();
    const router = TestBed.inject(Router);
    await router.navigateByUrl(url);
    const fixture = TestBed.createComponent(ResetPassword);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, el: fixture.nativeElement as HTMLElement, router };
  }

  beforeEach(() => auth.resetPassword.mockReset());

  it('sets the new password with the token from the link, then goes to Setup', async () => {
    auth.resetPassword.mockResolvedValue({ id: 'u1', kind: 'registered', displayName: 'Ann', email: 'ann@example.com' });
    const { component, el, router } = await create('/reset-password?token=abc-123');
    expect(el.querySelector('mat-card-title')?.textContent).toContain('Reset Password');
    expect(el.querySelector('mat-label')?.textContent).toContain('New Password');
    const navigate = jest.spyOn(router, 'navigateByUrl');
    component.password.set('brand-new-pass');
    await component.submit();
    expect(auth.resetPassword).toHaveBeenCalledWith({ token: 'abc-123', password: 'brand-new-pass' });
    expect(navigate).toHaveBeenCalledWith('/setup');
  });

  it('without a token, says the link is invalid and offers Forgot Password', async () => {
    const { el } = await create('/reset-password');
    expect(el.querySelector('.error')?.textContent).toContain('This reset link is invalid or has expired');
    expect(el.querySelector('form')).toBeNull();
    expect(el.querySelector('.links a')?.textContent).toContain('Forgot Password');
  });

  it("shows the server's message for a used or expired link", async () => {
    auth.resetPassword.mockRejectedValue(new ApiError('invalid_reset_token', 'This reset link is invalid or has expired', 400));
    const { fixture, component, el } = await create('/reset-password?token=old');
    component.password.set('brand-new-pass');
    await component.submit();
    fixture.detectChanges();
    expect(el.querySelector('.error')?.textContent).toContain('This reset link is invalid or has expired');
  });
});
