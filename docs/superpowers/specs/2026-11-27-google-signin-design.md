# Google Sign-In

Addendum to `2026-10-13-backend-multiplayer-design.md`. This spec adds "Continue with Google" to Sign In and Sign Up, and a way for a Google-only account to set a password.

## Intent

- **Why:** Players lose passwords, and email reset does not work yet (no Mailer, see `docs/deferrals.md`). Google gives them a way in that needs no email from us.
- **Goal:** One click from the Sign In or Sign Up page to a signed-in registered account.
- **Audience:** Friends on the hosted server now, and anyone who finds it later.

## Goals

- **Sign in with Google:** A server-side authorization code flow with PKCE.
- **First visit:** A new Google user lands signed in at once, with their Google name as display name. They can rename in Profile settings.
- **Existing password accounts are never linked:** A Google sign-in whose email already belongs to a password account is refused with a clear message. The player signs in with their password as before.
- **Set Password:** A Google-only account can set a password in Profile settings without a current password.
- **Optional:** The button only appears when Google credentials are configured.

## Non-goals

- **Unlinking Google**, and linking Google from Settings for a signed-in user. Until linking exists, a player with a password account cannot use Google.
- **Other providers**, Google One Tap and the Google Identity Services script.
- **Mail:** The Mailer stays deferred. Forgot Password still depends on it.
- **Guests:** A guest who signs in with Google gets the Google account. Their guest games are not merged (already deferred).
- **Account deletion.**

## Approaches

- **Server-side code flow with PKCE (chosen):** No new dependency and no third-party script on our pages. The server holds the secret and checks the token.
- **Google Identity Services button:** The browser posts an ID token to us. It needs the server to fetch Google's signing keys and verify signatures, and loads a Google script on the sign-in page. Rejected.
- **An OpenID library:** Less code, but a new dependency that hides the flow. Rejected.

## Flow

1. **Start:** `GET /api/auth/google/start?returnUrl=…`.
   - Creates a random `state`, `nonce` and PKCE `code_verifier`.
   - Stores them and the validated `returnUrl` in a short-lived cookie `sgs_oauth` (HttpOnly, `SameSite=Lax`, path `/api/auth/google`, 10 minutes, `Secure` as the session cookie).
   - Redirects (302) to Google's authorization endpoint with `response_type=code`, `scope=openid email profile`, the `state`, `nonce`, `code_challenge` (S256) and `redirect_uri`.
2. **Callback:** `GET /api/auth/google/callback?code=…&state=…`.
   - Reads and clears the `sgs_oauth` cookie.
   - Refuses (redirect with an error code) when the cookie is missing, `state` differs, or Google sent `error` (for example `access_denied`).
   - Exchanges the `code` and `code_verifier` for tokens at Google's token endpoint, server to server over HTTPS.
   - Reads the claims from the `id_token`.
   - Signs the user in as described below, sets the session cookie (ending any session the browser had, like the other sign-in routes), and redirects to `returnUrl` or `/`.
3. **Errors:** Every failure redirects to `/sign-in?error=<code>` and never shows a raw error. Codes: `google_failed` (anything unexpected), `google_cancelled` (the user said no), `google_unverified` (Google's email is not verified), `google_email_in_use` (a password account has that email). The redirect keeps the original `returnUrl` so a retry returns to the page the player wanted.

## Checking the ID token

- **No signature check:** The token arrives directly from Google's token endpoint over TLS, which OpenID Connect Core 3.1.3.7 accepts in place of a signature check.
- **Claims checked:** `iss` is `https://accounts.google.com` or `accounts.google.com`, `aud` equals the client id, `exp` is in the future, `nonce` equals the stored one, `sub` is a non-empty string, `email` is a string, and `email_verified` is `true`.
- **Unverified email:** Refused with `google_unverified`.

## Signing in

`AccountService.signInWithGoogle(claims)` follows these rules in order:

1. **Known identity:** A row in `identities` for `(google, sub)` signs in as its user, even if the Google email has since changed.
2. **Known email:** A user with that email (case-insensitive), registered with a password and no Google identity, is **not** signed in and **not** linked. The callback redirects to `/sign-in?error=google_email_in_use`. This closes the takeover where someone registers a victim's email with a password first, and it never touches an existing account.
3. **New user (no identity, no account with that email):** A registered user is created with the Google email, a null password hash, `email_verified_at` set, and the display name below, plus an identity row.

**Display name:** The Google `name`, run through `normalizeDisplayName` and cut to `DISPLAY_NAME_MAX`. When that gives nothing (empty, or starts with `[Bot]`), use the part of the email before `@`, normalized the same way, then `Player`.

**Race:** Two concurrent first sign-ins for one Google account end with one user and one identity: A unique violation on `identities` or on the email falls back to rule 1 or 2 once.

**Result:** `signInWithGoogle` answers `{ signedIn }` or `{ refused: 'email_in_use' }`; unexpected failures throw.

## Set Password

- **`Me`:** Gains `hasPassword: boolean` (true when a password hash exists).
- **`POST /api/me/password`:** `currentPassword` becomes optional in the schema. The service requires it and checks it when the user has a password hash. A user without a hash may omit it and gets the new password stored, with the same effects as a change (other sessions revoked, reset links voided).
- **Settings:** The password form shows "Set Password" with no current-password field when `hasPassword` is false, and "Change Password" otherwise.

## Calls made after the builder check

- **Verified accounts:** Not applicable now: no existing account is ever linked.
- **Already signed in:** The callback replaces the browser's current session, like every other sign-in route.
- **Local setup:** Register `http://localhost:4200/api/auth/google/callback` in Google Cloud. The `sgs_oauth` cookie is `Secure` by the same rule as the session cookie.

## Fix needed in sign-in

`AccountService.signIn` compares the typed password with a dummy hash when the user has none, and then only checks `matches`. For a Google-only account (null hash) a typed password equal to the dummy password would sign in. Sign-in must treat a user with no hash as never matching, and a test pins it.

## Server

- **Migration `0008_identities`:**
  - Table `identities`: `id uuid`, `user_id` (FK to `users`, cascade), `provider text` (check `'google'`), `provider_user_id text`, `email text`, `created_at`.
  - Unique `(provider, provider_user_id)` and unique `(user_id, provider)`. Index on `user_id`.
  - `users.password_hash` becomes nullable and the constraint `users_registered_has_credentials` becomes: guest, or `email IS NOT NULL`.
- **Repositories:** `IdentityRepository` (`findByProviderUser`, `create` throwing `IdentityTakenError`) and `UserRepository.createFromGoogle({ email, displayName, now })` (registered, null password hash, `email_verified_at` set; throws `EmailTakenError`), in the memory and Postgres stores with contract tests. The two writes of a first sign-in share one transaction.
- **`GoogleClient`** (`server/src/auth/google.ts`):
  - Interface: `authorizeUrl(input: { state; nonce; codeChallenge }): string` and `exchange(input: { code; codeVerifier }): Promise<GoogleClaims>`, where `GoogleClaims` is `{ sub; email; emailVerified; name?: string }`.
  - The real client uses `fetch` and the claim checks above. Endpoints are configurable so tests can point it at a local fake.
- **Config:** `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, both or neither (one alone is a `ConfigError`). `redirect_uri` is `${PUBLIC_ORIGIN}/api/auth/google/callback`.
- **Routes** (`http/googleRoutes.ts`): `GET /api/auth/providers` answers `{ google: boolean }`. The two Google routes answer 404 when not configured. Both use a per-IP limiter (30 per 15 minutes).
- **Return URL:** Accepted only when it starts with `/` and not `//` and has no backslash. Anything else becomes `/`.

## Protocol

- `Me` and `MeSchema` gain `hasPassword`. `ChangePasswordBody.currentPassword` becomes optional.
- New `AuthProviders` type for `/api/auth/providers`.

## Angular

- **Sign In and Sign Up:** A "Continue with Google" link to `/api/auth/google/start?returnUrl=…` (a full page navigation, not the router), shown only when `/api/auth/providers` says Google is on.
- **Sign In:** Reads `?error=` and shows the matching message.
- **Settings:** The password form as above.
- **Text:** English and Vietnamese (Vietnamese as draft), following the UI text style rules in `CLAUDE.md`. Labels in Title Case, messages in sentence case.

## Constraints

- **Local screens:** Setup and Game stay untouched.
- **Secrets:** The client secret never reaches the browser and is never logged.
- **Docs:** `docs/deployment.md` gets the Render variables and the Google Cloud steps (create an OAuth client of type Web application, with the redirect URI for localhost and for the Render URL). `.env.example`, `docs/architecture/backend.md` and `docs/deferrals.md` are updated.

## Left to the builder

- Exact cookie encoding for `sgs_oauth`.
- The fake Google used in tests (a local Fastify server, or an injected `GoogleClient`).
- Button styling, within the existing visual style.
