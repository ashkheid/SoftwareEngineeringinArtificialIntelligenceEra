import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, mkdirSync, rmSync, copyFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const destination = resolve(root, 'dist');
const sources = readdirSync(resolve(root, 'src')).filter((name) => name.endsWith('.mjs')).sort();
for (const name of sources) {
  const result = spawnSync(process.execPath, ['--check', resolve(root, 'src', name)], { encoding: 'utf8', windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Syntax check failed for ${name}: ${result.stderr}`);
}
// Only replace this project's exact generated dist directory, after checking its absolute parent.
if (dirname(destination) !== resolve(root) || destination !== resolve(root, 'dist')) throw new Error('Unsafe output path.');
rmSync(destination, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
mkdirSync(resolve(destination, 'src'), { recursive: true });
for (const name of sources) copyFileSync(resolve(root, 'src', name), resolve(destination, 'src', name));
const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
manifest.scripts = { start: 'node src/server.mjs', seed: 'node src/admin.mjs init-demo' };
writeFileSync(resolve(destination, 'package.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`PASS: syntax checked ${sources.length} runtime modules; assembled dist/src and dist/package.json.`);
console.log('JavaScript source is directly executable; no transpilation or external dependency restore.');
