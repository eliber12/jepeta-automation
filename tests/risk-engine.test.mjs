import test from "node:test";
import assert from "node:assert/strict";
import { analyzeRisk, validateTokenAddress } from "../netlify/functions/_shared/risk-engine.mjs";

const ADDRESS = "0x1111111111111111111111111111111111111111";

test("validates EVM address shape", () => {
  assert.equal(validateTokenAddress(ADDRESS), true);
  assert.equal(validateTokenAddress("0x1234"), false);
});

test("marks honeypot as critical", () => {
  const result = analyzeRisk({
    address: ADDRESS,
    goPlusToken: {},
    honeypot: { honeypotResult: { isHoneypot: true } },
    dexPairs: [{ liquidity: { usd: 300000 }, volume: { h24: 100000 }, txns: { h24: { buys: 10, sells: 8 } } }],
    sourceErrors: [],
  });

  assert.equal(result.honeypot, true);
  assert.equal(result.riskLevel, "CRITICAL");
  assert.equal(result.riskScore, 100);
});

test("low-risk sample stays low", () => {
  const result = analyzeRisk({
    address: ADDRESS,
    goPlusToken: {
      is_honeypot: "0",
      holders: [
        { percent: "0.05" },
        { percent: "0.04" },
        { percent: "0.03" },
        { percent: "0.02" },
      ],
    },
    honeypot: { honeypotResult: { isHoneypot: false }, simulationResult: { buyTax: 1, sellTax: 1 } },
    dexPairs: [{ liquidity: { usd: 500000 }, volume: { h24: 120000 }, txns: { h24: { buys: 120, sells: 105 } } }],
    sourceErrors: [],
  });

  assert.equal(result.honeypot, false);
  assert.equal(result.riskLevel, "LOW");
  assert.ok(result.riskScore < 25);
});

test("dangerous permissions increase risk", () => {
  const result = analyzeRisk({
    address: ADDRESS,
    goPlusToken: {
      hidden_owner: "1",
      owner_change_balance: "1",
      transfer_pausable: "1",
      holders: [{ percent: "0.20" }, { percent: "0.15" }, { percent: "0.10" }],
    },
    honeypot: { honeypotResult: { isHoneypot: false } },
    dexPairs: [{ liquidity: { usd: 80000 }, volume: { h24: 5000 }, txns: { h24: { buys: 8, sells: 4 } } }],
    sourceErrors: [],
  });

  assert.ok(result.riskScore >= 50);
  assert.ok(["HIGH", "CRITICAL"].includes(result.riskLevel));
  assert.ok(result.dangerousPermissions.includes("hidden_owner"));
});
