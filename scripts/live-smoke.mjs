import assert from 'node:assert/strict';
import { setTimeout as sleep } from 'node:timers/promises';
import { API, SITE, PASS_DEMO, WARN_DEMO, BLOCK_DEMO, validatePreview } from '../site.js';

const site = SITE.replace(/\/$/, '');
const ACP = 'https://app.virtuals.io/acp/agent/01a0b446-374c-7eb8-8fe8-cd1a9945ea70';
const PROVIDER = '0xefcb0359e2cd6d1ad92cbca1e41c8946b308d7df';
const OFFERING_ID = '01a0b464-2334-7c1b-a88e-467c77d83327';
const deadline = Date.now() + 180000;
let published = false;

// GitHub Pages deployment and test workflow run independently. Await this release.
while (Date.now() < deadline) {
  try {
    const response = await fetch(site + '/?ui-smoke=' + Date.now(), {
      signal: AbortSignal.timeout(8000), cache:'no-store'
    });
    if (response.ok) {
      const html = await response.text();
      if (html.includes('id="scan-form"') &&
          html.includes('og-jepeta.png') &&
          html.includes('free-vs-full') &&
          html.includes(ACP) &&
          html.includes('Inspect the exact risk evidence') &&
          (html.match(/data-demo-address=/g) || []).length === 3 &&
          html.includes('id="lp-locked"') &&
          html.includes('id="top10"')) {
        const assets = await Promise.all(['site.css','site.js','og-jepeta.png'].map(path =>
          fetch(site + '/' + path, {signal:AbortSignal.timeout(8000),cache:'no-store'})
        ));
        if (assets.every(asset => asset.status === 200)) {
          assert.match(assets[2].headers.get('content-type') || '', /^image\/png\b/i);
          published = true;
          break;
        }
      }
    }
  } catch {}
  await sleep(5000);
}
assert.ok(published, 'The current Jepeta scanner, conversion UI and OG asset were not published in time.');

for (const path of [
  'agent.json','agents.json','agents.txt','openapi.json','llms.txt','llms-full.txt',
  'index.md','sample-full-report.json'
]) {
  const response = await fetch(site + '/' + path, {signal:AbortSignal.timeout(15000),cache:'no-store'});
  assert.equal(response.status,200,'Public document unavailable: ' + path);

  if (path === 'agent.json') {
    const manifest = await response.json();
    assert.equal(manifest.agentId,'01a0b446-374c-7eb8-8fe8-cd1a9945ea70');
    assert.equal(manifest.providerWallet,PROVIDER);
    assert.equal(manifest.endpoints.previewApi,API);
    assert.equal(manifest.commerce.price.amount,'0.03');
    assert.equal(manifest.commerce.directUrl,ACP);
    assert.equal(manifest.publicPreview.schemaVersion,'4.0.0');
  }

  if (path === 'agents.json') {
    const manifest = await response.json();
    assert.equal(manifest.paid.offeringId,OFFERING_ID);
    assert.equal(manifest.paid.priceUSDC,'0.03');
    assert.equal(manifest.paid.url,ACP);
  }

  if (path === 'openapi.json') {
    const api = await response.json();
    assert.equal(api.info.version,'4.0.0');
    assert.deepEqual(api.components.schemas.PreviewV4.properties.decision.enum,['PASS','WARN','BLOCK']);
  }

  if (path === 'llms.txt') {
    const text = await response.text();
    assert.ok(text.includes(PROVIDER));
    assert.ok(text.includes('Token Risk Scan'));
    assert.ok(text.includes('0.03 USDC'));
  }

  if (path === 'llms-full.txt') {
    const text = await response.text();
    assert.ok(text.includes(PROVIDER));
    assert.ok(text.includes(OFFERING_ID));
  }

  if (path === 'index.md') {
    const text = await response.text();
    assert.ok(text.includes(API));
    assert.ok(text.includes(ACP));
  }

  if (path === 'sample-full-report.json') {
    const sample = await response.json();
    const fields = ['riskScore','riskLevel','honeypot','dangerousPermissions','liquidityRisk','holderConcentration','tradingActivity','warnings','summary'];
    assert.deepEqual(Object.keys(sample).sort(), fields.sort());
    assert.equal(typeof sample.riskScore,'number');
    assert.ok(['LOW','MEDIUM','HIGH','CRITICAL'].includes(sample.riskLevel));
    assert.equal(typeof sample.honeypot,'boolean');
    assert.ok(Array.isArray(sample.dangerousPermissions));
    assert.ok(Array.isArray(sample.warnings));
  }
}

const invalid = await fetch(API + '?tokenAddress=bad', {signal:AbortSignal.timeout(15000)});
assert.equal(invalid.status,400);

const expectations = [
  [PASS_DEMO,'PASS'],
  [WARN_DEMO,'WARN'],
  [BLOCK_DEMO,'BLOCK']
];

for (const [token, expectedDecision] of expectations) {
  const response = await fetch(API + '?tokenAddress=' + token, {
    headers:{Origin:'https://eliber12.github.io'},
    signal:AbortSignal.timeout(20000),
    cache:'no-store'
  });
  assert.equal(response.status,200,'Live '+expectedDecision+' demo failed: '+await response.clone().text());
  assert.ok(['*','https://eliber12.github.io'].includes(response.headers.get('access-control-allow-origin')),
    'Scanner CORS does not permit the Pages frontend.');
  const report = validatePreview(await response.json(),token);
  assert.equal(report.decision,expectedDecision);
  assert.equal(typeof report.is_honeypot,'boolean');
  assert.equal(typeof report.is_mintable,'boolean');
  assert.equal(report.paid_report?.priceUSDC,'0.03');
  assert.equal('dangerousPermissions' in report,false,'Free preview leaked paid dangerousPermissions');
  assert.equal('tradingActivity' in report,false,'Free preview leaked paid tradingActivity');
}

console.log(JSON.stringify({
  githubPagesVerified:true,
  scannerSchema:'4.0.0',
  discoveryVerified:true,
  ogImageVerified:true,
  directAcpVerified:true,
  demosVerified:{pass:PASS_DEMO,warn:WARN_DEMO,block:BLOCK_DEMO},
  rawMetricsVerified:true,
  supabaseRiskApiVerified:true,
  corsVerified:true,
  freePaidSeparationVerified:true,
  at:new Date().toISOString(),
  paidAcpTest:false
}));
