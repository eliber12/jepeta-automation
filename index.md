# Jepeta Risk Guard — Pre-Trade Risk Guard for Base Agents

Last updated: 2026-09-26

Fail-closed pre-trade risk guard for Base agents. Before a swap or buy, Jepeta evaluates an exact Base ERC-20 contract and returns PASS / WARN / BLOCK with risk signals, data quality and timestamp. The interactive scanner is the human preview.

## Free preview

Use the [interactive scanner](https://jepeta.dev/#scanner) or call:

`GET https://aitgmgfumsdqecmanrab.supabase.co/functions/v1/jepeta-risk-scan?tokenAddress=0x...`

The free response returns a strict PASS / WARN / BLOCK decision plus core raw signals and source-quality status.

## Live Base risk intelligence

- [Live Base token risk monitor](https://jepeta.dev/base-token-risk-monitor.html)
- [Public machine risk feed](https://aitgmgfumsdqecmanrab.supabase.co/functions/v1/jepeta-risk-feed)
- [Permanent public risk evidence](https://jepeta.dev/risk/base/)
- [High-intent Base token risk guides](https://jepeta.dev/guides/)
- [Machine guide catalog](https://jepeta.dev/guides/index.json)
- [Token Risk API guide](https://jepeta.dev/token-risk-api.html)

The feed and monitor expose discovery signals only. Evidence-rich tokens that already passed the public publication gate may also receive a permanent HTML + JSON snapshot under `/risk/base/0xTOKEN/`. Ordinary scans are not auto-indexed. Paid-only evidence remains excluded, and PASS is not a safety guarantee.

## Focused Base risk guides

- [Base honeypot checker and token-risk guide](https://jepeta.dev/base-honeypot-checker.html)
- [Base token permissions checker](https://jepeta.dev/base-token-permissions-checker.html)
- [Base token liquidity-risk checker](https://jepeta.dev/base-token-liquidity-risk-checker.html)
- [Jepeta vs Honeypot.is](https://jepeta.dev/jepeta-vs-honeypot-is.html)

## Full evidence report

The paid **Token Risk Scan** report adds dangerous permissions, liquidity-risk assessment, holder concentration, 24h trading activity, full warnings and a structured summary.

Price: **0.03 USDC** through Virtuals ACP.

Live registry offering: `token_risk_scan` (`01a0bb7b-be32-73e8-abe6-1385a115ac16`).

[Buy full report on Jepeta's ACP profile](https://app.virtuals.io/acp/agent/01a0b446-374c-7eb8-8fe8-cd1a9945ea70)

## Machine documentation

- [Developer documentation](https://jepeta.dev/docs.html)
- [llms.txt](llms.txt)
- [Full agent guide](llms-full.txt)
- [OpenAPI](openapi.json)
- [Agent manifest](agent.json)
- [agents.json](agents.json)
- [Sample full report](sample-full-report.json)
- [Methodology](methodology.json)
- [Changelog](changelog.json)

Jepeta is read-only screening, not a smart-contract audit, safety guarantee or investment recommendation.
