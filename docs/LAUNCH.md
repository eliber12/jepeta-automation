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
- One-job pre-publication pilot, single live instance, bounded reads and scan attempts,
  durable write-ahead records. The worker stays running until explicit stop/shutdown. Ambiguous signatures stop for reconciliation,
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

Install/update the guarded worker from the public repo:

```powershell
irm https://raw.githubusercontent.com/eliber12/jepeta-automation/main/scripts/install-acp-worker.ps1 | iex
```

The installer removes the superseded experimental task, runs the full test suite,
starts the guarded worker as a Windows scheduled task, and does not report success
until a fresh live heartbeat exists. The PC must remain powered on and awake.

A website-created signer is not enough by itself. The provider CLI signer must already
be approved locally with the restricted/Virtuals-only policy. Never put a private key
in this repository or in chat.

### Paid E2E buyer

Create an isolated buyer profile/agent:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "$env:LOCALAPPDATA\JepetaRiskGuardApp\scripts\setup-test-buyer.ps1"
```

The script authenticates a separate ACP profile, creates `Jepeta Buyer Test` if needed,
sets up its restricted signer, and prints its Base wallet/QR. Fund that buyer with a
small amount of USDC on Base. The suggested test balance is 0.10 USDC; do not exceed
the owner's overall $7.50 test ceiling.

After the buyer has at least 0.03 USDC:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "$env:LOCALAPPDATA\JepetaRiskGuardApp\scripts\run-paid-e2e.ps1"
```

That script performs the guarded launch sequence end-to-end:
create a job from the hidden offering → wait for the exact 0.03-USDC quote → fund
escrow → wait for a schema-valid report → approve the report → wait for independent
Base receipt verification → unhide the offering → verify marketplace discovery from
the separate buyer profile → write `paid-e2e-proof.json`.

The WETH address used by default is only a deterministic test input, not an
investment recommendation. An owner-funded pilot proves settlement plumbing, not
organic customer demand.

To stop the provider:

```powershell
node "$env:LOCALAPPDATA\JepetaRiskGuardApp\worker\run.mjs" stop
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
