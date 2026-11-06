import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

// Guards the asset layout: every /images/... and /audio/... path written in the app or content source
// (a constant, a template, a stylesheet) must name a file that exists in projects/content/assets.
const ASSETS = join(__dirname, '../../../content/assets');
const SOURCE_ROOTS = [join(__dirname, '..'), join(__dirname, '../../../content/src')];
const LINK = /(?:^|[\s"'(`=])\/?(images|audio)\/([A-Za-z0-9_\-./]+\.(?:png|jpe?g|webp|svg|ogg|mp3))/g;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|html|css|scss)$/.test(name) && !name.endsWith('.spec.ts') ? [path] : [];
  });
}

describe('asset links in source', () => {
  const links = SOURCE_ROOTS.flatMap(sourceFiles).flatMap((file) =>
    [...readFileSync(file, 'utf8').matchAll(LINK)].map((m) => ({ file, url: `/${m[1]}/${m[2]}`, onDisk: m[1] === 'audio' ? join(ASSETS, 'audio', m[2]) : join(ASSETS, m[2]) })),
  );

  it('finds the links it is meant to check', () => {
    expect(links.length).toBeGreaterThan(20);
  });

  it('points every link at a file in the content assets', () => {
    const missing = links.filter((l) => !existsSync(l.onDisk)).map((l) => `${l.url} (in ${l.file.replace(join(__dirname, '../../../..') + '/', '')})`);
    expect(missing).toEqual([]);
  });
});
