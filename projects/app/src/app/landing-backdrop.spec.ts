import { readFileSync } from 'fs';
import { join } from 'path';

// jsdom applies no styles, so the rule is pinned by reading the styles. The landing picture behind the full-bleed pages
// (Online, Profile, My Games, sign-in, Setup) must not belong to the page box: `cover` scales it to that box, and the box
// changes height with its content (switching tabs in Profile), so the picture grew and shrank. It is drawn by a fixed
// layer the size of the window instead, which the page's content never resizes.
const read = (path: string) => readFileSync(join(__dirname, path), 'utf8');

describe('the landing background of full-bleed pages', () => {
  const pages: [string, string][] = [
    ['online/online-page.css', '.online-page'],
    ['auth/auth-card.css', '.auth-page'],
    ['setup/setup.ts', '.home'],
  ];

  it.each(pages)('%s draws the picture on a fixed layer, not on the page box', (file, selector) => {
    const source = read(file);
    const escaped = selector.replace('.', '\\.');
    const box = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(source)?.[1] ?? '';
    expect(box).not.toMatch(/landing\.jpg/);
    expect(box).toMatch(/isolation:\s*isolate/);
    const layer = new RegExp(`${escaped}::before\\s*\\{([^}]*)\\}`).exec(source)?.[1] ?? '';
    expect(layer).toMatch(/position:\s*fixed/);
    expect(layer).toMatch(/landing\.jpg/);
    expect(layer).toMatch(/cover/);
    expect(layer).toMatch(/z-index:\s*-1/);
  });

  it('is not set inline on the Setup page either', () => {
    expect(read('setup/setup.ts')).not.toMatch(/style="background-image/);
  });
});
