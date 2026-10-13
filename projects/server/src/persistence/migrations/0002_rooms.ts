import { Kysely, sql } from 'kysely';

// Rooms and their members (spec "Database"). The host is a member, so the
// foreign key from rooms to room_players is added once both tables exist.
const UP = [
  `CREATE TABLE rooms (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    visibility text NOT NULL CHECK (visibility IN ('open', 'solo')),
    status text NOT NULL CHECK (status IN ('lobby', 'playing', 'closed')),
    seat_count int NOT NULL CHECK (seat_count >= 2),
    rules jsonb NOT NULL,
    host_player_id uuid,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL
  )`,
  `CREATE INDEX rooms_live ON rooms (created_at) WHERE status <> 'closed'`,
  `CREATE TABLE room_players (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id uuid NOT NULL REFERENCES rooms (id) ON DELETE CASCADE,
    user_id uuid REFERENCES users (id) ON DELETE SET NULL,
    kind text NOT NULL CHECK (kind IN ('human', 'bot')),
    display_name text NOT NULL,
    joined_at timestamptz NOT NULL,
    left_at timestamptz,
    CONSTRAINT room_players_bot_has_no_user CHECK (kind = 'human' OR user_id IS NULL)
  )`,
  `CREATE UNIQUE INDEX room_players_current_name ON room_players (room_id, lower(display_name)) WHERE left_at IS NULL`,
  `CREATE UNIQUE INDEX room_players_current_user ON room_players (room_id, user_id) WHERE left_at IS NULL AND user_id IS NOT NULL`,
  `CREATE INDEX room_players_user_id ON room_players (user_id)`,
  `ALTER TABLE rooms ADD CONSTRAINT rooms_host_player FOREIGN KEY (host_player_id) REFERENCES room_players (id)`,
];

const DOWN = [`ALTER TABLE rooms DROP CONSTRAINT rooms_host_player`, `DROP TABLE room_players`, `DROP TABLE rooms`];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function up(db: Kysely<any>): Promise<void> {
  for (const statement of UP) await sql.raw(statement).execute(db);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function down(db: Kysely<any>): Promise<void> {
  for (const statement of DOWN) await sql.raw(statement).execute(db);
}
