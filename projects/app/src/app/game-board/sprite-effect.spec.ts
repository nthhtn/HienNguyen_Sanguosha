import { TestBed } from '@angular/core/testing';
import { SpriteEffect } from './sprite-effect';
import { spriteDurationMs } from './sprite-plan';

function render(image: 'fire' | 'chain') {
  const fixture = TestBed.createComponent(SpriteEffect);
  fixture.componentRef.setInput('image', image);
  fixture.detectChanges();
  return fixture;
}

describe('SpriteEffect', () => {
  afterEach(() => {
    delete (HTMLElement.prototype as { animate?: unknown }).animate;
  });

  it('shows the sprite sheet, sized to one frame', () => {
    const el = render('chain').nativeElement as HTMLElement;
    const sprite = el.querySelector('.sprite') as HTMLElement;
    expect(sprite.style.backgroundImage).toContain('/images/effects/sheets/chain.png');
    expect(sprite.style.backgroundSize).toBe('600% 200%');
    expect(el.style.width).toContain('202px');
    expect(el.getAttribute('aria-hidden')).toBe('true');
  });

  it('shows the peak frame still where the browser cannot animate', () => {
    // jsdom has no element.animate; chain's peak is frame 5, the last cell of the first row
    const sprite = render('chain').nativeElement.querySelector('.sprite') as HTMLElement;
    expect(sprite.style.backgroundPosition).toBe('100% 0%');
  });

  it('plays a frame animation and a pop-and-fade for the length of the plan', () => {
    const animate = jest.fn(() => ({ cancel: jest.fn() }));
    (HTMLElement.prototype as unknown as { animate: unknown }).animate = animate;
    const fixture = render('fire');
    expect(animate).toHaveBeenCalledTimes(2);
    const calls = animate.mock.calls as unknown as [Keyframe[], KeyframeAnimationOptions][];
    for (const [, options] of calls) expect(options).toMatchObject({ duration: spriteDurationMs('fire'), fill: 'forwards' });
    expect(calls[0][0][0]).toMatchObject({ backgroundPosition: '0% 0%', easing: 'step-end' });
    expect(calls[1][0][calls[1][0].length - 1]).toMatchObject({ opacity: 0 });
    // starts on the first frame, not the peak
    expect((fixture.nativeElement.querySelector('.sprite') as HTMLElement).style.backgroundPosition).toBe('0% 0%');
  });

  it('cancels its animations when removed', () => {
    const cancel = jest.fn();
    (HTMLElement.prototype as unknown as { animate: unknown }).animate = jest.fn(() => ({ cancel }));
    render('fire').destroy();
    expect(cancel).toHaveBeenCalledTimes(2);
  });
});
