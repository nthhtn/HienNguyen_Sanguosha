import { Type } from '@sinclair/typebox';
import { DISPLAY_NAME_MAX, EMAIL_MAX, PASSWORD_MAX } from '../limits';

// Shape checks only. The server trims and applies the semantic rules (password
// length, display name) so it can answer with a specific error code.
const Email = Type.String({ minLength: 3, maxLength: EMAIL_MAX + 16, pattern: '^\\s*[^\\s@]+@[^\\s@]+\\s*$' });
const Password = Type.String({ maxLength: PASSWORD_MAX });
const DisplayName = Type.String({ maxLength: DISPLAY_NAME_MAX * 4 });

export const SignUpBodySchema = Type.Object({ email: Email, password: Password, displayName: DisplayName });
export const SignInBodySchema = Type.Object({ email: Email, password: Type.String({ minLength: 1, maxLength: PASSWORD_MAX }) });
export const GuestBodySchema = Type.Object({ displayName: DisplayName });
export const ForgotPasswordBodySchema = Type.Object({ email: Email });
export const ResetPasswordBodySchema = Type.Object({ token: Type.String({ minLength: 1, maxLength: 200 }), password: Password });

export const MeSchema = Type.Object({
  id: Type.String(),
  kind: Type.Union([Type.Literal('registered'), Type.Literal('guest')]),
  displayName: Type.String(),
  email: Type.Optional(Type.String()),
});

export const MessageBodySchema = Type.Object({ message: Type.String() });
export const ErrorBodySchema = Type.Object({ code: Type.String(), message: Type.String() });
