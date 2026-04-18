// pages/api/claims-log.js
// Returns stored claims for the admin dashboard.
// Claims are written to an in-memory store on this serverless instance — 
// for persistence across deploys/instances, connect Vercel KV (see README comment below).
//
// To enable persistent storage:
// 1. Run: vercel kv create euralrefund-claims
// 2. Add KV_REST_API_URL and KV_REST_API_TOKEN to Vercel env vars
// 3. Uncomment the KV block below and remove the in-memory fallback

// ---- Persistent store (Vercel KV) — uncomment when KV is set up ----
// import { kv } from "@vercel/kv";
// export async function storeClaim(claim) {
//   const id = `claim:${Date.now()}`;
//   await kv.set(id, JSON.stringify(claim));
//   await kv.lpush("claim-ids", id);
// }
// export async function getClaims() {
//   const ids = await kv.lrange("claim-ids", 0, 99);
//   const claims = await Promise.all(ids.map(id => kv.get(id)));
//   return claims.filter(Boolean).map(c => JSON.parse(c));
// }
// -----------------------------------------------------------------------

// ---- In-memory fallback (resets on cold start — dev/early use only) ---
const CLAIM_STORE = [];
export function storeClaim(claim) { CLAIM_STORE.unshift(claim); }
export function getClaims() { return [...CLAIM_STORE]; }
// -----------------------------------------------------------------------

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "changeme";

export default async function handler(req, res) {
  const auth = req.headers.authorization || "";
  const token = auth.replace("Bearer ", "");

  if (token !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.method === "GET") {
    return res.status(200).json({ claims: getClaims() });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
