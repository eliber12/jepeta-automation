import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBusinessMetrics } from '../worker/metrics.mjs';

const NOW = Date.parse('2026-09-19T18:00:00.000Z');

test('business metrics expose the ACP funnel without inventing impressions', () => {
  const state = {
    jobs: {
      '7': {
        buyer: '0x1111111111111111111111111111111111111111',
        createdAt: '2026-09-19T17:55:00.000Z',
        preflightAttempts: 1,
        quoted: true,
        quotedAt: '2026-09-19T17:55:05.000Z',
        fundedAt: '2026-09-19T17:55:10.000Z',
        usedCachedPreflight: true,
        submitted: true,
        submittedAt: '2026-09-19T17:55:12.000Z',
        completed: true,
        completedAt: '2026-09-19T17:55:20.000Z',
        settlement: { creditedUSDCraw: '30000', verifiedAt: '2026-09-19T17:55:40.000Z' },
      },
      '8': {
        buyer: '0x2222222222222222222222222222222222222222',
        createdAt: '2026-09-19T17:58:00.000Z',
        preflightAttempts: 1,
        preflightBlocked: true,
      },
    },
  };
  const metrics = buildBusinessMetrics({
    state,
    offering: { isHidden: false },
    heartbeat: { live: true, at: '2026-09-19T17:59:30.000Z', pid: 123 },
    gate: { enabled: true },
    now: NOW,
  });
  assert.equal(metrics.marketplaceMode, 'LIVE_VERIFIED');
  assert.equal(metrics.worker.live, true);
  assert.equal(metrics.jobs.observed, 2);
  assert.equal(metrics.jobs.quoted, 1);
  assert.equal(metrics.jobs.funded, 1);
  assert.equal(metrics.jobs.settled, 1);
  assert.equal(metrics.jobs.unsupported, 1);
  assert.equal(metrics.scans.cachedDeliveries, 1);
  assert.equal(metrics.buyers.uniqueObserved, 2);
  assert.equal(metrics.revenue.creditedUSDC, '0.03');
});

test('stale heartbeat is not reported as live', () => {
  const metrics = buildBusinessMetrics({
    state: { jobs: {} },
    offering: { isHidden: false },
    heartbeat: { live: true, at: '2026-09-19T17:00:00.000Z' },
    gate: { pilotPublic: true },
    now: NOW,
  });
  assert.equal(metrics.worker.live, false);
  assert.equal(metrics.marketplaceMode, 'LIVE_PILOT');
});
