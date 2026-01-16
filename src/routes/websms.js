import { query } from "../db.js";

const WEB_SMS_LOG_LIMIT = 200;

export async function listWebSmsLogs(req, res) {
  const requestedGroupId = req.query.group_id ? Number(req.query.group_id) : null;
  if (requestedGroupId && req.user.role === "admin") {
    const result = await query(
      "select id, received_at, text_length, text_preview, text, status from websms_logs where group_id = $1 order by received_at desc limit $2",
      [requestedGroupId, WEB_SMS_LOG_LIMIT]
    );
    return res.json({ items: result.rows });
  }

  if (!req.user.group_id) {
    return res.json({ items: [] });
  }
  const result = await query(
    "select id, received_at, text_length, text_preview, text, status from websms_logs where group_id = $1 order by received_at desc limit $2",
    [req.user.group_id, WEB_SMS_LOG_LIMIT]
  );
  return res.json({ items: result.rows });
}

export async function receiveWebSms(req, res) {
  const { text } = req.body;
  const receivedAt = new Date().toISOString();
  const content = String(text || "");
  const preview = content.length > 120 ? `${content.slice(0, 120)}...` : content;

  if (!text) {
    return res.status(400).json({ error: "text required" });
  }

  console.log(
    JSON.stringify({
      event: "websms_received",
      received_at: receivedAt,
      text_length: content.length,
      text_preview: preview
    })
  );

  await query(
    "insert into websms_logs (group_id, received_at, text_length, text_preview, text, status) values ($1, $2, $3, $4, $5, 'unmatched') on conflict do nothing",
    [req.websmsGroupId, receivedAt, content.length, preview, content]
  );

  return res.json({
    ok: true,
    received_at: receivedAt,
    text
  });
}
