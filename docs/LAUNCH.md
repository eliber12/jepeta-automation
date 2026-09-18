# Jepeta Risk Guard: pilot handover

## What this release actually delivers

A Base-only scanner, a CLI-based provider worker, a write-ahead job journal,
read-only settlement verification, local Windows startup, a gated publication
command, and automated tests. This is NOT evidence of a paid live job, an
active worker on the owner's PC, or a profitable business.

The existing Telegram schedules and credentials are not modified. The repository
stays public. No keys or OAuth tokens belong in GitHub, public pages, or logs.

## Implemented protections

- Exact Base token/result and matching Base pool checks; never use another token's data.
- Unknown honeypot status returns an error, never `false`. Partial information is explicit.
- Fixed output schema and heuristic methodology. No safety or return guarantee.
- Only GoPlus security plus DEX Screener derived market analysis. Honeypot.is was
  removed because its public terms restrict resale/third-party functionality.
- HTTP input/body/method limits and Netlify IP rate limits. This is not a global billing cap.
- Provider-only lifecycle: quote exactly 0.03 USDC, wait for exact funding,
  scan, validate, submit. No trade, withdrawal, token creation, buyer fund,
  buyer completion, or working-capital transfer method is present in the worker.
- One-job pilot, single instance, 24-hour pilot run, bounded reads and scan attempts,
  durable write-ahead records. Ambiguous signatures stop for reconciliation,
  rather than generating repeated transactions.
- Separate buyer/evaluator; custom settlement hooks and subscriptions are rejected.
- Completion is not called wallet revenue until a Base transaction receipt contains
  BOTH this ACP job completion and a USDC transfer from the ACP contract to the
  provider. The first proof is labelled a test transfer, not organic revenue.
- Publication requires payment proof and a running live worker. Failed marketplace
  verification re-hides the offering. Graceful shutdown hides it too.

## Not completed by a GitHub/Netlify deploy

1. The owner's ACP authentication and local signer must be usable on the actual
   worker machine. Netlify currently has Telegram/Gemini secrets, not ACP credentials.
2. The worker must be started on an always-awake machine. A logon task cannot run
   when a PC is off, asleep, or disconnected. Sudden loss of connectivity cannot
   guarantee that an offering is automatically hidden.
3. An independent buyer must create, fund and approve a real 0.03-USDC pilot job.
   Its account funding minimum and actual chain/sponsorship fees must be checked
   before spending. The 0.03 service fee is NOT the total all-in test cost.
4. Validate the resulting receipt and visibility from a buyer account. Until then
   keep the offering hidden. Do not spend on advertising.

## Run on the already configured Windows computer

Download/extract this repo, open its directory, then:

```powershell
powershell -NoProfile -File .\scripts\start-jepeta.ps1
```

This starts read-only observation after tests and local ACP checks. It does not
publish, sign provider transactions, buy a job, or deposit funds.

Only after reviewing any gas/sponsorship charge, enable the pilot explicitly:

```powershell
powershell -NoProfile -File .\scripts\start-jepeta.ps1 -Live -InstallAutoStart
```

A website-created signer is not proof that the CLI can use it. If the CLI reports
`NO_SIGNER`, run the same script once with `-AuthorizeSigner`; approve the limited
signer in your browser. Never send a private key to chat.

Use a SEPARATE ACP profile/device for the buyer. Do not switch the active agent
in the worker's profile while it is running. The service name is `Token Risk Scan`;
provider `0xefcb0359e2cd6d1ad92cbca1e41c8946b308d7df`; chain `8453`.
The buyer supplies `{ "tokenAddress": "0x4200000000000000000000000000000000000006" }`.
A WETH address is a test input, not an investment recommendation.

Buyer actions remain explicit: create the job; inspect the proposed 0.03 USDC;
fund it; inspect the delivered report; complete it or reject for refund. Do not
complete an empty or unverified report. An owner-funded test is not customer demand.

After `TEST_USDC_RECEIPT_VERIFIED` and while the live worker runs:

```powershell
node .\worker\run.mjs publish
```

Before publication, set `JEPETA_BUYER_CONFIG_DIR` locally to the authenticated buyer's separate ACP profile directory. The seller's browse automatically excludes itself, so the publication command uses the separate buyer profile for discovery.

This rechecks chain evidence before making the offering visible, then checks buyer browse.
If browse does not return the service, it re-hides it. A separate buyer discovery
check is still needed before describing the marketplace rollout as complete.

To stop:

```powershell
node .\worker\run.mjs stop
```

State is under `%LOCALAPPDATA%\JepetaRiskGuard`, outside the public repository.
Do not delete a journal to retry an ambiguous financial action. Check on-chain
history first. If the public Base RPC rejects read requests, use an authenticated
`BASE_RPC_URL` configured locally; do not buy an RPC subscription without approval.

## Money and costs

Overall user ceiling: $7.50; no paid service, promotion, token launch, subscription,
or deposit was ordered by this code release. The worker does not turn this into
an enforceable platform-wide cap. Existing Netlify and GitHub usage, any chain fees,
and account funding minimums are separate and must be included in the ceiling.
The 0.03-USDC price is a trial price, not proven profitable unit economics.

## Sources used for this implementation (verified 2026-09-18)

- https://github.com/Virtual-Protocol/acp-cli/blob/main/src/commands/provider.ts
- https://github.com/Virtual-Protocol/acp-cli/blob/main/src/commands/events.ts
- https://github.com/Virtual-Protocol/acp-cli/blob/main/src/commands/job.ts
- https://github.com/Virtual-Protocol/acp-node-v2/blob/main/src/events/types.ts
- https://github.com/Virtual-Protocol/acp-node-v2/blob/main/src/core/acpAbi.ts
- https://github.com/Virtual-Protocol/acp-node-v2/blob/main/src/core/constants.ts
- https://docs.gopluslabs.io/reference/response-details
- https://gopluslabs.io/en/security-api
- https://docs.dexscreener.com/api/api-terms-and-conditions
- https://docs.honeypot.is/terms
- https://docs.netlify.com/manage/security/secure-access-to-sites/rate-limiting/
