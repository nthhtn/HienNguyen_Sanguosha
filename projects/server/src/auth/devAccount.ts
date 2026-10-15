import type { ServerConfig } from '../config';
import { AccountService, AuthError } from './accounts';

// A well-known account for local development, so there's always one to sign in
// with (the in-memory store forgets accounts on restart). Never seeded in production.
export const DEV_ACCOUNT = { email: 'player@sgs.com', password: '12345678', displayName: 'Player' } as const;

// Creates the dev account unless it already exists (a Postgres store keeps it between runs).
export async function seedDevAccount(accounts: AccountService): Promise<void> {
  try {
    await accounts.signUp({ ...DEV_ACCOUNT });
  } catch (err) {
    if (!(err instanceof AuthError && err.code === 'email_taken')) throw err;
  }
}

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);

// Only a server that is neither in production nor reachable from other machines
// gets the well-known account: with a Postgres store it would otherwise live on
// a shared or staging host that just forgot NODE_ENV.
export function shouldSeedDevAccount(config: Pick<ServerConfig, 'production' | 'host'>): boolean {
  return !config.production && LOOPBACK_HOSTS.has(config.host);
}
