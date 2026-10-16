import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ApiError, AuthService, errorMsg } from './auth.service';
import { ForgotPassword } from './forgot-password';
import { PlayAsGuest } from './guest';
import { ResetPassword } from './reset-password';
import { SignIn } from './sign-in';
import { SignUp } from './sign-up';
import { I18n } from '../i18n/i18n.service';
import { resolveMsg } from '../i18n/msg';
import { makeTranslator } from '../i18n/translator';
import { vi } from '../i18n/vi';

const text = (el: Element | null) => el!.textContent!.replace(/\s+/g, ' ').trim();

const auth = {
  signIn: jest.fn(),
  signUp: jest.fn(),
  playAsGuest: jest.fn(),
  forgotPassword: jest.fn(),
  resetPassword: jest.fn(),
};

describe('Auth screens in Vietnamese', () => {
  beforeEach(async () => {
    localStorage.clear();
    Object.values(auth).forEach((fn) => fn.mockReset());
    TestBed.configureTestingModule({ providers: [{ provide: AuthService, useValue: auth }, provideRouter([])] });
    await TestBed.inject(I18n).setLocale('vi');
  });
  afterEach(() => localStorage.clear());

  function render<T>(component: new () => T) {
    const fixture = TestBed.createComponent(component);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement, instance: fixture.componentInstance };
  }

  it('sign in: title, fields, button and links', () => {
    const { el } = render(SignIn);
    expect(text(el.querySelector('mat-card-title'))).toBe('Đăng nhập');
    expect([...el.querySelectorAll('mat-label')].map(text)).toEqual(['Email', 'Mật khẩu']);
    expect(text(el.querySelector('button.submit'))).toBe('Đăng nhập');
    expect([...el.querySelectorAll('.links a')].map(text)).toEqual(['Quên mật khẩu', 'Tạo tài khoản', 'Chơi với tư cách khách']);
  });

  it('sign in: a refused sign-in shows the server error by its code, in Vietnamese', async () => {
    auth.signIn.mockRejectedValue(new ApiError('invalid_credentials', 'Email or password is incorrect', 401));
    const { fixture, el, instance } = render(SignIn);
    instance.email.set('ann@example.com');
    instance.password.set('secret');
    await instance.submit();
    fixture.detectChanges();
    expect(text(el.querySelector('.error'))).toBe('Email hoặc mật khẩu không đúng');
  });

  it('a limit in an error is filled in, and an unknown code keeps the server text', () => {
    const tr = makeTranslator(vi, 'vi');
    expect(resolveMsg(errorMsg(new ApiError('weak_password', 'x', 400)), tr)).toBe('Mật khẩu cần tối thiểu 8 ký tự');
    expect(resolveMsg(errorMsg(new ApiError('network', 'x', 0)), tr)).toBe('Không kết nối được với máy chủ. Hãy kiểm tra kết nối rồi thử lại');
    expect(resolveMsg(errorMsg(new ApiError('brand_new_code', 'The server says hi', 400)), tr)).toBe('The server says hi');
    expect(resolveMsg(errorMsg(new Error('boom')), tr)).toBe('Đã có lỗi xảy ra. Hãy thử lại');
  });

  it('an error shown on the page follows a language switch', async () => {
    auth.signIn.mockRejectedValue(new ApiError('invalid_credentials', 'Email or password is incorrect', 401));
    const { fixture, el, instance } = render(SignIn);
    instance.email.set('a@b.c');
    instance.password.set('x');
    await instance.submit();
    fixture.detectChanges();
    await TestBed.inject(I18n).setLocale('en');
    fixture.detectChanges();
    expect(text(el.querySelector('.error'))).toBe('Email or password is incorrect');
  });

  it('create account: fields, hint and links', () => {
    const { el } = render(SignUp);
    expect(text(el.querySelector('mat-card-title'))).toBe('Tạo tài khoản');
    expect([...el.querySelectorAll('mat-label')].map(text)).toEqual(['Email', 'Mật khẩu', 'Tên của bạn']);
    expect(text(el.querySelector('.password-hint'))).toBe('Tối thiểu 8 ký tự');
    expect(text(el.querySelector('button.submit'))).toBe('Tạo tài khoản');
    expect([...el.querySelectorAll('.links a')].map(text)).toEqual(['Đăng nhập', 'Chơi với tư cách khách']);
  });

  it('play as guest: title, hint and links', () => {
    const { el } = render(PlayAsGuest);
    expect(text(el.querySelector('mat-card-title'))).toBe('Chơi với tư cách khách');
    expect(text(el.querySelector('.hint'))).toBe('Chơi với tư cách khách: nếu bạn xóa dữ liệu trình duyệt, bạn sẽ không thể quay lại ván này');
    expect([...el.querySelectorAll('.links a')].map(text)).toEqual(['Đăng nhập', 'Tạo tài khoản']);
  });

  it('forgot password: the form, then the confirmation in Vietnamese', async () => {
    auth.forgotPassword.mockResolvedValue('If that email has an account, we sent a link');
    const { fixture, el, instance } = render(ForgotPassword);
    expect(text(el.querySelector('mat-card-title'))).toBe('Quên mật khẩu');
    expect(text(el.querySelector('button.submit'))).toBe('Gửi liên kết đặt lại');
    instance.email.set('ann@example.com');
    await instance.submit();
    fixture.detectChanges();
    expect(text(el.querySelector('.sent'))).toBe('Nếu email đó có tài khoản, chúng tôi đã gửi một liên kết');
    expect(text(el.querySelector('.links a'))).toBe('Quay lại đăng nhập');
  });

  it('reset password with a token: the form in Vietnamese', () => {
    const fixture = TestBed.createComponent(ResetPassword);
    (fixture.componentInstance as { token: string | null }).token = 't0ken'; // the link's token, as the route would give it
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(text(el.querySelector('mat-label'))).toBe('Mật khẩu mới');
    expect(text(el.querySelector('.password-hint'))).toBe('Tối thiểu 8 ký tự');
    expect(text(el.querySelector('button.submit'))).toBe('Đặt mật khẩu');
    expect(el.querySelector('.error')).toBeNull();
  });

  it('the name and chat limits are filled into their errors', () => {
    const tr = makeTranslator(vi, 'vi');
    expect(resolveMsg(errorMsg(new ApiError('invalid_name', 'x', 400)), tr)).toBe('Tên cần từ 1 đến 24 ký tự');
    expect(resolveMsg(errorMsg(new ApiError('chat_too_long', 'x', 400)), tr)).toBe('Tin nhắn tối đa 300 ký tự');
  });

  it('reset password: the invalid-link error without a token', () => {
    const { el } = render(ResetPassword);
    expect(text(el.querySelector('mat-card-title'))).toBe('Đặt lại mật khẩu');
    expect(text(el.querySelector('.error'))).toBe('Liên kết đặt lại này không hợp lệ hoặc đã hết hạn');
    expect(text(el.querySelector('.links a'))).toBe('Quên mật khẩu');
  });
});
