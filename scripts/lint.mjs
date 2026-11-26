import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { transformSync } from 'esbuild';

const ROOTS = ['api', 'src', 'tests', 'scripts', 'vite.config.js'];
const FORBIDDEN_PATTERNS = [
  { pattern: /\bwindow\.(alert|confirm|prompt)\s*\(/, message: 'Avoid blocking browser dialogs' },
  { pattern: /dangerouslySetInnerHTML|\binnerHTML\s*=/, message: 'Avoid raw HTML injection sinks' },
  { pattern: /\b(nvapi-[A-Za-z0-9_-]{10,}|sb_secret_[A-Za-z0-9_-]{10,})/, message: 'Hardcoded secret pattern detected' },
  { pattern: /^\s*var\s+/m, message: 'Use const or let instead of var' },
];

function collectCodeFiles(entry, acc = []) {
  const stat = statSync(entry);
  if (stat.isDirectory()) {
    for (const name of readdirSync(entry)) {
      if (name.startsWith('.tmp-')) continue;
      collectCodeFiles(join(entry, name), acc);
    }
    return acc;
  }
  if (/\.(js|jsx|mjs)$/.test(entry)) acc.push(entry);
  return acc;
}

const files = ROOTS.flatMap((root) => collectCodeFiles(root));
const failures = [];

for (const file of files) {
  const content = readFileSync(file, 'utf8');
  const loader = file.endsWith('.jsx') ? 'jsx' : 'js';
  try {
    transformSync(content, { loader, format: 'esm' });
  } catch (error) {
    failures.push(`${file}: syntax error (${error.message})`);
  }
  if (file.startsWith('api') || file.startsWith('src')) {
    for (const { pattern, message } of FORBIDDEN_PATTERNS) {
      if (pattern.test(content)) {
        failures.push(`${file}: ${message}`);
      }
    }
  }
}

if (failures.length) {
  console.error('Lint checks failed:\n' + failures.map((item) => `  - ${item}`).join('\n'));
  process.exit(1);
}

console.log(`Lint passed across ${files.length} source and test files.`);
