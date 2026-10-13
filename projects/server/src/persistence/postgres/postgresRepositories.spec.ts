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
