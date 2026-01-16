import { query } from "../db.js";

async function resolveUserByKey(token) {
  const now = Date.now();
  const cached = keyCache.get(token);
  if (cached && cached.expiresAt > now) {
    return cached;
  }
  if (!token) {
    return null;
  }
  const result = await query(
    "select u.id, u.active_group_id from user_api_keys k join users u on k.user_id = u.id where k.api_key = $1 limit 1",
    [token]
  );
  const row = result.rows[0];
  if (!row) {
    return null;
  }

  let groupId = row.active_group_id;
  if (!groupId) {
    const groupResult = await query(
      "select group_id from user_group_access where user_id = $1 order by created_at asc limit 1",
      [row.id]
    );
    groupId = groupResult.rows[0]?.group_id || null;
    if (groupId) {
      await query("update users set active_group_id = $1 where id = $2", [groupId, row.id]);
    }
  }

  const payload = { userId: row.id, groupId };
  keyCache.set(token, { ...payload, expiresAt: now + CACHE_TTL_MS });
  return payload;
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

  return resolveUserByKey(token)
    .then((payload) => {
      if (!payload?.userId) {
        return res.status(401).json({ error: "invalid api key" });
      }
      req.websmsUserId = payload.userId;
      req.websmsGroupId = payload.groupId;
      return next();
    })
    .catch(() => res.status(500).json({ error: "failed to authorize" }));
}
