import { readDisplayModeOverride } from './display-mode-override';

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key) => map.get(key) ?? null,
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (key) => void map.delete(key),
    setItem: (key, value) => void map.set(key, String(value)),
  };
}

describe('readDisplayModeOverride', () => {
  it('forces the mode named in the address, and remembers it', () => {
    const storage = memoryStorage();
    expect(readDisplayModeOverride('?display=fullscreen', storage, true)).toBe('fullscreen');
    expect(storage.getItem('sgs.display')).toBe('fullscreen');
    expect(readDisplayModeOverride('', storage, true)).toBe('fullscreen');
  });

  it('forgets it with ?display=auto', () => {
    const storage = memoryStorage();
    storage.setItem('sgs.display', 'standalone');
    expect(readDisplayModeOverride('?display=auto', storage, true)).toBeNull();
    expect(storage.getItem('sgs.display')).toBeNull();
  });

  it('ignores a value it does not know, keeping what was stored', () => {
    const storage = memoryStorage();
    expect(readDisplayModeOverride('?display=bogus', storage, true)).toBeNull();
    expect(storage.length).toBe(0);
    storage.setItem('sgs.display', 'browser');
    expect(readDisplayModeOverride('?display=bogus', storage, true)).toBe('browser');
  });

  it('does nothing in a production build', () => {
    const storage = memoryStorage();
    storage.setItem('sgs.display', 'fullscreen');
    expect(readDisplayModeOverride('?display=standalone', storage, false)).toBeNull();
    expect(storage.getItem('sgs.display')).toBe('fullscreen');
  });

  it('still forces the mode with no storage', () => {
    expect(readDisplayModeOverride('?display=standalone', null, true)).toBe('standalone');
  });

  it('still forces the mode when storage throws', () => {
    const storage = memoryStorage();
    storage.setItem = () => {
      throw new Error('quota');
    };
    expect(readDisplayModeOverride('?display=standalone', storage, true)).toBe('standalone');
  });
});
