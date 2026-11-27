import { Kysely, sql } from 'kysely';

// What each human seat of a finished game came to, written when the game ends
// (Profile spec "Server"). Rows go with their game and with their user.
const UP = [
  `CREATE TABLE game_seat_results (
    game_id uuid NOT NULL REFERENCES games (id) ON DELETE CASCADE,
    seat_id text NOT NULL,
    user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    main_general_id text,
    deputy_general_id text,
    kingdom text NOT NULL,
    allegiance text CHECK (allegiance IN ('kingdom', 'ambitionist')),
    eliminated boolean NOT NULL,
    won boolean,
    PRIMARY KEY (game_id, seat_id)
  )`,
  `CREATE INDEX game_seat_results_user_id ON game_seat_results (user_id)`,
];

const DOWN = [`DROP TABLE game_seat_results`];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function up(db: Kysely<any>): Promise<void> {
  for (const statement of UP) await sql.raw(statement).execute(db);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function down(db: Kysely<any>): Promise<void> {
  for (const statement of DOWN) await sql.raw(statement).execute(db);
}
