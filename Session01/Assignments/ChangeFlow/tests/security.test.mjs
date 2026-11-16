import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, content } from './helpers/fixture.mjs';
import { setRoles, deactivate, revokeTokens } from '../src/admin.mjs';

test('FR-008: missing, forged and malformed credentials cannot read or create', async (t) => {
  const f = await fixture(t);
  for (const user of [null, 'unknown-token']) {
    assert.equal((await f.call('GET', '/requests', user)).status, 401);
    assert.equal((await f.call('POST', '/requests', user, content, { 'X-User-Id': 'alice', 'X-Role': 'Reviewer' })).status, 401);
  }
  const malformed = await f.call('GET', '/requests', 'alice', undefined, { Authorization: 'Basic alice' });
  assert.equal(malformed.status, 401);
  assert.equal(malformed.headers.get('www-authenticate'), 'Bearer');
  assert.equal((await f.call('GET', '/requests')).body.items.length, 0);
});

test('FR-009: visibility separates own requests and reviewers non-Draft scope', async (t) => {
  const f = await fixture(t);
  const draft = await f.create();
  const pending = await f.pending();
  const ownOther = await f.create('dana');
  const dualDraft = await f.create('carol');
  assert.deepEqual((await f.call('GET', '/requests', 'bob')).body.items.map((x) => x.id), [pending.id]);
  assert.deepEqual(new Set((await f.call('GET', '/requests', 'alice')).body.items.map((x) => x.id)), new Set([draft.id, pending.id]));
  assert.deepEqual(new Set((await f.call('GET', '/requests', 'carol')).body.items.map((x) => x.id)), new Set([pending.id, dualDraft.id]));
  for (const [id, user] of [[draft.id, 'bob'], [pending.id, 'dana'], [ownOther.id, 'alice']]) {
    assert.equal((await f.call('GET', `/requests/${id}`, user)).status, 404);
  }
  assert.equal((await f.call('GET', '/requests/00000000-0000-4000-8000-000000000000')).status, 404);
});

test('FR-009: pagination is bounded, stable and does not duplicate visible rows', async (t) => {
  const f = await fixture(t);
  await f.create(); await f.create(); await f.create('dana');
  const all = (await f.call('GET', '/requests')).body.items;
  const first = await f.call('GET', '/requests?limit=1&offset=0');
  const next = await f.call('GET', '/requests?limit=1&offset=1');
  assert.equal(first.body.items.length, 1);
  assert.equal(first.body.items[0].id, all[0].id);
  assert.equal(next.body.items[0].id, all[1].id);
  assert.equal((await f.call('GET', '/requests?offset=2')).body.items.length, 0);
  for (const query of ['limit=0', 'limit=101', 'offset=-1', 'limit=1.5', 'offset=1000001', 'limit=1&limit=2', 'role=Reviewer', '__proto__=x']) {
    assert.equal((await f.call('GET', `/requests?${query}`)).status, 400, query);
  }
});

test('FR-008/015: committed role revocation affects the next decision with the same token', async (t) => {
  const f = await fixture(t);
  const pending = await f.pending();
  const before = f.saved(pending.id);
  setRoles(f.store, 'bob', []);
  assert.equal((await f.call('POST', `/requests/${pending.id}/approve`, 'bob', { version: 2 })).status, 404);
  assert.deepEqual(f.saved(pending.id), before);
  setRoles(f.store, 'bob', ['Reviewer']);
  assert.equal((await f.call('POST', `/requests/${pending.id}/approve`, 'bob', { version: 2 })).status, 200);
});

test('FR-008/015: token revocation and deactivation reject subsequent writes without mutation', async (t) => {
  const f = await fixture(t);
  const pending = await f.pending();
  const before = f.saved(pending.id);
  revokeTokens(f.store, 'bob');
  assert.equal((await f.call('POST', `/requests/${pending.id}/approve`, 'bob', { version: 2 })).status, 401);
  deactivate(f.store, 'alice');
  assert.equal((await f.call('GET', `/requests/${pending.id}`)).status, 401);
  assert.deepEqual(f.saved(pending.id), before);
});

test('FR-002/003/008: visibility grants neither ownership nor a missing action role', async (t) => {
  const f = await fixture(t);
  assert.equal((await f.call('POST', '/requests', 'bob', content)).status, 403);
  const pending = await f.pending();
  const before = f.saved(pending.id);
  for (const [method, suffix, user, body] of [
    ['PUT', '', 'carol', { ...content, version: 2 }],
    ['POST', '/submit', 'carol', { version: 2 }],
    ['POST', '/approve', 'alice', { version: 2 }],
  ]) {
    assert.equal((await f.call(method, `/requests/${pending.id}${suffix}`, user, body)).status, 403);
    assert.deepEqual(f.saved(pending.id), before);
  }
  setRoles(f.store, 'alice', ['Reviewer']);
  assert.equal((await f.call('POST', `/requests/${pending.id}/submit`, 'alice', { version: 2 })).status, 403);
  assert.deepEqual(f.saved(pending.id), before);
});

test('FR-012: exact shape and text limits reject forged or invalid content', async (t) => {
  const f = await fixture(t);
  for (const input of [null, [], {}, { ...content, requesterId: 'bob' }, { ...content, status: 'Approved' },
    { ...content, roles: ['Reviewer'] }, { ...content, title: '' }, { ...content, title: '   ' },
    { ...content, title: 42 }, { ...content, title: 'x'.repeat(201) },
    { ...content, description: 'x'.repeat(10001) }, { ...content, reason: 'x'.repeat(2001) },
    { ...content, reason: 'bad\u0000text' }]) {
    assert.equal((await f.call('POST', '/requests', 'alice', input)).status, 400);
  }
  assert.equal((await f.call('GET', '/requests')).body.items.length, 0);
  const valid = await f.call('POST', '/requests', 'alice', { ...content, title: `  ${'😀'.repeat(200)}  ` });
  assert.equal(valid.status, 201);
  assert.equal([...valid.body.title].length, 200);
});

test('FR-012: version is mandatory and must be a positive safe integer', async (t) => {
  const f = await fixture(t);
  const draft = await f.create();
  const before = f.saved(draft.id);
  for (const body of [{}, { version: 0 }, { version: -1 }, { version: 1.1 }, { version: '1' },
    { version: null }, { version: Number.MAX_SAFE_INTEGER }, { version: 1, status: 'Approved' }]) {
    assert.equal((await f.call('POST', `/requests/${draft.id}/submit`, 'alice', body)).status, 400);
    assert.deepEqual(f.saved(draft.id), before);
  }
});

test('FR-016: malformed JSON, content type, oversized body and invalid id have defined errors', async (t) => {
  const f = await fixture(t);
  const headers = { Authorization: `Bearer ${f.tokens.alice}`, 'Content-Type': 'application/json' };
  const invalid = await fetch(f.base + '/requests', { method: 'POST', headers, body: '{' });
  assert.equal(invalid.status, 400); assert.equal((await invalid.json()).error.code, 'InvalidJson');
  const wrongType = await f.call('POST', '/requests', 'alice', content, { 'Content-Type': 'text/plain' });
  assert.equal(wrongType.status, 415);
  const large = await f.call('POST', '/requests', 'alice', { ...content, description: 'x'.repeat(70000) });
  assert.equal(large.status, 413);
  assert.equal((await f.call('GET', '/requests/not-a-uuid')).status, 400);
  assert.equal((await f.call('GET', '/requests')).body.items.length, 0);
});

test('FR-016: methods and routes are explicit and do not expose unsupported delete', async (t) => {
  const f = await fixture(t);
  const draft = await f.create();
  const before = f.saved(draft.id);
  const result = await f.call('DELETE', `/requests/${draft.id}`);
  assert.equal(result.status, 405);
  assert.equal(result.headers.get('allow'), 'GET, PUT');
  assert.equal((await f.call('GET', '/unknown')).status, 404);
  assert.equal((await f.call('GET', `/requests/${draft.id}?role=Reviewer`)).status, 400);
  assert.deepEqual(f.saved(draft.id), before);
});

test('F1 FR-011/012: malformed Unicode is rejected before it can change in storage', async (t) => {
  const f = await fixture(t);
  for (const field of ['title', 'description', 'reason']) {
    for (const text of ['\ud800', '\udc00', 'prefix\ud800suffix']) {
      const result = await f.call('POST', '/requests', 'alice', { ...content, [field]: text });
      if (result.status === 201) t.diagnostic(JSON.stringify({
        field, responseText: result.body[field], persistedText: f.saved(result.body.id)[field],
      }));
      assert.equal(result.status, 400, `Malformed Unicode in ${field} must not be accepted.`);
    }
  }
  assert.equal((await f.call('GET', '/requests')).body.items.length, 0);
  const draft = await f.create();
  const draftBefore = f.saved(draft.id);
  assert.equal((await f.call('PUT', `/requests/${draft.id}`, 'alice', { ...content, description: '\ud800', version: 1 })).status, 400);
  assert.deepEqual(f.saved(draft.id), draftBefore);
  const pending = await f.pending();
  const pendingBefore = f.saved(pending.id);
  assert.equal((await f.call('POST', `/requests/${pending.id}/request-changes`, 'bob', { version: 2, feedback: '\udc00' })).status, 400);
  assert.deepEqual(f.saved(pending.id), pendingBefore);
});

test('F1 FR-011: valid Persian and supplementary Unicode round trip without content loss', async (t) => {
  const f = await fixture(t);
  const input = { title: '  تغییر جدید 😀  ', description: 'حفظ متن و نیم‌فاصله 🧪', reason: 'بررسی دقیق 🚀' };
  const result = await f.call('POST', '/requests', 'alice', input);
  assert.equal(result.status, 201);
  const read = await f.call('GET', `/requests/${result.body.id}`);
  assert.deepEqual(read.body, result.body);
  const stored = f.saved(result.body.id);
  for (const field of ['title', 'description', 'reason']) assert.equal(stored[field], input[field].trim());
});
