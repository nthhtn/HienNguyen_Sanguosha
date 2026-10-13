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
