import { Kysely, sql } from 'kysely';

// Room chat (spec "Database"). A message names the room member who sent it and,
// while a game runs, the game and how many actions it had.
const UP = [
  `CREATE TABLE chat_messages (
    id bigserial PRIMARY KEY,
    room_id uuid NOT NULL REFERENCES rooms (id) ON DELETE CASCADE,
    game_id uuid REFERENCES games (id) ON DELETE CASCADE,
    after_seq int CHECK (after_seq >= 0),
    room_player_id uuid NOT NULL REFERENCES room_players (id),
    body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 300),
    created_at timestamptz NOT NULL
  )`,
  `CREATE INDEX chat_messages_room_id ON chat_messages (room_id, id)`,
  `CREATE INDEX chat_messages_game_id ON chat_messages (game_id, id) WHERE game_id IS NOT NULL`,
];

const DOWN = [`DROP TABLE chat_messages`];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function up(db: Kysely<any>): Promise<void> {
  for (const statement of UP) await sql.raw(statement).execute(db);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function down(db: Kysely<any>): Promise<void> {
  for (const statement of DOWN) await sql.raw(statement).execute(db);
}
