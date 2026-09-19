# Jepeta Risk Guard — guarded launch and operations

## Current architecture

Jepeta Risk Guard sells the \`Token Risk Scan\` offering through Virtuals ACP v2 on Base.

- Agent ID: \`01a0b446-374c-7eb8-8fe8-cd1a9945ea70\`
- Offering ID: \`01a0b464-2334-7c1b-a88e-467c77d83327\`
- Provider wallet: \`0xefcb0359e2cd6d1ad92cbca1e41c8946b308d7df\`
- Price: \`0.03 USDC\`
- SLA: 5 minutes
- Worker: local Windows scheduled task
- Durable state: \`%LOCALAPPDATA%\\JepetaRiskGuard\`

The public web scanner is a limited preview. The full machine-readable result is the paid ACP deliverable.

## Recommended install/upgrade

Run from any PowerShell directory:

\`\`\`powershell
Set-Location $env:TEMP
irm https://raw.githubusercontent.com/eliber12/jepeta-automation/main/scripts/upgrade-agent-ready.ps1 | iex
\`\`\`

The upgrade is deliberately safe for a live seller:

1. select the known provider agent;
2. pause new marketplace intake;
3. stop only Jepeta worker processes/tasks;
4. deploy code into a new immutable versioned directory;
5. run the complete test suite;
6. start the guarded task;
7. require a fresh live heartbeat;
8. update the ACP description/schemas;
9. ensure the public capability Resource exists;
10. check marketplace discovery queries;
11. restore the guarded pilot/verified availability state;
12. print the business dashboard.

The financial journal is never deleted or replaced during an upgrade.

## Public pilot behavior

Before the first independently verified paid settlement:

- only one actionable pre-settlement job is admitted at a time;
- when a buyer creates a valid job, the offering is temporarily hidden from new buyers;
- an unsupported token is not quoted and does not permanently consume the pilot slot;
- temporary data-source failures receive bounded retries;
- a structured status message is sent when preflight becomes unavailable;
- exact 0.03-USDC funding is required before delivery;
- a fresh validated preflight report may be reused for up to two minutes after funding;
- settlement is counted as revenue only after read-only Base receipt verification.

After the first verified settlement, the gate becomes \`LIVE_VERIFIED\` and the worker can reopen the offering automatically after a restart.

## Business analytics

The worker writes:

\`%LOCALAPPDATA%\\JepetaRiskGuard\\business-metrics.json\`

View it with:

\`\`\`powershell
$app = (Get-Content "$env:LOCALAPPDATA\\JepetaRiskGuard\\active-app.txt" -Raw).Trim()
powershell -NoProfile -ExecutionPolicy Bypass -File "$app\\scripts\\show-acp-dashboard.ps1"
\`\`\`

The dashboard reports the ACP funnel, unique observed buyers, scan attempts, independently verified USDC revenue, worker heartbeat, marketplace mode and discovery checks.

The current ACP CLI does not expose marketplace impression/profile-view counts. Do not infer impressions from job counts.

## Machine-readable trust surfaces

- \`https://jepeta-automation.netlify.app/agent.json\`
- \`https://jepeta-automation.netlify.app/openapi.json\`
- \`https://jepeta-automation.netlify.app/llms.txt\`

The ACP provider also exposes a public Resource linking to the service manifest.

## Failure rules

The provider must not:

- substitute another token when GoPlus lacks exact coverage;
- use pools from another chain;
- turn missing values into zero/safe values;
- ask a buyer to fund an unsupported token;
- retry an ambiguous financial signature automatically;
- report completion as revenue without the matching USDC transfer;
- keep a five-minute SLA listing public after a graceful worker shutdown.

## Local runtime requirement

During the pilot the Windows PC must remain:

- powered on;
- connected to the internet;
- awake (no Sleep/Hibernate);
- logged in to the Windows profile that owns the ACP signer.

PowerShell and the browser may be closed. The scheduled task runs the worker in the background.

## Optional owner-funded E2E

The repository still contains \`setup-test-buyer.ps1\` and \`run-paid-e2e.ps1\` as an optional plumbing test. They are not required for the public pilot, and Virtuals agent-creation rate limits may prevent creating the test buyer.

Do not keep retrying agent creation through an undocumented rate limit.

## Costs

The owner testing ceiling remains $7.50. No token launch, Virtuals Compute balance, Agent Card, subscription, promotion or unrelated paid service is required for the ACP risk-scan pilot.

The 0.03-USDC offering price is a trial price, not yet proven unit economics.

## Next gates

After the first real paid job:

1. obtain an authentic buyer review;
2. measure actual completion latency and any provider-side chain cost;
3. decide whether ERC-8004 registration is worth its exact on-chain cost;
4. prepare a supported 24/7 cloud signer/runtime before scaling traffic.

See \`docs/AGENT_COMMERCE.md\` for the full CTO plan.
