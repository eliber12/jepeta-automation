import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

const publicContracts = [
  'index.md', 'agent.json', 'agents.json', 'agents.txt', 'openapi.json', 'openapi-v5.json',
  'llms.txt', 'llms-full.txt', 'methodology.json', 'sources.json', 'changelog.json',
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
const [agent, agents, openapi, openapiV5, methodology, sources, changelog, sample] = await Promise.all([
  json('agent.json'), json('agents.json'), json('openapi.json'), json('openapi-v5.json'),
  json('methodology.json'), json('sources.json'), json('changelog.json'), json('sample-full-report.json'),
]);
assert.equal(agent.network.chainId, 8453);
assert.equal(agents.chainId, 8453);
assert.equal(openapi.info.version, '4.3.0');
assert.equal(methodology.methodologyVersion,'2.1.1');
assert.equal(methodology.publicEvidencePolicy.schemaVersion,'2.0.0');
assert.equal(openapiV5.info['x-methodology-version'],'2.1.1');
assert.equal(agent.methodologyVersion,'2.1.1');
assert.equal(agents.methodologyVersion,'2.1.1');
assert.equal(agent.machineDiscovery.riskEvidence.schemaVersion,'2.0.0');
assert.equal(agents.riskEvidenceSchemaVersion,'2.0.0');
assert.equal(openapi.info['x-methodology-version'],'2.0.0');
assert.equal(agent.apiStatus.v4.canonical,false);
assert.equal(agent.apiStatus.v5.canonical,true);
assert.equal(agent.apiStatus.v5.publicRollout,true);
assert.equal(agents.apiStatus.v5.publicRollout,true);
assert.equal(openapi['x-jepeta-api-status'].v5.publicRollout,true);
assert.equal(openapiV5.info.version,'5.0.0-internal.1');
assert.equal(openapiV5.info['x-jepeta-public-optional'],false);
assert.equal(openapiV5.info['x-jepeta-canonical'],true);
assert.equal(openapiV5['x-jepeta-compatibility'].v4Canonical,false);
assert.equal(openapiV5['x-jepeta-compatibility'].v5Canonical,true);
assert.deepEqual(openapiV5.paths['/jepeta-risk-scan'].post.security,[]);
assert.equal(openapiV5['x-jepeta-compatibility'].mandatoryMigration,false);
assert.equal(openapiV5['x-jepeta-compatibility'].paidPrivateBoundaryChanged,false);
assert.deepEqual(openapiV5.paths['/jepeta-risk-scan-v5'].post.security,[]);
assert.equal('/jepeta-risk-scan-v5' in openapi.paths,false);
assert.equal(sources.object,'jepeta_sources');
assert.equal(sources.providers.length,6);
assert.equal(sources.policy.providersAreJepetaSameAs,false);
assert.equal(agent.commerce.offeringId, agents.paid.offeringId);
assert.equal(agent.commerce.price.amount, '0.03');
assert.equal(sample.decisionVersion, '3.0.0-alpha.2');
assert.equal(sample.chainId, 8453);
assert.ok(sample.historyContext);
assert.equal(agent.commerce.availability.siteCheckoutAvailable,false);
assert.equal(agent.commerce.availability.fulfillmentVerified,false);
assert.equal(agent.commerce.availability.priceStatus,'listed');
assert.deepEqual(agent.commerce.availability,agents.paid.availability);
assert.deepEqual(agent.commerce.availability,openapi['x-jepeta-acp-availability']);
assert.deepEqual(agent.commerce.availability,openapiV5['x-jepeta-acp-availability']);
assert.equal(agent.commerce.availability.marketplaceListingAvailable,true);
assert.equal(agent.commerce.availability.profileUrl,'https://app.virtuals.io/acp/agent/01a0b446-374c-7eb8-8fe8-cd1a9945ea70');
assert.equal(agent.commerce.availability.fulfillmentVerified,false);
assert.ok(agent.productLadder.every(product => product.status ===
  (product.delivery.startsWith('Virtuals ACP')?'LISTED_FULFILLMENT_UNVERIFIED':'LIVE')));
assert.deepEqual(methodology.exampleResponse, changelog.exampleResponse);
assert.equal(methodology.exampleResponse.body.data_quality, 'HIGH');
assert.equal(methodology.exampleResponse.body.source_status.dexscreener, 'OK');
assert.equal(methodology.publicEvidencePolicy.paidEvidenceIncluded,false);
assert.equal(methodology.publicEvidencePolicy.rawProviderPayloadIncluded,false);
for(const text of [JSON.stringify(agent),JSON.stringify(agents),JSON.stringify(openapi),JSON.stringify(openapiV5)]){
  for(const phrase of ['Official Partner','Technology Partner','Powered by','Official Integration'])assert.ok(!text.includes(phrase));
}

console.log(JSON.stringify({
  publicContractsVerified:true,
  trackedFiles:tracked.length,
  secretAndBoundaryScan:true,
}));
