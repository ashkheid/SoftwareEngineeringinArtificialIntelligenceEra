import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openStore } from '../dist/src/database.mjs';
import { seedDemo } from '../dist/src/admin.mjs';
import { start } from '../dist/src/server.mjs';

const directory = mkdtempSync(join(tmpdir(), 'changeflow-demo-'));
const database = join(directory, 'demo.sqlite');
let running;
try {
  const seed = openStore(database);
  let tokens;
  try { tokens = seedDemo(seed); } finally { seed.close(); }
  running = await start({ database, port: 0 });
  let base = `http://127.0.0.1:${running.server.address().port}`;
  async function call(method, path, user, input, expected) {
    const response = await fetch(base + path, { method, headers: {
      Authorization: `Bearer ${tokens[user]}`, ...(input ? { 'Content-Type': 'application/json' } : {}),
    }, ...(input ? { body: JSON.stringify(input) } : {}) });
    const result = await response.json();
    assert.equal(response.status, expected, JSON.stringify(result));
    console.log(`${method} ${path.replace(/[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}/g, '{id}')} -> ${response.status} ${result.status || result.error?.code || ''}`);
    return result;
  }
  const content = { title: 'Export changes', description: 'CSV export for the support team.', reason: 'Reduce manual reporting.' };
  let request = await call('POST', '/requests', 'carol', content, 201);
  const path = `/requests/${request.id}`;
  request = await call('PUT', path, 'carol', { ...content, title: 'Export approved changes', version: 1 }, 200);
  request = await call('POST', path + '/submit', 'carol', { version: request.version }, 200);
  await call('POST', path + '/approve', 'carol', { version: request.version }, 403);
  request = await call('POST', path + '/request-changes', 'bob', { version: request.version, feedback: 'Explain compatibility.' }, 200);
  request = await call('PUT', path, 'carol', { ...content, description: 'A backward compatible CSV export.', version: request.version }, 200);
  request = await call('POST', path + '/submit', 'carol', { version: request.version }, 200);
  await call('POST', path + '/approve', 'bob', { version: 3 }, 409);
  request = await call('POST', path + '/approve', 'bob', { version: request.version }, 200);
  assert.equal(request.status, 'Approved');
  assert.equal(request.version, 7);
  assert.equal(request.approvedVersion, 6);
  await call('PUT', path, 'carol', { ...content, version: request.version }, 409);
  await running.stop(); running = undefined;
  // All connections are now closed. Start a new API instance over the persisted database file.
  running = await start({ database, port: 0 });
  base = `http://127.0.0.1:${running.server.address().port}`;
  assert.deepEqual(await call('GET', path, 'carol', undefined, 200), request);
  console.log('PASS: built-package HTTP workflow, sensitive failures and full close/restart durability.');
} finally {
  if (running) await running.stop();
  rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
}
