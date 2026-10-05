import { TestBed } from '@angular/core/testing';
import { SeatGenerals } from 'engine';
import { SeatAvatar } from './seat-avatar';

function render(generals: SeatGenerals): HTMLElement {
  const fixture = TestBed.createComponent(SeatAvatar);
  fixture.componentRef.setInput('generals', generals);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

const half = (el: HTMLElement, slot: 'main' | 'deputy') => el.querySelector(`.half[data-slot="${slot}"]`) as HTMLButtonElement;
const src = (h: Element) => (h.querySelector('img') as HTMLImageElement | null)?.getAttribute('src') ?? null;

describe('SeatAvatar', () => {
  afterEach(() => document.querySelector('.cdk-overlay-container')?.replaceChildren());

  it('puts the Main General on the left and the Deputy on the right, in one frame', () => {
    const el = render({
      main: { generalDefinitionId: 'guan-yu', revealed: true },
      deputy: { generalDefinitionId: 'zhang-fei', revealed: true },
    });
    const halves = [...el.querySelectorAll('.frame > .half')];
    expect(halves.map((h) => h.getAttribute('data-slot'))).toEqual(['main', 'deputy']);
    expect(src(halves[0])).toBe('/card-art/generals/shu/guan-yu.jpg');
    expect(src(halves[1])).toBe('/card-art/generals/shu/zhang-fei.jpg');
    expect(half(el, 'main').querySelector('.caption')!.textContent!.trim()).toBe('Guan Yu');
    expect(half(el, 'deputy').querySelector('.caption')!.textContent!.trim()).toBe('Zhang Fei');
  });

  it('shows the card back and “Hidden” for another seat’s hidden General, keeping Main left (Review Focus 1)', () => {
    const el = render({
      main: { generalDefinitionId: 'hidden', revealed: false },
      deputy: { generalDefinitionId: 'zhao-yun', revealed: true },
    });
    expect(src(half(el, 'main'))).toBe('/card-art/generals/unnamed.jpg');
    expect(half(el, 'main').querySelector('.caption')!.textContent!.trim()).toBe('Hidden');
    expect(src(half(el, 'deputy'))).toBe('/card-art/generals/shu/zhao-yun.jpg');
    expect(el.textContent).not.toContain('hidden');
  });

  it('shows your own hidden General’s real art, dimmed, with an eye-off mark (Review Focus 2)', () => {
    const el = render({
      main: { generalDefinitionId: 'cao-cao', revealed: false },
      deputy: { generalDefinitionId: 'zhen-ji', revealed: true },
    });
    const main = half(el, 'main');
    expect(src(main)).toBe('/card-art/generals/wei/cao-cao.jpg');
    expect(main.classList).toContain('own-hidden');
    expect(main.querySelector('mat-icon')!.textContent!.trim()).toBe('visibility_off');
    expect(main.querySelector('.caption')!.textContent!.trim()).toBe('Cao Cao (hidden)');
    expect(half(el, 'deputy').classList).not.toContain('own-hidden');
  });

  it('renders a captioned placeholder, not a broken image, for a General with no art (Review Focus 3)', () => {
    const el = render({
      main: { generalDefinitionId: 'no-such-general', revealed: true },
      deputy: { generalDefinitionId: 'zhen-ji', revealed: true },
    });
    const main = half(el, 'main');
    expect(main.querySelector('img')).toBeNull();
    expect(main.querySelector('.placeholder')).not.toBeNull();
    expect(main.querySelector('.caption')!.textContent!.trim()).toBe('No Such General');
  });

  it('falls back to the captioned placeholder when a portrait fails to load (e.g. card back not crawled)', () => {
    const fixture = TestBed.createComponent(SeatAvatar);
    fixture.componentRef.setInput('generals', {
      main: { generalDefinitionId: 'hidden', revealed: false },
      deputy: { generalDefinitionId: 'zhao-yun', revealed: true },
    });
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    half(el, 'main').querySelector('img')!.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(half(el, 'main').querySelector('img')).toBeNull();
    expect(half(el, 'main').querySelector('.placeholder')).not.toBeNull();
    expect(half(el, 'main').querySelector('.caption')!.textContent!.trim()).toBe('Hidden');
    expect(src(half(el, 'deputy'))).toBe('/card-art/generals/shu/zhao-yun.jpg');
  });

  it('opens the General’s info from a known half, and nothing from another seat’s hidden half (Review Focus 4)', async () => {
    const el = render({
      main: { generalDefinitionId: 'hidden', revealed: false },
      deputy: { generalDefinitionId: 'guan-yu', revealed: true },
    });
    expect(half(el, 'main').disabled).toBe(true);
    half(el, 'main').click();
    await new Promise((r) => setTimeout(r));
    expect(document.querySelector('.cdk-overlay-container app-general-info-dialog')).toBeNull();

    expect(half(el, 'deputy').getAttribute('aria-label')).toBe('Info: Guan Yu');
    half(el, 'deputy').click();
    await new Promise((r) => setTimeout(r));
    const info = document.querySelector('.cdk-overlay-container app-general-info-dialog')!;
    expect(info.textContent).toContain('Fighting Saint');
  });
});
