import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const label = process.argv[2] || 'final';
if (!/^[a-z0-9-]+$/.test(label)) throw new Error('Evidence label must use lowercase letters, digits and hyphens.');
const output = resolve(root, 'evidence');
mkdirSync(output, { recursive: true });
const tests = readdirSync(resolve(root, 'tests')).filter((x) => x.endsWith('.test.mjs')).sort().map((x) => `tests/${x}`);
const commands = [
  ['build', ['scripts/build.mjs']],
  ['test', ['--test', '--experimental-test-isolation=none', '--test-reporter=tap', ...tests]],
  ['demo', ['scripts/demo.mjs']],
];
const summary = { recordedAt: new Date().toISOString(), node: process.version, sqlite: process.versions.sqlite,
  platform: process.platform, architecture: process.arch, label, results: [], sha256: {} };
for (const [name, args] of commands) {
  const started = Date.now();
  const result = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', timeout: 120000, windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
  const transcript = `Command: node ${args.join(' ')}\nExit code: ${result.status}\n` +
    `Duration ms: ${Date.now() - started}\n\nSTDOUT\n${result.stdout || ''}\nSTDERR\n${result.stderr || ''}` +
    (result.error ? `\nPROCESS ERROR\n${result.error.stack}\n` : '');
  const filename = `${label}-${name}.txt`;
  writeFileSync(resolve(output, filename), transcript);
  const record = { name, command: `node ${args.join(' ')}`, exitCode: result.status, evidence: filename };
  if (name === 'test') for (const key of ['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo']) {
    record[key] = Number(new RegExp(`# ${key} (\\d+)`).exec(result.stdout || '')?.[1] ?? NaN);
  }
  summary.results.push(record);
  console.log(`${name}: ${result.status === 0 ? 'PASS' : 'FAIL'} (${filename})`);
  if (result.status !== 0 || result.error) { process.exitCode = 1; break; }
}
function fingerprint(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) fingerprint(path);
    else summary.sha256[relative(root, path).replaceAll('\\', '/')] = createHash('sha256').update(readFileSync(path)).digest('hex');
  }
}
for (const directory of ['src', 'tests', 'scripts']) fingerprint(resolve(root, directory));
summary.sha256['package.json'] = createHash('sha256').update(readFileSync(resolve(root, 'package.json'))).digest('hex');
writeFileSync(resolve(output, `${label}-summary.json`), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary.results));
