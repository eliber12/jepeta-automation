import test from 'node:test';
import assert from 'node:assert/strict';

import { analyzeRisk } from '../netlify/functions/_shared/risk-engine.mjs';
import { buildDecisionLayerV3 } from '../netlify/functions/_shared/risk-engine-v3.mjs';
import { createRiskSnapshotV3, compareRiskSnapshotsV3 } from '../worker/risk-history-v3.mjs';

const A = '0x1111111111111111111111111111111111111111';
const B = '0x4444444444444444444444444444444444444444';
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

const pair = {
  chainId:'base',
  baseToken:{ address:A },
  pairAddress:'0x3333333333333333333333333333333333333333',
  liquidity:{ usd:500000 },
  volume:{ h24:1000 },
  txns:{ h24:{ buys:10, sells:8 } },
};

function decision({ at, goPlusToken = token, dexPairs = [pair], address = A }) {
  const report = analyzeRisk({
    address,
    goPlusToken,
    dexPairs: dexPairs.map(p => ({
      ...p,
      baseToken:{ address },
    })),
    now:new Date(at),
  });
  return buildDecisionLayerV3(report, { observedAt:at, tokenAddress:address });
}

test('identical v3 snapshots produce no delta', () => {
  const first = createRiskSnapshotV3(decision({ at:'2026-09-19T20:00:00.000Z' }));
  const second = createRiskSnapshotV3(decision({ at:'2026-09-19T20:05:00.000Z' }));
  const delta = compareRiskSnapshotsV3(first, second);
  assert.equal(delta.changed, false);
  assert.equal(delta.riskScoreDelta, 0);
  assert.deepEqual(delta.materialChanges, []);
});

test('liquidity deterioration is machine-readable history', () => {
  const first = createRiskSnapshotV3(decision({ at:'2026-09-19T20:00:00.000Z' }));
  const second = createRiskSnapshotV3(decision({
    at:'2026-09-19T20:05:00.000Z',
    dexPairs:[{ ...pair, liquidity:{ usd:25000 } }],
  }));
  const delta = compareRiskSnapshotsV3(first, second);
  assert.equal(delta.changed, true);
  assert.equal(delta.liquidityRisk.from, 'LOW');
  assert.equal(delta.liquidityRisk.to, 'HIGH');
  assert.ok(delta.materialChanges.includes('LIQUIDITY_RISK_CHANGED'));
  assert.ok(delta.addedReasonCodes.includes('LIQUIDITY_HIGH'));
  assert.ok(delta.riskScoreDelta > 0);
});

test('new honeypot becomes a hard-block history event', () => {
  const first = createRiskSnapshotV3(decision({ at:'2026-09-19T20:00:00.000Z' }));
  const second = createRiskSnapshotV3(decision({
    at:'2026-09-19T20:05:00.000Z',
    goPlusToken:{ ...token, is_honeypot:'1' },
  }));
  const delta = compareRiskSnapshotsV3(first, second);
  assert.equal(delta.policyVerdict.from, 'NO_HARD_BLOCK_DETECTED');
  assert.equal(delta.policyVerdict.to, 'BLOCK');
  assert.ok(delta.addedHardBlockers.includes('HONEYPOT_DETECTED'));
  assert.ok(delta.materialChanges.includes('HARD_BLOCKER_ADDED'));
  assert.ok(delta.materialChanges.includes('HONEYPOT_STATUS_CHANGED'));
});

test('history refuses to compare different tokens', () => {
  const first = createRiskSnapshotV3(decision({ at:'2026-09-19T20:00:00.000Z' }));
  const second = createRiskSnapshotV3(decision({ at:'2026-09-19T20:05:00.000Z', address:B }));
  assert.throws(() => compareRiskSnapshotsV3(first, second), /different token subjects/);
});

test('history refuses time reversal', () => {
  const first = createRiskSnapshotV3(decision({ at:'2026-09-19T20:05:00.000Z' }));
  const second = createRiskSnapshotV3(decision({ at:'2026-09-19T20:00:00.000Z' }));
  assert.throws(() => compareRiskSnapshotsV3(first, second), /out of order/);
});
