import { lstatSync, readdirSync, readFileSync, realpathSync, unlinkSync } from 'node:fs';
import { dirname, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

// Cloudflare's Vite plugin copies local dotenv values to dist/server/.dev.vars.
// They are development-only and must not be included in release artifacts.
const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(project, 'dist');
function insideOutput(path) {
  const rel = relative(output, realpathSync(path));
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) throw new Error('Unsafe build artifact path');
}
if (lstatSync(output).isSymbolicLink()) throw new Error('Build output must not be a symlink');
const values = { ...process.env };
for (const name of readdirSync(project).filter(name => /^\.env(?:\.|$)/.test(name) && name !== '.env.example')) {
  const path = resolve(project, name);
  if (lstatSync(path).isFile()) Object.assign(values, parseEnv(readFileSync(path, 'utf8')));
}
const secrets = Object.entries(values)
  .filter(([name, value]) => !name.startsWith('NEXT_PUBLIC_') && /SECRET|TOKEN|API_KEY|SERVICE_ROLE_KEY|PASSWORD|PRIVATE_KEY/.test(name) && value?.length >= 16)
  .map(([, value]) => value);
let removed = 0;
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name);
    if (entry.isSymbolicLink()) throw new Error('Symlinks are not allowed in release artifacts');
    insideOutput(path);
    if (entry.isDirectory()) { walk(path); continue; }
    if (/^\.dev\.vars(?:\.|$)/.test(entry.name)) {
      unlinkSync(path); // Only a verified generated file inside this project's dist.
      removed++;
      continue;
    }
    const content = readFileSync(path);
    if (secrets.some(value => content.includes(value))) {
      throw new Error(`Configured server credential found in release artifact: ${relative(output, path)}`);
    }
  }
}
walk(output);
console.log(`Release artifact scan passed. Removed ${removed} generated development-secret file(s). No source environment files were changed.`);
