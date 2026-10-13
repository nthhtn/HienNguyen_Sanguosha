import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { ApiError, AuthService } from './auth.service';
import { PlayAsGuest } from './guest';

describe('PlayAsGuest', () => {
  const auth = { playAsGuest: jest.fn() };

  async function create() {
    await TestBed.configureTestingModule({
      imports: [PlayAsGuest],
      providers: [{ provide: AuthService, useValue: auth }, provideRouter([{ path: 'setup', children: [] }])],
    }).compileComponents();
    const fixture = TestBed.createComponent(PlayAsGuest);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, el: fixture.nativeElement as HTMLElement, router: TestBed.inject(Router) };
  }

  beforeEach(() => auth.playAsGuest.mockReset());

  it('warns that a guest seat lives in this browser only', async () => {
    const { el } = await create();
    expect(el.querySelector('mat-card-title')?.textContent).toContain('Play as Guest');
    expect(el.querySelector('.hint')?.textContent).toContain("Playing as a guest: if you clear your browser data you can't return to this game");
  });

  it('plays as a guest with the given name and goes to Setup', async () => {
    auth.playAsGuest.mockResolvedValue({ id: 'u2', kind: 'guest', displayName: 'Zhou Yu' });
    const { component, router } = await create();
    const navigate = jest.spyOn(router, 'navigateByUrl');
    component.displayName.set('Zhou Yu');
    await component.submit();
    expect(auth.playAsGuest).toHaveBeenCalledWith({ displayName: 'Zhou Yu' });
    expect(navigate).toHaveBeenCalledWith('/setup');
  });

  it("shows the server's message for a rejected name", async () => {
    auth.playAsGuest.mockRejectedValue(new ApiError('invalid_name', 'Names need 1 to 24 characters', 400));
    const { fixture, component, el } = await create();
    component.displayName.set('x');
    await component.submit();
    fixture.detectChanges();
    expect(el.querySelector('.error')?.textContent).toContain('Names need 1 to 24 characters');
  });
});
