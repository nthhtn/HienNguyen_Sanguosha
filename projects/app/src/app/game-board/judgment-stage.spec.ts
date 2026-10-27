import { TestBed } from '@angular/core/testing';
import { I18n } from '../i18n/i18n.service';
import { JudgmentDescription } from './judgment-description';
import { JudgmentStage } from './judgment-stage';
import { card, king, seven, skillDescription } from './judgment-description.testing';

describe('JudgmentStage', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    delete (globalThis as { matchMedia?: unknown }).matchMedia;
  });

  function render(description: JudgmentDescription) {
    TestBed.configureTestingModule({});
    const fixture = TestBed.createComponent(JudgmentStage);
    fixture.componentRef.setInput('description', description);
    const unlocked = jest.fn();
    fixture.componentInstance.unlocked.subscribe(unlocked);
    // A second pass: with reduced motion the beats have already run, and show on the next one.
    fixture.detectChanges();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const at = (ms: number) => {
      jest.advanceTimersByTime(ms);
      fixture.detectChanges();
    };
    return { fixture, el, unlocked, at };
  }
  const bad = (over: Partial<JudgmentDescription> = {}) => skillDescription({ verdict: 'bad', effect: { kind: 'none' }, ...over });
  const count = (el: HTMLElement, selector: string) => el.querySelectorAll(selector).length;

  it('plays the source, the rule and the card in order', () => {
    const { el, at } = render(skillDescription());
    expect(count(el, '.source.in')).toBe(0);
    at(0);
    expect(count(el, '.source.in')).toBe(1);
    expect(count(el, '.rule.in')).toBe(0);
    at(500);
    expect(count(el, '.rule.in')).toBe(1);
    expect(count(el, '.pc.in')).toBe(0);
    at(500);
    expect(count(el, '.pc.in')).toBe(1);
    expect(count(el, '.pc.up')).toBe(0);
    at(300);
    expect(count(el, '.pc.up')).toBe(1);
  });

  it('draws a check for a good verdict after the head beats, and a cross for a bad one', () => {
    const good = render(skillDescription({ verdict: 'good' }));
    good.at(2099);
    expect(count(good.el, '.stamp.show')).toBe(0);
    good.at(1);
    expect(count(good.el, '.stamp.good.show')).toBe(1);
    TestBed.resetTestingModule();
    const cross = render(bad());
    cross.at(2100);
    expect(count(cross.el, '.stamp.bad.show')).toBe(1);
  });

  it('draws no stamp for a neutral verdict', () => {
    const { el, at } = render(skillDescription({ verdict: 'neutral' }));
    at(10_000);
    expect(count(el, '.stamp')).toBe(0);
  });

  it('does not draw the verdict while the judgment is unsettled, and shows the waiting line', () => {
    const { el, at } = render(skillDescription({ settled: false, verdict: null, effect: null, outcome: null, waiting: 'Waiting for Bo to decide whether to change the judgment' }));
    at(10_000);
    expect(count(el, '.stamp.show')).toBe(0);
    expect(el.querySelector('.waiting')!.textContent).toContain('Waiting for Bo');
  });

  it('draws the verdict once the replacement has had its animation after the judgment settles', () => {
    const { fixture, el, at } = render(skillDescription({ settled: false, verdict: null, effect: null, outcome: null, waiting: 'Waiting', card: seven }));
    at(3000);
    fixture.componentRef.setInput('description', skillDescription({
      card: king, replaced: [seven], changes: [{ text: 'Hing replaced 7 ♥ with K ♠', card: king }], verdict: 'bad', effect: { kind: 'none' },
    }));
    fixture.detectChanges();
    expect(count(el, '.pc.old')).toBe(1);
    at(1299);
    expect(count(el, '.stamp.show')).toBe(0);
    at(1);
    expect(count(el, '.stamp.bad.show')).toBe(1);
  });

  it('fans out replaced cards and strikes them out, the older ones smaller', () => {
    const olds = [card('o1', 'club', 2), card('o2', 'club', 3), card('o3', 'club', 4)];
    const { el, at } = render(skillDescription({ card: king, replaced: olds }));
    at(2000);
    expect(count(el, '.pc.old')).toBe(1);
    expect(count(el, '.pc.older')).toBe(2);
    expect(count(el, '.pc.current')).toBe(1);
  });

  it('shows the damage hearts and greys the lost ones in turn, once the consequence plays', () => {
    const description = bad({ effect: { kind: 'damage', amount: 3, subject: 'seat' }, hp: { seatName: 'Bo', current: 4, max: 4 } });
    const { el, at } = render(description);
    expect(count(el, '.heart')).toBe(4);
    at(2100 + 900);
    expect(count(el, '.heart.lost')).toBe(1);
    at(520);
    expect(count(el, '.heart.lost')).toBe(3);
    expect(el.querySelector('.dmg')!.textContent).toContain('3');
  });

  it('draws only the current HP when the maximum is not known', () => {
    const { el } = render(bad({ effect: { kind: 'damage', amount: 1, subject: 'seat' }, hp: { seatName: 'Bo', current: 2, max: null } }));
    expect(count(el, '.heart')).toBe(2);
  });

  it('shows the phases and strikes out the one that is skipped', () => {
    const { el, at } = render(bad({ effect: { kind: 'skip-phase', phase: 'Play' } }));
    expect([...el.querySelectorAll('.chip')].map((c) => c.textContent!.trim())).toEqual(['Draw Phase', 'Play Phase', 'Discard Phase']);
    at(3000);
    expect(el.querySelector('.chip.skipped')!.textContent).toContain('Play Phase');
  });

  it('marks the phase that is kept', () => {
    const { el, at } = render(skillDescription({ verdict: 'good', effect: { kind: 'keep-phase', phase: 'Draw' } }));
    at(3000);
    expect(el.querySelector('.chip.kept')!.textContent).toContain('Draw Phase');
  });

  it('shows Lightning moving on with an arrow between the seats', () => {
    const { el, at } = render(skillDescription({ verdict: 'good', effect: { kind: 'pass-on' }, judgedSeatName: 'Hing' }));
    at(3000);
    expect(el.querySelector('.arrow')).not.toBeNull();
    expect(el.querySelector('.chips.seats')!.textContent).toContain('Hing');
  });

  it('always shows the one-line sentence of the consequence', () => {
    const { el, at } = render(bad({ outcome: 'Bo takes 3 thunder damage' }));
    at(3000);
    expect(el.querySelector('.line.in')!.textContent).toContain('Bo takes 3 thunder damage');
  });

  it('unlocks Continue once, 1100 ms after the consequence', () => {
    const { unlocked, at } = render(skillDescription());
    at(4099);
    expect(unlocked).not.toHaveBeenCalled();
    at(1);
    expect(unlocked).toHaveBeenCalledTimes(1);
    at(20_000);
    expect(unlocked).toHaveBeenCalledTimes(1);
  });

  it('shows the final state at once under reduced motion', () => {
    (globalThis as { matchMedia?: unknown }).matchMedia = () => ({ matches: true });
    const { el, unlocked } = render(bad({ effect: { kind: 'skip-phase', phase: 'Play' } }));
    expect(count(el, '.stamp.bad.show')).toBe(1);
    expect(count(el, '.chip.skipped')).toBe(1);
    expect(unlocked).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('keeps its place when the language changes mid-sequence: nothing restarts, and the text follows', async () => {
    localStorage.clear();
    const { fixture, el, unlocked, at } = render(bad({ effect: { kind: 'skip-phase', phase: 'Play' } }));
    at(1500);
    expect(count(el, '.pc.in')).toBe(1);
    await TestBed.inject(I18n).setLocale('vi');
    fixture.detectChanges();
    expect(count(el, '.source.in')).toBe(1);
    expect(count(el, '.rule.in')).toBe(1);
    expect(count(el, '.pc.in')).toBe(1);
    expect(el.querySelector('.chip')!.textContent).not.toContain('Draw Phase');
    at(5000);
    expect(unlocked).toHaveBeenCalledTimes(1);
    localStorage.clear();
  });

  it('stops its timers when it is destroyed', () => {
    const { fixture } = render(skillDescription());
    fixture.destroy();
    expect(jest.getTimerCount()).toBe(0);
  });
});
