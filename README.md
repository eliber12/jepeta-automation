# Jepeta Risk Guard - public contracts

Last updated: 2026-09-27

Jepeta Risk Guard is a fail-closed pre-trade risk guard for Base agents. This repository contains intentionally public API/discovery contracts, samples, integration examples, and boundary QA.

- Production website: https://jepeta.dev/
- Free Base ERC-20 preview API: https://aitgmgfumsdqecmanrab.supabase.co/functions/v1/jepeta-risk-scan
- Public risk feed: https://aitgmgfumsdqecmanrab.supabase.co/functions/v1/jepeta-risk-feed
- Public evidence API: https://aitgmgfumsdqecmanrab.supabase.co/functions/v1/jepeta-risk-evidence
- Public evidence catalog: https://jepeta.dev/risk/base/
- Public risk intelligence API: https://aitgmgfumsdqecmanrab.supabase.co/functions/v1/jepeta-risk-intelligence
- Original research: https://jepeta.dev/research/
- Guides: https://jepeta.dev/guides/
- Live Base risk monitor: https://jepeta.dev/base-token-risk-monitor.html
- Developer examples: [examples/](examples/)
- OpenAPI: https://jepeta.dev/openapi.json
- Methodology: https://jepeta.dev/methodology.json
- Machine changelog: https://jepeta.dev/changelog.json
- Paid report: Virtuals ACP / Token Risk Scan / 0.03 USDC
- Telegram: https://t.me/jepeta_tools
- Farcaster: https://farcaster.xyz/jepeta
- Agents.NET verified profile: https://agents.net/directory/331
- AI Agents Directory: https://aiagentsdirectory.com/agent/jepeta-risk-guard

## Quick start

```bash
curl --get \
  'https://aitgmgfumsdqecmanrab.supabase.co/functions/v1/jepeta-risk-scan' \
  --data-urlencode 'tokenAddress=0x532f27101965dd16442e59d40670faf5ebb142e4'
```

Decision handling:

- `BLOCK`: stop automated execution.
- `WARN`: require additional policy checks or human review.
- `PASS`: continue only if your own execution policy permits it.

Always inspect `data_quality`, `source_status`, `warnings`, and `observed_at`. PASS is not a safety guarantee.

## Public boundary

This repository is a one-way public release surface.

Production implementation, risk-engine internals, privileged configuration, settlement logic, runtime credentials, operational growth data, outreach state, and private infrastructure are intentionally excluded.

Release direction is strictly:

`private production source -> reviewed/sanitized public artifacts -> this repository`

This repository must never be used as an upstream source for production or private state.

The production website is not deployed from this repository.

## Discovery surface

Machine consumers can use `agent.json`, `agents.json`, `llms.txt`, `openapi.json`, the guide catalog, public evidence, and aggregate research surfaces.

Core topics: Base token risk, pre-trade risk guard, token security API, honeypot screening, mintability, liquidity risk, holder concentration, AI-agent risk screening, and machine-readable crypto risk evidence.

Jepeta is read-only screening, not a smart-contract audit, safety guarantee, price prediction, or investment recommendation.
