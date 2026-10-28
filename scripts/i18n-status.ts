// How much of the Vietnamese text a native speaker has reviewed.
//   npm run i18n:status            counts per category
//   npm run i18n:status -- --list  also lists the entries still in draft
import { ENGLISH_PROSE, kingdomWarsCardIds, cardIds, reviewGeneralIds } from 'content';
import review from '../projects/content/data/locales/vi/review.json';
import { en } from '../projects/app/src/app/i18n/en';
import { reviewStatus, reviewUniverse } from '../projects/app/src/app/i18n/review';

const universe = reviewUniverse(en, reviewGeneralIds(), [...cardIds(), ...kingdomWarsCardIds()], ENGLISH_PROSE);
const list = process.argv.includes('--list');
const statuses = reviewStatus(review, universe);

console.log('Vietnamese review status (draft entries display like any other)\n');
for (const s of statuses) {
  console.log(`${s.category.padEnd(40)} ${String(s.reviewed).padStart(4)} / ${String(s.total).padEnd(4)} reviewed`);
  if (s.unknown.length) console.log(`  unknown ids in review.json: ${s.unknown.join(', ')}`);
  if (list && s.unreviewed.length) console.log(`  draft: ${s.unreviewed.join(', ')}`);
}
const total = statuses.reduce((n, s) => n + s.total, 0);
const reviewed = statuses.reduce((n, s) => n + s.reviewed, 0);
console.log(`\n${reviewed} of ${total} entries reviewed, ${total - reviewed} still draft`);
process.exitCode = statuses.some((s) => s.unknown.length) ? 1 : 0;
