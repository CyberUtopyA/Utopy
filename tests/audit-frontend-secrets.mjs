// Read-only, redacted heuristic audit. Never prints matching values.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
const roots = process.argv.slice(2).map(p => resolve(p));
if (!roots.length) roots.push(resolve('.'));
const rules = [
  ['private PEM', /-----BEGIN (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----/g],
  ['provider secret', /\b(?:sk_(?:live|test)_[A-Za-z0-9]{12,}|sk-proj-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|AKIA[A-Z0-9]{16}|xox[baprs]-[A-Za-z0-9-]{20,}|AIza[A-Za-z0-9_-]{30,}|sb_secret_[A-Za-z0-9_-]{15,})\b/g],
  ['literal credential', /["']?(?:client_secret|api_secret|secret_key|private_key|service_role_key|access_token|api_key|apikey|password)["']?\s*[:=]\s*["']([^"'\r\n]{12,})["']/gi],
  ['private JWK material', /["']d["']\s*:\s*["'][A-Za-z0-9_-]{32,}["']/g],
];
let findings = 0, files = 0;
for (const root of roots) {
  const candidates = [];
  const walk = dir => { if (!existsSync(dir)) return; for (const entry of readdirSync(dir,{withFileTypes:true})) {
    if (entry.isSymbolicLink()) continue;
    const path = join(dir,entry.name);
    if (entry.isDirectory()) walk(path);
    else if (/\.(?:[cm]?[jt]sx?|json|html|php|css|map|pem|key|p12|pfx|ya?ml|txt)$/i.test(entry.name) || entry.name.startsWith('.env')) candidates.push(path);
  }};
  for (const folder of ['src','public','dist']) walk(join(root,folder));
  for (const entry of readdirSync(root,{withFileTypes:true})) if (entry.isFile() && (/^\.env/.test(entry.name) || /^vite\.config\./.test(entry.name))) candidates.push(join(root,entry.name));
  for (const path of candidates) {
    if (statSync(path).size > 30_000_000) continue;
    files++;
    const content = readFileSync(path,'utf8');
    for (const [label, pattern] of rules) {
      pattern.lastIndex = 0;
      for (const match of content.matchAll(pattern)) {
        if (label === 'literal credential' && /example|placeholder|your[_ -]|process\.env|import\.meta|\$\{|getenv|test[_-]|demo[_-]/i.test(match[1])) continue;
        console.log(`${root}: ${relative(root,path)}:${content.slice(0,match.index).split('\n').length} [${label}; REDACTED]`); findings++;
      }
    }
    // JWTs may be public anon keys; only flag server/admin roles or embedded sessions.
    for (const match of content.matchAll(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)) {
      try { const payload = JSON.parse(Buffer.from(match[0].split('.')[1],'base64url').toString());
        if (['service_role','supabase_admin','authenticated'].includes(payload.role) || payload.session_id) { console.log(`${root}: ${relative(root,path)} [privileged/session JWT; REDACTED]`); findings++; }
      } catch {}
    }
  }
}
console.log(`Scanned ${files} files; ${findings} potential findings. Heuristic only, not a security certification.`);
process.exitCode = findings ? 1 : 0;
