import { chatLength, normalizeChatBody } from './chat';

const BELL = String.fromCharCode(7);
const GRINNING = String.fromCodePoint(0x1f600);
const COMBINING_ACUTE = String.fromCharCode(0x301);
const E_ACUTE = String.fromCharCode(0xe9);

describe('normalizeChatBody', () => {
  it('trims and turns every run of whitespace, newlines included, into one space', () => {
    expect(normalizeChatBody('  hello \n\n  there\t friend  ')).toBe('hello there friend');
  });

  it('turns control characters into spaces', () => {
    expect(normalizeChatBody(`a${BELL}b`)).toBe('a b');
  });

  it('composes accents (NFC)', () => {
    expect(normalizeChatBody(`e${COMBINING_ACUTE}`)).toBe(E_ACUTE);
  });

  it('is empty when only whitespace and control characters are left', () => {
    expect(normalizeChatBody(` \n\t${BELL} `)).toBe('');
  });
});

describe('chatLength', () => {
  it('counts characters, not UTF-16 units', () => {
    expect(chatLength('abc')).toBe(3);
    expect(chatLength(GRINNING.repeat(3))).toBe(3);
  });
});
