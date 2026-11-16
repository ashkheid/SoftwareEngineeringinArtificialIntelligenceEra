import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openStore } from './database.mjs';
import { ChangeFlow } from './application.mjs';
import { createApi } from './http.mjs';

export async function start({ database = process.env.CHANGEFLOW_DB || 'data/changeflow.sqlite',
  port = Number(process.env.PORT || 3000), host = process.env.HOST || '127.0.0.1' } = {}) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('PORT must be an integer from 0 to 65535.');
  const store = openStore(database);
  const server = createApi(new ChangeFlow(store));
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, host, () => { server.removeListener('error', reject); resolve(); });
    });
  } catch (error) { store.close(); throw error; }
  return { server, store, async stop() {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    store.close();
  } };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const app = await start();
    console.log(`ChangeFlow listening on ${JSON.stringify(app.server.address())}`);
    let stopping = false;
    const stop = async () => {
      if (stopping) return;
      stopping = true;
      try { await app.stop(); } catch { process.exitCode = 1; }
    };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  } catch {
    console.error('Could not start ChangeFlow. Check PORT, HOST and database access.');
    process.exitCode = 1;
  }
}
