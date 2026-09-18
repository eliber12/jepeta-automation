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

The paid Virtuals ACP offering is handled by a local provider worker. It listens for new jobs, proposes the fixed budget, waits for USDC escrow funding, calls the production Risk Scan API, validates the result, and submits the JSON deliverable.

The worker runs outside Netlify because ACP v2 uses a long-lived event stream and requires a signer stored in the user's OS keychain.

Windows install:

```powershell
irm https://raw.githubusercontent.com/eliber12/jepeta-automation/main/scripts/install-acp-worker.ps1 | iex
```

Prerequisites:
- `acp configure` completed for Jepeta Risk Guard
- CLI signer added with `acp agent add-signer --agent-id 01a0b446-374c-7eb8-8fe8-cd1a9945ea70 --policy restricted`
- Node.js installed
