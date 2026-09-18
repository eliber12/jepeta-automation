import test from "node:test";
import assert from "node:assert/strict";
import { actionFromStatus, extractTokenAddress, isEvmAddress, isValidRiskReport, shouldHandleJob } from "../scripts/acp-worker-lib.mjs";

const ADDRESS = "0x1111111111111111111111111111111111111111";

test("extractTokenAddress parses requirement JSON", () => {
  const history = { entries: [{ kind: "message", contentType: "requirement", content: JSON.stringify({ tokenAddress: ADDRESS }) }] };
  assert.equal(extractTokenAddress(history), ADDRESS);
});

test("extractTokenAddress falls back to address in text", () => {
  assert.equal(extractTokenAddress({ entries: [{ kind: "message", content: "scan " + ADDRESS }] }), ADDRESS);
});

test("validates risk report", () => {
  assert.equal(isValidRiskReport({
    riskScore: 10, riskLevel: "LOW", honeypot: false, dangerousPermissions: [],
    liquidityRisk: "LOW", holderConcentration: "LOW", tradingActivity: "24h volume $100", warnings: [], summary: "LOW risk"
  }), true);
});

test("filters provider jobs for Jepeta wallet", () => {
  assert.equal(shouldHandleJob({ providerAddress: "0xefcb0359e2cd6d1ad92cbca1e41c8946b308d7df", legacy: false }), true);
  assert.equal(shouldHandleJob({ providerAddress: "0x0000000000000000000000000000000000000000", legacy: false }), false);
});

test("maps lifecycle status to provider action", () => {
  assert.equal(actionFromStatus("open"), "setBudget");
  assert.equal(actionFromStatus("funded"), "submit");
  assert.equal(actionFromStatus("submitted"), "wait");
});

test("validates EVM address", () => {
  assert.equal(isEvmAddress(ADDRESS), true);
  assert.equal(isEvmAddress("0x123"), false);
});
