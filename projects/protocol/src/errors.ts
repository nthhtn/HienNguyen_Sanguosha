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
  | 'internal';

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
};
