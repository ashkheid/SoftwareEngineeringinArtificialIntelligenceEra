import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function imports(file) {
  const source = readFileSync(new URL(`../src/${file}.mjs`, import.meta.url), 'utf8');
  return [...source.matchAll(/(?:from\s+|import\s*)['"]([^'"]+)['"]/g)].map((m) => m[1]);
}

test('Constitution I: Domain imports no transport, application or storage modules', () => {
  for (const dependency of imports('domain')) assert.equal(dependency, './errors.mjs');
});

test('Constitution I: Application and persistence do not depend on HTTP', () => {
  for (const file of ['application', 'database']) {
    assert.ok(imports(file).every((dependency) => !/http|server/.test(dependency)), file);
  }
  assert.ok(imports('application').every((dependency) => !/sqlite|database/.test(dependency)));
});

test('Constitution I: HTTP depends only on transport and symbolic errors', () => {
  for (const dependency of imports('http')) assert.ok(['node:http', './errors.mjs'].includes(dependency));
  // This supplements, rather than replaces, source inspection of policy placement.
});
