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
