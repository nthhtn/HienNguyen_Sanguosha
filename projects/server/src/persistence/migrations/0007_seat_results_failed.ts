import { Kysely, sql } from 'kysely';

// Remembers a finished game whose seat results could not be backfilled, so the
// server does not replay it again at every start.
const UP = [`ALTER TABLE games ADD COLUMN seat_results_failed_at timestamptz`];
const DOWN = [`ALTER TABLE games DROP COLUMN seat_results_failed_at`];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function up(db: Kysely<any>): Promise<void> {
  for (const statement of UP) await sql.raw(statement).execute(db);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function down(db: Kysely<any>): Promise<void> {
  for (const statement of DOWN) await sql.raw(statement).execute(db);
}
