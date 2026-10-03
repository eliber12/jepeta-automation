# Jepeta integration examples

Minimal public examples for the read-only Base / 8453 risk API.

## Canonical V5 POST

```bash
curl --fail-with-body --silent --show-error \
  'https://aitgmgfumsdqecmanrab.supabase.co/functions/v1/jepeta-risk-scan' \
  -H 'Content-Type: application/json' \
  --data '{"tokenAddress":"0x532f27101965dd16442e59d40670faf5ebb142e4"}'
```

Use [openapi-v5.json](../openapi-v5.json) for the full response and failure contract. A usable result requires HTTP 200, `api_version: "v5"`, `status: "VERDICT"`, Base `chain_id: 8453`, the exact requested `token_address`, and a known `verdict` (`PASS`, `WARN`, or `BLOCK`). Stop on `NO_VERDICT` or an HTTP error. Inspect `evidence_quality`, `freshness`, `logical_signals`, `source_status` and `conflicts` before applying your own policy.

V5 is public and canonical; its schema identifier remains `5.0.0-internal.1` for compatibility. Methodology is 2.1.1.

## Supported V4 GET compatibility

```bash
curl --fail-with-body --silent --show-error --get \
  'https://aitgmgfumsdqecmanrab.supabase.co/functions/v1/jepeta-risk-scan-v4' \
  --data-urlencode 'tokenAddress=0x532f27101965dd16442e59d40670faf5ebb142e4'
```

V4 remains supported at the explicit URL above and at default GET. The existing `examples/curl.sh` and JavaScript gate below use the supported V4 GET contract; V5 uses different response fields.

## V4 JavaScript agent gate

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

- Canonical V5 OpenAPI: https://jepeta.dev/openapi-v5.json
- V4 compatibility OpenAPI: https://jepeta.dev/openapi.json
- Agent manifest: https://jepeta.dev/agent.json
- LLM guide: https://jepeta.dev/llms.txt
- Methodology: https://jepeta.dev/methodology.json
- Live monitor: https://jepeta.dev/base-token-risk-monitor.html
