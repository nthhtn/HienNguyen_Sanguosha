import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { en } from '../i18n/en';
import { I18n } from '../i18n/i18n.service';
import { PlaybackSpeed } from '../playback-speed.service';
import { DevIndex } from './dev-index';
import { DevScenarioPage } from './dev-scenario-page';
import { AnimationLabPage } from './lab/animation-lab-page';
import { ANIMATIONS } from './lab/animations';
import { SCENARIOS } from './scenarios';

const text = (el: Element | null) => el!.textContent!.replace(/\s+/g, ' ').trim();
const params = new BehaviorSubject(convertToParamMap({}));

describe('preview pages in Vietnamese', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [DevIndex, DevScenarioPage, AnimationLabPage],
      providers: [provideRouter([]), { provide: ActivatedRoute, useValue: { paramMap: params } }],
    }).compileComponents();
    TestBed.inject(PlaybackSpeed).speed.set('instant');
    await TestBed.inject(I18n).setLocale('vi');
  });
  afterEach(() => localStorage.clear());

  it('the index names its groups and scenarios in Vietnamese', () => {
    const fixture = TestBed.createComponent(DevIndex);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect([...el.querySelectorAll('h2')].map((h) => text(h.querySelector('span:not(.count)')))).toEqual(['Bàn chơi', 'Cửa sổ phản hồi', 'Lựa chọn', 'Màn hình khác']);
    expect(text(el.querySelector('a[href="/preview/respond-sha"] .title'))).toBe('Phản hồi Sát');
    expect(text(el.querySelector('a[href="/preview/animations"] .title'))).toBe('Phòng thử hiệu ứng');
  });

  it('a scenario page and an unknown one use Vietnamese for the bar, Reset and the missing message', () => {
    params.next(convertToParamMap({ scenarioId: 'respond-sha' }));
    const page = TestBed.createComponent(DevScenarioPage);
    page.detectChanges();
    const el = page.nativeElement as HTMLElement;
    expect(text(el.querySelector('.bar strong'))).toBe('Phản hồi Sát');
    expect(text(el.querySelector('.bar button .text'))).toBe('Đặt lại');
    page.destroy();
    params.next(convertToParamMap({ scenarioId: 'nope' }));
    const missing = TestBed.createComponent(DevScenarioPage);
    missing.detectChanges();
    expect(text(missing.nativeElement)).toContain('Không tìm thấy kịch bản');
  });

  it('the lab names its controls, options and animations in Vietnamese', () => {
    const fixture = TestBed.createComponent(AnimationLabPage);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const row = el.querySelector('[data-animation="beat-play"]')!;
    expect(text(row.querySelector('strong'))).toBe('Đánh một lá bài');
    expect(text(row.querySelector('button.play .text'))).toBe('Phát');
    // The card choices are the cards' own Vietnamese names, never their ids.
    const cards = [...row.querySelectorAll('select')[2].querySelectorAll('option')].map((o) => text(o));
    expect(cards).toContain('Sát');
    expect(cards).toContain('Quyết Đấu');
    expect(cards.some((c) => /^[a-z-]+$/.test(c))).toBe(false);
    expect([...row.querySelectorAll('select')[0].querySelectorAll('option')].map((o) => text(o))[0]).toBe('Người chơi 0');
    expect(text(el.querySelector('[data-animation="beat-phase"] select:nth-of-type(2)') ?? el)).toContain('Giai đoạn');
  });

  it('every scenario and animation has Vietnamese text of its own', () => {
    const i18n = TestBed.inject(I18n);
    const keys = [...SCENARIOS, ...ANIMATIONS].flatMap((x) => [x.title, x.description]);
    for (const key of keys) expect({ key, sameAsEnglish: i18n.t(key) === en[key] }).toEqual({ key, sameAsEnglish: false });
  });
});
