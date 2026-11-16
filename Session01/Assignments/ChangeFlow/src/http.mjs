import { createServer } from 'node:http';
import { FlowError } from './errors.mjs';

const statuses = {
  InvalidInput: 400, InvalidJson: 400, InvalidQuery: 400, Unauthenticated: 401,
  Forbidden: 403, SelfReview: 403, NotFound: 404, MethodNotAllowed: 405,
  VersionConflict: 409, InvalidState: 409, PayloadTooLarge: 413, UnsupportedMediaType: 415,
  StorageBusy: 503, StorageFailure: 503,
};
const maxBody = 65536;

function jsonBody(request) {
  if (!/^application\/json(?:\s*;.*)?$/i.test(request.headers['content-type'] || '')) {
    request.resume();
    return Promise.reject(new FlowError('UnsupportedMediaType', 'Send application/json.'));
  }
  return new Promise((resolve, reject) => {
    let length = 0;
    const chunks = [];
    request.on('data', (chunk) => {
      length += chunk.length;
      if (length > maxBody) {
        chunks.length = 0;
        reject(new FlowError('PayloadTooLarge', 'The JSON body exceeds 65536 bytes.'));
      } else chunks.push(chunk);
    });
    request.on('end', () => {
      if (length > maxBody) return;
      try {
        const text = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
        resolve(JSON.parse(text));
      } catch { reject(new FlowError('InvalidJson', 'Send a valid UTF-8 JSON object.')); }
    });
    request.on('error', reject);
    request.on('aborted', () => reject(new FlowError('InvalidJson', 'The body was interrupted.')));
  });
}

function send(response, status, body, headers = {}) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  response.end(JSON.stringify(body));
}

export function createApi(service, { onError = (error) => console.error(JSON.stringify({ event: 'request-error', code: error.code || 'InternalError' })) } = {}) {
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost');
      const match = /^\/requests\/([^/]+)(?:\/(submit|approve|request-changes))?$/.exec(url.pathname);
      const collection = url.pathname === '/requests';
      if (!collection && !match) throw new FlowError('NotFound', 'Route not found.');
      const allowed = collection ? ['GET', 'POST'] : match[2] ? ['POST'] : ['GET', 'PUT'];
      if (!allowed.includes(request.method)) {
        response.setHeader('Allow', allowed.join(', '));
        throw new FlowError('MethodNotAllowed', 'Method not allowed.');
      }
      const query = {};
      for (const [key, value] of url.searchParams) {
        if (Object.hasOwn(query, key) || !(collection && request.method === 'GET')) {
          throw new FlowError('InvalidQuery', 'Duplicate or unsupported query field.');
        }
        Object.defineProperty(query, key, { value, enumerable: true });
      }
      const authorization = request.headers.authorization || '';
      const token = /^Bearer ([^\s]+)$/i.exec(authorization)?.[1];
      let result;
      if (request.method === 'GET') result = collection ? service.list(token, query) : service.get(token, match[1]);
      else {
        const body = await jsonBody(request);
        result = collection ? service.create(token, body)
          : service.change(token, match[1], match[2] || 'edit', body);
      }
      send(response, collection && request.method === 'POST' ? 201 : 200, result,
        collection && request.method === 'POST' ? { Location: `/requests/${result.id}` } : {});
    } catch (error) {
      const known = error instanceof FlowError && Object.hasOwn(statuses, error.code);
      if (!known) onError(error);
      const status = known ? statuses[error.code] : 500;
      const headers = {};
      if (status === 401) headers['WWW-Authenticate'] = 'Bearer';
      if (status === 503) headers['Retry-After'] = '1';
      if ([400, 413, 415].includes(status)) headers.Connection = 'close';
      if (!response.destroyed) send(response, status, { error: {
        code: known ? error.code : 'InternalError', message: known ? error.message : 'An unexpected error occurred.',
      } }, headers);
    }
  });
  server.requestTimeout = 10000;
  server.headersTimeout = 10000;
  return server;
}
