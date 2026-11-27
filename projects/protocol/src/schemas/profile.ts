import { Type } from '@sinclair/typebox';
import { PASSWORD_MAX } from '../limits';
import { DisplayName, Password } from './auth';

// Shape checks only, like the auth schemas: the server applies the name and password rules.
export const ProfileQuerySchema = Type.Object({ mode: Type.Optional(Type.Union([Type.Literal('all'), Type.Literal('solo'), Type.Literal('online')])) });
export const UpdateProfileBodySchema = Type.Object({ displayName: DisplayName });
export const ChangePasswordBodySchema = Type.Object({ currentPassword: Type.String({ minLength: 1, maxLength: PASSWORD_MAX }), newPassword: Password });
