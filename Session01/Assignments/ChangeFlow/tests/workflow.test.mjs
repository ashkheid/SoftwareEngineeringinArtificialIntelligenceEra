import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, content } from './helpers/fixture.mjs';

test('FR-001: creates and persists a Draft owned by the authenticated requester', async (t) => {
  const f = await fixture(t);
  const result = await f.call('POST', '/requests', 'alice', content);
  assert.equal(result.status, 201);
  assert.equal(result.body.status, 'Draft');
  assert.equal(result.body.requesterId, 'alice');
  assert.equal(result.body.version, 1);
  assert.equal(result.headers.get('location'), `/requests/${result.body.id}`);
  assert.equal(f.saved(result.body.id).status, 'Draft');
  assert.equal(f.saved(result.body.id).title, content.title);
});

test('FR-002/003: owner edits Draft then submits it', async (t) => {
  const f = await fixture(t);
  const draft = await f.create();
  const edited = await f.call('PUT', `/requests/${draft.id}`, 'alice', { ...content, title: 'New title', version: 1 });
  assert.equal(edited.status, 200);
  assert.equal(edited.body.version, 2);
  const submitted = await f.call('POST', `/requests/${draft.id}/submit`, 'alice', { version: 2 });
  assert.equal(submitted.status, 200);
  assert.equal(submitted.body.status, 'PendingReview');
  assert.equal(f.saved(draft.id).version, 3);
  assert.equal(f.saved(draft.id).title, 'New title');
});

test('FR-006: dual-role owner cannot approve or return their own request', async (t) => {
  const f = await fixture(t);
  const pending = await f.pending('carol');
  const before = f.saved(pending.id);
  for (const action of ['approve', 'request-changes']) {
    const result = await f.call('POST', `/requests/${pending.id}/${action}`, 'carol',
      { version: pending.version, ...(action === 'request-changes' ? { feedback: 'Needs detail' } : {}) });
    assert.equal(result.status, 403);
    assert.equal(result.body.error.code, 'SelfReview');
    assert.deepEqual(f.saved(pending.id), before);
  }
});

test('FR-004/014: independent reviewer approves the exact pending version', async (t) => {
  const f = await fixture(t);
  const pending = await f.pending();
  const result = await f.call('POST', `/requests/${pending.id}/approve`, 'bob', { version: 2 });
  assert.equal(result.status, 200);
  assert.equal(result.body.status, 'Approved');
  assert.equal(result.body.approvedBy, 'bob');
  assert.equal(result.body.approvedVersion, 2);
  assert.equal(result.body.version, 3);
  const stored = f.saved(pending.id);
  assert.equal(stored.approved_by, 'bob');
  assert.equal(stored.approved_version, 2);
  assert.equal(stored.status, 'Approved');
  assert.equal(stored.title, content.title);
  assert.ok(Number.isFinite(Date.parse(stored.approved_at)));
});

test('FR-007: Approved rejects edits and further transitions without any persisted changes', async (t) => {
  const f = await fixture(t);
  const pending = await f.pending();
  assert.equal((await f.call('POST', `/requests/${pending.id}/approve`, 'bob', { version: 2 })).status, 200);
  const before = f.saved(pending.id);
  for (const [method, suffix, user, body] of [
    ['PUT', '', 'alice', { ...content, title: 'Unreviewed content', version: 3 }],
    ['POST', '/submit', 'alice', { version: 3 }],
    ['POST', '/approve', 'bob', { version: 3 }],
    ['POST', '/request-changes', 'bob', { version: 3, feedback: 'Too late' }],
  ]) {
    const result = await f.call(method, `/requests/${pending.id}${suffix}`, user, body);
    assert.equal(result.status, 409);
    assert.equal(result.body.error.code, 'InvalidState');
    assert.deepEqual(f.saved(pending.id), before);
  }
});

test('FR-005: return, revise, resubmit and approve complete the durable correction cycle', async (t) => {
  const f = await fixture(t);
  const pending = await f.pending();
  const returned = await f.call('POST', `/requests/${pending.id}/request-changes`, 'bob', { version: 2, feedback: 'Explain compatibility.' });
  assert.equal(returned.status, 200);
  assert.equal(returned.body.status, 'ChangesRequested');
  assert.equal(returned.body.feedbackBy, 'bob');
  assert.equal(returned.body.version, 3);
  const edited = await f.call('PUT', `/requests/${pending.id}`, 'alice', { ...content, description: 'Backward compatible CSV.', version: 3 });
  assert.equal(edited.status, 200);
  const submitted = await f.call('POST', `/requests/${pending.id}/submit`, 'alice', { version: 4 });
  assert.equal(submitted.body.status, 'PendingReview');
  assert.equal(submitted.body.feedback, 'Explain compatibility.');
  const approved = await f.call('POST', `/requests/${pending.id}/approve`, 'bob', { version: 5 });
  assert.equal(approved.status, 200);
  assert.equal(f.saved(pending.id).version, 6);
  assert.equal(f.saved(pending.id).description, 'Backward compatible CSV.');
  assert.equal(f.saved(pending.id).approved_version, 5);
});

test('FR-005/007: missing feedback and PendingReview edits do not mutate data', async (t) => {
  const f = await fixture(t);
  const pending = await f.pending();
  const before = f.saved(pending.id);
  for (const feedback of ['', '   ', null, 5]) {
    assert.equal((await f.call('POST', `/requests/${pending.id}/request-changes`, 'bob', { version: 2, feedback })).status, 400);
    assert.deepEqual(f.saved(pending.id), before);
  }
  assert.equal((await f.call('PUT', `/requests/${pending.id}`, 'alice', { ...content, version: 2 })).status, 409);
  assert.deepEqual(f.saved(pending.id), before);
});

test('FR-004: Draft cannot be approved even by its dual-role owner', async (t) => {
  const f = await fixture(t);
  const draft = await f.create('carol');
  const before = f.saved(draft.id);
  const result = await f.call('POST', `/requests/${draft.id}/approve`, 'carol', { version: 1 });
  assert.equal(result.status, 403);
  assert.deepEqual(f.saved(draft.id), before);
});
