# Backend Stage 2: Server Foundation and Accounts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A running Node server with Postgres persistence and accounts (sign up, sign in, guest, sign out, forgot and reset password, rate limits), the shared `protocol` package, and the Angular auth screens with `AuthService`.

**Architecture:** `projects/protocol` holds wire types, limits, error codes and TypeBox schemas (schemas behind a separate `protocol/schemas` entry so the Angular bundle never pulls TypeBox in). `projects/server` is a Fastify app. Its layers are:

- the HTTP routes;
- an `AccountService`, which holds the domain logic and takes an injected clock;
- repository interfaces with in-memory and Postgres (Kysely) implementations, both checked by one shared contract test suite.

The Angular app gets `AuthService` (signals) plus five lazy-loaded auth screens and an account menu in the toolbar.

**Tech Stack:** Node 24, TypeScript ~6.0, Fastify 5, @fastify/cookie 11, @fastify/type-provider-typebox 5, @sinclair/typebox 0.34, Kysely 0.28 + pg 8, Postgres 17 (Docker Compose), tsx (dev runner), Jest 30 + ts-jest, Angular 22 + Material.

**Spec:** `docs/superpowers/specs/2026-10-13-backend-multiplayer-design.md` (sections "Layering", "Server modules", "Database", "Accounts and sessions", "HTTP API", "Angular changes", "Testing", "Stages" item 2).

**Branch:** `feat/backend-stage-2-server-accounts`

## Global Constraints

- **Module format.** Every server dependency must load under Jest's CommonJS runtime (ts-jest). Use **`@sinclair/typebox` ^0.34**, never the ESM-only `typebox` 1.x. Use **`kysely` ~0.28**, never 0.29+, which is ESM-only. Use **`@fastify/type-provider-typebox` ^5**, never 6.x, which needs `typebox` 1.x.
- **What `protocol` may import.** It is framework-free. It never imports server or database code. Its main entry (`protocol`) has no runtime imports from `@sinclair/typebox` (`import type` only). Schemas live behind `protocol/schemas`.
- **App imports.** The app never imports `protocol/schemas`, and never imports `server`.
- **Database rows never cross the wire.** Postgres rows map to domain records in `persistence/postgres/mappers.ts`. Domain records map to wire shapes in `server/src/views/`.
- **Hashing.** Hash only these:
  - passwords: scrypt (Node `crypto.scrypt`, random 16-byte salt, parameters stored in the hash string);
  - session tokens and reset tokens: sha256.

  Nothing else is hashed.
- **Session cookie.**
  - Name `sgs_session`.
  - Value: an opaque random 32-byte token, base64url.
  - Flags: `HttpOnly`, `SameSite=Lax`, `Path=/`, and `Secure` whenever `PUBLIC_ORIGIN` is https.
  - The database stores only its sha256.
- **Session lifetime.** Registered: 30 days, sliding. Guest: 7 days, sliding. Each authenticated request slides `last_seen_at` and `expires_at`.
- **Reset tokens.** Valid 1 hour, single use. A reset revokes **all** of the user's sessions, then signs in a new one.
- **Passwords.** At least 8 characters, and at most 200 (a scrypt DoS guard).
- **Display names.** Trimmed, with inner whitespace collapsed, NFC-normalized, 1–24 characters, no control characters.
- **User-facing messages**, verbatim:
  - Sign-in failure: "Email or password is incorrect".
  - Forgot password, always: "If that email has an account, we sent a link".
  - Guest hint: "Playing as a guest: if you clear your browser data you can't return to this game".
- **Request guard.** Every route is under `/api`. Every non-GET request needs `Content-Type: application/json` and an `Origin` equal to `PUBLIC_ORIGIN`.
- **UI text** follows `CLAUDE.md`:
  - Title Case for titles, buttons, links and field labels ("Sign In", "Create Account", "Forgot Password", "Your Name").
  - Sentence case for messages and hints.
- **Angular style.** Standalone components, signals for UI state, lazy `loadComponent` routes, and Angular Material as `projects/app/src/app/setup/setup.ts` uses it.
- **Code style.** Accessing an index signature needs bracket syntax (`env['PORT']`, `request.cookies['sgs_session']`), because `noPropertyAccessFromIndexSignature` is on.
- **Commits.** Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Decisions This Plan Makes (spec is silent)

- **Rate-limit values** (fixed window, in memory):

  | Action | Limit |
  |---|---|
  | Sign-in | 30 per IP, and 10 per email, per 15 min |
  | Sign-up and guest creation (shared) | 10 per IP per hour |
  | Forgot password | 10 per IP, and 3 per email, per hour |

  Over the limit: `429 rate_limited`.
- **Signing in, signing up, playing as a guest or resetting while already signed in** revokes the previous session on that browser. Only the new cookie is sent.
- **`POST /auth/signout`** always answers `204` and clears the cookie, even when nobody is signed in.
- **Semantic checks belong to `AccountService`.** That covers the password length (`weak_password`) and the display name (`invalid_name`). The TypeBox schemas check shape only, so users get a specific message rather than a generic `invalid_body`.
- **Dev convenience:** when `DATABASE_URL` is unset outside production, the server runs on the in-memory store and logs a warning. In production, config refuses to start without `DATABASE_URL` and `PUBLIC_ORIGIN`.
- **Postgres repository tests** run only when `TEST_DATABASE_URL` is set, using `npm run test:db`. Each run creates and drops its own database. Docker must be running for them. An executor that cannot start Docker must report the Postgres suite as **not run**. It must never count the skip as a pass.
- **Mail in production.** Only the console Mailer exists in this stage. The production mail provider is a deployment item (the spec's "Open items").

## Review Focus

1. **Email casing and whitespace.** `"Ann@Example.com "` signs up, and `"ann@example.com"` then signs in. A second sign-up with any casing gets `email_taken`. Tests: Task 3 contract and Task 5 AccountService.
2. **A stale, expired, revoked or garbage session cookie** gets `401 not_signed_in` from `/api/me` with the cookie cleared, never a 500. Test: Task 6.
3. **Reset links:**
   - a reused or expired link gets `invalid_reset_token`;
   - a weak new password does **not** burn the link;
   - forgot-password for an unknown email or a guest gives the same response and sends no mail.

   Tests: Task 5 and Task 6.
4. **Signing in while already signed in (for example as a guest)** revokes the old session, and the response carries exactly one `sgs_session` cookie. Test: Task 6.
5. **Two racing sign-ups with the same email** produce exactly one user, and the other caller gets `EmailTakenError` (HTTP 409), not a 500. Racing consumes of one reset token succeed exactly once. Tests: Task 3 contract, run against both stores.

---

### Task 1: The `protocol` package

**Files:**
- Modify: `package.json` (dependency), `tsconfig.json` (paths), `jest.config.js` (new project)
- Create:
  - `projects/protocol/tsconfig.json`
  - `projects/protocol/src/public-api.ts`
  - `projects/protocol/src/version.ts`
  - `projects/protocol/src/limits.ts`
  - `projects/protocol/src/names.ts`
  - `projects/protocol/src/errors.ts`
  - `projects/protocol/src/auth.ts`
  - `projects/protocol/src/schemas/auth.ts`
  - `projects/protocol/src/schemas/index.ts`
- Test: `projects/protocol/src/names.spec.ts`, `projects/protocol/src/schemas/auth.spec.ts`

**Interfaces:**
- Consumes: nothing.
- Produces, from `protocol`:
  - `PROTOCOL_VERSION: 1`
  - `PASSWORD_MIN = 8`, `PASSWORD_MAX = 200`, `EMAIL_MAX = 254`, `DISPLAY_NAME_MAX = 24`
  - `normalizeDisplayName(raw: string): string | null`
  - `type ErrorCode`, `interface ErrorBody { code: ErrorCode; message: string }`, `ERROR_MESSAGES: Record<ErrorCode, string>`
  - `type UserKind = 'registered' | 'guest'`
  - `type SignUpBody`, `SignInBody`, `GuestBody`, `ForgotPasswordBody`, `ResetPasswordBody`, `Me`, `MessageBody`
  - `FORGOT_PASSWORD_MESSAGE`
- Produces, from `protocol/schemas`: `SignUpBodySchema`, `SignInBodySchema`, `GuestBodySchema`, `ForgotPasswordBodySchema`, `ResetPasswordBodySchema`, `MeSchema`, `ErrorBodySchema`, `MessageBodySchema`.

- [ ] **Step 1: Install TypeBox and wire the project**

```bash
npm install @sinclair/typebox@^0.34
```

In `tsconfig.json` `compilerOptions.paths`, add two entries after `"engine"`:

```json
      "protocol": ["./projects/protocol/src/public-api.ts"],
      "protocol/schemas": ["./projects/protocol/src/schemas/index.ts"]
```

Create `projects/protocol/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "types": ["node", "jest"]
  },
  "include": ["src/**/*.ts"]
}
```

In `jest.config.js`, add this entry to `projects` (after `bots`):

```js
    {
      displayName: 'protocol',
      preset: 'ts-jest',
      testEnvironment: 'node',
      rootDir: 'projects/protocol/src',
      testMatch: ['**/*.spec.ts'],
    },
```

- [ ] **Step 2: Write the failing tests**

`projects/protocol/src/names.spec.ts`:

```ts
import { DISPLAY_NAME_MAX, normalizeDisplayName } from './public-api';

describe('normalizeDisplayName', () => {
  it('trims and collapses inner whitespace', () => {
    expect(normalizeDisplayName('  Liu   Bei \t')).toBe('Liu Bei');
  });

  it('rejects an empty or blank name', () => {
    expect(normalizeDisplayName('')).toBeNull();
    expect(normalizeDisplayName('   ')).toBeNull();
  });

  it('accepts exactly DISPLAY_NAME_MAX characters and rejects one more', () => {
    expect(normalizeDisplayName('a'.repeat(DISPLAY_NAME_MAX))).toBe('a'.repeat(DISPLAY_NAME_MAX));
    expect(normalizeDisplayName('a'.repeat(DISPLAY_NAME_MAX + 1))).toBeNull();
  });

  it('counts length after trimming', () => {
    expect(normalizeDisplayName(`  ${'a'.repeat(DISPLAY_NAME_MAX)}  `)).toBe('a'.repeat(DISPLAY_NAME_MAX));
  });

  it('rejects control characters', () => {
    expect(normalizeDisplayName('Cao\u0000Cao')).toBeNull();
    expect(normalizeDisplayName('Cao\u001bCao')).toBeNull();
  });

  it('normalizes to NFC so look-alike names compare equal', () => {
    expect(normalizeDisplayName('José')).toBe('José');
  });
});
```

`projects/protocol/src/schemas/auth.spec.ts`:

```ts
import { Value } from '@sinclair/typebox/value';
import { GuestBodySchema, MeSchema, ResetPasswordBodySchema, SignInBodySchema, SignUpBodySchema } from './index';

describe('auth schemas', () => {
  it('accepts a sign-up body, including an email with surrounding spaces', () => {
    expect(Value.Check(SignUpBodySchema, { email: ' Ann@Example.com ', password: 'secret-pass', displayName: 'Ann' })).toBe(true);
  });

  it('rejects a sign-up body with a missing field', () => {
    expect(Value.Check(SignUpBodySchema, { email: 'ann@example.com', password: 'secret-pass' })).toBe(false);
  });

  it('rejects an email without an @', () => {
    expect(Value.Check(SignInBodySchema, { email: 'ann.example.com', password: 'x' })).toBe(false);
  });

  it('rejects a password over 200 characters', () => {
    expect(Value.Check(SignInBodySchema, { email: 'a@b.c', password: 'x'.repeat(201) })).toBe(false);
    expect(Value.Check(ResetPasswordBodySchema, { token: 't', password: 'x'.repeat(201) })).toBe(false);
  });

  it('leaves the semantic checks (short password, blank name) to the server', () => {
    expect(Value.Check(SignUpBodySchema, { email: 'a@b.c', password: 'short', displayName: ' ' })).toBe(true);
  });

  it('requires a display name for a guest', () => {
    expect(Value.Check(GuestBodySchema, {})).toBe(false);
    expect(Value.Check(GuestBodySchema, { displayName: 'Guest' })).toBe(true);
  });

  it('describes a guest Me without an email and a registered one with it', () => {
    expect(Value.Check(MeSchema, { id: 'u1', kind: 'guest', displayName: 'Guest' })).toBe(true);
    expect(Value.Check(MeSchema, { id: 'u2', kind: 'registered', displayName: 'Ann', email: 'ann@example.com' })).toBe(true);
    expect(Value.Check(MeSchema, { id: 'u3', kind: 'admin', displayName: 'X' })).toBe(false);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx jest --selectProjects protocol`
Expected: FAIL, with "Cannot find module './public-api'" and "Cannot find module './index'".

- [ ] **Step 4: Write the implementation**

`projects/protocol/src/version.ts`:

```ts
// Bumped whenever a socket or HTTP message changes shape. The server refuses a
// client whose version differs, and the client asks the user to reload.
export const PROTOCOL_VERSION = 1;
```

`projects/protocol/src/limits.ts`:

```ts
export const PASSWORD_MIN = 8;
// Caps the work one scrypt hash can be asked to do.
export const PASSWORD_MAX = 200;
export const EMAIL_MAX = 254;
export const DISPLAY_NAME_MAX = 24;
```

`projects/protocol/src/names.ts`:

```ts
import { DISPLAY_NAME_MAX } from './limits';

// A display name as stored and shown: NFC, trimmed, inner whitespace collapsed
// to one space. Null when it is empty, too long or has control characters.
export function normalizeDisplayName(raw: string): string | null {
  const name = raw.normalize('NFC').replace(/\s+/g, ' ').trim();
  if (name.length < 1 || name.length > DISPLAY_NAME_MAX) return null;
  if (/\p{Cc}/u.test(name)) return null;
  return name;
}
```

`projects/protocol/src/errors.ts`:

```ts
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
```

`projects/protocol/src/schemas/auth.ts`:

```ts
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
```

`projects/protocol/src/schemas/index.ts`:

```ts
// Server-side entry: TypeBox schemas for validating requests. The app never
// imports this, so TypeBox stays out of the browser bundle.
export * from './auth';
```

`projects/protocol/src/auth.ts`:

```ts
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
```

`projects/protocol/src/public-api.ts`:

```ts
// Browser-safe entry: types, constants and pure functions. No runtime imports
// from TypeBox (see `protocol/schemas` for the schemas).
export * from './version';
export * from './limits';
export * from './names';
export * from './errors';
export * from './auth';
```

- [ ] **Step 5: Run the tests and the type check**

Run: `npx jest --selectProjects protocol && npx tsc -p projects/protocol/tsconfig.json --noEmit`
Expected: PASS (13 tests), and tsc prints nothing.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.json jest.config.js projects/protocol
git commit -m "feat(protocol): wire types, limits, error codes and TypeBox auth schemas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Server scaffold, config and auth primitives

**Files:**
- Modify: `package.json` (dependencies and the `typecheck:server` script), `jest.config.js` (new project)
- Create:
  - `projects/server/tsconfig.json`
  - `projects/server/src/config.ts`
  - `projects/server/src/auth/password.ts`
  - `projects/server/src/auth/tokens.ts`
  - `projects/server/src/auth/rateLimiter.ts`
  - `projects/server/src/auth/rateLimits.ts`
- Test:
  - `projects/server/src/config.spec.ts`
  - `projects/server/src/auth/password.spec.ts`
  - `projects/server/src/auth/tokens.spec.ts`
  - `projects/server/src/auth/rateLimiter.spec.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `loadConfig(env: Record<string, string | undefined>): ServerConfig`, plus `ServerConfig` and `ConfigError`
  - `hashPassword(password: string): Promise<string>`, `verifyPassword(password: string, stored: string): Promise<boolean>`
  - `newToken(): string`, `hashToken(token: string): string`
  - `RateLimiter`, with `hit(key: string, now: number): boolean`, `prune(now: number): void` and `get size(): number`
  - `RATE_LIMITS`, `type RateLimitRules`, and `AuthRateLimits`, with fields `signInIp`, `signInEmail`, `signUpIp`, `forgotIp`, `forgotEmail` (each a `RateLimiter`) and `prune(now)`

```ts
export interface ServerConfig {
  port: number;
  host: string;
  databaseUrl: string | null; // null: in-memory store (never in production)
  publicOrigin: string; // e.g. "https://sanguosha.example", no trailing slash
  buildId: string;
  trustProxy: boolean;
  cookieSecure: boolean; // true when publicOrigin is https
  production: boolean;
}
```

- [ ] **Step 1: Install the server dependencies and wire the project**

```bash
npm install fastify@^5 @fastify/cookie@^11 @fastify/type-provider-typebox@^5 kysely@~0.28 pg@^8
npm install -D @types/pg@^8 tsx@^4
```

Check `package.json`. The result must show `kysely` at `~0.28.x` and `@fastify/type-provider-typebox` at `^5.x`; see Global Constraints.

Create `projects/server/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "types": ["node", "jest"]
  },
  "include": ["src/**/*.ts"]
}
```

Add this entry to `projects` in `jest.config.js` (after `protocol`):

```js
    {
      displayName: 'server',
      preset: 'ts-jest',
      testEnvironment: 'node',
      rootDir: 'projects/server/src',
      testMatch: ['**/*.spec.ts'],
      moduleNameMapper: {
        '^protocol$': '<rootDir>/../../protocol/src/public-api.ts',
        '^protocol/schemas$': '<rootDir>/../../protocol/src/schemas/index.ts',
      },
    },
```

In `package.json` `scripts`, add:

```json
    "typecheck:server": "tsc -p projects/protocol/tsconfig.json --noEmit && tsc -p projects/server/tsconfig.json --noEmit"
```

- [ ] **Step 2: Write the failing tests**

`projects/server/src/config.spec.ts`:

```ts
import { ConfigError, loadConfig } from './config';

describe('loadConfig', () => {
  it('has dev defaults', () => {
    expect(loadConfig({})).toEqual({
      port: 3000,
      host: '127.0.0.1',
      databaseUrl: null,
      publicOrigin: 'http://localhost:4200',
      buildId: 'dev',
      trustProxy: false,
      cookieSecure: false,
      production: false,
    });
  });

  it('reads every variable', () => {
    const config = loadConfig({
      NODE_ENV: 'production',
      PORT: '8080',
      HOST: '0.0.0.0',
      DATABASE_URL: 'postgres://u:p@db/x',
      PUBLIC_ORIGIN: 'https://sgs.example/',
      BUILD_ID: 'abc123',
      TRUST_PROXY: 'true',
    });
    expect(config).toEqual({
      port: 8080,
      host: '0.0.0.0',
      databaseUrl: 'postgres://u:p@db/x',
      publicOrigin: 'https://sgs.example',
      buildId: 'abc123',
      trustProxy: true,
      cookieSecure: true,
      production: true,
    });
  });

  it('binds to every interface by default in production', () => {
    expect(loadConfig({ NODE_ENV: 'production', DATABASE_URL: 'postgres://x', PUBLIC_ORIGIN: 'https://a.example' }).host).toBe('0.0.0.0');
  });

  it('refuses to start in production without a database or public origin, naming both', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow(ConfigError);
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow(/DATABASE_URL.*PUBLIC_ORIGIN/);
  });

  it('rejects a port that is not a number', () => {
    expect(() => loadConfig({ PORT: 'abc' })).toThrow(ConfigError);
  });

  it('rejects a PUBLIC_ORIGIN with a path', () => {
    expect(() => loadConfig({ PUBLIC_ORIGIN: 'https://a.example/app' })).toThrow(ConfigError);
  });
});
```

`projects/server/src/auth/password.spec.ts`:

```ts
import { hashPassword, verifyPassword } from './password';

describe('password hashing', () => {
  it('stores scrypt parameters, salt and key in the hash string', async () => {
    expect(await hashPassword('secret-pass')).toMatch(/^scrypt\$16384\$8\$1\$[\w-]+\$[\w-]+$/);
  });

  it('verifies the right password and rejects a wrong one', async () => {
    const stored = await hashPassword('secret-pass');
    expect(await verifyPassword('secret-pass', stored)).toBe(true);
    expect(await verifyPassword('secret-pasS', stored)).toBe(false);
  });

  it('salts every hash', async () => {
    expect(await hashPassword('same')).not.toBe(await hashPassword('same'));
  });

  it('rejects a malformed stored hash instead of throwing', async () => {
    expect(await verifyPassword('x', 'not-a-hash')).toBe(false);
    expect(await verifyPassword('x', 'bcrypt$1$2$3$4$5')).toBe(false);
  });

  it('treats composed and decomposed Unicode as the same password', async () => {
    const stored = await hashPassword('café-secret');
    expect(await verifyPassword('café-secret', stored)).toBe(true);
  });
});
```

`projects/server/src/auth/tokens.spec.ts`:

```ts
import { hashToken, newToken } from './tokens';

describe('tokens', () => {
  it('makes 32 random bytes as base64url', () => {
    const token = newToken();
    expect(token).toMatch(/^[\w-]{43}$/);
    expect(newToken()).not.toBe(token);
  });

  it('hashes with sha256 to hex, deterministically', () => {
    const token = newToken();
    expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).not.toBe(hashToken(newToken()));
  });
});
```

`projects/server/src/auth/rateLimiter.spec.ts`:

```ts
import { RateLimiter } from './rateLimiter';

describe('RateLimiter', () => {
  const rule = { limit: 2, windowMs: 1000 };

  it('allows up to the limit in a window, then refuses', () => {
    const limiter = new RateLimiter(rule);
    expect(limiter.hit('a', 0)).toBe(true);
    expect(limiter.hit('a', 10)).toBe(true);
    expect(limiter.hit('a', 20)).toBe(false);
  });

  it('starts a fresh window once the old one ends', () => {
    const limiter = new RateLimiter(rule);
    limiter.hit('a', 0);
    limiter.hit('a', 0);
    expect(limiter.hit('a', 999)).toBe(false);
    expect(limiter.hit('a', 1000)).toBe(true);
  });

  it('counts keys separately', () => {
    const limiter = new RateLimiter(rule);
    limiter.hit('a', 0);
    limiter.hit('a', 0);
    expect(limiter.hit('b', 0)).toBe(true);
  });

  it('prunes ended windows only', () => {
    const limiter = new RateLimiter(rule);
    limiter.hit('old', 0);
    limiter.hit('new', 900);
    limiter.prune(1000);
    expect(limiter.size).toBe(1);
    expect(limiter.hit('new', 950)).toBe(true);
    expect(limiter.hit('new', 960)).toBe(false);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx jest --selectProjects server`
Expected: FAIL, with "Cannot find module" for `./config`, `./password`, `./tokens` and `./rateLimiter`.

- [ ] **Step 4: Write the implementation**

`projects/server/src/config.ts`:

```ts
export interface ServerConfig {
  port: number;
  host: string;
  // Null: the in-memory store, for local runs without Docker. Never in production.
  databaseUrl: string | null;
  // The site's origin. Requests must come from it, and emailed links point to it.
  publicOrigin: string;
  // The engine + content build; stored on each game in Stage 4.
  buildId: string;
  // Behind a reverse proxy: take the client IP from X-Forwarded-For.
  trustProxy: boolean;
  cookieSecure: boolean;
  production: boolean;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export function loadConfig(env: Record<string, string | undefined>): ServerConfig {
  const production = env['NODE_ENV'] === 'production';
  const missing = ['DATABASE_URL', 'PUBLIC_ORIGIN'].filter((name) => production && !env[name]);
  if (missing.length > 0) throw new ConfigError(`Missing required environment variables: ${missing.join(', ')}`);

  const port = Number(env['PORT'] ?? '3000');
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new ConfigError(`PORT must be a port number, got "${env['PORT']}"`);

  const publicOrigin = parseOrigin(env['PUBLIC_ORIGIN'] ?? 'http://localhost:4200');
  return {
    port,
    host: env['HOST'] ?? (production ? '0.0.0.0' : '127.0.0.1'),
    databaseUrl: env['DATABASE_URL'] || null,
    publicOrigin,
    buildId: env['BUILD_ID'] || 'dev',
    trustProxy: env['TRUST_PROXY'] === 'true',
    cookieSecure: publicOrigin.startsWith('https:'),
    production,
  };
}

function parseOrigin(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ConfigError(`PUBLIC_ORIGIN must be a URL, got "${raw}"`);
  }
  if (url.pathname !== '/' || url.search || url.hash) throw new ConfigError(`PUBLIC_ORIGIN must be an origin with no path, got "${raw}"`);
  return url.origin;
}
```

`projects/server/src/auth/password.ts`:

```ts
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

// scrypt cost: 128 * N * r bytes = 16 MiB per hash.
const N = 16384;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
const MAX_MEMORY = 64 * 1024 * 1024;

function derive(password: string, salt: Buffer, keyLength: number, n: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password.normalize('NFC'), salt, keyLength, { N: n, r, p, maxmem: MAX_MEMORY }, (err, key) => (err ? reject(err) : resolve(key)))
  );
}

// "scrypt$N$r$p$<salt>$<key>", base64url: the parameters travel with the hash,
// so they can be raised later without breaking existing passwords.
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, KEY_LENGTH, N, R, P);
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, n, r, p, salt, key] = parts;
  const expected = Buffer.from(key, 'base64url');
  if (expected.length === 0) return false;
  try {
    const actual = await derive(password, Buffer.from(salt, 'base64url'), expected.length, Number(n), Number(r), Number(p));
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
```

`projects/server/src/auth/tokens.ts`:

```ts
import { createHash, randomBytes } from 'node:crypto';

// An opaque secret for a cookie or an emailed link.
export function newToken(): string {
  return randomBytes(32).toString('base64url');
}

// What the database stores instead of the token itself.
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
```

`projects/server/src/auth/rateLimiter.ts`:

```ts
export interface RateLimit {
  limit: number;
  windowMs: number;
}

// Fixed-window counters, in memory: enough for one server process.
export class RateLimiter {
  private readonly windows = new Map<string, { start: number; count: number }>();

  constructor(private readonly rule: RateLimit) {}

  // Counts a hit for `key`; false once the key is over its limit in this window.
  hit(key: string, now: number): boolean {
    const window = this.windows.get(key);
    if (!window || now - window.start >= this.rule.windowMs) {
      this.windows.set(key, { start: now, count: 1 });
      return this.rule.limit >= 1;
    }
    window.count += 1;
    return window.count <= this.rule.limit;
  }

  // Drops ended windows so the map doesn't grow without bound.
  prune(now: number): void {
    for (const [key, window] of this.windows) {
      if (now - window.start >= this.rule.windowMs) this.windows.delete(key);
    }
  }

  get size(): number {
    return this.windows.size;
  }
}
```

`projects/server/src/auth/rateLimits.ts`:

```ts
import { RateLimit, RateLimiter } from './rateLimiter';

const MINUTE = 60_000;

export interface RateLimitRules {
  signInPerIp: RateLimit;
  signInPerEmail: RateLimit;
  // Sign-up and guest creation share one budget.
  signUpPerIp: RateLimit;
  forgotPerIp: RateLimit;
  forgotPerEmail: RateLimit;
}

export const RATE_LIMITS: RateLimitRules = {
  signInPerIp: { limit: 30, windowMs: 15 * MINUTE },
  signInPerEmail: { limit: 10, windowMs: 15 * MINUTE },
  signUpPerIp: { limit: 10, windowMs: 60 * MINUTE },
  forgotPerIp: { limit: 10, windowMs: 60 * MINUTE },
  forgotPerEmail: { limit: 3, windowMs: 60 * MINUTE },
};

export class AuthRateLimits {
  readonly signInIp: RateLimiter;
  readonly signInEmail: RateLimiter;
  readonly signUpIp: RateLimiter;
  readonly forgotIp: RateLimiter;
  readonly forgotEmail: RateLimiter;

  constructor(rules: RateLimitRules = RATE_LIMITS) {
    this.signInIp = new RateLimiter(rules.signInPerIp);
    this.signInEmail = new RateLimiter(rules.signInPerEmail);
    this.signUpIp = new RateLimiter(rules.signUpPerIp);
    this.forgotIp = new RateLimiter(rules.forgotPerIp);
    this.forgotEmail = new RateLimiter(rules.forgotPerEmail);
  }

  prune(now: number): void {
    for (const limiter of [this.signInIp, this.signInEmail, this.signUpIp, this.forgotIp, this.forgotEmail]) limiter.prune(now);
  }
}
```

- [ ] **Step 5: Run the tests and the type check**

Run: `npx jest --selectProjects server && npm run typecheck:server`
Expected: PASS (17 tests), and both type checks are clean.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json jest.config.js projects/server
git commit -m "feat(server): project scaffold, config, password hashing, tokens and rate limits

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Domain records, repository interfaces and the in-memory store

**Files:**
- Create:
  - `projects/server/src/persistence/records.ts`
  - `projects/server/src/persistence/repositories.ts`
  - `projects/server/src/persistence/repositoryContract.ts`
  - `projects/server/src/persistence/memory/memoryRepositories.ts`
- Test: `projects/server/src/persistence/memory/memoryRepositories.spec.ts`

**Interfaces:**
- Consumes: `UserKind` from `protocol`.
- Produces:
  - from `records.ts`: `UserRecord`, `SessionRecord`, `ResetTokenRecord`
  - from `repositories.ts`: `EmailTakenError`, `UserRepository`, `SessionRepository`, `ResetTokenRepository`, `Repositories`, `RepositoryHarness`
  - from `repositoryContract.ts`: `describeRepositoryContract(open: () => Promise<RepositoryHarness>): void`
  - from `memoryRepositories.ts`: `createMemoryRepositories(): Repositories`

- [ ] **Step 1: Write the records and interfaces**

The interfaces are the contract both stores implement.

`projects/server/src/persistence/records.ts`:

```ts
import type { UserKind } from 'protocol';

// Domain records: what the server works with. Database rows map to these in
// persistence/postgres/mappers.ts, and these map to wire shapes in views/.
export interface UserRecord {
  id: string;
  kind: UserKind;
  email: string | null; // registered only
  passwordHash: string | null; // registered only
  displayName: string;
  emailVerifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  lastSeenAt: Date;
}

export interface SessionRecord {
  id: string;
  userId: string;
  tokenHash: string;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface ResetTokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}
```

`projects/server/src/persistence/repositories.ts`:

```ts
import { ResetTokenRecord, SessionRecord, UserRecord } from './records';

export class EmailTakenError extends Error {
  constructor() {
    super('A user with that email already exists');
    this.name = 'EmailTakenError';
  }
}

export interface UserRepository {
  // Throws EmailTakenError when the email (compared case-insensitively) exists.
  createRegistered(input: { email: string; passwordHash: string; displayName: string; now: Date }): Promise<UserRecord>;
  createGuest(input: { displayName: string; now: Date }): Promise<UserRecord>;
  findById(id: string): Promise<UserRecord | null>;
  // Case-insensitive.
  findByEmail(email: string): Promise<UserRecord | null>;
  setPasswordHash(userId: string, passwordHash: string, now: Date): Promise<void>;
  touch(userId: string, now: Date): Promise<void>;
  // Deletes guests last seen before `cutoff`, with their sessions; returns how many.
  deleteIdleGuests(cutoff: Date): Promise<number>;
}

export interface SessionRepository {
  create(input: { userId: string; tokenHash: string; now: Date; expiresAt: Date }): Promise<SessionRecord>;
  // Not revoked and not expired at `now`.
  findActiveByTokenHash(tokenHash: string, now: Date): Promise<SessionRecord | null>;
  slide(sessionId: string, now: Date, expiresAt: Date): Promise<void>;
  revoke(sessionId: string, now: Date): Promise<void>;
  revokeAllForUser(userId: string, now: Date): Promise<void>;
}

export interface ResetTokenRepository {
  create(input: { userId: string; tokenHash: string; now: Date; expiresAt: Date }): Promise<ResetTokenRecord>;
  // Atomically marks an unused, unexpired token used and returns it; null otherwise.
  consume(tokenHash: string, now: Date): Promise<ResetTokenRecord | null>;
}

export interface Repositories {
  users: UserRepository;
  sessions: SessionRepository;
  resetTokens: ResetTokenRepository;
}

// A store opened for a test run, and how to close it afterwards.
export interface RepositoryHarness {
  repos: Repositories;
  teardown(): Promise<void>;
}
```

- [ ] **Step 2: Write the contract suite and the memory spec that runs it**

`projects/server/src/persistence/repositoryContract.ts`:

```ts
import { randomUUID } from 'node:crypto';
import { EmailTakenError, RepositoryHarness } from './repositories';

const NOW = new Date('2026-10-13T12:00:00.000Z');
const minutes = (n: number) => new Date(NOW.getTime() + n * 60_000);

// Behaviour every store must share. Run against the in-memory store always,
// and against Postgres when TEST_DATABASE_URL is set. One store is opened per
// suite, so every test uses its own fresh emails.
export function describeRepositoryContract(open: () => Promise<RepositoryHarness>): void {
  let harness: RepositoryHarness;
  const repos = () => harness.repos;
  const freshEmail = () => `user-${randomUUID()}@example.com`;
  const registered = (email = freshEmail()) => repos().users.createRegistered({ email, passwordHash: 'hash', displayName: 'Ann', now: NOW });

  beforeAll(async () => {
    harness = await open();
  });
  afterAll(async () => {
    await harness?.teardown();
  });

  describe('users', () => {
    it('creates a registered user and finds it by id and by email in any case', async () => {
      const email = freshEmail();
      const user = await registered(email);
      expect(user).toEqual({
        id: expect.any(String),
        kind: 'registered',
        email,
        passwordHash: 'hash',
        displayName: 'Ann',
        emailVerifiedAt: null,
        createdAt: NOW,
        updatedAt: NOW,
        lastSeenAt: NOW,
      });
      expect(await repos().users.findById(user.id)).toEqual(user);
      expect(await repos().users.findByEmail(email.toUpperCase())).toEqual(user);
    });

    it('returns null for an unknown id or email', async () => {
      expect(await repos().users.findById(randomUUID())).toBeNull();
      expect(await repos().users.findByEmail(freshEmail())).toBeNull();
    });

    it('refuses a second user with the same email in another case', async () => {
      const email = freshEmail();
      await registered(email);
      await expect(registered(email.toUpperCase())).rejects.toBeInstanceOf(EmailTakenError);
    });

    it('lets exactly one of two racing sign-ups with the same email win', async () => {
      const email = freshEmail();
      const results = await Promise.allSettled([registered(email), registered(email)]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
      expect(rejected.reason).toBeInstanceOf(EmailTakenError);
    });

    it('creates a guest with no email or password', async () => {
      const guest = await repos().users.createGuest({ displayName: 'Guest', now: NOW });
      expect(guest).toMatchObject({ kind: 'guest', email: null, passwordHash: null, displayName: 'Guest' });
    });

    it('sets a new password hash and records the update time', async () => {
      const user = await registered();
      await repos().users.setPasswordHash(user.id, 'new-hash', minutes(5));
      expect(await repos().users.findById(user.id)).toMatchObject({ passwordHash: 'new-hash', updatedAt: minutes(5) });
    });

    it('touch moves last_seen_at', async () => {
      const user = await registered();
      await repos().users.touch(user.id, minutes(7));
      expect((await repos().users.findById(user.id))?.lastSeenAt).toEqual(minutes(7));
    });

    it('deletes idle guests and their sessions, and nothing else', async () => {
      const longAgo = new Date('2025-12-01T00:00:00.000Z');
      const cutoff = new Date('2026-01-01T00:00:00.000Z');
      const idleGuest = await repos().users.createGuest({ displayName: 'Idle', now: longAgo });
      const freshGuest = await repos().users.createGuest({ displayName: 'Fresh', now: NOW });
      const idleRegistered = await repos().users.createRegistered({ email: freshEmail(), passwordHash: 'h', displayName: 'Old', now: longAgo });
      await repos().sessions.create({ userId: idleGuest.id, tokenHash: `t-${randomUUID()}`, now: longAgo, expiresAt: minutes(60) });

      expect(await repos().users.deleteIdleGuests(cutoff)).toBeGreaterThanOrEqual(1);

      expect(await repos().users.findById(idleGuest.id)).toBeNull();
      expect(await repos().users.findById(freshGuest.id)).not.toBeNull();
      expect(await repos().users.findById(idleRegistered.id)).not.toBeNull();
    });
  });

  describe('sessions', () => {
    it('finds an active session by token hash until it expires', async () => {
      const user = await registered();
      const tokenHash = `t-${randomUUID()}`;
      const session = await repos().sessions.create({ userId: user.id, tokenHash, now: NOW, expiresAt: minutes(10) });
      expect(session).toEqual({ id: expect.any(String), userId: user.id, tokenHash, createdAt: NOW, lastSeenAt: NOW, expiresAt: minutes(10), revokedAt: null });
      expect(await repos().sessions.findActiveByTokenHash(tokenHash, minutes(9))).toEqual(session);
      expect(await repos().sessions.findActiveByTokenHash(tokenHash, minutes(10))).toBeNull();
    });

    it('slides last_seen_at and expires_at', async () => {
      const user = await registered();
      const tokenHash = `t-${randomUUID()}`;
      const session = await repos().sessions.create({ userId: user.id, tokenHash, now: NOW, expiresAt: minutes(10) });
      await repos().sessions.slide(session.id, minutes(9), minutes(19));
      expect(await repos().sessions.findActiveByTokenHash(tokenHash, minutes(15))).toMatchObject({ lastSeenAt: minutes(9), expiresAt: minutes(19) });
    });

    it('a revoked session is no longer active', async () => {
      const user = await registered();
      const tokenHash = `t-${randomUUID()}`;
      const session = await repos().sessions.create({ userId: user.id, tokenHash, now: NOW, expiresAt: minutes(10) });
      await repos().sessions.revoke(session.id, minutes(1));
      expect(await repos().sessions.findActiveByTokenHash(tokenHash, minutes(2))).toBeNull();
    });

    it("revokeAllForUser revokes only that user's sessions", async () => {
      const ann = await registered();
      const bo = await registered();
      const annHashes = [`t-${randomUUID()}`, `t-${randomUUID()}`];
      const boHash = `t-${randomUUID()}`;
      for (const tokenHash of annHashes) await repos().sessions.create({ userId: ann.id, tokenHash, now: NOW, expiresAt: minutes(10) });
      await repos().sessions.create({ userId: bo.id, tokenHash: boHash, now: NOW, expiresAt: minutes(10) });

      await repos().sessions.revokeAllForUser(ann.id, minutes(1));

      for (const tokenHash of annHashes) expect(await repos().sessions.findActiveByTokenHash(tokenHash, minutes(2))).toBeNull();
      expect(await repos().sessions.findActiveByTokenHash(boHash, minutes(2))).not.toBeNull();
    });
  });

  describe('reset tokens', () => {
    it('consumes a token once', async () => {
      const user = await registered();
      const tokenHash = `r-${randomUUID()}`;
      await repos().resetTokens.create({ userId: user.id, tokenHash, now: NOW, expiresAt: minutes(60) });
      expect(await repos().resetTokens.consume(tokenHash, minutes(1))).toMatchObject({ userId: user.id, tokenHash, usedAt: minutes(1) });
      expect(await repos().resetTokens.consume(tokenHash, minutes(2))).toBeNull();
    });

    it('lets exactly one of two racing consumes win', async () => {
      const user = await registered();
      const tokenHash = `r-${randomUUID()}`;
      await repos().resetTokens.create({ userId: user.id, tokenHash, now: NOW, expiresAt: minutes(60) });
      const results = await Promise.all([repos().resetTokens.consume(tokenHash, minutes(1)), repos().resetTokens.consume(tokenHash, minutes(1))]);
      expect(results.filter((r) => r !== null)).toHaveLength(1);
    });

    it('refuses an expired or unknown token', async () => {
      const user = await registered();
      const tokenHash = `r-${randomUUID()}`;
      await repos().resetTokens.create({ userId: user.id, tokenHash, now: NOW, expiresAt: minutes(60) });
      expect(await repos().resetTokens.consume(tokenHash, minutes(60))).toBeNull();
      expect(await repos().resetTokens.consume(`r-${randomUUID()}`, NOW)).toBeNull();
    });
  });
}
```

`projects/server/src/persistence/memory/memoryRepositories.spec.ts`:

```ts
import { describeRepositoryContract } from '../repositoryContract';
import { createMemoryRepositories } from './memoryRepositories';

describe('in-memory repositories', () => {
  describeRepositoryContract(async () => ({ repos: createMemoryRepositories(), teardown: async () => undefined }));
});
```

- [ ] **Step 3: Run the spec to verify it fails**

Run: `npx jest --selectProjects server persistence/memory`
Expected: FAIL, with "Cannot find module './memoryRepositories'".

- [ ] **Step 4: Write the in-memory store**

`projects/server/src/persistence/memory/memoryRepositories.ts`:

```ts
import { randomUUID } from 'node:crypto';
import { ResetTokenRecord, SessionRecord, UserRecord } from '../records';
import { EmailTakenError, Repositories, ResetTokenRepository, SessionRepository, UserRepository } from '../repositories';

interface Store {
  users: Map<string, UserRecord>;
  sessions: Map<string, SessionRecord>;
  resetTokens: Map<string, ResetTokenRecord>;
}

// For unit tests and local runs without Postgres. Each method does its checks
// and writes with no `await` between them, so concurrent calls can't interleave
// (the uniqueness and single-use rules hold under Promise.all).
export function createMemoryRepositories(): Repositories {
  const store: Store = { users: new Map(), sessions: new Map(), resetTokens: new Map() };
  return { users: new MemoryUsers(store), sessions: new MemorySessions(store), resetTokens: new MemoryResetTokens(store) };
}

const copy = <T extends object>(record: T | undefined): T | null => (record ? { ...record } : null);

class MemoryUsers implements UserRepository {
  constructor(private readonly store: Store) {}

  private byEmail(email: string): UserRecord | undefined {
    const key = email.toLowerCase();
    for (const user of this.store.users.values()) if (user.email?.toLowerCase() === key) return user;
    return undefined;
  }

  async createRegistered(input: { email: string; passwordHash: string; displayName: string; now: Date }): Promise<UserRecord> {
    if (this.byEmail(input.email)) throw new EmailTakenError();
    const user: UserRecord = {
      id: randomUUID(),
      kind: 'registered',
      email: input.email,
      passwordHash: input.passwordHash,
      displayName: input.displayName,
      emailVerifiedAt: null,
      createdAt: input.now,
      updatedAt: input.now,
      lastSeenAt: input.now,
    };
    this.store.users.set(user.id, user);
    return { ...user };
  }

  async createGuest(input: { displayName: string; now: Date }): Promise<UserRecord> {
    const user: UserRecord = {
      id: randomUUID(),
      kind: 'guest',
      email: null,
      passwordHash: null,
      displayName: input.displayName,
      emailVerifiedAt: null,
      createdAt: input.now,
      updatedAt: input.now,
      lastSeenAt: input.now,
    };
    this.store.users.set(user.id, user);
    return { ...user };
  }

  async findById(id: string): Promise<UserRecord | null> {
    return copy(this.store.users.get(id));
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    return copy(this.byEmail(email));
  }

  async setPasswordHash(userId: string, passwordHash: string, now: Date): Promise<void> {
    const user = this.store.users.get(userId);
    if (user) Object.assign(user, { passwordHash, updatedAt: now });
  }

  async touch(userId: string, now: Date): Promise<void> {
    const user = this.store.users.get(userId);
    if (user) user.lastSeenAt = now;
  }

  async deleteIdleGuests(cutoff: Date): Promise<number> {
    let deleted = 0;
    for (const user of [...this.store.users.values()]) {
      if (user.kind !== 'guest' || user.lastSeenAt >= cutoff) continue;
      this.store.users.delete(user.id);
      for (const [id, session] of this.store.sessions) if (session.userId === user.id) this.store.sessions.delete(id);
      for (const [id, token] of this.store.resetTokens) if (token.userId === user.id) this.store.resetTokens.delete(id);
      deleted += 1;
    }
    return deleted;
  }
}

class MemorySessions implements SessionRepository {
  constructor(private readonly store: Store) {}

  async create(input: { userId: string; tokenHash: string; now: Date; expiresAt: Date }): Promise<SessionRecord> {
    const session: SessionRecord = {
      id: randomUUID(),
      userId: input.userId,
      tokenHash: input.tokenHash,
      createdAt: input.now,
      lastSeenAt: input.now,
      expiresAt: input.expiresAt,
      revokedAt: null,
    };
    this.store.sessions.set(session.id, session);
    return { ...session };
  }

  async findActiveByTokenHash(tokenHash: string, now: Date): Promise<SessionRecord | null> {
    for (const session of this.store.sessions.values()) {
      if (session.tokenHash === tokenHash) return session.revokedAt === null && session.expiresAt > now ? { ...session } : null;
    }
    return null;
  }

  async slide(sessionId: string, now: Date, expiresAt: Date): Promise<void> {
    const session = this.store.sessions.get(sessionId);
    if (session) Object.assign(session, { lastSeenAt: now, expiresAt });
  }

  async revoke(sessionId: string, now: Date): Promise<void> {
    const session = this.store.sessions.get(sessionId);
    if (session && session.revokedAt === null) session.revokedAt = now;
  }

  async revokeAllForUser(userId: string, now: Date): Promise<void> {
    for (const session of this.store.sessions.values()) {
      if (session.userId === userId && session.revokedAt === null) session.revokedAt = now;
    }
  }
}

class MemoryResetTokens implements ResetTokenRepository {
  constructor(private readonly store: Store) {}

  async create(input: { userId: string; tokenHash: string; now: Date; expiresAt: Date }): Promise<ResetTokenRecord> {
    const token: ResetTokenRecord = {
      id: randomUUID(),
      userId: input.userId,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      usedAt: null,
      createdAt: input.now,
    };
    this.store.resetTokens.set(token.id, token);
    return { ...token };
  }

  async consume(tokenHash: string, now: Date): Promise<ResetTokenRecord | null> {
    for (const token of this.store.resetTokens.values()) {
      if (token.tokenHash !== tokenHash) continue;
      if (token.usedAt !== null || token.expiresAt <= now) return null;
      token.usedAt = now;
      return { ...token };
    }
    return null;
  }
}
```

- [ ] **Step 5: Run the spec and the type check**

Run: `npx jest --selectProjects server persistence/memory && npm run typecheck:server`
Expected: PASS (15 tests), and the type check is clean.

- [ ] **Step 6: Commit**

```bash
git add projects/server/src/persistence
git commit -m "feat(server): domain records, repository interfaces, contract suite and in-memory store

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Postgres store: Compose, migration and Kysely repositories

**Prerequisite (executor):** Docker must be running. On macOS, run `open -a Docker`, then wait until `docker info` succeeds. If Docker can't be started, finish the task anyway. In that case, state in the report that the Postgres suite was **not run**.

**Files:**
- Modify: `package.json` (scripts `db:up`, `db:down`, `test:db`)
- Create:
  - `docker-compose.yml`
  - `projects/server/src/persistence/postgres/schema.ts`
  - `projects/server/src/persistence/postgres/db.ts`
  - `projects/server/src/persistence/migrations/0001_accounts.ts`
  - `projects/server/src/persistence/migrate.ts`
  - `projects/server/src/persistence/postgres/mappers.ts`
  - `projects/server/src/persistence/postgres/postgresRepositories.ts`
  - `projects/server/src/persistence/postgres/testDatabase.ts`
- Test: `projects/server/src/persistence/postgres/postgresRepositories.spec.ts`

**Interfaces:**
- Consumes: from Task 3, `Repositories`, `RepositoryHarness`, `EmailTakenError`, the records and `describeRepositoryContract`.
- Produces:
  - from `schema.ts`: `Database` (the Kysely table types)
  - from `db.ts`: `createDb(url: string): Kysely<Database>`
  - from `migrate.ts`: `migrateToLatest(db: Kysely<Database>): Promise<void>`
  - from `postgresRepositories.ts`: `createPostgresRepositories(db: Kysely<Database>): Repositories`
  - from `testDatabase.ts`: `createTestDatabase(adminUrl: string): Promise<{ db: Kysely<Database>; drop(): Promise<void> }>`

- [ ] **Step 1: Compose and scripts**

`docker-compose.yml` (repo root):

```yaml
# Local Postgres for the server (npm run db:up). Data persists in a named volume.
services:
  db:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: sanguosha
      POSTGRES_PASSWORD: sanguosha
      POSTGRES_DB: sanguosha
    ports:
      - '5433:5432' # host 5433: 5432 is often taken by another local Postgres
    volumes:
      - db-data:/var/lib/postgresql/data
volumes:
  db-data:
```

Add these to `package.json` `scripts`:

```json
    "db:up": "docker compose up -d --wait db",
    "db:down": "docker compose down",
    "test:db": "TEST_DATABASE_URL=postgres://sanguosha:sanguosha@localhost:5433/postgres jest --selectProjects server"
```

Run: `npm run db:up`
Expected: the container `db` becomes healthy or started. If Docker is unavailable, see the prerequisite above.

- [ ] **Step 2: Write the failing spec**

`projects/server/src/persistence/postgres/postgresRepositories.spec.ts`:

```ts
import { describeRepositoryContract } from '../repositoryContract';
import { createPostgresRepositories } from './postgresRepositories';
import { createTestDatabase } from './testDatabase';

// Needs a running Postgres: `npm run db:up`, then `npm run test:db`.
const adminUrl = process.env['TEST_DATABASE_URL'];
const describeWithDb = adminUrl ? describe : describe.skip;

describeWithDb('Postgres repositories', () => {
  describeRepositoryContract(async () => {
    const { db, drop } = await createTestDatabase(adminUrl!);
    return { repos: createPostgresRepositories(db), teardown: drop };
  });
});
```

Run: `npm run test:db -- persistence/postgres`
Expected: FAIL, with "Cannot find module './postgresRepositories'".

- [ ] **Step 3: Write the schema types, db factory and migration**

`projects/server/src/persistence/postgres/schema.ts`:

```ts
import type { ColumnType, Generated } from 'kysely';

// Row types, exactly as the tables are. Only mappers.ts turns these into
// domain records.
type Timestamp = ColumnType<Date, Date, Date>;
type NullableTimestamp = ColumnType<Date | null, Date | null | undefined, Date | null>;

export interface UsersTable {
  id: Generated<string>;
  kind: 'registered' | 'guest';
  email: string | null;
  password_hash: string | null;
  display_name: string;
  email_verified_at: NullableTimestamp;
  created_at: Timestamp;
  updated_at: Timestamp;
  last_seen_at: Timestamp;
}

export interface SessionsTable {
  id: Generated<string>;
  user_id: string;
  token_hash: string;
  created_at: Timestamp;
  last_seen_at: Timestamp;
  expires_at: Timestamp;
  revoked_at: NullableTimestamp;
}

export interface PasswordResetTokensTable {
  id: Generated<string>;
  user_id: string;
  token_hash: string;
  expires_at: Timestamp;
  used_at: NullableTimestamp;
  created_at: Timestamp;
}

export interface Database {
  users: UsersTable;
  sessions: SessionsTable;
  password_reset_tokens: PasswordResetTokensTable;
}
```

`projects/server/src/persistence/postgres/db.ts`:

```ts
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import { Database } from './schema';

export function createDb(url: string): Kysely<Database> {
  return new Kysely<Database>({ dialect: new PostgresDialect({ pool: new Pool({ connectionString: url }) }) });
}
```

`projects/server/src/persistence/migrations/0001_accounts.ts`:

```ts
import { Kysely, sql } from 'kysely';

// Users, sessions and password reset tokens (spec "Database"). Rooms, games and
// chat arrive in later stages' migrations.
const UP = [
  `CREATE EXTENSION IF NOT EXISTS citext`,
  `CREATE TABLE users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    kind text NOT NULL CHECK (kind IN ('registered', 'guest')),
    email citext UNIQUE,
    password_hash text,
    display_name text NOT NULL,
    email_verified_at timestamptz,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    last_seen_at timestamptz NOT NULL,
    CONSTRAINT users_registered_has_credentials CHECK (kind = 'guest' OR (email IS NOT NULL AND password_hash IS NOT NULL))
  )`,
  `CREATE INDEX users_idle_guests ON users (last_seen_at) WHERE kind = 'guest'`,
  `CREATE TABLE sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash text NOT NULL UNIQUE,
    created_at timestamptz NOT NULL,
    last_seen_at timestamptz NOT NULL,
    expires_at timestamptz NOT NULL,
    revoked_at timestamptz
  )`,
  `CREATE INDEX sessions_user_id ON sessions (user_id)`,
  `CREATE TABLE password_reset_tokens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash text NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    used_at timestamptz,
    created_at timestamptz NOT NULL
  )`,
  `CREATE INDEX password_reset_tokens_user_id ON password_reset_tokens (user_id)`,
];

const DOWN = [`DROP TABLE password_reset_tokens`, `DROP TABLE sessions`, `DROP TABLE users`];

// Migrations take Kysely<any>: they run against whatever schema exists at their point in history.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function up(db: Kysely<any>): Promise<void> {
  for (const statement of UP) await sql.raw(statement).execute(db);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function down(db: Kysely<any>): Promise<void> {
  for (const statement of DOWN) await sql.raw(statement).execute(db);
}
```

`projects/server/src/persistence/migrate.ts`:

```ts
import { Kysely, Migration, Migrator } from 'kysely';
import * as accounts from './migrations/0001_accounts';
import { Database } from './postgres/schema';

// Listed explicitly rather than read from disk, so migrations run the same
// under tsx, ts-jest and a bundled build. Names sort in the order they apply.
const MIGRATIONS: Record<string, Migration> = {
  '0001_accounts': accounts,
};

export async function migrateToLatest(db: Kysely<Database>): Promise<void> {
  const migrator = new Migrator({ db, provider: { getMigrations: async () => MIGRATIONS } });
  const { error } = await migrator.migrateToLatest();
  if (error) throw error;
}
```

- [ ] **Step 4: Write the mappers, repositories and test database**

`projects/server/src/persistence/postgres/mappers.ts`:

```ts
import { Selectable } from 'kysely';
import { ResetTokenRecord, SessionRecord, UserRecord } from '../records';
import { PasswordResetTokensTable, SessionsTable, UsersTable } from './schema';

export function toUserRecord(row: Selectable<UsersTable>): UserRecord {
  return {
    id: row.id,
    kind: row.kind,
    email: row.email,
    passwordHash: row.password_hash,
    displayName: row.display_name,
    emailVerifiedAt: row.email_verified_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastSeenAt: row.last_seen_at,
  };
}

export function toSessionRecord(row: Selectable<SessionsTable>): SessionRecord {
  return {
    id: row.id,
    userId: row.user_id,
    tokenHash: row.token_hash,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
  };
}

export function toResetTokenRecord(row: Selectable<PasswordResetTokensTable>): ResetTokenRecord {
  return {
    id: row.id,
    userId: row.user_id,
    tokenHash: row.token_hash,
    expiresAt: row.expires_at,
    usedAt: row.used_at,
    createdAt: row.created_at,
  };
}
```

`projects/server/src/persistence/postgres/postgresRepositories.ts`:

```ts
import { Kysely } from 'kysely';
import { ResetTokenRecord, SessionRecord, UserRecord } from '../records';
import { EmailTakenError, Repositories, ResetTokenRepository, SessionRepository, UserRepository } from '../repositories';
import { toResetTokenRecord, toSessionRecord, toUserRecord } from './mappers';
import { Database } from './schema';

const UNIQUE_VIOLATION = '23505';
const isUniqueViolation = (err: unknown) => (err as { code?: unknown } | null)?.code === UNIQUE_VIOLATION;

export function createPostgresRepositories(db: Kysely<Database>): Repositories {
  return { users: new PostgresUsers(db), sessions: new PostgresSessions(db), resetTokens: new PostgresResetTokens(db) };
}

class PostgresUsers implements UserRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async createRegistered(input: { email: string; passwordHash: string; displayName: string; now: Date }): Promise<UserRecord> {
    try {
      const row = await this.db
        .insertInto('users')
        .values({
          kind: 'registered',
          email: input.email,
          password_hash: input.passwordHash,
          display_name: input.displayName,
          created_at: input.now,
          updated_at: input.now,
          last_seen_at: input.now,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      return toUserRecord(row);
    } catch (err) {
      // `email` is citext UNIQUE, so another casing of the same email lands here.
      if (isUniqueViolation(err)) throw new EmailTakenError();
      throw err;
    }
  }

  async createGuest(input: { displayName: string; now: Date }): Promise<UserRecord> {
    const row = await this.db
      .insertInto('users')
      .values({ kind: 'guest', display_name: input.displayName, created_at: input.now, updated_at: input.now, last_seen_at: input.now })
      .returningAll()
      .executeTakeFirstOrThrow();
    return toUserRecord(row);
  }

  async findById(id: string): Promise<UserRecord | null> {
    const row = await this.db.selectFrom('users').selectAll().where('id', '=', id).executeTakeFirst();
    return row ? toUserRecord(row) : null;
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const row = await this.db.selectFrom('users').selectAll().where('email', '=', email).executeTakeFirst();
    return row ? toUserRecord(row) : null;
  }

  async setPasswordHash(userId: string, passwordHash: string, now: Date): Promise<void> {
    await this.db.updateTable('users').set({ password_hash: passwordHash, updated_at: now }).where('id', '=', userId).execute();
  }

  async touch(userId: string, now: Date): Promise<void> {
    await this.db.updateTable('users').set({ last_seen_at: now }).where('id', '=', userId).execute();
  }

  async deleteIdleGuests(cutoff: Date): Promise<number> {
    // Sessions and reset tokens go with them (ON DELETE CASCADE).
    const result = await this.db.deleteFrom('users').where('kind', '=', 'guest').where('last_seen_at', '<', cutoff).executeTakeFirst();
    return Number(result.numDeletedRows);
  }
}

class PostgresSessions implements SessionRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async create(input: { userId: string; tokenHash: string; now: Date; expiresAt: Date }): Promise<SessionRecord> {
    const row = await this.db
      .insertInto('sessions')
      .values({ user_id: input.userId, token_hash: input.tokenHash, created_at: input.now, last_seen_at: input.now, expires_at: input.expiresAt })
      .returningAll()
      .executeTakeFirstOrThrow();
    return toSessionRecord(row);
  }

  async findActiveByTokenHash(tokenHash: string, now: Date): Promise<SessionRecord | null> {
    const row = await this.db
      .selectFrom('sessions')
      .selectAll()
      .where('token_hash', '=', tokenHash)
      .where('revoked_at', 'is', null)
      .where('expires_at', '>', now)
      .executeTakeFirst();
    return row ? toSessionRecord(row) : null;
  }

  async slide(sessionId: string, now: Date, expiresAt: Date): Promise<void> {
    await this.db.updateTable('sessions').set({ last_seen_at: now, expires_at: expiresAt }).where('id', '=', sessionId).execute();
  }

  async revoke(sessionId: string, now: Date): Promise<void> {
    await this.db.updateTable('sessions').set({ revoked_at: now }).where('id', '=', sessionId).where('revoked_at', 'is', null).execute();
  }

  async revokeAllForUser(userId: string, now: Date): Promise<void> {
    await this.db.updateTable('sessions').set({ revoked_at: now }).where('user_id', '=', userId).where('revoked_at', 'is', null).execute();
  }
}

class PostgresResetTokens implements ResetTokenRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async create(input: { userId: string; tokenHash: string; now: Date; expiresAt: Date }): Promise<ResetTokenRecord> {
    const row = await this.db
      .insertInto('password_reset_tokens')
      .values({ user_id: input.userId, token_hash: input.tokenHash, expires_at: input.expiresAt, created_at: input.now })
      .returningAll()
      .executeTakeFirstOrThrow();
    return toResetTokenRecord(row);
  }

  async consume(tokenHash: string, now: Date): Promise<ResetTokenRecord | null> {
    // One UPDATE … WHERE used_at IS NULL: of two racing consumes, only one row update wins.
    const row = await this.db
      .updateTable('password_reset_tokens')
      .set({ used_at: now })
      .where('token_hash', '=', tokenHash)
      .where('used_at', 'is', null)
      .where('expires_at', '>', now)
      .returningAll()
      .executeTakeFirst();
    return row ? toResetTokenRecord(row) : null;
  }
}
```

`projects/server/src/persistence/postgres/testDatabase.ts`:

```ts
import { randomBytes } from 'node:crypto';
import { Kysely } from 'kysely';
import { Pool } from 'pg';
import { migrateToLatest } from '../migrate';
import { createDb } from './db';
import { Database } from './schema';

// A fresh, migrated database per test file, so test files can run in parallel
// and every run starts from an empty schema. `adminUrl` connects to any
// database on the server as a user allowed to CREATE DATABASE.
export async function createTestDatabase(adminUrl: string): Promise<{ db: Kysely<Database>; drop(): Promise<void> }> {
  const name = `sgs_test_${randomBytes(6).toString('hex')}`;
  const admin = new Pool({ connectionString: adminUrl, max: 1 });
  await admin.query(`CREATE DATABASE ${name}`);
  const url = new URL(adminUrl);
  url.pathname = `/${name}`;
  const db = createDb(url.toString());
  await migrateToLatest(db);
  return {
    db,
    drop: async () => {
      await db.destroy();
      await admin.query(`DROP DATABASE ${name} WITH (FORCE)`);
      await admin.end();
    },
  };
}
```

- [ ] **Step 5: Run the Postgres suite, the full server suite and the type check**

Run: `npm run test:db -- persistence && npm run typecheck:server`
Expected: PASS. Both the in-memory and the Postgres contract run (15 tests each), and the type check is clean.

Then run: `npx jest --selectProjects server`
Expected: PASS, with the Postgres suite reported as skipped (no `TEST_DATABASE_URL`).

- [ ] **Step 6: Commit**

```bash
git add docker-compose.yml package.json projects/server/src/persistence
git commit -m "feat(server): Postgres store with accounts migration, Kysely repositories and Compose

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Mailer and AccountService

**Files:**
- Create:
  - `projects/server/src/mail/mailer.ts`
  - `projects/server/src/mail/recordingMailer.ts`
  - `projects/server/src/auth/accounts.ts`
- Test: `projects/server/src/auth/accounts.spec.ts`

**Interfaces:**
- Consumes:
  - from Task 1: `normalizeDisplayName`, `PASSWORD_MIN`, `ErrorCode`
  - from Task 2: `hashPassword`, `verifyPassword`, `newToken`, `hashToken`
  - from Task 3: `Repositories`, `EmailTakenError`, `UserRecord`, `SessionRecord`, `createMemoryRepositories`
- Produces:
  - from `mailer.ts`: `Mailer`, `PasswordResetMail`, `ConsoleMailer`
  - from `recordingMailer.ts`: `RecordingMailer`, with `sent: PasswordResetMail[]`
  - from `accounts.ts`: `AccountService`, `AuthError` (field `code: AuthErrorCode`), `AuthErrorCode`, `SignedIn`, `Authenticated`, and the constants `SESSION_DAYS`, `RESET_TOKEN_MS`, `GUEST_IDLE_DAYS`

```ts
export type AuthErrorCode = Extract<ErrorCode, 'email_taken' | 'invalid_credentials' | 'invalid_reset_token' | 'invalid_name' | 'weak_password'>;
export interface SignedIn { user: UserRecord; token: string; expiresAt: Date }
export interface Authenticated { user: UserRecord; session: SessionRecord }
class AccountService {
  constructor(deps: { repos: Repositories; mailer: Mailer; publicOrigin: string; now?: () => Date })
  signUp(input: { email: string; password: string; displayName: string }): Promise<SignedIn>
  signIn(input: { email: string; password: string }): Promise<SignedIn>
  createGuest(input: { displayName: string }): Promise<SignedIn>
  authenticate(token: string): Promise<Authenticated | null>
  signOut(token: string): Promise<void>
  forgotPassword(email: string): Promise<void>
  resetPassword(input: { token: string; password: string }): Promise<SignedIn>
  purgeIdleGuests(): Promise<number>
}
```

- [ ] **Step 1: Write the failing tests**

`projects/server/src/auth/accounts.spec.ts`:

```ts
import { RecordingMailer } from '../mail/recordingMailer';
import { createMemoryRepositories } from '../persistence/memory/memoryRepositories';
import { AccountService, AuthError } from './accounts';

const ORIGIN = 'http://localhost:4200';
const DAY = 24 * 60 * 60_000;

function setup() {
  let now = new Date('2026-10-13T12:00:00.000Z');
  const repos = createMemoryRepositories();
  const mailer = new RecordingMailer();
  const accounts = new AccountService({ repos, mailer, publicOrigin: ORIGIN, now: () => now });
  const advance = (ms: number) => {
    now = new Date(now.getTime() + ms);
  };
  return { accounts, mailer, repos, advance };
}

const authCode = (promise: Promise<unknown>) =>
  promise.then(
    () => 'resolved',
    (err: unknown) => (err instanceof AuthError ? err.code : String(err))
  );

const resetTokenFrom = (link: string) => new URL(link).searchParams.get('token')!;

describe('AccountService', () => {
  describe('sign up and sign in', () => {
    it('signs up a registered user with a trimmed email and normalized name, and signs them in', async () => {
      const { accounts } = setup();
      const result = await accounts.signUp({ email: '  Ann@Example.com ', password: 'secret-pass', displayName: '  Ann   Lee ' });
      expect(result.user).toMatchObject({ kind: 'registered', email: 'Ann@Example.com', displayName: 'Ann Lee' });
      expect(result.user.passwordHash).toMatch(/^scrypt\$/);
      expect((await accounts.authenticate(result.token))?.user.id).toBe(result.user.id);
    });

    it('refuses a second account for the same email in another case', async () => {
      const { accounts } = setup();
      await accounts.signUp({ email: 'ann@example.com', password: 'secret-pass', displayName: 'Ann' });
      expect(await authCode(accounts.signUp({ email: 'ANN@example.com', password: 'secret-pass', displayName: 'Ann' }))).toBe('email_taken');
    });

    it('refuses a blank name and a short password', async () => {
      const { accounts } = setup();
      expect(await authCode(accounts.signUp({ email: 'a@example.com', password: 'secret-pass', displayName: '   ' }))).toBe('invalid_name');
      expect(await authCode(accounts.signUp({ email: 'a@example.com', password: 'short', displayName: 'Ann' }))).toBe('weak_password');
    });

    it('signs in with any casing and surrounding spaces in the email', async () => {
      const { accounts } = setup();
      const { user } = await accounts.signUp({ email: 'Ann@Example.com', password: 'secret-pass', displayName: 'Ann' });
      const result = await accounts.signIn({ email: ' ann@example.COM ', password: 'secret-pass' });
      expect(result.user.id).toBe(user.id);
    });

    it('gives the same error for a wrong password and an unknown email', async () => {
      const { accounts } = setup();
      await accounts.signUp({ email: 'ann@example.com', password: 'secret-pass', displayName: 'Ann' });
      expect(await authCode(accounts.signIn({ email: 'ann@example.com', password: 'wrong-pass' }))).toBe('invalid_credentials');
      expect(await authCode(accounts.signIn({ email: 'nobody@example.com', password: 'secret-pass' }))).toBe('invalid_credentials');
    });
  });

  describe('guests', () => {
    it('creates a guest with a session', async () => {
      const { accounts } = setup();
      const result = await accounts.createGuest({ displayName: ' Zhou  Yu ' });
      expect(result.user).toMatchObject({ kind: 'guest', email: null, displayName: 'Zhou Yu' });
      expect(await accounts.authenticate(result.token)).not.toBeNull();
    });

    it('refuses a blank guest name', async () => {
      const { accounts } = setup();
      expect(await authCode(accounts.createGuest({ displayName: '' }))).toBe('invalid_name');
    });

    it('purges guests idle for more than 7 days, and keeps registered users', async () => {
      const { accounts, repos, advance } = setup();
      const guest = await accounts.createGuest({ displayName: 'Guest' });
      const ann = await accounts.signUp({ email: 'ann@example.com', password: 'secret-pass', displayName: 'Ann' });
      advance(8 * DAY);
      expect(await accounts.purgeIdleGuests()).toBe(1);
      expect(await repos.users.findById(guest.user.id)).toBeNull();
      expect(await repos.users.findById(ann.user.id)).not.toBeNull();
    });
  });

  describe('sessions', () => {
    it('slides a registered session: active use keeps it alive past 30 days', async () => {
      const { accounts, advance } = setup();
      const { token } = await accounts.signUp({ email: 'ann@example.com', password: 'secret-pass', displayName: 'Ann' });
      advance(29 * DAY);
      expect(await accounts.authenticate(token)).not.toBeNull();
      advance(29 * DAY);
      const auth = await accounts.authenticate(token);
      expect(auth?.session.expiresAt.getTime()).toBe(Date.parse('2026-10-13T12:00:00.000Z') + 88 * DAY);
    });

    it('expires a registered session after 30 idle days', async () => {
      const { accounts, advance } = setup();
      const { token } = await accounts.signUp({ email: 'ann@example.com', password: 'secret-pass', displayName: 'Ann' });
      advance(30 * DAY);
      expect(await accounts.authenticate(token)).toBeNull();
    });

    it('expires a guest session after 7 idle days', async () => {
      const { accounts, advance } = setup();
      const { token, expiresAt } = await accounts.createGuest({ displayName: 'Guest' });
      expect(expiresAt.getTime()).toBe(Date.parse('2026-10-13T12:00:00.000Z') + 7 * DAY);
      advance(7 * DAY);
      expect(await accounts.authenticate(token)).toBeNull();
    });

    it("authenticate moves the user's last_seen_at", async () => {
      const { accounts, repos, advance } = setup();
      const { token, user } = await accounts.createGuest({ displayName: 'Guest' });
      advance(DAY);
      await accounts.authenticate(token);
      expect((await repos.users.findById(user.id))?.lastSeenAt.getTime()).toBe(Date.parse('2026-10-13T12:00:00.000Z') + DAY);
    });

    it('signs out', async () => {
      const { accounts } = setup();
      const { token } = await accounts.createGuest({ displayName: 'Guest' });
      await accounts.signOut(token);
      expect(await accounts.authenticate(token)).toBeNull();
    });

    it('treats an unknown token as signed out', async () => {
      const { accounts } = setup();
      expect(await accounts.authenticate('not-a-token')).toBeNull();
      await expect(accounts.signOut('not-a-token')).resolves.toBeUndefined();
    });
  });

  describe('password reset', () => {
    async function signedUp() {
      const ctx = setup();
      const ann = await ctx.accounts.signUp({ email: 'ann@example.com', password: 'secret-pass', displayName: 'Ann' });
      return { ...ctx, ann };
    }

    it('emails a single reset link to a registered user', async () => {
      const { accounts, mailer } = await signedUp();
      await accounts.forgotPassword(' ANN@example.com ');
      expect(mailer.sent).toHaveLength(1);
      expect(mailer.sent[0]).toMatchObject({ to: 'ann@example.com', displayName: 'Ann' });
      expect(mailer.sent[0].link).toMatch(new RegExp(`^${ORIGIN}/reset-password\\?token=[\\w-]{43}$`));
    });

    it('sends nothing for an unknown email', async () => {
      const { accounts, mailer } = await signedUp();
      await accounts.forgotPassword('nobody@example.com');
      expect(mailer.sent).toHaveLength(0);
    });

    it('sets the new password, revokes every old session and signs in a new one', async () => {
      const { accounts, mailer, ann } = await signedUp();
      const otherDevice = await accounts.signIn({ email: 'ann@example.com', password: 'secret-pass' });
      await accounts.forgotPassword('ann@example.com');

      const result = await accounts.resetPassword({ token: resetTokenFrom(mailer.sent[0].link), password: 'brand-new-pass' });

      expect(result.user.id).toBe(ann.user.id);
      expect(await accounts.authenticate(result.token)).not.toBeNull();
      expect(await accounts.authenticate(ann.token)).toBeNull();
      expect(await accounts.authenticate(otherDevice.token)).toBeNull();
      expect(await authCode(accounts.signIn({ email: 'ann@example.com', password: 'secret-pass' }))).toBe('invalid_credentials');
      expect((await accounts.signIn({ email: 'ann@example.com', password: 'brand-new-pass' })).user.id).toBe(ann.user.id);
    });

    it('refuses a link used twice', async () => {
      const { accounts, mailer } = await signedUp();
      await accounts.forgotPassword('ann@example.com');
      const token = resetTokenFrom(mailer.sent[0].link);
      await accounts.resetPassword({ token, password: 'brand-new-pass' });
      expect(await authCode(accounts.resetPassword({ token, password: 'another-pass' }))).toBe('invalid_reset_token');
    });

    it('refuses a link older than 1 hour', async () => {
      const { accounts, mailer, advance } = await signedUp();
      await accounts.forgotPassword('ann@example.com');
      advance(60 * 60_000);
      expect(await authCode(accounts.resetPassword({ token: resetTokenFrom(mailer.sent[0].link), password: 'brand-new-pass' }))).toBe('invalid_reset_token');
    });

    it('refuses an unknown token', async () => {
      const { accounts } = await signedUp();
      expect(await authCode(accounts.resetPassword({ token: 'nope', password: 'brand-new-pass' }))).toBe('invalid_reset_token');
    });

    it('a weak new password does not use up the link', async () => {
      const { accounts, mailer } = await signedUp();
      await accounts.forgotPassword('ann@example.com');
      const token = resetTokenFrom(mailer.sent[0].link);
      expect(await authCode(accounts.resetPassword({ token, password: 'short' }))).toBe('weak_password');
      expect(await authCode(accounts.resetPassword({ token, password: 'brand-new-pass' }))).toBe('resolved');
    });
  });
});
```

- [ ] **Step 2: Run the spec to verify it fails**

Run: `npx jest --selectProjects server auth/accounts`
Expected: FAIL, with "Cannot find module '../mail/recordingMailer'".

- [ ] **Step 3: Write the mailer**

`projects/server/src/mail/mailer.ts`:

```ts
export interface PasswordResetMail {
  to: string;
  displayName: string;
  link: string;
}

// How the server sends email. Dev uses ConsoleMailer; production gets a
// provider-backed implementation at deploy time.
export interface Mailer {
  sendPasswordReset(mail: PasswordResetMail): Promise<void>;
}

// Prints the link instead of sending it: open it from the server log.
export class ConsoleMailer implements Mailer {
  constructor(private readonly log: (line: string) => void = console.log) {}

  async sendPasswordReset(mail: PasswordResetMail): Promise<void> {
    this.log(`[mail] Password reset for ${mail.to}: ${mail.link}`);
  }
}
```

`projects/server/src/mail/recordingMailer.ts`:

```ts
import { Mailer, PasswordResetMail } from './mailer';

// A test double that keeps every mail, so a test can follow the emailed link.
export class RecordingMailer implements Mailer {
  readonly sent: PasswordResetMail[] = [];

  async sendPasswordReset(mail: PasswordResetMail): Promise<void> {
    this.sent.push(mail);
  }
}
```

- [ ] **Step 4: Write AccountService**

`projects/server/src/auth/accounts.ts`:

```ts
import { ErrorCode, normalizeDisplayName, PASSWORD_MIN } from 'protocol';
import { Mailer } from '../mail/mailer';
import { SessionRecord, UserRecord } from '../persistence/records';
import { EmailTakenError, Repositories } from '../persistence/repositories';
import { hashPassword, verifyPassword } from './password';
import { hashToken, newToken } from './tokens';

const DAY_MS = 24 * 60 * 60_000;
// Sliding: each authenticated request pushes expiry this far out again.
export const SESSION_DAYS = { registered: 30, guest: 7 } as const;
export const RESET_TOKEN_MS = 60 * 60_000;
export const GUEST_IDLE_DAYS = 7;

export type AuthErrorCode = Extract<ErrorCode, 'email_taken' | 'invalid_credentials' | 'invalid_reset_token' | 'invalid_name' | 'weak_password'>;

export class AuthError extends Error {
  constructor(readonly code: AuthErrorCode) {
    super(code);
    this.name = 'AuthError';
  }
}

// A new session: the caller sets `token` as the cookie; only its hash is stored.
export interface SignedIn {
  user: UserRecord;
  token: string;
  expiresAt: Date;
}

export interface Authenticated {
  user: UserRecord;
  session: SessionRecord;
}

export interface AccountServiceDeps {
  repos: Repositories;
  mailer: Mailer;
  publicOrigin: string;
  now?: () => Date;
}

// Hashed once, then compared against when the email is unknown, so a failed
// sign-in takes as long whether or not the account exists.
let dummyHash: Promise<string> | undefined;
const dummy = () => (dummyHash ??= hashPassword('no-such-account-password'));

export class AccountService {
  private readonly repos: Repositories;
  private readonly mailer: Mailer;
  private readonly publicOrigin: string;
  private readonly now: () => Date;

  constructor(deps: AccountServiceDeps) {
    this.repos = deps.repos;
    this.mailer = deps.mailer;
    this.publicOrigin = deps.publicOrigin;
    this.now = deps.now ?? (() => new Date());
  }

  async signUp(input: { email: string; password: string; displayName: string }): Promise<SignedIn> {
    const displayName = requireName(input.displayName);
    requirePassword(input.password);
    const passwordHash = await hashPassword(input.password);
    const now = this.now();
    try {
      const user = await this.repos.users.createRegistered({ email: input.email.trim(), passwordHash, displayName, now });
      return await this.startSession(user, now);
    } catch (err) {
      if (err instanceof EmailTakenError) throw new AuthError('email_taken');
      throw err;
    }
  }

  async signIn(input: { email: string; password: string }): Promise<SignedIn> {
    const user = await this.repos.users.findByEmail(input.email.trim());
    const matches = await verifyPassword(input.password, user?.passwordHash ?? (await dummy()));
    if (!user || user.kind !== 'registered' || !matches) throw new AuthError('invalid_credentials');
    return this.startSession(user, this.now());
  }

  async createGuest(input: { displayName: string }): Promise<SignedIn> {
    const displayName = requireName(input.displayName);
    const now = this.now();
    const user = await this.repos.users.createGuest({ displayName, now });
    return this.startSession(user, now);
  }

  // The user behind a session cookie, sliding the session; null when the token
  // is unknown, revoked or expired.
  async authenticate(token: string): Promise<Authenticated | null> {
    const now = this.now();
    const session = await this.repos.sessions.findActiveByTokenHash(hashToken(token), now);
    if (!session) return null;
    const user = await this.repos.users.findById(session.userId);
    if (!user) return null;
    const expiresAt = sessionExpiry(user, now);
    await this.repos.sessions.slide(session.id, now, expiresAt);
    await this.repos.users.touch(user.id, now);
    return { user: { ...user, lastSeenAt: now }, session: { ...session, lastSeenAt: now, expiresAt } };
  }

  async signOut(token: string): Promise<void> {
    const now = this.now();
    const session = await this.repos.sessions.findActiveByTokenHash(hashToken(token), now);
    if (session) await this.repos.sessions.revoke(session.id, now);
  }

  // Emails a reset link to a registered user. Silent otherwise: the caller
  // always answers the same way, so this never reveals whether an email exists.
  async forgotPassword(email: string): Promise<void> {
    const user = await this.repos.users.findByEmail(email.trim());
    if (!user || user.kind !== 'registered' || !user.email) return;
    const now = this.now();
    const token = newToken();
    await this.repos.resetTokens.create({ userId: user.id, tokenHash: hashToken(token), now, expiresAt: new Date(now.getTime() + RESET_TOKEN_MS) });
    await this.mailer.sendPasswordReset({
      to: user.email,
      displayName: user.displayName,
      link: `${this.publicOrigin}/reset-password?token=${encodeURIComponent(token)}`,
    });
  }

  async resetPassword(input: { token: string; password: string }): Promise<SignedIn> {
    // Checked before the token is consumed, so a weak password doesn't burn the link.
    requirePassword(input.password);
    const now = this.now();
    const record = await this.repos.resetTokens.consume(hashToken(input.token), now);
    if (!record) throw new AuthError('invalid_reset_token');
    const user = await this.repos.users.findById(record.userId);
    if (!user) throw new AuthError('invalid_reset_token');
    const passwordHash = await hashPassword(input.password);
    await this.repos.users.setPasswordHash(user.id, passwordHash, now);
    await this.repos.sessions.revokeAllForUser(user.id, now);
    return this.startSession({ ...user, passwordHash, updatedAt: now }, now);
  }

  purgeIdleGuests(): Promise<number> {
    return this.repos.users.deleteIdleGuests(new Date(this.now().getTime() - GUEST_IDLE_DAYS * DAY_MS));
  }

  private async startSession(user: UserRecord, now: Date): Promise<SignedIn> {
    const token = newToken();
    const expiresAt = sessionExpiry(user, now);
    await this.repos.sessions.create({ userId: user.id, tokenHash: hashToken(token), now, expiresAt });
    return { user, token, expiresAt };
  }
}

function sessionExpiry(user: UserRecord, now: Date): Date {
  return new Date(now.getTime() + SESSION_DAYS[user.kind] * DAY_MS);
}

function requireName(raw: string): string {
  const name = normalizeDisplayName(raw);
  if (name === null) throw new AuthError('invalid_name');
  return name;
}

function requirePassword(password: string): void {
  if (password.length < PASSWORD_MIN) throw new AuthError('weak_password');
}
```

- [ ] **Step 5: Run the spec and the type check**

Run: `npx jest --selectProjects server auth/accounts && npm run typecheck:server`
Expected: PASS (21 tests), and the type check is clean.

- [ ] **Step 6: Commit**

```bash
git add projects/server/src/mail projects/server/src/auth/accounts.ts projects/server/src/auth/accounts.spec.ts
git commit -m "feat(server): AccountService (sign up/in, guests, sliding sessions, password reset) and console Mailer

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: HTTP app: request guard, session cookie, auth routes and `/api/me`

**Files:**
- Create:
  - `projects/server/src/http/types.ts`
  - `projects/server/src/http/errors.ts`
  - `projects/server/src/http/guard.ts`
  - `projects/server/src/http/session.ts`
  - `projects/server/src/http/authRoutes.ts`
  - `projects/server/src/http/app.ts`
  - `projects/server/src/views/me.ts`
- Test: `projects/server/src/http/app.spec.ts`

**Interfaces:**
- Consumes:
  - from Task 5: `AccountService`, `AuthError`, `SignedIn`, `Authenticated`, `RecordingMailer`
  - from Task 2: `AuthRateLimits`, `RATE_LIMITS`
  - from Task 3: `createMemoryRepositories`
  - from Task 1, from `protocol`: `ERROR_MESSAGES`, `ErrorBody`, `ErrorCode`, `Me`, `FORGOT_PASSWORD_MESSAGE`; from `protocol/schemas`: the body schemas
- Produces:
  - from `app.ts`: `buildApp(deps: AppDeps): Promise<FastifyInstance>`, and `AppDeps`
  - from `session.ts`: `SESSION_COOKIE = 'sgs_session'`
  - from `me.ts`: `toMe(user: UserRecord): Me`

```ts
export interface AppDeps {
  accounts: AccountService;
  publicOrigin: string;
  cookieSecure: boolean;
  trustProxy?: boolean;
  rateLimits?: AuthRateLimits;
  now?: () => number; // for rate limits; default Date.now
  logger?: boolean;
}
```

- [ ] **Step 1: Write the failing tests**

`projects/server/src/http/app.spec.ts`:

```ts
import { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { AccountService } from '../auth/accounts';
import { AuthRateLimits, RATE_LIMITS } from '../auth/rateLimits';
import { RecordingMailer } from '../mail/recordingMailer';
import { createMemoryRepositories } from '../persistence/memory/memoryRepositories';
import { AppDeps, buildApp } from './app';

const ORIGIN = 'http://localhost:4200';
const SIGN_UP = { email: 'ann@example.com', password: 'secret-pass', displayName: 'Ann' };

async function setup(overrides: Partial<AppDeps> = {}) {
  const mailer = new RecordingMailer();
  const accounts = new AccountService({ repos: createMemoryRepositories(), mailer, publicOrigin: ORIGIN });
  const app = await buildApp({ accounts, publicOrigin: ORIGIN, cookieSecure: false, ...overrides });
  return { app, mailer };
}

const post = (app: FastifyInstance, url: string, payload: object, token?: string) =>
  app.inject({ method: 'POST', url, payload, headers: { origin: ORIGIN }, cookies: token ? { sgs_session: token } : {} });
const getMe = (app: FastifyInstance, token?: string) => app.inject({ method: 'GET', url: '/api/me', cookies: token ? { sgs_session: token } : {} });
const sessionCookies = (res: LightMyRequestResponse) => res.cookies.filter((c) => c.name === 'sgs_session');
const sessionToken = (res: LightMyRequestResponse) => sessionCookies(res)[0]?.value;

describe('HTTP app', () => {
  let app: FastifyInstance;
  afterEach(async () => {
    await app?.close();
  });

  describe('sign up, me, sign out', () => {
    it('signs up, sets an HttpOnly Lax session cookie, and /api/me returns the user', async () => {
      ({ app } = await setup());
      const res = await post(app, '/api/auth/signup', SIGN_UP);
      expect(res.statusCode).toBe(201);
      expect(res.json()).toEqual({ id: expect.any(String), kind: 'registered', displayName: 'Ann', email: 'ann@example.com' });
      const [cookie] = sessionCookies(res);
      expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Lax', path: '/' });
      expect(cookie.secure).toBeFalsy();

      const me = await getMe(app, cookie.value);
      expect(me.statusCode).toBe(200);
      expect(me.json()).toEqual(res.json());
    });

    it('marks the cookie Secure when configured', async () => {
      ({ app } = await setup({ cookieSecure: true }));
      const res = await post(app, '/api/auth/signup', SIGN_UP);
      expect(sessionCookies(res)[0].secure).toBe(true);
    });

    it('answers 401 not_signed_in without a cookie', async () => {
      ({ app } = await setup());
      const res = await getMe(app);
      expect(res.statusCode).toBe(401);
      expect(res.json()).toEqual({ code: 'not_signed_in', message: 'Please sign in first' });
    });

    it('answers 401 and clears a garbage or revoked cookie instead of failing', async () => {
      ({ app } = await setup());
      const garbage = await getMe(app, 'garbage');
      expect(garbage.statusCode).toBe(401);
      expect(sessionCookies(garbage)[0].value).toBe('');

      const token = sessionToken(await post(app, '/api/auth/signup', SIGN_UP));
      const out = await post(app, '/api/auth/signout', {}, token);
      expect(out.statusCode).toBe(204);
      expect(sessionCookies(out)[0].value).toBe('');
      expect((await getMe(app, token)).statusCode).toBe(401);
    });

    it('sign out without a session still answers 204', async () => {
      ({ app } = await setup());
      expect((await post(app, '/api/auth/signout', {})).statusCode).toBe(204);
    });

    it('creates a guest whose Me has no email', async () => {
      ({ app } = await setup());
      const res = await post(app, '/api/auth/guest', { displayName: ' Zhou Yu ' });
      expect(res.statusCode).toBe(201);
      expect(res.json()).toEqual({ id: expect.any(String), kind: 'guest', displayName: 'Zhou Yu' });
    });
  });

  describe('errors', () => {
    it('sign-in failure says "Email or password is incorrect"', async () => {
      ({ app } = await setup());
      await post(app, '/api/auth/signup', SIGN_UP);
      const res = await post(app, '/api/auth/signin', { email: 'ann@example.com', password: 'wrong-pass' });
      expect(res.statusCode).toBe(401);
      expect(res.json()).toEqual({ code: 'invalid_credentials', message: 'Email or password is incorrect' });
    });

    it('a taken email is 409 email_taken', async () => {
      ({ app } = await setup());
      await post(app, '/api/auth/signup', SIGN_UP);
      const res = await post(app, '/api/auth/signup', { ...SIGN_UP, email: 'ANN@example.com' });
      expect(res.statusCode).toBe(409);
      expect(res.json().code).toBe('email_taken');
    });

    it('a short password is 400 weak_password and a blank name 400 invalid_name', async () => {
      ({ app } = await setup());
      expect((await post(app, '/api/auth/signup', { ...SIGN_UP, password: 'short' })).json().code).toBe('weak_password');
      expect((await post(app, '/api/auth/guest', { displayName: '   ' })).json().code).toBe('invalid_name');
    });

    it('a malformed body is 400 invalid_body', async () => {
      ({ app } = await setup());
      const res = await post(app, '/api/auth/signup', { email: 'ann@example.com' });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toEqual({ code: 'invalid_body', message: 'Some fields are missing or invalid' });
    });

    it('refuses a non-GET request without the public Origin', async () => {
      ({ app } = await setup());
      const missing = await app.inject({ method: 'POST', url: '/api/auth/guest', payload: { displayName: 'X' } });
      expect(missing.statusCode).toBe(403);
      expect(missing.json().code).toBe('bad_origin');
      const wrong = await app.inject({ method: 'POST', url: '/api/auth/guest', payload: { displayName: 'X' }, headers: { origin: 'https://evil.example' } });
      expect(wrong.statusCode).toBe(403);
    });

    it('refuses a non-JSON body with 415', async () => {
      ({ app } = await setup());
      const res = await app.inject({ method: 'POST', url: '/api/auth/guest', payload: 'displayName=X', headers: { origin: ORIGIN, 'content-type': 'application/x-www-form-urlencoded' } });
      expect(res.statusCode).toBe(415);
      expect(res.json().code).toBe('unsupported_media_type');
    });

    it('an unknown route is 404 not_found', async () => {
      ({ app } = await setup());
      const res = await app.inject({ method: 'GET', url: '/api/nope' });
      expect(res.statusCode).toBe(404);
      expect(res.json().code).toBe('not_found');
    });
  });

  describe('switching sessions', () => {
    it('signing in while signed in as a guest revokes the guest session and sends one cookie', async () => {
      ({ app } = await setup());
      await post(app, '/api/auth/signup', SIGN_UP);
      const guestToken = sessionToken(await post(app, '/api/auth/guest', { displayName: 'Guest' }));

      const res = await post(app, '/api/auth/signin', { email: 'ann@example.com', password: 'secret-pass' }, guestToken);

      expect(res.statusCode).toBe(200);
      expect(sessionCookies(res)).toHaveLength(1);
      expect(sessionToken(res)).not.toBe(guestToken);
      expect((await getMe(app, guestToken)).statusCode).toBe(401);
      expect((await getMe(app, sessionToken(res))).json().kind).toBe('registered');
    });
  });

  describe('password reset', () => {
    it('answers the same for a known and an unknown email, and mails only the known one', async () => {
      let mailer: RecordingMailer;
      ({ app, mailer } = await setup());
      await post(app, '/api/auth/signup', SIGN_UP);
      const known = await post(app, '/api/auth/forgot-password', { email: 'ann@example.com' });
      const unknown = await post(app, '/api/auth/forgot-password', { email: 'nobody@example.com' });
      expect(known.statusCode).toBe(200);
      expect(known.json()).toEqual({ message: 'If that email has an account, we sent a link' });
      expect(unknown.json()).toEqual(known.json());
      expect(mailer.sent).toHaveLength(1);
    });

    it('resets from the emailed link: new cookie works, the old one does not', async () => {
      let mailer: RecordingMailer;
      ({ app, mailer } = await setup());
      const oldToken = sessionToken(await post(app, '/api/auth/signup', SIGN_UP));
      await post(app, '/api/auth/forgot-password', { email: 'ann@example.com' });
      const token = new URL(mailer.sent[0].link).searchParams.get('token')!;

      const res = await post(app, '/api/auth/reset-password', { token, password: 'brand-new-pass' });

      expect(res.statusCode).toBe(200);
      expect((await getMe(app, sessionToken(res))).statusCode).toBe(200);
      expect((await getMe(app, oldToken)).statusCode).toBe(401);
      const again = await post(app, '/api/auth/reset-password', { token, password: 'another-pass' });
      expect(again.statusCode).toBe(400);
      expect(again.json()).toEqual({ code: 'invalid_reset_token', message: 'This reset link is invalid or has expired' });
    });
  });

  describe('rate limits', () => {
    it('refuses sign-in attempts over the per-email limit with 429', async () => {
      ({ app } = await setup({ rateLimits: new AuthRateLimits({ ...RATE_LIMITS, signInPerEmail: { limit: 2, windowMs: 60_000 } }) }));
      const attempt = () => post(app, '/api/auth/signin', { email: 'Ann@example.com ', password: 'wrong-pass' });
      expect((await attempt()).statusCode).toBe(401);
      expect((await attempt()).statusCode).toBe(401);
      const third = await attempt();
      expect(third.statusCode).toBe(429);
      expect(third.json()).toEqual({ code: 'rate_limited', message: 'Too many attempts. Wait a few minutes and try again' });
    });

    it('guest creation shares the sign-up budget per IP', async () => {
      ({ app } = await setup({ rateLimits: new AuthRateLimits({ ...RATE_LIMITS, signUpPerIp: { limit: 1, windowMs: 60_000 } }) }));
      expect((await post(app, '/api/auth/guest', { displayName: 'A' })).statusCode).toBe(201);
      expect((await post(app, '/api/auth/signup', SIGN_UP)).statusCode).toBe(429);
    });

    it('limits forgot-password per email', async () => {
      ({ app } = await setup({ rateLimits: new AuthRateLimits({ ...RATE_LIMITS, forgotPerEmail: { limit: 1, windowMs: 60_000 } }) }));
      expect((await post(app, '/api/auth/forgot-password', { email: 'a@example.com' })).statusCode).toBe(200);
      expect((await post(app, '/api/auth/forgot-password', { email: 'A@example.com' })).statusCode).toBe(429);
    });
  });
});
```

- [ ] **Step 2: Run the spec to verify it fails**

Run: `npx jest --selectProjects server http/app`
Expected: FAIL, with "Cannot find module './app'".

- [ ] **Step 3: Write the view and the HTTP helpers**

`projects/server/src/views/me.ts`:

```ts
import type { Me } from 'protocol';
import { UserRecord } from '../persistence/records';

// The signed-in user as the client sees it: never the hash or timestamps.
export function toMe(user: UserRecord): Me {
  return {
    id: user.id,
    kind: user.kind,
    displayName: user.displayName,
    ...(user.kind === 'registered' && user.email ? { email: user.email } : {}),
  };
}
```

`projects/server/src/http/types.ts`:

```ts
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type { FastifyBaseLogger, FastifyInstance, RawReplyDefaultExpression, RawRequestDefaultExpression, RawServerDefault } from 'fastify';

export type TypedApp = FastifyInstance<RawServerDefault, RawRequestDefaultExpression, RawReplyDefaultExpression, FastifyBaseLogger, TypeBoxTypeProvider>;
```

`projects/server/src/http/errors.ts`:

```ts
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
```

`projects/server/src/http/guard.ts`:

```ts
import { FastifyReply, FastifyRequest } from 'fastify';
import { errorBody } from './errors';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// CSRF guard: a state-changing request must come from our own origin and be
// JSON (which a plain cross-site form can't send).
export function requestGuard(publicOrigin: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (SAFE_METHODS.has(request.method)) return;
    if (request.headers.origin !== publicOrigin) return reply.code(403).send(errorBody('bad_origin'));
    if (!/^application\/json\s*(;|$)/i.test(request.headers['content-type'] ?? '')) return reply.code(415).send(errorBody('unsupported_media_type'));
  };
}
```

`projects/server/src/http/session.ts`:

```ts
import { FastifyReply } from 'fastify';

export const SESSION_COOKIE = 'sgs_session';

export function setSessionCookie(reply: FastifyReply, token: string, expiresAt: Date, secure: boolean): void {
  reply.setCookie(SESSION_COOKIE, token, { httpOnly: true, secure, sameSite: 'lax', path: '/', expires: expiresAt });
}

export function clearSessionCookie(reply: FastifyReply, secure: boolean): void {
  reply.clearCookie(SESSION_COOKIE, { httpOnly: true, secure, sameSite: 'lax', path: '/' });
}
```

- [ ] **Step 4: Write the routes and the app**

`projects/server/src/http/authRoutes.ts`:

```ts
import { FastifyReply, FastifyRequest } from 'fastify';
import { FORGOT_PASSWORD_MESSAGE } from 'protocol';
import { ForgotPasswordBodySchema, GuestBodySchema, ResetPasswordBodySchema, SignInBodySchema, SignUpBodySchema } from 'protocol/schemas';
import { AccountService, SignedIn } from '../auth/accounts';
import { AuthRateLimits } from '../auth/rateLimits';
import { toMe } from '../views/me';
import { errorBody } from './errors';
import { clearSessionCookie, SESSION_COOKIE, setSessionCookie } from './session';
import { TypedApp } from './types';

export interface AuthRouteDeps {
  accounts: AccountService;
  limits: AuthRateLimits;
  cookieSecure: boolean;
  now: () => number;
}

const emailKey = (email: string) => email.trim().toLowerCase();

export function registerAuthRoutes(app: TypedApp, deps: AuthRouteDeps): void {
  const { accounts, limits, cookieSecure, now } = deps;

  const tooMany = (reply: FastifyReply) => reply.code(429).send(errorBody('rate_limited'));

  // Ends the session this browser had before, if any: signing in as someone
  // new on the same browser never leaves the old session usable.
  const endCurrentSession = async (request: FastifyRequest) => {
    const token = request.cookies[SESSION_COOKIE];
    if (token) await accounts.signOut(token);
  };

  const signedIn = async (request: FastifyRequest, reply: FastifyReply, result: SignedIn, status: number) => {
    await endCurrentSession(request);
    setSessionCookie(reply, result.token, result.expiresAt, cookieSecure);
    return reply.code(status).send(toMe(result.user));
  };

  app.post('/api/auth/signup', { schema: { body: SignUpBodySchema } }, async (request, reply) => {
    if (!limits.signUpIp.hit(request.ip, now())) return tooMany(reply);
    return signedIn(request, reply, await accounts.signUp(request.body), 201);
  });

  app.post('/api/auth/signin', { schema: { body: SignInBodySchema } }, async (request, reply) => {
    const ipAllowed = limits.signInIp.hit(request.ip, now());
    const emailAllowed = limits.signInEmail.hit(emailKey(request.body.email), now());
    if (!ipAllowed || !emailAllowed) return tooMany(reply);
    return signedIn(request, reply, await accounts.signIn(request.body), 200);
  });

  app.post('/api/auth/guest', { schema: { body: GuestBodySchema } }, async (request, reply) => {
    if (!limits.signUpIp.hit(request.ip, now())) return tooMany(reply);
    return signedIn(request, reply, await accounts.createGuest(request.body), 201);
  });

  app.post('/api/auth/signout', async (request, reply) => {
    await endCurrentSession(request);
    clearSessionCookie(reply, cookieSecure);
    return reply.code(204).send();
  });

  app.post('/api/auth/forgot-password', { schema: { body: ForgotPasswordBodySchema } }, async (request, reply) => {
    const ipAllowed = limits.forgotIp.hit(request.ip, now());
    const emailAllowed = limits.forgotEmail.hit(emailKey(request.body.email), now());
    if (!ipAllowed || !emailAllowed) return tooMany(reply);
    await accounts.forgotPassword(request.body.email);
    return { message: FORGOT_PASSWORD_MESSAGE };
  });

  app.post('/api/auth/reset-password', { schema: { body: ResetPasswordBodySchema } }, async (request, reply) => {
    return signedIn(request, reply, await accounts.resetPassword(request.body), 200);
  });

  app.get('/api/me', async (request, reply) => {
    if (!request.auth) return reply.code(401).send(errorBody('not_signed_in'));
    return toMe(request.auth.user);
  });
}
```

`projects/server/src/http/app.ts`:

```ts
import cookie from '@fastify/cookie';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import Fastify, { FastifyError, FastifyInstance } from 'fastify';
import { AccountService, AuthError, Authenticated } from '../auth/accounts';
import { AuthRateLimits } from '../auth/rateLimits';
import { registerAuthRoutes } from './authRoutes';
import { AUTH_ERROR_STATUS, errorBody } from './errors';
import { requestGuard } from './guard';
import { clearSessionCookie, SESSION_COOKIE, setSessionCookie } from './session';

declare module 'fastify' {
  interface FastifyRequest {
    // The signed-in user and session, or null; set for every request.
    auth: Authenticated | null;
  }
}

export interface AppDeps {
  accounts: AccountService;
  publicOrigin: string;
  cookieSecure: boolean;
  trustProxy?: boolean;
  rateLimits?: AuthRateLimits;
  // Clock for the rate limits.
  now?: () => number;
  logger?: boolean;
}

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({ logger: deps.logger ?? false, trustProxy: deps.trustProxy ?? false }).withTypeProvider<TypeBoxTypeProvider>();
  await app.register(cookie);
  app.decorateRequest('auth', null);

  app.addHook('onRequest', requestGuard(deps.publicOrigin));

  // Resolve the session cookie. A valid one is refreshed so the browser's copy
  // slides along with the stored expiry; an invalid one is cleared.
  app.addHook('onRequest', async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE];
    if (!token) return;
    const auth = await deps.accounts.authenticate(token);
    if (auth) {
      request.auth = auth;
      setSessionCookie(reply, token, auth.session.expiresAt, deps.cookieSecure);
    } else {
      clearSessionCookie(reply, deps.cookieSecure);
    }
  });

  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (error instanceof AuthError) return reply.code(AUTH_ERROR_STATUS[error.code]).send(errorBody(error.code));
    if (error.validation) return reply.code(400).send(errorBody('invalid_body'));
    // Body parsing errors (bad JSON, empty body, too large) carry their 4xx status.
    if (error.statusCode !== undefined && error.statusCode >= 400 && error.statusCode < 500) return reply.code(error.statusCode).send(errorBody('invalid_body'));
    request.log.error(error);
    return reply.code(500).send(errorBody('internal'));
  });

  app.setNotFoundHandler((_request, reply) => reply.code(404).send(errorBody('not_found')));

  registerAuthRoutes(app, {
    accounts: deps.accounts,
    limits: deps.rateLimits ?? new AuthRateLimits(),
    cookieSecure: deps.cookieSecure,
    now: deps.now ?? Date.now,
  });

  await app.ready();
  return app;
}
```

- [ ] **Step 5: Run the spec and the type check**

Run: `npx jest --selectProjects server http/app && npm run typecheck:server`
Expected: PASS (19 tests), and the type check is clean.

If "signing in while signed in … sends one cookie" fails because two `sgs_session` Set-Cookie headers appear (the onRequest refresh plus the new one), don't drop the test. Instead, move the refresh out of `onRequest`:

- Set a request flag in `onRequest`.
- Apply the refresh in an `onSend` hook only when the route set no session cookie itself. Track that with a second flag that `setSessionCookie` and `clearSessionCookie` set through `reply.request`.

- [ ] **Step 6: Commit**

```bash
git add projects/server/src/http projects/server/src/views
git commit -m "feat(server): HTTP app with origin/JSON guard, session cookie, auth routes, /api/me and rate limits

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Runnable server, dev workflow and the Angular dev proxy

**Files:**
- Create:
  - `projects/server/src/server.ts`
  - `projects/server/src/main.ts`
  - `projects/server/README.md`
  - `.env.example`
  - `projects/app/proxy.conf.json`
- Modify:
  - `package.json` (script `server`)
  - `.gitignore` (`.env`)
  - `angular.json` (serve `proxyConfig`)
  - `docs/architecture/backend-and-deployment.md` (one pointer line)
- Test: `projects/server/src/server.spec.ts`

**Interfaces:**
- Consumes: `loadConfig`/`ServerConfig` (Task 2), `createMemoryRepositories` (Task 3), `createDb`/`migrateToLatest`/`createPostgresRepositories` (Task 4), `AccountService`/`ConsoleMailer` (Task 5), `buildApp` (Task 6).
- Produces: `createServer(config: ServerConfig, options?: { logger?: boolean }): Promise<RunningServer>`, where `interface RunningServer { app: FastifyInstance; close(): Promise<void> }`.

- [ ] **Step 1: Write the failing test**

`projects/server/src/server.spec.ts`:

```ts
import { loadConfig } from './config';
import { createServer } from './server';

describe('createServer', () => {
  it('serves the auth API on the in-memory store when there is no DATABASE_URL', async () => {
    const server = await createServer(loadConfig({}), { logger: false });
    try {
      expect((await server.app.inject({ method: 'GET', url: '/api/me' })).statusCode).toBe(401);
      const guest = await server.app.inject({
        method: 'POST',
        url: '/api/auth/guest',
        payload: { displayName: 'Guest' },
        headers: { origin: 'http://localhost:4200' },
      });
      expect(guest.statusCode).toBe(201);
    } finally {
      await server.close();
    }
  });
});
```

Run: `npx jest --selectProjects server server.spec`
Expected: FAIL, with "Cannot find module './server'".

- [ ] **Step 2: Write `server.ts` and `main.ts`**

`projects/server/src/server.ts`:

```ts
import { FastifyInstance } from 'fastify';
import { AccountService } from './auth/accounts';
import { AuthRateLimits } from './auth/rateLimits';
import { ServerConfig } from './config';
import { buildApp } from './http/app';
import { ConsoleMailer } from './mail/mailer';
import { createMemoryRepositories } from './persistence/memory/memoryRepositories';
import { migrateToLatest } from './persistence/migrate';
import { createDb } from './persistence/postgres/db';
import { createPostgresRepositories } from './persistence/postgres/postgresRepositories';
import { Repositories } from './persistence/repositories';

const HOUSEKEEPING_MS = 60 * 60_000;

export interface RunningServer {
  app: FastifyInstance;
  close(): Promise<void>;
}

// Everything the process runs, wired from config: the store (Postgres,
// migrated on start, or in memory), accounts, the HTTP app and an hourly
// clean-up of rate-limit windows and idle guests.
export async function createServer(config: ServerConfig, options: { logger?: boolean } = {}): Promise<RunningServer> {
  const store = await openStore(config.databaseUrl);
  const accounts = new AccountService({ repos: store.repos, mailer: new ConsoleMailer(), publicOrigin: config.publicOrigin });
  const rateLimits = new AuthRateLimits();
  const app = await buildApp({
    accounts,
    publicOrigin: config.publicOrigin,
    cookieSecure: config.cookieSecure,
    trustProxy: config.trustProxy,
    rateLimits,
    logger: options.logger ?? true,
  });

  const housekeeping = setInterval(() => {
    rateLimits.prune(Date.now());
    accounts.purgeIdleGuests().catch((err: unknown) => app.log.error(err, 'Purging idle guests failed'));
  }, HOUSEKEEPING_MS);
  housekeeping.unref();

  return {
    app,
    close: async () => {
      clearInterval(housekeeping);
      await app.close();
      await store.close();
    },
  };
}

async function openStore(databaseUrl: string | null): Promise<{ repos: Repositories; close(): Promise<void> }> {
  if (!databaseUrl) return { repos: createMemoryRepositories(), close: async () => undefined };
  const db = createDb(databaseUrl);
  await migrateToLatest(db);
  return { repos: createPostgresRepositories(db), close: () => db.destroy() };
}
```

`projects/server/src/main.ts`:

```ts
import { existsSync } from 'node:fs';
import { loadConfig } from './config';
import { createServer } from './server';

// Entry point: `npm run server`. Reads .env from the working directory when present.
async function main(): Promise<void> {
  if (existsSync('.env')) process.loadEnvFile('.env');
  const config = loadConfig(process.env);
  const server = await createServer(config);
  if (!config.databaseUrl) server.app.log.warn('No DATABASE_URL: using the in-memory store, so everything is lost on restart');
  await server.app.listen({ port: config.port, host: config.host });

  const stop = async () => {
    await server.close();
    process.exit(0);
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 3: Dev workflow files**

In `package.json` `scripts`, add:

```json
    "server": "tsx watch --tsconfig projects/server/tsconfig.json projects/server/src/main.ts"
```

`.env.example`:

```
# Copy to .env for `npm run server`. Without DATABASE_URL the server uses an
# in-memory store (fine for UI work; nothing survives a restart).
DATABASE_URL=postgres://sanguosha:sanguosha@localhost:5433/sanguosha
PUBLIC_ORIGIN=http://localhost:4200
PORT=3000
```

Add these lines to `.gitignore`, under `# Miscellaneous`:

```
# Local server settings (see .env.example)
.env
```

`projects/app/proxy.conf.json`:

```json
{
  "/api": {
    "target": "http://localhost:3000",
    "secure": false,
    "ws": true
  }
}
```

In `angular.json`, change `projects.app.architect.serve` to add an `options` object:

```json
        "serve": {
          "builder": "@angular/build:dev-server",
          "options": {
            "proxyConfig": "projects/app/proxy.conf.json"
          },
          "configurations": {
```

The `configurations` and `defaultConfiguration` already there stay as they are.

`projects/server/README.md`:

````markdown
# Server

The Node backend: Fastify HTTP API (and, from Stage 3, the WebSocket),
Postgres through Kysely. Design: `docs/superpowers/specs/2026-10-13-backend-multiplayer-design.md`.

## Run it locally

```bash
npm run db:up            # Postgres 17 in Docker (docker-compose.yml)
cp .env.example .env     # once
npm run server           # API on http://localhost:3000, restarts on change
npm start                # the Angular app; /api is proxied to the server
```

Without `DATABASE_URL` the server runs on an in-memory store. Migrations run on start.

Password reset emails are printed to the server log (`[mail] Password reset for …`) in development.

## Tests

- `npx jest --selectProjects server` runs the unit and HTTP tests on the in-memory store.
- `npm run test:db` also runs the repository contract against Postgres. It needs `npm run db:up`, and each run creates and drops its own database.
- `npm run typecheck:server` type-checks `protocol` and `server`.

## Layout

- `src/http/`: Fastify app, request guard, session cookie, routes.
- `src/auth/`: AccountService, password hashing, tokens, rate limits.
- `src/persistence/`: domain records and repository interfaces, the in-memory and Postgres stores, migrations.
- `src/views/`: domain records to wire shapes.
- `src/mail/`: the Mailer interface and the console implementation.
````

In `docs/architecture/backend-and-deployment.md`, add one line at the end of the document:

```markdown
Implementation status: the server foundation and accounts (Stage 2) live in `projects/server`; see its README for running it locally.
```

- [ ] **Step 4: Run the tests, the type check and a live smoke test**

Run: `npx jest --selectProjects server && npm run typecheck:server`
Expected: PASS. Every server test runs except the Postgres suite, which is skipped.

Smoke test the in-memory store with no `.env` present:

```bash
(PORT=3999 npx tsx --tsconfig projects/server/tsconfig.json projects/server/src/main.ts &) ; sleep 4
curl -s -i http://127.0.0.1:3999/api/me | head -1
curl -s -i -X POST http://127.0.0.1:3999/api/auth/guest -H 'content-type: application/json' -H 'origin: http://localhost:4200' -d '{"displayName":"Smoke"}' | grep -i -E '^(HTTP|set-cookie)'
pkill -f 'projects/server/src/main.ts'
```

Expected:
- `HTTP/1.1 401 Unauthorized`
- then `HTTP/1.1 201 Created`, plus a `set-cookie: sgs_session=…; …HttpOnly; SameSite=Lax` line.

If Docker is running, repeat the smoke test with `DATABASE_URL=postgres://sanguosha:sanguosha@localhost:5433/sanguosha`. Expect the same results, with migrations applied on start.

- [ ] **Step 5: Commit**

```bash
git add projects/server package.json .gitignore .env.example angular.json projects/app/proxy.conf.json docs/architecture/backend-and-deployment.md
git commit -m "feat(server): runnable server with store selection, housekeeping, dev scripts and /api proxy

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Angular `AuthService` and the toolbar account menu

**Files:**
- Modify:
  - `jest.config.js` (app `moduleNameMapper`)
  - `projects/app/src/app/app.config.ts`
  - `projects/app/src/app/app.ts`
  - `projects/app/src/app/app.html`
  - `projects/app/src/app/app.css`
  - `projects/app/src/app/app.spec.ts`
- Create: `projects/app/src/app/auth/auth.service.ts`
- Test: `projects/app/src/app/auth/auth.service.spec.ts`, `projects/app/src/app/app.spec.ts` (new cases)

**Interfaces:**
- Consumes: from `protocol`, the types `Me`, `SignUpBody`, `SignInBody`, `GuestBody`, `ForgotPasswordBody`, `ResetPasswordBody`, `MessageBody`, `ErrorBody`, and the value `ERROR_MESSAGES`.
- Produces:

```ts
export class ApiError extends Error { readonly code: string; readonly status: number }
export function toApiError(err: unknown): ApiError
@Injectable({ providedIn: 'root' }) export class AuthService {
  readonly me: Signal<Me | null>;
  readonly loaded: Signal<boolean>;
  readonly isRegistered: Signal<boolean>;
  load(): Promise<Me | null>;
  signUp(body: SignUpBody): Promise<Me>;
  signIn(body: SignInBody): Promise<Me>;
  playAsGuest(body: GuestBody): Promise<Me>;
  signOut(): Promise<void>;
  forgotPassword(body: ForgotPasswordBody): Promise<string>;
  resetPassword(body: ResetPasswordBody): Promise<Me>;
}
```

- [ ] **Step 1: Map `protocol` for the app tests and provide HttpClient**

In `jest.config.js`, add this line to the `app` project's `moduleNameMapper`:

```js
        '^protocol$': '<rootDir>/../protocol/src/public-api.ts',
```

Replace `projects/app/src/app/app.config.ts` with:

```ts
import { provideHttpClient, withFetch } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'enabled' })),
    provideHttpClient(withFetch()),
  ],
};
```

- [ ] **Step 2: Write the failing AuthService tests**

`projects/app/src/app/auth/auth.service.spec.ts`:

```ts
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { Me } from 'protocol';
import { ApiError, AuthService } from './auth.service';

const ANN: Me = { id: 'u1', kind: 'registered', displayName: 'Ann', email: 'ann@example.com' };
const GUEST: Me = { id: 'u2', kind: 'guest', displayName: 'Guest' };

describe('AuthService', () => {
  let auth: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('load() reads /api/me', async () => {
    const done = auth.load();
    http.expectOne({ method: 'GET', url: '/api/me' }).flush(ANN);
    expect(await done).toEqual(ANN);
    expect(auth.me()).toEqual(ANN);
    expect(auth.loaded()).toBe(true);
    expect(auth.isRegistered()).toBe(true);
  });

  it('load() leaves me null when signed out', async () => {
    const done = auth.load();
    http.expectOne('/api/me').flush({ code: 'not_signed_in', message: 'Please sign in first' }, { status: 401, statusText: 'Unauthorized' });
    expect(await done).toBeNull();
    expect(auth.me()).toBeNull();
    expect(auth.loaded()).toBe(true);
  });

  it('signIn posts the body and sets me', async () => {
    const done = auth.signIn({ email: 'ann@example.com', password: 'secret-pass' });
    const req = http.expectOne({ method: 'POST', url: '/api/auth/signin' });
    expect(req.request.body).toEqual({ email: 'ann@example.com', password: 'secret-pass' });
    req.flush(ANN);
    expect(await done).toEqual(ANN);
    expect(auth.me()).toEqual(ANN);
  });

  it('signUp, playAsGuest and resetPassword set me from their endpoints', async () => {
    const up = auth.signUp({ email: 'ann@example.com', password: 'secret-pass', displayName: 'Ann' });
    http.expectOne({ method: 'POST', url: '/api/auth/signup' }).flush(ANN);
    await up;
    const guest = auth.playAsGuest({ displayName: 'Guest' });
    http.expectOne({ method: 'POST', url: '/api/auth/guest' }).flush(GUEST);
    await guest;
    expect(auth.isRegistered()).toBe(false);
    const reset = auth.resetPassword({ token: 't', password: 'brand-new-pass' });
    http.expectOne({ method: 'POST', url: '/api/auth/reset-password' }).flush(ANN);
    await reset;
    expect(auth.me()).toEqual(ANN);
  });

  it("turns the server's error body into an ApiError with its message", async () => {
    const done = auth.signIn({ email: 'ann@example.com', password: 'wrong' });
    http.expectOne('/api/auth/signin').flush({ code: 'invalid_credentials', message: 'Email or password is incorrect' }, { status: 401, statusText: 'Unauthorized' });
    const err = await done.catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ code: 'invalid_credentials', message: 'Email or password is incorrect', status: 401 });
    expect(auth.me()).toBeNull();
  });

  it('reports an unreachable server as a network error', async () => {
    const done = auth.signIn({ email: 'ann@example.com', password: 'x' });
    http.expectOne('/api/auth/signin').error(new ProgressEvent('error'), { status: 0 });
    expect(await done.catch((e: unknown) => e)).toMatchObject({ code: 'network', message: "Can't reach the server. Check your connection and try again" });
  });

  it('signOut posts {} and clears me', async () => {
    const signIn = auth.signIn({ email: 'ann@example.com', password: 'secret-pass' });
    http.expectOne('/api/auth/signin').flush(ANN);
    await signIn;
    const done = auth.signOut();
    const req = http.expectOne({ method: 'POST', url: '/api/auth/signout' });
    expect(req.request.body).toEqual({});
    req.flush(null, { status: 204, statusText: 'No Content' });
    await done;
    expect(auth.me()).toBeNull();
  });

  it("forgotPassword returns the server's message", async () => {
    const done = auth.forgotPassword({ email: 'ann@example.com' });
    http.expectOne({ method: 'POST', url: '/api/auth/forgot-password' }).flush({ message: 'If that email has an account, we sent a link' });
    expect(await done).toBe('If that email has an account, we sent a link');
  });
});
```

Run: `npx jest --selectProjects app auth.service`
Expected: FAIL, with "Cannot find module './auth.service'".

- [ ] **Step 3: Write AuthService**

`projects/app/src/app/auth/auth.service.ts`:

```ts
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ERROR_MESSAGES } from 'protocol';
import type { ErrorBody, ForgotPasswordBody, GuestBody, Me, MessageBody, ResetPasswordBody, SignInBody, SignUpBody } from 'protocol';

// A failed API call: the server's code and message, ready to show.
export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function toApiError(err: unknown): ApiError {
  if (err instanceof HttpErrorResponse) {
    const body = err.error as Partial<ErrorBody> | null;
    if (body && typeof body.code === 'string' && typeof body.message === 'string') return new ApiError(body.code, body.message, err.status);
    if (err.status === 0) return new ApiError('network', "Can't reach the server. Check your connection and try again", 0);
    return new ApiError('internal', ERROR_MESSAGES.internal, err.status);
  }
  return new ApiError('internal', ERROR_MESSAGES.internal, 0);
}

// Who is signed in. The session lives in an HttpOnly cookie the app never
// sees; this only mirrors the user the server reports.
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly current = signal<Me | null>(null);
  private readonly ready = signal(false);

  readonly me = this.current.asReadonly();
  // False until the first answer from /api/me, so the toolbar doesn't flash "Sign In".
  readonly loaded = this.ready.asReadonly();
  readonly isRegistered = computed(() => this.current()?.kind === 'registered');

  async load(): Promise<Me | null> {
    try {
      this.current.set(await firstValueFrom(this.http.get<Me>('/api/me')));
    } catch {
      this.current.set(null);
    }
    this.ready.set(true);
    return this.current();
  }

  signUp(body: SignUpBody): Promise<Me> {
    return this.signInWith('/api/auth/signup', body);
  }

  signIn(body: SignInBody): Promise<Me> {
    return this.signInWith('/api/auth/signin', body);
  }

  playAsGuest(body: GuestBody): Promise<Me> {
    return this.signInWith('/api/auth/guest', body);
  }

  resetPassword(body: ResetPasswordBody): Promise<Me> {
    return this.signInWith('/api/auth/reset-password', body);
  }

  async signOut(): Promise<void> {
    try {
      await firstValueFrom(this.http.post<void>('/api/auth/signout', {}));
    } catch (err) {
      throw toApiError(err);
    }
    this.current.set(null);
  }

  async forgotPassword(body: ForgotPasswordBody): Promise<string> {
    try {
      return (await firstValueFrom(this.http.post<MessageBody>('/api/auth/forgot-password', body))).message;
    } catch (err) {
      throw toApiError(err);
    }
  }

  private async signInWith(url: string, body: object): Promise<Me> {
    let me: Me;
    try {
      me = await firstValueFrom(this.http.post<Me>(url, body));
    } catch (err) {
      throw toApiError(err);
    }
    this.current.set(me);
    this.ready.set(true);
    return me;
  }
}
```

Run: `npx jest --selectProjects app auth.service`
Expected: PASS (8 tests).

- [ ] **Step 4: Write the failing App toolbar tests**

In `projects/app/src/app/app.spec.ts`, add these imports:

```ts
import { computed, signal } from '@angular/core';
import type { Me } from 'protocol';
import { AuthService } from './auth/auth.service';
```

Add a fake AuthService above the `describe`:

```ts
const me = signal<Me | null>(null);
const loaded = signal(true);
const fakeAuth = {
  me,
  loaded,
  isRegistered: computed(() => me()?.kind === 'registered'),
  load: jest.fn(async () => me()),
  signOut: jest.fn(async () => me.set(null)),
};
```

Then add `{ provide: AuthService, useValue: fakeAuth },` to the `providers` in the existing `beforeEach`, and add `{ path: 'sign-in', children: [] }, { path: 'sign-up', children: [] },` to its `provideRouter` list.

At the start of that `beforeEach`, before `configureTestingModule`, add:

```ts
    me.set(null);
    loaded.set(true);
    fakeAuth.signOut.mockClear();
```

Append these tests inside the `describe('App', …)`:

```ts
  it('loads who is signed in on start', async () => {
    fakeAuth.load.mockClear();
    await render();
    expect(fakeAuth.load).toHaveBeenCalledTimes(1);
  });

  it('shows Sign In when nobody is signed in', async () => {
    const { el } = await render();
    expect(el.querySelector('a.sign-in')?.textContent).toContain('Sign In');
    expect(el.querySelector('button.account')).toBeNull();
  });

  it('shows nothing for the account until the first answer arrives', async () => {
    loaded.set(false);
    const { el } = await render();
    expect(el.querySelector('a.sign-in')).toBeNull();
    expect(el.querySelector('button.account')).toBeNull();
  });

  it("shows the signed-in user's name, and Sign Out signs out and goes to Setup", async () => {
    me.set({ id: 'u1', kind: 'registered', displayName: 'Ann', email: 'ann@example.com' });
    const { fixture, el } = await render('/wiki/generals');
    const account = el.querySelector('button.account') as HTMLButtonElement;
    expect(account.textContent).toContain('Ann');
    account.click();
    fixture.detectChanges();
    await fixture.whenStable();
    const signOut = document.querySelector('.cdk-overlay-container button.sign-out') as HTMLButtonElement;
    expect(signOut.textContent).toContain('Sign Out');
    signOut.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fakeAuth.signOut).toHaveBeenCalled();
    expect(TestBed.inject(Router).url).toBe('/setup');
    expect(el.querySelector('a.sign-in')).not.toBeNull();
  });

  it('offers Create Account to a guest', async () => {
    me.set({ id: 'u2', kind: 'guest', displayName: 'Guest' });
    const { fixture, el } = await render();
    (el.querySelector('button.account') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    const overlay = document.querySelector('.cdk-overlay-container') as HTMLElement;
    expect(overlay.textContent).toContain('Playing as a guest');
    expect(overlay.querySelector('a.create-account')?.textContent).toContain('Create Account');
  });
```

Run: `npx jest --selectProjects app app.spec`
Expected: FAIL. The new tests can't find `a.sign-in` or `button.account`, and `load` isn't called.

- [ ] **Step 5: Add the account area to the toolbar**

In `projects/app/src/app/app.ts`:
- add `import { AuthService } from './auth/auth.service';`;
- add these members to the class;
- extend the constructor as shown.

```ts
  protected readonly auth = inject(AuthService);

  constructor() {
    this.music.start();
    void this.auth.load();
  }

  protected async signOut(): Promise<void> {
    try {
      await this.auth.signOut();
    } catch {
      // Still signed in on the server; the menu keeps showing the account.
      return;
    }
    await this.router.navigateByUrl('/setup');
  }
```

That code replaces the existing constructor, which only called `this.music.start()`.

In `projects/app/src/app/app.html`, insert this block between `<span class="spacer"></span>` and the music `<button`:

```html
  @if (auth.loaded()) {
    @if (auth.me(); as me) {
      <button mat-button type="button" class="account" [matMenuTriggerFor]="accountMenu" aria-label="Account">
        <mat-icon>account_circle</mat-icon><span class="label">{{ me.displayName }}</span>
      </button>
      <mat-menu #accountMenu="matMenu">
        <div class="account-summary" mat-menu-item disabled>{{ me.kind === 'guest' ? 'Playing as a guest' : me.email }}</div>
        @if (me.kind === 'guest') {
          <a mat-menu-item class="create-account" routerLink="/sign-up">Create Account</a>
        }
        <button mat-menu-item type="button" class="sign-out" (click)="signOut()">Sign Out</button>
      </mat-menu>
    } @else {
      <a mat-button class="sign-in" routerLink="/sign-in"><mat-icon>login</mat-icon><span class="label">Sign In</span></a>
    }
  }
```

Append to `projects/app/src/app/app.css`:

```css
.account,
.sign-in {
  --mat-button-text-label-text-color: var(--mat-sys-on-primary);
  color: var(--mat-sys-on-primary);
}
@media (max-width: 599px) {
  .account .label,
  .sign-in .label {
    display: none;
  }
}
```

- [ ] **Step 6: Run the app tests**

Run: `npx jest --selectProjects app`
Expected: PASS for the whole app project, old and new tests.

- [ ] **Step 7: Commit**

```bash
git add jest.config.js projects/app/src/app/app.config.ts projects/app/src/app/app.ts projects/app/src/app/app.html projects/app/src/app/app.css projects/app/src/app/app.spec.ts projects/app/src/app/auth
git commit -m "feat(app): AuthService over the auth API and an account menu in the toolbar

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Sign In, Create Account and Play as Guest screens

**Files:**
- Create:
  - `projects/app/src/app/auth/return-url.ts`
  - `projects/app/src/app/auth/auth-card.css`
  - `projects/app/src/app/auth/sign-in.ts`
  - `projects/app/src/app/auth/sign-up.ts`
  - `projects/app/src/app/auth/guest.ts`
- Modify: `projects/app/src/app/app.routes.ts`
- Test:
  - `projects/app/src/app/auth/return-url.spec.ts`
  - `projects/app/src/app/auth/sign-in.spec.ts`
  - `projects/app/src/app/auth/sign-up.spec.ts`
  - `projects/app/src/app/auth/guest.spec.ts`

**Interfaces:**
- Consumes: from Task 8, `AuthService` and `ApiError`; from `protocol`, `ERROR_MESSAGES`, `DISPLAY_NAME_MAX`, `PASSWORD_MAX`, `EMAIL_MAX` and `PASSWORD_MIN`.
- Produces:
  - `safeReturnUrl(raw: string | null): string` and `returnUrlParams(raw: string | null): Record<string, string>`
  - the components `SignIn`, `SignUp` and `PlayAsGuest`, each with public signals for their fields, `error: Signal<string | null>`, `busy`, and `submit(): Promise<void>`
  - the routes `/sign-in`, `/sign-up` and `/guest`

- [ ] **Step 1: Write the failing tests**

`projects/app/src/app/auth/return-url.spec.ts`:

```ts
import { returnUrlParams, safeReturnUrl } from './return-url';

describe('safeReturnUrl', () => {
  it('keeps an in-app path', () => {
    expect(safeReturnUrl('/game?x=1')).toBe('/game?x=1');
  });

  it('falls back to Setup for nothing, an absolute URL or a protocol-relative one', () => {
    expect(safeReturnUrl(null)).toBe('/setup');
    expect(safeReturnUrl('https://evil.example')).toBe('/setup');
    expect(safeReturnUrl('//evil.example')).toBe('/setup');
    expect(safeReturnUrl('/\\evil.example')).toBe('/setup');
  });

  it('carries only a safe returnUrl between auth screens', () => {
    expect(returnUrlParams('/game')).toEqual({ returnUrl: '/game' });
    expect(returnUrlParams('//evil.example')).toEqual({});
    expect(returnUrlParams(null)).toEqual({});
  });
});
```

`projects/app/src/app/auth/sign-in.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { ApiError, AuthService } from './auth.service';
import { SignIn } from './sign-in';

const ANN = { id: 'u1', kind: 'registered' as const, displayName: 'Ann', email: 'ann@example.com' };

describe('SignIn', () => {
  const auth = { signIn: jest.fn() };

  async function create(url = '/sign-in') {
    await TestBed.configureTestingModule({
      imports: [SignIn],
      providers: [
        { provide: AuthService, useValue: auth },
        provideRouter([
          { path: 'sign-in', component: SignIn },
          { path: 'setup', children: [] },
          { path: 'game', children: [] },
        ]),
      ],
    }).compileComponents();
    await TestBed.inject(Router).navigateByUrl(url);
    const fixture = TestBed.createComponent(SignIn);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, el: fixture.nativeElement as HTMLElement, router: TestBed.inject(Router) };
  }

  beforeEach(() => auth.signIn.mockReset());

  it('has the Sign In title, fields and links', async () => {
    const { el } = await create();
    expect(el.querySelector('mat-card-title')?.textContent).toContain('Sign In');
    expect(el.querySelector('input.email')).not.toBeNull();
    expect(el.querySelector('input.password')?.getAttribute('type')).toBe('password');
    const links = [...el.querySelectorAll('.links a')].map((a) => a.textContent?.trim());
    expect(links).toEqual(['Forgot Password', 'Create Account', 'Play as Guest']);
  });

  it('signs in with the trimmed email, typed through the form, then goes to Setup', async () => {
    auth.signIn.mockResolvedValue(ANN);
    const { fixture, el, router } = await create();
    const navigate = jest.spyOn(router, 'navigateByUrl');
    const email = el.querySelector('input.email') as HTMLInputElement;
    const password = el.querySelector('input.password') as HTMLInputElement;
    email.value = ' ann@example.com ';
    email.dispatchEvent(new Event('input'));
    password.value = 'secret-pass';
    password.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (el.querySelector('button.submit') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(auth.signIn).toHaveBeenCalledWith({ email: 'ann@example.com', password: 'secret-pass' });
    expect(navigate).toHaveBeenCalledWith('/setup');
  });

  it('returns to a safe returnUrl after signing in', async () => {
    auth.signIn.mockResolvedValue(ANN);
    const { component, router } = await create('/sign-in?returnUrl=%2Fgame');
    const navigate = jest.spyOn(router, 'navigateByUrl');
    component.email.set('ann@example.com');
    component.password.set('secret-pass');
    await component.submit();
    expect(navigate).toHaveBeenCalledWith('/game');
  });

  it("shows the server's message when sign-in fails", async () => {
    auth.signIn.mockRejectedValue(new ApiError('invalid_credentials', 'Email or password is incorrect', 401));
    const { fixture, component, el } = await create();
    component.email.set('ann@example.com');
    component.password.set('wrong-pass');
    await component.submit();
    fixture.detectChanges();
    expect(el.querySelector('.error')?.textContent).toContain('Email or password is incorrect');
    expect(component.busy()).toBe(false);
  });

  it('does not submit with an empty field', async () => {
    const { fixture, component, el } = await create();
    component.email.set('ann@example.com');
    fixture.detectChanges();
    expect((el.querySelector('button.submit') as HTMLButtonElement).disabled).toBe(true);
    await component.submit();
    expect(auth.signIn).not.toHaveBeenCalled();
  });
});
```

`projects/app/src/app/auth/sign-up.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { ApiError, AuthService } from './auth.service';
import { SignUp } from './sign-up';

describe('SignUp', () => {
  const auth = { signUp: jest.fn() };

  async function create() {
    await TestBed.configureTestingModule({
      imports: [SignUp],
      providers: [{ provide: AuthService, useValue: auth }, provideRouter([{ path: 'setup', children: [] }])],
    }).compileComponents();
    const fixture = TestBed.createComponent(SignUp);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, el: fixture.nativeElement as HTMLElement, router: TestBed.inject(Router) };
  }

  beforeEach(() => auth.signUp.mockReset());

  it('has the Create Account title and the three fields', async () => {
    const { el } = await create();
    expect(el.querySelector('mat-card-title')?.textContent).toContain('Create Account');
    const labels = [...el.querySelectorAll('mat-label')].map((l) => l.textContent?.trim());
    expect(labels).toEqual(['Email', 'Password', 'Your Name']);
    expect(el.querySelector('.password-hint')?.textContent).toContain('At least 8 characters');
  });

  it('creates the account and goes to Setup', async () => {
    auth.signUp.mockResolvedValue({ id: 'u1', kind: 'registered', displayName: 'Ann', email: 'ann@example.com' });
    const { component, router } = await create();
    const navigate = jest.spyOn(router, 'navigateByUrl');
    component.email.set(' ann@example.com ');
    component.password.set('secret-pass');
    component.displayName.set('Ann');
    await component.submit();
    expect(auth.signUp).toHaveBeenCalledWith({ email: 'ann@example.com', password: 'secret-pass', displayName: 'Ann' });
    expect(navigate).toHaveBeenCalledWith('/setup');
  });

  it("shows the server's message for a taken email", async () => {
    auth.signUp.mockRejectedValue(new ApiError('email_taken', 'That email already has an account', 409));
    const { fixture, component, el } = await create();
    component.email.set('ann@example.com');
    component.password.set('secret-pass');
    component.displayName.set('Ann');
    await component.submit();
    fixture.detectChanges();
    expect(el.querySelector('.error')?.textContent).toContain('That email already has an account');
  });
});
```

`projects/app/src/app/auth/guest.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { ApiError, AuthService } from './auth.service';
import { PlayAsGuest } from './guest';

describe('PlayAsGuest', () => {
  const auth = { playAsGuest: jest.fn() };

  async function create() {
    await TestBed.configureTestingModule({
      imports: [PlayAsGuest],
      providers: [{ provide: AuthService, useValue: auth }, provideRouter([{ path: 'setup', children: [] }])],
    }).compileComponents();
    const fixture = TestBed.createComponent(PlayAsGuest);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, el: fixture.nativeElement as HTMLElement, router: TestBed.inject(Router) };
  }

  beforeEach(() => auth.playAsGuest.mockReset());

  it('warns that a guest seat lives in this browser only', async () => {
    const { el } = await create();
    expect(el.querySelector('mat-card-title')?.textContent).toContain('Play as Guest');
    expect(el.querySelector('.hint')?.textContent).toContain("Playing as a guest: if you clear your browser data you can't return to this game");
  });

  it('plays as a guest with the given name and goes to Setup', async () => {
    auth.playAsGuest.mockResolvedValue({ id: 'u2', kind: 'guest', displayName: 'Zhou Yu' });
    const { component, router } = await create();
    const navigate = jest.spyOn(router, 'navigateByUrl');
    component.displayName.set('Zhou Yu');
    await component.submit();
    expect(auth.playAsGuest).toHaveBeenCalledWith({ displayName: 'Zhou Yu' });
    expect(navigate).toHaveBeenCalledWith('/setup');
  });

  it("shows the server's message for a rejected name", async () => {
    auth.playAsGuest.mockRejectedValue(new ApiError('invalid_name', 'Names need 1 to 24 characters', 400));
    const { fixture, component, el } = await create();
    component.displayName.set('x');
    await component.submit();
    fixture.detectChanges();
    expect(el.querySelector('.error')?.textContent).toContain('Names need 1 to 24 characters');
  });
});
```

Run: `npx jest --selectProjects app auth/`
Expected: FAIL, with "Cannot find module" for `./return-url`, `./sign-in`, `./sign-up` and `./guest`.

- [ ] **Step 2: Write the helpers and the shared styles**

`projects/app/src/app/auth/return-url.ts`:

```ts
// Where to go after signing in: the `returnUrl` query parameter when it is a
// path inside the app, otherwise Setup. Anything else could send the user to
// another site (an open redirect).
export function safeReturnUrl(raw: string | null): string {
  return raw && raw.startsWith('/') && !raw.startsWith('//') && !raw.startsWith('/\\') ? raw : '/setup';
}

// Query params that carry a safe returnUrl from one auth screen to another.
export function returnUrlParams(raw: string | null): Record<string, string> {
  const url = safeReturnUrl(raw);
  return raw && url === raw ? { returnUrl: url } : {};
}
```

`projects/app/src/app/auth/auth-card.css`:

```css
.auth-page {
  /* Full-bleed like Setup: cancel the app shell's content padding. */
  margin: 0 -16px -16px;
  min-height: calc(100vh - 64px);
  display: grid;
  place-items: center;
  padding: 24px 16px;
  box-sizing: border-box;
  background: var(--mat-sys-surface-container-low);
}
.auth-card {
  width: min(100%, 420px);
}
mat-card-header {
  padding-top: 20px;
}
form {
  display: flex;
  flex-direction: column;
  padding-top: 16px;
}
.error {
  color: var(--mat-sys-error);
  font: var(--mat-sys-body-medium);
  margin: 0 0 12px;
}
.hint,
.password-hint {
  color: var(--mat-sys-on-surface-variant);
  font: var(--mat-sys-body-small);
  margin: 0 0 16px;
}
.submit {
  align-self: flex-end;
  padding: 0 24px;
}
.links {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin-top: 16px;
  font: var(--mat-sys-body-medium);
}
.links a {
  color: var(--mat-sys-primary);
}
```

- [ ] **Step 3: Write the three screens**

`projects/app/src/app/auth/sign-in.ts`:

```ts
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { EMAIL_MAX, ERROR_MESSAGES, PASSWORD_MAX } from 'protocol';
import { ApiError, AuthService } from './auth.service';
import { returnUrlParams, safeReturnUrl } from './return-url';

@Component({
  selector: 'app-sign-in',
  imports: [RouterLink, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule],
  styleUrl: './auth-card.css',
  template: `
    <div class="auth-page">
      <mat-card class="auth-card" appearance="raised">
        <mat-card-header><mat-card-title>Sign In</mat-card-title></mat-card-header>
        <mat-card-content>
          <form (submit)="$event.preventDefault(); submit()">
            <mat-form-field appearance="outline">
              <mat-label>Email</mat-label>
              <input matInput class="email" type="email" autocomplete="email" [maxlength]="emailMax" [value]="email()" (input)="email.set($any($event.target).value)" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Password</mat-label>
              <input matInput class="password" type="password" autocomplete="current-password" [maxlength]="passwordMax" [value]="password()" (input)="password.set($any($event.target).value)" />
            </mat-form-field>
            @if (error()) {
              <p class="error" role="alert">{{ error() }}</p>
            }
            <button mat-flat-button class="submit" type="submit" [disabled]="busy() || !canSubmit()">Sign In</button>
          </form>
          <div class="links">
            <a routerLink="/forgot-password">Forgot Password</a>
            <a routerLink="/sign-up" [queryParams]="returnParams">Create Account</a>
            <a routerLink="/guest" [queryParams]="returnParams">Play as Guest</a>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
})
export class SignIn {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly returnUrl = inject(ActivatedRoute).snapshot.queryParamMap.get('returnUrl');
  protected readonly returnParams = returnUrlParams(this.returnUrl);
  protected readonly emailMax = EMAIL_MAX;
  protected readonly passwordMax = PASSWORD_MAX;

  readonly email = signal('');
  readonly password = signal('');
  readonly error = signal<string | null>(null);
  readonly busy = signal(false);
  protected readonly canSubmit = computed(() => this.email().trim() !== '' && this.password() !== '');

  async submit(): Promise<void> {
    if (this.busy() || !this.canSubmit()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.auth.signIn({ email: this.email().trim(), password: this.password() });
      await this.router.navigateByUrl(safeReturnUrl(this.returnUrl));
    } catch (err) {
      this.error.set(err instanceof ApiError ? err.message : ERROR_MESSAGES.internal);
    } finally {
      this.busy.set(false);
    }
  }
}
```

`projects/app/src/app/auth/sign-up.ts`:

```ts
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { DISPLAY_NAME_MAX, EMAIL_MAX, ERROR_MESSAGES, PASSWORD_MAX, PASSWORD_MIN } from 'protocol';
import { ApiError, AuthService } from './auth.service';
import { returnUrlParams, safeReturnUrl } from './return-url';

@Component({
  selector: 'app-sign-up',
  imports: [RouterLink, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule],
  styleUrl: './auth-card.css',
  template: `
    <div class="auth-page">
      <mat-card class="auth-card" appearance="raised">
        <mat-card-header><mat-card-title>Create Account</mat-card-title></mat-card-header>
        <mat-card-content>
          <form (submit)="$event.preventDefault(); submit()">
            <mat-form-field appearance="outline">
              <mat-label>Email</mat-label>
              <input matInput class="email" type="email" autocomplete="email" [maxlength]="emailMax" [value]="email()" (input)="email.set($any($event.target).value)" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Password</mat-label>
              <input matInput class="password" type="password" autocomplete="new-password" [maxlength]="passwordMax" [value]="password()" (input)="password.set($any($event.target).value)" />
            </mat-form-field>
            <p class="password-hint">At least {{ passwordMin }} characters</p>
            <mat-form-field appearance="outline">
              <mat-label>Your Name</mat-label>
              <input matInput class="name" autocomplete="nickname" [maxlength]="nameMax" [value]="displayName()" (input)="displayName.set($any($event.target).value)" />
            </mat-form-field>
            @if (error()) {
              <p class="error" role="alert">{{ error() }}</p>
            }
            <button mat-flat-button class="submit" type="submit" [disabled]="busy() || !canSubmit()">Create Account</button>
          </form>
          <div class="links">
            <a routerLink="/sign-in" [queryParams]="returnParams">Sign In</a>
            <a routerLink="/guest" [queryParams]="returnParams">Play as Guest</a>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
})
export class SignUp {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly returnUrl = inject(ActivatedRoute).snapshot.queryParamMap.get('returnUrl');
  protected readonly returnParams = returnUrlParams(this.returnUrl);
  protected readonly emailMax = EMAIL_MAX;
  protected readonly passwordMax = PASSWORD_MAX;
  protected readonly passwordMin = PASSWORD_MIN;
  protected readonly nameMax = DISPLAY_NAME_MAX;

  readonly email = signal('');
  readonly password = signal('');
  readonly displayName = signal('');
  readonly error = signal<string | null>(null);
  readonly busy = signal(false);
  protected readonly canSubmit = computed(() => this.email().trim() !== '' && this.password() !== '' && this.displayName().trim() !== '');

  async submit(): Promise<void> {
    if (this.busy() || !this.canSubmit()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.auth.signUp({ email: this.email().trim(), password: this.password(), displayName: this.displayName() });
      await this.router.navigateByUrl(safeReturnUrl(this.returnUrl));
    } catch (err) {
      this.error.set(err instanceof ApiError ? err.message : ERROR_MESSAGES.internal);
    } finally {
      this.busy.set(false);
    }
  }
}
```

`projects/app/src/app/auth/guest.ts`:

```ts
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { DISPLAY_NAME_MAX, ERROR_MESSAGES } from 'protocol';
import { ApiError, AuthService } from './auth.service';
import { returnUrlParams, safeReturnUrl } from './return-url';

@Component({
  selector: 'app-play-as-guest',
  imports: [RouterLink, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule],
  styleUrl: './auth-card.css',
  template: `
    <div class="auth-page">
      <mat-card class="auth-card" appearance="raised">
        <mat-card-header><mat-card-title>Play as Guest</mat-card-title></mat-card-header>
        <mat-card-content>
          <form (submit)="$event.preventDefault(); submit()">
            <mat-form-field appearance="outline">
              <mat-label>Your Name</mat-label>
              <input matInput class="name" autocomplete="nickname" [maxlength]="nameMax" [value]="displayName()" (input)="displayName.set($any($event.target).value)" />
            </mat-form-field>
            <p class="hint">Playing as a guest: if you clear your browser data you can't return to this game</p>
            @if (error()) {
              <p class="error" role="alert">{{ error() }}</p>
            }
            <button mat-flat-button class="submit" type="submit" [disabled]="busy() || !canSubmit()">Play as Guest</button>
          </form>
          <div class="links">
            <a routerLink="/sign-in" [queryParams]="returnParams">Sign In</a>
            <a routerLink="/sign-up" [queryParams]="returnParams">Create Account</a>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
})
export class PlayAsGuest {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly returnUrl = inject(ActivatedRoute).snapshot.queryParamMap.get('returnUrl');
  protected readonly returnParams = returnUrlParams(this.returnUrl);
  protected readonly nameMax = DISPLAY_NAME_MAX;

  readonly displayName = signal('');
  readonly error = signal<string | null>(null);
  readonly busy = signal(false);
  protected readonly canSubmit = computed(() => this.displayName().trim() !== '');

  async submit(): Promise<void> {
    if (this.busy() || !this.canSubmit()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.auth.playAsGuest({ displayName: this.displayName() });
      await this.router.navigateByUrl(safeReturnUrl(this.returnUrl));
    } catch (err) {
      this.error.set(err instanceof ApiError ? err.message : ERROR_MESSAGES.internal);
    } finally {
      this.busy.set(false);
    }
  }
}
```

- [ ] **Step 4: Add the routes**

In `projects/app/src/app/app.routes.ts`, add these three entries before the `''` redirect:

```ts
  { path: 'sign-in', loadComponent: () => import('./auth/sign-in').then((m) => m.SignIn) },
  { path: 'sign-up', loadComponent: () => import('./auth/sign-up').then((m) => m.SignUp) },
  { path: 'guest', loadComponent: () => import('./auth/guest').then((m) => m.PlayAsGuest) },
```

- [ ] **Step 5: Run the app tests**

Run: `npx jest --selectProjects app`
Expected: PASS for the whole app project.

- [ ] **Step 6: Commit**

```bash
git add projects/app/src/app/auth projects/app/src/app/app.routes.ts
git commit -m "feat(app): Sign In, Create Account and Play as Guest screens

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Forgot Password and Reset Password screens

**Files:**
- Create: `projects/app/src/app/auth/forgot-password.ts`, `projects/app/src/app/auth/reset-password.ts`
- Modify: `projects/app/src/app/app.routes.ts`
- Test: `projects/app/src/app/auth/forgot-password.spec.ts`, `projects/app/src/app/auth/reset-password.spec.ts`

**Interfaces:**
- Consumes:
  - from Task 8: `AuthService.forgotPassword` and `AuthService.resetPassword`, plus `ApiError`
  - from Task 9: `auth-card.css`
  - from `protocol`: `ERROR_MESSAGES`, `EMAIL_MAX`, `PASSWORD_MAX` and `PASSWORD_MIN`
- Produces:
  - the component `ForgotPassword`, with the signals `email`, `sentMessage`, `error` and `busy`, and `submit()`
  - the component `ResetPassword`, with the signals `password`, `error` and `busy`, the field `token: string | null`, and `submit()`
  - the routes `/forgot-password` and `/reset-password`

- [ ] **Step 1: Write the failing tests**

`projects/app/src/app/auth/forgot-password.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ApiError, AuthService } from './auth.service';
import { ForgotPassword } from './forgot-password';

describe('ForgotPassword', () => {
  const auth = { forgotPassword: jest.fn() };

  async function create() {
    await TestBed.configureTestingModule({
      imports: [ForgotPassword],
      providers: [{ provide: AuthService, useValue: auth }, provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(ForgotPassword);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
  }

  beforeEach(() => auth.forgotPassword.mockReset());

  it('sends the trimmed email and shows the server message in place of the form', async () => {
    auth.forgotPassword.mockResolvedValue('If that email has an account, we sent a link');
    const { fixture, component, el } = await create();
    expect(el.querySelector('mat-card-title')?.textContent).toContain('Forgot Password');
    component.email.set(' ann@example.com ');
    await component.submit();
    fixture.detectChanges();
    expect(auth.forgotPassword).toHaveBeenCalledWith({ email: 'ann@example.com' });
    expect(el.querySelector('.sent')?.textContent).toContain('If that email has an account, we sent a link');
    expect(el.querySelector('form')).toBeNull();
    expect(el.querySelector('.links a')?.textContent).toContain('Back to Sign In');
  });

  it("shows the server's message when rate limited", async () => {
    auth.forgotPassword.mockRejectedValue(new ApiError('rate_limited', 'Too many attempts. Wait a few minutes and try again', 429));
    const { fixture, component, el } = await create();
    component.email.set('ann@example.com');
    await component.submit();
    fixture.detectChanges();
    expect(el.querySelector('.error')?.textContent).toContain('Too many attempts');
    expect(el.querySelector('form')).not.toBeNull();
  });
});
```

`projects/app/src/app/auth/reset-password.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { ApiError, AuthService } from './auth.service';
import { ResetPassword } from './reset-password';

describe('ResetPassword', () => {
  const auth = { resetPassword: jest.fn() };

  async function create(url: string) {
    await TestBed.configureTestingModule({
      imports: [ResetPassword],
      providers: [
        { provide: AuthService, useValue: auth },
        provideRouter([
          { path: 'reset-password', component: ResetPassword },
          { path: 'setup', children: [] },
        ]),
      ],
    }).compileComponents();
    const router = TestBed.inject(Router);
    await router.navigateByUrl(url);
    const fixture = TestBed.createComponent(ResetPassword);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, el: fixture.nativeElement as HTMLElement, router };
  }

  beforeEach(() => auth.resetPassword.mockReset());

  it('sets the new password with the token from the link, then goes to Setup', async () => {
    auth.resetPassword.mockResolvedValue({ id: 'u1', kind: 'registered', displayName: 'Ann', email: 'ann@example.com' });
    const { component, el, router } = await create('/reset-password?token=abc-123');
    expect(el.querySelector('mat-card-title')?.textContent).toContain('Reset Password');
    expect(el.querySelector('mat-label')?.textContent).toContain('New Password');
    const navigate = jest.spyOn(router, 'navigateByUrl');
    component.password.set('brand-new-pass');
    await component.submit();
    expect(auth.resetPassword).toHaveBeenCalledWith({ token: 'abc-123', password: 'brand-new-pass' });
    expect(navigate).toHaveBeenCalledWith('/setup');
  });

  it('without a token, says the link is invalid and offers Forgot Password', async () => {
    const { el } = await create('/reset-password');
    expect(el.querySelector('.error')?.textContent).toContain('This reset link is invalid or has expired');
    expect(el.querySelector('form')).toBeNull();
    expect(el.querySelector('.links a')?.textContent).toContain('Forgot Password');
  });

  it("shows the server's message for a used or expired link", async () => {
    auth.resetPassword.mockRejectedValue(new ApiError('invalid_reset_token', 'This reset link is invalid or has expired', 400));
    const { fixture, component, el } = await create('/reset-password?token=old');
    component.password.set('brand-new-pass');
    await component.submit();
    fixture.detectChanges();
    expect(el.querySelector('.error')?.textContent).toContain('This reset link is invalid or has expired');
  });
});
```

Run: `npx jest --selectProjects app forgot-password reset-password`
Expected: FAIL, with "Cannot find module" for `./forgot-password` and `./reset-password`.

- [ ] **Step 2: Write the two screens**

`projects/app/src/app/auth/forgot-password.ts`:

```ts
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { EMAIL_MAX, ERROR_MESSAGES } from 'protocol';
import { ApiError, AuthService } from './auth.service';

@Component({
  selector: 'app-forgot-password',
  imports: [RouterLink, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule],
  styleUrl: './auth-card.css',
  template: `
    <div class="auth-page">
      <mat-card class="auth-card" appearance="raised">
        <mat-card-header><mat-card-title>Forgot Password</mat-card-title></mat-card-header>
        <mat-card-content>
          @if (sentMessage(); as message) {
            <p class="sent hint" role="status">{{ message }}</p>
          } @else {
            <form (submit)="$event.preventDefault(); submit()">
              <mat-form-field appearance="outline">
                <mat-label>Email</mat-label>
                <input matInput class="email" type="email" autocomplete="email" [maxlength]="emailMax" [value]="email()" (input)="email.set($any($event.target).value)" />
              </mat-form-field>
              @if (error()) {
                <p class="error" role="alert">{{ error() }}</p>
              }
              <button mat-flat-button class="submit" type="submit" [disabled]="busy() || !canSubmit()">Send Reset Link</button>
            </form>
          }
          <div class="links">
            <a routerLink="/sign-in">Back to Sign In</a>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
})
export class ForgotPassword {
  private readonly auth = inject(AuthService);
  protected readonly emailMax = EMAIL_MAX;

  readonly email = signal('');
  readonly sentMessage = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly busy = signal(false);
  protected readonly canSubmit = computed(() => this.email().trim() !== '');

  async submit(): Promise<void> {
    if (this.busy() || !this.canSubmit()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      this.sentMessage.set(await this.auth.forgotPassword({ email: this.email().trim() }));
    } catch (err) {
      this.error.set(err instanceof ApiError ? err.message : ERROR_MESSAGES.internal);
    } finally {
      this.busy.set(false);
    }
  }
}
```

`projects/app/src/app/auth/reset-password.ts`:

```ts
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ERROR_MESSAGES, PASSWORD_MAX, PASSWORD_MIN } from 'protocol';
import { ApiError, AuthService } from './auth.service';

// Opened from the emailed link: /reset-password?token=…
@Component({
  selector: 'app-reset-password',
  imports: [RouterLink, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule],
  styleUrl: './auth-card.css',
  template: `
    <div class="auth-page">
      <mat-card class="auth-card" appearance="raised">
        <mat-card-header><mat-card-title>Reset Password</mat-card-title></mat-card-header>
        <mat-card-content>
          @if (token) {
            <form (submit)="$event.preventDefault(); submit()">
              <mat-form-field appearance="outline">
                <mat-label>New Password</mat-label>
                <input matInput class="password" type="password" autocomplete="new-password" [maxlength]="passwordMax" [value]="password()" (input)="password.set($any($event.target).value)" />
              </mat-form-field>
              <p class="password-hint">At least {{ passwordMin }} characters</p>
              @if (error()) {
                <p class="error" role="alert">{{ error() }}</p>
              }
              <button mat-flat-button class="submit" type="submit" [disabled]="busy() || !canSubmit()">Set Password</button>
            </form>
          } @else {
            <p class="error" role="alert">{{ invalidLink }}</p>
          }
          <div class="links">
            <a routerLink="/forgot-password">Forgot Password</a>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
})
export class ResetPassword {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly token = inject(ActivatedRoute).snapshot.queryParamMap.get('token');
  protected readonly invalidLink = ERROR_MESSAGES.invalid_reset_token;
  protected readonly passwordMax = PASSWORD_MAX;
  protected readonly passwordMin = PASSWORD_MIN;

  readonly password = signal('');
  readonly error = signal<string | null>(null);
  readonly busy = signal(false);
  protected readonly canSubmit = computed(() => this.password() !== '');

  async submit(): Promise<void> {
    if (!this.token || this.busy() || !this.canSubmit()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.auth.resetPassword({ token: this.token, password: this.password() });
      await this.router.navigateByUrl('/setup');
    } catch (err) {
      this.error.set(err instanceof ApiError ? err.message : ERROR_MESSAGES.internal);
    } finally {
      this.busy.set(false);
    }
  }
}
```

- [ ] **Step 3: Add the routes**

In `projects/app/src/app/app.routes.ts`, add these after the `guest` route:

```ts
  { path: 'forgot-password', loadComponent: () => import('./auth/forgot-password').then((m) => m.ForgotPassword) },
  { path: 'reset-password', loadComponent: () => import('./auth/reset-password').then((m) => m.ResetPassword) },
```

- [ ] **Step 4: Run the whole suite, the type check and the app build**

Run: `npx jest && npm run typecheck:server && npx ng build app --configuration development`
Expected: every Jest project passes, with the Postgres suite skipped unless you ran `npm run test:db`. The type check is clean, and the app builds without errors.

- [ ] **Step 5: Commit**

```bash
git add projects/app/src/app/auth projects/app/src/app/app.routes.ts
git commit -m "feat(app): Forgot Password and Reset Password screens

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Manual check after the last task (executor, before the final review)

With Docker running:

1. Run `npm run db:up`, `cp .env.example .env`, then `npm run server`. Separately, run `npm start`.
2. In the browser at http://localhost:4200, check these:
   - Create Account signs you in and the toolbar shows your name.
   - Sign Out returns you to Setup with Sign In showing.
   - Sign In with the wrong password shows "Email or password is incorrect".
   - Forgot Password prints a `[mail] Password reset …` line in the server log. Its link opens Reset Password, and setting a password signs you in.
   - Play as Guest shows the guest hint, and the account menu says "Playing as a guest".
3. Run `npm run test:db`. Both contract suites must pass.

Report any step that could not be run (for example, Docker unavailable) as not run.
