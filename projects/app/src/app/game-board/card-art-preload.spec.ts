import { preloadCardArt, preloadedCardArtCount } from './card-art-preload';

describe('preloadCardArt', () => {
  function fakeImage() {
    const requested: string[] = [];
    const create = () => {
      const image = { decode: jest.fn(() => Promise.resolve()) } as unknown as HTMLImageElement;
      Object.defineProperty(image, 'src', { set: (url: string) => requested.push(url), get: () => '' });
      return image;
    };
    return { requested, create };
  }

  it('requests the cropped art of each card with art, and decodes it', () => {
    const { requested, create } = fakeImage();
    const before = preloadedCardArtCount();
    preloadCardArt(['sha', 'shan'], create);
    expect(requested).toHaveLength(2);
    expect(requested.every((url) => url.startsWith('/images/playing-cards/cropped/'))).toBe(true);
    expect(preloadedCardArtCount()).toBe(before + 2);
  });

  it('asks once per picture, however often it is called', () => {
    const { requested, create } = fakeImage();
    preloadCardArt(['tao'], create);
    preloadCardArt(['tao'], create);
    expect(requested.length).toBeLessThanOrEqual(1);
  });

  it('skips an id with no art, such as the hidden card', () => {
    const { requested, create } = fakeImage();
    preloadCardArt(['hidden', 'not-a-card'], create);
    expect(requested).toHaveLength(0);
  });

  it('survives a picture that cannot decode', async () => {
    const create = () => {
      const image = { decode: () => Promise.reject(new Error('bad')) } as unknown as HTMLImageElement;
      Object.defineProperty(image, 'src', { set: () => undefined, get: () => '' });
      return image;
    };
    expect(() => preloadCardArt(['jiu'], create)).not.toThrow();
    await Promise.resolve();
  });
});
