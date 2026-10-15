import { ERROR_MESSAGES, ErrorBody, ErrorCode } from 'protocol';
import { AuthErrorCode } from '../auth/accounts';
import { RoomErrorCode } from '../rooms/errors';

export function errorBody(code: ErrorCode): ErrorBody {
  return { code, message: ERROR_MESSAGES[code] };
}

export const AUTH_ERROR_STATUS: Record<AuthErrorCode, number> = {
  email_taken: 409,
  invalid_credentials: 401,
  invalid_reset_token: 400,
  invalid_name: 400,
  weak_password: 400,
};

export const ROOM_ERROR_STATUS: Record<RoomErrorCode, number> = {
  not_found: 404,
  not_member: 403,
  not_host: 403,
  host_must_be_registered: 403,
  room_full: 409,
  in_progress: 409,
  name_taken: 409,
  already_in_room: 409,
  invalid_seat_count: 400,
  invalid_name: 400,
  invalid_message: 400,
  not_full: 409,
  no_game: 409,
  not_your_turn: 409,
  stale: 409,
  illegal_action: 400,
  solo_exists: 409,
  chat_empty: 400,
  chat_too_long: 400,
  chat_rate_limited: 429,
  chat_unavailable: 409,
};
