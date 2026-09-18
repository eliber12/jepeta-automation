/** Base-only screening. An absent API field is UNKNOWN, never false.
 * Providers: GoPlus (security) and DEX Screener (pair metrics).
 * Honeypot.is is intentionally NOT used: its public API terms restrict resale.
 */
export const ENGINE_VERSION = '2.0.0';
export const BASE_CHAIN_ID = 8453;
const FLAGS = {
  is_honeypot: 100, cannot_sell_all: 35, hidden_owner: 25,
  owner_change_balance: 40, selfdestruct: 30, external_call: 15,
  slippage_modifiable: 20, personal_slippage_modifiable: 25,
  transfer_pausable: 25, trading_cooldown: 10, is_blacklisted: 30,
  is_mintable: 15, can_take_back_ownership: 30, cannot_buy: 15,
};
const BURNS = new Set(['0x0000000000000000000000000000000000000000', '0x000000000000000000000000000000000000dead']);
export class RiskDataError extends Error {
  constructor(code, message, status = 503) { super(message); this.name = 'RiskDataError'; this.code = code; this.status = status; }
}
export function validateTokenAddress(value) {
  return typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value) && !BURNS.has(value.toLowerCase());
}
export function validateRequirements(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).length !== 1 || !validateTokenAddress(value.tokenAddress)) {
    throw new RiskDataError('INVALID_REQUIREMENTS', 'Provide only a valid Base tokenAddress.', 400);
  }
  return { tokenAddress: value.tokenAddress.toLowerCase() };
}
function flag(value) {
  if (value === true || value === '1' || value === 1) return true;
  if (value === false || value === '0' || value === 0) return false;
  return null;
}
function number(value) {
  if (!['number', 'string'].includes(typeof value) || String(value).trim() === '') return null;
  const n = Number(value); return Number.isFinite(n) && n >= 0 ? n : null;
}
function ratio(value) { const n = number(value); return n !== null && n <= 1 ? n : null; }
const level = n => n >= 75 ? 'CRITICAL' : n >= 50 ? 'HIGH' : n >= 25 ? 'MEDIUM' : 'LOW';
export function analyzeRisk({ address, goPlusToken, dexPairs = [], sourceErrors = [], now = new Date() }) {
  if (!validateTokenAddress(address)) throw new RiskDataError('INVALID_ADDRESS', 'Invalid Base token address.', 400);
  if (!goPlusToken || typeof goPlusToken !== 'object' || Array.isArray(goPlusToken))
    throw new RiskDataError('SECURITY_DATA_UNAVAILABLE', 'Security data unavailable; no safety verdict issued.');
  const honeypot = flag(goPlusToken.is_honeypot);
  if (honeypot === null)
    throw new RiskDataError('HONEYPOT_UNKNOWN', 'Honeypot status is unknown; no paid report can be issued.', 422);
  const warnings = [], dangerousPermissions = [];
  let score = 0;
  for (const [name, weight] of Object.entries(FLAGS)) {
    if (flag(goPlusToken[name]) === true) { score += weight; dangerousPermissions.push(name); warnings.push(`GoPlus flag: ${name}`); }
  }
  const unknownFlags = Object.keys(FLAGS).filter(k => flag(goPlusToken[k]) === null);
  if (unknownFlags.length) warnings.push(`Unknown security controls: ${unknownFlags.join(', ')}`);
  if (flag(goPlusToken.is_open_source) !== true) { score += 15; warnings.push('Verified source code not confirmed.'); }
  if (flag(goPlusToken.is_proxy) === true) { score += 15; warnings.push('Upgradeable proxy: implementation and permissions may change.'); }
  for (const kind of ['buy', 'sell']) {
    const tax = ratio(goPlusToken[`${kind}_tax`]);
    if (tax === null) { warnings.push(`${kind} tax unknown.`); continue; }
    if (tax >= 0.1) { score += tax >= 0.25 ? 30 : 15; warnings.push(`${kind} tax: ${(tax * 100).toFixed(2)}%.`); }
  }
  // Never mix chains or a different token's pair data. Quote-side metrics are NOT token trading volume.
  const pairs = (Array.isArray(dexPairs) ? dexPairs : []).filter(p =>
    p?.chainId === 'base' && p?.baseToken?.address?.toLowerCase() === address.toLowerCase());
  const bestPair = pairs.sort((a, b) => (number(b?.liquidity?.usd) ?? -1) - (number(a?.liquidity?.usd) ?? -1))[0];
  const liquidity = number(bestPair?.liquidity?.usd);
  let liquidityRisk = 'UNKNOWN';
  if (liquidity !== null) {
    liquidityRisk = liquidity < 10000 ? 'CRITICAL' : liquidity < 50000 ? 'HIGH' : liquidity < 200000 ? 'MEDIUM' : 'LOW';
    score += { CRITICAL: 35, HIGH: 25, MEDIUM: 10, LOW: 0 }[liquidityRisk];
    warnings.push(`Liquidity is for the largest matching Base pool ($${liquidity.toFixed(2)}), not total token liquidity or a lock guarantee.`);
  } else warnings.push('No reliable matching Base pool liquidity.');
  const holders = Array.isArray(goPlusToken.holders) ? goPlusToken.holders : [];
  const pools = new Set(pairs.map(p => p.pairAddress?.toLowerCase()).filter(Boolean));
  const included = holders.filter(h => !BURNS.has(h?.address?.toLowerCase()) && !pools.has(h?.address?.toLowerCase()));
  const portions = included.map(h => ratio(h?.percent));
  let holderConcentration = 'UNKNOWN';
  if (portions.length && portions.every(p => p !== null) && portions.reduce((a, b) => a + b, 0) <= 1.0001) {
    const sum = portions.reduce((a, b) => a + b, 0) * 100, max = Math.max(...portions) * 100;
    const concentration = max >= 50 || sum >= 80 ? 'CRITICAL' : max >= 25 || sum >= 60 ? 'HIGH' : sum >= 40 ? 'MEDIUM' : 'LOW';
    score += { CRITICAL: 30, HIGH: 20, MEDIUM: 10, LOW: 0 }[concentration];
    holderConcentration = `${concentration}: ${sum.toFixed(2)}% across ${portions.length} reported non-burn/non-pool holders`;
    warnings.push('Reported holder sample only; contracts, exchanges and custody wallets are not necessarily one beneficial owner.');
  } else warnings.push('Holder distribution unavailable or invalid.');
  let tradingActivity = 'UNKNOWN';
  const volume = number(bestPair?.volume?.h24), buys = number(bestPair?.txns?.h24?.buys), sells = number(bestPair?.txns?.h24?.sells);
  if ([volume, buys, sells].every(v => v !== null)) tradingActivity = `Matching pool / 24h: volume USD ${volume.toFixed(2)}, buys ${buys}, sells ${sells}`;
  else warnings.push('Trading metrics incomplete; missing values are not zero.');
  if (sourceErrors.length) warnings.push(`Unavailable sources: ${sourceErrors.join(', ')}`);
  // Incomplete coverage must not result in a reassuring LOW classification.
  if (unknownFlags.length || liquidityRisk === 'UNKNOWN' || holderConcentration === 'UNKNOWN' || tradingActivity === 'UNKNOWN') score = Math.max(score, 25);
  score = Math.min(100, Math.max(0, score));
  const riskLevel = level(score);
  warnings.push('Heuristic screening, not an audit or a guarantee that a token is safe. No investment recommendation.');
  const report = {
    riskScore: score, riskLevel, honeypot, dangerousPermissions, liquidityRisk,
    holderConcentration, tradingActivity, warnings: [...new Set(warnings)],
    summary: `${riskLevel} screening flags (${score}/100; not a probability). Token ${address.toLowerCase()} on Base/8453. GoPlus honeypot=${honeypot}. Sources: GoPlus; DEX Screener when available. Retrieved ${now.toISOString()}. Engine ${ENGINE_VERSION}.`,
  };
  validateReport(report); return report;
}
export function validateReport(r) {
  const fields = ['riskScore','riskLevel','honeypot','dangerousPermissions','liquidityRisk','holderConcentration','tradingActivity','warnings','summary'];
  if (!r || typeof r !== 'object' || fields.some(k => !(k in r)) || Object.keys(r).some(k => !fields.includes(k)) ||
      !Number.isFinite(r.riskScore) || r.riskScore < 0 || r.riskScore > 100 || !['LOW','MEDIUM','HIGH','CRITICAL'].includes(r.riskLevel) ||
      typeof r.honeypot !== 'boolean' || ['dangerousPermissions','warnings'].some(k => !Array.isArray(r[k]) || r[k].some(x => typeof x !== 'string')) ||
      ['liquidityRisk','holderConcentration','tradingActivity','summary'].some(k => typeof r[k] !== 'string' || !r[k]))
    throw new RiskDataError('INVALID_REPORT', 'Report did not satisfy the offering contract.');
  return true;
}
async function getJson(url, fetchImpl, timeoutMs) {
  const response = await fetchImpl(url, { headers: { Accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(`HTTP_${response.status}`);
  const text = await response.text();
  if (text.length > 1500000) throw new Error('OVERSIZED_RESPONSE');
  return JSON.parse(text);
}
export async function scanToken(address, { fetchImpl = fetch, timeoutMs = 8000, now = new Date() } = {}) {
  const { tokenAddress } = validateRequirements({ tokenAddress: address });
  const [security, market] = await Promise.allSettled([
    getJson(`https://api.gopluslabs.io/api/v1/token_security/8453?contract_addresses=${tokenAddress}`, fetchImpl, timeoutMs),
    getJson(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`, fetchImpl, timeoutMs),
  ]);
  const securityData = security.status === 'fulfilled' ? security.value : null;
  if (securityData?.code !== 1 || !securityData.result || typeof securityData.result !== 'object')
    throw new RiskDataError('SECURITY_DATA_UNAVAILABLE', 'Security provider unavailable; no verdict issued.');
  const record = Object.entries(securityData.result).find(([k]) => k.toLowerCase() === tokenAddress)?.[1];
  if (!record || typeof record !== 'object' || !Object.keys(record).length)
    throw new RiskDataError('TOKEN_NOT_COVERED', 'Security provider has no data for this exact Base token.', 422);
  return analyzeRisk({ address: tokenAddress, goPlusToken: record,
    dexPairs: market.status === 'fulfilled' ? market.value?.pairs : [],
    sourceErrors: market.status === 'rejected' ? ['DEX Screener'] : [], now });
}
