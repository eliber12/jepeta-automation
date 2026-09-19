# Jepeta Automation

Production automation for [@jepeta_tools](https://t.me/jepeta_tools) plus the guarded \`Jepeta Risk Guard\` Virtuals ACP provider.

## Runtime

- Netlify Functions / Scheduled Functions / Blobs
- Telegram Bot API
- Gemini API
- Local guarded Virtuals ACP v2 provider worker on Windows
- Base mainnet settlement verification

## Secrets

Required Netlify secrets:

- \`TELEGRAM_BOT_TOKEN\`
- \`GEMINI_API_KEY\`

ACP authentication and signer material stay on the provider machine. Never commit private keys, OAuth tokens, signer keys or wallet exports.

## Jepeta Risk Guard

Paid offering:

- Agent: \`Jepeta Risk Guard\`
- Offering: \`Token Risk Scan\`
- Chain: Base / 8453
- Price: 0.03 USDC
- SLA: 5 minutes
- Input: one Base ERC-20 contract address
- Full paid result: strict JSON risk report
- Payment: Virtuals ACP escrow
- Trading/withdrawals: not performed by the worker

The public web scanner is intentionally a limited preview. The paid ACP deliverable contains the detailed contract-permission, liquidity, holder-concentration and trading-activity fields.

Machine-readable references:

- \`https://jepeta-automation.netlify.app/agent.json\`
- \`https://jepeta-automation.netlify.app/openapi.json\`
- \`https://jepeta-automation.netlify.app/llms.txt\`

## One-command agent-commerce upgrade

On the already authenticated Windows provider machine:

\`\`\`powershell
Set-Location $env:TEMP
irm https://raw.githubusercontent.com/eliber12/jepeta-automation/main/scripts/upgrade-agent-ready.ps1 | iex
\`\`\`

This flow:

1. pauses new marketplace intake before upgrading;
2. deploys the worker into a new immutable versioned directory;
3. runs all tests;
4. requires a fresh live heartbeat;
5. upgrades the offering description and strict schemas;
6. creates the public ACP capability Resource if absent;
7. checks marketplace discovery queries;
8. restores the guarded public pilot/verified marketplace state;
9. prints the business dashboard.

Durable financial state remains under \`%LOCALAPPDATA%\\JepetaRiskGuard\` and is never replaced by a code deploy.

## Business dashboard

The live worker writes:

\`%LOCALAPPDATA%\\JepetaRiskGuard\\business-metrics.json\`

To view it:

\`\`\`powershell
$app = (Get-Content "$env:LOCALAPPDATA\\JepetaRiskGuard\\active-app.txt" -Raw).Trim()
powershell -NoProfile -ExecutionPolicy Bypass -File "$app\\scripts\\show-acp-dashboard.ps1"
\`\`\`

It reports worker state, marketplace mode, observed/quoted/funded/submitted/completed/settled jobs, unsupported jobs, unique buyers, scan attempts and independently verified USDC revenue.

Virtuals ACP does not currently expose marketplace impression/profile-view telemetry through the CLI; the dashboard says this explicitly instead of inventing a number.

## Safety model

- exact provider/offering/chain/party validation;
- separate buyer/evaluator required;
- exact 0.03-USDC funding;
- unsupported tokens are not quoted;
- missing security data fails closed;
- no cross-token/cross-chain data fallback;
- preflight reports are cached briefly to reduce post-funding source failure;
- bounded retries only;
- write-ahead financial journal;
- ambiguous writes are never blindly retried;
- settlement revenue requires a Base receipt containing both ACP completion and the matching USDC transfer;
- restricted signer policy remains required.

The PC must remain powered on, online and awake during the local-worker pilot. See \`docs/AGENT_COMMERCE.md\` for the CTO readiness plan and scaling gates.
