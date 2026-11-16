import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { Worker } from 'node:worker_threads';
import { fixture, content } from './helpers/fixture.mjs';
import { openStore } from '../src/database.mjs';
import { ChangeFlow } from '../src/application.mjs';
import { setRoles } from '../src/admin.mjs';

function competitor(t, f, gate, id, action, input, user = 'bob') {
  const worker = new Worker(new URL('./helpers/race-worker.mjs', import.meta.url), {
    workerData: { filename: f.filename, gate, token: f.tokens[user], id, action, input },
  });
  let readyResolve, readyReject, resultResolve, resultReject;
  const ready = new Promise((resolve, reject) => { readyResolve = resolve; readyReject = reject; });
  const result = new Promise((resolve, reject) => { resultResolve = resolve; resultReject = reject; });
  // Both promises are observed even if startup fails before the caller reaches result.
  result.catch(() => {});
  let completed = false;
  const fail = (error) => { readyReject(error); resultReject(error); };
  const timer = setTimeout(() => fail(new Error('Worker timed out.')), 15000);
  worker.on('error', fail);
  worker.on('message', (message) => {
    if (message.type === 'ready') readyResolve();
    else { completed = true; clearTimeout(timer); resultResolve(message); }
  });
  worker.on('exit', (code) => { if (!completed) fail(new Error(`Worker exited early: ${code}`)); });
  t.after(async () => { clearTimeout(timer); await worker.terminate(); });
  return { ready, result };
}

function release(gate) { const values = new Int32Array(gate); Atomics.store(values, 0, 1); Atomics.notify(values, 0); }

test('FR-010: a stale edit cannot silently overwrite newer persisted content', async (t) => {
  const f = await fixture(t);
  const draft = await f.create();
  assert.equal((await f.call('PUT', `/requests/${draft.id}`, 'alice', { ...content, title: 'Winning edit', version: 1 })).status, 200);
  const before = f.saved(draft.id);
  const stale = await f.call('PUT', `/requests/${draft.id}`, 'alice', { ...content, title: 'Stale edit', version: 1 });
  assert.equal(stale.status, 409);
  assert.equal(stale.body.error.code, 'VersionConflict');
  assert.deepEqual(f.saved(draft.id), before);
});

test('FR-010/013: duplicate submit and stale commands leave all fields unchanged', async (t) => {
  const f = await fixture(t);
  const pending = await f.pending();
  const before = f.saved(pending.id);
  for (const [action, user, extra] of [['submit', 'alice', {}], ['approve', 'bob', {}], ['request-changes', 'bob', { feedback: 'Old decision' }]]) {
    const result = await f.call('POST', `/requests/${pending.id}/${action}`, user, { version: 1, ...extra });
    assert.equal(result.status, 409);
    assert.equal(result.body.error.code, 'VersionConflict');
    assert.deepEqual(f.saved(pending.id), before);
  }
});

test('FR-010/014: a reviewer cannot approve unseen content after a correction round', async (t) => {
  const f = await fixture(t);
  const original = await f.pending();
  await f.call('POST', `/requests/${original.id}/request-changes`, 'carol', { version: 2, feedback: 'Revise' });
  await f.call('PUT', `/requests/${original.id}`, 'alice', { ...content, title: 'Changed scope', version: 3 });
  await f.call('POST', `/requests/${original.id}/submit`, 'alice', { version: 4 });
  const before = f.saved(original.id);
  assert.equal(before.version, 5);
  const result = await f.call('POST', `/requests/${original.id}/approve`, 'bob', { version: 2 });
  assert.equal(result.status, 409);
  assert.deepEqual(f.saved(original.id), before);
});

test('FR-013: repeated creates have distinct identities; no accidental deduplication', async (t) => {
  const f = await fixture(t);
  const first = await f.create(); const second = await f.create();
  assert.notEqual(first.id, second.id);
  assert.equal((await f.call('GET', '/requests')).body.items.length, 2);
  assert.equal(f.saved(first.id).status, 'Draft');
  assert.equal(f.saved(second.id).status, 'Draft');
});

test('FR-011: a new application connection reads durable content and credentials', async (t) => {
  const f = await fixture(t);
  const pending = await f.pending();
  const reopened = openStore(f.filename);
  try {
    const service = new ChangeFlow(reopened);
    assert.deepEqual(service.get(f.tokens.alice, pending.id), pending);
    assert.equal(service.get(f.tokens.bob, pending.id).status, 'PendingReview');
  } finally { reopened.close(); }
});

test('FR-011/016: real SQLite write failure returns 503, rolls back and hides details', async (t) => {
  const f = await fixture(t);
  const draft = await f.create();
  const before = f.saved(draft.id);
  f.store.db.exec("CREATE TRIGGER reject_update AFTER UPDATE ON change_requests BEGIN SELECT RAISE(ABORT,'private-storage-detail'); END;");
  const result = await f.call('PUT', `/requests/${draft.id}`, 'alice', { ...content, title: 'Must not persist', version: 1 });
  assert.equal(result.status, 503);
  assert.equal(result.body.error.code, 'StorageFailure');
  assert.ok(!JSON.stringify(result.body).includes('private-storage-detail'));
  assert.deepEqual(f.saved(draft.id), before);
  assert.equal(f.store.db.isTransaction, false);
  f.store.db.exec('DROP TRIGGER reject_update');
  assert.equal((await f.call('POST', `/requests/${draft.id}/submit`, 'alice', { version: 1 })).status, 200);
});

test('FR-011: a transaction rolls back an already executed statement on failure', async (t) => {
  const f = await fixture(t);
  const draft = await f.create();
  const before = f.saved(draft.id);
  assert.throws(() => f.store.transaction(() => {
    f.store.db.prepare('UPDATE change_requests SET title=? WHERE id=?').run('Partial write', draft.id);
    throw new Error('Abort this transaction.');
  }), /Abort this transaction/);
  assert.deepEqual(f.saved(draft.id), before);
});

test('FR-010: SQL compare-and-swap itself rejects a stale update', async (t) => {
  const f = await fixture(t);
  const old = await f.create();
  await f.call('PUT', `/requests/${old.id}`, 'alice', { ...content, title: 'Newer', version: 1 });
  const before = f.saved(old.id);
  assert.throws(() => f.store.transaction(() => f.store.updateRequest({ ...old, title: 'Old', version: 2 }, 1)), { code: 'VersionConflict' });
  assert.deepEqual(f.saved(old.id), before);
});

test('FR-011/016: another writer causes bounded busy failure, not false success', async (t) => {
  const f = await fixture(t, { timeout: 30 });
  const draft = await f.create();
  const before = f.saved(draft.id);
  const blocker = new DatabaseSync(f.filename);
  try {
    blocker.exec('BEGIN IMMEDIATE');
    const result = await f.call('POST', `/requests/${draft.id}/submit`, 'alice', { version: 1 });
    assert.equal(result.status, 503);
    assert.equal(result.body.error.code, 'StorageBusy');
    assert.equal(result.headers.get('retry-after'), '1');
    assert.deepEqual(f.saved(draft.id), before);
  } finally { blocker.exec('ROLLBACK'); blocker.close(); }
  assert.equal((await f.call('POST', `/requests/${draft.id}/submit`, 'alice', { version: 1 })).status, 200);
});

test('FR-010: competing HTTP decisions have exactly one winner', async (t) => {
  const f = await fixture(t);
  const pending = await f.pending();
  const responses = await Promise.all([
    f.call('POST', `/requests/${pending.id}/approve`, 'bob', { version: 2 }),
    f.call('POST', `/requests/${pending.id}/request-changes`, 'carol', { version: 2, feedback: 'Revise' }),
  ]);
  assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409]);
  const winner = responses.find((r) => r.status === 200).body;
  assert.equal(f.saved(pending.id).status, winner.status);
  assert.equal(f.saved(pending.id).version, 3);
});

test('FR-010/011: independent workers race on one file; only one review commits', { timeout: 20000 }, async (t) => {
  const f = await fixture(t);
  const pending = await f.pending();
  const gate = new SharedArrayBuffer(4);
  const approve = competitor(t, f, gate, pending.id, 'approve', { version: 2 });
  const changes = competitor(t, f, gate, pending.id, 'request-changes', { version: 2, feedback: 'Independent worker' }, 'carol');
  await Promise.all([approve.ready, changes.ready]);
  release(gate);
  const results = await Promise.all([approve.result, changes.result]);
  assert.equal(results.filter((r) => r.ok).length, 1);
  assert.equal(results.find((r) => !r.ok).code, 'VersionConflict');
  const stored = f.saved(pending.id);
  assert.equal(stored.status, results.find((r) => r.ok).value.status);
  assert.equal(stored.version, 3);
  assert.equal(stored.title, content.title);
  if (stored.status === 'Approved') {
    assert.equal(stored.approved_by, 'bob'); assert.equal(stored.feedback, null);
  } else {
    assert.equal(stored.feedback_by, 'carol'); assert.equal(stored.approved_by, null);
  }
});

test('FR-008: revocation committed before a worker action wins over an old token', { timeout: 20000 }, async (t) => {
  const f = await fixture(t);
  const pending = await f.pending();
  const before = f.saved(pending.id);
  const gate = new SharedArrayBuffer(4);
  const action = competitor(t, f, gate, pending.id, 'approve', { version: 2 });
  await action.ready;
  setRoles(f.store, 'bob', []);
  release(gate);
  assert.deepEqual(await action.result, { type: 'result', ok: false, code: 'NotFound' });
  assert.deepEqual(f.saved(pending.id), before);
});

test('FR-008: an acquired action transaction excludes intervening role writes', async (t) => {
  const f = await fixture(t);
  const contender = new DatabaseSync(f.filename, { timeout: 0 });
  try {
    f.store.transaction(() => {
      assert.equal(f.store.findActor(f.tokens.bob).reviewer, true);
      assert.throws(() => contender.exec('BEGIN IMMEDIATE'), (error) => (error.errcode & 0xff) === 5);
    });
    contender.exec("BEGIN IMMEDIATE; UPDATE users SET reviewer=0 WHERE id='bob'; COMMIT;");
    assert.equal(f.store.findActor(f.tokens.bob).reviewer, false);
  } finally { contender.close(); }
});
