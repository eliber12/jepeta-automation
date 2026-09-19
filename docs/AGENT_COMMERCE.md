# Jepeta Risk Guard — Agent Commerce Readiness

## Objective

Make \`Jepeta Risk Guard\` easy for another autonomous agent to discover, understand, buy, validate, and reuse without human explanation.

The product is not a token, trading bot, or wallet manager. It is a read-only Base ERC-20 risk-screening service sold through Virtuals ACP v2.

## P0 — immediate readiness

Implemented in this release:

1. **Machine-readable contract**
   - Public \`agent.json\` with identity, wallet, chain, price, SLA, schemas, sources and failure semantics.
   - Public \`openapi.json\` for the limited web preview.
   - Public \`llms.txt\` that tells an LLM exactly how the paid ACP service behaves.

2. **Clear paid value**
   - Free web access is a limited headline preview.
   - The paid ACP deliverable remains the full strict JSON report.
   - The full report contains dangerous permissions, liquidity risk, holder concentration and trading activity that are not returned by the free endpoint.

3. **Marketplace discovery**
   - Strong semantic offering description: Base, ERC-20, token risk, honeypot, dangerous permissions, liquidity, holders, 24h activity.
   - Public ACP Resource linking to the machine-readable service manifest.
   - Local discovery checks persist which marketplace search queries can find the provider.

4. **Buyer-safe failure behavior**
   - Unsupported/insufficiently covered tokens are not quoted.
   - Temporary source failures have bounded retries.
   - A blocked preflight sends one structured status message and never requests payment.
   - No other-token or other-chain fallback.
   - Missing data is never converted to reassuring zeroes.

5. **Delivery reliability**
   - A validated preflight report is cached for two minutes.
   - If the buyer funds quickly, the same validated report is delivered instead of relying on a second upstream call.
   - If the cache is stale, the provider performs a bounded refresh.
   - Ambiguous financial writes are never silently retried.

6. **Public-pilot recovery**
   - Only one actionable pre-settlement job is admitted during the unverified pilot.
   - Unsupported jobs do not permanently consume the public pilot.
   - Marketplace intake pauses while an actionable first job is in flight.
   - Failed/unsupported pilot jobs allow the public slot to reopen.
   - A verified settlement promotes the marketplace gate to verified mode.
   - A verified provider automatically reopens after worker restart.
   - While the worker is hosted on the local Windows machine, concurrency is intentionally capped at one actionable job; excess jobs receive a structured busy/no-payment response.

7. **Operator analytics**
   - Durable local \`business-metrics.json\`.
   - Funnel: observed → quoted → funded → submitted → completed → settled.
   - Unsupported/terminal counts.
   - Unique observed buyers.
   - Preflight/refresh scan attempts and cached deliveries.
   - On-chain credited USDC revenue.
   - Worker heartbeat and marketplace mode.
   - Marketplace impressions/profile views are explicitly marked unavailable because the current ACP CLI does not expose them.

8. **Safe deploys**
   - New worker code is deployed into immutable versioned Windows directories.
   - Marketplace intake is paused before a worker upgrade.
   - Financial journal/state remains outside code deployments.
   - Fresh heartbeat is mandatory before install success.

## Machine buyer contract

### Discovery

Search concepts:

- Base token risk
- ERC-20 security
- honeypot Base
- dangerous token permissions
- token liquidity risk
- holder concentration

### Purchase

Offering: \`Token Risk Scan\`

Provider: \`0xefcb0359e2cd6d1ad92cbca1e41c8946b308d7df\`

Price: \`0.03 USDC\`

Chain: \`8453\`

SLA: \`5 minutes\`

Requirement:

\`\`\`json
{"tokenAddress":"0x..."}
\`\`\`

The provider quotes only when the exact token is covered by the required security source. Funding must match the exact 0.03-USDC ACP budget.

### Deliverable

The paid deliverable is strict JSON containing:

- \`riskScore\`
- \`riskLevel\`
- \`honeypot\`
- \`dangerousPermissions\`
- \`liquidityRisk\`
- \`holderConcentration\`
- \`tradingActivity\`
- \`warnings\`
- \`summary\`

Extra or missing fields are rejected by the provider before submission.

## P1 — execute after the first real paid job

These items require evidence or an external decision, so they are not faked during P0:

- **First settlement + review:** obtain at least one independent paid completion and ask the buyer for an authentic review.
- **ERC-8004:** evaluate registration after exact on-chain fee/cost is known. Registration improves on-chain review portability but is not required for the first sale.
- **24/7 cloud worker:** move from the home Windows host after the paid path is proven. Do not copy private keys into a cloud service; use a supported signer/auth deployment model.
- **Alerting:** add authenticated remote telemetry/Telegram alerts only with a proper secret or signed payload, never an unauthenticated public ingest endpoint.

## P2 — scale only after usage

Do not add product surface merely to make the profile look busy.

Trigger expansion from evidence:

- 3+ successful paid jobs: evaluate a faster/batch offering.
- 3+ unique repeat buyers: evaluate a 7/30-day subscription.
- 10+ paid jobs: review price, SLA and source costs from actual unit economics.
- Repeated requests for multiple tokens: add a batch scan instead of forcing many single jobs.

## Go/no-go signals

First 72 hours after discovery is confirmed:
- Target: at least one job or buyer interaction.
- Zero jobs does not prove product failure; first recheck discovery/query fit.

By day 7:
- If discovery is confirmed but paid jobs remain zero, change positioning/distribution rather than blindly lowering price.
- Add another agent-native distribution channel only after the ACP listing itself is proven technically healthy.

Operational stop conditions:
- Worker heartbeat stale.
- Offering contract differs from approved schema/price/SLA.
- Signer policy is missing.
- Repeated upstream source outage.
- Any ambiguous financial write.
- Unverified settlement presented as revenue.

## Features intentionally not enabled

- Virtuals Compute: not needed; the risk engine runs on Jepeta infrastructure.
- Agent Card: unrelated to this service.
- Tokenization: not needed to sell ACP jobs.
- Subscription: premature before repeat demand.

The goal is a small, legible, trustworthy service — not maximum feature count.
