import { AccountService } from './accounts';
import { DEV_ACCOUNT, seedDevAccount, shouldSeedDevAccount } from './devAccount';
import { ConsoleMailer } from '../mail/mailer';
import { createMemoryRepositories } from '../persistence/memory/memoryRepositories';

describe('seedDevAccount', () => {
  const accounts = () => new AccountService({ repos: createMemoryRepositories(), mailer: new ConsoleMailer(), publicOrigin: 'http://localhost:4200' });

  it('creates an account that can sign in, and is harmless to repeat', async () => {
    const service = accounts();
    await seedDevAccount(service);
    await seedDevAccount(service);
    const signedIn = await service.signIn({ email: DEV_ACCOUNT.email, password: DEV_ACCOUNT.password });
    expect(signedIn.user.displayName).toBe('Player');
  });
});

describe('shouldSeedDevAccount', () => {
  it.each(['127.0.0.1', 'localhost', '::1'])('seeds in development on the loopback host %s', (host) => {
    expect(shouldSeedDevAccount({ production: false, host })).toBe(true);
  });

  it.each(['0.0.0.0', '192.168.1.20', 'staging.example.com', ''])('does not seed in development on the reachable host %j', (host) => {
    expect(shouldSeedDevAccount({ production: false, host })).toBe(false);
  });

  it('never seeds in production, even on loopback', () => {
    expect(shouldSeedDevAccount({ production: true, host: '127.0.0.1' })).toBe(false);
  });
});
