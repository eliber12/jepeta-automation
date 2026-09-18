import { getStore } from "@netlify/blobs";
import { createHash } from "node:crypto";

export const CHANNEL = "@jepeta_tools";
export const MODEL = "gemini-3.8-flash";
export const PUBLIC_BASE = "https://jepeta-automation.netlify.app";

type Affiliate = {
  id: string;
  name: string;
  username: string;
  url: string;
  enabled: boolean;
};

type Candidate = {
  source: string;
  title: string;
  url: string;
  description: string;
};

type EngineState = {
  publishedUrls: string[];
  postHashes: string[];
  lastFresh?: string;
  lastEvening?: string;
  lastMetrics?: { at: string; subscribers: number };
};

export const AFFILIATES: Affiliate[] = [
  { id: "boinkers", name: "Boinkers", username: "boinker_bot", url: "https://t.me/boinker_bot?start=_tgr_mX9Xmt4zZDI0", enabled: true },
  { id: "uncutly", name: "Uncutly AI", username: "UncutlyAIbot", url: "https://t.me/UncutlyAIbot?start=_tgr_mdAhKfk4YTg0", enabled: true },
  { id: "winly", name: "WinLy", username: "winlygames_bot", url: "https://t.me/winlygames_bot?start=_tgr_JIUv50k5MTVk", enabled: true },
  { id: "shieldnet", name: "ShieldNet", username: "ShieldNetBot", url: "https://t.me/ShieldNetBot?start=_tgr_Xsm8vNhkMzg0", enabled: true },
  { id: "celebmaker", name: "CelebMaker AI", username: "CelebMakerAI_bot", url: "https://t.me/CelebMakerAI_bot?start=_tgr_7I_V89A0MGJk", enabled: true },
];

function env(name: string): string {
  const runtime = (globalThis as any).Netlify;
  return runtime?.env?.get(name) || "";
}

function dataStore() {
  return getStore("jepeta-data", { consistency: "strong" });
}

async function getState(): Promise<EngineState> {
  const state = await dataStore().get("state.json", { type: "json" }) as EngineState | null;
  return state || { publishedUrls: [], postHashes: [] };
}

async function saveState(state: EngineState) {
  state.publishedUrls = [...new Set(state.publishedUrls)].slice(-120);
  state.postHashes = [...new Set(state.postHashes)].slice(-120);
  await dataStore().setJSON("state.json", state);
}

export async function telegram(method: string, body: Record<string, unknown>) {
  const token = env("TELEGRAM_BOT_TOKEN");
  if (!token) throw new Error("Missing TELEGRAM_BOT_TOKEN");

  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error("Telegram error: " + JSON.stringify(data));
  }
  return data.result;
}

function decode(input = "") {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function productHunt(): Promise<Candidate[]> {
  try {
    const response = await fetch("https://www.producthunt.com/feed", {
      headers: { "user-agent": "JepetaBot/1.0" },
    });
    if (!response.ok) return [];
    const xml = await response.text();
    const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].slice(0, 12);

    return entries
      .map((match) => {
        const entry = match[1];
        const title = decode((entry.match(/<title[^>]*>([\s\S]*?)<\/title>/) || [])[1] || "");
        const url = (entry.match(/<link[^>]+href=["']([^"']+)["']/) || [])[1] || "";
        const description = decode((entry.match(/<content[^>]*>([\s\S]*?)<\/content>/) || [])[1] || "");
        return title && url ? { source: "Product Hunt", title, url, description: description.slice(0, 300) } : null;
      })
      .filter(Boolean) as Candidate[];
  } catch {
    return [];
  }
}

async function hackerNews(): Promise<Candidate[]> {
  try {
    const ids = await (await fetch("https://hacker-news.firebaseio.com/v0/topstories.json")).json() as number[];
    const items = await Promise.all(ids.slice(0, 14).map(async (id) => {
      try {
        return await (await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)).json();
      } catch {
        return null;
      }
    }));

    return items
      .filter((item: any) => item?.title && item?.url)
      .map((item: any) => ({
        source: "Hacker News",
        title: item.title,
        url: item.url,
        description: `${item.score || 0} HN points · ${item.descendants || 0} comments`,
      }));
  } catch {
    return [];
  }
}

async function githubFresh(): Promise<Candidate[]> {
  try {
    const since = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
    const query = encodeURIComponent(`created:>${since} stars:>50`);
    const response = await fetch(
      `https://api.github.com/search/repositories?q=${query}&sort=stars&order=desc&per_page=10`,
      { headers: { accept: "application/vnd.github+json", "user-agent": "JepetaBot/1.0" } },
    );
    if (!response.ok) return [];

    const data = await response.json();
    return (data.items || []).map((item: any) => ({
      source: "GitHub",
      title: item.full_name,
      url: item.html_url,
      description: `${(item.description || "").slice(0, 240)} · ${item.stargazers_count} stars`,
    }));
  } catch {
    return [];
  }
}

async function freshCandidates(): Promise<Candidate[]> {
  const [ph, hn, gh] = await Promise.all([productHunt(), hackerNews(), githubFresh()]);
  const seen = new Set<string>();

  return [...ph, ...hn, ...gh].filter((candidate) => {
    if (!candidate.url || seen.has(candidate.url)) return false;
    seen.add(candidate.url);
    return true;
  }).slice(0, 28);
}

async function gemini(prompt: string): Promise<string> {
  const key = env("GEMINI_API_KEY");
  if (!key) throw new Error("Missing GEMINI_API_KEY");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify({
        system_instruction: {
          parts: [{
            text:
              "You edit Jepeta, a global English Telegram channel about AI tools, Telegram bots, mini apps, productivity, privacy and useful digital products. " +
              "Goal: earn attention and trust first, revenue second. Write concise natural English. No fake urgency, no hype, no invented facts. " +
              "Never promote gambling, adult content, drugs, weapons, surveillance, malware, fake engagement, crypto/investment promises or guaranteed-income schemes. " +
              "Prefer practical tools ordinary people can use. Use ONLY facts supplied in the prompt. " +
              "Every post should be easy to scan on a phone and useful enough to save or forward. Keep under 750 characters.",
          }],
        },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 500,
          thinkingConfig: { thinkingLevel: "low" },
        },
      }),
    },
  );

  const data = await response.json();
  if (!response.ok) throw new Error("Gemini error: " + JSON.stringify(data));

  const parts = data.candidates?.[0]?.content?.parts || [];
  const text = parts.map((part: any) => part.text || "").join("").trim();
  if (!text) throw new Error("Gemini returned empty text");
  return text;
}

function categoryFor(title: string, description = "") {
  const value = (title + " " + description).toLowerCase();
  if (/telegram|bot|mini app/.test(value)) return "#TelegramBots";
  if (/privacy|vpn|security|encrypt/.test(value)) return "#Privacy";
  if (/productiv|workflow|automat|note|calendar|task/.test(value)) return "#Productivity";
  if (/ai|llm|agent|gpt|gemini|claude|model/.test(value)) return "#AITools";
  return "#UsefulApps";
}

function parseChoice(text: string, max: number) {
  const match = text.match(/^CHOICE:\s*(\d+)/i);
  if (!match) return null;
  const index = Number(match[1]);
  return Number.isInteger(index) && index >= 0 && index < max ? index : null;
}

function hashText(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 20);
}

async function freshPost(format: "single" | "shareable") {
  const state = await getState();
  const candidates = (await freshCandidates()).filter((c) => !state.publishedUrls.includes(c.url));
  const usable = candidates.length ? candidates : await freshCandidates();
  if (!usable.length) return evergreenPost();

  const digest = usable
    .map((item, index) => `${index} | ${item.source} | ${item.title} | ${item.description} | ${item.url}`)
    .join("\n");

  const prompt = format === "shareable"
    ? "Candidates:\n" + digest + "\n\nChoose the ONE most broadly useful item. First line exactly CHOICE:<index>. Then write a highly shareable Telegram post: punchy title, 2-4 short bullets explaining why someone should care, one honest caveat if known, and end with '↗️ Forward this to someone who would use it.' Do not include the URL."
    : "Candidates:\n" + digest + "\n\nChoose the ONE most useful credible item for a broad global audience. First line exactly CHOICE:<index>. Then write a compact discovery post: clear title, what it is, why useful, who it fits, and one honest caveat if the supplied data supports one. Do not include the URL.";

  try {
    const raw = await gemini(prompt);
    const choice = parseChoice(raw, usable.length);
    const chosen = usable[choice ?? 0];
    const text = raw.replace(/^CHOICE:\s*\d+\s*/i, "").trim() +
      `\n\n${categoryFor(chosen.title, chosen.description)}  #Jepeta`;

    return {
      text,
      sourceUrl: chosen.url,
      button: { text: `Open ${chosen.title.slice(0, 28)} ↗`, url: chosen.url },
    };
  } catch {
    const chosen = usable[0];
    return {
      text: `🔎 Fresh find: ${chosen.title}\n\n${chosen.description || "Worth a look if it fits your workflow."}\n\n${categoryFor(chosen.title, chosen.description)}  #Jepeta`,
      sourceUrl: chosen.url,
      button: { text: "Open ↗", url: chosen.url },
    };
  }
}

async function evergreenPost() {
  const topics = [
    "3 checks before trusting a new Telegram bot",
    "a practical prompt pattern for comparing AI tools without hype",
    "3 ways to reduce notification overload",
    "a quick privacy checklist before connecting an app",
    "how to test whether a productivity app actually saves time",
    "3 signs a digital deal is fake urgency",
  ];

  const topic = topics[Math.floor(Date.now() / 86400000) % topics.length];

  try {
    const text = await gemini(
      "Write a searchable/shareable evergreen post about: " + topic +
      ". End with one relevant hashtag from #TelegramBots #AITools #Productivity #Privacy plus #Jepeta.",
    );
    return { text };
  } catch {
    return {
      text:
        "🛡️ Quick digital rule\n\nBefore giving a new bot or app access to your data, check what it asks for, whether those permissions match its job, and whether you can revoke access later.\n\n#Privacy  #Jepeta",
    };
  }
}

async function botProfile(username: string) {
  try {
    const response = await fetch("https://t.me/" + username, {
      headers: { "user-agent": "Mozilla/5.0" },
    });
    if (!response.ok) return "";

    const html = await response.text();
    const match =
      html.match(/<meta property="og:description" content="([^"]*)"/i) ||
      html.match(/<div class="tgme_page_description[^"]*">([\s\S]*?)<\/div>/i);

    return decode(match?.[1] || "").slice(0, 500);
  } catch {
    return "";
  }
}

export function trackedAffiliateUrl(id: string) {
  return `${PUBLIC_BASE}/go?id=${encodeURIComponent(id)}`;
}

async function affiliatePost() {
  const enabled = AFFILIATES.filter((item) => item.enabled);
  const day = Math.floor(Date.now() / 86400000);
  const affiliate = enabled[day % enabled.length];
  const profile = await botProfile(affiliate.username);

  let text = "";
  if (profile) {
    try {
      text = await gemini(
        `Affiliate candidate: ${affiliate.name} (@${affiliate.username}). Public Telegram description: ${profile}\n` +
        "Write a transparent recommendation based ONLY on that description. Do not claim it is safe, best, free, popular or verified unless stated. " +
        "Say who might find it useful. End with: 'ℹ️ Affiliate: Jepeta may earn a commission if you make a purchase through the button below.' Add #TelegramBots #Jepeta.",
      );
    } catch {
      text = "";
    }
  }

  if (!text) {
    text =
      `🔎 Telegram pick: ${affiliate.name}\n\nA Telegram app currently available through Jepeta's affiliate program. Open it below and check whether it fits what you need before spending anything.\n\nℹ️ Affiliate: Jepeta may earn a commission if you make a purchase through the button below.\n\n#TelegramBots  #Jepeta`;
  }

  return {
    text,
    affiliate,
    button: { text: `Open ${affiliate.name} ↗`, url: trackedAffiliateUrl(affiliate.id) },
  };
}

async function rememberPublished(kind: string, messageId: number, text: string, sourceUrl?: string) {
  const state = await getState();
  if (sourceUrl) state.publishedUrls.push(sourceUrl);
  state.postHashes.push(hashText(text));

  const now = new Date().toISOString();
  if (kind === "fresh") state.lastFresh = now;
  else state.lastEvening = now;

  await saveState(state);
  await dataStore().setJSON(`published/${now}-${messageId}.json`, {
    at: now,
    kind,
    messageId,
    sourceUrl: sourceUrl || null,
    hash: hashText(text),
  });
}

export async function publish(kind: "fresh" | "shareable" | "affiliate" | "evergreen") {
  let post: any;
  if (kind === "fresh") post = await freshPost("single");
  else if (kind === "shareable") post = await freshPost("shareable");
  else if (kind === "affiliate") post = await affiliatePost();
  else post = await evergreenPost();

  const body: Record<string, unknown> = {
    chat_id: CHANNEL,
    text: post.text,
    disable_web_page_preview: false,
  };

  if (post.button) {
    body.reply_markup = { inline_keyboard: [[post.button]] };
  }

  const message = await telegram("sendMessage", body);
  await rememberPublished(kind, message.message_id, post.text, post.sourceUrl);

  console.log(JSON.stringify({
    event: "published",
    kind,
    message_id: message.message_id,
    affiliate: post.affiliate?.id || null,
    ts: new Date().toISOString(),
  }));

  return {
    ok: true,
    kind,
    model: MODEL,
    messageId: message.message_id,
    affiliate: post.affiliate?.id || null,
  };
}

export function eveningKind(): "shareable" | "affiliate" | "evergreen" {
  const day = new Date().getUTCDay();
  if ([2, 4, 6].includes(day)) return "affiliate";
  if (day === 0) return "shareable";
  return "evergreen";
}

export function affiliateById(id: string) {
  return AFFILIATES.find((affiliate) => affiliate.enabled && affiliate.id === id) || null;
}

export async function recordAffiliateClick(id: string) {
  const affiliate = affiliateById(id);
  if (!affiliate) return null;

  const date = new Date().toISOString().slice(0, 10);
  const key = `clicks/${affiliate.id}/${date}.json`;
  const store = dataStore();
  const current = await store.get(key, { type: "json" }) as { count: number } | null;
  const next = { count: (current?.count || 0) + 1, updatedAt: new Date().toISOString() };
  await store.setJSON(key, next);
  return affiliate;
}

export async function captureMetrics() {
  const subscribers = await telegram("getChatMemberCount", { chat_id: CHANNEL });
  const now = new Date().toISOString();
  const state = await getState();
  state.lastMetrics = { at: now, subscribers };
  await saveState(state);
  await dataStore().setJSON(`metrics/${now.slice(0, 10)}.json`, { at: now, subscribers });

  console.log(JSON.stringify({ event: "channel_metrics", subscribers, ts: now }));
  return { subscribers, at: now };
}

export async function healthSnapshot() {
  const state = await getState();
  return {
    ok: true,
    channel: CHANNEL,
    model: MODEL,
    configured: {
      telegram: Boolean(env("TELEGRAM_BOT_TOKEN")),
      gemini: Boolean(env("GEMINI_API_KEY")),
    },
    lastFresh: state.lastFresh || null,
    lastEvening: state.lastEvening || null,
    lastMetrics: state.lastMetrics || null,
    rememberedUrls: state.publishedUrls.length,
  };
}
