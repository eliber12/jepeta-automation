import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const expectedTracked = new Set([
  '.github/workflows/pages.yml',
  '.github/workflows/verify.yml',
  '.nojekyll',
  'README.md',
  'agent.json',
  'agents.json',
  'agents.txt',
  'docs/OUTREACH.md',
  'index.html',
  'index.md',
  'llms-full.txt',
  'llms.txt',
  'og-jepeta.svg',
  'openapi.json',
  'robots.txt',
  'sample-full-report.json',
  'scripts/live-smoke.mjs',
  'scripts/public-check.mjs',
  'site.css',
  'site.js',
  'sitemap.xml',
]);

const tracked = execFileSync('git',['ls-files'],{encoding:'utf8'})
  .split(/\r?\n/)
  .filter(Boolean)
  .sort();

assert.deepEqual(
  tracked,
  [...expectedTracked].sort(),
  'Public repository contains an unexpected or missing tracked file. Review it explicitly before publishing.'
);

for (const file of expectedTracked) await stat(file);

const html = await readFile('index.html','utf8');
const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
for (const href of [...html.matchAll(/\bhref="([^"]+)"/g)]
  .map(m=>m[1])
  .filter(x=>x.startsWith('#') && !x.startsWith('#i-') && x !== '#')) {
  assert.ok(ids.has(href.slice(1)), 'Missing anchor target: '+href);
}

for (const fragment of [
  'https://eliber12.github.io/jepeta-automation/',
  'https://app.virtuals.io/acp/agent/01a0b446-374c-7eb8-8fe8-cd1a9945ea70',
  'https://t.me/jepeta_tools',
  'https://t.me/Jepeta_bot',
  'openapi.json','agent.json','llms.txt','sample-full-report.json'
]) {
  assert.ok(html.includes(fragment), 'Missing public link: '+fragment);
}
assert.match(html,/Telegram Stars/);
assert.match(html,/Autonomous agents use Virtuals ACP at 0\.03 USDC/);

const textFiles = tracked.filter(file => !/\.(?:png|jpg|jpeg|webp|gif|ico)$/i.test(file));
const texts = await Promise.all(textFiles.map(async file => ({file,content:await readFile(file,'utf8')})));

const forbiddenContent = [
  ['private key', new RegExp('-----BEGIN (?:RSA |EC |OPENSSH )?'+'PRIVATE KEY-----','i')],
  ['GitHub PAT', new RegExp('\\bgh'+'p_[A-Za-z0-9]{20,}\\b')],
  ['GitHub fine-grained PAT', new RegExp('\\bgithub_'+'pat_[A-Za-z0-9_]{20,}\\b')],
  ['Stripe live secret', new RegExp('\\bsk_'+'live_[A-Za-z0-9]{12,}\\b')],
  ['Telegram bot token', new RegExp('\\b\\d{8,12}:[A-Za-z0-9_-]{30,}\\b')],
  ['Supabase service-role implementation detail', new RegExp('SUPABASE_'+'SERVICE_ROLE_KEY')],
  ['private HMAC implementation detail', new RegExp('\\bHM'+'AC\\b','i')],
  ['private Vault implementation detail', new RegExp('\\bVa'+'ult\\b')],
  ['internal full-report auth metadata', new RegExp('internalFull'+'ReportAuth')],
  ['internal full-report OpenAPI metadata', new RegExp('"internalFull'+'Report"\\s*:')],
  ['private core raw URL', new RegExp('raw\\.githubusercontent\\.com/eliber12/jepeta-'+'core','i')],
  ['private source path', new RegExp('supabase/'+'functions/','i')],
  ['private repository link', new RegExp('github\\.com/eliber12/jepeta-'+'core','i')],
  ['old private Pages URL', new RegExp('eliber12\\.github\\.io/jepeta-'+'core','i')],
];

for (const {file,content} of texts) {
  for (const [label,pattern] of forbiddenContent) {
    assert.doesNotMatch(content,pattern,`${label} leaked in ${file}`);
  }
}

console.log(JSON.stringify({
  publicSurfaceVerified:true,
  trackedFiles:tracked.length,
  secretAndBoundaryScan:true,
  at:new Date().toISOString()
}));
