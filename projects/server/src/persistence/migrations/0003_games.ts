import { Kysely, sql } from 'kysely';

// Games and their event-sourced action log (spec "Database"). A room runs at
// most one game at a time.
const UP = [
  `CREATE TABLE games (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id uuid NOT NULL REFERENCES rooms (id) ON DELETE CASCADE,
    seed bigint NOT NULL CHECK (seed >= 0),
    seats jsonb NOT NULL,
    rules jsonb NOT NULL,
    build_id text NOT NULL,
    status text NOT NULL CHECK (status IN ('running', 'finished', 'aborted', 'broken')),
    result jsonb,
    action_count int NOT NULL DEFAULT 0 CHECK (action_count >= 0),
    started_at timestamptz NOT NULL,
    finished_at timestamptz
  )`,
  `CREATE UNIQUE INDEX games_one_running_per_room ON games (room_id) WHERE status = 'running'`,
  `CREATE INDEX games_room_id ON games (room_id)`,
  `CREATE TABLE game_actions (
    game_id uuid NOT NULL REFERENCES games (id) ON DELETE CASCADE,
    seq int NOT NULL CHECK (seq >= 1),
    seat_id text NOT NULL,
    source text NOT NULL CHECK (source IN ('human', 'bot', 'timeout', 'takeover')),
    action jsonb NOT NULL,
    state_hash text NOT NULL,
    created_at timestamptz NOT NULL,
    PRIMARY KEY (game_id, seq)
  )`,
];

const DOWN = [`DROP TABLE game_actions`, `DROP TABLE games`];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function up(db: Kysely<any>): Promise<void> {
  for (const statement of UP) await sql.raw(statement).execute(db);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function down(db: Kysely<any>): Promise<void> {
  for (const statement of DOWN) await sql.raw(statement).execute(db);
}
