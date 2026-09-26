# Jepeta Distribution Packets

Operational distribution source. A target is not counted as submitted until an external confirmation or public listing exists.

Checked: 2026-09-26

## Canonical assets

- Product: Jepeta Risk Guard
- Website: https://jepeta.dev/
- Live monitor: https://jepeta.dev/base-token-risk-monitor.html
- OpenAPI: https://jepeta.dev/openapi.json
- Agent manifest: https://jepeta.dev/agent.json
- LLM guide: https://jepeta.dev/llms.txt
- Public examples: https://github.com/eliber12/jepeta-automation/tree/main/examples
- Logo: https://jepeta.dev/logo-jepeta.svg
- 1200x630 image: https://jepeta.dev/og-jepeta.png
- Telegram: https://t.me/jepeta_tools
- Virtuals ACP: https://app.virtuals.io/acp/agent/01a0b446-374c-7eb8-8fe8-cd1a9945ea70

## Reusable listing copy

Name:
Jepeta Risk Guard

Tagline:
Fail-closed pre-trade risk guard for Base agents

Short description:
Fail-closed Base / 8453 pre-trade risk guard for autonomous agents, with machine-readable PASS, WARN or BLOCK, explicit data quality, timestamps, a GET-only JSON API, live public risk feed, and deeper evidence through Telegram or Virtuals ACP. The scanner remains the human preview.

Evidence:
Jepeta accepts one exact Base ERC-20 contract address and combines GoPlus security signals with matching Base market context. The public machine contract exposes honeypot, mintability, taxes, liquidity, concentration, source status and data quality. Required unknown security evidence fails closed.

Safety:
Screening only. No wallet connection, signatures, trade execution, audit guarantee, or investment recommendation.

## Target status

| Target | Status | Action URL | Primary fit |
| --- | --- | --- | --- |
| Base Dashboard | READY-BLOCKED-EXTERNAL-FORM | https://dashboard.base.org/register | Base ecosystem / developer app |
| Crypto Tools Directory | READY-BLOCKED-EXTERNAL-FORM | https://cryptotoolsdirectory.com/submit-new | Abuse & Scam Detector / Developers APIs |
| agent-tools.org | READY-BLOCKED-EXTERNAL-POST | https://agent-tools.org/ | Agent-ready machine API |
| agentfirst.directory | READY-BLOCKED-EXTERNAL-FORM | https://agentfirst.directory/submit | Agent-enabling risk gate |
| Quillhash Web3 Security Tools | BLOCKED-FORK-REQUIRED | https://github.com/Quillhash/Web3-Security-Tools | Rug checker / Web3 security |

## Target packets

### Base Dashboard

Landing URL:
https://jepeta.dev/?utm_source=base_dashboard&utm_medium=directory&utm_campaign=ecosystem_listing#scanner

Initial form value:
Jepeta Risk Guard

Evidence to use:
- Base chain ID 8453 only.
- Free read-only scanner.
- Live Base risk monitor.
- OpenAPI and developer examples.

Do not claim submission until the dashboard returns a confirmation or listing.

### Crypto Tools Directory

Landing URL:
https://jepeta.dev/?utm_source=crypto_tools_directory&utm_medium=directory&utm_campaign=tool_listing#scanner

Suggested primary category:
Abuse and Scam Detector

Secondary fit:
Developers, APIs and Data Sources

Suggested tags:
Base, Security, Scam Detector, Api, Analysis

Thumbnail:
https://jepeta.dev/og-jepeta.png

Listing copy:
Jepeta Risk Guard is a fail-closed pre-trade risk guard for Base agents. Before a swap or buy, submit one exact ERC-20 address to get PASS, WARN or BLOCK plus honeypot, mintability, tax, liquidity, holder-concentration, data-quality and timestamp signals. The scanner is the human preview; developers can use the GET-only JSON API, and deeper evidence is available through Telegram Stars or Virtuals ACP.

External form requirements can include a contact email and media fields. Do not invent them.

### agent-tools.org

Landing URL:
https://jepeta.dev/?utm_source=agent_tools&utm_medium=directory&utm_campaign=agent_listing#developers

Machine evidence:
- https://jepeta.dev/llms.txt
- https://jepeta.dev/openapi.json
- https://jepeta.dev/agent.json
- https://github.com/eliber12/jepeta-automation/tree/main/examples

Agent role:
An autonomous agent can call Jepeta before execution, branch on PASS/WARN/BLOCK and data quality, discover recent signals from the public feed, and buy deeper evidence through Virtuals ACP.

Classification candidate:
Agent-ready / agent-enabling. The directory reviewer remains authoritative.

Do not fabricate an AFS score. A third-party listing is not public until its review gate passes.

### agentfirst.directory

Landing URL:
https://jepeta.dev/?utm_source=agentfirst&utm_medium=directory&utm_campaign=agent_listing#developers

Classification candidate:
Agent-enabling

Evidence for material agent role:
- strict machine decision contract;
- explicit fail-closed error behavior;
- public agent manifest and LLM documentation;
- autonomous paid evidence rail through Virtuals ACP;
- one-shot exact-token risk action before execution.

Do not describe generic API availability alone as the reason for inclusion.

### Quillhash Web3 Security Tools

Repository:
https://github.com/Quillhash/Web3-Security-Tools

Suggested section:
Rug Checker Tools

Proposed entry:
Jepeta Risk Guard - fail-closed pre-trade risk guard for Base agents, with exact-token honeypot, mintability, taxes, liquidity, holder concentration, data quality and machine-readable PASS/WARN/BLOCK output.

Landing URL:
https://jepeta.dev/?utm_source=quillhash&utm_medium=github_directory&utm_campaign=security_tools#scanner

Current blocker:
The connected GitHub identity has read access to the upstream repository but no push/fork action is exposed in the current tool connection. No PR has been submitted.

## Completion rule

Move a target from READY/BLOCKED to SUBMITTED only with one of:
- submission confirmation;
- created issue/PR;
- API response confirming receipt.

Move SUBMITTED to LIVE only after the public listing is verifiable.
