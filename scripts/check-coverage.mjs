// Fails when the coverage jest wrote is below the floor. Branches are reported, not gated.
import { readFileSync } from 'node:fs';

const FLOOR = 90;
const GATED = ['statements', 'lines', 'functions'];
const total = JSON.parse(readFileSync('coverage/coverage-summary.json', 'utf8')).total;

let failed = false;
for (const metric of [...GATED, 'branches']) {
  const { pct } = total[metric];
  const gated = GATED.includes(metric);
  const low = gated && pct < FLOOR;
  failed ||= low;
  console.log(`${low ? 'FAIL' : 'ok  '} ${metric}: ${pct}%${gated ? ` (floor ${FLOOR}%)` : ' (not gated)'}`);
}
process.exit(failed ? 1 : 0);
