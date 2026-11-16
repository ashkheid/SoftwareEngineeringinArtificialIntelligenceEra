import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { openStore } from '../../src/database.mjs';
import { seedDemo } from '../../src/admin.mjs';
import { ChangeFlow } from '../../src/application.mjs';
import { createApi } from '../../src/http.mjs';

export const content = { title: 'Add export', description: 'Export approved changes.', reason: 'Reduce manual reporting.' };

export async function fixture(t, options = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'changeflow-test-'));
  const filename = join(directory, 'changes.sqlite');
  const store = openStore(filename, options);
  const tokens = seedDemo(store);
  const errors = [];
  const service = new ChangeFlow(store);
  const server = createApi(service, { onError: (error) => errors.push(error) });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    store.close();
    // directory is the exact freshly-created temporary test directory, never user data.
    rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  });
  async function call(method, path, user = 'alice', body, headers = {}) {
    const response = await fetch(base + path, { method, headers: {
      ...(user ? { Authorization: `Bearer ${tokens[user] || user}` } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers,
    }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, body: await response.json(), headers: response.headers };
  }
  function saved(id) {
    const reader = new DatabaseSync(filename, { readOnly: true });
    try {
      const row = reader.prepare('SELECT * FROM change_requests WHERE id=?').get(id);
      return row && { ...row };
    } finally { reader.close(); }
  }
  async function create(user = 'alice') { return (await call('POST', '/requests', user, content)).body; }
  async function pending(user = 'alice') {
    const draft = await create(user);
    return (await call('POST', `/requests/${draft.id}/submit`, user, { version: draft.version })).body;
  }
  return { directory, filename, store, service, server, tokens, base, call, saved, create, pending, errors };
}
