import type { Static } from '@sinclair/typebox';
import type {
  ForgotPasswordBodySchema,
  GuestBodySchema,
  MeSchema,
  MessageBodySchema,
  ResetPasswordBodySchema,
  SignInBodySchema,
  SignUpBodySchema,
} from './schemas/auth';

export type UserKind = 'registered' | 'guest';
export type SignUpBody = Static<typeof SignUpBodySchema>;
export type SignInBody = Static<typeof SignInBodySchema>;
export type GuestBody = Static<typeof GuestBodySchema>;
export type ForgotPasswordBody = Static<typeof ForgotPasswordBodySchema>;
export type ResetPasswordBody = Static<typeof ResetPasswordBodySchema>;
export type Me = Static<typeof MeSchema>;
export type MessageBody = Static<typeof MessageBodySchema>;

// The answer to every forgot-password request, so it never tells whether an
// email has an account.
export const FORGOT_PASSWORD_MESSAGE = 'If that email has an account, we sent a link';
