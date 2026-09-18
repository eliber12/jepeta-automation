import type { Config } from "@netlify/functions";
import { recordAffiliateClick } from "./_shared/engine.mts";

export default async (req: Request) => {
  const url = new URL(req.url);
  const id = url.searchParams.get("id") || "";
  const affiliate = await recordAffiliateClick(id);

  if (!affiliate) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: affiliate.url,
      "Cache-Control": "no-store",
    },
  });
};

export const config: Config = {
  path: "/go",
};
