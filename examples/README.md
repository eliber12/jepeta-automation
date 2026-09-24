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

The example exits with:
- code 0 for PASS;
- code 2 for WARN;
- code 3 for BLOCK;
- code 1 when the scan is unavailable or invalid.

PASS is not a safety guarantee. Your application remains responsible for its own execution policy.

## Machine discovery

Recent public signals:

```text
GET https://aitgmgfumsdqecmanrab.supabase.co/functions/v1/jepeta-risk-feed?limit=20&hours=24
```

Canonical contracts:
- OpenAPI: https://jepeta.dev/openapi.json
- Agent manifest: https://jepeta.dev/agent.json
- LLM guide: https://jepeta.dev/llms.txt
- Live monitor: https://jepeta.dev/base-token-risk-monitor.html
