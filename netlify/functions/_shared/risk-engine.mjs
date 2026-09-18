const BASE_CHAIN_ID = 8453;

const TRUE_FLAGS = new Map([
  ["is_honeypot", ["GoPlus marks token as honeypot", 100]],
  ["cannot_sell_all", ["Token may prevent full sells", 35]],
  ["hidden_owner", ["Contract may contain a hidden owner", 25]],
  ["owner_change_balance", ["Owner may be able to change holder balances", 40]],
  ["selfdestruct", ["Contract exposes self-destruct behavior", 30]],
  ["external_call", ["Contract may perform risky external calls", 15]],
  ["slippage_modifiable", ["Trading slippage/tax may be modifiable", 20]],
  ["personal_slippage_modifiable", ["Per-address slippage/tax may be modifiable", 25]],
  ["transfer_pausable", ["Transfers may be paused", 25]],
  ["trading_cooldown", ["Trading cooldown restrictions detected", 10]],
  ["is_blacklisted", ["Blacklist capability detected", 30]],
  ["is_mintable", ["Additional token supply may be mintable", 15]],
]);

function asBool(v) {
  return v === true || v === 1 || v === "1" || v === "true";
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function holderPct(holder) {
  const raw = holder?.percent ?? holder?.percentage ?? holder?.share;
  const n = num(raw);
  return n > 1 ? n : n * 100;
}

function riskLevel(score) {
  if (score >= 75) return "CRITICAL";
  if (score >= 50) return "HIGH";
  if (score >= 25) return "MEDIUM";
  return "LOW";
}

function liquidityAssessment(usd) {
  if (usd <= 0) return { label: "UNKNOWN", score: 15, warning: "No reliable liquidity value found" };
  if (usd < 10000) return { label: "CRITICAL", score: 35, warning: "Very low liquidity (< $10k)" };
  if (usd < 50000) return { label: "HIGH", score: 25, warning: "Low liquidity (< $50k)" };
  if (usd < 200000) return { label: "MEDIUM", score: 10, warning: "Moderate liquidity (< $200k)" };
  return { label: "LOW", score: 0, warning: "" };
}

function concentrationAssessment(holders = []) {
  const top = holders.slice(0, 10).map(holderPct).filter((v) => v > 0);
  if (!top.length) return { label: "UNKNOWN", score: 10, warning: "Holder concentration unavailable" };
  const top10 = top.reduce((a, b) => a + b, 0);
  const max = Math.max(...top);
  if (max >= 50 || top10 >= 80) return { label: "CRITICAL", score: 30, warning: `Extreme holder concentration (top10 ${top10.toFixed(1)}%)` };
  if (max >= 25 || top10 >= 60) return { label: "HIGH", score: 20, warning: `High holder concentration (top10 ${top10.toFixed(1)}%)` };
  if (top10 >= 40) return { label: "MEDIUM", score: 10, warning: `Moderate holder concentration (top10 ${top10.toFixed(1)}%)` };
  return { label: "LOW", score: 0, warning: "" };
}

function tradingSummary(pair) {
  if (!pair) return "No DexScreener pair data found";
  const volume = num(pair?.volume?.h24);
  const buys = num(pair?.txns?.h24?.buys);
  const sells = num(pair?.txns?.h24?.sells);
  return `24h volume $${Math.round(volume).toLocaleString("en-US")}; buys ${Math.round(buys)}; sells ${Math.round(sells)}`;
}

export function validateTokenAddress(address) {
  return /^0x[a-fA-F0-9]{40}$/.test(String(address || ""));
}

export function analyzeRisk({ address, goPlusToken = {}, honeypot = {}, dexPairs = [], sourceErrors = [] }) {
  const warnings = [];
  const dangerousPermissions = [];
  let score = 0;

  const hp = asBool(honeypot?.honeypotResult?.isHoneypot) || asBool(goPlusToken?.is_honeypot);
  if (hp) {
    score = 100;
    warnings.push("Honeypot behavior detected");
  }

  for (const [flag, [message, weight]] of TRUE_FLAGS.entries()) {
    if (asBool(goPlusToken?.[flag])) {
      dangerousPermissions.push(flag);
      warnings.push(message);
      score += weight;
    }
  }

  const sellTax = Math.max(
    num(honeypot?.simulationResult?.sellTax),
    num(goPlusToken?.sell_tax) * (num(goPlusToken?.sell_tax) <= 1 ? 100 : 1)
  );
  const buyTax = Math.max(
    num(honeypot?.simulationResult?.buyTax),
    num(goPlusToken?.buy_tax) * (num(goPlusToken?.buy_tax) <= 1 ? 100 : 1)
  );
  if (sellTax >= 25) {
    score += 30;
    warnings.push(`Very high sell tax (${sellTax.toFixed(1)}%)`);
  } else if (sellTax >= 10) {
    score += 15;
    warnings.push(`High sell tax (${sellTax.toFixed(1)}%)`);
  }
  if (buyTax >= 20) {
    score += 15;
    warnings.push(`High buy tax (${buyTax.toFixed(1)}%)`);
  }

  const bestPair = [...dexPairs].sort((a, b) => num(b?.liquidity?.usd) - num(a?.liquidity?.usd))[0];
  const liquidityUsd = num(bestPair?.liquidity?.usd);
  const liquidity = liquidityAssessment(liquidityUsd);
  score += liquidity.score;
  if (liquidity.warning) warnings.push(liquidity.warning);

  const concentration = concentrationAssessment(goPlusToken?.holders || []);
  score += concentration.score;
  if (concentration.warning) warnings.push(concentration.warning);

  if (sourceErrors.length) {
    warnings.push(`Partial source coverage: ${sourceErrors.join(", ")}`);
  }

  score = clamp(score, 0, 100);
  const level = riskLevel(score);

  const summary =
    hp
      ? "Critical risk: honeypot behavior was detected."
      : `${level} risk (score ${score}/100). Liquidity: ${liquidity.label}. Holder concentration: ${concentration.label}.`;

  return {
    riskScore: score,
    riskLevel: level,
    honeypot: hp,
    dangerousPermissions: unique(dangerousPermissions),
    liquidityRisk: liquidity.label,
    holderConcentration: concentration.label,
    tradingActivity: tradingSummary(bestPair),
    warnings: unique(warnings),
    summary,
  };
}

async function fetchJson(url, timeoutMs = 7000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { "accept": "application/json", "user-agent": "JepetaRiskGuard/1.0" },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function scanToken(address) {
  if (!validateTokenAddress(address)) {
    throw new Error("Invalid Base ERC-20 contract address");
  }

  const normalized = address.toLowerCase();
  const urls = {
    goPlus: `https://api.gopluslabs.io/api/v1/token_security/${BASE_CHAIN_ID}?contract_addresses=${encodeURIComponent(normalized)}`,
    honeypot: `https://api.honeypot.is/v2/IsHoneypot?address=${encodeURIComponent(normalized)}&chainID=${BASE_CHAIN_ID}`,
    dex: `https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(normalized)}`,
  };

  const names = Object.keys(urls);
  const settled = await Promise.allSettled(names.map((name) => fetchJson(urls[name])));
  const data = {};
  const sourceErrors = [];

  settled.forEach((result, i) => {
    const name = names[i];
    if (result.status === "fulfilled") data[name] = result.value;
    else sourceErrors.push(name);
  });

  if (!data.goPlus && !data.honeypot && !data.dex) {
    throw new Error("All risk data sources failed");
  }

  const goPlusResult = data.goPlus?.result || {};
  const goPlusToken =
    goPlusResult[normalized] ||
    goPlusResult[address] ||
    Object.values(goPlusResult)[0] ||
    {};

  return analyzeRisk({
    address: normalized,
    goPlusToken,
    honeypot: data.honeypot || {},
    dexPairs: data.dex?.pairs || [],
    sourceErrors,
  });
}
