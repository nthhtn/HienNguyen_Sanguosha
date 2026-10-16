import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { I18n } from '../i18n/i18n.service';
import { Setup } from './setup';

const text = (el: Element | null) => el!.textContent!.replace(/\s+/g, ' ').trim();

describe('Setup in Vietnamese', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({ imports: [Setup], providers: [provideRouter([])] }).compileComponents();
    await TestBed.inject(I18n).setLocale('vi');
  });
  afterEach(() => localStorage.clear());

  function render() {
    const fixture = TestBed.createComponent(Setup);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('the title, the explanation, the toggles and the start button', () => {
    const { el } = render();
    expect(text(el.querySelector('mat-card-title'))).toBe('Quốc chiến');
    expect(text(el.querySelector('mat-card-subtitle'))).toBe('Bạn đấu với đối thủ máy');
    expect(text(el.querySelector('.how'))).toContain('Mỗi người chơi chọn hai Tướng úp cùng thế lực.');
    expect(text(el.querySelector('.how'))).toContain('Máy tự chơi lượt của mình.');
    expect(text(el.querySelector('.mode'))).toContain('Chơi với máy');
    expect(text(el.querySelector('.mode'))).toContain('Chơi luân phiên');
    expect(text(el.querySelector('.mode-hint'))).toBe('Bạn ngồi ghế đầu tiên, mọi ghế khác là đối thủ máy.');
    expect(text(el.querySelector('#seat-label'))).toBe('Số người chơi');
    expect(text(el.querySelector('mat-form-field mat-label'))).toBe('Tên của bạn');
    expect((el.querySelector('input.name') as HTMLInputElement).placeholder).toBe('Người chơi 0');
    expect(text(el.querySelector('button.start'))).toContain('Bắt đầu ván chơi');
  });

  it('pass and play: a name field for every seat, and the First Reveal Bonus at a big table', () => {
    const { fixture, el } = render();
    fixture.componentInstance.mode.set('pass-and-play');
    fixture.componentInstance.seatCount.set(6);
    fixture.detectChanges();
    expect(text(el.querySelector('mat-card-subtitle'))).toBe('Chơi luân phiên trên một thiết bị');
    expect(text(el.querySelector('.how'))).toContain('Chuyền thiết bị cho nhau.');
    expect(text(el.querySelector('.mode-hint'))).toContain('chuyền cho nhau giữa các lượt');
    expect([...el.querySelectorAll('mat-form-field mat-label')].map(text).slice(0, 2)).toEqual(['Tên người chơi 0', 'Tên người chơi 1']);
    expect(text(el.querySelector('.first-reveal'))).toBe('Thưởng lật đầu tiên');
    expect(text(el.querySelector('.rule-hint'))).toBe('Người chơi đầu tiên lật Tướng được rút 2 lá bài.');
  });
});
