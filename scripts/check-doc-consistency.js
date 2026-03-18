/**
 * Check that docs do not contain outdated or inaccurate strings (code is source of truth).
 * Run: node scripts/check-doc-consistency.js
 * Exits 0 if OK, 1 if any pattern is found in *.md files.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), process.argv[2] || '.');

const FORBIDDEN = [
  { pattern: /React\s+18\b/, message: 'Use React 19 (see package.json)' },
  { pattern: /[-*]\s*`?\/api\/projects\/search`?|GET\s+\/api\/projects\/search/, message: 'App uses components/search_projects; do not list projects/search as app endpoint' },
];

function findMdFiles(dir, files = []) {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.name === 'node_modules' || e.name === '.git') continue;
    if (e.isDirectory()) findMdFiles(full, files);
    else if (e.name.endsWith('.md')) files.push(full);
  }
  return files;
}

const mdFiles = findMdFiles(ROOT);
let failed = false;

for (const file of mdFiles) {
  const rel = file.replace(ROOT + '/', '').replace(ROOT + '\\', '');
  const content = readFileSync(file, 'utf8');
  for (const { pattern, message } of FORBIDDEN) {
    const match = pattern.exec(content);
    if (match) {
      console.error(`\x1b[31m${rel}\x1b[0m: ${message}`);
      console.error(`  Match: ${match[0]}`);
      failed = true;
    }
  }
}

if (failed) {
  console.error('\nDoc consistency check failed. Update docs to match code (see CLAUDE.md "Documentation principle").\n');
  process.exit(1);
}
console.log('Doc consistency check passed.');
process.exit(0);
