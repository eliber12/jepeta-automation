export const AGENT_WALLET = "0xefcb0359e2cd6d1ad92cbca1e41c8946b308d7df";
export const OFFERING_PRICE_USDC = "0.03";
export const BASE_CHAIN_ID = 8453;
export const DEFAULT_RISK_API = "https://jepeta-automation.netlify.app/api/risk-scan";

export function psQuote(value) {
  return "'" + String(value).replace(/'/g, "''") + "'";
}

export function parseJsonLine(line) {
  try { return JSON.parse(line); } catch { return null; }
}

export function isEvmAddress(value) {
  return /^0x[a-fA-F0-9]{40}$/.test(String(value || ""));
}

function parseRequirementContent(content) {
  if (content && typeof content === "object") {
    const address = content.tokenAddress;
    return isEvmAddress(address) ? String(address) : null;
  }
  if (typeof content !== "string") return null;
  try {
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === "object" && isEvmAddress(parsed.tokenAddress)) return parsed.tokenAddress;
  } catch {}
  const match = content.match(/0x[a-fA-F0-9]{40}/);
  return match ? match[0] : null;
}

export function extractTokenAddress(history) {
  const entries = Array.isArray(history?.entries) ? history.entries : [];
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const entry = entries[i];
    if (!entry || entry.kind === "system") continue;
    if (String(entry.contentType || "").toLowerCase() === "requirement") {
      const address = parseRequirementContent(entry.content);
      if (address) return address;
    }
  }
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const address = parseRequirementContent(entries[i]?.content);
    if (address) return address;
  }
  return null;
}

export function isValidRiskReport(report) {
  if (!report || typeof report !== "object") return false;
  const required = ["riskScore","riskLevel","honeypot","dangerousPermissions","liquidityRisk","holderConcentration","tradingActivity","warnings","summary"];
  if (!required.every((key) => Object.prototype.hasOwnProperty.call(report, key))) return false;
  if (typeof report.riskScore !== "number" || report.riskScore < 0 || report.riskScore > 100) return false;
  if (!["LOW","MEDIUM","HIGH","CRITICAL"].includes(report.riskLevel)) return false;
  if (typeof report.honeypot !== "boolean") return false;
  if (!Array.isArray(report.dangerousPermissions) || !Array.isArray(report.warnings)) return false;
  return typeof report.summary === "string";
}

export function shouldHandleJob(job) {
  if (!job || job.legacy) return false;
  return String(job.providerAddress || "").toLowerCase() === AGENT_WALLET;
}

export function actionFromStatus(status) {
  if (status === "open") return "setBudget";
  if (status === "funded") return "submit";
  return "wait";
}
