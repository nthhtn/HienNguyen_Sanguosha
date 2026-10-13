import { ERROR_MESSAGES, ErrorBody, ErrorCode } from 'protocol';
import { AuthErrorCode } from '../auth/accounts';

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
