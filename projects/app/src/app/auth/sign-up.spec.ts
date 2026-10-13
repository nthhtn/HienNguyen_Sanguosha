import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { ApiError, AuthService } from './auth.service';
import { SignUp } from './sign-up';

describe('SignUp', () => {
  const auth = { signUp: jest.fn() };

  async function create() {
    await TestBed.configureTestingModule({
      imports: [SignUp],
      providers: [{ provide: AuthService, useValue: auth }, provideRouter([{ path: 'setup', children: [] }])],
    }).compileComponents();
    const fixture = TestBed.createComponent(SignUp);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, el: fixture.nativeElement as HTMLElement, router: TestBed.inject(Router) };
  }

  beforeEach(() => auth.signUp.mockReset());

  it('has the Create Account title and the three fields', async () => {
    const { el } = await create();
    expect(el.querySelector('mat-card-title')?.textContent).toContain('Create Account');
    const labels = [...el.querySelectorAll('mat-label')].map((l) => l.textContent?.trim());
    expect(labels).toEqual(['Email', 'Password', 'Your Name']);
    expect(el.querySelector('.password-hint')?.textContent).toContain('At least 8 characters');
  });

  it('creates the account and goes to Setup', async () => {
    auth.signUp.mockResolvedValue({ id: 'u1', kind: 'registered', displayName: 'Ann', email: 'ann@example.com' });
    const { component, router } = await create();
    const navigate = jest.spyOn(router, 'navigateByUrl');
    component.email.set(' ann@example.com ');
    component.password.set('secret-pass');
    component.displayName.set('Ann');
    await component.submit();
    expect(auth.signUp).toHaveBeenCalledWith({ email: 'ann@example.com', password: 'secret-pass', displayName: 'Ann' });
    expect(navigate).toHaveBeenCalledWith('/setup');
  });

  it("shows the server's message for a taken email", async () => {
    auth.signUp.mockRejectedValue(new ApiError('email_taken', 'That email already has an account', 409));
    const { fixture, component, el } = await create();
    component.email.set('ann@example.com');
    component.password.set('secret-pass');
    component.displayName.set('Ann');
    await component.submit();
    fixture.detectChanges();
    expect(el.querySelector('.error')?.textContent).toContain('That email already has an account');
  });
});
