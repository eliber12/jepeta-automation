import type { Config } from "@netlify/functions";
import { scanToken } from "./_shared/risk-engine.mjs";

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export default async (req: Request) => {
  try {
    const url = new URL(req.url);
    let tokenAddress = url.searchParams.get("tokenAddress") || "";

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      tokenAddress = String((body as Record<string, unknown>)?.tokenAddress || tokenAddress);
    }

    if (!tokenAddress) {
      return json({ error: "tokenAddress is required" }, 400);
    }

    const report = await scanToken(tokenAddress);
    return json(report, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message.startsWith("Invalid") ? 400 : 502;
    return json({ error: message }, status);
  }
};

export const config: Config = {
  path: "/api/risk-scan",
};
