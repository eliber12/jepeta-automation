import type { Config } from "@netlify/functions";
import { eveningKind, publish } from "./_shared/engine.mjs";

export default async () => {
  await publish(eveningKind());
};

export const config: Config = {
  schedule: "0 18 * * *",
};
