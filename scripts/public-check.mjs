import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const expectedTracked = new Set([
  '.github/workflows/verify.yml',
  'README.md',
  'agent.json',
  'agents.json',
  'agents.txt',
  'docs/OUTREACH.md',
  'index.md',
  'llms-full.txt',
  'llms.txt',
  'openapi.json',
  'sample-full-report.json',
  'scripts/public-check.mjs',
]);

const tracked = execFileSync('git',['ls-files'],{encoding:'utf8'})
  .split(/\r?\n/)
  .filter(Boolean)
  .sort();

assert.deepEqual(
  tracked,
  [...expectedTracked].sort(),
  'Public repository must remain an exact documentation/contract allowlist.'
);

for (const file of expectedTracked) await stat(file);

for (const forbidden of [
  'index.html','site.css','site.js','robots.txt','sitemap.xml','.nojekyll',
  'og-jepeta.svg','scripts/live-smoke.mjs','.github/workflows/pages.yml'
]) {
  assert.ok(!tracked.includes(forbidden), 'Website runtime leaked into public mirror: '+forbidden);
}
assert.ok(!tracked.some(file => /^(?:worker|supabase|netlify)\//.test(file)),
  'Private runtime directory leaked into public mirror.');

const agent = JSON.parse(await readFile('agent.json','utf8'));
assert.equal(agent.endpoints?.humanPreview,'https://eliber12.github.io/jepeta-core/');
assert.equal(agent.commerce?.directUrl,'https://app.virtuals.io/acp/agent/01a0b446-374c-7eb8-8fe8-cd1a9945ea70');
assert.equal(agent.commerce?.price?.amount,'0.03');
assert.equal(agent.network?.chainId,8453);

const readme = await readFile('README.md','utf8');
assert.match(readme,/Production website:\s+https:\/\/eliber12\.github\.io\/jepeta-core\//);
assert.match(readme,/does not deploy the production website/i);

const textFiles = tracked.filter(file => file !== 'scripts/public-check.mjs');
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
  ['private core raw URL', new RegExp('raw\\.githubusercontent\\.com/eliber12/jepeta-'+'core','i')],
  ['private source path', new RegExp('supabase/'+'functions/','i')],
  ['private repository link', new RegExp('github\\.com/eliber12/jepeta-'+'core','i')],
];

for (const {file,content} of texts) {
  for (const [label,pattern] of forbiddenContent) {
    assert.doesNotMatch(content,pattern,`${label} leaked in ${file}`);
  }
}

console.log(JSON.stringify({
  publicSurfaceVerified:true,
  docsOnly:true,
  trackedFiles:tracked.length,
  secretAndBoundaryScan:true,
  canonicalWebsite:'https://eliber12.github.io/jepeta-core/',
  at:new Date().toISOString()
}));
