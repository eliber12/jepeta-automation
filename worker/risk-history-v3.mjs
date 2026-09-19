import { validateDecisionReportV3 } from '../netlify/functions/_shared/risk-engine-v3.mjs';

export const HISTORY_VERSION_V3 = '1.0';

const uniqSorted = values => [...new Set(values)].sort();
const diffAdded = (before, after) => uniqSorted(after.filter(x => !before.includes(x)));
const diffRemoved = (before, after) => uniqSorted(before.filter(x => !after.includes(x)));

export function createRiskSnapshotV3(decision) {
  validateDecisionReportV3(decision);
  return {
    historyVersion: HISTORY_VERSION_V3,
    chainId: decision.chainId,
    tokenAddress: decision.tokenAddress,
    observedAt: decision.observedAt,
    policyVerdict: decision.policyVerdict,
    riskScore: decision.riskScore,
    riskLevel: decision.riskLevel,
    dataQuality: decision.dataQuality,
    hardBlockers: uniqSorted(decision.hardBlockers),
    reasonCodes: uniqSorted(decision.reasonCodes),
    dangerousPermissions: uniqSorted(decision.dangerousPermissions),
    honeypot: decision.honeypot,
    liquidityRisk: decision.liquidityRisk,
    holderConcentration: decision.holderConcentration,
    tradingActivity: decision.tradingActivity,
    sourceStatus: {
      goPlus: decision.sourceStatus.goPlus.status,
      dexScreener: decision.sourceStatus.dexScreener.status,
    },
  };
}

function transition(from, to) {
  return { from, to, changed: from !== to };
}

export function compareRiskSnapshotsV3(previous, current) {
  if (!previous || !current ||
      previous.historyVersion !== HISTORY_VERSION_V3 ||
      current.historyVersion !== HISTORY_VERSION_V3) {
    throw new Error('Invalid v3 risk snapshot.');
  }
  if (previous.chainId !== current.chainId || previous.tokenAddress !== current.tokenAddress) {
    throw new Error('Cannot compare snapshots for different token subjects.');
  }

  const fromTime = Date.parse(previous.observedAt);
  const toTime = Date.parse(current.observedAt);
  if (!Number.isFinite(fromTime) || !Number.isFinite(toTime) || toTime < fromTime) {
    throw new Error('Snapshot timestamps are invalid or out of order.');
  }

  const addedHardBlockers = diffAdded(previous.hardBlockers, current.hardBlockers);
  const removedHardBlockers = diffRemoved(previous.hardBlockers, current.hardBlockers);
  const addedReasonCodes = diffAdded(previous.reasonCodes, current.reasonCodes);
  const removedReasonCodes = diffRemoved(previous.reasonCodes, current.reasonCodes);
  const addedDangerousPermissions = diffAdded(previous.dangerousPermissions, current.dangerousPermissions);
  const removedDangerousPermissions = diffRemoved(previous.dangerousPermissions, current.dangerousPermissions);

  const policyVerdict = transition(previous.policyVerdict, current.policyVerdict);
  const riskLevel = transition(previous.riskLevel, current.riskLevel);
  const dataQuality = transition(previous.dataQuality, current.dataQuality);
  const honeypot = transition(previous.honeypot, current.honeypot);
  const liquidityRisk = transition(previous.liquidityRisk, current.liquidityRisk);
  const holderConcentration = transition(previous.holderConcentration, current.holderConcentration);
  const tradingActivity = transition(previous.tradingActivity, current.tradingActivity);
  const goPlusStatus = transition(previous.sourceStatus.goPlus, current.sourceStatus.goPlus);
  const dexScreenerStatus = transition(previous.sourceStatus.dexScreener, current.sourceStatus.dexScreener);

  const materialChanges = [];
  if (policyVerdict.changed) materialChanges.push('POLICY_VERDICT_CHANGED');
  if (current.riskScore !== previous.riskScore) materialChanges.push('RISK_SCORE_CHANGED');
  if (riskLevel.changed) materialChanges.push('RISK_LEVEL_CHANGED');
  if (dataQuality.changed) materialChanges.push('DATA_QUALITY_CHANGED');
  if (honeypot.changed) materialChanges.push('HONEYPOT_STATUS_CHANGED');
  if (addedHardBlockers.length) materialChanges.push('HARD_BLOCKER_ADDED');
  if (removedHardBlockers.length) materialChanges.push('HARD_BLOCKER_REMOVED');
  if (addedDangerousPermissions.length) materialChanges.push('DANGEROUS_PERMISSION_ADDED');
  if (removedDangerousPermissions.length) materialChanges.push('DANGEROUS_PERMISSION_REMOVED');
  if (liquidityRisk.changed) materialChanges.push('LIQUIDITY_RISK_CHANGED');
  if (holderConcentration.changed) materialChanges.push('HOLDER_CONCENTRATION_CHANGED');
  if (tradingActivity.changed) materialChanges.push('TRADING_ACTIVITY_CHANGED');
  if (goPlusStatus.changed) materialChanges.push('GOPLUS_STATUS_CHANGED');
  if (dexScreenerStatus.changed) materialChanges.push('DEXSCREENER_STATUS_CHANGED');

  return {
    deltaVersion: HISTORY_VERSION_V3,
    chainId: current.chainId,
    tokenAddress: current.tokenAddress,
    fromObservedAt: previous.observedAt,
    toObservedAt: current.observedAt,
    changed: materialChanges.length > 0 ||
      addedReasonCodes.length > 0 || removedReasonCodes.length > 0,
    riskScoreDelta: current.riskScore - previous.riskScore,
    policyVerdict,
    riskLevel,
    dataQuality,
    honeypot,
    liquidityRisk,
    holderConcentration,
    tradingActivity,
    sourceStatus: {
      goPlus: goPlusStatus,
      dexScreener: dexScreenerStatus,
    },
    addedHardBlockers,
    removedHardBlockers,
    addedReasonCodes,
    removedReasonCodes,
    addedDangerousPermissions,
    removedDangerousPermissions,
    materialChanges: uniqSorted(materialChanges),
  };
}
