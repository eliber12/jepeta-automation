import test from 'node:test';
import assert from 'node:assert/strict';

import { analyzeRisk } from '../netlify/functions/_shared/risk-engine.mjs';
import {
  ENGINE_VERSION_V3,
  buildDecisionLayerV3,
  scanTokenV3,
  validateDecisionReportV3,
} from '../netlify/functions/_shared/risk-engine-v3.mjs';

const A = '0x1111111111111111111111111111111111111111';
const HOLDER = '0x2222222222222222222222222222222222222222';

const token = {
  is_honeypot:'0', cannot_sell_all:'0', hidden_owner:'0',
  owner_change_balance:'0', selfdestruct:'0', external_call:'0',
  slippage_modifiable:'0', personal_slippage_modifiable:'0',
  transfer_pausable:'0', trading_cooldown:'0', is_blacklisted:'0',
  is_mintable:'0', can_take_back_ownership:'0', cannot_buy:'0',
  is_open_source:'1', is_proxy:'0', buy_tax:'0', sell_tax:'0',
  holders:[{ address:HOLDER, percent:'0.05' }],
};

const pairs = [{
  chainId:'base',
  baseToken:{ address:A },
  pairAddress:'0x3333333333333333333333333333333333333333',
  liquidity:{ usd:500000 },
  volume:{ h24:1000 },
  txns:{ h24:{ buys:10, sells:8 } },
}];

const baseReport = extra => analyzeRisk({
  address:A,
  goPlusToken:token,
  dexPairs:pairs,
  now:new Date('2026-09-19T20:00:00.000Z'),
  ...extra,
});

test('v3 clean complete report becomes NO_HARD_BLOCK_DETECTED', () => {
  const out = buildDecisionLayerV3(baseReport(), { observedAt:'2026-09-19T20:00:01.000Z' });
  assert.equal(out.decisionVersion, ENGINE_VERSION_V3);
  assert.equal(out.policyVerdict, 'NO_HARD_BLOCK_DETECTED');
  assert.equal(out.dataQuality, 'HIGH');
  assert.deepEqual(out.hardBlockers, []);
  assert.deepEqual(out.reasonCodes, []);
  assert.equal(out.sourceStatus.goPlus.status, 'OK');
  assert.equal(out.sourceStatus.dexScreener.status, 'OK');
  assert.equal(out.observedAt, '2026-09-19T20:00:01.000Z');
  assert.equal(validateDecisionReportV3(out), true);
});

test('v3 honeypot is an unambiguous BLOCK', () => {
  const out = buildDecisionLayerV3(baseReport({ goPlusToken:{ ...token, is_honeypot:'1' } }));
  assert.equal(out.policyVerdict, 'BLOCK');
  assert.ok(out.hardBlockers.includes('HONEYPOT_DETECTED'));
  assert.ok(out.reasonCodes.includes('HONEYPOT_DETECTED'));
  assert.ok(out.evidence.some(e => e.code === 'HONEYPOT_DETECTED' && e.severity === 'BLOCKER'));
});

test('v3 cannot_sell_all is a hard blocker', () => {
  const out = buildDecisionLayerV3(baseReport({ goPlusToken:{ ...token, cannot_sell_all:'1' } }));
  assert.equal(out.policyVerdict, 'BLOCK');
  assert.ok(out.hardBlockers.includes('CANNOT_SELL_ALL'));
});

test('v3 cannot_buy is a hard blocker', () => {
  const out = buildDecisionLayerV3(baseReport({ goPlusToken:{ ...token, cannot_buy:'1' } }));
  assert.equal(out.policyVerdict, 'BLOCK');
  assert.ok(out.hardBlockers.includes('CANNOT_BUY'));
});

test('v3 risky but not blocked becomes REVIEW', () => {
  const riskyPair = [{ ...pairs[0], liquidity:{ usd:25000 } }];
  const out = buildDecisionLayerV3(baseReport({ dexPairs:riskyPair }));
  assert.equal(out.policyVerdict, 'REVIEW');
  assert.ok(out.reasonCodes.includes('LIQUIDITY_HIGH'));
  assert.equal(out.hardBlockers.length, 0);
});

test('v3 incomplete market data cannot receive clean decision', () => {
  const out = buildDecisionLayerV3(baseReport({ dexPairs:[] }));
  assert.equal(out.policyVerdict, 'REVIEW');
  assert.equal(out.dataQuality, 'LOW');
  assert.equal(out.sourceStatus.dexScreener.status, 'PARTIAL');
  assert.ok(out.reasonCodes.includes('LIQUIDITY_UNKNOWN'));
  assert.ok(out.reasonCodes.includes('TRADING_ACTIVITY_UNKNOWN'));
});

test('v3 source outage is explicit and lowers data quality', () => {
  const report = baseReport({ dexPairs:[], sourceErrors:['DEX Screener'] });
  const out = buildDecisionLayerV3(report);
  assert.equal(out.policyVerdict, 'REVIEW');
  assert.equal(out.dataQuality, 'LOW');
  assert.equal(out.sourceStatus.dexScreener.status, 'UNAVAILABLE');
  assert.ok(out.reasonCodes.includes('DEXSCREENER_UNAVAILABLE'));
});

test('v3 unknown security controls force review', () => {
  const out = buildDecisionLayerV3(baseReport({ goPlusToken:{ ...token, hidden_owner:'' } }));
  assert.equal(out.policyVerdict, 'REVIEW');
  assert.equal(out.dataQuality, 'LOW');
  assert.equal(out.sourceStatus.goPlus.status, 'PARTIAL');
  assert.ok(out.reasonCodes.includes('SECURITY_CONTROLS_INCOMPLETE'));
});

test('v3 validator rejects fake BLOCK verdict with no blockers', () => {
  const out = buildDecisionLayerV3(baseReport());
  assert.throws(() => validateDecisionReportV3({ ...out, policyVerdict:'BLOCK' }), /hard blocker/i);
});

test('v3 validator rejects extra fields', () => {
  const out = buildDecisionLayerV3(baseReport());
  assert.throws(() => validateDecisionReportV3({ ...out, surprise:true }), /fields/);
});

test('v3 end-to-end scan preserves source-backed decision semantics', async () => {
  const fakeFetch = async url => Response.json(
    url.includes('goplus')
      ? { code:1, result:{ [A]:token } }
      : { pairs }
  );
  const out = await scanTokenV3(A, {
    fetchImpl:fakeFetch,
    now:new Date('2026-09-19T20:05:00.000Z'),
  });
  assert.equal(out.policyVerdict, 'NO_HARD_BLOCK_DETECTED');
  assert.equal(out.dataQuality, 'HIGH');
  assert.equal(out.baseEngineVersion, '2.0.0');
  assert.equal(out.observedAt, '2026-09-19T20:05:00.000Z');
});
