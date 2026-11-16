import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openStore, tokenDigest } from './database.mjs';
import { fail, FlowError } from './errors.mjs';

// Trusted operational entry point: access to this CLI implies access to the database file.
export function seedDemo(store) {
  return store.transaction(() => {
    if (store.db.prepare('SELECT count(*) AS count FROM users').get().count !== 0) {
      fail('InvalidState', 'Refusing to reseed an existing user population.');
    }
    const credentials = {};
    for (const [id, requester, reviewer] of [['alice', 1, 0], ['bob', 0, 1], ['carol', 1, 1], ['dana', 1, 0]]) {
      store.db.prepare('INSERT INTO users VALUES (?,1,?,?)').run(id, requester, reviewer);
      const token = randomBytes(32).toString('base64url');
      store.db.prepare('INSERT INTO tokens VALUES (?,?,0)').run(tokenDigest(token), id);
      credentials[id] = token;
    }
    return credentials;
  });
}

function updateUser(store, id, sql, values) {
  return store.transaction(() => {
    if (typeof id !== 'string' || !store.db.prepare('SELECT id FROM users WHERE id=?').get(id)) {
      fail('NotFound', 'User not found.');
    }
    store.db.prepare(sql).run(...values, id);
  });
}

export function setRoles(store, id, roles) {
  if (!Array.isArray(roles) || new Set(roles).size !== roles.length
      || roles.some((role) => !['Requester', 'Reviewer'].includes(role))) {
    fail('InvalidInput', 'Roles must be Requester, Reviewer, both, or none.');
  }
  updateUser(store, id, 'UPDATE users SET requester=?,reviewer=? WHERE id=?',
    [Number(roles.includes('Requester')), Number(roles.includes('Reviewer'))]);
}

export function deactivate(store, id) {
  updateUser(store, id, 'UPDATE users SET active=0 WHERE id=?', []);
}

export function revokeTokens(store, id) {
  updateUser(store, id, 'UPDATE tokens SET revoked=1 WHERE user_id=?', []);
}

function main(args) {
  const [command, id, roles] = args;
  const expected = { 'init-demo': 1, 'set-roles': 3, deactivate: 2, 'revoke-tokens': 2 };
  if (!Object.hasOwn(expected, command) || args.length !== expected[command]) {
    fail('InvalidInput', 'Usage: init-demo | set-roles <id> <Requester,Reviewer|none> | deactivate <id> | revoke-tokens <id>');
  }
  const store = openStore(process.env.CHANGEFLOW_DB || 'data/changeflow.sqlite');
  try {
    if (command === 'init-demo') console.log(JSON.stringify(seedDemo(store), null, 2));
    else {
      if (command === 'set-roles') setRoles(store, id, roles === 'none' ? [] : roles.split(','));
      else if (command === 'deactivate') deactivate(store, id);
      else revokeTokens(store, id);
      console.log(JSON.stringify({ command, userId: id, ok: true }));
    }
  } finally { store.close(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)); }
  catch (error) {
    console.error(error instanceof FlowError ? `${error.code}: ${error.message}` : 'Operation failed.');
    process.exitCode = 1;
  }
}
