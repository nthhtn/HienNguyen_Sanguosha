import { JUDGMENT_CHANGERS } from './judgments';

describe('JUDGMENT_CHANGERS', () => {
  it('registers Dark Magic without importing the Wind Generals', () => {
    expect(JUDGMENT_CHANGERS.has('dark-magic')).toBe(true);
    expect(JUDGMENT_CHANGERS.has('devil')).toBe(true);
  });
});
