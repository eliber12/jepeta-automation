import type { Config } from "@netlify/functions";
import { publish } from "./_shared/engine.mjs";

export default async () => {
  await publish("fresh");
};

export const config: Config = {
  schedule: "0 8 * * *",
};
