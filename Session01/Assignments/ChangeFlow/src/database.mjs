import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { FlowError } from './errors.mjs';

export const tokenDigest = (token) => createHash('sha256').update(token).digest('hex');

const fields = [
  ['id', 'id'], ['title', 'title'], ['description', 'description'], ['reason', 'reason'],
  ['requester_id', 'requesterId'], ['status', 'status'], ['version', 'version'],
  ['created_at', 'createdAt'], ['updated_at', 'updatedAt'], ['feedback', 'feedback'],
  ['feedback_by', 'feedbackBy'], ['feedback_at', 'feedbackAt'],
  ['approved_by', 'approvedBy'], ['approved_at', 'approvedAt'], ['approved_version', 'approvedVersion'],
];
const fromRow = (row) => row && Object.fromEntries(fields.map(([sql, js]) => [js, row[sql]]));

function storageError(error) {
  if (error.code !== 'ERR_SQLITE_ERROR') return error;
  const primary = error.errcode & 0xff;
  return primary === 5 || primary === 6
    ? new FlowError('StorageBusy', 'Storage is busy. Retry after reading the current request.')
    : new FlowError('StorageFailure', 'The operation could not be persisted.');
}

class Store {
  constructor(filename, timeout) {
    if (filename !== ':memory:') mkdirSync(dirname(resolve(filename)), { recursive: true });
    this.db = new DatabaseSync(filename, { timeout });
    try {
      this.db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;');
      this.transaction(() => {
        const version = this.db.prepare('PRAGMA user_version').get().user_version;
        if (version > 1) throw new Error('Unsupported database schema version.');
        if (version === 1) return;
        this.db.exec(`
          CREATE TABLE users (
            id TEXT PRIMARY KEY,
            active INTEGER NOT NULL CHECK(active IN (0,1)),
            requester INTEGER NOT NULL CHECK(requester IN (0,1)),
            reviewer INTEGER NOT NULL CHECK(reviewer IN (0,1))
          ) STRICT;
          CREATE TABLE tokens (
            digest TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id),
            revoked INTEGER NOT NULL CHECK(revoked IN (0,1))
          ) STRICT;
          CREATE TABLE change_requests (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 200),
            description TEXT NOT NULL CHECK(length(description) BETWEEN 1 AND 10000),
            reason TEXT NOT NULL CHECK(length(reason) BETWEEN 1 AND 2000),
            requester_id TEXT NOT NULL REFERENCES users(id),
            status TEXT NOT NULL CHECK(status IN ('Draft','PendingReview','ChangesRequested','Approved')),
            version INTEGER NOT NULL CHECK(version BETWEEN 1 AND 9007199254740991),
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            feedback TEXT CHECK(feedback IS NULL OR length(feedback) BETWEEN 1 AND 2000),
            feedback_by TEXT REFERENCES users(id),
            feedback_at TEXT,
            approved_by TEXT REFERENCES users(id),
            approved_at TEXT,
            approved_version INTEGER,
            CHECK((feedback IS NULL AND feedback_by IS NULL AND feedback_at IS NULL)
               OR (feedback IS NOT NULL AND feedback_by IS NOT NULL AND feedback_at IS NOT NULL)),
            CHECK((status <> 'Approved' AND approved_by IS NULL AND approved_at IS NULL AND approved_version IS NULL)
               OR (status = 'Approved' AND approved_by IS NOT NULL AND approved_by <> requester_id
                   AND approved_at IS NOT NULL AND approved_version IS NOT NULL
                   AND approved_version >= 1 AND approved_version = version - 1))
          ) STRICT;
          CREATE INDEX requests_owner ON change_requests(requester_id,created_at,id);
          CREATE INDEX requests_status ON change_requests(status,created_at,id);
          PRAGMA user_version=1;
        `);
      });
    } catch (error) {
      this.db.close();
      throw error;
    }
  }

  transaction(work, write = true) {
    try {
      this.db.exec(write ? 'BEGIN IMMEDIATE' : 'BEGIN');
      const result = work();
      if (result && typeof result.then === 'function') throw new TypeError('Transactions must be synchronous.');
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      if (this.db.isTransaction) this.db.exec('ROLLBACK');
      throw storageError(error);
    }
  }

  findActor(token) {
    if (typeof token !== 'string' || token.length === 0) return undefined;
    const row = this.db.prepare(`SELECT u.id,u.requester,u.reviewer FROM users u
      JOIN tokens t ON t.user_id=u.id WHERE t.digest=? AND t.revoked=0 AND u.active=1`)
      .get(tokenDigest(token));
    return row && { id: row.id, requester: row.requester === 1, reviewer: row.reviewer === 1 };
  }

  getRequest(id) {
    return fromRow(this.db.prepare('SELECT * FROM change_requests WHERE id=?').get(id));
  }

  listRequests(actor, limit, offset) {
    return this.db.prepare(`SELECT * FROM change_requests
      WHERE (?=1 AND requester_id=?) OR (?=1 AND status<>'Draft')
      ORDER BY created_at,id LIMIT ? OFFSET ?`)
      .all(Number(actor.requester), actor.id, Number(actor.reviewer), limit, offset).map(fromRow);
  }

  insertRequest(request) {
    this.db.prepare(`INSERT INTO change_requests (${fields.map(([sql]) => sql).join(',')})
      VALUES (${fields.map(() => '?').join(',')})`).run(...fields.map(([, js]) => request[js]));
  }

  updateRequest(request, expectedVersion) {
    const mutable = fields.filter(([, js]) => !['id', 'requesterId', 'createdAt'].includes(js));
    const result = this.db.prepare(`UPDATE change_requests SET ${mutable.map(([sql]) => `${sql}=?`).join(',')}
      WHERE id=? AND version=?`).run(...mutable.map(([, js]) => request[js]), request.id, expectedVersion);
    if (result.changes !== 1) throw new FlowError('VersionConflict', 'The request changed. Read it again.');
  }

  close() { this.db.close(); }
}

export function openStore(filename, { timeout = 5000 } = {}) {
  return new Store(filename, timeout);
}
