import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
assert.match(css, /@import "tailwindcss" source\("\.\/"\)/);
assert.match(css, /@source "\.\.\/index\.html"/);
console.log('OK: Tailwind scans source and entry HTML, not generated artifacts.');
