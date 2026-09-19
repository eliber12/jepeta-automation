import assert from 'node:assert/strict';
import { setTimeout as sleep } from 'node:timers/promises';
import { ENGINE_VERSION } from '../netlify/functions/_shared/risk-engine.mjs';

const base = 'https://jepeta-automation.netlify.app';

let ready = false;
for (let attempt = 0; attempt < 18; attempt++) {
  const res = await fetch(base + '/api/risk-scan?tokenAddress=bad', { signal: AbortSignal.timeout(15000) });
  if (res.headers.get('X-Jepeta-Version') === ENGINE_VERSION) {
    assert.equal(res.status, 400);
    ready = true;
    break;
  }
  await sleep(10000);
}
assert.ok(ready, 'Expected deployment not live yet.');

const page = await fetch(base, { signal: AbortSignal.timeout(15000) });
assert.equal(page.status, 200);

const manifestResponse = await fetch(base + '/agent.json', { signal: AbortSignal.timeout(15000) });
assert.equal(manifestResponse.status, 200, 'Agent manifest is not public');
const manifest = await manifestResponse.json();
assert.equal(manifest.agentId, '01a0b446-374c-7eb8-8fe8-cd1a9945ea70');
assert.equal(manifest.commerce.offeringId, '01a0b464-2334-7c1b-a88e-467c77d83327');
assert.equal(manifest.commerce.price.amount, '0.03');

for (const path of ['/openapi.json', '/llms.txt']) {
  const staticResponse = await fetch(base + path, { signal: AbortSignal.timeout(15000) });
  assert.equal(staticResponse.status, 200, `${path} is not public`);
}

const healthResponse = await fetch(base + '/health', {
  headers: { 'cache-control': 'no-cache' },
  signal: AbortSignal.timeout(15000),
});
assert.equal(healthResponse.status, 200, 'Health endpoint failed');
const health = await healthResponse.json();
assert.equal(health.ok, true, 'Health endpoint did not report ok=true');
assert.equal(health.configured?.telegram, true, 'Telegram is not configured in production');
assert.equal(health.configured?.gemini, true, 'Gemini is not configured in production');

const now = new Date();
assert.ok(health.lastFresh, 'No successful fresh publish recorded');
assert.ok(Date.now() - Date.parse(health.lastFresh) < 36 * 60 * 60 * 1000, 'Fresh publishing is stale');

// The evening function is scheduled for 18:00 UTC. After a 45-minute grace
// period, require a successful publish from the current UTC day.
if (now.getUTCHours() >= 19 || (now.getUTCHours() === 18 && now.getUTCMinutes() >= 45)) {
  assert.ok(health.lastEvening, 'No successful evening publish recorded');
  const lastEvening = new Date(health.lastEvening);
  assert.equal(lastEvening.toISOString().slice(0, 10), now.toISOString().slice(0, 10), 'Evening publish missed today');
  assert.ok(Date.now() - lastEvening.getTime() < 6 * 60 * 60 * 1000, 'Evening publishing is stale');
}

const affiliate = await fetch(base + '/go?id=boinkers', {
  redirect: 'manual',
  signal: AbortSignal.timeout(15000),
});
assert.ok([301, 302, 307, 308].includes(affiliate.status), `Affiliate redirect returned ${affiliate.status}`);
assert.ok((affiliate.headers.get('location') || '').startsWith('https://t.me/boinker_bot'), 'Affiliate redirect target is wrong');

const unsupported = await fetch(base + '/api/risk-scan', {
  method: 'DELETE',
  signal: AbortSignal.timeout(15000),
});
assert.equal(unsupported.status, 405);

const weth = '0x4200000000000000000000000000000000000006';
const response = await fetch(base + '/api/risk-scan', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ tokenAddress: weth }),
  signal: AbortSignal.timeout(20000),
});
assert.equal(response.status, 200, `Live source-backed WETH scan failed: ${await response.clone().text()}`);
const report = await response.json();
assert.ok(['LOW','MEDIUM','HIGH','CRITICAL'].includes(report.riskLevel));
assert.equal(typeof report.riskScore, 'number');
assert.equal(typeof report.honeypot, 'boolean');
assert.equal(typeof report.summary, 'string');
assert.ok(report.summary.includes(weth));
assert.equal(report.paidReport?.protocol, 'Virtuals ACP v2');
assert.equal(report.paidReport?.priceUSDC, '0.03');
assert.equal('dangerousPermissions' in report, false, 'Free preview leaked paid dangerousPermissions');
assert.equal('liquidityRisk' in report, false, 'Free preview leaked paid liquidityRisk');
assert.equal('holderConcentration' in report, false, 'Free preview leaked paid holderConcentration');
assert.equal('tradingActivity' in report, false, 'Free preview leaked paid tradingActivity');

console.log(JSON.stringify({
  liveApiVerified: true,
  agentManifestVerified: true,
  freePaidSeparationVerified: true,
  engine: ENGINE_VERSION,
  token: weth,
  riskLevel: report.riskLevel,
  channelHealth: {
    telegram: health.configured.telegram,
    gemini: health.configured.gemini,
    lastFresh: health.lastFresh,
    lastEvening: health.lastEvening,
    lastMetrics: health.lastMetrics,
    rememberedUrls: health.rememberedUrls,
  },
  affiliateRedirectVerified: true,
  at: new Date().toISOString(),
  paidAcpTest: false,
}));
