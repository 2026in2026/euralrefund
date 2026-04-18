// pages/api/analyse-ticket.js
// Proxies ticket image/PDF to Claude API for field extraction
// Includes: file size guard, basic rate limiting, input sanitization

const RATE_MAP = new Map(); // IP -> { count, resetAt }
const RATE_LIMIT = 10;      // max requests per window
const RATE_WINDOW = 60_000; // 1 minute

function getRateKey(req) {
  return req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || "unknown";
}

function isRateLimited(ip) {
  const now = Date.now();
  const entry = RATE_MAP.get(ip);
  if (!entry || now > entry.resetAt) {
    RATE_MAP.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return false;
  }
  entry.count++;
  if (entry.count > RATE_LIMIT) return true;
  return false;
}

export const config = {
  api: { bodyParser: { sizeLimit: "12mb" } },
};

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const ip = getRateKey(req);
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: "Too many requests — please wait a moment and try again." });
  }

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY not set");
    return res.status(500).json({ error: "Service misconfigured" });
  }

  try {
    const { messages, model, max_tokens } = req.body || {};

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Invalid request body" });
    }

    // Validate content block — must have exactly one image or document
    const userContent = messages[0]?.content;
    if (!Array.isArray(userContent)) {
      return res.status(400).json({ error: "Invalid message content" });
    }

    const mediaBlock = userContent.find(b => b.type === "image" || b.type === "document");
    if (!mediaBlock) {
      return res.status(400).json({ error: "No ticket file provided" });
    }

    // Check base64 size (~12MB limit after decode overhead)
    const b64 = mediaBlock?.source?.data || "";
    const estimatedBytes = (b64.length * 3) / 4;
    if (estimatedBytes > 12 * 1024 * 1024) {
      return res.status(413).json({ error: "File too large — maximum 12MB" });
    }

    // Validate media type
    const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/gif"];
    const mediaType = mediaBlock?.source?.media_type;
    if (!allowedTypes.includes(mediaType)) {
      return res.status(400).json({ error: "Unsupported file type — use PDF, JPG, or PNG" });
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model || "claude-sonnet-4-20250514",
        max_tokens: max_tokens || 1000,
        messages,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic API error:", response.status, errText);
      // Don't expose internal error details to client
      return res.status(502).json({ error: "Could not analyse ticket — please try again" });
    }

    const data = await response.json();
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(200).json(data);

  } catch (e) {
    console.error("analyse-ticket error:", e);
    return res.status(500).json({ error: "Unexpected error — please try again" });
  }
}
