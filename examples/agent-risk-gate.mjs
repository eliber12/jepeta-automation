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
if (!response.ok || !body || !['PASS','WARN','BLOCK'].includes(body.decision)) {
  console.error('SCAN_UNAVAILABLE', body?.code || response.status);
  process.exit(1);
}

console.log(JSON.stringify({
  tokenAddress: body.token_address,
  decision: body.decision,
  riskScore: body.risk_score,
  dataQuality: body.data_quality,
  warnings: body.warnings
}, null, 2));

if (body.decision === 'BLOCK') process.exit(3);
if (body.decision === 'WARN') process.exit(2);
process.exit(0);
