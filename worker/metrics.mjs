import { CONFIG } from './core.mjs';

function formatUsdc(raw) {
  let value = 0n;
  try { value = BigInt(raw || 0); } catch { value = 0n; }
  const whole = value / 1000000n;
  const fraction = (value % 1000000n).toString().padStart(6, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

function latestTimestamp(records) {
  const fields = ['createdAt','lastActivityAt','quotedAt','fundedAt','reportAt','submittedAt','completedAt','terminalAt'];
  const values = [];
  for (const r of records) {
    for (const key of fields) if (r?.[key] && Number.isFinite(Date.parse(r[key]))) values.push(r[key]);
    if (r?.settlement?.verifiedAt && Number.isFinite(Date.parse(r.settlement.verifiedAt))) values.push(r.settlement.verifiedAt);
  }
  return values.sort((a,b) => Date.parse(b) - Date.parse(a))[0] || null;
}

export function buildBusinessMetrics({ state, offering, heartbeat, gate, now = Date.now() }) {
  const records = Object.values(state?.jobs || {});
  const buyers = new Set(records.map(r => r?.buyer || r?.job?.clientAddress?.toLowerCase()).filter(Boolean));
  const revenueRaw = records.reduce((sum, r) => {
    try { return sum + BigInt(r?.settlement?.creditedUSDCraw || 0); } catch { return sum; }
  }, 0n);
  const workerAgeMs = heartbeat?.at && Number.isFinite(Date.parse(heartbeat.at)) ? now - Date.parse(heartbeat.at) : Infinity;
  const workerLive = heartbeat?.live === true && workerAgeMs >= 0 && workerAgeMs < 90000;
  const marketplaceMode = offering?.isHidden === false
    ? (gate?.enabled ? 'LIVE_VERIFIED' : gate?.pilotPublic ? 'LIVE_PILOT' : 'PUBLIC_UNVERIFIED')
    : 'HIDDEN';

  return {
    generatedAt: new Date(now).toISOString(),
    agent: CONFIG.name,
    agentId: CONFIG.agentId,
    providerWallet: CONFIG.provider,
    offeringId: CONFIG.offeringId,
    priceUSDC: CONFIG.price,
    slaMinutes: CONFIG.slaMinutes,
    marketplaceMode,
    worker: {
      live: workerLive,
      heartbeatAt: heartbeat?.at || null,
      pid: heartbeat?.pid || null,
    },
    jobs: {
      observed: records.length,
      quoted: records.filter(r => r?.quoted).length,
      funded: records.filter(r => r?.fundedAt).length,
      submitted: records.filter(r => r?.submitted).length,
      completed: records.filter(r => r?.completed).length,
      settled: records.filter(r => r?.settlement?.creditedUSDCraw).length,
      unsupported: records.filter(r => r?.preflightBlocked).length,
      busy: records.filter(r => r?.capacityBlocked).length,
      terminal: records.filter(r => r?.terminal).length,
      active: records.filter(r => !r?.terminal && !r?.preflightBlocked && !r?.capacityBlocked && !r?.settlement).length,
    },
    scans: {
      preflightAttempts: records.reduce((n,r) => n + Number(r?.preflightAttempts || 0), 0),
      fundedRefreshAttempts: records.reduce((n,r) => n + Number(r?.scanAttempts || 0), 0),
      cachedDeliveries: records.filter(r => r?.usedCachedPreflight).length,
    },
    buyers: {
      uniqueObserved: buyers.size,
    },
    revenue: {
      creditedUSDCraw: revenueRaw.toString(),
      creditedUSDC: formatUsdc(revenueRaw),
    },
    lastActivityAt: latestTimestamp(records),
  };
}
