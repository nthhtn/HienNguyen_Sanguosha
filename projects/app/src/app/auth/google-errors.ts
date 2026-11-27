import { msg, type Msg } from '../i18n/msg';

// What the Sign In page says when Google sent the player back with `?error=<code>`.
// A code this version does not know shows nothing.
const MESSAGES: Record<string, Msg> = {
  google_failed: msg('auth.googleFailed'),
  google_cancelled: msg('auth.googleCancelled'),
  google_unverified: msg('auth.googleUnverified'),
  google_email_in_use: msg('auth.googleEmailInUse'),
};

export function googleErrorMsg(code: string | null): Msg | null {
  return code !== null && Object.prototype.hasOwnProperty.call(MESSAGES, code) ? MESSAGES[code] : null;
}
