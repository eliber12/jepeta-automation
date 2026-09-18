import type { Config } from '@netlify/functions';
import { riskHttp } from './_shared/risk-http.mjs';
export default async (req: Request) => {
  if (Netlify.env.get('RISK_SCAN_DISABLED') === 'true') return Response.json({ error: 'Scanner temporarily paused.' }, { status: 503 });
  return riskHttp(req);
};
export const config: Config = {
  path: '/api/risk-scan',
  rateLimit: { windowLimit: 6, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
