import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

const publicContracts = [
  'index.md', 'agent.json', 'agents.json', 'agents.txt', 'openapi.json',
  'llms.txt', 'llms-full.txt', 'methodology.json', 'changelog.json',
  'sample-full-report.json',
];
const allowedFiles = new Set([
  ...publicContracts,
  'README.md', '.github/workflows/verify.yml', 'scripts/public-check.mjs',
  'examples/README.md', 'examples/agent-risk-gate.mjs', 'examples/curl.sh',
]);
const tracked = execFileSync('git', ['ls-files', '-z'])
  .toString('utf8').split('\0').filter(Boolean).sort();
assert.deepEqual(tracked, [...allowedFiles].sort(),
  'The public checkout contains an unexpected or missing tracked file.');

const forbidden = [
  ['private repository name', new RegExp('jepeta-' + 'core', 'i')],
  ['private source path', new RegExp('(?:supabase' + '/functions/|acp-v3' + '-runtime/|Jepeta' + 'RiskGuardV3)', 'i')],
  ['internal authentication', new RegExp('(?:SUPABASE_' + 'SERVICE_ROLE_KEY|internalFull' + 'ReportAuth|\\bHM' + 'AC\\b)', 'i')],
  ['operational growth state', new RegExp('(?:pending' + '.slot|READY' + '-BLOCKED|target' + ' status|outreach' + ' queue|GEO' + ' run)', 'i')],
  ['roadmap activation', new RegExp('(?:activation' + 'Gate|Monitoring' + ' / Watchlist|Agent' + ' Subscription|Batch' + ' / API)', 'i')],
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i],
  ['GitHub token', /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/],
  ['Telegram bot token', /\b\d{8,12}:[A-Za-z0-9_-]{30,}\b/],
  ['OpenAI key', /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
];
for (const file of tracked.filter(file => file !== 'scripts/public-check.mjs')) {
  const contents = await readFile(file, 'utf8');
  for (const [label, pattern] of forbidden) {
    assert.doesNotMatch(contents, pattern, `${label} found in ${file}`);
  }
}

const json = async file => JSON.parse(await readFile(file, 'utf8'));
const [agent, agents, openapi, methodology, changelog, sample] = await Promise.all([
  json('agent.json'), json('agents.json'), json('openapi.json'),
  json('methodology.json'), json('changelog.json'), json('sample-full-report.json'),
]);
assert.equal(agent.network.chainId, 8453);
assert.equal(agents.chainId, 8453);
assert.equal(openapi.info.version, '4.3.0');
assert.equal(agent.commerce.offeringId, agents.paid.offeringId);
assert.equal(agent.commerce.price.amount, '0.03');
assert.equal(sample.decisionVersion, '3.0.0-alpha.2');
assert.equal(sample.chainId, 8453);
assert.ok(sample.historyContext);
assert.ok(agent.productLadder.every(product => product.status === 'LIVE'));
assert.deepEqual(methodology.exampleResponse, changelog.exampleResponse);
assert.equal(methodology.exampleResponse.body.data_quality, 'HIGH');
assert.equal(methodology.exampleResponse.body.source_status.dexscreener, 'OK');

console.log(JSON.stringify({
  publicContractsVerified:true,
  trackedFiles:tracked.length,
  secretAndBoundaryScan:true,
}));
