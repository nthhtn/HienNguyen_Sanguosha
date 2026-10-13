import type { Action, GameResult, GameRules } from 'engine';
import type { ColumnType, Generated } from 'kysely';
import type { GameSeat } from '../records';

// Row types, exactly as the tables are. Only mappers.ts turns these into
// domain records.
type Timestamp = ColumnType<Date, Date, Date>;
type NullableTimestamp = ColumnType<Date | null, Date | null | undefined, Date | null>;

export interface UsersTable {
  id: Generated<string>;
  kind: 'registered' | 'guest';
  email: string | null;
  password_hash: string | null;
  display_name: string;
  email_verified_at: NullableTimestamp;
  created_at: Timestamp;
  updated_at: Timestamp;
  last_seen_at: Timestamp;
}

export interface SessionsTable {
  id: Generated<string>;
  user_id: string;
  token_hash: string;
  created_at: Timestamp;
  last_seen_at: Timestamp;
  expires_at: Timestamp;
  revoked_at: NullableTimestamp;
}

export interface PasswordResetTokensTable {
  id: Generated<string>;
  user_id: string;
  token_hash: string;
  expires_at: Timestamp;
  used_at: NullableTimestamp;
  created_at: Timestamp;
}

export interface RoomsTable {
  id: Generated<string>;
  visibility: 'open' | 'solo';
  status: 'lobby' | 'playing' | 'closed';
  seat_count: number;
  // jsonb: read back as an object, written as JSON text.
  rules: ColumnType<GameRules, string, string>;
  host_player_id: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface RoomPlayersTable {
  id: Generated<string>;
  room_id: string;
  user_id: string | null;
  kind: 'human' | 'bot';
  display_name: string;
  joined_at: Timestamp;
  left_at: NullableTimestamp;
}

export interface GamesTable {
  id: Generated<string>;
  room_id: string;
  // bigint: read back as a string, written as a number. Never updated.
  seed: ColumnType<string, number, never>;
  seats: ColumnType<GameSeat[], string, never>;
  rules: ColumnType<GameRules, string, never>;
  build_id: string;
  status: 'running' | 'finished' | 'aborted' | 'broken';
  result: ColumnType<GameResult | null, string | null, string | null>;
  action_count: ColumnType<number, number | undefined, number>;
  started_at: Timestamp;
  finished_at: NullableTimestamp;
}

export interface GameActionsTable {
  game_id: string;
  seq: number;
  seat_id: string;
  source: 'human' | 'bot' | 'timeout' | 'takeover';
  action: ColumnType<Action, string, never>;
  state_hash: string;
  created_at: Timestamp;
}

export interface Database {
  users: UsersTable;
  sessions: SessionsTable;
  password_reset_tokens: PasswordResetTokensTable;
  rooms: RoomsTable;
  room_players: RoomPlayersTable;
  games: GamesTable;
  game_actions: GameActionsTable;
}
