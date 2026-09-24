# Jepeta Outreach — canonical source of truth

Use this file before any external outreach. Do not use old Netlify URLs.

Target-specific status, UTM links and submission packets: [DISTRIBUTION.md](DISTRIBUTION.md)

## Canonical production endpoints

- Website: https://jepeta.dev/
- Agent manifest: https://jepeta.dev/agent.json
- LLM guide: https://jepeta.dev/llms.txt
- OpenAPI: https://jepeta.dev/openapi.json
- Free API: https://aitgmgfumsdqecmanrab.supabase.co/functions/v1/jepeta-risk-scan?tokenAddress=0x...
- Direct ACP profile: https://app.virtuals.io/acp/agent/01a0b446-374c-7eb8-8fe8-cd1a9945ea70

## Commercial facts

- Product: Jepeta Risk Guard
- Network: Base / 8453
- Paid offering: Token Risk Scan
- Price: 0.03 USDC
- Provider wallet: 0xefcb0359e2cd6d1ad92cbca1e41c8946b308d7df
- Sources: GoPlus Security + exact matching Base DEX Screener context
- Safety semantics: read-only; no trading or buyer-fund movement; required unknown honeypot/mintability values fail closed

## Outreach boilerplate

Jepeta Risk Guard is a machine-readable Base ERC-20 pre-trade risk gate for autonomous agents.

Free API:
GET https://aitgmgfumsdqecmanrab.supabase.co/functions/v1/jepeta-risk-scan?tokenAddress=0x...

Canonical guide:
https://jepeta.dev/llms.txt

Direct ACP profile:
https://app.virtuals.io/acp/agent/01a0b446-374c-7eb8-8fe8-cd1a9945ea70

The full Token Risk Scan is available through Virtuals ACP at 0.03 USDC.

## Rule

Before sending any outreach, verify all URLs and commercial facts against the current default branch. If a URL conflicts with README.md, llms.txt, or agent.json, stop and resolve the mismatch before sending.
