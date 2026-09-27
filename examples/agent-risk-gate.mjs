const endpoint = 'https://aitgmgfumsdqecmanrab.supabase.co/functions/v1/jepeta-risk-scan';
const tokenAddress = process.argv[2];

if (!/^0x[a-fA-F0-9]{40}$/.test(tokenAddress || '')) {
  console.error('Usage: node examples/agent-risk-gate.mjs 0x<40-hex-character Base token address>');
  process.exit(1);
}

let response;
try {
  response = await fetch(endpoint + '?tokenAddress=' + encodeURIComponent(tokenAddress), {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(15000)
  });
} catch (error) {
  console.error('SCAN_UNAVAILABLE', String(error?.message || error));
  process.exit(1);
}

const body = await response.json().catch(() => null);
const validDecision = ['PASS', 'WARN', 'BLOCK'].includes(body?.decision);
const validQuality = ['HIGH', 'MEDIUM', 'LOW'].includes(body?.data_quality);
const validIdentity =
  body?.chain_id === 8453 &&
  typeof body?.token_address === 'string' &&
  body.token_address.toLowerCase() === tokenAddress.toLowerCase();

if (!response.ok || !body || !validDecision || !validQuality || !validIdentity) {
  console.error('SCAN_UNAVAILABLE', body?.code || response.status || 'INVALID_RESPONSE');
  process.exit(1);
}

const effectiveGate =
  body.decision === 'BLOCK' ? 'BLOCK' :
  body.decision === 'WARN' || body.data_quality === 'LOW' ? 'REVIEW' :
  'PASS';

console.log(JSON.stringify({
  tokenAddress: body.token_address,
  decision: body.decision,
  effectiveGate,
  riskScore: body.risk_score,
  dataQuality: body.data_quality,
  sourceStatus: body.source_status,
  observedAt: body.observed_at,
  warnings: body.warnings
}, null, 2));

if (effectiveGate === 'BLOCK') process.exit(3);
if (effectiveGate === 'REVIEW') process.exit(2);
process.exit(0);
