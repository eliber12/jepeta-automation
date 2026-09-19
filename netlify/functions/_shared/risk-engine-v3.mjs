import {
  ENGINE_VERSION as V2_ENGINE_VERSION,
  scanToken as scanTokenV2,
  validateReport as validateV2Report,
  validateTokenAddress,
} from './risk-engine.mjs';

export const ENGINE_VERSION_V3 = '3.0.0-alpha.1';

const HARD_BLOCK_PERMISSIONS = new Map([
  ['cannot_sell_all', 'CANNOT_SELL_ALL'],
  ['cannot_buy', 'CANNOT_BUY'],
]);

const PERMISSION_CODES = new Map([
  ['hidden_owner', 'HIDDEN_OWNER'],
  ['owner_change_balance', 'OWNER_CAN_CHANGE_BALANCES'],
  ['selfdestruct', 'SELFDESTRUCT_CAPABILITY'],
  ['external_call', 'EXTERNAL_CALL_CAPABILITY'],
  ['slippage_modifiable', 'SLIPPAGE_MODIFIABLE'],
  ['personal_slippage_modifiable', 'PERSONAL_SLIPPAGE_MODIFIABLE'],
  ['transfer_pausable', 'TRANSFER_PAUSABLE'],
  ['trading_cooldown', 'TRADING_COOLDOWN'],
  ['is_blacklisted', 'BLACKLIST_CAPABILITY'],
  ['is_mintable', 'MINTABLE'],
  ['can_take_back_ownership', 'OWNERSHIP_RECLAIM'],
  ['cannot_sell_all', 'CANNOT_SELL_ALL'],
  ['cannot_buy', 'CANNOT_BUY'],
]);

const RISK_ORDER = Object.freeze({ LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 });

function hasWarning(report, prefixOrFragment) {
  const needle = prefixOrFragment.toLowerCase();
  return report.warnings.some(w => w.toLowerCase().includes(needle));
}

function concentrationBand(value) {
  if (typeof value !== 'string') return 'UNKNOWN';
  const band = value.split(':', 1)[0].trim().toUpperCase();
  return ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(band) ? band : 'UNKNOWN';
}

function assessDataQuality(report) {
  const marketUnknowns = [
    report.liquidityRisk === 'UNKNOWN',
    report.holderConcentration === 'UNKNOWN',
    report.tradingActivity === 'UNKNOWN',
  ].filter(Boolean).length;

  const securityPartial =
    hasWarning(report, 'Unknown security controls:') ||
    hasWarning(report, 'tax unknown');

  const sourceUnavailable = hasWarning(report, 'Unavailable sources:');

  if (sourceUnavailable || hasWarning(report, 'Unknown security controls:') || marketUnknowns >= 2) {
    return 'LOW';
  }
  if (securityPartial || marketUnknowns === 1) return 'MEDIUM';
  return 'HIGH';
}

function sourceStatus(report) {
  const goPlusPartial =
    hasWarning(report, 'Unknown security controls:') ||
    hasWarning(report, 'tax unknown');

  const dexUnavailable = hasWarning(report, 'Unavailable sources: DEX Screener');
  const dexPartial =
    report.liquidityRisk === 'UNKNOWN' ||
    report.tradingActivity === 'UNKNOWN';

  return {
    goPlus: {
      status: goPlusPartial ? 'PARTIAL' : 'OK',
      required: true,
    },
    dexScreener: {
      status: dexUnavailable ? 'UNAVAILABLE' : dexPartial ? 'PARTIAL' : 'OK',
      required: false,
    },
  };
}

function buildSignals(report) {
  const hardBlockers = [];
  const reasonCodes = [];
  const evidence = [];
  const seen = new Set();

  const add = ({ code, source, signal, value, severity = 'INFO', hardBlock = false }) => {
    if (!seen.has(code)) {
      seen.add(code);
      reasonCodes.push(code);
    }
    evidence.push({ source, code, signal, value, severity });
    if (hardBlock && !hardBlockers.includes(code)) hardBlockers.push(code);
  };

  if (report.honeypot === true) {
    add({
      code: 'HONEYPOT_DETECTED',
      source: 'GoPlus',
      signal: 'is_honeypot',
      value: true,
      severity: 'BLOCKER',
      hardBlock: true,
    });
  }

  for (const permission of report.dangerousPermissions) {
    const code = PERMISSION_CODES.get(permission) || `DANGEROUS_PERMISSION_${permission.toUpperCase()}`;
    add({
      code,
      source: 'GoPlus',
      signal: permission,
      value: true,
      severity: HARD_BLOCK_PERMISSIONS.has(permission) ? 'BLOCKER' : 'HIGH',
      hardBlock: HARD_BLOCK_PERMISSIONS.has(permission),
    });
  }

  if (report.liquidityRisk !== 'LOW' && report.liquidityRisk !== 'UNKNOWN') {
    add({
      code: `LIQUIDITY_${report.liquidityRisk}`,
      source: 'DEX Screener',
      signal: 'liquidityRisk',
      value: report.liquidityRisk,
      severity: RISK_ORDER[report.liquidityRisk] >= RISK_ORDER.HIGH ? 'HIGH' : 'MEDIUM',
    });
  } else if (report.liquidityRisk === 'UNKNOWN') {
    add({
      code: 'LIQUIDITY_UNKNOWN',
      source: 'DEX Screener',
      signal: 'liquidityRisk',
      value: 'UNKNOWN',
      severity: 'MEDIUM',
    });
  }

  const holderBand = concentrationBand(report.holderConcentration);
  if (holderBand !== 'LOW' && holderBand !== 'UNKNOWN') {
    add({
      code: `HOLDER_CONCENTRATION_${holderBand}`,
      source: 'GoPlus',
      signal: 'holderConcentration',
      value: report.holderConcentration,
      severity: RISK_ORDER[holderBand] >= RISK_ORDER.HIGH ? 'HIGH' : 'MEDIUM',
    });
  } else if (holderBand === 'UNKNOWN') {
    add({
      code: 'HOLDER_CONCENTRATION_UNKNOWN',
      source: 'GoPlus',
      signal: 'holderConcentration',
      value: 'UNKNOWN',
      severity: 'MEDIUM',
    });
  }

  if (report.tradingActivity === 'UNKNOWN') {
    add({
      code: 'TRADING_ACTIVITY_UNKNOWN',
      source: 'DEX Screener',
      signal: 'tradingActivity',
      value: 'UNKNOWN',
      severity: 'MEDIUM',
    });
  }

  if (hasWarning(report, 'Unknown security controls:')) {
    add({
      code: 'SECURITY_CONTROLS_INCOMPLETE',
      source: 'GoPlus',
      signal: 'securityControls',
      value: 'PARTIAL',
      severity: 'HIGH',
    });
  }

  if (hasWarning(report, 'buy tax unknown') || hasWarning(report, 'sell tax unknown')) {
    add({
      code: 'TAX_DATA_INCOMPLETE',
      source: 'GoPlus',
      signal: 'taxes',
      value: 'PARTIAL',
      severity: 'MEDIUM',
    });
  }

  if (hasWarning(report, 'Unavailable sources: DEX Screener')) {
    add({
      code: 'DEXSCREENER_UNAVAILABLE',
      source: 'DEX Screener',
      signal: 'sourceStatus',
      value: 'UNAVAILABLE',
      severity: 'MEDIUM',
    });
  }

  if (report.riskLevel === 'CRITICAL') {
    add({
      code: 'RISK_SCORE_CRITICAL',
      source: 'Jepeta',
      signal: 'riskScore',
      value: report.riskScore,
      severity: 'HIGH',
    });
  } else if (report.riskLevel === 'HIGH') {
    add({
      code: 'RISK_SCORE_HIGH',
      source: 'Jepeta',
      signal: 'riskScore',
      value: report.riskScore,
      severity: 'HIGH',
    });
  } else if (report.riskLevel === 'MEDIUM') {
    add({
      code: 'RISK_SCORE_MEDIUM',
      source: 'Jepeta',
      signal: 'riskScore',
      value: report.riskScore,
      severity: 'MEDIUM',
    });
  }

  return { hardBlockers, reasonCodes, evidence };
}

export function buildDecisionLayerV3(report, { observedAt = new Date(), tokenAddress } = {}) {
  validateV2Report(report);
  if (!validateTokenAddress(tokenAddress)) throw new Error('v3 decision report requires a valid Base tokenAddress.');

  const when = observedAt instanceof Date ? observedAt : new Date(observedAt);
  if (!Number.isFinite(when.getTime())) throw new Error('observedAt must be a valid date.');

  const dataQuality = assessDataQuality(report);
  const sources = sourceStatus(report);
  const signals = buildSignals(report);

  let policyVerdict = 'NO_HARD_BLOCK_DETECTED';
  if (signals.hardBlockers.length > 0) {
    policyVerdict = 'BLOCK';
  } else if (
    report.riskLevel !== 'LOW' ||
    dataQuality !== 'HIGH' ||
    report.dangerousPermissions.length > 0 ||
    report.liquidityRisk !== 'LOW' ||
    concentrationBand(report.holderConcentration) !== 'LOW'
  ) {
    policyVerdict = 'REVIEW';
  }

  const decisionSummary =
    policyVerdict === 'BLOCK'
      ? `BLOCK: ${signals.hardBlockers.join(', ')}`
      : policyVerdict === 'REVIEW'
        ? `REVIEW: no hard blocker detected, but ${signals.reasonCodes.length} risk/data-quality signal(s) require policy review.`
        : 'NO_HARD_BLOCK_DETECTED: complete observed data produced no configured hard blocker or review condition.';

  const output = {
    decisionVersion: ENGINE_VERSION_V3,
    chainId: 8453,
    tokenAddress: tokenAddress.toLowerCase(),
    policyVerdict,
    hardBlockers: signals.hardBlockers,
    reasonCodes: signals.reasonCodes,
    dataQuality,
    sourceStatus: sources,
    evidence: signals.evidence,
    observedAt: when.toISOString(),
    decisionSummary,
    riskScore: report.riskScore,
    riskLevel: report.riskLevel,
    honeypot: report.honeypot,
    dangerousPermissions: report.dangerousPermissions,
    liquidityRisk: report.liquidityRisk,
    holderConcentration: report.holderConcentration,
    tradingActivity: report.tradingActivity,
    warnings: report.warnings,
    summary: report.summary,
    baseEngineVersion: V2_ENGINE_VERSION,
  };

  validateDecisionReportV3(output);
  return output;
}

export function validateDecisionReportV3(value) {
  const fields = [
    'decisionVersion','chainId','tokenAddress','policyVerdict','hardBlockers','reasonCodes','dataQuality',
    'sourceStatus','evidence','observedAt','decisionSummary','riskScore','riskLevel',
    'honeypot','dangerousPermissions','liquidityRisk','holderConcentration',
    'tradingActivity','warnings','summary','baseEngineVersion',
  ];

  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid v3 decision report.');
  if (fields.some(k => !(k in value)) || Object.keys(value).some(k => !fields.includes(k))) {
    throw new Error('Invalid v3 decision report fields.');
  }

  if (value.chainId !== 8453 || !validateTokenAddress(value.tokenAddress)) {
    throw new Error('Invalid v3 subject.');
  }

  if (!['BLOCK','REVIEW','NO_HARD_BLOCK_DETECTED'].includes(value.policyVerdict)) {
    throw new Error('Invalid v3 policyVerdict.');
  }
  if (!['HIGH','MEDIUM','LOW'].includes(value.dataQuality)) throw new Error('Invalid v3 dataQuality.');
  if (![value.hardBlockers, value.reasonCodes, value.evidence].every(Array.isArray)) {
    throw new Error('Invalid v3 arrays.');
  }
  if (value.hardBlockers.some(x => typeof x !== 'string') || value.reasonCodes.some(x => typeof x !== 'string')) {
    throw new Error('Invalid v3 reason codes.');
  }
  if (!value.sourceStatus || typeof value.sourceStatus !== 'object' ||
      !['OK','PARTIAL'].includes(value.sourceStatus.goPlus?.status) ||
      !['OK','PARTIAL','UNAVAILABLE'].includes(value.sourceStatus.dexScreener?.status)) {
    throw new Error('Invalid v3 sourceStatus.');
  }
  if (value.sourceStatus.goPlus?.required !== true || value.sourceStatus.dexScreener?.required !== false) {
    throw new Error('Invalid v3 source requirements.');
  }
  for (const item of value.evidence) {
    if (!item || typeof item !== 'object' ||
        typeof item.source !== 'string' || typeof item.code !== 'string' ||
        typeof item.signal !== 'string' || !['BLOCKER','HIGH','MEDIUM','INFO'].includes(item.severity)) {
      throw new Error('Invalid v3 evidence.');
    }
  }
  if (!Number.isFinite(Date.parse(value.observedAt))) throw new Error('Invalid v3 observedAt.');
  if (typeof value.decisionSummary !== 'string' || !value.decisionSummary) throw new Error('Invalid v3 decisionSummary.');

  const v2 = {
    riskScore: value.riskScore,
    riskLevel: value.riskLevel,
    honeypot: value.honeypot,
    dangerousPermissions: value.dangerousPermissions,
    liquidityRisk: value.liquidityRisk,
    holderConcentration: value.holderConcentration,
    tradingActivity: value.tradingActivity,
    warnings: value.warnings,
    summary: value.summary,
  };
  validateV2Report(v2);

  if (value.policyVerdict === 'BLOCK' && value.hardBlockers.length === 0) {
    throw new Error('BLOCK verdict requires at least one hard blocker.');
  }
  if (value.policyVerdict !== 'BLOCK' && value.hardBlockers.length > 0) {
    throw new Error('Hard blockers require BLOCK verdict.');
  }

  return true;
}

export async function scanTokenV3(address, options = {}) {
  const report = await scanTokenV2(address, options);
  return buildDecisionLayerV3(report, {
    observedAt: options.now || new Date(),
    tokenAddress: address,
  });
}
