import { parentPort, workerData } from 'node:worker_threads';
import { openStore } from '../../src/database.mjs';
import { ChangeFlow } from '../../src/application.mjs';

const store = openStore(workerData.filename);
try {
  parentPort.postMessage({ type: 'ready' });
  const gate = new Int32Array(workerData.gate);
  if (Atomics.wait(gate, 0, 0, 10000) === 'timed-out') throw new Error('Start barrier timed out.');
  const service = new ChangeFlow(store);
  try {
    const value = service.change(workerData.token, workerData.id, workerData.action, workerData.input);
    parentPort.postMessage({ type: 'result', ok: true, value });
  } catch (error) {
    parentPort.postMessage({ type: 'result', ok: false, code: error.code || error.name });
  }
} finally { store.close(); parentPort.close(); }
