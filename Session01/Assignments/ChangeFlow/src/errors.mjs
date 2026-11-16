export class FlowError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'FlowError';
    this.code = code;
  }
}

export function fail(code, message) {
  throw new FlowError(code, message);
}
