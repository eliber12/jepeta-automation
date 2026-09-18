import { createHash } from 'node:crypto';
import { validateRequirements, validateReport } from '../netlify/functions/_shared/risk-engine.mjs';
export const CONFIG = Object.freeze({
  agentId: '01a0b446-374c-7eb8-8fe8-cd1a9945ea70',
  offeringId: '01a0b464-2334-7c1b-a88e-467c77d83327',
  name: 'Token Risk Scan', provider: '0xefcb0359e2cd6d1ad92cbca1e41c8946b308d7df',
  chainId: 8453, price: '0.03', priceRaw: '30000', slaMinutes: 5,
  pilotMaxJobs: 1, budgetUSD: 7.5,
});
const ZERO = '0x0000000000000000000000000000000000000000';
const addr = x => typeof x === 'string' ? x.toLowerCase() : '';
const safeId = x => typeof x === 'string' && /^[1-9][0-9]{0,76}$/.test(x);
function systemEvents(history, jobId) {
  if (!Array.isArray(history?.entries)) throw new Error('Invalid ACP history.');
  return history.entries.filter(e => e.kind === 'system' && e.chainId === CONFIG.chainId &&
    String(e.onChainJobId) === jobId && String(e.event?.jobId) === jobId).map(e => e.event);
}
export function inspectJob(job, history, now = Date.now()) {
  const id = String(job?.onChainJobId ?? '');
  if (!safeId(id) || job?.legacy === true || job?.chainId !== CONFIG.chainId ||
      addr(job.providerAddress) !== CONFIG.provider || job.description !== CONFIG.name)
    throw new Error('Job is not this Base offering.');
  if (!/^0x[a-f0-9]{40}$/.test(addr(job.clientAddress)) || addr(job.clientAddress) === CONFIG.provider ||
      addr(job.evaluatorAddress) !== addr(job.clientAddress)) throw new Error('Pilot requires a separate buyer as evaluator.');
  if (job.hookAddress && addr(job.hookAddress) !== ZERO || job.clientSubscription || job.intents?.length)
    throw new Error('Hooks, working-capital intents and subscriptions are not supported.');
  if (history?.jobId !== id || history?.chainId !== CONFIG.chainId || history.legacy === true)
    throw new Error('History does not match job.');
  const events = systemEvents(history, id), created = events.find(e => e.type === 'job.created');
  if (!created || addr(created.provider) !== CONFIG.provider || addr(created.client) !== addr(job.clientAddress) ||
      addr(created.evaluator) !== addr(job.evaluatorAddress) || created.hook && addr(created.hook) !== ZERO)
    throw new Error('Job parties are not confirmed by the ACP system event.');
  const requirements = history.entries.filter(e => e.kind === 'message' && e.contentType === 'requirement' &&
    e.chainId === CONFIG.chainId && String(e.onChainJobId) === id && addr(e.from) === addr(job.clientAddress));
  if (!requirements.length) return { id, action: 'wait' };
  const payloads = requirements.map(e => {
    if (typeof e.content !== 'string' || e.content.length > 2048) throw new Error('Oversized requirement.');
    return validateRequirements(JSON.parse(e.content));
  });
  if (payloads.some(p => p.tokenAddress !== payloads[0].tokenAddress)) throw new Error('Buyer changed requirements; operator review required.');
  const last = events.at(-1)?.type, tokenAddress = payloads[0].tokenAddress;
  if (last === 'job.completed') return { id, action: 'completed', tokenAddress };
  if (['job.rejected','job.expired'].includes(last)) return { id, action: 'terminal', tokenAddress };
  const expiry = Date.parse(job.expiredAt);
  if (!Number.isFinite(expiry) || expiry - now < 45000) throw new Error('Not enough time to meet the job expiry.');
  const budget = events.filter(e => e.type === 'budget.set').at(-1);
  const funded = events.filter(e => e.type === 'job.funded').at(-1);
  if (budget?.fundRequest) throw new Error('Unexpected fund request.');
  if (last === 'job.submitted') return { id, action: 'wait', tokenAddress };
  if (funded && last === 'job.funded') {
    if (Number(budget?.amount) !== 0.03 || Number(funded.amount) !== 0.03 ||
        addr(funded.client) !== addr(job.clientAddress) || String(job.budget) !== CONFIG.priceRaw || job.jobStatus !== 'FUNDED')
      throw new Error('Exact 0.03 USDC funding is not confirmed.');
    return { id, action: 'submit', tokenAddress };
  }
  if (budget) {
    if (Number(budget.amount) !== 0.03) throw new Error('Unexpected budget.');
    return { id, action: 'wait', tokenAddress };
  }
  if (job.jobStatus !== 'OPEN' || (job.budget && String(job.budget) !== '0')) throw new Error('Unexpected job state.');
  return { id, action: 'quote', tokenAddress };
}
export function assertOffering(offers) {
  const offering = offers?.find?.(o => o.id === CONFIG.offeringId);
  if (!offering || offering.agentId !== CONFIG.agentId || offering.name !== CONFIG.name ||
      offering.priceType !== 'fixed' || offering.priceValue !== 0.03 || offering.slaMinutes !== 5 ||
      offering.requiredFunds !== false || offering.requirements?.type !== 'object' || offering.deliverable?.type !== 'object')
    throw new Error('Offering configuration differs from the approved pilot.');
  return offering;
}
/** Write-ahead journal. A crash/ambiguous signature NEVER silently repeats a write. */
export async function processJob({ job, history, state, save, api, scanner, live = false, now = Date.now(), blockNumber }) {
  const decision = inspectJob(job, history, now), { id, tokenAddress, action } = decision;
  const previous = state.jobs[id];
  if (previous?.submitAttempted && !previous.submitted) {
    const delivered = systemEvents(history, id).find(e => e.type === 'job.submitted' && addr(e.provider) === CONFIG.provider &&
      typeof e.deliverable === 'string' && createHash('sha256').update(e.deliverable).digest('hex') === previous.reportHash);
    if (delivered) { previous.submitted = true; await save(); }
  }
  if (action === 'terminal' && previous) { previous.terminal = true; await save(); }
  if (action === 'wait' || action === 'terminal') return decision;
  if (action === 'completed') {
    const record = state.jobs[id];
    if (record?.submitted) { record.completed = true; await save(); }
    return decision;
  }
  if (!live) return { ...decision, dryRun: true };
  let record = state.jobs[id];
  if (!record) {
    if (action !== 'quote') throw new Error('No local quote record; refusing to submit an untracked job.');
    if (Object.keys(state.jobs).length >= CONFIG.pilotMaxJobs && !state.marketplaceVerified)
      throw new Error('One-job pilot limit reached.');
    if (Object.keys(state.jobs).length >= 100) throw new Error('Pilot ledger limit reached; review actual costs first.');
    record = state.jobs[id] = { tokenAddress, job, createdAt: new Date(now).toISOString() };
    await save();
  }
  if (record.tokenAddress !== tokenAddress) throw new Error('Requirement differs from quoted token.');
  if (action === 'quote') {
    if (record.quoteAttempted) return { id, action: 'needs_reconciliation' };
    // Test coverage before asking the customer to fund an unsupported token.
    validateReport(await scanner(tokenAddress));
    record.startBlock = await blockNumber();
    record.quoteAttempted = true; await save();
    const result = await api.setBudget(id);
    if (result?.success !== true) throw new Error('Budget submission was not confirmed.');
    record.quoted = true; await save();
    return { id, action: 'quoted' };
  }
  if (!record.quoteAttempted) throw new Error('This worker never proposed the budget.');
  if (record.submitAttempted) return { id, action: 'needs_reconciliation' };
  if ((record.scanAttempts ?? 0) >= 2) throw new Error('Two scan attempts failed; buyer must reject/refund the job.');
  record.scanAttempts = (record.scanAttempts ?? 0) + 1; await save();
  const report = await scanner(tokenAddress); validateReport(report);
  const deliverable = JSON.stringify(report);
  record.submitAttempted = true; record.report = report;
  record.reportHash = createHash('sha256').update(deliverable).digest('hex'); await save();
  const result = await api.submit(id, deliverable);
  if (result?.success !== true) throw new Error('Delivery submission was not confirmed.');
  record.submitted = true; await save();
  return { id, action: 'submitted' };
}
