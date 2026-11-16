import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openStore } from '../src/database.mjs';
import { fixture } from './helpers/fixture.mjs';

const admin = fileURLToPath(new URL('../src/admin.mjs', import.meta.url));
function cli(filename, ...args) {
  const result = spawnSync(process.execPath, [admin, ...args], {
    env: { ...process.env, CHANGEFLOW_DB: filename }, encoding: 'utf8', timeout: 10000, windowsHide: true,
  });
  if (result.error) throw result.error;
  return result;
}

test('FR-015: actual CLI provisions only once and stores no plaintext tokens', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'changeflow-cli-'));
  t.after(() => rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }));
  const filename = join(directory, 'changes.sqlite');
  const result = cli(filename, 'init-demo');
  assert.equal(result.status, 0, result.stderr);
  const tokens = JSON.parse(result.stdout);
  assert.deepEqual(Object.keys(tokens), ['alice', 'bob', 'carol', 'dana']);
  assert.equal(new Set(Object.values(tokens)).size, 4);
  const store = openStore(filename);
  try {
    assert.equal(store.findActor(tokens.carol).reviewer, true);
    const stored = store.db.prepare('SELECT digest FROM tokens').all().map((x) => x.digest);
    assert.ok(stored.every((digest) => /^[a-f0-9]{64}$/.test(digest)));
    assert.ok(stored.every((digest) => !Object.values(tokens).includes(digest)));
  } finally { store.close(); }
  assert.equal(cli(filename, 'init-demo').status, 1);
});

test('FR-015: CLI role removal, token revocation and deactivation affect a running API', async (t) => {
  const f = await fixture(t);
  const pending = await f.pending();
  const before = f.saved(pending.id);
  assert.equal(cli(f.filename, 'set-roles', 'bob', 'none').status, 0);
  assert.equal((await f.call('POST', `/requests/${pending.id}/approve`, 'bob', { version: 2 })).status, 404);
  assert.equal(cli(f.filename, 'revoke-tokens', 'carol').status, 0);
  assert.equal((await f.call('GET', '/requests', 'carol')).status, 401);
  assert.equal(cli(f.filename, 'deactivate', 'alice').status, 0);
  assert.equal((await f.call('GET', '/requests')).status, 401);
  assert.deepEqual(f.saved(pending.id), before);
});

test('FR-015: CLI rejects unknown/missing arguments and unknown roles/users', async (t) => {
  const f = await fixture(t);
  for (const args of [[], ['init-demo', 'extra'], ['set-roles', 'bob'], ['set-roles', 'bob', 'Admin'],
    ['set-roles', 'bob', 'Reviewer,Reviewer'], ['deactivate', 'missing'], ['unknown']]) {
    assert.equal(cli(f.filename, ...args).status, 1, args.join(' '));
  }
  assert.equal(f.store.findActor(f.tokens.bob).reviewer, true);
});
