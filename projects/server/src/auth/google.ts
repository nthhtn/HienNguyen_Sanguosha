import { createHash } from 'node:crypto';
import { DISPLAY_NAME_MAX, normalizeDisplayName } from 'protocol';

export interface GoogleClaims {
  // Google's own id for the person; stable, unlike their email.
  sub: string;
  email: string;
  emailVerified: boolean;
  name?: string;
}

// Why Google sign-in failed, as the code the Sign In page shows.
export class GoogleAuthError extends Error {
  constructor(readonly code: 'google_failed' | 'google_unverified') {
    super(code);
    this.name = 'GoogleAuthError';
  }
}

export interface GoogleClient {
  authorizeUrl(input: { state: string; nonce: string; codeChallenge: string }): string;
  // Throws GoogleAuthError. `nonce` is the one sent to Google when the flow began.
  exchange(input: { code: string; codeVerifier: string; nonce: string }): Promise<GoogleClaims>;
}

export interface GoogleClientOptions {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authUrl?: string;
  tokenUrl?: string;
  fetch?: typeof fetch;
  now?: () => number;
}

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

// The S256 code challenge for a PKCE verifier (RFC 7636).
export function pkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

export function createGoogleClient(options: GoogleClientOptions): GoogleClient {
  const { clientId, clientSecret, redirectUri } = options;
  const doFetch = options.fetch ?? fetch;
  const now = options.now ?? Date.now;

  return {
    authorizeUrl({ state, nonce, codeChallenge }) {
      const url = new URL(options.authUrl ?? AUTH_URL);
      url.search = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        state,
        nonce,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
      }).toString();
      return url.toString();
    },

    async exchange({ code, codeVerifier, nonce }) {
      let payload: unknown;
      try {
        const response = await doFetch(options.tokenUrl ?? TOKEN_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ grant_type: 'authorization_code', code, code_verifier: codeVerifier, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri }).toString(),
        });
        if (!response.ok) throw new Error(`The token endpoint answered ${response.status}`);
        const body = (await response.json()) as { id_token?: unknown };
        if (typeof body.id_token !== 'string') throw new Error('The token response has no id_token');
        payload = JSON.parse(Buffer.from(body.id_token.split('.')[1] ?? '', 'base64url').toString('utf8'));
      } catch {
        // Never carry the failing request's details further: they could name the secret.
        throw new GoogleAuthError('google_failed');
      }
      return claimsFrom(payload, { clientId, nonce, nowSeconds: now() / 1000 });
    },
  };
}

// The checks OpenID Connect Core 3.1.3.7 asks for. The token came straight from
// Google's token endpoint over TLS, so its signature is not checked.
function claimsFrom(payload: unknown, expected: { clientId: string; nonce: string; nowSeconds: number }): GoogleClaims {
  const c = (payload ?? {}) as Record<string, unknown>;
  const valid =
    typeof c['iss'] === 'string' &&
    ISSUERS.includes(c['iss']) &&
    (c['aud'] === expected.clientId || (Array.isArray(c['aud']) && c['aud'].includes(expected.clientId))) &&
    typeof c['exp'] === 'number' &&
    c['exp'] > expected.nowSeconds &&
    c['nonce'] === expected.nonce &&
    typeof c['sub'] === 'string' &&
    c['sub'] !== '' &&
    typeof c['email'] === 'string' &&
    c['email'] !== '';
  if (!valid) throw new GoogleAuthError('google_failed');
  if (c['email_verified'] !== true) throw new GoogleAuthError('google_unverified');
  return { sub: c['sub'] as string, email: c['email'] as string, emailVerified: true, ...(typeof c['name'] === 'string' ? { name: c['name'] } : {}) };
}

// The display name a new Google user starts with: their Google name, else the
// start of their email, else "Player". They can rename in Profile settings.
export function googleDisplayName(name: string | undefined, email: string): string {
  for (const candidate of [name ?? '', email.split('@')[0] ?? '']) {
    const cut = Array.from(candidate.normalize('NFC').replace(/\s+/g, ' ').trim()).slice(0, DISPLAY_NAME_MAX).join('').trim();
    const normalized = normalizeDisplayName(cut);
    if (normalized) return normalized;
  }
  return 'Player';
}
