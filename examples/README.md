# Jepeta integration examples

Minimal public examples for the read-only Base / 8453 risk API.

## curl

```bash
curl --get \
  'https://aitgmgfumsdqecmanrab.supabase.co/functions/v1/jepeta-risk-scan' \
  --data-urlencode 'tokenAddress=0x532f27101965dd16442e59d40670faf5ebb142e4'
```

## JavaScript agent gate

Run:

```bash
node examples/agent-risk-gate.mjs 0x532f27101965dd16442e59d40670faf5ebb142e4
```

The example validates that the response belongs to Base chain 8453 and to the exact token requested before using the verdict.

Exit codes:

- code 0: server decision is PASS and data quality is HIGH or MEDIUM;
- code 2: review required because the server returned WARN or data quality is LOW;
- code 3: BLOCK;
- code 1: unavailable, invalid, malformed, wrong-chain, or wrong-token response.

The script exposes both the server `decision` and an example client-side `effectiveGate`. The client-side gate is intentionally conservative; applications should define their own execution policy.

PASS is not a safety guarantee. Never convert missing values into reassuring zeroes.

## Machine discovery

Recent public signals:

```text
GET https://aitgmgfumsdqecmanrab.supabase.co/functions/v1/jepeta-risk-feed?limit=20&hours=24
```

Canonical contracts:

- OpenAPI: https://jepeta.dev/openapi.json
- Agent manifest: https://jepeta.dev/agent.json
- LLM guide: https://jepeta.dev/llms.txt
- Methodology: https://jepeta.dev/methodology.json
- Live monitor: https://jepeta.dev/base-token-risk-monitor.html
