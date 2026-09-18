import assert from 'node:assert/strict';
import { setTimeout as sleep } from 'node:timers/promises';
import { validateReport, ENGINE_VERSION } from '../netlify/functions/_shared/risk-engine.mjs';
const base = 'https://jepeta-automation.netlify.app';
let ready = false;
for (let attempt = 0; attempt < 18; attempt++) {
  const res = await fetch(base + '/api/risk-scan?tokenAddress=bad', { signal: AbortSignal.timeout(15000) });
  if (res.headers.get('X-Jepeta-Version') === ENGINE_VERSION) { assert.equal(res.status, 400); ready = true; break; }
  await sleep(10000);
}
assert.ok(ready, 'Expected deployment not live yet.');
const page = await fetch(base); assert.equal(page.status, 200);
const unsupported = await fetch(base + '/api/risk-scan', { method: 'DELETE', signal: AbortSignal.timeout(15000) });
assert.equal(unsupported.status, 405);
const weth = '0x4200000000000000000000000000000000000006';
const response = await fetch(base + '/api/risk-scan', { method: 'POST', headers: {'Content-Type':'application/json'},
  body: JSON.stringify({tokenAddress: weth}), signal: AbortSignal.timeout(20000) });
assert.equal(response.status, 200, `Live source-backed WETH scan failed: ${await response.clone().text()}`);
const report = await response.json(); validateReport(report);
assert.ok(report.summary.includes(weth));
console.log(JSON.stringify({liveApiVerified:true,engine:ENGINE_VERSION,token:weth,riskLevel:report.riskLevel,at:new Date().toISOString(),paidAcpTest:false}));
