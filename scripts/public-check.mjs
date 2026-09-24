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
  'docs/DISTRIBUTION.md',
  'examples/README.md',
  'examples/agent-risk-gate.mjs',
  'examples/curl.sh',
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
  'Public repository contains an unexpected or missing tracked file. Review it explicitly before publishing.'
);

for (const file of expectedTracked) await stat(file);

const texts = await Promise.all(
  tracked
    .filter(file => file !== 'scripts/public-check.mjs')
    .map(async file => ({file,content:await readFile(file,'utf8')}))
);

const joined = texts.map(x=>x.content).join('\n');
for (const required of [
  'https://jepeta.dev/',
  'https://app.virtuals.io/acp/agent/01a0b446-374c-7eb8-8fe8-cd1a9945ea70',
  'https://aitgmgfumsdqecmanrab.supabase.co/functions/v1/jepeta-risk-scan',
  'https://aitgmgfumsdqecmanrab.supabase.co/functions/v1/jepeta-risk-feed',
  'https://jepeta.dev/base-token-risk-monitor.html',
  'https://t.me/jepeta_tools'
]) assert.ok(joined.includes(required), 'Missing canonical public reference: '+required);

assert.ok(!tracked.includes('index.html'));
assert.ok(!tracked.includes('site.js'));
assert.ok(!tracked.includes('site.css'));
assert.ok(!tracked.includes('.github/workflows/pages.yml'));

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
];

for (const {file,content} of texts) {
  for (const [label,pattern] of forbiddenContent) {
    assert.doesNotMatch(content,pattern,`${label} leaked in ${file}`);
  }
}

console.log(JSON.stringify({
  publicContractsVerified:true,
  websiteRuntimePresent:false,
  trackedFiles:tracked.length,
  secretAndBoundaryScan:true,
  at:new Date().toISOString()
}));
