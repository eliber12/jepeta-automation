# Jepeta Risk Guard v3 — Decision Layer

Status: experimental branch only. **Do not deploy to the live ACP offering yet.**

## Goal

Turn the current normalized risk report into a machine-actionable pre-transaction policy decision without weakening the v2 fail-closed engine.

v3 reuses the proven v2 scan and adds:

- `policyVerdict`: `BLOCK`, `REVIEW`, or `NO_HARD_BLOCK_DETECTED`
- `hardBlockers`: stable blocker codes
- `reasonCodes`: stable machine-readable risk/data-quality codes
- `dataQuality`: `HIGH`, `MEDIUM`, or `LOW`
- `sourceStatus`: GoPlus + DEX Screener availability/coverage status
- `evidence[]`: source, signal, value, severity, reason code
- explicit `chainId`, `tokenAddress`, and `observedAt`
- deterministic historical snapshots and delta comparison

## Policy semantics

`BLOCK` is intentionally narrow and reserved for configured hard blockers currently backed by direct source signals:

- `HONEYPOT_DETECTED`
- `CANNOT_SELL_ALL`
- `CANNOT_BUY`

`REVIEW` is used when there is no configured hard blocker but any material risk or coverage problem remains, including medium+ risk, dangerous permissions, non-low liquidity/concentration, or incomplete data.

`NO_HARD_BLOCK_DETECTED` does **not** mean safe. It means the observed data is complete enough for the configured policy and no hard blocker or review condition was detected.

## Historical intelligence

`createRiskSnapshotV3()` records the machine-relevant state of a scan.

`compareRiskSnapshotsV3()` emits deterministic deltas such as:

- policy verdict changed
- risk score/level changed
- hard blocker added/removed
- dangerous permission added/removed
- liquidity risk changed
- holder concentration changed
- source quality changed

Persistence and repeated-token indexing are deliberately deferred until the decision contract passes evaluation on real token samples.

## Promotion gate

Do not merge v3 into the live paid ACP contract until all of these are true:

1. v3 tests pass on Windows and Ubuntu.
2. A representative real-token evaluation set is run.
3. No known false-clean decision exists in the evaluation set.
4. Output schema and copy are reviewed for machine-agent clarity.
5. Live v2 remains stable during evaluation.
