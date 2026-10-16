import { FORGOT_PASSWORD_MESSAGE, GAME_OUTCOME_MESSAGES, ERROR_MESSAGES, REPLACED_MESSAGE, ROOM_LEFT_MESSAGES } from 'protocol';
import type { ErrorCode } from 'protocol';
import { ApiError, NETWORK_ERROR_MESSAGE, errorMsg } from '../auth/auth.service';
import { en } from './en';
import { resolveMsg } from './msg';
import { englishTranslator, makeTranslator } from './translator';
import { vi } from './vi';

// The app shows the protocol's messages by code, from its own catalog. The
// catalog must say the same as the protocol in English and exist in every
// language, or a new server code would show a raw key.
describe('the catalog against the protocol messages', () => {
  const viTr = makeTranslator(vi, 'vi');

  it.each(Object.keys(ERROR_MESSAGES) as ErrorCode[])('error code %s reads as the server says it in English, and exists in Vietnamese', (code) => {
    const message = errorMsg(new ApiError(code, ERROR_MESSAGES[code], 400));
    expect(resolveMsg(message, englishTranslator)).toBe(ERROR_MESSAGES[code]);
    expect(resolveMsg(message, viTr)).not.toBe(ERROR_MESSAGES[code]);
    expect(`error.${code}` in vi).toBe(true);
  });

  it('the room-left reasons, the stopped-game outcomes and the single messages match', () => {
    for (const [reason, text] of Object.entries(ROOM_LEFT_MESSAGES)) {
      if (reason !== 'left') expect(en[`roomLeft.${reason}` as keyof typeof en]).toBe(text);
    }
    for (const [outcome, text] of Object.entries(GAME_OUTCOME_MESSAGES)) expect(en[`outcome.${outcome}` as keyof typeof en]).toBe(text);
    expect(en['room.replaced']).toBe(REPLACED_MESSAGE);
    expect(en['auth.resetSent']).toBe(FORGOT_PASSWORD_MESSAGE);
    expect(en['error.network']).toBe(NETWORK_ERROR_MESSAGE);
  });

  it('a code the catalog lacks shows the server text, not a raw key', () => {
    expect(resolveMsg(errorMsg(new ApiError('brand_new_code', 'The server says hi', 400)), viTr)).toBe('The server says hi');
  });
});
