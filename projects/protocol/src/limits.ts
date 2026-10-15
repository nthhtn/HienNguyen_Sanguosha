export const PASSWORD_MIN = 8;
// Caps the work one scrypt hash can be asked to do.
export const PASSWORD_MAX = 200;
export const EMAIL_MAX = 254;
export const DISPLAY_NAME_MAX = 24;
// The fewest seats a room may have. The most depends on the content, so the
// server sends it as SeatLimits.
export const MIN_SEATS = 2;
// The longest request id a client may attach to a socket message.
export const REQ_ID_MAX = 64;
// The most actions one game.submit may carry (a whole Discard phase is one move).
export const MAX_SUBMIT_ACTIONS = 50;

// The longest chat message, in characters (code points), after normalizing.
export const CHAT_BODY_MAX = 300;
// A member may send at most CHAT_RATE_LIMIT messages in any CHAT_RATE_WINDOW_MS.
export const CHAT_RATE_LIMIT = 5;
export const CHAT_RATE_WINDOW_MS = 10_000;
// How many recent messages a welcome carries.
export const CHAT_HISTORY = 100;
