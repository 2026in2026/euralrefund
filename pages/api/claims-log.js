// pages/api/claims-log.js
// Persistent claim storage using Vercel KV.
// Falls back to in-memory if KV env vars are not set (local dev only).

let kv = null;

async function getKV() {
    if (kv) return kv;
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
          const mod = await import("@vercel/kv");
          kv = mod.kv;
    }
    return kv;
}

// ---- In-memory fallback (resets on cold start) ----
const CLAIM_STORE = [];

export async function storeClaim(claim) {
    const store = await getKV();
    if (store) {
          const id = `claim:${Date.now()}`;
          await store.set(id, JSON.stringify(claim));
          await store.lpush("claim-ids", id);
    } else {
          CLAIM_STORE.unshift(claim);
    }
}

export async function getClaims() {
    const store = await getKV();
    if (store) {
          const ids = await store.lrange("claim-ids", 0, 199);
          if (!ids || ids.length === 0) return [];
          const claims = await Promise.all(ids.map(id => store.get(id)));
          return claims
            .filter(Boolean)
            .map(c => (typeof c === "string" ? JSON.parse(c) : c));
    }
    return [...CLAIM_STORE];
}

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "changeme";

export default async function handler(req, res) {
    const auth = req.headers.authorization || "";
    const token = auth.replace("Bearer ", "");
    if (token !== ADMIN_PASSWORD) {
          return res.status(401).json({ error: "Unauthorized" });
    }
    if (req.method === "GET") {
          const claims = await getClaims();
          return res.status(200).json({ claims });
    }
    return res.status(405).json({ error: "Method not allowed" });
}
