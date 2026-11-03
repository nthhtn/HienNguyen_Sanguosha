import { Kysely, sql } from 'kysely';

// A bot's name id (content's bot name pool): clients show its name in their own language. Null for a
// person and for bots added before names existed, which keep showing their stored display name.
const UP = [`ALTER TABLE room_players ADD COLUMN bot_name_id text`];

const DOWN = [`ALTER TABLE room_players DROP COLUMN bot_name_id`];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function up(db: Kysely<any>): Promise<void> {
  for (const statement of UP) await sql.raw(statement).execute(db);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function down(db: Kysely<any>): Promise<void> {
  for (const statement of DOWN) await sql.raw(statement).execute(db);
}
