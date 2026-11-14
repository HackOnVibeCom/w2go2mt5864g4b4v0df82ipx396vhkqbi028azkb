// Deploy the Worker, then remember its URL so the static HackOnVibe build points at it.
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

let out = '';
try {
  out = execSync('npx --yes wrangler@4.45.0 deploy', { encoding: 'utf8', stdio: ['inherit', 'pipe', 'inherit'] });
  process.stdout.write(out);
} catch (err) {
  const text = String(err.stdout ?? '');
  process.stdout.write(text);
  if (/workers\.dev subdomain/i.test(text)) {
    console.error(
      '\nYour Cloudflare account has no workers.dev subdomain yet (a one-time, free step).\n' +
        'Run `npx --yes wrangler@4.45.0 deploy` directly in your terminal: it asks to register one;\n' +
        'answer yes and pick a name. Then run `npm run cf:deploy` again to save the URL.',
    );
  } else {
    console.error('\nwrangler deploy failed; see the messages above.');
  }
  process.exit(1);
}

const url = out.match(/https:\/\/[a-z0-9.-]+\.workers\.dev/i)?.[0];
if (url) {
  writeFileSync('deploy.config.json', `${JSON.stringify({ api: url }, null, 2)}\n`);
  console.log(`\nLive at ${url}\nSaved to deploy.config.json. Commit it and push to main so the HackOnVibe subdomain uses this backend.`);
} else {
  console.warn('\nDeployed, but could not find the workers.dev URL in the output. Put it in deploy.config.json as {"api": "<url>"}.');
}
