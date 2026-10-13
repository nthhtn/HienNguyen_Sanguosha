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
