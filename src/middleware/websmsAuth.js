const fallbackKey = "websms_temp_1f4c9b7e0d2a4b7e9c1f";
const websmsApiKey = process.env.WEBSMS_API_KEY || fallbackKey;

import { query } from "../db.js";

async function resolveGroupByKey(token) {
  const now = Date.now();
  const cached = keyCache.get(token);
  if (cached && cached.expiresAt > now) {
    return cached.groupId;
  }
  if (!token) {
    return null;
  }
  const result = await query(
    "select group_id from websms_api_keys where api_key = $1 limit 1",
    [token]
  );
  if (result.rows[0]?.group_id) {
    keyCache.set(token, { groupId: result.rows[0].group_id, expiresAt: now + CACHE_TTL_MS });
    return result.rows[0].group_id;
  }
  if (token === websmsApiKey) {
    const groupResult = await query(
      "select id from groups where name = 'family' limit 1"
    );
    const groupId = groupResult.rows[0]?.id;
    if (!groupId) {
      return null;
    }
    await query(
      "insert into websms_api_keys (group_id, api_key) values ($1, $2) on conflict do nothing",
      [groupId, token]
    );
    keyCache.set(token, { groupId, expiresAt: now + CACHE_TTL_MS });
    return groupId;
  }
  return null;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const keyCache = new Map();

export function requireWebSmsApiKey(req, res, next) {
  const headerKey = req.get("x-api-key");
  const authHeader = req.get("authorization");
  let token = headerKey;

  if (!token && authHeader?.toLowerCase().startsWith("bearer ")) {
    token = authHeader.slice(7).trim();
  }

  return resolveGroupByKey(token)
    .then((groupId) => {
      if (!groupId) {
        return res.status(401).json({ error: "invalid api key" });
      }
      req.websmsGroupId = groupId;
      return next();
    })
    .catch(() => res.status(500).json({ error: "failed to authorize" }));
}

export function getWebSmsApiKey() {
  return websmsApiKey;
}

export function isWebSmsFallbackKey() {
  return !process.env.WEBSMS_API_KEY;
}
