import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ApiError, AuthService } from './auth.service';
import { ForgotPassword } from './forgot-password';

describe('ForgotPassword', () => {
  const auth = { forgotPassword: jest.fn() };

  async function create() {
    await TestBed.configureTestingModule({
      imports: [ForgotPassword],
      providers: [{ provide: AuthService, useValue: auth }, provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(ForgotPassword);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
  }

  beforeEach(() => auth.forgotPassword.mockReset());

  it('sends the trimmed email and shows the server message in place of the form', async () => {
    auth.forgotPassword.mockResolvedValue('If that email has an account, we sent a link');
    const { fixture, component, el } = await create();
    expect(el.querySelector('mat-card-title')?.textContent).toContain('Forgot Password');
    component.email.set(' ann@example.com ');
    await component.submit();
    fixture.detectChanges();
    expect(auth.forgotPassword).toHaveBeenCalledWith({ email: 'ann@example.com' });
    expect(el.querySelector('.sent')?.textContent).toContain('If that email has an account, we sent a link');
    expect(el.querySelector('form')).toBeNull();
    expect(el.querySelector('.links a')?.textContent).toContain('Back to Sign In');
  });

  it("shows the server's message when rate limited", async () => {
    auth.forgotPassword.mockRejectedValue(new ApiError('rate_limited', 'Too many attempts. Wait a few minutes and try again', 429));
    const { fixture, component, el } = await create();
    component.email.set('ann@example.com');
    await component.submit();
    fixture.detectChanges();
    expect(el.querySelector('.error')?.textContent).toContain('Too many attempts');
    expect(el.querySelector('form')).not.toBeNull();
  });
});
