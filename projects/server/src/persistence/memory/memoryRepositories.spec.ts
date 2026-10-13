import { describeRepositoryContract } from '../repositoryContract';
import { createMemoryRepositories } from './memoryRepositories';

describe('in-memory repositories', () => {
  describeRepositoryContract(async () => ({ repos: createMemoryRepositories(), teardown: async () => undefined }));
});
