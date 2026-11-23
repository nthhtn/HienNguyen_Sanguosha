import { croppedCardArtUrl } from 'content';

// The pictures already requested, kept so the browser holds them decoded: a picture that is only requested when its
// card is first drawn (an opponent's Equipment, say) shows an empty frame, or its alt text, for a moment.
const held = new Map<string, HTMLImageElement>();

// Starts loading and decoding the card art for these card ids, once each. Cheap: the whole deck's cropped art is
// under 1 MB, and the browser fetches it after the board is up.
export function preloadCardArt(ids: Iterable<string>, create: () => HTMLImageElement = () => new Image()): void {
  for (const id of ids) {
    const url = croppedCardArtUrl(id);
    if (!url || held.has(url)) continue;
    const image = create();
    image.src = url;
    // A picture that cannot decode now is simply drawn when it is needed, as before.
    image.decode?.().catch(() => undefined);
    held.set(url, image);
  }
}

// For tests: how many pictures have been requested.
export function preloadedCardArtCount(): number {
  return held.size;
}
