import { randomUUID } from 'node:crypto';
import { canRead, createDraft, applyChange } from './domain.mjs';
import { fail } from './errors.mjs';

function validateId(id) {
  if (typeof id !== 'string' || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id)) {
    fail('InvalidInput', 'A UUID request id is required.');
  }
}

export class ChangeFlow {
  constructor(store) { this.store = store; }

  actor(token) {
    const actor = this.store.findActor(token);
    if (!actor) fail('Unauthenticated', 'A valid active credential is required.');
    return actor;
  }

  visible(actor, id) {
    const request = this.store.getRequest(id);
    if (!request || !canRead(actor, request)) fail('NotFound', 'Request not found.');
    return request;
  }

  create(token, input) {
    return this.store.transaction(() => {
      const request = createDraft(this.actor(token), input, randomUUID(), new Date().toISOString());
      this.store.insertRequest(request);
      return request;
    });
  }

  get(token, id) {
    validateId(id);
    return this.store.transaction(() => this.visible(this.actor(token), id), false);
  }

  list(token, query = {}) {
    return this.store.transaction(() => {
      const actor = this.actor(token);
      if (Object.keys(query).some((key) => !['limit', 'offset'].includes(key))) fail('InvalidQuery', 'Unknown query field.');
      const values = {};
      for (const [key, fallback, minimum, maximum] of [['limit', 20, 1, 100], ['offset', 0, 0, 1000000]]) {
        const text = query[key];
        const value = text === undefined ? fallback : Number(text);
        if ((text !== undefined && !/^\d+$/.test(text)) || !Number.isInteger(value) || value < minimum || value > maximum) {
          fail('InvalidQuery', `${key} is outside the documented range.`);
        }
        values[key] = value;
      }
      return { items: this.store.listRequests(actor, values.limit, values.offset), ...values };
    }, false);
  }

  change(token, id, action, input) {
    validateId(id);
    return this.store.transaction(() => {
      const actor = this.actor(token);
      const current = this.visible(actor, id);
      const updated = applyChange(actor, current, action, input, new Date().toISOString());
      this.store.updateRequest(updated, current.version);
      return updated;
    });
  }
}
