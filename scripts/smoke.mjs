import fs from "node:fs";

const CHANNEL = "@jepeta_tools";
const MODEL = "gemini-3.8-flash";

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

async function telegram(token, method, body = {}) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(`Telegram ${method} failed: ${JSON.stringify(data)}`);
  }
  return data.result;
}

async function main() {
  const telegramToken = required("TELEGRAM_BOT_TOKEN");
  const geminiKey = required("GEMINI_API_KEY");

  const me = await telegram(telegramToken, "getMe");
  const chat = await telegram(telegramToken, "getChat", { chat_id: CHANNEL });
  const membership = await telegram(telegramToken, "getChatMember", {
    chat_id: CHANNEL,
    user_id: me.id,
  });

  if (!["administrator", "creator"].includes(membership.status)) {
    throw new Error(`Telegram bot is not channel admin: ${membership.status}`);
  }

  const geminiResponse = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": geminiKey,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: "Reply exactly: OK" }] }],
        generationConfig: { maxOutputTokens: 8 },
      }),
    },
  );

  const geminiData = await geminiResponse.json();
  if (!geminiResponse.ok) {
    throw new Error(`Gemini smoke test failed: ${JSON.stringify(geminiData)}`);
  }

  const geminiText = (geminiData.candidates?.[0]?.content?.parts || [])
    .map((part) => part.text || "")
    .join("")
    .trim();

  if (!geminiText) throw new Error("Gemini returned no text");

  fs.mkdirSync("public", { recursive: true });
  fs.writeFileSync(
    "public/runtime-check.json",
    JSON.stringify(
      {
        ok: true,
        checkedAt: new Date().toISOString(),
        telegram: {
          bot: me.username || null,
          channel: chat.username || null,
          botStatus: membership.status,
        },
        gemini: {
          model: MODEL,
          responded: true,
        },
      },
      null,
      2,
    ),
  );

  console.log(
    "JEPETA_SMOKE_OK",
    JSON.stringify({
      bot: me.username,
      channel: chat.username,
      botStatus: membership.status,
      model: MODEL,
    }),
  );
}

main().catch((error) => {
  console.error("JEPETA_SMOKE_FAILED", error);
  process.exit(1);
});
