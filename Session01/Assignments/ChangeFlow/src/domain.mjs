import { fail } from './errors.mjs';

const shapes = {
  create: ['title', 'description', 'reason'],
  edit: ['title', 'description', 'reason', 'version'],
  submit: ['version'], approve: ['version'], 'request-changes': ['version', 'feedback'],
};
const limits = { title: 200, description: 10000, reason: 2000, feedback: 2000 };

export function validateFields(input, kind) {
  const keys = shapes[kind];
  if (!keys || !input || typeof input !== 'object' || Array.isArray(input)
      || Object.keys(input).length !== keys.length || keys.some((key) => !Object.hasOwn(input, key))) {
    fail('InvalidInput', 'Supply exactly the documented fields.');
  }
  const result = {};
  for (const key of keys) {
    const value = input[key];
    if (key === 'version') {
      if (!Number.isSafeInteger(value) || value < 1 || value >= Number.MAX_SAFE_INTEGER) {
        fail('InvalidInput', 'version must be a positive safe integer below the maximum.');
      }
      result[key] = value;
    } else {
      if (typeof value !== 'string' || !value.trim() || [...value.trim()].length > limits[key]
          || !value.isWellFormed() || value.includes('\u0000')) fail('InvalidInput', `${key} is empty, too long or invalid.`);
      result[key] = value.trim();
    }
  }
  return result;
}

export function canRead(actor, request) {
  return (actor.requester && request.requesterId === actor.id)
    || (actor.reviewer && request.status !== 'Draft');
}

export function createDraft(actor, input, id, now) {
  const content = validateFields(input, 'create');
  if (!actor.requester) fail('Forbidden', 'The current Requester role is required.');
  return { id, ...content, requesterId: actor.id, status: 'Draft', version: 1,
    createdAt: now, updatedAt: now, feedback: null, feedbackBy: null, feedbackAt: null,
    approvedBy: null, approvedAt: null, approvedVersion: null };
}

export function applyChange(actor, request, action, input, now) {
  const values = validateFields(input, action);
  const review = action === 'approve' || action === 'request-changes';
  if (review) {
    if (!actor.reviewer) fail('Forbidden', 'The current Reviewer role is required.');
    if (request.requesterId === actor.id) fail('SelfReview', 'A request must be reviewed by another person.');
  } else if (!actor.requester || request.requesterId !== actor.id) {
    fail('Forbidden', 'Only the owner with the current Requester role may do this.');
  }
  if (values.version !== request.version) fail('VersionConflict', 'The request changed. Read it again.');
  if (review ? request.status !== 'PendingReview' : !['Draft', 'ChangesRequested'].includes(request.status)) {
    fail('InvalidState', 'This action is not allowed in the current state.');
  }
  const updated = { ...request, version: request.version + 1, updatedAt: now };
  if (action === 'edit') {
    updated.title = values.title;
    updated.description = values.description;
    updated.reason = values.reason;
  } else if (action === 'submit') updated.status = 'PendingReview';
  else if (action === 'approve') {
    updated.status = 'Approved';
    updated.approvedBy = actor.id;
    updated.approvedAt = now;
    updated.approvedVersion = request.version;
  } else {
    updated.status = 'ChangesRequested';
    updated.feedback = values.feedback;
    updated.feedbackBy = actor.id;
    updated.feedbackAt = now;
  }
  return updated;
}
