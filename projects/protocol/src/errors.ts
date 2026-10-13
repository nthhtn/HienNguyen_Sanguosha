import { DISPLAY_NAME_MAX, PASSWORD_MIN } from './limits';

export type ErrorCode =
  | 'invalid_body'
  | 'invalid_name'
  | 'weak_password'
  | 'email_taken'
  | 'invalid_credentials'
  | 'invalid_reset_token'
  | 'not_signed_in'
  | 'rate_limited'
  | 'bad_origin'
  | 'unsupported_media_type'
  | 'not_found'
  | 'internal'
  | 'version'
  | 'not_member'
  | 'not_host'
  | 'room_full'
  | 'in_progress'
  | 'name_taken'
  | 'host_must_be_registered'
  | 'already_in_room'
  | 'invalid_seat_count'
  | 'invalid_message';

// Every error the server sends: a stable code for code, a message for people.
export interface ErrorBody {
  code: ErrorCode;
  message: string;
}

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  invalid_body: 'Some fields are missing or invalid',
  invalid_name: `Names need 1 to ${DISPLAY_NAME_MAX} characters`,
  weak_password: `Passwords need at least ${PASSWORD_MIN} characters`,
  email_taken: 'That email already has an account',
  invalid_credentials: 'Email or password is incorrect',
  invalid_reset_token: 'This reset link is invalid or has expired',
  not_signed_in: 'Please sign in first',
  rate_limited: 'Too many attempts. Wait a few minutes and try again',
  bad_origin: 'Request blocked',
  unsupported_media_type: 'Requests must be sent as JSON',
  not_found: 'Not found',
  internal: 'Something went wrong. Please try again',
  version: 'Please reload to get the latest version',
  not_member: "You're not in this room",
  not_host: 'Only the host can do that',
  room_full: 'This room is full',
  in_progress: 'This room is already playing',
  name_taken: 'That name is already taken in this room. Choose another.',
  host_must_be_registered: 'Only registered players can host a room',
  already_in_room: "You're already in another room. Leave it first",
  invalid_seat_count: "That seat count doesn't fit this room",
  invalid_message: 'That request was not understood',
};
