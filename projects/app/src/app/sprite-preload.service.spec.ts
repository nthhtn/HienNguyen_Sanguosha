import { TestBed } from '@angular/core/testing';
import { SPRITE_IDS, spriteSheet } from 'content';
import { IMAGE_PRELOADER, SpritePreload } from './sprite-preload.service';

describe('SpritePreload', () => {
  function setup(preloader: (url: string) => void): SpritePreload {
    TestBed.configureTestingModule({ providers: [{ provide: IMAGE_PRELOADER, useValue: preloader }] });
    return TestBed.inject(SpritePreload);
  }

  it('requests every sprite sheet', () => {
    const urls: string[] = [];
    setup((url) => urls.push(url)).start();
    expect(urls.sort()).toEqual(SPRITE_IDS.map((id) => spriteSheet(id).url).sort());
    expect(urls).toHaveLength(7);
  });

  it('requests the shipped WebP sheets', () => {
    const urls: string[] = [];
    setup((url) => urls.push(url)).start();
    expect(urls.every((url) => /^\/images\/effects\/sheets\/[a-z-]+\.webp$/.test(url))).toBe(true);
  });

  it('requests them once per page load, however often it is started', () => {
    const urls: string[] = [];
    const preload = setup((url) => urls.push(url));
    preload.start();
    preload.start();
    expect(urls).toHaveLength(7);
  });

  it('keeps going when one request throws, and never throws itself', () => {
    const urls: string[] = [];
    const preload = setup((url) => {
      urls.push(url);
      if (urls.length === 2) throw new Error('blocked');
    });
    expect(() => preload.start()).not.toThrow();
    expect(urls).toHaveLength(7);
  });

  it('starts a real image request by default', () => {
    TestBed.resetTestingModule();
    const created: string[] = [];
    const setSrc = jest.spyOn(HTMLImageElement.prototype, 'src', 'set').mockImplementation((value: string) => void created.push(value));
    try {
      TestBed.inject(SpritePreload).start();
    } finally {
      setSrc.mockRestore();
    }
    expect(created).toHaveLength(7);
    expect(created.every((url) => url.endsWith('.webp'))).toBe(true);
  });
});
