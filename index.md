# Jepeta Risk Guard — Pre-Trade Risk Guard for Base Agents

Last updated: 2026-10-03

Fail-closed pre-trade risk guard for Base agents. Before a swap or buy, Jepeta evaluates an exact Base ERC-20 contract and returns PASS / WARN / BLOCK with risk signals, data quality and timestamp. The interactive scanner is the human preview.

## Free preview

Use the [interactive scanner](https://jepeta.dev/#scanner) or call:

`POST https://aitgmgfumsdqecmanrab.supabase.co/functions/v1/jepeta-risk-scan` with JSON body `{"tokenAddress":"0x..."}`. The [canonical V5 OpenAPI](https://jepeta.dev/openapi-v5.json) defines the response and failure contract.

The free V5 response returns a strict PASS / WARN / BLOCK verdict, logical signals, source provenance and evidence quality. V4 GET remains supported at the default endpoint and explicit `/jepeta-risk-scan-v4` for compatibility.

## Live Base risk intelligence

- [Live Base token risk monitor](https://jepeta.dev/base-token-risk-monitor.html)
- [Public machine risk feed](https://aitgmgfumsdqecmanrab.supabase.co/functions/v1/jepeta-risk-feed)
- [Permanent public risk evidence](https://jepeta.dev/risk/base/) (Evidence schema 2.0.0)
- [Sources / Trust Center](https://jepeta.dev/sources/) and [sources.json](https://jepeta.dev/sources.json)
- [Original Base risk research](https://jepeta.dev/research/)
- [September 2026 observed Base risk snapshot](https://jepeta.dev/research/base-risk-2026-09/) (rolling aggregate; raw observations private)
- [Public evidence coverage audit](https://jepeta.dev/research/public-evidence-coverage-2026-09-27/) (14 frozen public pages; reproducible counts)
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

For one Base token, paid reports cover contract permissions, taxes, liquidity risk, holder concentration, trading activity, source status and a risk summary.

- **25 Telegram Stars**: a human-readable report delivered in [@Jepeta_bot](https://t.me/Jepeta_bot). The bot confirms the price and purchase terms before payment.
- **ACP listed price: 0.03 USDC** for the structured **Token Risk Scan** contract, including v3 decision and history fields. ACP fulfillment is not currently verified; checkout is temporarily unavailable on this site.

Telegram delivery and the ACP JSON contract are distinct. The [synthetic ACP sample](sample-full-report.json) illustrates the machine contract, not a live token scan or a Telegram report.

Documented registry offering: `token_risk_scan` (`01a0bb7b-be32-73e8-abe6-1385a115ac16`).

[ACP availability](https://jepeta.dev/docs.html#commerce). The external marketplace listing is not asserted to be disabled.

## External discovery

- [Agents.NET verified profile](https://agents.net/directory/331)
- [AI Agents Directory profile](https://aiagentsdirectory.com/agent/jepeta-risk-guard)
- [Farcaster](https://farcaster.xyz/jepeta)
- [Telegram](https://t.me/jepeta_tools)
- [Public GitHub contracts](https://github.com/eliber12/jepeta-automation)

## Machine documentation

- [Developer documentation](https://jepeta.dev/docs.html)
- [llms.txt](llms.txt)
- [Full agent guide](llms-full.txt)
- [Canonical V5 OpenAPI](openapi-v5.json)
- [V4 compatibility OpenAPI](openapi.json)
- [Agent manifest](agent.json)
- [agents.json](agents.json)
- [Illustrative paid v3 report](sample-full-report.json) (deterministic synthetic inputs; not a live scan)
- [Methodology v2](methodology.json)
- [Source governance](sources.json)
- [Changelog](changelog.json)

## API status and trust semantics

- API V5 is canonical at `POST /jepeta-risk-scan`; its explicit `POST /jepeta-risk-scan-v5` route remains available.
- API V4 remains active and supported at `GET /jepeta-risk-scan-v4` and default GET. There is no V4 deprecation or mandatory migration.
- V5 methodology version: 2.1.1. V4 public Evidence version: 2.0.0.
- Public Evidence schema: 2.0.0.
- Raw provider payloads and paid/private evidence are not part of the public Evidence surface.
- Independent risk assessment by Jepeta. Source attribution does not imply partnership or endorsement.

Jepeta is read-only screening, not a smart-contract audit, safety guarantee or investment recommendation.
