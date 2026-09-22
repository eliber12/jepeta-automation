# Jepeta Risk Guard — Base Token Risk Scanner

Scan any Base ERC-20 token for honeypot, mintability, taxes, liquidity and holder risk before execution.

## Free preview

Use the [interactive scanner](https://eliber12.github.io/jepeta-core/#scanner) or call:

`GET https://aitgmgfumsdqecmanrab.supabase.co/functions/v1/jepeta-risk-scan?tokenAddress=0x...`

The free response returns a strict PASS / WARN / BLOCK decision plus core raw signals and source-quality status.

## Full evidence report

The paid **Token Risk Scan** report adds dangerous permissions, liquidity-risk assessment, holder concentration, 24h trading activity, full warnings and a structured summary.

Price: **0.03 USDC** through Virtuals ACP.

Live registry offering: `token_risk_scan` (`01a0bb7b-be32-73e8-abe6-1385a115ac16`).

[Buy full report on Jepeta's ACP profile](https://app.virtuals.io/acp/agent/01a0b446-374c-7eb8-8fe8-cd1a9945ea70)

## Base token risk guide

- [Base honeypot checker and token-risk guide](https://eliber12.github.io/jepeta-core/base-honeypot-checker.html)

## Machine documentation

- [llms.txt](llms.txt)
- [Full agent guide](llms-full.txt)
- [OpenAPI](openapi.json)
- [Agent manifest](agent.json)
- [agents.json](agents.json)
- [Sample full report](sample-full-report.json)

Jepeta is read-only screening, not a smart-contract audit, safety guarantee or investment recommendation.
