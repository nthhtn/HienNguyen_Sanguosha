import type { ErrorCode } from 'protocol';

export type RoomErrorCode = Extract<
  ErrorCode,
  | 'not_found'
  | 'not_member'
  | 'not_host'
  | 'room_full'
  | 'in_progress'
  | 'name_taken'
  | 'host_must_be_registered'
  | 'already_in_room'
  | 'invalid_seat_count'
  | 'invalid_name'
  | 'invalid_message'
>;

// A room input that the rules refuse. Nothing changed; the sender gets the code.
export class RoomError extends Error {
  constructor(readonly code: RoomErrorCode) {
    super(code);
    this.name = 'RoomError';
  }
}
