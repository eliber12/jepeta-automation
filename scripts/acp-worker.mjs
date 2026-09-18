import { spawn } from "node:child_process";
import {
  AGENT_WALLET, BASE_CHAIN_ID, DEFAULT_RISK_API, OFFERING_PRICE_USDC,
  actionFromStatus, extractTokenAddress, isValidRiskReport, parseJsonLine, psQuote, shouldHandleJob
} from "./acp-worker-lib.mjs";

const RISK_API = process.env.JEPETA_RISK_API || DEFAULT_RISK_API;
const activeJobs = new Map();
let shuttingDown = false;

function log(message, extra = "") {
  const line = "[" + new Date().toISOString() + "] " + message + (extra ? " " + extra : "");
  process.stdout.write(line + "\n");
}

function spawnAcp(args) {
  if (process.platform === "win32") {
    const script = "& acp " + args.map(psQuote).join(" ");
    return spawn("powershell.exe", ["-NoProfile","-NonInteractive","-ExecutionPolicy","Bypass","-Command",script], { windowsHide: true, stdio: ["ignore","pipe","pipe"] });
  }
  return spawn("acp", args, { stdio: ["ignore","pipe","pipe"] });
}

function runAcp(args) {
  return new Promise((resolve, reject) => {
    const child = spawnAcp(args);
    let stdout = ""; let stderr = "";
    child.stdout?.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr?.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) return reject(new Error("acp " + args.join(" ") + " failed (" + code + "): " + (stderr.trim() || stdout.trim())));
      resolve(stdout.trim());
    });
  });
}

async function runAcpJson(args) {
  const output = await runAcp([...args, "--json"]);
  const parsed = parseJsonLine(output);
  if (!parsed) throw new Error("Invalid JSON from ACP: " + output.slice(0, 300));
  return parsed;
}

async function getHistory(jobId, chainId) {
  return runAcpJson(["job","history","--job-id",String(jobId),"--chain-id",String(chainId)]);
}

async function scanWithRetry(tokenAddress, attempts = 3) {
  let lastError;
  for (let i = 1; i <= attempts; i += 1) {
    try {
      const response = await fetch(RISK_API, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ tokenAddress }), signal: AbortSignal.timeout(15000)
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error || ("HTTP " + response.status));
      if (!isValidRiskReport(body)) throw new Error("Risk API returned an invalid deliverable");
      return body;
    } catch (error) {
      lastError = error;
      log("Risk scan attempt " + i + "/" + attempts + " failed:", error instanceof Error ? error.message : String(error));
      if (i < attempts) await new Promise((r) => setTimeout(r, 2000 * i));
    }
  }
  throw lastError;
}

async function setBudget(jobId, chainId) {
  log("Job " + jobId + ": setting budget to " + OFFERING_PRICE_USDC + " USDC");
  await runAcpJson(["provider","set-budget","--job-id",String(jobId),"--amount",OFFERING_PRICE_USDC,"--chain-id",String(chainId)]);
  log("Job " + jobId + ": budget set");
}

async function submitJob(jobId, chainId) {
  const history = await getHistory(jobId, chainId);
  const tokenAddress = extractTokenAddress(history);
  if (!tokenAddress) throw new Error("Job " + jobId + ": tokenAddress not found in requirements");
  log("Job " + jobId + ": scanning " + tokenAddress);
  const report = await scanWithRetry(tokenAddress);
  await runAcpJson(["provider","submit","--job-id",String(jobId),"--deliverable",JSON.stringify(report),"--chain-id",String(chainId)]);
  log("Job " + jobId + ": deliverable submitted (" + report.riskLevel + " " + report.riskScore + "/100)");
}

function withJobLock(jobId, fn) {
  const key = String(jobId);
  if (activeJobs.has(key)) return activeJobs.get(key);
  const promise = Promise.resolve().then(fn).catch((error) => {
    log("Job " + key + " error:", error instanceof Error ? error.message : String(error));
  }).finally(() => activeJobs.delete(key));
  activeJobs.set(key, promise);
  return promise;
}

async function handleAction(jobId, chainId, action) {
  if (action === "setBudget") return setBudget(jobId, chainId);
  if (action === "submit") return submitJob(jobId, chainId);
}

async function handleEvent(event) {
  const jobId = event?.jobId;
  const chainId = Number(event?.chainId || BASE_CHAIN_ID);
  const roles = Array.isArray(event?.roles) ? event.roles : [];
  const tools = Array.isArray(event?.availableTools) ? event.availableTools : [];
  if (!jobId || !roles.includes("provider")) return;
  const action = tools.includes("setBudget") ? "setBudget" : (tools.includes("submit") ? "submit" : "wait");
  if (action !== "wait") await withJobLock(jobId, () => handleAction(jobId, chainId, action));
}

async function reconcile() {
  try {
    const payload = await runAcpJson(["job","list"]);
    const jobs = Array.isArray(payload?.jobs) ? payload.jobs : [];
    for (const job of jobs) {
      if (!shouldHandleJob(job)) continue;
      const action = actionFromStatus(job.jobStatus);
      if (action === "wait") continue;
      await withJobLock(job.onChainJobId, () => handleAction(job.onChainJobId, Number(job.chainId || BASE_CHAIN_ID), action));
    }
  } catch (error) {
    log("Reconcile failed:", error instanceof Error ? error.message : String(error));
  }
}

function startListener() {
  if (shuttingDown) return;
  const child = spawnAcp(["events","listen","--json"]);
  let buffer = "";
  child.stdout?.on("data", (chunk) => {
    buffer += chunk.toString();
    let index;
    while ((index = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, index).trim(); buffer = buffer.slice(index + 1);
      if (!line) continue;
      const event = parseJsonLine(line); if (event) void handleEvent(event);
    }
  });
  child.stderr?.on("data", (chunk) => { const t = chunk.toString().trim(); if (t) log("ACP:", t); });
  child.on("error", (error) => log("Listener error:", error.message));
  child.on("close", (code) => {
    if (shuttingDown) return;
    log("ACP listener exited with code " + code + "; restarting in 5s");
    setTimeout(startListener, 5000);
  });
  return child;
}

async function main() {
  log("Jepeta ACP worker starting");
  log("Agent wallet:", AGENT_WALLET);
  log("Risk API:", RISK_API);
  try {
    const who = await runAcpJson(["agent","whoami"]);
    log("ACP authenticated:", who?.name || "OK");
  } catch (error) {
    throw new Error("ACP CLI is not authenticated. Run acp configure first. " + (error instanceof Error ? error.message : ""));
  }
  await reconcile();
  const listener = startListener();
  const timer = setInterval(reconcile, 45000);
  const shutdown = () => {
    shuttingDown = true; clearInterval(timer); listener?.kill(); log("Jepeta ACP worker stopped"); process.exit(0);
  };
  process.on("SIGINT", shutdown); process.on("SIGTERM", shutdown);
}

main().catch((error) => { log("Fatal:", error instanceof Error ? error.message : String(error)); process.exit(1); });
