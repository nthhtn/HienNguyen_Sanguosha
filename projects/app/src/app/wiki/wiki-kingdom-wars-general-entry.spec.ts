import { TestBed } from '@angular/core/testing';
import { wikiKingdomWarsGenerals } from 'content';
import { WikiKingdomWarsGeneralEntry } from './wiki-kingdom-wars-general-entry';

// Only Zhou Tai's Refuting Death has a preview here, so the entry's behaviour does not depend on which files ship.
jest.mock('content', () => ({
  ...jest.requireActual('content'),
  skillPreviewUrl: (generalId: string, skillName: string, language: string) => (generalId === 'zhou-tai' && skillName === 'Refuting Death' ? `/preview/zhou-tai_refuting-death_${language}.mp4` : null),
}));

function render(generalId: string) {
  localStorage.clear();
  const fixture = TestBed.createComponent(WikiKingdomWarsGeneralEntry);
  fixture.componentRef.setInput('general', wikiKingdomWarsGenerals().find((g) => g.id === generalId)!);
  fixture.detectChanges();
  return fixture;
}

describe('A skill preview in the Kingdom Wars General entry', () => {
  afterEach(() => localStorage.clear());

  it('offers a Play Preview button, and loads no video until it is pressed', () => {
    const fixture = render('zhou-tai');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('button.preview-play')!.textContent).toContain('Play Preview');
    expect(el.querySelector('video')).toBeNull();
  });

  it('swaps the button for a player of the app’s language when it is pressed', () => {
    const fixture = render('zhou-tai');
    const el = fixture.nativeElement as HTMLElement;
    (el.querySelector('button.preview-play') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelector('button.preview-play')).toBeNull();
    const video = el.querySelector('video')!;
    expect(video.getAttribute('src')).toBe('/preview/zhou-tai_refuting-death_en.mp4');
    expect(video.hasAttribute('controls')).toBe(true);
  });

  it('shows nothing for a General whose skills have no preview', () => {
    const el = render('cao-cao').nativeElement as HTMLElement;
    expect(el.querySelector('.preview-play')).toBeNull();
    expect(el.querySelector('video')).toBeNull();
  });
});
