import { scanToken, validateRequirements, ENGINE_VERSION } from './risk-engine.mjs';
const json = (body, status = 200) => Response.json(body, { status, headers: {
  'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Jepeta-Version': ENGINE_VERSION,
}});
const paidReport = Object.freeze({
  protocol: 'Virtuals ACP v2', offering: 'Token Risk Scan', priceUSDC: '0.03',
  providerWallet: '0xefcb0359e2cd6d1ad92cbca1e41c8946b308d7df',
});
export function publicPreview(report) {
  return {
    previewVersion: '1.0',
    riskScore: report.riskScore,
    riskLevel: report.riskLevel,
    honeypot: report.honeypot,
    summary: report.summary,
    warnings: report.warnings.slice(0, 2),
    warningCount: report.warnings.length,
    paidReport,
  };
}
export async function riskHttp(req, scanner = scanToken) {
  if (!['GET', 'POST'].includes(req.method)) return new Response(null, { status: 405, headers: { Allow: 'GET, POST' } });
  try {
    let input;
    if (req.method === 'GET') {
      const params = new URL(req.url).searchParams;
      if (params.size !== 1 || !params.has('tokenAddress')) return json({ error: 'Provide only tokenAddress.' }, 400);
      input = { tokenAddress: params.get('tokenAddress') };
    } else {
      if (!req.headers.get('content-type')?.includes('application/json')) return json({ error: 'JSON required.' }, 415);
      const reader = req.body?.getReader(); let size = 0; const chunks = [];
      if (!reader) return json({ error: 'JSON body required.' }, 400);
      while (true) { const { value, done } = await reader.read(); if (done) break;
        size += value.byteLength; if (size > 2048) { await reader.cancel(); return json({ error: 'Body too large.' }, 413); } chunks.push(value); }
      const bytes = new Uint8Array(size); let offset = 0; for (const b of chunks) { bytes.set(b, offset); offset += b.length; }
      try { input = JSON.parse(new TextDecoder().decode(bytes)); } catch { return json({ error: 'Invalid JSON.' }, 400); }
    }
    const { tokenAddress } = validateRequirements(input);
    return json(publicPreview(await scanner(tokenAddress)));
  } catch (error) {
    return json({ error: error.status ? error.message : 'Scan unavailable; no safety verdict issued.', code: error.code || 'SCAN_UNAVAILABLE' }, error.status || 503);
  }
}
