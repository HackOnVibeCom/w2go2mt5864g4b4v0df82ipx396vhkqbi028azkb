// One-time Cloudflare setup: create (or find) the D1 database, write its id into
// wrangler.toml and apply the schema. Run `npx wrangler login` first.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const W = 'npx --yes wrangler@4.45.0';
const PLACEHOLDER = 'REPLACE_WITH_D1_DATABASE_ID';
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;

let toml = readFileSync('wrangler.toml', 'utf8');
if (toml.includes(PLACEHOLDER)) {
  let id = null;
  try {
    const list = JSON.parse(execSync(`${W} d1 list --json`, { encoding: 'utf8', stdio: ['inherit', 'pipe', 'inherit'] }));
    id = list.find((d) => d.name === 'tapsplit')?.uuid ?? null;
  } catch {
    id = null;
  }
  if (!id) {
    const out = execSync(`${W} d1 create tapsplit`, { encoding: 'utf8', stdio: ['inherit', 'pipe', 'inherit'] });
    process.stdout.write(out);
    id = out.match(UUID)?.[0] ?? null;
  }
  if (!id) {
    console.error('Could not read the D1 database id. Paste it into wrangler.toml by hand.');
    process.exit(1);
  }
  toml = toml.replace(PLACEHOLDER, id);
  writeFileSync('wrangler.toml', toml);
  console.log(`Using D1 database ${id}`);
}

execSync(`${W} d1 migrations apply tapsplit --remote`, { stdio: 'inherit' });
console.log('\nDatabase ready. Next: npm run cf:deploy');
