import { readFileSync } from 'fs';
import { join } from 'path';

const manifest = JSON.parse(readFileSync(join(__dirname, '../../public/manifest.webmanifest'), 'utf8'));
const ASSETS = join(__dirname, '../../../content/assets');
// Width and height are in a PNG's IHDR chunk, bytes 16 to 23.
function pngSize(path: string): [number, number] {
  const head = readFileSync(path);
  return [head.readUInt32BE(16), head.readUInt32BE(20)];
}

describe('web app manifest', () => {
  it('asks for a full screen, landscape app that starts at the root', () => {
    expect(manifest).toMatchObject({
      name: 'Sanguosha (Tam quốc sát)',
      short_name: 'Sanguosha',
      id: '/',
      start_url: '/',
      scope: '/',
      display: 'fullscreen',
      display_override: ['fullscreen', 'standalone'],
      orientation: 'landscape',
      theme_color: '#3b332c',
      background_color: '#3b332c',
    });
  });

  it('lists icons that exist at the size they claim', () => {
    expect(manifest.icons).toEqual([
      { src: 'images/ui/brand/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: 'images/ui/brand/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: 'images/ui/brand/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ]);
    for (const icon of manifest.icons) {
      const side = Number(icon.sizes.split('x')[0]);
      expect(pngSize(join(ASSETS, icon.src.replace('images/', '')))).toEqual([side, side]);
    }
  });

  it('is linked from index.html with the theme colour', () => {
    const html = readFileSync(join(__dirname, '../index.html'), 'utf8');
    expect(html).toContain('<link rel="manifest" href="manifest.webmanifest" />');
    expect(html).toContain('<meta name="theme-color" content="#3b332c" />');
  });
});
