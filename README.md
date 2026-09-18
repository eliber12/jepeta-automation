# Jepeta Automation

Production automation for the Telegram channel [@jepeta_tools](https://t.me/jepeta_tools).

## Runtime
- Netlify Functions
- Netlify Scheduled Functions
- Netlify Blobs
- Gemini API
- Telegram Bot API

## Required secrets
- `TELEGRAM_BOT_TOKEN`
- `GEMINI_API_KEY`

Do not commit secrets to this repository.

Deployment source: public GitHub repository connected to Netlify.
## ACP provider worker

The paid Virtuals ACP offering is handled by the guarded local provider worker in `worker/`. It validates the exact offering/job parties, quotes only the fixed 0.03-USDC pilot price, waits for exact escrow funding, validates the live Base risk report, submits once, journals every write, and verifies the eventual USDC settlement on Base before publication.

The worker runs outside Netlify because ACP v2 uses a long-lived event stream and the approved signer is stored in the user's Windows keychain.

Windows install/update:

```powershell
irm https://raw.githubusercontent.com/eliber12/jepeta-automation/main/scripts/install-acp-worker.ps1 | iex
```

The installer removes the earlier experimental task, downloads a clean `main` snapshot, runs the full test suite, installs the guarded worker as `Jepeta Risk Guard`, starts it, and refuses success until a live heartbeat exists.

Prerequisites:
- `acp configure` completed for Jepeta Risk Guard
- CLI signer already approved with `--policy restricted`
- Node.js installed

The offering remains hidden until a separately funded buyer test completes and the on-chain USDC settlement is independently verified. See `docs/LAUNCH.md`.

For the full local launch flow (guarded worker → isolated buyer → funding wait → paid E2E → settlement proof → marketplace publication), use:

```powershell
irm https://raw.githubusercontent.com/eliber12/jepeta-automation/main/scripts/launch-all.ps1 | iex
```

Only browser approvals and funding the isolated buyer wallet require human action.
