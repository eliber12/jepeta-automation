import type { Config } from "@netlify/functions";
import { healthSnapshot } from "./_shared/engine.mjs";

export default async () => {
  return Response.json(await healthSnapshot(), {
    headers: { "Cache-Control": "no-store" },
  });
};

export const config: Config = {
  path: "/health",
};
