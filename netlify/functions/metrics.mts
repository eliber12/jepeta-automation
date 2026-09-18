import type { Config } from "@netlify/functions";
import { captureMetrics } from "./_shared/engine.mts";

export default async () => {
  await captureMetrics();
};

export const config: Config = {
  schedule: "40 23 * * *",
};
