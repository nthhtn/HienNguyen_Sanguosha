# Google Sign-In Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** "Continue with Google" on Sign In and Sign Up, with first-time Google users created signed in, existing password accounts never linked, and a Set Password action for Google-only accounts.

**Architecture:** A server-side authorization code flow with PKCE. `GET /api/auth/google/start` redirects to Google with state, nonce and a code challenge kept in a short-lived cookie. `GET /api/auth/google/callback` exchanges the code through a `GoogleClient`, checks the ID token claims, and calls `AccountService.signInWithGoogle`, which signs in a known identity, refuses an email that has a password account, or creates a user. Tests use a fake `GoogleClient`, plus one test of the real client against a local fake Google.

**Tech Stack:** TypeScript, Fastify with `@fastify/cookie`, Kysely and Postgres, `fetch` and `node:crypto` (no new dependency), Typebox schemas in `projects/protocol`, Angular standalone components, Jest.

**Spec:** `docs/superpowers/specs/2026-11-27-google-signin-design.md`

## Global Constraints

- **No new dependency:** Use `fetch` and `node:crypto`.
- **PKCE:** `code_challenge_method=S256`. **Scope:** `openid email profile`. **`response_type`:** `code`.
- **Authorization endpoint:** `https://accounts.google.com/o/oauth2/v2/auth`. **Token endpoint:** `https://oauth2.googleapis.com/token`. Both configurable for tests.
- **Redirect URI:** `${PUBLIC_ORIGIN}/api/auth/google/callback`.
- **Cookie `sgs_oauth`:** HttpOnly, `SameSite=Lax`, path `/api/auth/google`, 10 minutes, `Secure` by the same rule as the session cookie.
- **ID token checks:** `iss` is `https://accounts.google.com` or `accounts.google.com`; `aud` equals the client id; `exp` is in the future; `nonce` equals the stored one; `sub` is a non-empty string; `email` is a string; `email_verified` is `true`. No signature check (the token comes straight from the token endpoint over TLS).
- **Error redirect codes:** `google_failed`, `google_cancelled`, `google_unverified`, `google_email_in_use`, sent to `/sign-in?error=<code>` and keeping the original `returnUrl`.
- **Return URL:** Accepted only when it starts with `/`, not `//`, with no backslash. Anything else becomes `/`.
- **Display name:** Google `name` through `normalizeDisplayName`, cut to `DISPLAY_NAME_MAX`; else the part of the email before `@` the same way; else `Player`.
- **Config:** `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, both or neither (one alone is a `ConfigError`).
- **Limiter:** 30 per 15 minutes per IP on both Google routes.
- **Secrets:** The client secret is never in a redirect URL, a response, or a log line.
- **UI text:** Title Case for labels and buttons, sentence case for messages (see `CLAUDE.md`). English and Vietnamese, Vietnamese as draft.
- **Docs:** Capitalize every sentence, list item and table cell. Bullets over long paragraphs.
- **Local screens:** Do not modify Setup or Game.
- **Checks:** `npm test`, `npm run test:db` (Postgres on 5433, `TEST_DATABASE_URL=postgres://sanguosha:sanguosha@localhost:5433/postgres`) and `npm run verify` pass before the last commit.

## Review Focus

- **Missing or mismatched state:** The callback refuses, creates no user, no identity and no session. Pinned in Task 6.
- **Typed password on a Google-only account:** Refused, including the dummy password. Pinned in Task 2.
- **Google email that has a password account:** Refused with `google_email_in_use`; no identity, no new session, the old session untouched. Pinned in Tasks 5 and 6.
- **Open redirect:** `//evil.example`, `/\evil.example`, `https://evil.example` and `javascript:alert(1)` as `returnUrl` all become `/`. Pinned in Task 6.
- **Unverified Google email, or a wrong `aud`, `iss`, `nonce` or expired token:** Refused. Pinned in Task 4.
- **Two concurrent first sign-ins for one Google account:** One user and one identity. Pinned in Task 5.
- **Secret leakage:** The authorize URL and the logs never contain the client secret. Pinned in Task 4.

## File Structure

- **Create** `projects/server/src/persistence/migrations/0008_identities.ts`.
- **Modify** `persistence/records.ts`, `repositories.ts`, `postgres/schema.ts`, `postgres/mappers.ts`, `postgres/postgresRepositories.ts`, `memory/memoryRepositories.ts`, `repositoryContract.ts`, `migrate.ts`.
- **Create** `projects/server/src/auth/google.ts` (client, claims, name rule) and `projects/server/src/http/googleRoutes.ts` (routes, cookie, return path), each with a spec.
- **Modify** `config.ts`, `auth/accounts.ts`, `auth/rateLimits.ts`, `http/session.ts`, `http/authRoutes.ts`, `http/app.ts`, `server.ts`, `views/me.ts`, `profile/profileService.ts`, `http/profileRoutes.ts`.
- **Modify** `projects/protocol/src/auth.ts`, `schemas/auth.ts`, `schemas/profile.ts`, `profile.ts`.
- **Modify** under `projects/app/src/app/`: `auth/auth.service.ts`, `auth/sign-in.ts`, `auth/sign-up.ts`, `profile/profile-settings.ts`, `profile/profile.service.ts`, `i18n/en.ts`, `i18n/vi.ts`, with specs.

---

### Task 1: Protocol changes

**Files:**
- Modify: `projects/protocol/src/auth.ts`, `projects/protocol/src/schemas/auth.ts`, `projects/protocol/src/profile.ts`, `projects/protocol/src/schemas/profile.ts`, `projects/protocol/src/schemas/profile.spec.ts`, `projects/protocol/src/schemas/auth.spec.ts`

**Interfaces:**
- Produces: `Me` gains `hasPassword?: boolean` (present for registered users); `MeSchema` gains `hasPassword: Type.Optional(Type.Boolean())`; `ChangePasswordBody.currentPassword` becomes optional (`currentPassword?: string`) and `ChangePasswordBodySchema.currentPassword` becomes `Type.Optional(...)` with the same bounds; `AuthProviders` is `{ google: boolean }` with `AuthProvidersSchema`.

- [ ] **Step 1: Write failing tests.** In `profile.spec.ts`: `ChangePasswordBodySchema accepts a body without currentPassword` and still rejects one without `newPassword`. In `auth.spec.ts`: `MeSchema accepts hasPassword true and false` and `AuthProvidersSchema accepts { google: true }`.
- [ ] **Step 2: Run** `npx jest projects/protocol`. Expected: FAIL.
- [ ] **Step 3: Implement** the type and schema changes above.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(protocol): hasPassword, optional current password, auth providers`.

### Task 2: Sign-in never matches a missing password

**Files:**
- Modify: `projects/server/src/auth/accounts.ts`, `projects/server/src/auth/accounts.spec.ts`

**Interfaces:**
- Produces: `AccountService.signIn` throws `AuthError('invalid_credentials')` for any user whose `passwordHash` is null, whatever password is typed.

- [ ] **Step 1: Write the failing test** in `accounts.spec.ts`: `a registered user with no password hash cannot sign in, not even with the password the dummy hash was made from`. Create the user through `repos.users.createRegistered` with a placeholder hash, then set it to null with the in-memory store (add a test helper if none exists), and assert `signIn({ email, password: 'no-such-account-password' })` rejects with `invalid_credentials`. If the in-memory store cannot hold a null hash for a registered user, build this test after Task 3 and move it there.
- [ ] **Step 2: Run** `npx jest projects/server/src/auth/accounts.spec.ts`. Expected: FAIL (signs in).
- [ ] **Step 3: Implement:** in `signIn`, reject when `!user?.passwordHash`, after the dummy comparison so timing stays equal.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `fix(server): a user with no password hash never signs in with a password`.

### Task 3: Identities storage

**Files:**
- Create: `projects/server/src/persistence/migrations/0008_identities.ts`
- Modify: `records.ts`, `repositories.ts`, `migrate.ts`, `postgres/schema.ts`, `postgres/mappers.ts`, `postgres/postgresRepositories.ts`, `memory/memoryRepositories.ts`, `repositoryContract.ts`

**Interfaces:**
- Produces in `records.ts`: `interface IdentityRecord { id: string; userId: string; provider: 'google'; providerUserId: string; email: string; createdAt: Date }`.
- Produces in `repositories.ts`:
  - `class IdentityTakenError extends Error`.
  - `interface IdentityRepository { findByProviderUser(provider: 'google', providerUserId: string): Promise<IdentityRecord | null>; create(input: { userId: string; provider: 'google'; providerUserId: string; email: string; now: Date }): Promise<IdentityRecord> }` (throws `IdentityTakenError` for a taken `(provider, providerUserId)` or a second identity of one provider for one user).
  - `UserRepository.createFromGoogle(input: { email: string; displayName: string; now: Date }): Promise<UserRecord>`: registered, `passwordHash` null, `emailVerifiedAt` set to `now`; throws `EmailTakenError`.
  - `Repositories.identities: IdentityRepository`.

- [ ] **Step 1: Write failing contract tests** in `repositoryContract.ts`: `createFromGoogle makes a registered user with no password and a verified email`; `createFromGoogle refuses a taken email in any case`; `identities find by provider and Google id`; `identities refuse a second row for the same Google id`; `identities refuse a second Google identity for one user`; `deleting the user removes its identities`; `a transaction that creates a user and an identity and then throws leaves neither`.
- [ ] **Step 2: Run** `npm run test:db -- repositoryContract memoryRepositories postgresRepositories`. Expected: FAIL.
- [ ] **Step 3: Implement** migration `0008_identities` (table with unique `(provider, provider_user_id)` and unique `(user_id, provider)`, index on `user_id`, `password_hash` nullable, replace `users_registered_has_credentials` with `kind = 'guest' OR email IS NOT NULL`; `down` restores the old constraint and drops the table), the Postgres and memory implementations, and the mapping.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(server): identities and Google-created users`.

### Task 4: Google client, claims and name rule

**Files:**
- Create: `projects/server/src/auth/google.ts`, `projects/server/src/auth/google.spec.ts`
- Modify: `projects/server/src/config.ts`, `projects/server/src/config.spec.ts`

**Interfaces:**
- Produces:
  - `interface GoogleClaims { sub: string; email: string; emailVerified: boolean; name?: string }`
  - `class GoogleAuthError extends Error { constructor(readonly code: 'google_failed' | 'google_unverified') }`
  - `interface GoogleClient { authorizeUrl(input: { state: string; nonce: string; codeChallenge: string }): string; exchange(input: { code: string; codeVerifier: string; nonce: string }): Promise<GoogleClaims> }` (`exchange` throws `GoogleAuthError`)
  - `createGoogleClient(options: { clientId: string; clientSecret: string; redirectUri: string; authUrl?: string; tokenUrl?: string; fetch?: typeof fetch; now?: () => number }): GoogleClient`
  - `googleDisplayName(name: string | undefined, email: string): string`
  - `pkceChallenge(verifier: string): string` (base64url SHA-256)
  - `ServerConfig.google: { clientId: string; clientSecret: string } | null`

- [ ] **Step 1: Write failing tests.**
  - `config.spec.ts`: `google is null when neither variable is set`, `both variables set give google credentials`, `one variable alone is a ConfigError`.
  - `google.spec.ts`: `authorizeUrl carries client id, redirect uri, scope, state, nonce and an S256 challenge, and never the secret`; `exchange posts the code, verifier, client id and secret to the token endpoint and returns the claims`; one test each that `exchange` throws `google_failed` for a wrong aud, a wrong iss, an expired token, a wrong nonce, a missing sub, a non-200 token response, and a body with no id_token; `exchange throws google_unverified when email_verified is not true`; `googleDisplayName` cases: uses the name, falls back to the email local part when the name is blank or starts with `[Bot]`, falls back to `Player`, cuts to `DISPLAY_NAME_MAX`; `pkceChallenge matches the RFC 7636 example` (verifier `dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk` gives `E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM`). Use an injected `fetch` that returns a fake token response with an unsigned JWT-shaped `id_token`.
- [ ] **Step 2: Run** `npx jest projects/server/src/auth/google.spec.ts projects/server/src/config.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the functions above and the config parsing. Decode the JWT payload with `Buffer.from(part, 'base64url')`.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(server): Google client and config`.

### Task 5: `signInWithGoogle`

**Files:**
- Modify: `projects/server/src/auth/accounts.ts`, `projects/server/src/auth/accounts.spec.ts`

**Interfaces:**
- Consumes: `GoogleClaims`, `googleDisplayName` (Task 4), `repos.identities` and `createFromGoogle` (Task 3).
- Produces: `AccountService.signInWithGoogle(claims: GoogleClaims): Promise<{ signedIn: SignedIn } | { refused: 'email_in_use' }>`.

- [ ] **Step 1: Write failing tests** in `accounts.spec.ts`: `a new Google user is created registered, verified, with no password, named from Google, and signed in`; `the same Google account signs in as the same user next time, even when its Google email changed`; `an email that has a password account is refused, with no identity created and the account untouched`; `an email whose account has no Google identity and a different case is also refused`; `two concurrent first sign-ins for one Google account give one user and one identity`; `a Google-created user has hasPassword false`.
- [ ] **Step 2: Run** `npx jest projects/server/src/auth/accounts.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the three rules of the spec. Create the user and the identity in one `repos.transaction`; on `EmailTakenError` or `IdentityTakenError`, look the identity up once more and fall back to rules 1 and 2. A user that exists with that email but no Google identity is refused.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(server): sign in with Google`.

### Task 6: Google routes

**Files:**
- Create: `projects/server/src/http/googleRoutes.ts`, `projects/server/src/http/googleRoutes.spec.ts`
- Modify: `http/session.ts`, `http/authRoutes.ts`, `http/app.ts`, `server.ts`, `auth/rateLimits.ts`, `views/me.ts`

**Interfaces:**
- Consumes: `GoogleClient`, `pkceChallenge` (Task 4), `AccountService.signInWithGoogle` (Task 5).
- Produces:
  - `beginSession(request: FastifyRequest, reply: FastifyReply, accounts: AccountService, result: SignedIn, options: { production: boolean; cookieSecure: boolean }): Promise<void>` in `session.ts` (ends the browser's current session, sets the session cookie); `authRoutes.ts` uses it.
  - `safeReturnPath(raw: unknown): string`.
  - `registerGoogleRoutes(app: TypedApp, deps: { accounts: AccountService; google: GoogleClient | null; limits: AuthRateLimits; cookieSecure: boolean; production: boolean; now: () => number }): void`, adding `GET /api/auth/providers`, `GET /api/auth/google/start`, `GET /api/auth/google/callback`.
  - `AuthRateLimits.googleIp`, with rule `googlePerIp: { limit: 30, windowMs: 15 * MINUTE }`.
  - `AppDeps.google: GoogleClient | null`.
  - `toMe` adds `hasPassword` for registered users.

- [ ] **Step 1: Write failing tests** with a fake `GoogleClient` (`authorizeUrl` returns `https://google.test/auth?state=…`, `exchange` returns configured claims). Names:
  - `providers says google is on only when a client is configured`
  - `start and callback answer 404 when Google is not configured`
  - `start redirects to the authorize URL with the state, sets the sgs_oauth cookie, and keeps a safe returnUrl`
  - `callback signs in a new Google user, sets the session cookie, clears sgs_oauth and redirects to the returnUrl`
  - `callback redirects to /sign-in?error=google_failed without a user, identity or session when the state does not match or the cookie is missing`
  - `callback redirects with google_cancelled when Google sent error=access_denied`
  - `callback redirects with google_unverified when the client throws it`
  - `callback redirects with google_email_in_use for a password account, creates nothing and leaves the browser's old session working`
  - `callback keeps the returnUrl on an error redirect`
  - `safeReturnPath turns //evil.example, /\\evil.example, https://evil.example, javascript:alert(1), an empty value and a non-string into /, and keeps /rooms?x=1`
  - `callback replaces a session the browser already had`
  - `the Google routes answer 429 past the per-IP limit`
  - `GET /api/me reports hasPassword false for a Google-created user and true for a password user`
- [ ] **Step 2: Run** `npx jest projects/server/src/http`. Expected: FAIL.
- [ ] **Step 3: Implement.** Cookie value is `base64url(JSON.stringify({ state, nonce, verifier, returnUrl }))`. State, nonce and verifier come from `randomBytes(32).toString('base64url')`. Any exception in the callback (other than a refusal) redirects with `google_failed` and logs through `request.log.error` without the secret. In `server.ts` build the real client from `config.google` when set.
- [ ] **Step 4: Run** the same command and `npx tsc --noEmit -p projects/server/tsconfig.json`. Expected: PASS, no type errors.
- [ ] **Step 5: Commit** `feat(server): Google sign-in routes`.

### Task 7: Set Password

**Files:**
- Modify: `projects/server/src/profile/profileService.ts`, `projects/server/src/profile/profileService.spec.ts`, `projects/server/src/http/profileRoutes.spec.ts`

**Interfaces:**
- Consumes: optional `currentPassword` (Task 1).
- Produces: `ProfileService.changePassword(user, sessionId, input: { currentPassword?: string; newPassword: string })`: requires and checks `currentPassword` only when `user.passwordHash` is set; otherwise stores the new password. Same effects as before (other sessions revoked, reset links voided).

- [ ] **Step 1: Write failing tests.** Service: `a user with no password can set one without a current password, keeping this session and revoking the others`; `a user with a password still needs the right current password, and one missing is refused as invalid_credentials`; `a weak new password is refused for a user with no password too`. Routes: `POST /api/me/password without currentPassword answers 204 for a Google-created user and 401 for a password user`; `after setting a password, GET /api/me reports hasPassword true`. Create a Google-created user through `repos.users.createFromGoogle` and a session through `repos.sessions.create`.
- [ ] **Step 2: Run** `npx jest projects/server/src/profile projects/server/src/http/profileRoutes.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the branch in `changePassword`.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(server): set a first password`.

### Task 8: Angular

**Files:**
- Modify: `auth/auth.service.ts`, `auth/sign-in.ts`, `auth/sign-up.ts`, `profile/profile-settings.ts`, `profile/profile.service.ts`, `i18n/en.ts`, `i18n/vi.ts`, and the specs `auth/auth.service.spec.ts`, `auth/sign-in.spec.ts`, `auth/sign-up.spec.ts`, `profile/profile-settings.spec.ts`, `profile/profile.service.spec.ts`

**Interfaces:**
- Consumes: `Me.hasPassword`, `AuthProviders`, optional `currentPassword` (Task 1).
- Produces: `AuthService.providers(): Promise<AuthProviders>` (answers `{ google: false }` when the call fails); `ProfileService.changePassword(currentPassword: string | null, newPassword: string)`, which reloads the signed-in user (`AuthService.load()`) after success.
- New message keys, English then Vietnamese draft:
  - `auth.continueWithGoogle`: "Continue with Google" / "Tiếp tục với Google"
  - `auth.googleFailed`: "Google sign-in did not work. Try again" / "Đăng nhập bằng Google không thành công. Hãy thử lại"
  - `auth.googleCancelled`: "Google sign-in was cancelled" / "Đã hủy đăng nhập bằng Google"
  - `auth.googleUnverified`: "Your Google email is not verified" / "Email Google của bạn chưa được xác minh"
  - `auth.googleEmailInUse`: "That email already has a password account. Sign in with your password" / "Email này đã có tài khoản mật khẩu. Hãy đăng nhập bằng mật khẩu"
  - `profile.settings.setPassword`: "Set Password" / "Đặt mật khẩu"

- [ ] **Step 1: Write failing specs.** `providers() asks GET /api/auth/providers and answers { google: false } when the call fails`; Sign In and Sign Up: `shows Continue with Google only when providers say so, as a link to /api/auth/google/start with the returnUrl`; Sign In: `shows the message for ?error=google_email_in_use and each other code, and nothing for an unknown code`; Settings: `shows Set Password with no current-password field when hasPassword is false, and Change Password otherwise`; `setting a password sends no currentPassword`; ProfileService: `changePassword with null sends only newPassword and reloads the signed-in user`. Vietnamese: add the new keys to the catalog parity check.
- [ ] **Step 2: Run** `npx jest --selectProjects app projects/app/src/app/auth projects/app/src/app/profile projects/app/src/app/i18n`. Expected: FAIL.
- [ ] **Step 3: Implement.** The Google button is a plain `<a href>` (a full page navigation). Read `?error=` from the route snapshot. Settings reads `hasPassword` from `AuthService.me()`; specs that build `ProfileSettings` provide `AuthService` or `provideHttpClient()`.
- [ ] **Step 4: Run** the same command, then `npx tsc --noEmit -p projects/app/tsconfig.app.json` and `npm run i18n:status`. Expected: PASS, no type errors.
- [ ] **Step 5: Commit** `feat(app): Continue with Google and Set Password`.

### Task 9: Docs and final checks

**Files:**
- Modify: `docs/deployment.md`, `.env.example`, `docs/architecture/backend.md`, `docs/architecture/frontend.md`, `docs/deferrals.md`

- [ ] **Step 1: Write the docs.**
  - `docs/deployment.md`: the Google Cloud steps (project, consent screen, OAuth client of type Web application, authorized redirect URIs `http://localhost:4200/api/auth/google/callback` and `https://<name>.onrender.com/api/auth/google/callback`) and the Render variables `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
  - `.env.example`: the two variables, commented.
  - `backend.md`: the flow, `identities`, the three rules, Set Password.
  - `frontend.md`: the button and error codes.
  - `deferrals.md`: linking an existing password account from Settings, unlinking, and the Mailer's effect on Google-only accounts.
- [ ] **Step 2: Run** `npm test`, `npm run test:db`, `npm run verify`. Expected: all pass.
- [ ] **Step 3: Commit** `docs: Google sign-in`.

---

## Self-Review Notes

- **Spec coverage:** Flow, checks and routes (Tasks 4 and 6), rules (Task 5), Set Password (Task 7), schema (Task 3), sign-in fix (Task 2), protocol (Task 1), UI and text (Task 8), docs (Task 9).
- **Types:** `GoogleClaims` and `GoogleClient` are defined once in Task 4. `signInWithGoogle` returns `{ signedIn } | { refused }` in Tasks 5 and 6.
- **Not checked against real Google:** Everything is tested against a fake. A manual run with real credentials is the final check, and the final report must say whether it happened.
